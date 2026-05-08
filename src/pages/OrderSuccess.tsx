import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

interface InstallmentSummary {
  partsPaid: number;
  totalParts: number;
  remaining: number;
  currency: "NGN" | "USD";
}

const fmt = (n: number, currency: "NGN" | "USD") =>
  currency === "NGN" ? `₦${Number(n).toLocaleString()}` : `$${Number(n).toLocaleString()}`;

const OrderSuccess = () => {
  const [params] = useSearchParams();
  const { clear } = useCart();
  const [status, setStatus]         = useState<"checking" | "paid" | "failed">("checking");
  const [orderNumber, setOrderNum]  = useState<string | null>(null);
  const [installment, setInst]      = useState<InstallmentSummary | null>(null);
  const [isFollowOn, setFollowOn]   = useState(false);

  const txStatus      = params.get("status");
  const transactionId = params.get("transaction_id");
  const koraReference = params.get("reference");
  const orderId       = params.get("order_id");

  useEffect(() => {
    const run = async () => {
      try {
        // ── Korapay ────────────────────────────────────────────
        if (koraReference) {
          if (txStatus === "failed" || txStatus === "cancelled") {
            setStatus("failed");
            return;
          }
          const { data, error } = await supabase.functions.invoke("korapay-verify", {
            body: { reference: koraReference },
          });
          if (error || !data?.paid) { setStatus("failed"); return; }

          // Only clear cart for first payment (follow-on installment payments have empty carts)
          if (data.part_number <= 1) clear();
          setFollowOn(data.part_number > 1);
          sessionStorage.removeItem("vg_pending_order");
          setStatus("paid");

          if (orderId) await fetchOrderInfo(orderId);
          return;
        }

        // ── Flutterwave ────────────────────────────────────────
        if (txStatus === "cancelled" || !transactionId) {
          setStatus("failed");
          return;
        }
        const { data, error } = await supabase.functions.invoke("flutterwave-verify", {
          body: { transaction_id: transactionId },
        });
        if (error || !data?.paid) { setStatus("failed"); return; }

        if (!data.is_installment || data.part_number <= 1) clear();
        setFollowOn(data.is_installment && data.part_number > 1);
        sessionStorage.removeItem("vg_pending_order");
        setStatus("paid");

        if (orderId) await fetchOrderInfo(orderId);
      } catch {
        setStatus("failed");
      }
    };

    const fetchOrderInfo = async (oid: string) => {
      const { data: ord } = await supabase
        .from("orders")
        .select("order_number, currency, is_installment, installments(total_parts, total_amount, paid_amount, remaining_amount)")
        .eq("id", oid)
        .maybeSingle();
      if (!ord) return;
      setOrderNum(ord.order_number ?? null);
      if (ord.is_installment && ord.installments?.length) {
        const inst = ord.installments[0] as any;
        const perPart   = Math.floor(Number(inst.total_amount) / inst.total_parts);
        const partsPaid = perPart > 0
          ? Math.min(inst.total_parts, Math.round(Number(inst.paid_amount) / perPart))
          : 0;
        setInst({
          partsPaid,
          totalParts:  inst.total_parts,
          remaining:   Number(inst.remaining_amount),
          currency:    ord.currency as "NGN" | "USD",
        });
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="container py-20 max-w-xl text-center">
        {status === "checking" && (
          <>
            <Loader2 className="size-12 text-primary mx-auto mb-6 animate-spin" strokeWidth={1} />
            <h1 className="font-display text-4xl mb-3">Confirming your payment…</h1>
            <p className="text-muted-foreground">Please don't close this page.</p>
          </>
        )}

        {status === "paid" && (
          <>
            <CheckCircle2 className="size-14 text-primary mx-auto mb-6" strokeWidth={1.2} />
            <span className="text-[11px] tracking-[0.3em] uppercase text-primary">
              {isFollowOn ? "Payment received" : "Order confirmed"}
            </span>
            <h1 className="font-display text-5xl mt-2 mb-4">Thank you</h1>

            {orderNumber && (
              <p className="text-muted-foreground mb-2">
                Order <span className="text-foreground font-mono">{orderNumber}</span>
              </p>
            )}

            {installment ? (
              <div className="bg-primary/5 border border-primary/20 rounded p-4 mb-6 text-sm space-y-1">
                <p className="text-primary font-semibold">
                  Payment {installment.partsPaid} of {installment.totalParts} complete
                </p>
                {installment.remaining > 0 ? (
                  <p className="text-muted-foreground">
                    Remaining balance:{" "}
                    <span className="text-foreground font-medium">
                      {fmt(installment.remaining, installment.currency)}
                    </span>
                    {" — "}pay from your orders page when ready.
                  </p>
                ) : (
                  <p className="text-emerald-600 font-medium">All payments complete — your order is fully paid!</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground mb-8">
                We've received your payment. You'll get an email confirmation shortly.
              </p>
            )}

            <div className="flex justify-center gap-3">
              <Button asChild variant="gold">
                <Link to="/account/orders">View my orders</Link>
              </Button>
              <Button asChild variant="luxe">
                <Link to="/shop">Keep shopping</Link>
              </Button>
            </div>
          </>
        )}

        {status === "failed" && (
          <>
            <XCircle className="size-14 text-destructive mx-auto mb-6" strokeWidth={1.2} />
            <h1 className="font-display text-4xl mb-3">Payment not completed</h1>
            <p className="text-muted-foreground mb-8">
              Your payment was cancelled or could not be verified. No charge has been made.
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild variant="gold"><Link to="/checkout">Try again</Link></Button>
              <Button asChild variant="luxe"><Link to="/cart">Back to bag</Link></Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default OrderSuccess;
