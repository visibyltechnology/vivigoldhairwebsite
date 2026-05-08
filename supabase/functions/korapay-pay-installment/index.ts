import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_FUNCTIONS_URL = "https://iivgirvlatkcwklflmzc.supabase.co/functions/v1";
const KORAPAY_MAX_AMOUNT     = 200_000;

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function getKorapaySecret(): Promise<string> {
  let secret_key = "";
  try {
    const sb = adminClient();
    const { data } = await sb.from("settings").select("value").eq("key", "korapay_keys").maybeSingle();
    if (data?.value) secret_key = ((data.value as any).secret_key || "").trim();
  } catch (_) {}
  if (!secret_key) secret_key = (Deno.env.get("KORAPAY_SECRET_KEY") || "").trim();
  return secret_key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = adminClient();

    // Auth: only the order owner can pay
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return respond({ error: "Unauthorized" }, 401);

    const { order_id } = await req.json();
    if (!order_id) return respond({ error: "Missing order_id" });

    // Fetch order (must belong to this user)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (orderErr || !order) return respond({ error: "Order not found" });
    if (!order.is_installment)           return respond({ error: "This order does not use instalment payments" });
    if (order.payment_status === "paid") return respond({ error: "This order is already fully paid" });

    // Fetch installment record
    const { data: inst, error: instErr } = await supabase
      .from("installments")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();
    if (instErr || !inst) return respond({ error: "Instalment record not found" });
    if (inst.status === "completed")     return respond({ error: "All instalments have been completed" });

    // Calculate next payment
    const totalParts  = Number(inst.total_parts);
    const totalAmount = Number(inst.total_amount);
    const paidAmount  = Number(inst.paid_amount);
    const remaining   = Number(inst.remaining_amount);

    const perPart    = Math.floor(totalAmount / totalParts);
    const partsPaid  = paidAmount > 0 ? Math.round(paidAmount / perPart) : 0;
    const nextPart   = partsPaid + 1;
    const nextAmount = Math.min(perPart, remaining);

    if (nextAmount <= 0 || remaining <= 0) {
      return respond({ error: "No outstanding balance on this order" });
    }

    // Hard guard: Korapay caps NGN payments at ₦200,000
    if (order.currency === "NGN" && nextAmount > KORAPAY_MAX_AMOUNT) {
      return respond({
        error: `This instalment (₦${nextAmount.toLocaleString()}) exceeds Korapay's ₦200,000 limit. Please contact the store to arrange an alternative payment method.`,
      });
    }

    const KORA_SECRET = await getKorapaySecret();
    if (!KORA_SECRET) return respond({ error: "Korapay is not configured on this store" });

    const reference = `${order.order_number}-P${nextPart}-${Date.now()}`;
    const origin    = req.headers.get("origin") || "https://thisonevivygoldhair.com.ng";

    const koraPayload = {
      reference,
      amount:           nextAmount,
      currency:         order.currency || "NGN",
      notification_url: `${SUPABASE_FUNCTIONS_URL}/korapay-webhook`,
      redirect_url:     `${origin}/order-success?order_id=${order.id}`,
      customer:         { name: order.customer_name, email: order.customer_email },
      channels:         ["card", "bank_transfer", "pay_with_bank"],
      metadata: {
        order_id:      order.id,
        order_number:  order.order_number,
        part_number:   nextPart,
        total_parts:   totalParts,
        is_installment: true,
      },
    };

    console.log("korapay-pay-installment ref:", reference, "amount:", nextAmount, "part:", nextPart, "/", totalParts);

    const koraRes  = await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
      method:  "POST",
      headers: { Authorization: `Bearer ${KORA_SECRET}`, "Content-Type": "application/json" },
      body:    JSON.stringify(koraPayload),
    });
    const koraJson = await koraRes.json();

    if (!koraJson?.status || !koraJson?.data?.checkout_url) {
      return respond({ error: `Korapay: ${koraJson?.message || "No checkout URL returned"}` });
    }

    return respond({
      payment_link:    koraJson.data.checkout_url,
      part_number:     nextPart,
      total_parts:     totalParts,
      amount:          nextAmount,
      remaining_after: Math.max(0, remaining - nextAmount),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("korapay-pay-installment error:", msg);
    return respond({ error: msg });
  }
});
