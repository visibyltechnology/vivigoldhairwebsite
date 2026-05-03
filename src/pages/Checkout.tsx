import { useEffect, 

    // Validate cart items against live products table
    useEffect(() => {
      if (items.length === 0) { setValidatingCart(false); return; }
      const ids = items.map((i) => i.id);
      supabase
        .from("products")
        .select("id")
        .in("id", ids)
        .then(({ data }) => {
          const existingIds = new Set((data || []).map((p: { id: string }) => p.id));
          setStaleItems(ids.filter((id) => !existingIds.has(id)));
          setValidatingCart(false);
        })
        .catch(() => setValidatingCart(false));
    }, [items]);useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CreditCard, Loader2, Lock, ShoppingBag, X } from "lucide-react";

const SHIPPING_FEES = { NGN: 5000, USD: 15 };

interface GatewayState {
  flutterwave: boolean;
  korapay: boolean;
}

const Checkout = () => {
  const { items, subtotalNgn, subtotalUsd, clear, remove } = useCart();
  const { currency, format } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState<"1" | "2" | "3" | "4">("1");
  const [selectedGateway, setSelectedGateway] = useState<"flutterwave" | "korapay">("flutterwave");
  const [gateways, setGateways] = useState<GatewayState>({ flutterwave: true, korapay: false });
    const [staleItems, setStaleItems] = useState<string[]>([]);
    const [validatingCart, setValidatingCart] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: currency === "NGN" ? "Nigeria" : "United States",
    notes: "",
  });

  useEffect(() => {
    if (user?.email) setForm((f) => ({ ...f, email: user.email || f.email }));
  }, [user]);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "payment_gateways")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as any;
          const flw = v?.flutterwave?.enabled ?? true;
          const kora = v?.korapay?.enabled ?? false;
          setGateways({ flutterwave: flw, korapay: kora });
          // Auto-select first enabled gateway
          if (flw) setSelectedGateway("flutterwave");
          else if (kora) setSelectedGateway("korapay");
        }
      });
  }, []);

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container py-20 max-w-2xl text-center">
          <ShoppingBag className="size-12 text-muted-foreground mx-auto mb-6" strokeWidth={1} />
          <h1 className="font-display text-4xl mb-4">Your bag is empty</h1>
          <Button asChild variant="gold"><Link to="/shop">Shop the collection</Link></Button>
        </div>
      </Layout>
    );
  }

  const subtotal = currency === "NGN" ? subtotalNgn : subtotalUsd;
  const shippingFee = SHIPPING_FEES[currency];
  const total = subtotal + shippingFee;
  const partsNum = Number(parts);
  const firstPay = partsNum > 1 ? Math.ceil(total / partsNum) : total;

  const enabledCount = (gateways.flutterwave ? 1 : 0) + (gateways.korapay ? 1 : 0);
  const showGatewayPicker = enabledCount > 1;

  const handlePay = async () => {
    if (!user) {
      toast.error("Please sign in to checkout");
      navigate("/auth?redirect=/checkout");
      return;
    }
    if (!form.name || !form.email || !form.address || !form.city) {
      toast.error("Please fill in all shipping details");
      return;
    }
    if (enabledCount === 0) {
      toast.error("No payment gateway is active. Please contact the store.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        currency,
        customer: { name: form.name, email: form.email, phone: form.phone },
        shipping: {
          address: form.address,
          city: form.city,
          state: form.state,
          country: form.country,
          notes: form.notes,
        },
        items: items.map((i) => ({
          product_id: i.id,
          name: i.name,
          image: i.image,
          price: currency === "NGN" ? i.price_ngn : i.price_usd,
          quantity: i.quantity,
        })),
        shipping_fee: shippingFee,
        is_installment: partsNum > 1,
        installment_parts: partsNum,
      };

      const fnName = selectedGateway === "korapay" ? "korapay-initiate" : "flutterwave-initiate";
      const { data, error } = await supabase.functions.invoke(fnName, { body: payload });
      if (error) {
        let errMsg = error.message;
        try {
          const ctx = (error as any)?.context;
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : ctx;
          if (body?.error) errMsg = body.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      if (!data?.payment_link) throw new Error(data?.error || "No payment link returned");

      sessionStorage.setItem("vg_pending_order", data.order_id);
      window.location.href = data.payment_link;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed to initiate";
      toast.error(msg);
      setLoading(false);
    }
  };

  const gatewayLabel = selectedGateway === "korapay" ? "Korapay" : "Flutterwave";
  const gatewaySubtext =
    selectedGateway === "korapay"
      ? "Korapay · Cards · Bank transfer · USSD"
      : "Flutterwave · Cards · Bank transfer · USSD";

  return (
    <Layout>
      <div className="container py-12 max-w-6xl">
        <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Secure checkout</span>
        <h1 className="font-display text-4xl md:text-5xl mt-2 mb-10">Complete your order</h1>

        <div className="grid lg:grid-cols-[1fr_420px] gap-10">
          {/* Form */}
          <div className="space-y-8">
            <section className="border border-border bg-card p-6">
              <h2 className="font-display text-2xl mb-5">Contact</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234..." />
                </div>
              </div>
            </section>

            <section className="border border-border bg-card p-6">
              <h2 className="font-display text-2xl mb-5">Shipping address</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="address">Street address *</Label>
                  <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="state">State / Region</Label>
                  <Input id="state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="notes">Order notes (optional)</Label>
                  <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
            </section>

            {/* Payment gateway picker — only shown when both are enabled */}
            {showGatewayPicker && (
              <section className="border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="size-4 text-primary" />
                  <h2 className="font-display text-2xl">Payment method</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Choose how you'd like to pay.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {gateways.flutterwave && (
                    <button
                      onClick={() => setSelectedGateway("flutterwave")}
                      className={`border p-4 text-left transition ${
                        selectedGateway === "flutterwave"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">🟠 Flutterwave</p>
                      <p className="text-xs text-muted-foreground mt-1">Cards · Bank transfer · USSD</p>
                    </button>
                  )}
                  {gateways.korapay && (
                    <button
                      onClick={() => setSelectedGateway("korapay")}
                      className={`border p-4 text-left transition ${
                        selectedGateway === "korapay"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">🟣 Korapay</p>
                      <p className="text-xs text-muted-foreground mt-1">Cards · Bank transfer · USSD</p>
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="border border-primary/30 bg-primary/5 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="size-4 text-primary" />
                <h2 className="font-display text-2xl text-primary">Pay Small Small</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Split your payment into installments. First payment due now, the rest on agreed dates.
                Order ships once fully paid.
              </p>
              <RadioGroup value={parts} onValueChange={(v) => setParts(v as typeof parts)} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["1", "2", "3", "4"] as const).map((p) => (
                  <Label
                    key={p}
                    htmlFor={`p-${p}`}
                    className={`border p-4 cursor-pointer text-center transition ${
                      parts === p ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value={p} id={`p-${p}`} className="sr-only" />
                    <div className="font-display text-2xl">{p === "1" ? "Full" : `÷${p}`}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p === "1" ? "One payment" : `${p} parts`}
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </section>
          </div>

          {/* Summary */}
          <aside className="border border-border bg-card p-6 h-fit lg:sticky lg:top-28">
            <h3 className="font-display text-2xl mb-5">Order summary</h3>
            <div className="space-y-3 max-h-64 overflow-auto pb-4 border-b border-border">
              {items.map((it) => (
                <div key={it.id} className="flex gap-3 text-sm">
                  <div className="size-14 bg-background overflow-hidden flex-shrink-0">
                    <img src={it.image} alt={it.name} className="size-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="line-clamp-1">{it.name}</p>
                    <p className="text-muted-foreground text-xs">Qty {it.quantity}</p>
                  </div>
                  <p className="text-primary">{format(it.price_ngn * it.quantity, it.price_usd * it.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-sm py-4 border-b border-border">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{format(subtotalNgn, subtotalUsd)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{currency === "NGN" ? `₦${shippingFee.toLocaleString()}` : `$${shippingFee}`}</span></div>
            </div>
            <div className="flex justify-between items-baseline py-4">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
              <span className="font-display text-3xl text-gold">
                {currency === "NGN" ? `₦${total.toLocaleString()}` : `$${total}`}
              </span>
            </div>
            {partsNum > 1 && (
              <div className="bg-primary/10 border border-primary/30 p-3 mb-4 text-sm">
                <p className="text-primary font-semibold">Pay now: {currency === "NGN" ? `₦${firstPay.toLocaleString()}` : `$${firstPay}`}</p>
                <p className="text-xs text-muted-foreground mt-1">Then {partsNum - 1} more payment{partsNum > 2 ? "s" : ""} of similar amount.</p>
              </div>
            )}
            {/* Stale cart items warning */}
          {staleItems.length > 0 && (
            <div className="border border-destructive/40 bg-destructive/5 p-4 mb-4">
              <p className="text-sm font-semibold text-destructive flex items-center gap-2 mb-3">
                <AlertTriangle className="size-4 flex-shrink-0" />
                Some items are no longer available
              </p>
              <div className="space-y-2">
                {items.filter((i) => staleItems.includes(i.id)).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground line-through line-clamp-1 flex-1">{item.name}</span>
                    <button
                      onClick={() => remove(item.id)}
                      className="flex items-center gap-1 text-destructive hover:text-destructive/80 text-xs font-medium flex-shrink-0"
                    >
                      <X className="size-3" /> Remove
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Remove unavailable items to continue.</p>
            </div>
          )}
          <Button variant="gold" size="lg" className="w-full" onClick={handlePay} disabled={loading || validatingCart || staleItems.length > 0}>
              {loading || validatingCart ? <><Loader2 className="size-4 animate-spin" /> {validatingCart ? "Checking cart…" : "Redirecting…"}</> : <><Lock className="size-4" /> Pay with {gatewayLabel}</>}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Secured by {gatewaySubtext}
            </p>
          </aside>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
