import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function getKorapaySecret(): Promise<string> {
  try {
    const sb = adminClient();
    const { data } = await sb.from("settings").select("value").eq("key", "korapay_keys").maybeSingle();
    if (data?.value?.secret_key) return ((data.value as any).secret_key as string).trim();
  } catch (_) {}
  return (Deno.env.get("KORAPAY_SECRET_KEY") || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const secret = await getKorapaySecret();
    if (!secret) throw new Error("Korapay secret key not configured.");

    const url = new URL(req.url);
    const reference = url.searchParams.get("reference") || (await req.json().catch(() => ({}))).reference;
    if (!reference) throw new Error("Missing reference");

    const verifyRes = await fetch(`https://api.korapay.com/merchant/api/v1/charges/${reference}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson?.data || verifyJson.data?.status !== "success") {
      return new Response(JSON.stringify({ paid: false, raw: verifyJson }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txData = verifyJson.data;
    const orderId = txData.metadata?.order_id;
    if (!orderId) throw new Error("Order id not in transaction metadata");

    const supabase = adminClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) throw new Error("Order not found");

    const partNumber = Number(txData.metadata?.part_number ?? 1);

    if (!order.is_installment) {
      await supabase.from("orders").update({ payment_status: "paid", status: "processing" }).eq("id", orderId);
    } else {
      const { data: inst } = await supabase.from("installments").select("*").eq("order_id", orderId).maybeSingle();
      if (inst) {
        const paid = Number(inst.paid_amount) + Number(txData.amount);
        const remaining = Math.max(0, Number(inst.total_amount) - paid);
        const status = remaining <= 1 ? "completed" : "active";
        await supabase.from("installments").update({ paid_amount: paid, remaining_amount: remaining, status }).eq("id", inst.id);
        await supabase.from("installment_payments").insert({
          installment_id: inst.id, part_number: partNumber, amount: Number(txData.amount),
          status: "paid", flutterwave_tx_id: reference, flutterwave_tx_ref: reference,
          paid_at: new Date().toISOString(),
        });
        await supabase.from("orders").update({
          payment_status: remaining <= 1 ? "paid" : "partial",
          status: remaining <= 1 ? "processing" : "pending",
        }).eq("id", orderId);
      }
    }

    return new Response(JSON.stringify({ paid: true, order_id: orderId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg, paid: false }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
