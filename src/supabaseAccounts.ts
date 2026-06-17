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
  role: "staff";
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
  | { status: "error"; message: string };

const supabaseSessionStorageKey = "chos.supabase.auth.v1";
const managerUsername = prototypeManagerLogin.username.toLowerCase();
const supabaseAccountAuthDomain = "accounts.chosmartialarts.app";
const mongTengSupabaseProjectRef = "jqvclzlvrhdcsfhhvekr";
const forbiddenSupabaseProjectRefs = new Set([mongTengSupabaseProjectRef]);

function supabaseUrl() {
  return import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
}

function supabasePublicKey() {
  return (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
}

export function supabaseProjectRefFromUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.endsWith(".supabase.co") ? hostname.split(".")[0] : undefined;
  } catch {
    return undefined;
  }
}

export function isChoSupabaseProjectUrlAllowed(url: string) {
  const projectRef = supabaseProjectRefFromUrl(url);
  return !projectRef || !forbiddenSupabaseProjectRefs.has(projectRef);
}

export function getSupabaseBrowserConfig() {
  const url = supabaseUrl();
  if (!isChoSupabaseProjectUrlAllowed(url)) {
    return {
      url: "",
      publicKey: ""
    };
  }

  return {
    url,
    publicKey: supabasePublicKey()
  };
}

export function isSupabaseAuthConfigured() {
  if (import.meta.env.MODE === "test" && import.meta.env.VITE_ENABLE_SUPABASE_IN_TESTS !== "true") return false;
  const { url, publicKey } = getSupabaseBrowserConfig();
  return Boolean(url && publicKey);
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
    if (profile.username !== managerUsername) return { status: "invalid" };

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
  void account;
  if (!isSupabaseAuthConfigured()) return { status: "not-configured" };
  return { status: "error", message: "Managed staff account creation is retired. Only Manager123 and Dev123 sign-ins are supported." };
}
