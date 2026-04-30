import { useEffect, useMemo, useState } from "react";
import { sb as supabase } from "@/integrations/supabase/admin-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Shield, ShieldOff } from "lucide-react";

interface CustomerRow {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  is_admin: boolean;
  total_orders: number;
  total_spent: number;
  total_paid: number;
  total_outstanding: number;
  active_installments: number;
  completed_installments: number;
}

export const CustomersTab = ({ onChanged }: { onChanged?: () => void }) => {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_customers");
    if (error) toast.error(error.message);
    if (data) setRows(data as CustomerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          !search ||
          (r.email || "").toLowerCase().includes(search.toLowerCase()) ||
          (r.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
          (r.phone || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
  );

  const grantAdmin = async (email: string) => {
    if (!confirm(`Grant admin role to ${email}?`)) return;
    const { data, error } = await supabase.rpc("admin_grant_role_by_email", { _email: email });
    if (error) return toast.error(error.message);
    const r = data as any;
    if (r?.ok) {
      toast.success("Admin role granted");
      load();
      onChanged?.();
    } else {
      toast.error(r?.error || "Failed");
    }
  };

  const revokeAdmin = async (user_id: string, email: string) => {
    if (!confirm(`Remove admin role from ${email}?`)) return;
    const { data, error } = await supabase.rpc("admin_revoke_role", { _user_id: user_id });
    if (error) return toast.error(error.message);
    const r = data as any;
    if (r?.ok) {
      toast.success("Admin role removed");
      load();
      onChanged?.();
    } else {
      toast.error(r?.error || "Failed");
    }
  };

  if (loading) return <div className="text-muted-foreground py-8">Loading customers…</div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search email, name, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card border-border pl-9"
        />
      </div>

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-right p-3">Orders</th>
              <th className="text-right p-3">Total ordered</th>
              <th className="text-right p-3">Paid</th>
              <th className="text-right p-3">Outstanding</th>
              <th className="text-center p-3">Plans</th>
              <th className="text-center p-3">Role</th>
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No customers yet.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.user_id} className="hover:bg-card/50">
                <td className="p-3">
                  <div className="font-medium">{r.full_name || r.email.split("@")[0]}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </td>
                <td className="p-3 text-xs">{r.phone || "—"}</td>
                <td className="p-3 text-right">{r.total_orders}</td>
                <td className="p-3 text-right">{Number(r.total_spent).toLocaleString()}</td>
                <td className="p-3 text-right text-emerald-400">{Number(r.total_paid).toLocaleString()}</td>
                <td className="p-3 text-right text-yellow-400">{Number(r.total_outstanding).toLocaleString()}</td>
                <td className="p-3 text-center text-xs">
                  {r.active_installments}A / {r.completed_installments}C
                </td>
                <td className="p-3 text-center">
                  {r.is_admin ? (
                    <span className="text-[10px] uppercase tracking-wider text-primary border border-primary/30 px-2 py-0.5">Admin</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border px-2 py-0.5">Customer</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {r.is_admin ? (
                    <Button size="sm" variant="luxe" onClick={() => revokeAdmin(r.user_id, r.email)}>
                      <ShieldOff className="size-3" /> Revoke
                    </Button>
                  ) : (
                    <Button size="sm" variant="gold" onClick={() => grantAdmin(r.email)}>
                      <Shield className="size-3" /> Make admin
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
