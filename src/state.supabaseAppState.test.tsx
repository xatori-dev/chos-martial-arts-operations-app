import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildOperationsBackupSnapshot, type OperationsBackupInput } from "./operationsBackup";
import { AppStateProvider, useAppState } from "./state";

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

function Harness() {
  const { accounts, addOperationsStudent, managedAccounts, students } = useAppState();
  return (
    <div>
      <p data-testid="students">{students.map((student) => student.id).join(",")}</p>
      <p data-testid="credential-counts">{accounts.length}:{managedAccounts.length}</p>
      <button
        type="button"
        onClick={() => addOperationsStudent({
          fullName: "New Student",
          studentEmail: "new.student@example.test",
          guardianName: "New Parent",
          guardianPhone: "(262) 555-0199",
          guardianEmail: "new.parent@example.test",
          beltRank: "White",
          program: "Youth Taekwondo"
        })}
      >
        Add Student
      </button>
    </div>
  );
}

function makeBackupInput(overrides: Partial<OperationsBackupInput> = {}): OperationsBackupInput {
  return {
    accounts: [],
    accountRoles: [],
    managedAccounts: [],
    childAccounts: [],
    students: [],
    studioClasses: [],
    scheduledClasses: [],
    messageCampaigns: [],
    scheduledTextCampaigns: [],
    messageLogs: [],
    automationRuns: [],
    directMessages: [],
    messagingSetup: [],
    studioEvents: [],
    merchandiseItems: [],
    checkIns: [],
    trainingVideoFolders: [],
    trainingVideos: [],
    studyGuideFolders: [],
    studyGuideMaterials: [],
    orders: [],
    bookings: [],
    contacts: [],
    leadReviews: [],
    ...overrides
  };
}

function RestoreMessagingSetupHarness({ rawBackup }: { rawBackup: string }) {
  const { restoreOperationsBackup } = useAppState();
  return (
    <button type="button" onClick={() => restoreOperationsBackup(rawBackup)}>
      Restore messaging setup
    </button>
  );
}

