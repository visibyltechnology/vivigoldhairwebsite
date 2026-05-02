// login-alert: called after a successful sign-in.
// Sends an email to the user with device, IP, and approximate location.
// Uses Resend (same key as installment-reminders).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Vivygold <no-reply@vivygold.com>";

function parseDevice(ua: string): string {
  if (!ua) return "Unknown device";
  let browser = "Unknown browser";
  let os = "Unknown OS";

  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

  if (/iPhone/.test(ua)) os = "iPhone";
  else if (/iPad/.test(ua)) os = "iPad";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser} on ${os}`;
}

async function getGeo(ip: string): Promise<string> {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("::")) return "Local / Development";
  try {
    const res = await fetch(`https://ipinfo.io/${ip}/json`);
    if (!res.ok) return ip;
    const d = await res.json();
    const parts = [d.city, d.region, d.country].filter(Boolean);
    return parts.length ? parts.join(", ") : ip;
  } catch {
    return ip;
  }
}

function buildHtml(email: string, device: string, location: string, ip: string, time: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>New Sign-In Alert</title>
</head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;padding:28px 40px;text-align:center;">
              <span style="color:#c9a96e;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;font-family:sans-serif;">Vivygold</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a96e;font-family:sans-serif;">Security Alert</p>
              <h1 style="margin:0 0 20px;font-size:26px;color:#1a1a1a;font-weight:normal;">New sign-in detected</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
                Your Vivygold account was signed into. Here are the details:
              </p>
              <!-- Details table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:4px;overflow:hidden;">
                <tr style="background:#faf9f7;">
                  <td style="padding:14px 18px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#888;font-family:sans-serif;width:120px;">Time</td>
                  <td style="padding:14px 18px;font-size:14px;color:#1a1a1a;">${time}</td>
                </tr>
                <tr style="border-top:1px solid #e8e4de;">
                  <td style="padding:14px 18px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#888;font-family:sans-serif;">Device</td>
                  <td style="padding:14px 18px;font-size:14px;color:#1a1a1a;">${device}</td>
                </tr>
                <tr style="border-top:1px solid #e8e4de;background:#faf9f7;">
                  <td style="padding:14px 18px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#888;font-family:sans-serif;">Location</td>
                  <td style="padding:14px 18px;font-size:14px;color:#1a1a1a;">${location}</td>
                </tr>
                <tr style="border-top:1px solid #e8e4de;">
                  <td style="padding:14px 18px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#888;font-family:sans-serif;">IP Address</td>
                  <td style="padding:14px 18px;font-size:14px;color:#1a1a1a;font-family:monospace;">${ip}</td>
                </tr>
              </table>

              <p style="margin:28px 0 8px;font-size:14px;color:#555;line-height:1.6;">
                If this was you, no action is needed. If you don't recognise this sign-in, please
                <strong>change your password immediately</strong> and contact us.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#faf9f7;padding:20px 40px;text-align:center;border-top:1px solid #e8e4de;">
              <p style="margin:0;font-size:11px;color:#aaa;font-family:sans-serif;">
                This email was sent to ${email} · Vivygold Hair
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { email, user_agent } = await req.json();
    if (!email) throw new Error("Missing email");

    // Get client IP from forwarded headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "Unknown";

    const [location, device] = await Promise.all([
      getGeo(ip),
      Promise.resolve(parseDevice(user_agent || req.headers.get("user-agent") || "")),
    ]);

    const time = new Date().toLocaleString("en-GB", {
      timeZone: "Africa/Lagos",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " (WAT)";

    if (!RESEND_API_KEY) {
      console.log(`Login alert (no Resend key): ${email} | ${device} | ${location} | ${ip}`);
      return new Response(JSON.stringify({ sent: false, reason: "no_resend_key" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: "New sign-in to your Vivygold account",
        html: buildHtml(email, device, location, ip, time),
      }),
    });

    const result = await r.json();
    return new Response(JSON.stringify({ sent: r.ok, id: result.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("login-alert error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
