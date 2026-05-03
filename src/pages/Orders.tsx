import { useEffect, useState } from "react";
  import { Layout } from "@/components/layout/Layout";
  import { useAuth } from "@/contexts/AuthContext";
  import { Navigate, Link } from "react-router-dom";
  import { supabase } from "@/integrations/supabase/client";
  import { Button } from "@/components/ui/button";
  import { Package, Loader2, CreditCard } from "lucide-react";
  import { toast } from "sonner";

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

  const fmtAmount = (amount: number, currency: "NGN" | "USD") =>
    currency === "NGN" ? `₦${Number(amount).toLocaleString()}` : `$${Number(amount).toLocaleString()}`;

  const Orders = () => {
    const { user, loading: authLoading } = useAuth();
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [payingOrder, setPayingOrder] = useState<string | null>(null);

    useEffect(() => {
      if (!user) return;
      supabase
        .from("orders")
        .select(
          "id, order_number, created_at, total, currency, status, payment_status, is_installment, installments(id, total_parts, total_amount, paid_amount, remaining_amount, status)"
        )
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setOrders((data as unknown as OrderRow[]) || []);
          setLoading(false);
        });
    }, [user]);

    const handlePayInstalment = async (orderId: string) => {
      setPayingOrder(orderId);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/korapay-pay-installment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ order_id: orderId }),
          }
        );
        const json = await res.json();
        if (json.error) {
          toast.error(json.error);
        } else if (json.payment_link) {
          window.location.href = json.payment_link;
        }
      } catch (e) {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setPayingOrder(null);
      }
    };

    if (authLoading) return <Layout><div className="container py-20 text-center text-muted-foreground">Loading...</div></Layout>;
    if (!user) return <Navigate to="/auth" replace />;

    return (
      <Layout>
        <div className="container py-16 max-w-4xl">
          <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Account</span>
          <h1 className="font-display text-5xl mt-2 mb-10">Your orders</h1>

          {loading ? (
            <div className="text-center py-20"><Loader2 className="size-8 animate-spin text-primary mx-auto" /></div>
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
                const hasRemainingBalance =
                  inst && inst.status !== "completed" && Number(inst.remaining_amount) > 0;
                const partsPaid = inst
                  ? Math.round(Number(inst.paid_amount) / Math.ceil(Number(inst.total_amount) / inst.total_parts))
                  : 0;

                return (
                  <div key={o.id} className="border border-border bg-card p-5 space-y-4">
                    {/* Order header row */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-sm text-primary">{o.order_number}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(o.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          {o.is_installment && (
                            <span className="ml-2 text-primary">· Pay Small Small</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-display text-xl">{fmtAmount(o.total, o.currency)}</p>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                          {o.payment_status} · {o.status}
                        </p>
                      </div>
                    </div>

                    {/* Instalment progress + Pay button */}
                    {inst && (
                      <div className="border-t border-border pt-4 flex items-center justify-between gap-4 flex-wrap">
                        <div className="text-sm space-y-0.5">
                          <p className="text-muted-foreground">
                            <span className="text-foreground font-medium">
                              {partsPaid} of {inst.total_parts}
                            </span>{" "}
                            instalments paid
                          </p>
                          {hasRemainingBalance && (
                            <p className="text-xs text-muted-foreground">
                              {fmtAmount(inst.paid_amount, o.currency)} paid ·{" "}
                              <span className="text-primary font-medium">
                                {fmtAmount(inst.remaining_amount, o.currency)} remaining
                              </span>
                            </p>
                          )}
                          {!hasRemainingBalance && (
                            <p className="text-xs text-green-600 font-medium">All instalments complete</p>
                          )}
                        </div>

                        {hasRemainingBalance && (
                          <Button
                            variant="gold"
                            size="sm"
                            disabled={isPaying}
                            onClick={() => handlePayInstalment(o.id)}
                            className="flex-shrink-0"
                          >
                            {isPaying ? (
                              <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Redirecting…</>
                            ) : (
                              <><CreditCard className="size-3.5 mr-1.5" /> Pay next instalment</>
                            )}
                          </Button>
                        )}
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
  