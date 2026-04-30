import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

const Auth = () => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: name },
        },
      });
      if (error) toast.error(error.message);
      else { toast.success("Welcome to Vivygold"); navigate("/"); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else { toast.success("Welcome back"); navigate("/"); }
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="container py-20 max-w-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Vivygold</span>
            <h1 className="font-display text-5xl mt-3">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
          </div>

          <form onSubmit={submit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-card border-border mt-2 h-12" />
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-card border-border mt-2 h-12" />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="bg-card border-border mt-2 h-12" />
            </div>

            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={loading}>
              {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? "New to Vivygold? " : "Already have an account? "}
              <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary story-link">
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/" className="story-link">Continue browsing</Link>
            </p>
          </form>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Auth;
