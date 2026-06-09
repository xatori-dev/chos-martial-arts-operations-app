import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type AccountRole = "staff" | "student" | "guardian";
type AccountStatus = "active" | "inactive";

type CreateAccountRequest = {
  displayName?: string;
  username?: string;
  password?: string;
  role?: AccountRole;
  status?: AccountStatus;
  email?: string;
  phone?: string;
  title?: string;
  notes?: string;
  access?: string[];
  studentId?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const managerAccessKeys = new Set([
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
const accountAuthDomain = "accounts.chosmartialarts.app";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function normalizeUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function authEmailForUsername(username: string) {
  const normalizedUsername = normalizeUsername(username);
  if (normalizedUsername === "manager123") return `manager123@${accountAuthDomain}`;
  return `${normalizedUsername}@${accountAuthDomain}`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function cleanAccess(role: AccountRole, access: unknown) {
  if (role !== "staff" || !Array.isArray(access)) return [];
  return access.filter((key): key is string => typeof key === "string" && managerAccessKeys.has(key));
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
    return jsonResponse({ error: "Only the Manager123 owner account can create accounts." }, 403);
  }

  let body: CreateAccountRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const displayName = body.displayName?.trim() ?? "";
  const username = normalizeUsername(body.username ?? "");
  const password = body.password?.trim() ?? "";
  const role = body.role;
  const status = body.status ?? "active";
  const contactEmail = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() || null;
  const title = body.title?.trim() || null;
  const notes = body.notes?.trim() || null;
  const studentId = body.studentId?.trim() || null;
  const access = cleanAccess(role ?? "guardian", body.access);

  if (!displayName) return jsonResponse({ error: "Display name is required." }, 400);
  if (!username) return jsonResponse({ error: "Username is required." }, 400);
  if (username === "manager123") return jsonResponse({ error: "Manager123 is reserved for the owner account." }, 409);
  if (!password || password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
  if (role !== "staff" && role !== "student" && role !== "guardian") return jsonResponse({ error: "Invalid account role." }, 400);
  if (status !== "active" && status !== "inactive") return jsonResponse({ error: "Invalid account status." }, 400);
  if (!contactEmail || !isValidEmail(contactEmail)) return jsonResponse({ error: "Valid contact email is required." }, 400);

  const authEmail = authEmailForUsername(username);

  const { data: existingUsername } = await adminClient.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existingUsername) return jsonResponse({ error: "That username is already in use." }, 409);

  const { data: existingAuthEmail } = await adminClient.from("profiles").select("id").eq("auth_email", authEmail).maybeSingle();
  if (existingAuthEmail) return jsonResponse({ error: "That username is already in use." }, 409);

  const { data: existingContactEmail } = await adminClient.from("profiles").select("id").eq("contact_email", contactEmail).maybeSingle();
  if (existingContactEmail) return jsonResponse({ error: "That contact email is already in use." }, 409);

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      username,
      contact_email: contactEmail
    },
    app_metadata: {
      role
    }
  });

  if (createUserError || !createdUser.user) {
    return jsonResponse({ error: createUserError?.message ?? "Unable to create Supabase Auth user." }, 400);
  }

  const profile = {
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

  const { data: insertedProfile, error: profileError } = await adminClient
    .from("profiles")
    .insert(profile)
    .select("id, username, contact_email, display_name, role, status, phone, title, notes, access, student_id, created_by, created_at")
    .single();

  if (profileError || !insertedProfile) {
    await adminClient.auth.admin.deleteUser(createdUser.user.id);
    return jsonResponse({ error: profileError?.message ?? "Unable to save account profile." }, 400);
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
      id: insertedProfile.id,
      displayName: insertedProfile.display_name,
      username: insertedProfile.username,
      role: insertedProfile.role,
      status: insertedProfile.status,
      email: insertedProfile.contact_email,
      phone: insertedProfile.phone ?? undefined,
      title: insertedProfile.title ?? undefined,
      notes: insertedProfile.notes ?? undefined,
      access: insertedProfile.access ?? [],
      studentId: insertedProfile.student_id ?? undefined,
      createdBy: insertedProfile.created_by ?? undefined,
      createdAt: insertedProfile.created_at
    }
  });
});
