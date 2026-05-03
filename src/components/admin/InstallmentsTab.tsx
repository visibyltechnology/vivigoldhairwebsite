import { useEffect, useMemo, useState } from "react";
import { sb as supabase } from "@/integrations/supabase/admin-client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronRight, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";

interface InstallmentRow {
  id: string;
  order_id: string;
  user_id: string;
  total_parts: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  next_due_date: string | null;
  status: "active" | "completed" | "defaulted" | "cancelled";
  created_at: string;
  // joined
  order?: {
    order_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    currency: "NGN" | "USD";
    total: number;
  };
}

interface PaymentRow {
  id: string;
  installment_id: string;
  amount: number;
  part_number: number;
  due_date: string | null;
  paid_at: string | null;
  status: string;
  flutterwave_tx_ref: string | null;
}

const filters = [
  { key: "all", label: "All", icon: Clock },
  { key: "active", label: "Owing", icon: AlertTriangle },
  { key: "completed", label: "Paid in full", icon: CheckCircle2 },
  { key: "defaulted", label: "Defaulted", icon: XCircle },
] as const;

export const InstallmentsTab = () => {
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, PaymentRow[]>>({});

  const load = async () => {
    const { data } = await supabase
      .from("installments")
      .select("*, order:orders(order_number,customer_name,customer_email,customer_phone,currency,total)")
      .order("created_at", { ascending: false });
    if (data) setRows(data as InstallmentRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filter !== "all" && r.status !== filter) return false;
        if (
          search &&
          !r.order?.order_number?.toLowerCase().includes(search.toLowerCase()) &&
          !r.order?.customer_name?.toLowerCase().includes(search.toLowerCase()) &&
          !r.order?.customer_email?.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [rows, filter, search],
  );

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!payments[id]) {
      const { data } = await supabase
        .from("installment_payments")
        .select("*")
        .eq("installment_id", id)
        .order("part_number");
      if (data) setPayments((prev) => ({ ...prev, [id]: data as PaymentRow[] }));
    }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("installments").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      load();
    }
  };

  const sym = (c: string) => (c === "NGN" ? "₦" : "$");

  const counts = useMemo(() => {
    const by: Record<string, number> = { all: rows.length, active: 0, completed: 0, defaulted: 0 };
    rows.forEach((r) => {
      by[r.status] = (by[r.status] || 0) + 1;
    });
    return by;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs uppercase tracking-wider px-3 py-2 border flex items-center gap-2 ${
                filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
              }`}
            >
              <Icon className="size-3" />
              {f.label} ({counts[f.key] ?? 0})
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search order, name, email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-card border-border pl-9"
          />
        </div>
      </div>

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8"></th>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-right p-3">Total</th>
              <th className="text-right p-3">Paid</th>
              <th className="text-right p-3">Remaining</th>
              <th className="text-center p-3">Parts</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No installment plans here yet.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const c = r.order?.currency ?? "NGN";
              return (
                <>
                  <tr key={r.id} className="hover:bg-card/50 cursor-pointer" onClick={() => toggleExpand(r.id)}>
                    <td className="p-3 text-muted-foreground">
                      {expanded === r.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </td>
                    <td className="p-3 font-medium">{r.order?.order_number ?? "—"}</td>
                    <td className="p-3">
                      <div>{r.order?.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{r.order?.customer_email}</div>
                    </td>
                    <td className="p-3 text-right">{sym(c)}{Number(r.total_amount).toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-400">{sym(c)}{Number(r.paid_amount).toLocaleString()}</td>
                    <td className="p-3 text-right text-yellow-400">{sym(c)}{Number(r.remaining_amount).toLocaleString()}</td>
                    <td className="p-3 text-center">
                      {Math.round((Number(r.paid_amount) / Number(r.total_amount)) * (r.total_parts || 1))}/{r.total_parts}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                          r.status === "active"
                            ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
                            : r.status === "completed"
                            ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                            : r.status === "defaulted"
                            ? "text-red-400 border-red-400/30 bg-red-400/10"
                            : "text-muted-foreground border-border bg-card"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                        <SelectTrigger className="w-[120px] bg-card border-border h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="defaulted">Defaulted</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr className="bg-background/40">
                      <td colSpan={9} className="p-5">
                        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Payment history</h4>
                        <div className="border border-border bg-card">
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground">
                              <tr>
                                <th className="text-left p-2">Part</th>
                                <th className="text-right p-2">Amount</th>
                                <th className="text-left p-2">Status</th>
                                <th className="text-left p-2">Paid at</th>
                                <th className="text-left p-2">Korapay Ref</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {(payments[r.id] || []).map((p) => (
                                <tr key={p.id}>
                                  <td className="p-2">#{p.part_number}</td>
                                  <td className="p-2 text-right">{sym(c)}{Number(p.amount).toLocaleString()}</td>
                                  <td className="p-2">{p.status}</td>
                                  <td className="p-2">{p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"}</td>
                                  <td className="p-2 truncate max-w-[160px] font-mono text-[10px]">{p.flutterwave_tx_ref ?? "—"}</td>
                                </tr>
                              ))}
                              {(payments[r.id]?.length ?? 0) === 0 && (
                                <tr>
                                  <td colSpan={5} className="p-3 text-center text-muted-foreground">
                                    No payments recorded yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {r.order?.customer_phone && (
                          <a
                            href={`https://wa.me/${r.order.customer_phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                              `Hi ${r.order.customer_name}, friendly reminder about your Vivygold order ${r.order.order_number}. Balance: ${sym(c)}${Number(r.remaining_amount).toLocaleString()}.`,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-3"
                          >
                            <Button variant="luxe">Send WhatsApp reminder</Button>
                          </a>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
