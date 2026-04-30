// Shared helper: read Flutterwave keys from settings table first, fall back to env vars.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface FlwKeys {
  public_key: string;
  secret_key: string;
  encryption_key?: string;
  webhook_hash?: string;
}

export const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

export async function getFlutterwaveKeys(): Promise<FlwKeys> {
  let public_key = "";
  let secret_key = "";
  let encryption_key = "";
  let webhook_hash = "";

  try {
    const sb = adminClient();
    const { data } = await sb
      .from("settings")
      .select("value")
      .eq("key", "flutterwave_keys")
      .maybeSingle();
    if (data?.value) {
      const v = data.value as FlwKeys;
      public_key = (v.public_key || "").trim();
      secret_key = (v.secret_key || "").trim();
      encryption_key = (v.encryption_key || "").trim();
      webhook_hash = (v.webhook_hash || "").trim();
    }
  } catch (_e) {
    // ignore — fall back to env vars
  }

  if (!secret_key) secret_key = (Deno.env.get("FLUTTERWAVE_SECRET_KEY") || "").trim();
  if (!public_key) public_key = (Deno.env.get("FLUTTERWAVE_PUBLIC_KEY") || "").trim();
  if (!encryption_key) encryption_key = (Deno.env.get("FLUTTERWAVE_ENCRYPTION_KEY") || "").trim();
  if (!webhook_hash) webhook_hash = (Deno.env.get("FLUTTERWAVE_WEBHOOK_HASH") || "").trim();

  return { public_key, secret_key, encryption_key, webhook_hash };
}
