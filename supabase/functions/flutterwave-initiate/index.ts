import { adminClient, getFlutterwaveKeys } from "../_shared/flw.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartLine {
  product_id: string;
  name: string;
  image: string;
  price: number; // unit price in selected currency
  quantity: number;
}

interface InitPayload {
  currency: "NGN" | "USD";
  customer: { name: string; email: string; phone?: string };
  shipping: Record<string, unknown>;
  items: CartLine[];
  shipping_fee: number;
  is_installment: boolean;
  installment_parts?: 1 | 2 | 3 | 4;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { secret_key: FLW_SECRET } = await getFlutterwaveKeys();
    if (!FLW_SECRET) {
      throw new Error("Flutterwave secret key not configured. Open Admin → Settings → Flutterwave to add it.");
    }
    if ((!FLW_SECRET.startsWith("FLWSECK_TEST-") && !FLW_SECRET.startsWith("FLWSECK-")) || FLW_SECRET.length < 32) {
      throw new Error("Stored Flutterwave secret key is incomplete or malformed. Update it in Admin → Settings → Flutterwave.");
    }

    const supabase = adminClient();

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    const body = (await req.json()) as InitPayload;
    if (!body?.items?.length) throw new Error("Cart is empty");
    if (!body.customer?.email || !body.customer?.name) throw new Error("Missing customer info");

    const subtotal = body.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + (body.shipping_fee || 0);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        customer_email: body.customer.email,
        customer_name: body.customer.name,
        customer_phone: body.customer.phone ?? null,
        shipping_address: body.shipping ?? {},
        currency: body.currency,
        subtotal,
        shipping_fee: body.shipping_fee || 0,
        total,
        is_installment: !!body.is_installment,
        status: "pending",
        payment_status: "unpaid",
      })
      .select()
      .single();

    if (orderErr || !order) throw new Error(orderErr?.message || "Failed to create order");

    const orderItems = body.items.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.name,
      product_image: i.image,
      unit_price: i.price,
      quantity: i.quantity,
      line_total: i.price * i.quantity,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) throw new Error(itemsErr.message);

    const parts = body.is_installment ? Math.max(1, Math.min(4, body.installment_parts ?? 1)) : 1;
    const firstAmount = body.is_installment ? Math.ceil(total / parts) : total;

    if (body.is_installment && parts > 1 && userId) {
      await supabase.from("installments").insert({
        user_id: userId,
        order_id: order.id,
        total_amount: total,
        paid_amount: 0,
        remaining_amount: total,
        total_parts: parts,
        status: "active",
      });
    }

    const tx_ref = `${order.order_number}-P1-${Date.now()}`;
    const origin = req.headers.get("origin") || "https://example.com";

    const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref,
        amount: firstAmount,
        currency: body.currency,
        redirect_url: `${origin}/order-success?order_id=${order.id}`,
        customer: {
          email: body.customer.email,
          name: body.customer.name,
          phonenumber: body.customer.phone || "",
        },
        customizations: {
          title: "Vivygold",
          description: `Order ${order.order_number}${body.is_installment ? ` (1/${parts})` : ""}`,
        },
        meta: {
          order_id: order.id,
          part_number: 1,
          total_parts: parts,
          is_installment: body.is_installment,
        },
      }),
    });

    const flwJson = await flwRes.json();
    if (flwRes.status === 401 || flwJson?.message === "Invalid authorization key") {
      throw new Error("Stored Flutterwave secret key is invalid. Update it in Admin → Settings → Flutterwave.");
    }
    if (flwJson.status !== "success") {
      throw new Error(flwJson.message || "Flutterwave init failed");
    }

    return new Response(
      JSON.stringify({
        payment_link: flwJson.data.link,
        order_id: order.id,
        order_number: order.order_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("flutterwave-initiate error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
