import { adminClient, getFlutterwaveKeys } from "../_shared/flw.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { secret_key: FLW_SECRET } = await getFlutterwaveKeys();
    if (!FLW_SECRET) throw new Error("Flutterwave secret key not configured.");

    const url = new URL(req.url);
    const transaction_id =
      url.searchParams.get("transaction_id") ||
      (await req.json().catch(() => ({}))).transaction_id;

    if (!transaction_id) throw new Error("Missing transaction_id");

    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      { headers: { Authorization: `Bearer ${FLW_SECRET}` } },
    );
    const verifyJson = await verifyRes.json();

    if (verifyJson.status !== "success" || verifyJson.data?.status !== "successful") {
      return new Response(JSON.stringify({ paid: false, raw: verifyJson }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = verifyJson.data;
    const orderId = data.meta?.order_id;
    if (!orderId) throw new Error("Order id not in transaction meta");

    const supabase = adminClient();

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    const partNumber = Number(data.meta?.part_number ?? 1);
    const totalParts = Number(data.meta?.total_parts ?? 1);
    const isInstallment = order.is_installment;

    const expectedPart = isInstallment
      ? Math.ceil(Number(order.total) / totalParts)
      : Number(order.total);

    if (data.currency !== order.currency) throw new Error("Currency mismatch");
    if (Number(data.amount) + 1 < expectedPart) throw new Error("Amount mismatch");

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
        const paid = Number(inst.paid_amount) + Number(data.amount);
        const remaining = Math.max(0, Number(inst.total_amount) - paid);
        const status = remaining <= 1 ? "completed" : "active";
        await supabase
          .from("installments")
          .update({ paid_amount: paid, remaining_amount: remaining, status })
          .eq("id", inst.id);

        await supabase.from("installment_payments").insert({
          installment_id: inst.id,
          part_number: partNumber,
          amount: Number(data.amount),
          status: "paid",
          flutterwave_tx_id: String(data.id),
          flutterwave_tx_ref: data.tx_ref,
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

    return new Response(
      JSON.stringify({ paid: true, order_id: orderId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("flutterwave-verify error:", msg);
    return new Response(JSON.stringify({ error: msg, paid: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
