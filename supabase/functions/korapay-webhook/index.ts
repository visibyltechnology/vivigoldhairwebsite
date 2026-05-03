import { createClient } from "npm:@supabase/supabase-js@2";

    const adminClient = () =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    async function getKorapayKeys(): Promise<{ secret_key: string; encryption_key: string }> {
      let secret_key = "";
      let encryption_key = "";
      try {
        const sb = adminClient();
        const { data } = await sb.from("settings").select("value").eq("key", "korapay_keys").maybeSingle();
        if (data?.value) {
          secret_key = ((data.value as any).secret_key || "").trim();
          encryption_key = ((data.value as any).encryption_key || "").trim();
        }
      } catch (_) {}
      if (!secret_key) secret_key = (Deno.env.get("KORAPAY_SECRET_KEY") || "").trim();
      if (!encryption_key) encryption_key = (Deno.env.get("KORAPAY_ENCRYPTION_KEY") || "").trim();
      return { secret_key, encryption_key };
    }

    async function verifySignature(encryptionKey: string, rawBody: string, sig: string): Promise<boolean> {
      try {
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(encryptionKey),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
        const hex = Array.from(new Uint8Array(mac))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        return hex === sig;
      } catch (_) {
        return false;
      }
    }

    Deno.serve(async (req) => {
      try {
        const rawBody = await req.text();
        const { secret_key, encryption_key } = await getKorapayKeys();

        const sig = req.headers.get("x-korapay-signature") || "";

        if (!sig) {
          console.warn("korapay-webhook: missing x-korapay-signature header — rejecting");
          return new Response("Unauthorized", { status: 401 });
        }

        if (!encryption_key) {
          console.error("korapay-webhook: KORAPAY_ENCRYPTION_KEY not configured — cannot verify signature");
          return new Response("Server misconfiguration", { status: 500 });
        }

        const valid = await verifySignature(encryption_key, rawBody, sig);
        if (!valid) {
          console.warn("korapay-webhook: invalid signature — rejecting");
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        console.log("korapay-webhook: event =", payload?.event);

        if (payload?.event !== "charge.success") return new Response("ok");

        const data = payload?.data;
        const reference = data?.reference;
        const orderId = data?.metadata?.order_id;
        if (!orderId || !reference) return new Response("ok");

        // Double-verify with Korapay API before updating any order
        const verifyRes = await fetch(`https://api.korapay.com/merchant/api/v1/charges/${reference}`, {
          headers: { Authorization: `Bearer ${secret_key}` },
        });
        const verifyJson = await verifyRes.json();
        if (!verifyJson?.data || verifyJson.data?.status !== "success") {
          console.warn("korapay-webhook: charge verify returned non-success for ref", reference);
          return new Response("ok");
        }

        const txData = verifyJson.data;
        const supabase = adminClient();
        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
        if (!order) return new Response("ok");

        const partNumber = Number(txData.metadata?.part_number ?? 1);

        if (!order.is_installment) {
          // Single full payment — store Korapay reference on the order
          await supabase
            .from("orders")
            .update({ payment_status: "paid", status: "processing", payment_reference: reference })
            .eq("id", orderId);
          console.log("korapay-webhook: order", orderId, "marked paid, ref:", reference);
        } else {
          const { data: inst } = await supabase
            .from("installments")
            .select("*")
            .eq("order_id", orderId)
            .maybeSingle();

          if (inst) {
            // Idempotency check — don't process the same reference twice
            const { data: existing } = await supabase
              .from("installment_payments")
              .select("id")
              .eq("flutterwave_tx_ref", reference)
              .maybeSingle();
            if (existing) {
              console.log("korapay-webhook: duplicate reference", reference, "— skipping");
              return new Response("ok");
            }

            const paid = Number(inst.paid_amount) + Number(txData.amount);
            const remaining = Math.max(0, Number(inst.total_amount) - paid);
            const isComplete = remaining <= 1;

            await supabase
              .from("installments")
              .update({ paid_amount: paid, remaining_amount: remaining, status: isComplete ? "completed" : "active" })
              .eq("id", inst.id);

            // Store Korapay reference in the flutterwave_tx_ref column (repurposed)
            await supabase.from("installment_payments").insert({
              installment_id: inst.id,
              part_number: partNumber,
              amount: Number(txData.amount),
              status: "paid",
              flutterwave_tx_id: reference,
              flutterwave_tx_ref: reference,
              paid_at: new Date().toISOString(),
            });

            await supabase
              .from("orders")
              .update({
                payment_status: isComplete ? "paid" : "partial",
                status: isComplete ? "processing" : "pending",
                payment_reference: reference,
              })
              .eq("id", orderId);

            console.log("korapay-webhook: installment part", partNumber, "recorded for order", orderId, "| ref:", reference, "| remaining:", remaining);
          }
        }

        return new Response("ok");
      } catch (e) {
        console.error("korapay-webhook error:", e instanceof Error ? e.message : e);
        return new Response("error", { status: 500 });
      }
    });
    