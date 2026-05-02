import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { KeyRound, Loader2 } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase sends the recovery token in the URL hash.
    // onAuthStateChange fires with event=PASSWORD_RECOVERY once it's processed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated — please sign in with your new password");
      await supabase.auth.signOut();
      navigate("/auth");
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <Layout>
        <div className="container py-20 max-w-md text-center">
          <Loader2 className="size-10 text-primary mx-auto mb-6 animate-spin" strokeWidth={1} />
          <p className="text-muted-foreground">Verifying your reset link…</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-20 max-w-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <KeyRound className="size-10 text-primary mx-auto mb-4" strokeWidth={1.2} />
            <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Vivygold</span>
            <h1 className="font-display text-5xl mt-2">Set new password</h1>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="pw" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                New password
              </Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-card border-border mt-2 h-12"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <Label htmlFor="confirm" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Confirm password
              </Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="bg-card border-border mt-2 h-12"
              />
            </div>

            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </motion.div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
