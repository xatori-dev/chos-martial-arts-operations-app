import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSupabaseDirectMessages, fetchSupabaseDirectMessages, isSupabaseMessagePersistenceAvailable, persistSupabaseMessageLogs } from "./supabaseMessagePersistence";
import type { MessageLog } from "./types";

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

describe("supabase message persistence adapter", () => {
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

  it("stays unavailable until a Supabase auth session exists", () => {
    expect(isSupabaseMessagePersistenceAvailable()).toBe(false);

    storeSupabaseSession();

    expect(isSupabaseMessagePersistenceAvailable()).toBe(true);
  });

  it("fetches direct messages with the signed-in manager token", async () => {
    storeSupabaseSession();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      const headers = init?.headers as Record<string, string>;

      expect(requestUrl.pathname).toBe("/rest/v1/direct_messages");
      expect(requestUrl.searchParams.get("select")).toContain("thread_id");
      expect(requestUrl.searchParams.get("order")).toBe("created_at.asc");
      expect(headers.apikey).toBe("sb_publishable_test");
      expect(headers.Authorization).toBe("Bearer manager-access-token");

      return jsonResponse([
        {
          id: "direct-1",
          thread_id: "manager__student-1",
          sender_id: "manager",
          sender_name: "Cho's Manager",
          recipient_id: "student-1",
          recipient_name: "Avery Cho",
          body: "See you at class.",
          status: "sent",
          created_at: "2026-06-16T20:00:00.000Z"
        }
      ]);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await fetchSupabaseDirectMessages();

    expect(result).toEqual({
      status: "ok",
      data: [
        {
          id: "direct-1",
          threadId: "manager__student-1",
          senderId: "manager",
          senderName: "Cho's Manager",
          recipientId: "student-1",
          recipientName: "Avery Cho",
          body: "See you at class.",
          status: "sent",
          createdAt: "2026-06-16T20:00:00.000Z"
        }
      ]
    });
  });

  it("upserts message logs through the Supabase REST API", async () => {
    storeSupabaseSession();
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => emptyResponse());
    globalThis.fetch = fetchMock as typeof fetch;
    const queuedLog: MessageLog = {
      id: "message-1",
      kind: "marketing",
      recipientName: "Avery Cho",
      recipientPhone: "555-0100",
      recipientRole: "student",
      recipientId: "student-1",
      body: "New class time tonight.",
      status: "queued",
      createdAt: "2026-06-16T20:00:00.000Z",
      deliveryChannel: "sms",
      deliveryProvider: "twilio",
      deliveryMode: "live"
    };

    await expect(persistSupabaseMessageLogs([queuedLog])).resolves.toEqual({ status: "ok", data: undefined });

    const [url, init] = fetchMock.mock.calls[0];
    const requestUrl = new URL(String(url));
    const headers = init?.headers as Record<string, string>;
    expect(requestUrl.pathname).toBe("/rest/v1/message_logs");
    expect(requestUrl.searchParams.get("on_conflict")).toBe("id");
    expect(init?.method).toBe("POST");
    expect(headers.Prefer).toBe("resolution=merge-duplicates,return=minimal");
    expect(JSON.parse(String(init?.body))).toEqual([
      {
        id: "message-1",
        kind: "marketing",
        recipient_name: "Avery Cho",
        recipient_phone: "555-0100",
        recipient_role: "student",
        recipient_id: "student-1",
        body: "New class time tonight.",
        status: "queued",
        created_at: "2026-06-16T20:00:00.000Z",
        sent_at: null,
        campaign_id: null,
        delivery_channel: "sms",
        delivery_provider: "twilio",
        delivery_mode: "live",
        delivery_status: null,
        delivery_detail: null,
        delivery_provider_message_id: null
      }
    ]);
  });

  it("deletes removed direct message rows with a compact PostgREST filter", async () => {
    storeSupabaseSession();
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => emptyResponse());
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(deleteSupabaseDirectMessages(["direct-1", "direct-1", "direct-2"])).resolves.toEqual({ status: "ok", data: undefined });

    const [url, init] = fetchMock.mock.calls[0];
    const requestUrl = new URL(String(url));
    expect(requestUrl.pathname).toBe("/rest/v1/direct_messages");
    expect(requestUrl.searchParams.get("id")).toBe('in.("direct-1","direct-2")');
    expect(init?.method).toBe("DELETE");
  });
});