describe("Supabase-backed app state provider", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ENABLE_SUPABASE_IN_TESTS", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    window.localStorage.clear();
    window.sessionStorage.clear();
    storeSupabaseSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("hydrates business state from Supabase, removes stale local credentials, and persists updates remotely", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([{ id: "local-student" }]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([{ username: "stale.staff", password: "LocalPass123!" }]));
    window.localStorage.setItem("chos.accounts.v1", JSON.stringify([{ email: "stale.parent", password: "LocalPass123!" }]));
    const remoteStudent = {
      id: "student-remote",
      firstName: "Remote",
      lastName: "Student",
      phone: "(262) 555-0100",
      email: "remote.student@example.test",
      guardianPhone: "(262) 555-0100",
      enrollmentDate: "2026-06-17",
      program: "Youth Taekwondo",
      status: "Active",
      beltRank: "White",
      profileUpdatedAt: "2026-06-17",
      joinedAt: "2026-06-17",
      classesAttended: 0,
      missedClassCount: 0
    };
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/app_state_items") {
        if (init?.method === "POST") return emptyResponse();
        const requestedKey = requestUrl.searchParams.get("key")?.replace(/^eq\./, "");
        if (requestedKey === "chos.operations.students.v1") {
          return jsonResponse([{ key: requestedKey, value: [remoteStudent] }]);
        }
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/direct_messages" || requestUrl.pathname === "/rest/v1/message_logs") {
        return jsonResponse([]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(
      <AppStateProvider>
        <Harness />
      </AppStateProvider>
    );

    expect((await screen.findByTestId("students")).textContent).toContain("student-remote");
    expect(screen.getByTestId("credential-counts").textContent).toBe("0:0");
    await waitFor(() => expect(window.localStorage.getItem("chos.operations.students.v1")).toBeNull());
    expect(window.localStorage.getItem("chos.managedAccounts.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.accounts.v1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add Student" }));

    await waitFor(() => {
      const studentUpserts = fetchMock.mock.calls
        .map(([, init]) => init)
        .filter((init): init is RequestInit => init?.method === "POST" && String(init.body).includes("\"key\":\"chos.operations.students.v1\""));
      expect(studentUpserts.length).toBeGreaterThan(0);
      const latestBody = JSON.parse(String(studentUpserts.at(-1)?.body));
      expect(latestBody.value).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "student-remote" }),
        expect.objectContaining({ firstName: "New", lastName: "Student" })
      ]));
    });
    expect(window.localStorage.getItem("chos.operations.students.v1")).toBeNull();
  });

  it("restores production messaging setup into Supabase app state instead of local storage", async () => {
    window.localStorage.setItem("chos.operations.twilioRelayEndpoint.v1", "https://local.example.test/relay");
    window.localStorage.setItem("chos.operations.pushServerEndpoint.v1", "https://local.example.test/push");
    window.localStorage.setItem("chos.operations.twilioLaunchProfile.v1", JSON.stringify({ messagingServiceSid: "MG_LOCAL" }));
    const backup = buildOperationsBackupSnapshot(
      makeBackupInput({
        messagingSetup: [
          {
            id: "production-messaging",
            twilioRelayEndpoint: "https://relay.example.test/api/messages/twilio",
            pushServerEndpoint: "https://push.example.test/api/push/subscriptions",
            webPushPublicKey: "BO_PUBLIC_WEB_PUSH_KEY",
            twilioLaunchProfile: {
              messagingServiceSid: "MG1234567890abcdef",
              smsSender: "+12625550100",
              inboundWebhookUrl: "https://relay.example.test/api/messages/inbound",
              statusCallbackBaseUrl: "https://relay.example.test/api/messages/status",
              relayHealthCheckUrl: "https://relay.example.test/api/messages/health",
              managerAuthMode: "server-session",
              senderType: "10dlc",
              a2pBrandStatus: "approved",
              a2pCampaignStatus: "approved",
              tollFreeVerificationStatus: "not-used",
              complianceNotes: "A2P approved for studio outreach.",
              savedAt: "2026-06-03T10:15:00.000Z"
            }
          }
        ]
      }),
      "2026-06-03T12:00:00.000Z"
    );
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/rest/v1/app_state_items") {
        if (init?.method === "POST" || init?.method === "DELETE") return emptyResponse();
        return jsonResponse([]);
      }
      if (requestUrl.pathname === "/rest/v1/direct_messages" || requestUrl.pathname === "/rest/v1/message_logs") {
        return jsonResponse([]);
      }
      return jsonResponse({ error: "Unexpected URL" }, { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(
      <AppStateProvider>
        <RestoreMessagingSetupHarness rawBackup={JSON.stringify(backup)} />
      </AppStateProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Restore messaging setup" }));

    await waitFor(() => {
      const upsertBodies = fetchMock.mock.calls
        .map(([, init]) => init)
        .filter((init): init is RequestInit => init?.method === "POST")
        .map((init) => JSON.parse(String(init.body))) as Array<{ key: string; value: unknown }>;
      expect(upsertBodies).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: "chos.operations.twilioRelayEndpoint.v1",
          value: "https://relay.example.test/api/messages/twilio"
        }),
        expect.objectContaining({
          key: "chos.operations.pushServerEndpoint.v1",
          value: "https://push.example.test/api/push/subscriptions"
        }),
        expect.objectContaining({
          key: "chos.operations.twilioLaunchProfile.v1",
          value: expect.objectContaining({
            messagingServiceSid: "MG1234567890abcdef",
            managerAuthMode: "server-session",
            senderType: "10dlc"
          })
        })
      ]));
    });
    expect(window.localStorage.getItem("chos.operations.twilioRelayEndpoint.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.operations.pushServerEndpoint.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.operations.twilioLaunchProfile.v1")).toBeNull();
  });
});
