// Installment reminders edge function.
//
// Two modes:
//   GET  /installment-reminders?days=3        -> returns today's due-reminder list
//                                               (admin-only via JWT)
//   POST /installment-reminders { auto: true } -> send email reminders for any
//                                                 plan due in next N days that
//                                                 hasn't already been reminded
//                                                 today, log each one.
//                                                 Can be called by pg_cron.
//
// Email is sent through Resend if RESEND_API_KEY is set; otherwise the function
// just logs reminders as channel="manual" so the admin still sees they came
// due. Either way, the admin UI shows everything.
//
// CORS-friendly so the admin dashboard can call it from the browser.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON         = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY        = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL            = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Vivygold <orders@vivygold.com>";
const CRON_SECRET           = Deno.env.get("REMINDER_CRON_SECRET") ?? "";

function ngn(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

function buildWhatsappUrl(phone: string | null, msg: string) {
  const clean = (phone || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

function buildMessage(row: any, store: { name?: string; whatsapp?: string }) {
  const days = row.days_until_due;
  const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const due  = ngn(Number(row.remaining_amount));
  const name = (row.customer_name || "there").split(" ")[0];
  const brand = store.name || "Vivygold";
  return (
    `Hi ${name}, this is a friendly reminder from ${brand}. ` +
    `Your next installment of ${due} is due ${when} (${row.next_due_date}). ` +
    `Please complete your payment to keep your order on track. ` +
    `Reply to this chat if you need help.`
  );
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) return { sent: false, reason: "no_resend_key" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, text }),
    });
    if (!r.ok) {
      return { sent: false, reason: `resend_${r.status}`, body: await r.text() };
    }
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

  // Auth: admin JWT or matching cron secret header
  const authHeader = req.headers.get("Authorization") || "";
  const cronHeader = req.headers.get("X-Reminder-Cron-Secret") || "";
  const isCron     = CRON_SECRET && cronHeader === CRON_SECRET;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  if (!isCron) {
    // verify admin via user JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "admins only" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }

  // Fetch due reminders via RPC (uses service role so it works for cron too)
  const { data: due, error: dueErr } = await admin.rpc("admin_due_reminders", { p_days: days });
  if (dueErr) {
    return new Response(JSON.stringify({ error: dueErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Pull store info for personalization / WA link
  const { data: storeRow } = await admin.from("settings").select("value").eq("key", "store_info").maybeSingle();
  const store = (storeRow?.value as any) || {};

  if (!isPost) {
    // GET: just return the list with prebuilt WA links
    const enriched = (due || []).map((row: any) => {
      const message = buildMessage(row, store);
      return {
        ...row,
        message,
        whatsapp_url: row.customer_phone ? buildWhatsappUrl(row.customer_phone, message) : null,
      };
    });
    return new Response(JSON.stringify({ days, items: enriched }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // POST: send what we can, log each
  const results: any[] = [];
  for (const row of (due || [])) {
    if (row.reminded_today) { results.push({ id: row.installment_id, skipped: "already_today" }); continue; }
    const message = buildMessage(row, store);
    let channel: "email" | "manual" = "manual";
    let meta: any  = {};

    if (row.customer_email && RESEND_API_KEY) {
      const sub  = `Reminder: your ${store.name || "Vivygold"} payment is due soon`;
      const sent = await sendEmail(row.customer_email, sub, message);
      meta = sent;
      if (sent.sent) channel = "email";
    }

    // Always log so we know it came due (helps admin if no email key set)
    await admin.from("installment_reminders").insert({
      installment_id: row.installment_id,
      user_id:        row.user_id,
      channel,
      message,
      meta,
    });
    results.push({ id: row.installment_id, channel, ...meta });
  }

  return new Response(JSON.stringify({ days, processed: results.length, results }), { headers: { ...cors, "Content-Type": "application/json" } });
});
