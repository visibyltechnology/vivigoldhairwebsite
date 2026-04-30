import { adminClient, getFlutterwaveKeys } from "../_shared/flw.ts";

Deno.serve(async (req) => {
  try {
    const { secret_key: FLW_SECRET, webhook_hash: expectedHash } = await getFlutterwaveKeys();

    if (expectedHash) {
      const incoming = req.headers.get("verif-hash");
      if (incoming !== expectedHash) {
        return new Response("Invalid hash", { status: 401 });
      }
    }

    if (!FLW_SECRET) return new Response("Server misconfigured", { status: 500 });

    const payload = await req.json();
    const txId = payload?.data?.id;
    if (!txId) return new Response("ok");

    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${txId}/verify`,
      { headers: { Authorization: `Bearer ${FLW_SECRET}` } },
    );
    const verifyJson = await verifyRes.json();
    if (verifyJson.status !== "success" || verifyJson.data?.status !== "successful") {
      return new Response("ok");
    }
    const data = verifyJson.data;
    const orderId = data.meta?.order_id;
    if (!orderId) return new Response("ok");

    const supabase = adminClient();

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return new Response("ok");

    const partNumber = Number(data.meta?.part_number ?? 1);
    const totalParts = Number(data.meta?.total_parts ?? 1);
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
        const { data: existing } = await supabase
          .from("installment_payments")
          .select("id")
          .eq("flutterwave_tx_id", String(data.id))
          .maybeSingle();
        if (existing) return new Response("ok");

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

    return new Response("ok");
  } catch (e) {
    console.error("webhook error", e);
    return new Response("error", { status: 500 });
  }
});
