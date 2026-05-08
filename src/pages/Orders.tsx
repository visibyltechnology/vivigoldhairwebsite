import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

const KORAPAY_MAX_NGN = 200_000;

interface InstallmentInfo {
  id: string;
  total_parts: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  currency: "NGN" | "USD";
  status: string;
  payment_status: string;
  is_installment: boolean;
  installments: InstallmentInfo[] | null;
}

const fmt = (amount: number, currency: "NGN" | "USD") =>
  currency === "NGN"
    ? `₦${Number(amount).toLocaleString()}`
    : `$${Number(amount).toLocaleString()}`;

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders]       = useState<OrderRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [payingOrder, setPaying]  = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("orders")
      .select(
        "id, order_number, created_at, total, currency, status, payment_status, is_installment, installments(id, total_parts, total_amount, paid_amount, remaining_amount, status)"
      )
      .order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data as unknown as OrderRow[]) || []); setLoading(false); });
  }, [user]);

  const handlePay = async (orderId: string, currency: "NGN" | "USD", nextAmount: number) => {
    setPaying(orderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Auto-select gateway: Korapay for NGN ≤ ₦200k, Flutterwave for larger amounts
      const fn = currency === "NGN" && nextAmount > KORAPAY_MAX_NGN
        ? "flutterwave-pay-installment"
        : "korapay-pay-installment";

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey":        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ order_id: orderId }),
        }
      );
      const json = await res.json();
      if (json.error)        toast.error(json.error);
      else if (json.payment_link) window.location.href = json.payment_link;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPaying(null);
    }
  };

  if (authLoading) return <Layout><div className="container py-20 text-center text-muted-foreground">Loading…</div></Layout>;
  if (!user)       return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <div className="container py-16 max-w-4xl">
        <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Account</span>
        <h1 className="font-display text-5xl mt-2 mb-10">Your orders</h1>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="size-8 animate-spin text-primary mx-auto" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 border border-border bg-card">
            <Package className="size-12 text-muted-foreground mx-auto mb-4" strokeWidth={1} />
            <p className="font-display text-3xl mb-2">No orders yet</p>
            <p className="text-muted-foreground mb-6">Your purchases will appear here.</p>
            <Button asChild variant="gold"><Link to="/shop">Shop now</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const inst = o.is_installment && o.installments?.length ? o.installments[0] : null;
              const isPaying = payingOrder === o.id;

              const perPart    = inst ? Math.floor(Number(inst.total_amount) / inst.total_parts) : 0;
              const partsPaid  = inst && perPart > 0
                ? Math.min(inst.total_parts, Math.round(Number(inst.paid_amount) / perPart))
                : 0;
              const nextAmt    = inst ? Math.min(perPart, Number(inst.remaining_amount)) : 0;
              const progressPct = inst ? (partsPaid / inst.total_parts) * 100 : 0;
              const hasBalance  = !!(inst && inst.status !== "completed" && Number(inst.remaining_amount) > 0);

              return (
                <div key={o.id} className="border border-border bg-card p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm text-primary">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(o.created_at).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                        {o.is_installment && (
                          <span className="ml-2 text-primary">· Pay Small Small</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display text-xl">{fmt(o.total, o.currency)}</p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                        {o.payment_status} · {o.status}
                      </p>
                    </div>
                  </div>

                  {/* Installment section */}
                  {inst && (
                    <div className="border-t border-border pt-4 space-y-3">
                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span>{partsPaid} of {inst.total_parts} payments made</span>
                          <span>{Math.round(progressPct)}%</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500 rounded-full"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Balance + button */}
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="text-sm space-y-0.5">
                          {hasBalance ? (
                            <>
                              <p className="text-muted-foreground">
                                Paid:{" "}
                                <span className="text-foreground font-medium">
                                  {fmt(inst.paid_amount, o.currency)}
                                </span>
                                {" · "}
                                Remaining:{" "}
                                <span className="text-primary font-medium">
                                  {fmt(inst.remaining_amount, o.currency)}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Next payment:{" "}
                                <span className="text-foreground font-semibold">
                                  {fmt(nextAmt, o.currency)}
                                </span>
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                              <CheckCircle2 className="size-3.5" /> All payments complete
                            </p>
                          )}
                        </div>

                        {hasBalance && (
                          <Button
                            variant="gold"
                            size="sm"
                            disabled={isPaying}
                            onClick={() => handlePay(o.id, o.currency, nextAmt)}
                            className="flex-shrink-0 gap-1.5"
                          >
                            {isPaying ? (
                              <><Loader2 className="size-3.5 animate-spin" /> Redirecting…</>
                            ) : (
                              <><CreditCard className="size-3.5" /> Pay {fmt(nextAmt, o.currency)}</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Button asChild variant="luxe"><Link to="/account">Back to account</Link></Button>
        </div>
      </div>
    </Layout>
  );
};

export default Orders;
