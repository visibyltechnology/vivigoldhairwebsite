import { adminClient, getFlutterwaveKeys } from "../_shared/flw.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { secret_key: FLW_SECRET } = await getFlutterwaveKeys();
    if (!FLW_SECRET) return respond({ error: "Flutterwave is not configured on this store" });

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
    if (!order.is_installment)          return respond({ error: "This order does not use instalment payments" });
    if (order.payment_status === "paid") return respond({ error: "This order is already fully paid" });

    // Fetch installment record
    const { data: inst, error: instErr } = await supabase
      .from("installments")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();
    if (instErr || !inst) return respond({ error: "Instalment record not found" });
    if (inst.status === "completed")    return respond({ error: "All instalments have been completed" });

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

    const tx_ref = `${order.order_number}-P${nextPart}-${Date.now()}`;
    const origin = req.headers.get("origin") || "https://thisonevivygoldhair.com.ng";

    const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${FLW_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref,
        amount:       nextAmount,
        currency:     order.currency || "NGN",
        redirect_url: `${origin}/order-success?order_id=${order.id}`,
        customer: {
          email:       order.customer_email,
          name:        order.customer_name,
          phonenumber: order.customer_phone || "",
        },
        customizations: {
          title:       "Vivygold",
          description: `Order ${order.order_number} — instalment ${nextPart} of ${totalParts}`,
        },
        meta: {
          order_id:      order.id,
          order_number:  order.order_number,
          part_number:   nextPart,
          total_parts:   totalParts,
          is_installment: true,
        },
      }),
    });

    const flwJson = await flwRes.json();
    if (flwJson.status !== "success") {
      return respond({ error: flwJson.message || "Flutterwave init failed" });
    }

    console.log("flutterwave-pay-installment ref:", tx_ref, "amount:", nextAmount, "part:", nextPart, "/", totalParts);

    return respond({
      payment_link:   flwJson.data.link,
      part_number:    nextPart,
      total_parts:    totalParts,
      amount:         nextAmount,
      remaining_after: Math.max(0, remaining - nextAmount),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("flutterwave-pay-installment error:", msg);
    return respond({ error: msg });
  }
});
