import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, LayoutDashboard, Package, ShoppingBag, CreditCard, Users, Shield, Settings as SettingsIcon, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { InstallmentsTab } from "@/components/admin/InstallmentsTab";
import { RemindersTab } from "@/components/admin/RemindersTab";
import { CustomersTab } from "@/components/admin/CustomersTab";
import { AdminsTab } from "@/components/admin/AdminsTab";
import { SettingsTab } from "@/components/admin/SettingsTab";

const Admin = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [rate, setRate] = useState(1650);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "exchange_rate")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setRate((data.value as any).usd_to_ngn || 1650);
      });
  }, []);

  if (loading) return <Layout><div className="container py-20 text-center">Loading…</div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-20 max-w-md text-center">
          <ShieldCheck className="size-12 text-primary mx-auto mb-4" />
          <h1 className="font-display text-4xl mb-4">Admin access required</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Your account doesn't have admin privileges yet. Run this once in the Supabase SQL editor to grant yourself admin:
          </p>
          <pre className="bg-card border border-border p-4 text-xs text-left overflow-x-auto">
{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${user.id}', 'admin');`}
          </pre>
        </div>
      </Layout>
    );
  }

  const tabs = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "products", label: "Products", icon: Package },
    { value: "orders", label: "Orders", icon: ShoppingBag },
    { value: "installments", label: "Installments", icon: CreditCard },
    { value: "reminders", label: "Reminders", icon: Bell },
    { value: "customers", label: "Customers", icon: Users },
    { value: "admins", label: "Admins", icon: Shield },
    { value: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Layout>
      <div className="container py-12">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Admin</span>
            <h1 className="font-display text-5xl mt-2">Vivygold control room</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Logged in as <span className="text-foreground">{user.email}</span>
            </p>
          </div>
          <Button variant="luxe" size="sm" onClick={signOut} className="mt-2 shrink-0">
            <LogOut className="size-3" /> Sign out
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-card border border-border h-auto flex flex-wrap gap-1 p-1 justify-start">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.value} value={t.value} className="gap-2">
                  <Icon className="size-3" /> {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overview" className="mt-8">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="products" className="mt-8">
            <ProductsTab rate={rate} />
          </TabsContent>

          <TabsContent value="orders" className="mt-8">
            <OrdersTab />
          </TabsContent>

          <TabsContent value="installments" className="mt-8">
            <InstallmentsTab />
          </TabsContent>

          <TabsContent value="reminders" className="mt-8">
            <RemindersTab />
          </TabsContent>

          <TabsContent value="customers" className="mt-8">
            <CustomersTab />
          </TabsContent>

          <TabsContent value="admins" className="mt-8">
            <AdminsTab />
          </TabsContent>

          <TabsContent value="settings" className="mt-8">
            <SettingsTab onRateChange={setRate} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Admin;
