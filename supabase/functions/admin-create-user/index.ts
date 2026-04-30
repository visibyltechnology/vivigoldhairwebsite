// Admin-only: create a new user with email + password and (optionally) assign admin role.
// Caller must already be an authenticated admin in the database.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: meData } = await supabase.auth.getUser(token);
    const callerId = meData.user?.id;
    if (!callerId) throw new Error("Not authenticated");

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Not authorized — admin only");

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const full_name = String(body.full_name || "").trim();
    const make_admin = body.make_admin !== false; // default true

    if (!email || !password) throw new Error("Email and password required");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");

    // Try to create — if user already exists, fetch them instead
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createErr && !/already (registered|exists)/i.test(createErr.message)) {
      throw createErr;
    }

    if (created?.user?.id) {
      userId = created.user.id;
    } else {
      // already exists — find them
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
      if (existing) userId = existing.id;
    }

    if (!userId) throw new Error("Failed to create or locate user");

    if (make_admin) {
      await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    if (full_name) {
      await supabase
        .from("profiles")
        .upsert({ id: userId, full_name }, { onConflict: "id" });
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, email, made_admin: make_admin }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("admin-create-user error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
