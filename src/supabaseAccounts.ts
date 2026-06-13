import type { AccountRole, ManagedAccount, ManagerAccessKey } from "./types";
import { prototypeManagerLogin } from "./utils";

type SupabasePasswordResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: {
    id: string;
    email?: string;
  };
};

type SupabaseProfileResponse = {
  id: string;
  username: string;
  contact_email: string | null;
  display_name: string;
  role: AccountRole;
  status: "active" | "inactive";
  phone: string | null;
  title: string | null;
  notes: string | null;
  access: ManagerAccessKey[] | null;
  student_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type SupabaseStoredSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
};

type SupabaseLoginResult =
  | { status: "not-configured" }
  | { status: "invalid" }
  | { status: "inactive" }
  | { status: "error"; message: string }
  | { status: "authenticated"; sessionEmail: string; role: AccountRole; profile: SupabaseProfileResponse };

type SupabaseCreateAccountInput = {
  displayName: string;
  username: string;
  password: string;
  role: "staff" | "student" | "guardian";
  status?: ManagedAccount["status"];
  email: string;
  phone?: string;
  title?: string;
  notes?: string;
  access?: ManagerAccessKey[];
  studentId?: string;
};

type SupabaseCreateAccountResult =
  | { status: "not-configured" }
  | { status: "missing-session" }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string }
  | { status: "created"; account: Omit<ManagedAccount, "password"> };

const supabaseSessionStorageKey = "chos.supabase.auth.v1";
const managerUsername = prototypeManagerLogin.username.toLowerCase();
const supabaseAccountAuthDomain = "accounts.chosmartialarts.app";

function supabaseUrl() {
  return import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
}

function supabasePublicKey() {
  return (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
}

export function getSupabaseBrowserConfig() {
  return {
    url: supabaseUrl(),
    publicKey: supabasePublicKey()
  };
}

export function isSupabaseAuthConfigured() {
  if (import.meta.env.MODE === "test" && import.meta.env.VITE_ENABLE_SUPABASE_IN_TESTS !== "true") return false;
  return Boolean(supabaseUrl() && supabasePublicKey());
}

export function normalizeSupabaseUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function supabaseAuthEmailForUsername(username: string) {
  const normalizedUsername = normalizeSupabaseUsername(username);
  if (normalizedUsername === managerUsername) return `manager123@${supabaseAccountAuthDomain}`;
  return `${normalizedUsername}@${supabaseAccountAuthDomain}`;
}

function saveSupabaseAuthSession(response: SupabasePasswordResponse) {
  if (!response.access_token || !response.user?.id) return;
  const expiresAt = response.expires_at ? response.expires_at * 1000 : Date.now() + Math.max(1, response.expires_in ?? 3600) * 1000;
  const storedSession: SupabaseStoredSession = {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt,
    userId: response.user.id
  };
  window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify(storedSession));
}

export function clearSupabaseAuthSession() {
  window.localStorage.removeItem(supabaseSessionStorageKey);
}

export function readSupabaseAuthSession() {
  const rawSession = window.localStorage.getItem(supabaseSessionStorageKey);
  if (!rawSession) return undefined;
  try {
    const parsed = JSON.parse(rawSession) as SupabaseStoredSession;
    if (!parsed.accessToken || parsed.expiresAt <= Date.now() + 10000) {
      clearSupabaseAuthSession();
      return undefined;
    }
    return parsed;
  } catch {
    clearSupabaseAuthSession();
    return undefined;
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string; msg?: string; message?: string };
    return body.error ?? body.msg ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchSupabaseProfile(userId: string, accessToken: string) {
  const url = new URL(`${supabaseUrl().replace(/\/+$/, "")}/rest/v1/profiles`);
  url.searchParams.set("select", "id,username,contact_email,display_name,role,status,phone,title,notes,access,student_id,created_by,created_at");
  url.searchParams.set("id", `eq.${userId}`);

  const response = await fetch(url, {
    headers: {
      apikey: supabasePublicKey(),
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) return undefined;
  const profiles = (await response.json()) as SupabaseProfileResponse[];
  return profiles[0];
}

function sessionEmailForProfile(profile: SupabaseProfileResponse) {
  return profile.username === managerUsername ? prototypeManagerLogin.email : profile.username;
}

export async function signInSupabaseAccount(credentials: { username: string; password: string }): Promise<SupabaseLoginResult> {
  if (!isSupabaseAuthConfigured()) return { status: "not-configured" };

  const cleanedInput = credentials.username.trim();
  const username = normalizeSupabaseUsername(cleanedInput);
  const password = credentials.password.trim();
  if (!username || !password) return { status: "invalid" };

  const authEmail = cleanedInput.includes("@") ? cleanedInput.toLowerCase() : supabaseAuthEmailForUsername(username);
  const tokenUrl = `${supabaseUrl().replace(/\/+$/, "")}/auth/v1/token?grant_type=password`;

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        apikey: supabasePublicKey(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: authEmail, password })
    });

    if (!tokenResponse.ok) return { status: "invalid" };

    const session = (await tokenResponse.json()) as SupabasePasswordResponse;
    if (!session.access_token || !session.user?.id) return { status: "invalid" };

    const profile = await fetchSupabaseProfile(session.user.id, session.access_token);
    if (!profile) return { status: "invalid" };
    if (profile.status !== "active") return { status: "inactive" };

    saveSupabaseAuthSession(session);
    return {
      status: "authenticated",
      sessionEmail: sessionEmailForProfile(profile),
      role: profile.role,
      profile
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Supabase sign-in failed." };
  }
}

export async function createSupabaseManagedAccount(account: SupabaseCreateAccountInput): Promise<SupabaseCreateAccountResult> {
  if (!isSupabaseAuthConfigured()) return { status: "not-configured" };

  const authSession = readSupabaseAuthSession();
  if (!authSession) return { status: "missing-session" };

  try {
    const response = await fetch(`${supabaseUrl().replace(/\/+$/, "")}/functions/v1/manager-create-account`, {
      method: "POST",
      headers: {
        apikey: supabasePublicKey(),
        Authorization: `Bearer ${authSession.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(account)
    });

    if (response.status === 401 || response.status === 403) {
      if (response.status === 401) clearSupabaseAuthSession();
      return { status: "unauthorized", message: await readErrorMessage(response, "Manager authorization failed.") };
    }

    if (!response.ok) {
      return { status: "error", message: await readErrorMessage(response, "Unable to create Supabase account.") };
    }

    const body = (await response.json()) as { account?: Omit<ManagedAccount, "password"> };
    if (!body.account) return { status: "error", message: "Supabase did not return the created account." };
    return { status: "created", account: body.account };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to create Supabase account." };
  }
}
