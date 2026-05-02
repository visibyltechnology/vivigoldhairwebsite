import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

async function getKorapaySecret(): Promise<string> {
  try {
    const sb = adminClient();
    const { data } = await sb.from("settings").select("value").eq("key", "korapay_keys").maybeSingle();
    if (data?.value?.secret_key) return (data.value.secret_key as string).trim();
  } catch (_) {}
  return (Deno.env.get("KORAPAY_SECRET_KEY") || "").trim();
}

async function verifySignature(secret: string, body: string, sig: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === sig;
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const secret = await getKorapaySecret();

    // Verify webhook signature if secret is set
    const sig = req.headers.get("x-korapay-signature") || "";
    if (secret && sig) {
      const valid = await verifySignature(secret, rawBody, sig);
      if (!valid) return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    if (payload?.event !== "charge.success") return new Response("ok");

    const data = payload?.data;
    const reference = data?.reference;
    const orderId = data?.metadata?.order_id;
    if (!orderId || !reference) return new Response("ok");

    // Verify with Korapay API
    const verifyRes = await fetch(
      `https://api.korapay.com/merchant/api/v1/charges/${reference}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const verifyJson = await verifyRes.json();
    if (!verifyJson?.data || verifyJson.data?.status !== "success") return new Response("ok");

    const txData = verifyJson.data;
    const supabase = adminClient();

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return new Response("ok");

    const partNumber = Number(txData.metadata?.part_number ?? 1);
    const totalParts = Number(txData.metadata?.total_parts ?? 1);
    const isInstallment = order.is_installment;

    if (!isInstallment) {
      await supabase
        .from("orders")
        .update({ payment_status: "paid", status: "processing" })
        .eq("id", orderId);
    } else {
      const { data: inst } = await supabase
        .from("installments")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (inst) {
        // Deduplicate by reference
        const { data: existing } = await supabase
          .from("installment_payments")
          .select("id")
          .eq("flutterwave_tx_ref", reference)
          .maybeSingle();
        if (existing) return new Response("ok");

        const paid = Number(inst.paid_amount) + Number(txData.amount);
        const remaining = Math.max(0, Number(inst.total_amount) - paid);
        const status = remaining <= 1 ? "completed" : "active";

        await supabase
          .from("installments")
          .update({ paid_amount: paid, remaining_amount: remaining, status })
          .eq("id", inst.id);

        await supabase.from("installment_payments").insert({
          installment_id: inst.id,
          part_number: partNumber,
          amount: Number(txData.amount),
          status: "paid",
          flutterwave_tx_id: reference,
          flutterwave_tx_ref: reference,
          paid_at: new Date().toISOString(),
        });

        await supabase
          .from("orders")
          .update({
            payment_status: remaining <= 1 ? "paid" : "partial",
            status: remaining <= 1 ? "processing" : "pending",
          })
          .eq("id", orderId);
      }
    }

    return new Response("ok");
  } catch (e) {
    console.error("korapay-webhook error:", e);
    return new Response("error", { status: 500 });
  }
});
