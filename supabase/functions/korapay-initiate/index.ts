import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_FUNCTIONS_URL = "https://iivgirvlatkcwklflmzc.supabase.co/functions/v1";

const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

async function getKorapayKeys() {
  let public_key = "";
  let secret_key = "";
  try {
    const sb = adminClient();
    const { data } = await sb.from("settings").select("value").eq("key", "korapay_keys").maybeSingle();
    if (data?.value) {
      public_key = ((data.value as any).public_key || "").trim();
      secret_key = ((data.value as any).secret_key || "").trim();
    }
  } catch (_) {}
  if (!secret_key) secret_key = (Deno.env.get("KORAPAY_SECRET_KEY") || "").trim();
  if (!public_key) public_key = (Deno.env.get("KORAPAY_PUBLIC_KEY") || "").trim();
  return { public_key, secret_key };
}

interface CartLine {
  product_id: string;
  name: string;
  image: string;
  price: number;
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
    const { secret_key: KORA_SECRET } = await getKorapayKeys();
    if (!KORA_SECRET) {
      throw new Error("Korapay secret key not configured. Open Admin → Settings → Korapay to add it.");
    }

    const supabase = adminClient();

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const userToken = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(userToken);
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

    const reference = `${order.order_number}-P1-${Date.now()}`;
    const origin = req.headers.get("origin") || "https://thisonevivygoldhair.com.ng";

    const koraPayload = {
      reference,
      amount: firstAmount,
      currency: "NGN",
      notification_url: `${SUPABASE_FUNCTIONS_URL}/korapay-webhook`,
      redirect_url: `${origin}/order-success?order_id=${order.id}`,
      customer: { name: body.customer.name, email: body.customer.email },
      channels: ["card", "bank_transfer", "pay_with_bank"],
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        part_number: 1,
        total_parts: parts,
        is_installment: body.is_installment,
      },
    };

    console.log("Korapay payload amount:", firstAmount, "ref:", reference);

    const koraRes = await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${KORA_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify(koraPayload),
    });

    const koraJson = await koraRes.json();
    console.log("Korapay response:", koraJson?.status, koraJson?.message);

    if (!koraJson?.status || !koraJson?.data?.checkout_url) {
      throw new Error(`Korapay: ${koraJson?.message || "No checkout_url returned"}`);
    }

    return new Response(
      JSON.stringify({ payment_link: koraJson.data.checkout_url, order_id: order.id, order_number: order.order_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("korapay-initiate error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
