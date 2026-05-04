// low-stock-alert: called by admin when a product's stock drops to ≤ 5.
  // Sends an email to the store owner via Resend.

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Vivygold Hair <no-reply@vivygold.com>";
  const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "contact@visibyl.biz";

  function buildHtml(name: string, stock: number, productId: string): string {
    const urgency = stock === 0 ? "is now OUT OF STOCK" : `has only ${stock} unit${stock === 1 ? "" : "s"} left`;
    const colour = stock === 0 ? "#c0392b" : "#c9a96e";
    return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Stock Alert</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f4f0;font-family:'Georgia',serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f0;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#1a1a1a;padding:28px 40px;text-align:center;">
                <span style="color:#c9a96e;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;font-family:sans-serif;">Vivygold Hair · Stock Alert</span>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 40px 32px;">
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${colour};font-family:sans-serif;">Action Required</p>
                <h1 style="margin:0 0 20px;font-size:24px;color:#1a1a1a;font-weight:normal;">Low Stock Warning</h1>
                <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
                  The following product ${urgency}:
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:4px;overflow:hidden;">
                  <tr style="background:#faf9f7;">
                    <td style="padding:14px 18px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#888;font-family:sans-serif;width:120px;">Product</td>
                    <td style="padding:14px 18px;font-size:15px;color:#1a1a1a;font-weight:bold;">${name}</td>
                  </tr>
                  <tr style="border-top:1px solid #e8e4de;">
                    <td style="padding:14px 18px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#888;font-family:sans-serif;">Stock</td>
                    <td style="padding:14px 18px;font-size:15px;color:${colour};font-weight:bold;">${stock === 0 ? "Out of stock" : `${stock} unit${stock === 1 ? "" : "s"} remaining`}</td>
                  </tr>
                </table>
                <p style="margin:28px 0 0;font-size:14px;color:#555;line-height:1.6;">
                  Please restock this item in the admin dashboard to avoid lost sales.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#faf9f7;padding:20px 40px;text-align:center;border-top:1px solid #e8e4de;">
                <p style="margin:0;font-size:11px;color:#aaa;font-family:sans-serif;">
                  Vivygold Hair · Admin Notification
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
      const { name, stock, product_id } = await req.json();
      if (!name || stock === undefined) throw new Error("Missing name or stock");

      if (!RESEND_API_KEY) {
        console.log(`Low stock alert (no Resend key): ${name} — ${stock} left`);
        return new Response(JSON.stringify({ sent: false, reason: "no_resend_key" }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const subject = stock === 0
        ? `⚠️ Out of Stock: ${name}`
        : `Low Stock Alert: ${name} (${stock} left)`;

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: OWNER_EMAIL,
          subject,
          html: buildHtml(name, stock, product_id ?? ""),
        }),
      });

      const result = await r.json();
      console.log(`Stock alert sent for "${name}" (stock=${stock}): ${r.ok ? result.id : JSON.stringify(result)}`);
      return new Response(JSON.stringify({ sent: r.ok, id: result.id }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("low-stock-alert error:", e);
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  });
  