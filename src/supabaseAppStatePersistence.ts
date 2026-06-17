import { getSupabaseBrowserConfig, isSupabaseAuthConfigured, readSupabaseAuthSession } from "./supabaseAccounts";

type SupabaseAppStateResult<T = undefined> =
  | { status: "ok"; data: T }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

type AppStateRow = {
  key: string;
  value: unknown;
};

function unavailableMessage() {
  if (!isSupabaseAuthConfigured()) return "Supabase is not configured for app state persistence.";
  if (!readSupabaseAuthSession()) return "Supabase sign-in required for app state persistence.";
  return undefined;
}

export function isSupabaseAppStateRemoteBacked() {
  return isSupabaseAuthConfigured();
}

function buildRestUrl(query?: Record<string, string>) {
  const { url } = getSupabaseBrowserConfig();
  const restUrl = new URL(`${url.replace(/\/+$/, "")}/rest/v1/app_state_items`);
  Object.entries(query ?? {}).forEach(([key, value]) => restUrl.searchParams.set(key, value));
  return restUrl.toString();
}

function authHeaders(extraHeaders?: HeadersInit) {
  const session = readSupabaseAuthSession();
  const { publicKey } = getSupabaseBrowserConfig();
  if (!session || !publicKey) return undefined;
  return {
    apikey: publicKey,
    Authorization: `Bearer ${session.accessToken}`,
    ...extraHeaders
  };
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function restRequest<T>(query: Record<string, string>, init?: RequestInit): Promise<SupabaseAppStateResult<T>> {
  const unavailable = unavailableMessage();
  if (unavailable) return { status: "unavailable", message: unavailable };

  const headers = authHeaders(init?.headers);
  if (!headers) return { status: "unavailable", message: "Supabase sign-in required for app state persistence." };

  try {
    const response = await fetch(buildRestUrl(query), { ...init, headers });
    if (!response.ok) return { status: "error", message: await readErrorMessage(response) };
    if (response.status === 204) return { status: "ok", data: undefined as T };
    return { status: "ok", data: (await response.json()) as T };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Supabase app state persistence failed." };
  }
}

export async function fetchSupabaseAppStateItem<T>(key: string): Promise<SupabaseAppStateResult<T | undefined>> {
  const result = await restRequest<AppStateRow[]>(
    {
      select: "key,value",
      key: `eq.${key}`,
      limit: "1"
    }
  );
  if (result.status !== "ok") return result;
  return { status: "ok", data: result.data[0]?.value as T | undefined };
}

export async function persistSupabaseAppStateItem<T>(key: string, value: T): Promise<SupabaseAppStateResult> {
  return restRequest(
    { on_conflict: "key" },
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({ key, value })
    }
  );
}

export async function deleteSupabaseAppStateItem(key: string): Promise<SupabaseAppStateResult> {
  return restRequest(
    { key: `eq.${key}` },
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal"
      }
    }
  );
}
