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
  installment_interest_rate_pct?: number;
}

async function sendOrderConfirmation(order: {
  order_number: string;
  customer_name: string;
  customer_email: string;
  currency: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  is_installment: boolean;
}, items: Array<{ name: string; quantity: number; price: number }>, firstAmount: number, parts: number) {
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  const FROM = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Vivygold Hair <onboarding@resend.dev>";
  if (!RESEND_KEY) return;

  const sym = order.currency === "NGN" ? "₦" : "$";
  const fmt = (n: number) => sym + Number(n).toLocaleString("en-NG");

  const itemRows = items.map(i =>
    `<tr>
      <td style="padding:12px 16px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #e8e4de;">${i.name}</td>
      <td style="padding:12px 16px;font-size:14px;color:#555;text-align:center;border-bottom:1px solid #e8e4de;">${i.quantity}</td>
      <td style="padding:12px 16px;font-size:14px;color:#1a1a1a;text-align:right;border-bottom:1px solid #e8e4de;">${fmt(i.price * i.quantity)}</td>
    </tr>`
  ).join("");

  const installmentNote = order.is_installment && parts > 1
    ? `<p style="margin:16px 0 0;font-size:14px;color:#555;line-height:1.6;">
        You chose <strong>Pay Small Small</strong> — ${parts} instalments of <strong>${fmt(firstAmount)}</strong> each.
        Your first payment of ${fmt(firstAmount)} is due now.
      </p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f0;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a1a1a;padding:28px 40px;text-align:center;">
            <span style="color:#c9a96e;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;font-family:sans-serif;">Vivygold Hair</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a96e;font-family:sans-serif;">Order Confirmed</p>
            <h1 style="margin:0 0 8px;font-size:28px;color:#1a1a1a;font-weight:normal;">Thank you, ${order.customer_name.split(" ")[0]}!</h1>
            <p style="margin:0 0 28px;font-size:13px;color:#888;font-family:sans-serif;letter-spacing:0.1em;">Order <strong style="color:#1a1a1a;">${order.order_number}</strong></p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              We've received your order and will begin processing it once payment is confirmed. You'll hear from us soon.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:4px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#faf9f7;">
                  <th style="padding:12px 16px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;font-family:sans-serif;text-align:left;">Item</th>
                  <th style="padding:12px 16px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;font-family:sans-serif;text-align:center;">Qty</th>
                  <th style="padding:12px 16px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;font-family:sans-serif;text-align:right;">Price</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td style="font-size:13px;color:#888;padding:4px 0;">Subtotal</td>
                <td style="font-size:13px;color:#555;text-align:right;padding:4px 0;">${fmt(order.subtotal)}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#888;padding:4px 0;">Shipping</td>
                <td style="font-size:13px;color:#555;text-align:right;padding:4px 0;">${fmt(order.shipping_fee)}</td>
              </tr>
              <tr style="border-top:1px solid #e8e4de;">
                <td style="font-size:16px;color:#1a1a1a;font-weight:bold;padding:12px 0 4px;">Total</td>
                <td style="font-size:16px;color:#1a1a1a;font-weight:bold;text-align:right;padding:12px 0 4px;">${fmt(order.total)}</td>
              </tr>
            </table>
            ${installmentNote}
          </td>
        </tr>
        <tr>
          <td style="background:#faf9f7;padding:20px 40px;text-align:center;border-top:1px solid #e8e4de;">
            <p style="margin:0;font-size:11px;color:#aaa;font-family:sans-serif;">Questions? Reply to this email or WhatsApp us · Vivygold Hair</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: order.customer_email, subject: `Your Vivygold order ${order.order_number} is confirmed`, html }),
    });
  } catch (e) {
    console.error("order confirmation email failed:", e);
  }
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

    // Apply interest rate when splitting into installments
    const interestRatePct = body.is_installment && parts > 1 ? (body.installment_interest_rate_pct ?? 0) : 0;
    const installmentTotal = interestRatePct > 0 ? Math.round(total * (1 + interestRatePct / 100)) : total;
    const firstAmount = body.is_installment ? Math.floor(installmentTotal / parts) : total;

    if (body.is_installment && parts > 1 && userId) {
      await supabase.from("installments").insert({
        user_id: userId,
        order_id: order.id,
        total_amount: installmentTotal,
        paid_amount: 0,
        remaining_amount: installmentTotal,
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

    // Fire order confirmation email (non-blocking)
    sendOrderConfirmation(
      {
        order_number: order.order_number,
        customer_name: body.customer.name,
        customer_email: body.customer.email,
        currency: body.currency,
        total,
        subtotal,
        shipping_fee: body.shipping_fee || 0,
        is_installment: !!body.is_installment,
      },
      body.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
      firstAmount,
      parts,
    ).catch(() => {});

    return new Response(
      JSON.stringify({ payment_link: koraJson.data.checkout_url, order_id: order.id, order_number: order.order_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("korapay-initiate error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
