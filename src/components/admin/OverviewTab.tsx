import { useEffect, useState } from "react";
import { sb as supabase } from "@/integrations/supabase/admin-client";
import { Users, Package, ShoppingBag, CreditCard, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";

interface Stats {
  total_users?: number;
  total_admins?: number;
  total_products?: number;
  active_products?: number;
  total_orders?: number;
  pending_orders?: number;
  processing_orders?: number;
  shipped_orders?: number;
  delivered_orders?: number;
  paid_orders?: number;
  partial_orders?: number;
  unpaid_orders?: number;
  revenue_ngn?: number;
  revenue_usd?: number;
  partial_revenue_ngn?: number;
  partial_revenue_usd?: number;
  outstanding_ngn?: number;
  outstanding_usd?: number;
  active_installments?: number;
  completed_installments?: number;
  defaulted_installments?: number;
}

const fmt = (n: number | undefined, sym = "") =>
  `${sym}${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const Card = ({ icon: Icon, label, value, sub, accent = "primary" }: any) => (
  <div className="border border-border bg-card p-5">
    <div className="flex items-start justify-between mb-3">
      <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <Icon className={`size-4 text-${accent}`} />
    </div>
    <div className="font-display text-3xl">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

export const OverviewTab = () => {
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("admin_dashboard_stats");
      if (data) setStats(data as Stats);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground py-8">Loading dashboard…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Revenue (paid in full)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={TrendingUp} label="Revenue NGN" value={fmt(stats.revenue_ngn, "₦")} accent="primary" />
          <Card icon={TrendingUp} label="Revenue USD" value={fmt(stats.revenue_usd, "$")} accent="primary" />
          <Card icon={Clock} label="Installment paid NGN" value={fmt(stats.partial_revenue_ngn, "₦")} sub="Already collected" />
          <Card icon={Clock} label="Installment paid USD" value={fmt(stats.partial_revenue_usd, "$")} sub="Already collected" />
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Outstanding (still owed)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={AlertTriangle} label="Owed NGN" value={fmt(stats.outstanding_ngn, "₦")} accent="destructive" />
          <Card icon={AlertTriangle} label="Owed USD" value={fmt(stats.outstanding_usd, "$")} accent="destructive" />
          <Card icon={CreditCard} label="Active plans" value={fmt(stats.active_installments)} />
          <Card icon={CheckCircle2} label="Completed plans" value={fmt(stats.completed_installments)} sub={`${stats.defaulted_installments ?? 0} defaulted`} />
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Catalog & customers</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={Users} label="Customers" value={fmt(stats.total_users)} sub={`${stats.total_admins ?? 0} admins`} />
          <Card icon={Package} label="Products" value={fmt(stats.total_products)} sub={`${stats.active_products ?? 0} active`} />
          <Card icon={ShoppingBag} label="Orders" value={fmt(stats.total_orders)} sub={`${stats.paid_orders ?? 0} paid · ${stats.partial_orders ?? 0} partial`} />
          <Card icon={Clock} label="Order pipeline" value={fmt((stats.pending_orders ?? 0) + (stats.processing_orders ?? 0))} sub={`${stats.shipped_orders ?? 0} shipped · ${stats.delivered_orders ?? 0} delivered`} />
        </div>
      </div>
    </div>
  );
};
