import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const OrderSuccess = () => {
  const [params] = useSearchParams();
  const { clear } = useCart();
  const [status, setStatus] = useState<"checking" | "paid" | "failed">("checking");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const txStatus = params.get("status"); // Flutterwave: successful | cancelled
  const transactionId = params.get("transaction_id");
  const orderId = params.get("order_id");

  useEffect(() => {
    const run = async () => {
      if (txStatus === "cancelled" || !transactionId) {
        setStatus("failed");
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("flutterwave-verify", {
          body: { transaction_id: transactionId },
        });
        if (error || !data?.paid) {
          setStatus("failed");
          return;
        }
        setStatus("paid");
        clear();
        sessionStorage.removeItem("vg_pending_order");
        if (orderId) {
          const { data: ord } = await supabase
            .from("orders")
            .select("order_number")
            .eq("id", orderId)
            .maybeSingle();
          setOrderNumber(ord?.order_number ?? null);
        }
      } catch {
        setStatus("failed");
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
            <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Order confirmed</span>
            <h1 className="font-display text-5xl mt-2 mb-4">Thank you</h1>
            {orderNumber && (
              <p className="text-muted-foreground mb-2">Order <span className="text-foreground font-mono">{orderNumber}</span></p>
            )}
            <p className="text-muted-foreground mb-8">
              We've received your payment. You'll get an email confirmation shortly.
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild variant="gold"><Link to="/account/orders">View my orders</Link></Button>
              <Button asChild variant="luxe"><Link to="/shop">Keep shopping</Link></Button>
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
