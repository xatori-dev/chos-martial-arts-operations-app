import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const retiredAccountCreationMessage = "Managed staff account creation is retired. Only Manager123 and Dev123 sign-ins are supported.";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Supabase function secrets are not configured." }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: "Missing manager session." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Invalid manager session." }, 401);

  const { data: callerProfile, error: callerProfileError } = await userClient
    .from("profiles")
    .select("id, username, role, status, is_owner")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (
    callerProfileError ||
    !callerProfile ||
    callerProfile.username !== "manager123" ||
    callerProfile.role !== "staff" ||
    callerProfile.status !== "active" ||
    callerProfile.is_owner !== true
  ) {
    return jsonResponse({ error: "Only the Manager123 owner account can manage accounts." }, 403);
  }

  return jsonResponse({ error: retiredAccountCreationMessage }, 410);
});
