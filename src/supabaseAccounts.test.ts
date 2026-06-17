import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSupabaseAuthSession,
  createSupabaseManagedAccount,
  getSupabaseBrowserConfig,
  isSupabaseAuthConfigured,
  isChoSupabaseProjectUrlAllowed,
  normalizeSupabaseUsername,
  signInSupabaseAccount,
  supabaseProjectRefFromUrl,
  supabaseAuthEmailForUsername
} from "./supabaseAccounts";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("supabase account adapter", () => {
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

  it("normalizes local usernames and maps Manager123 to the owner Auth email", () => {
    expect(normalizeSupabaseUsername(" Jordan Staff! ")).toBe("jordan.staff");
    expect(supabaseAuthEmailForUsername("Manager123")).toBe("manager123@accounts.chosmartialarts.app");
    expect(supabaseAuthEmailForUsername("Jordan Staff")).toBe("jordan.staff@accounts.chosmartialarts.app");
  });

  it("reports not configured when no browser Supabase settings exist", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    expect(isSupabaseAuthConfigured()).toBe(false);
  });

  it("keeps Cho's Supabase configuration separated from the MongTeng project", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://jqvclzlvrhdcsfhhvekr.supabase.co");

    expect(supabaseProjectRefFromUrl("https://zfuwbbepsnmmlpgfkmhz.supabase.co")).toBe("zfuwbbepsnmmlpgfkmhz");
    expect(isChoSupabaseProjectUrlAllowed("https://zfuwbbepsnmmlpgfkmhz.supabase.co")).toBe(true);
    expect(isChoSupabaseProjectUrlAllowed("https://jqvclzlvrhdcsfhhvekr.supabase.co")).toBe(false);
    expect(getSupabaseBrowserConfig()).toEqual({ url: "", publicKey: "" });
    expect(isSupabaseAuthConfigured()).toBe(false);
    await expect(signInSupabaseAccount({ username: "Manager123", password: "ManagerPass123!" })).resolves.toEqual({ status: "not-configured" });
  });

  it("signs in with password, loads the profile, and stores the JWT for function calls", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "manager-access-token",
          refresh_token: "manager-refresh-token",
          expires_in: 3600,
          user: { id: "manager-user-id", email: "manager123@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([
          {
            id: "manager-user-id",
            username: "manager123",
            contact_email: "manager123@chos.prototype",
            display_name: "Cho's Manager",
            role: "staff",
            status: "active",
            phone: null,
            title: "Head Coach",
            notes: null,
            access: ["dashboard"],
            student_id: null,
            created_by: "manager-user-id",
            created_at: "2026-06-09T00:00:00.000Z"
          }
        ]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await signInSupabaseAccount({ username: "Manager123", password: "ManagerPass123!" });

    expect(result).toMatchObject({
      status: "authenticated",
      sessionEmail: "manager123@chos.prototype",
      role: "staff"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "manager123@accounts.chosmartialarts.app", password: "ManagerPass123!" })
      })
    );
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toContain("manager-access-token");
  });

  it("rejects active Supabase staff profiles that are not the manager owner", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "staff-access-token",
          expires_in: 3600,
          user: { id: "staff-user-id", email: "jordan.staff@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([
          {
            id: "staff-user-id",
            username: "jordan.staff",
            contact_email: "jordan@example.com",
            display_name: "Jordan Lee",
            role: "staff",
            status: "active",
            phone: null,
            title: null,
            notes: null,
            access: ["dashboard"],
            student_id: null,
            created_by: "manager-user-id",
            created_at: "2026-06-09T00:00:00.000Z"
          }
        ]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(signInSupabaseAccount({ username: "jordan.staff", password: "StaffPass123!" })).resolves.toEqual({ status: "invalid" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem("chos.supabase.auth.v1")).toBeNull();
  });

  it("does not send retired staff account creation through the Edge Function", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/auth/v1/token")) {
        return jsonResponse({
          access_token: "manager-access-token",
          expires_in: 3600,
          user: { id: "manager-user-id", email: "manager123@accounts.chosmartialarts.app" }
        });
      }
      if (requestUrl.includes("/rest/v1/profiles")) {
        return jsonResponse([
          {
            id: "manager-user-id",
            username: "manager123",
            contact_email: "manager123@chos.prototype",
            display_name: "Cho's Manager",
            role: "staff",
            status: "active",
            phone: null,
            title: null,
            notes: null,
            access: ["dashboard"],
            student_id: null,
            created_by: "manager-user-id",
            created_at: "2026-06-09T00:00:00.000Z"
          }
        ]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await signInSupabaseAccount({ username: "Manager123", password: "ManagerPass123!" });
    const result = await createSupabaseManagedAccount({
      displayName: "Jordan Lee",
      username: "jordan.staff",
      password: "StaffPass123!",
      role: "staff",
      email: "jordan@example.com",
      access: ["dashboard"]
    });

    expect(result).toMatchObject({
      status: "error",
      message: "Managed staff account creation is retired. Only Manager123 and Dev123 sign-ins are supported."
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    clearSupabaseAuthSession();
    expect(await createSupabaseManagedAccount({
      displayName: "No Session",
      username: "no.session",
      password: "StaffPass123!",
      role: "staff",
      email: "no-session@example.com"
    })).toEqual({
      status: "error",
      message: "Managed staff account creation is retired. Only Manager123 and Dev123 sign-ins are supported."
    });
  });
});
