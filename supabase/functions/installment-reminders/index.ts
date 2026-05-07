// Installment reminders edge function.
//
// Two modes:
//   GET  /installment-reminders?days=3        -> returns today's due-reminder list (admin JWT)
//   POST /installment-reminders { auto: true } -> send email reminders for any plan due in
//                                                 next N days that hasn't been reminded today.
//                                                 Auth: admin JWT  OR  X-Reminder-Cron-Secret header
//                                                 matching the secret stored in settings.cron_config.
//
// Runs automatically via pg_cron every day at 07:00 UTC (08:00 WAT).

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reminder-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON         = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY        = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL            = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Vivygold Hair <orders@vivygold.com>";

function ngn(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

function buildWhatsappUrl(phone: string | null, msg: string) {
  const clean = (phone || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

function buildTextMessage(row: any, store: { name?: string }) {
  const days  = row.days_until_due;
  const when  = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const due   = ngn(Number(row.remaining_amount));
  const name  = (row.customer_name || "there").split(" ")[0];
  const brand = store.name || "Vivygold";
  return (
    `Hi ${name}, this is a friendly reminder from ${brand}. ` +
    `Your next installment of ${due} is due ${when} (${row.next_due_date}). ` +
    `Please complete your payment to keep your order on track. ` +
    `Reply if you need help.`
  );
}

function buildHtmlEmail(row: any, store: { name?: string; whatsapp?: string }) {
  const days     = row.days_until_due;
  const isOverdue = days < 0;
  const when     = isOverdue ? `${Math.abs(days)} day(s) overdue` : days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const due      = ngn(Number(row.remaining_amount));
  const name     = (row.customer_name || "Valued Customer").split(" ")[0];
  const brand    = store.name || "Vivygold";
  const waNum    = (store.whatsapp || "").replace(/[^0-9]/g, "");
  const waLink   = waNum ? `https://wa.me/${waNum}` : null;

  const urgencyColor  = isOverdue ? "#e53e3e" : days === 0 ? "#d97706" : "#c9a96e";
  const urgencyLabel  = isOverdue ? "OVERDUE" : days === 0 ? "DUE TODAY" : "PAYMENT REMINDER";
  const urgencyBg     = isOverdue ? "#fff5f5" : days === 0 ? "#fffbeb" : "#fdf8f0";
  const urgencyBorder = isOverdue ? "#feb2b2" : days === 0 ? "#fcd34d" : "#f0e4c8";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f0;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a1a;padding:24px 40px;text-align:center;">
            <span style="color:#c9a96e;font-size:11px;letter-spacing:0.35em;text-transform:uppercase;font-family:sans-serif;">${brand}</span>
          </td>
        </tr>

        <!-- Urgency badge -->
        <tr>
          <td style="background:${urgencyBg};border-bottom:2px solid ${urgencyBorder};padding:16px 40px;text-align:center;">
            <span style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${urgencyColor};font-family:sans-serif;font-weight:600;">${urgencyLabel}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a96e;font-family:sans-serif;">Hi ${name},</p>
            <h1 style="margin:0 0 20px;font-size:24px;color:#1a1a1a;font-weight:normal;line-height:1.3;">
              Your installment payment is ${when}
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
              This is a friendly reminder that your next installment payment is <strong style="color:${urgencyColor};">due ${when}</strong>.
              Completing your payment keeps your order on track and ensures timely delivery.
            </p>

            <!-- Amount box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:4px;padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#888;font-family:sans-serif;">Amount due</p>
                  <p style="margin:0;font-size:28px;color:${urgencyColor};font-weight:bold;font-family:sans-serif;">${due}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#888;font-family:sans-serif;">Due date: ${row.next_due_date}</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.7;">
              ${isOverdue
                ? "Your payment is now overdue. Please complete it as soon as possible to avoid any issues with your order. If you're experiencing difficulties, don't hesitate to reach out — we're happy to help."
                : "To make your payment, simply log in to your account and visit your orders page. If you have any questions or need assistance, we're here for you."}
            </p>

            ${waLink ? `
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#25d366;border-radius:4px;padding:0;">
                  <a href="${waLink}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-family:sans-serif;font-weight:600;text-decoration:none;">
                    💬 Contact us on WhatsApp
                  </a>
                </td>
              </tr>
            </table>` : ""}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf9f7;padding:20px 40px;text-align:center;border-top:1px solid #e8e4de;">
            <p style="margin:0;font-size:11px;color:#aaa;font-family:sans-serif;line-height:1.6;">
              ${brand} · Questions? Reply to this email${waLink ? ` or WhatsApp us` : ""}<br/>
              You're receiving this because you have an active installment plan with us.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) return { sent: false, reason: "no_resend_key" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text }),
    });
    if (!r.ok) return { sent: false, reason: `resend_${r.status}`, body: await r.text() };
    const j = await r.json();
    return { sent: true, id: j.id };
  } catch (e) {
    return { sent: false, reason: "resend_throw", error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url    = new URL(req.url);
  const days   = Math.max(0, parseInt(url.searchParams.get("days") || "3", 10));
  const isPost = req.method === "POST";

  const authHeader = req.headers.get("Authorization") || "";
  const cronHeader = req.headers.get("X-Reminder-Cron-Secret") || "";

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  // Load cron secret from settings table (generated in DB, never in code)
  const { data: cronRow } = await admin
    .from("settings")
    .select("value")
    .eq("key", "cron_config")
    .maybeSingle();
  const cronSecret = (cronRow?.value as any)?.reminder_secret ?? "";
  const isCron = cronSecret && cronHeader === cronSecret;

  if (!isCron) {
    // Verify admin JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", ures.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "admins only" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }

  // Fetch due reminders
  const { data: due, error: dueErr } = await admin.rpc("admin_due_reminders", { p_days: days });
  if (dueErr) {
    return new Response(JSON.stringify({ error: dueErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Load store info
  const { data: storeRow } = await admin.from("settings").select("value").eq("key", "store_info").maybeSingle();
  const store = (storeRow?.value as any) || {};

  if (!isPost) {
    // GET: return list with WA links
    const enriched = (due || []).map((row: any) => {
      const text = buildTextMessage(row, store);
      return {
        ...row,
        message: text,
        whatsapp_url: row.customer_phone ? buildWhatsappUrl(row.customer_phone, text) : null,
      };
    });
    return new Response(JSON.stringify({ days, items: enriched }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // POST: send reminders for all that haven't been reminded today
  const results: any[] = [];
  for (const row of (due || [])) {
    if (row.reminded_today) {
      results.push({ id: row.installment_id, skipped: "already_today" });
      continue;
    }

    const isOverdue = row.days_until_due < 0;
    const brand = store.name || "Vivygold";
    const subject = isOverdue
      ? `⚠️ Overdue payment — your ${brand} installment needs attention`
      : row.days_until_due === 0
      ? `Reminder: your ${brand} installment is due today`
      : `Reminder: your ${brand} installment is due in ${row.days_until_due} day(s)`;

    const textMsg  = buildTextMessage(row, store);
    const htmlMsg  = buildHtmlEmail(row, store);

    let channel: "email" | "manual" = "manual";
    let meta: any = {};

    if (row.customer_email && RESEND_API_KEY) {
      const sent = await sendEmail(row.customer_email, subject, htmlMsg, textMsg);
      meta = sent;
      if (sent.sent) channel = "email";
    }

    await admin.from("installment_reminders").insert({
      installment_id: row.installment_id,
      user_id:        row.user_id,
      channel,
      message:        textMsg,
      meta,
    });

    results.push({ id: row.installment_id, channel, ...meta });
  }

  return new Response(
    JSON.stringify({ days, processed: results.length, results }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
