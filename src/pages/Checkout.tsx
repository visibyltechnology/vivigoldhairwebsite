import { useEffect, useState } from "react";
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
import { AlertTriangle, CreditCard, Info, Loader2, Lock, ShoppingBag, X } from "lucide-react";

const SHIPPING_FEES = { NGN: 5000, USD: 15 };
const KORAPAY_MAX_NGN = 200_000;

interface GatewayState {
  flutterwave: boolean;
  korapay: boolean;
}

interface InstallmentRates {
  two_parts: number;
  three_parts: number;
  four_parts: number;
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
  const [installmentRates, setInstallmentRates] = useState<InstallmentRates>({ two_parts: 10, three_parts: 20, four_parts: 30 });
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
      .select("key,value")
      .in("key", ["payment_gateways", "installment_rates"])
      .then(({ data }) => {
        (data || []).forEach((row) => {
          const v = row.value as any;
          if (row.key === "payment_gateways") {
            const flw = v?.flutterwave?.enabled ?? true;
            const kora = v?.korapay?.enabled ?? false;
            setGateways({ flutterwave: flw, korapay: kora });
            if (flw) setSelectedGateway("flutterwave");
            else if (kora) setSelectedGateway("korapay");
          } else if (row.key === "installment_rates") {
            setInstallmentRates({
              two_parts: v?.two_parts ?? 10,
              three_parts: v?.three_parts ?? 20,
              four_parts: v?.four_parts ?? 30,
            });
          }
        });
      });
  }, []);

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
  }, [items]);

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

  const interestRatePct =
    partsNum === 2 ? installmentRates.two_parts :
    partsNum === 3 ? installmentRates.three_parts :
    partsNum === 4 ? installmentRates.four_parts : 0;

  const totalWithInterest = partsNum > 1 && interestRatePct > 0
    ? Math.round(total * (1 + interestRatePct / 100))
    : total;
  const interestAmount = totalWithInterest - total;
  const firstPay = partsNum > 1 ? Math.floor(totalWithInterest / partsNum) : total;

  // Korapay caps each transaction at ₦200,000 (NGN only)
  const korapayOk = currency !== "NGN" || firstPay <= KORAPAY_MAX_NGN;

  // Auto-switch away from Korapay when the current payment amount exceeds its limit
  useEffect(() => {
    if (!korapayOk && selectedGateway === "korapay" && gateways.flutterwave) {
      setSelectedGateway("flutterwave");
    }
  }, [korapayOk, selectedGateway, gateways.flutterwave]);

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
    if (selectedGateway === "korapay" && !korapayOk) {
      toast.error(`This amount exceeds Korapay's ₦200,000 limit. Please use Flutterwave or choose a smaller instalment plan.`);
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
        installment_interest_rate_pct: partsNum > 1 ? interestRatePct : 0,
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

  const interestLabel = (pct: number) => pct > 0 ? `+${pct}% interest` : "No interest";

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
                    <div className="relative">
                      <button
                        onClick={() => korapayOk && setSelectedGateway("korapay")}
                        disabled={!korapayOk}
                        className={`w-full border p-4 text-left transition ${
                          !korapayOk
                            ? "border-border opacity-40 cursor-not-allowed"
                            : selectedGateway === "korapay"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium text-sm">🟣 Korapay</p>
                        <p className="text-xs text-muted-foreground mt-1">Cards · Bank transfer · USSD</p>
                        {!korapayOk && (
                          <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                            <Info className="size-3 inline" /> Limit: ₦200,000 per payment
                          </p>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {gateways.korapay && !korapayOk && (
                  <p className="text-xs text-amber-500 mt-3 flex items-start gap-2">
                    <Info className="size-3 mt-0.5 flex-shrink-0" />
                    Korapay is unavailable for this amount (₦{firstPay.toLocaleString()} exceeds the ₦200,000 per-payment limit).
                    Using Flutterwave instead, or choose a 3 or 4-part instalment plan to bring each payment under the limit.
                  </p>
                )}
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
                {([
                  { p: "1", label: "Full", sub: "One payment", rate: 0 },
                  { p: "2", label: "÷2", sub: "2 parts", rate: installmentRates.two_parts },
                  { p: "3", label: "÷3", sub: "3 parts", rate: installmentRates.three_parts },
                  { p: "4", label: "÷4", sub: "4 parts", rate: installmentRates.four_parts },
                ] as const).map(({ p, label, sub, rate: pRate }) => {
                  const pNum = Number(p);
                  const pInterest = pNum > 1 && pRate > 0 ? Math.round(total * (1 + pRate / 100)) : total;
                  const pFirst = pNum > 1 ? Math.floor(pInterest / pNum) : total;
                  const pKoraOk = currency !== "NGN" || pFirst <= KORAPAY_MAX_NGN;
                  const koraOnlyAndOver = gateways.korapay && !gateways.flutterwave && !pKoraOk;
                  return (
                    <Label
                      key={p}
                      htmlFor={`p-${p}`}
                      className={`border p-4 cursor-pointer text-center transition ${
                        koraOnlyAndOver ? "opacity-40 cursor-not-allowed" :
                        parts === p ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value={p} id={`p-${p}`} className="sr-only" disabled={koraOnlyAndOver} />
                      <div className="font-display text-2xl">{label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                      {p !== "1" && (
                        <div className={`text-[10px] mt-1 font-medium ${pRate > 0 ? "text-primary/70" : "text-emerald-400"}`}>
                          {interestLabel(pRate)}
                        </div>
                      )}
                    </Label>
                  );
                })}
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
              {partsNum > 1 && interestAmount > 0 && (
                <div className="flex justify-between text-primary/80">
                  <span>Installment interest ({interestRatePct}%)</span>
                  <span>+{currency === "NGN" ? `₦${interestAmount.toLocaleString()}` : `$${interestAmount}`}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-baseline py-4">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {partsNum > 1 ? "Total (with interest)" : "Total"}
              </span>
              <span className="font-display text-3xl text-gold">
                {currency === "NGN" ? `₦${totalWithInterest.toLocaleString()}` : `$${totalWithInterest}`}
              </span>
            </div>
            {partsNum > 1 && (
              <div className="bg-primary/10 border border-primary/30 p-3 mb-4 text-sm">
                <p className="text-primary font-semibold">Pay now: {currency === "NGN" ? `₦${firstPay.toLocaleString()}` : `$${firstPay}`}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Then {partsNum - 1} more payment{partsNum > 2 ? "s" : ""} of similar amount.
                  {interestRatePct > 0 && ` (${interestRatePct}% interest included)`}
                </p>
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
