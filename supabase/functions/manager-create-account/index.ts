import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const accountAuthDomain = "accounts.chosmartialarts.app";
const allowedRoles = new Set(["staff", "student", "guardian"]);
const allowedStatuses = new Set(["active", "inactive"]);
const passwordPolicyMessage = "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.";
const allowedAccess = new Set([
  "dashboard",
  "messages",
  "students",
  "classes",
  "studyGuide",
  "events",
  "scheduling",
  "merchandise",
  "videos",
  "reports"
]);

type AccountRequest = {
  displayName?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
  status?: unknown;
  email?: unknown;
  phone?: unknown;
  title?: unknown;
  notes?: unknown;
  access?: unknown;
  studentId?: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUsername(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function authEmailForUsername(username: string) {
  return `${username}@${accountAuthDomain}`;
}

function normalizeAccess(value: unknown, role: string) {
  if (role !== "staff" || !Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && allowedAccess.has(item)))];
}

function isStrongPassword(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase function secrets are not configured." }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: "Missing manager session." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

  let body: AccountRequest;
  try {
    body = await req.json() as AccountRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const username = normalizeUsername(body.username);
  const displayName = cleanString(body.displayName);
  const password = cleanString(body.password);
  const role = allowedRoles.has(cleanString(body.role)) ? cleanString(body.role) : "";
  const status = allowedStatuses.has(cleanString(body.status)) ? cleanString(body.status) : "active";
  const contactEmail = cleanString(body.email).toLowerCase() || null;
  const phone = cleanString(body.phone) || null;
  const title = cleanString(body.title) || null;
  const notes = cleanString(body.notes) || null;
  const studentId = cleanString(body.studentId) || null;
  const access = normalizeAccess(body.access, role);
  const authEmail = authEmailForUsername(username);

  if (!username || username.length < 3 || !displayName || !password || !role) {
    return jsonResponse({ error: "Display name, username, password, and role are required." }, 400);
  }
  if (!isStrongPassword(password)) {
    return jsonResponse({ error: passwordPolicyMessage }, 400);
  }
  if (username === "manager123" || username === "dev123" || username.endsWith(".child")) {
    return jsonResponse({ error: "That username is reserved." }, 400);
  }
  if (role === "student" && !studentId) {
    return jsonResponse({ error: "Student accounts require a linked student id." }, 400);
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id")
    .or(`username.eq.${username},auth_email.eq.${authEmail}`)
    .maybeSingle();

  if (existingProfileError) return jsonResponse({ error: "Could not check existing profiles." }, 500);
  if (existingProfile) return jsonResponse({ error: "An account with that username already exists." }, 409);

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      role,
      display_name: displayName,
      contact_email: contactEmail
    }
  });

  if (createUserError || !createdUser.user) {
    return jsonResponse({ error: createUserError?.message ?? "Could not create Supabase Auth user." }, 400);
  }

  const profileRow = {
    id: createdUser.user.id,
    username,
    auth_email: authEmail,
    contact_email: contactEmail,
    display_name: displayName,
    role,
    status,
    is_owner: false,
    phone,
    title,
    notes,
    access,
    student_id: studentId,
    created_by: authData.user.id
  };

  const { error: profileError } = await adminClient.from("profiles").insert(profileRow);
  if (profileError) {
    await adminClient.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined);
    return jsonResponse({ error: profileError.message }, 400);
  }

  await adminClient.from("account_creation_audit").insert({
    created_by: authData.user.id,
    created_user_id: createdUser.user.id,
    created_username: username,
    created_auth_email: authEmail,
    created_contact_email: contactEmail,
    created_role: role,
    request_ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent")
  });

  return jsonResponse({
    account: {
      id: createdUser.user.id,
      username,
      role,
      status
    }
  });
});
