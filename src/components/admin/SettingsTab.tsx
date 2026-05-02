import { useEffect, useState } from "react";
import { sb as supabase } from "@/integrations/supabase/admin-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, Save, KeyRound, ToggleLeft, ToggleRight } from "lucide-react";

interface FlwKeys {
  public_key: string;
  secret_key: string;
  encryption_key: string;
  webhook_hash: string;
}

interface KorapayKeys {
  public_key: string;
  secret_key: string;
}

interface PaymentGateways {
  flutterwave: { enabled: boolean };
  korapay: { enabled: boolean };
}

interface StoreInfo {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  instagram: string;
  tiktok: string;
}

interface ShippingSettings {
  flat_ngn: number;
  flat_usd: number;
}

export const SettingsTab = ({ onRateChange }: { onRateChange?: (n: number) => void }) => {
  const [flw, setFlw] = useState<FlwKeys>({ public_key: "", secret_key: "", encryption_key: "", webhook_hash: "" });
  const [kora, setKora] = useState<KorapayKeys>({ public_key: "", secret_key: "" });
  const [gateways, setGateways] = useState<PaymentGateways>({
    flutterwave: { enabled: true },
    korapay: { enabled: false },
  });

  const [showFlwSecret, setShowFlwSecret] = useState(false);
  const [showFlwEnc, setShowFlwEnc] = useState(false);
  const [showFlwHash, setShowFlwHash] = useState(false);
  const [showKoraSecret, setShowKoraSecret] = useState(false);

  const [rate, setRate] = useState(1650);
  const [defaultCurrency, setDefaultCurrency] = useState<"NGN" | "USD">("NGN");
  const [shipping, setShipping] = useState<ShippingSettings>({ flat_ngn: 5000, flat_usd: 15 });
  const [store, setStore] = useState<StoreInfo>({
    name: "Vivygold",
    email: "",
    phone: "",
    whatsapp: "",
    address: "",
    instagram: "",
    tiktok: "",
  });

  const loadAll = async () => {
    const { data } = await supabase.from("settings").select("key,value");
    if (data) {
      data.forEach((row) => {
        const v = row.value as any;
        if (row.key === "flutterwave_keys") {
          setFlw({
            public_key: v?.public_key ?? "",
            secret_key: v?.secret_key ?? "",
            encryption_key: v?.encryption_key ?? "",
            webhook_hash: v?.webhook_hash ?? "",
          });
        } else if (row.key === "korapay_keys") {
          setKora({
            public_key: v?.public_key ?? "",
            secret_key: v?.secret_key ?? "",
          });
        } else if (row.key === "payment_gateways") {
          setGateways({
            flutterwave: { enabled: v?.flutterwave?.enabled ?? true },
            korapay: { enabled: v?.korapay?.enabled ?? false },
          });
        } else if (row.key === "exchange_rate") {
          setRate(v?.usd_to_ngn ?? 1650);
          setDefaultCurrency(v?.default_currency ?? "NGN");
        } else if (row.key === "shipping") {
          setShipping({ flat_ngn: v?.flat_ngn ?? 5000, flat_usd: v?.flat_usd ?? 15 });
        } else if (row.key === "store_info") {
          setStore({
            name: v?.name ?? "Vivygold",
            email: v?.email ?? "",
            phone: v?.phone ?? "",
            whatsapp: v?.whatsapp ?? "",
            address: v?.address ?? "",
            instagram: v?.instagram ?? "",
            tiktok: v?.tiktok ?? "",
          });
        }
      });
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const upsertSetting = async (key: string, value: object) => {
    const { error } = await supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const saveFlw = async () => {
    if (await upsertSetting("flutterwave_keys", flw)) toast.success("Flutterwave keys saved");
  };

  const saveKora = async () => {
    if (await upsertSetting("korapay_keys", kora)) toast.success("Korapay keys saved");
  };

  const toggleGateway = async (gateway: "flutterwave" | "korapay") => {
    const updated = {
      ...gateways,
      [gateway]: { enabled: !gateways[gateway].enabled },
    };
    if (await upsertSetting("payment_gateways", updated)) {
      setGateways(updated);
      toast.success(`${gateway === "flutterwave" ? "Flutterwave" : "Korapay"} ${updated[gateway].enabled ? "enabled" : "disabled"}`);
    }
  };

  const saveRate = async () => {
    if (await upsertSetting("exchange_rate", { usd_to_ngn: Number(rate), default_currency: defaultCurrency })) {
      toast.success("Exchange rate updated");
      onRateChange?.(Number(rate));
    }
  };

  const saveShipping = async () => {
    if (await upsertSetting("shipping", shipping)) toast.success("Shipping fees updated");
  };

  const saveStore = async () => {
    if (await upsertSetting("store_info", store)) toast.success("Store info updated");
  };

  const GatewayToggle = ({ id, label, logo, enabled }: { id: "flutterwave" | "korapay"; label: string; logo: string; enabled: boolean }) => (
    <div className={`flex items-center justify-between p-4 border ${enabled ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium">{logo}</div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className={`text-xs ${enabled ? "text-primary" : "text-muted-foreground"}`}>
            {enabled ? "Active — customers can pay with this" : "Inactive — hidden from checkout"}
          </p>
        </div>
      </div>
      <button
        onClick={() => toggleGateway(id)}
        className={`flex items-center gap-2 text-sm px-4 py-1.5 border transition-colors ${
          enabled
            ? "border-primary text-primary hover:bg-primary/10"
            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
        }`}
      >
        {enabled ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
        {enabled ? "ON" : "OFF"}
      </button>
    </div>
  );

  return (
    <div className="space-y-8">

      {/* Payment gateway toggles */}
      <section className="border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <ToggleRight className="size-4 text-primary" />
          <h3 className="font-display text-2xl">Payment gateways</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Turn each gateway on or off. If both are enabled, customers can choose at checkout. At least one should be active.
        </p>
        <div className="space-y-3">
          <GatewayToggle
            id="flutterwave"
            label="Flutterwave"
            logo="🟠 Flutterwave"
            enabled={gateways.flutterwave.enabled}
          />
          <GatewayToggle
            id="korapay"
            label="Korapay"
            logo="🟣 Korapay"
            enabled={gateways.korapay.enabled}
          />
        </div>
      </section>

      {/* Flutterwave keys */}
      <section className="border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="size-4 text-primary" />
          <h3 className="font-display text-2xl">Flutterwave keys</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Powers single payments and installment checkouts. Get your keys from the Flutterwave dashboard.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Public key</Label>
            <Input
              value={flw.public_key}
              onChange={(e) => setFlw({ ...flw, public_key: e.target.value })}
              placeholder="FLWPUBK_TEST-xxxx or FLWPUBK-xxxx"
              className="bg-input mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label>Secret key</Label>
            <div className="relative mt-1">
              <Input
                type={showFlwSecret ? "text" : "password"}
                value={flw.secret_key}
                onChange={(e) => setFlw({ ...flw, secret_key: e.target.value })}
                placeholder="FLWSECK_TEST-xxxx or FLWSECK-xxxx"
                className="bg-input font-mono text-xs pr-10"
              />
              <button type="button" onClick={() => setShowFlwSecret(!showFlwSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showFlwSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>Encryption key (optional)</Label>
            <div className="relative mt-1">
              <Input
                type={showFlwEnc ? "text" : "password"}
                value={flw.encryption_key}
                onChange={(e) => setFlw({ ...flw, encryption_key: e.target.value })}
                className="bg-input font-mono text-xs pr-10"
              />
              <button type="button" onClick={() => setShowFlwEnc(!showFlwEnc)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showFlwEnc ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>Webhook secret hash (optional)</Label>
            <div className="relative mt-1">
              <Input
                type={showFlwHash ? "text" : "password"}
                value={flw.webhook_hash}
                onChange={(e) => setFlw({ ...flw, webhook_hash: e.target.value })}
                className="bg-input font-mono text-xs pr-10"
              />
              <button type="button" onClick={() => setShowFlwHash(!showFlwHash)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showFlwHash ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>
        <Button variant="gold" onClick={saveFlw} className="mt-5">
          <Save className="size-3" /> Save Flutterwave keys
        </Button>
      </section>

      {/* Korapay keys */}
      <section className="border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="size-4 text-primary" />
          <h3 className="font-display text-2xl">Korapay keys</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Get your keys from the Korapay merchant dashboard at dashboard.korapay.com. Korapay processes payments in NGN.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Public key</Label>
            <Input
              value={kora.public_key}
              onChange={(e) => setKora({ ...kora, public_key: e.target.value })}
              placeholder="pk_live_xxxx or pk_test_xxxx"
              className="bg-input mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label>Secret key</Label>
            <div className="relative mt-1">
              <Input
                type={showKoraSecret ? "text" : "password"}
                value={kora.secret_key}
                onChange={(e) => setKora({ ...kora, secret_key: e.target.value })}
                placeholder="sk_live_xxxx or sk_test_xxxx"
                className="bg-input font-mono text-xs pr-10"
              />
              <button type="button" onClick={() => setShowKoraSecret(!showKoraSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showKoraSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>
        <Button variant="gold" onClick={saveKora} className="mt-5">
          <Save className="size-3" /> Save Korapay keys
        </Button>
      </section>

      {/* Currency rate */}
      <section className="border border-border bg-card p-6">
        <h3 className="font-display text-2xl mb-1">Currency & exchange rate</h3>
        <p className="text-sm text-muted-foreground mb-5">
          The default currency for the storefront, plus the USD↔NGN rate used to auto-convert prices.
        </p>
        <div className="grid md:grid-cols-2 gap-4 max-w-xl">
          <div>
            <Label>Default storefront currency</Label>
            <Select value={defaultCurrency} onValueChange={(v) => setDefaultCurrency(v as "NGN" | "USD")}>
              <SelectTrigger className="mt-1 bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NGN">₦ Naira (NGN) — recommended</SelectItem>
                <SelectItem value="USD">$ Dollar (USD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>1 USD equals (NGN)</Label>
            <Input
              type="number"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="bg-input mt-1"
            />
          </div>
        </div>
        <Button variant="gold" onClick={saveRate} className="mt-5">
          <Save className="size-3" /> Save exchange rate
        </Button>
      </section>

      {/* Shipping */}
      <section className="border border-border bg-card p-6">
        <h3 className="font-display text-2xl mb-1">Shipping fee</h3>
        <p className="text-sm text-muted-foreground mb-5">Flat shipping fee added to every order.</p>
        <div className="grid md:grid-cols-2 gap-4 max-w-xl">
          <div>
            <Label>Flat NGN</Label>
            <Input
              type="number"
              value={shipping.flat_ngn}
              onChange={(e) => setShipping({ ...shipping, flat_ngn: Number(e.target.value) })}
              className="bg-input mt-1"
            />
          </div>
          <div>
            <Label>Flat USD</Label>
            <Input
              type="number"
              value={shipping.flat_usd}
              onChange={(e) => setShipping({ ...shipping, flat_usd: Number(e.target.value) })}
              className="bg-input mt-1"
            />
          </div>
        </div>
        <Button variant="gold" onClick={saveShipping} className="mt-5">
          <Save className="size-3" /> Save shipping
        </Button>
      </section>

      {/* Store info */}
      <section className="border border-border bg-card p-6">
        <h3 className="font-display text-2xl mb-1">Store info</h3>
        <p className="text-sm text-muted-foreground mb-5">Shown in the footer and used for customer contact.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Store name</Label>
            <Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label>Support email</Label>
            <Input value={store.email} onChange={(e) => setStore({ ...store, email: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input value={store.whatsapp} onChange={(e) => setStore({ ...store, whatsapp: e.target.value })} className="bg-input mt-1" />
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Input value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label>Instagram URL</Label>
            <Input value={store.instagram} onChange={(e) => setStore({ ...store, instagram: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label>TikTok URL</Label>
            <Input value={store.tiktok} onChange={(e) => setStore({ ...store, tiktok: e.target.value })} className="bg-input mt-1" />
          </div>
        </div>
        <Button variant="gold" onClick={saveStore} className="mt-5">
          <Save className="size-3" /> Save store info
        </Button>
      </section>
    </div>
  );
};
