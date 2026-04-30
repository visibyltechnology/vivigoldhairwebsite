import { useEffect, useMemo, useState } from "react";
import { sb as supabase } from "@/integrations/supabase/admin-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bell, MessageCircle, Mail, RefreshCw, CheckCircle2 } from "lucide-react";

interface DueRow {
  installment_id: string;
  order_id: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  next_due_date: string;
  days_until_due: number;
  reminded_today: boolean;
}

interface LogRow {
  id: string;
  installment_id: string;
  channel: string;
  message: string | null;
  sent_at: string;
}

const ngn = (n: number | string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(n) || 0);

function buildMessage(row: DueRow, store: string) {
  const days = row.days_until_due;
  const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const name = (row.customer_name || "there").split(" ")[0];
  return (
    `Hi ${name}, this is a friendly reminder from ${store}. ` +
    `Your next installment of ${ngn(row.remaining_amount)} is due ${when} (${row.next_due_date}). ` +
    `Please complete your payment to keep your order on track. Reply if you need help.`
  );
}

function waLink(phone: string | null, msg: string) {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

export const RemindersTab = () => {
  const [days, setDays]       = useState(3);
  const [rows, setRows]       = useState<DueRow[]>([]);
  const [log, setLog]         = useState<LogRow[]>([]);
  const [storeName, setStore] = useState("Vivygold");
  const [loading, setLoading] = useState(false);
  const [autoRunning, setAuto] = useState(false);

  async function load() {
    setLoading(true);
    const [dueRes, logRes, storeRes] = await Promise.all([
      supabase.rpc("admin_due_reminders", { p_days: days }),
      supabase.from("installment_reminders").select("*").order("sent_at", { ascending: false }).limit(50),
      supabase.from("settings").select("value").eq("key", "store_info").maybeSingle(),
    ]);
    if (dueRes.error)  toast.error(dueRes.error.message);
    if (logRes.error)  toast.error(logRes.error.message);
    setRows((dueRes.data as DueRow[]) || []);
    setLog((logRes.data as LogRow[]) || []);
    if (storeRes.data?.value?.name) setStore(storeRes.data.value.name);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  async function logSent(row: DueRow, channel: "whatsapp" | "manual" | "email", message: string) {
    const { error } = await supabase.rpc("admin_log_reminder", {
      p_installment_id: row.installment_id,
      p_channel:        channel,
      p_message:        message,
      p_meta:           {},
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Reminder logged");
    load();
  }

  async function runAutomatic() {
    setAuto(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const url   = `${(supabase as any).supabaseUrl}/functions/v1/installment-reminders?days=${days}`;
      const r = await fetch(url, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey":        (supabase as any).supabaseKey,
        },
        body: JSON.stringify({ auto: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      toast.success(`Processed ${j.processed} reminder${j.processed === 1 ? "" : "s"}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to run automatic reminders");
    } finally {
      setAuto(false);
    }
  }

  const counts = useMemo(() => ({
    total:    rows.length,
    overdue:  rows.filter(r => r.days_until_due < 0).length,
    today:    rows.filter(r => r.days_until_due === 0).length,
    soon:     rows.filter(r => r.days_until_due > 0).length,
    pending:  rows.filter(r => !r.reminded_today).length,
  }), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h2 className="font-display text-2xl flex items-center gap-2">
            <Bell className="size-5 text-primary" /> Installment reminders
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Customers whose next installment is due within the chosen window.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Window (days)</label>
            <Input type="number" min={0} max={30} value={days} onChange={(e) => setDays(Math.max(0, parseInt(e.target.value || "0", 10)))} className="w-24" />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={runAutomatic} disabled={autoRunning} className="gap-2">
            <Mail className="size-3" /> {autoRunning ? "Sending…" : "Send all by email"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total due",      value: counts.total,   tone: "text-foreground" },
          { label: "Overdue",        value: counts.overdue, tone: "text-destructive" },
          { label: "Due today",      value: counts.today,   tone: "text-amber-500" },
          { label: "Due soon",       value: counts.soon,    tone: "text-foreground" },
          { label: "Not reminded",   value: counts.pending, tone: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className={`text-2xl font-semibold mt-1 ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background border-b border-border">
            <tr className="text-left">
              <th className="p-3">Customer</th>
              <th className="p-3">Due</th>
              <th className="p-3">Remaining</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const message = buildMessage(r, storeName);
              const wa      = waLink(r.customer_phone, message);
              const tone    = r.days_until_due < 0 ? "text-destructive" : r.days_until_due === 0 ? "text-amber-500" : "text-foreground";
              return (
                <tr key={r.installment_id} className="border-b border-border/50">
                  <td className="p-3">
                    <div className="font-medium">{r.customer_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.customer_email}</div>
                    {r.customer_phone && <div className="text-xs text-muted-foreground">{r.customer_phone}</div>}
                  </td>
                  <td className={`p-3 ${tone}`}>
                    <div>{r.next_due_date}</div>
                    <div className="text-xs">
                      {r.days_until_due < 0 ? `${Math.abs(r.days_until_due)} day(s) overdue` :
                        r.days_until_due === 0 ? "Today" : `In ${r.days_until_due} day(s)`}
                    </div>
                  </td>
                  <td className="p-3">{ngn(r.remaining_amount)}</td>
                  <td className="p-3">
                    {r.reminded_today ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                        <CheckCircle2 className="size-3" /> Reminded today
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {wa ? (
                      <a href={wa} target="_blank" rel="noreferrer" onClick={() => logSent(r, "whatsapp", message)}>
                        <Button size="sm" variant="outline" className="gap-1">
                          <MessageCircle className="size-3" /> WhatsApp
                        </Button>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No phone</span>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => logSent(r, "manual", message)}>
                      Mark sent
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr><td className="p-6 text-center text-muted-foreground" colSpan={5}>Nothing due in this window.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Recent reminders sent</h3>
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background border-b border-border">
              <tr className="text-left">
                <th className="p-3">When</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="p-3 whitespace-nowrap">{new Date(l.sent_at).toLocaleString()}</td>
                  <td className="p-3 capitalize">{l.channel}</td>
                  <td className="p-3 text-xs text-muted-foreground">{l.message}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr><td className="p-6 text-center text-muted-foreground" colSpan={3}>No reminders sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
