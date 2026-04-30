import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Package, Loader2 } from "lucide-react";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  currency: "NGN" | "USD";
  status: string;
  payment_status: string;
  is_installment: boolean;
}

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("orders")
      .select("id, order_number, created_at, total, currency, status, payment_status, is_installment")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders((data as OrderRow[]) || []);
        setLoading(false);
      });
  }, [user]);

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
            {orders.map((o) => (
              <div key={o.id} className="border border-border bg-card p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-sm text-primary">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(o.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                    {o.is_installment && <span className="ml-2 text-primary">· Pay Small Small</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl">
                    {o.currency === "NGN" ? `₦${Number(o.total).toLocaleString()}` : `$${Number(o.total).toLocaleString()}`}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                    {o.payment_status} · {o.status}
                  </p>
                </div>
              </div>
            ))}
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
