import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSupabaseAppStateItem, fetchSupabaseAppStateItem, isSupabaseAppStateRemoteBacked, persistSupabaseAppStateItem } from "./supabaseAppStatePersistence";

const originalFetch = globalThis.fetch;
const supabaseSessionStorageKey = "chos.supabase.auth.v1";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

function emptyResponse(init?: ResponseInit) {
  return new Response(null, { status: 204, ...init });
}

function storeSupabaseSession() {
  window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify({
    accessToken: "manager-access-token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    userId: "manager-user-id"
  }));
}

describe("supabase app state persistence adapter", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ENABLE_SUPABASE_IN_TESTS", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
  });

  it("is remote-backed whenever Supabase browser settings exist", () => {
    expect(isSupabaseAppStateRemoteBacked()).toBe(true);

    vi.stubEnv("VITE_SUPABASE_URL", "");

    expect(isSupabaseAppStateRemoteBacked()).toBe(false);
  });

  it("fetches app state with the signed-in Supabase token", async () => {
    storeSupabaseSession();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      const headers = init?.headers as Record<string, string>;

      expect(requestUrl.pathname).toBe("/rest/v1/app_state_items");
      expect(requestUrl.searchParams.get("select")).toBe("key,value");
      expect(requestUrl.searchParams.get("key")).toBe("eq.chos.operations.students.v1");
      expect(headers.apikey).toBe("sb_publishable_test");
      expect(headers.Authorization).toBe("Bearer manager-access-token");

      return jsonResponse([{ key: "chos.operations.students.v1", value: [{ id: "student-1" }] }]);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(fetchSupabaseAppStateItem("chos.operations.students.v1")).resolves.toEqual({
      status: "ok",
      data: [{ id: "student-1" }]
    });
  });

  it("upserts and deletes app state rows through the Supabase REST API", async () => {
    storeSupabaseSession();
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => emptyResponse());
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(persistSupabaseAppStateItem("chos.operations.classes.v1", [{ id: "class-1" }])).resolves.toEqual({ status: "ok", data: undefined });
    await expect(deleteSupabaseAppStateItem("chos.operations.classes.v1")).resolves.toEqual({ status: "ok", data: undefined });

    const [upsertUrl, upsertInit] = fetchMock.mock.calls[0];
    const upsertRequestUrl = new URL(String(upsertUrl));
    expect(upsertRequestUrl.pathname).toBe("/rest/v1/app_state_items");
    expect(upsertRequestUrl.searchParams.get("on_conflict")).toBe("key");
    expect(upsertInit?.method).toBe("POST");
    expect((upsertInit?.headers as Record<string, string>).Prefer).toBe("resolution=merge-duplicates,return=minimal");
    expect(JSON.parse(String(upsertInit?.body))).toEqual({ key: "chos.operations.classes.v1", value: [{ id: "class-1" }] });

    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1];
    const deleteRequestUrl = new URL(String(deleteUrl));
    expect(deleteRequestUrl.pathname).toBe("/rest/v1/app_state_items");
    expect(deleteRequestUrl.searchParams.get("key")).toBe("eq.chos.operations.classes.v1");
    expect(deleteInit?.method).toBe("DELETE");
  });
});
