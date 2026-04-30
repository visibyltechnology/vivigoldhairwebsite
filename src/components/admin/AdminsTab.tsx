import { useEffect, useState } from "react";
import { sb as supabase } from "@/integrations/supabase/admin-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, ShieldOff, UserPlus, Mail } from "lucide-react";

interface AdminRow {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export const AdminsTab = ({ onChanged }: { onChanged?: () => void }) => {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [grantEmail, setGrantEmail] = useState("");
  const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_list_customers");
    if (error) return;
    if (data) {
      setAdmins(
        (data as any[])
          .filter((r) => r.is_admin)
          .map((r) => ({ user_id: r.user_id, email: r.email, full_name: r.full_name, created_at: r.created_at })),
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grant = async () => {
    if (!grantEmail) return toast.error("Enter an email");
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_grant_role_by_email", { _email: grantEmail });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as any;
    if (r?.ok) {
      toast.success("Admin role granted");
      setGrantEmail("");
      load();
      onChanged?.();
    } else {
      toast.error(r?.error || "Failed");
    }
  };

  const createAdmin = async () => {
    if (!createForm.email || !createForm.password) return toast.error("Email and password required");
    setBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setBusy(false);
      return toast.error("Sign in again");
    }
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { ...createForm, make_admin: true },
      });
      if (error) throw error;
      const r = data as any;
      if (r?.ok) {
        toast.success(`Admin account created for ${r.email}`);
        setCreateForm({ email: "", password: "", full_name: "" });
        load();
        onChanged?.();
      } else {
        toast.error(r?.error || "Failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create admin");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (user_id: string, email: string) => {
    if (!confirm(`Revoke admin role for ${email}?`)) return;
    const { data, error } = await supabase.rpc("admin_revoke_role", { _user_id: user_id });
    if (error) return toast.error(error.message);
    const r = data as any;
    if (r?.ok) {
      toast.success("Revoked");
      load();
      onChanged?.();
    } else {
      toast.error(r?.error || "Failed");
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="border border-border bg-card p-6">
        <h3 className="font-display text-2xl mb-1">Create new admin</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Provision an account with email + password and grant admin role immediately. Useful for inviting team members.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Full name</Label>
            <Input
              value={createForm.full_name}
              onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
              className="bg-input mt-1"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="bg-input mt-1"
              placeholder="jane@vivygold.com"
            />
          </div>
          <div>
            <Label>Password *</Label>
            <Input
              type="text"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className="bg-input mt-1"
              placeholder="At least 6 characters"
            />
          </div>
          <Button variant="gold" onClick={createAdmin} disabled={busy} className="w-full">
            <UserPlus className="size-3" /> Create admin account
          </Button>
        </div>
      </div>

      <div className="border border-border bg-card p-6">
        <h3 className="font-display text-2xl mb-1">Grant admin to existing user</h3>
        <p className="text-sm text-muted-foreground mb-5">
          The customer must already have an account. Enter their email to upgrade them to admin.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              className="bg-input mt-1"
              placeholder="customer@example.com"
            />
          </div>
          <Button variant="gold" onClick={grant} disabled={busy} className="w-full">
            <Mail className="size-3" /> Grant admin role
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2 border border-border">
        <div className="bg-card px-5 py-3 flex items-center justify-between">
          <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
            <Shield className="size-3" /> Current admins ({admins.length})
          </h4>
        </div>
        <div className="divide-y divide-border">
          {admins.length === 0 && <div className="p-6 text-sm text-muted-foreground">No admins listed.</div>}
          {admins.map((a) => (
            <div key={a.user_id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium text-sm">{a.full_name || a.email.split("@")[0]}</div>
                <div className="text-xs text-muted-foreground">{a.email}</div>
              </div>
              <Button size="sm" variant="luxe" onClick={() => revoke(a.user_id, a.email)}>
                <ShieldOff className="size-3" /> Revoke
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
