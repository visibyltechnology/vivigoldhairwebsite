import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Heart, Package, LogOut, ShieldCheck } from "lucide-react";

const Account = () => {
  const { user, isAdmin, signOut, loading } = useAuth();
  if (loading) return <Layout><div className="container py-20 text-center text-muted-foreground">Loading...</div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <div className="container py-16 max-w-3xl">
        <div className="text-center mb-12">
          <div className="size-20 rounded-full bg-gold mx-auto mb-4 grid place-items-center font-display text-3xl text-primary-foreground">
            {(user.email || "V")[0].toUpperCase()}
          </div>
          <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Account</span>
          <h1 className="font-display text-5xl mt-2">{user.email}</h1>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { Icon: Package, label: "Orders", to: "/account/orders", desc: "Track and manage" },
            { Icon: Heart, label: "Wishlist", to: "/wishlist", desc: "Saved pieces" },
            { Icon: User, label: "Profile", to: "/account", desc: "Personal details" },
            ...(isAdmin ? [{ Icon: ShieldCheck, label: "Admin", to: "/admin", desc: "Manage store" }] : []),
          ].map((item, i) => (
            <Link key={i} to={item.to} className="border border-border p-6 hover-glow group">
              <item.Icon className="size-6 text-primary mb-3" strokeWidth={1.2} />
              <p className="font-display text-2xl group-hover:text-primary">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="luxe" onClick={signOut}>
            <LogOut className="size-3" /> Sign out
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Account;
