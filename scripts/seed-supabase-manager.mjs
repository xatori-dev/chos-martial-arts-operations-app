const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const managerUsername = (process.env.MANAGER_USERNAME ?? "Manager123").trim();
const managerPassword = process.env.MANAGER_PASSWORD?.trim() ?? "";
const managerAuthEmail = (process.env.MANAGER_AUTH_EMAIL ?? "manager123@accounts.chosmartialarts.app").trim().toLowerCase();
const managerDisplayName = process.env.MANAGER_DISPLAY_NAME ?? "Cho's Manager";
const deleteExtraAuthUsers = process.argv.includes("--delete-extra-auth-users");
const confirmedDeleteExtraAuthUsers = process.argv.includes("--yes-delete-extra-auth-users");
const strongPasswordMessage = "MANAGER_PASSWORD must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  process.exit(1);
}

if (!isStrongPassword(managerPassword)) {
  console.error(strongPasswordMessage);
  process.exit(1);
}

if (deleteExtraAuthUsers && !confirmedDeleteExtraAuthUsers) {
  console.error("Refusing to delete Auth users without --yes-delete-extra-auth-users.");
  process.exit(1);
}

const adminHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json"
};

function isStrongPassword(password) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

async function adminFetch(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      ...adminHeaders,
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) return undefined;
  return response.json();
}

async function listAuthUsers() {
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const body = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const pageUsers = Array.isArray(body.users) ? body.users : [];
    users.push(...pageUsers);
    if (pageUsers.length < 1000) break;
  }
  return users;
}

async function ensureManagerUser(existingUser) {
  const payload = {
    email: managerAuthEmail,
    password: managerPassword,
    email_confirm: true,
    user_metadata: {
      display_name: managerDisplayName,
      username: managerUsername
    },
    app_metadata: {
      role: "staff"
    }
  };

  if (existingUser) {
    const body = await adminFetch(`/auth/v1/admin/users/${existingUser.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    return body.user ?? body;
  }

  const body = await adminFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return body.user ?? body;
}

async function upsertManagerProfile(user) {
  const profile = {
    id: user.id,
    username: managerUsername.toLowerCase(),
    auth_email: managerAuthEmail,
    contact_email: managerAuthEmail,
    display_name: managerDisplayName,
    role: "staff",
    status: "active",
    is_owner: true,
    access: ["dashboard", "messages", "students", "classes", "studyGuide", "events", "scheduling", "merchandise", "videos", "reports"],
    created_by: user.id
  };

  await adminFetch("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify(profile)
  });
}

const users = await listAuthUsers();
const existingManager = users.find((user) => user.email?.toLowerCase() === managerAuthEmail);
const managerUser = await ensureManagerUser(existingManager);
await upsertManagerProfile(managerUser);

if (deleteExtraAuthUsers) {
  const usersAfterManager = await listAuthUsers();
  const extraUsers = usersAfterManager.filter((user) => user.id !== managerUser.id);
  for (const user of extraUsers) {
    await adminFetch(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
    console.log(`Deleted extra Auth user ${user.email ?? user.id}`);
  }
}

console.log(`Supabase manager ready: ${managerUsername} (${managerAuthEmail})`);
