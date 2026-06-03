import { describe, expect, it } from "vitest";
import { buildTextAutomationExecutionPlan } from "./textAutomationContract";
import type { TwilioRelayPayload } from "./types";

const validRelayPayload: TwilioRelayPayload = {
  schemaVersion: "chos-twilio-relay.v1",
  provider: "twilio",
  deliveryMode: "server-relay",
  generatedAt: "2026-06-03T18:00:00.000Z",
  requestedBy: {
    email: "manager123@chos.prototype",
    role: "staff"
  },
  messages: [
    {
      id: "message-scheduled-family-sale",
      to: "+12625550101",
      body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
      recipientName: "Mina Nguyen",
      recipientRole: "parent",
      recipientId: "parent-student-ari",
      kind: "marketing",
      campaignId: "campaign-scheduled-family-sale",
      createdAt: "2026-06-03T18:00:00.000Z",
      smsEncoding: "GSM-7",
      smsUnitCount: 58,
      smsSegmentCount: 1,
      optOutLanguageDetected: true,
      idempotencyKey: "chos-message-scheduled-family-sale-12625550101",
      statusCallbackPath: "/api/messages/status/message-scheduled-family-sale"
    }
  ]
};

const validConsentEvidence = {
  schemaVersion: "chos-sms-consent-evidence.v1",
  provider: "twilio",
  generatedAt: "2026-06-03T18:00:00.000Z",
  contacts: [
    {
      contactId: "parent-student-ari",
      role: "parent",
      name: "Mina Nguyen",
      phone: "+12625550101",
      consentStatus: "opt-in",
      consentUpdatedAt: "2026-06-01T10:00:00.000Z",
      optOutAt: null,
      evidenceSource: "prototype-consent-record"
    }
  ]
};

const validPushSubscription = {
  schemaVersion: "chos-web-push-subscription.v1",
  provider: "web-push",
  deliveryMode: "server-push",
  generatedAt: "2026-06-03T17:55:00.000Z",
  requestedBy: {
    email: "manager123@chos.prototype",
    role: "staff"
  },
  notificationUrl: "https://cho.example.com/chos-martial-arts-prototype/messages",
  subscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/manager-device",
    expirationTime: null,
    keys: {
      p256dh: "public-browser-push-key",
      auth: "browser-push-auth-secret"
    }
  }
};

describe("text automation contract", () => {
  it("builds a private schedule-runner execution plan for due promotions, Twilio relay, and Web Push", () => {
    const plan = buildTextAutomationExecutionPlan({
      now: "2026-06-03T18:00:00.000Z",
      scheduledPromotions: [
        {
          id: "scheduled-family-sale",
          title: "Family sale",
          body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
          audience: "parents",
          scheduledFor: "2026-06-03",
          scheduledTime: "17:00",
          status: "scheduled",
          createdAt: "2026-06-02T10:00:00.000Z"
        },
        {
          id: "scheduled-next-week",
          title: "Next week camp",
          body: "Summer camp registration opens next week. Reply STOP to opt out.",
          audience: "parents",
          scheduledFor: "2026-06-10",
          scheduledTime: "09:00",
          status: "scheduled",
          createdAt: "2026-06-02T11:00:00.000Z"
        },
        {
          id: "scheduled-canceled",
          title: "Canceled sale",
          body: "Canceled promotion. Reply STOP to opt out.",
          audience: "parents",
          scheduledFor: "2026-06-03",
          scheduledTime: "16:00",
          status: "canceled",
          createdAt: "2026-06-02T12:00:00.000Z"
        }
      ],
      relayPayload: validRelayPayload,
      twilio: {
        accountSid: "test-account-sid",
        apiKeySid: "test-api-key-sid",
        apiKeySecret: "super-secret",
        messagingServiceSid: "test-messaging-service-sid",
        consentEvidence: validConsentEvidence,
        origin: "https://relay.chos.example",
        maxMessages: 50,
        maxSegmentsPerMessage: 3
      },
      relayDispatch: {
        reservedAt: "2026-06-03T18:00:05.000Z"
      },
      webPushSubscriptions: [validPushSubscription],
      webPushNotification: {
        title: "Text automations queued",
        body: "1 scheduled promotion is ready for relay review.",
        url: "https://cho.example.com/chos-martial-arts-prototype/messages",
        tag: "chos-text-automation-run",
        unreadCount: 1
      },
      webPush: {
        allowedOrigin: "https://cho.example.com",
        allowedPathPrefix: "/chos-martial-arts-prototype/",
        fallbackPath: "/chos-martial-arts-prototype/messages",
        targetAccount: {
          email: "manager123@chos.prototype",
          role: "staff"
        },
        now: 1780513200000
      }
    });

    expect(plan.ok).toBe(true);
    expect(plan.serverOnly).toBe(true);
    expect(plan.runStatus).toBe("queued");
    expect(plan.errors).toEqual([]);
    expect(plan.dueScheduledPromotions).toEqual([
      expect.objectContaining({
        id: "scheduled-family-sale",
        dueKey: "scheduled-promotion:scheduled-family-sale:2026-06-03:17:00"
      })
    ]);
    expect(plan.skippedScheduledPromotions).toEqual([
      expect.objectContaining({ id: "scheduled-next-week", reason: "future" }),
      expect.objectContaining({ id: "scheduled-canceled", reason: "canceled" })
    ]);
    expect(plan.twilioRelayPlan.ok).toBe(true);
    expect(plan.twilioRelayPlan.requests).toHaveLength(1);
    expect(plan.twilioRelayDispatchPlan.ok).toBe(true);
    expect(plan.twilioRelayDispatchPlan.requestsToSend).toHaveLength(1);
    expect(plan.twilioRelayDispatchPlan.attemptsToReserve).toEqual([
      {
        relayIdempotencyKey: "chos-message-scheduled-family-sale-12625550101",
        messageId: "message-scheduled-family-sale",
        recipientName: "Mina Nguyen",
        recipientRole: "parent",
        to: "+12625550101",
        status: "reserved",
        reservedAt: "2026-06-03T18:00:05.000Z"
      }
    ]);
    expect(JSON.stringify(plan.twilioRelayDispatchPlan.attemptsToReserve)).not.toMatch(/authorization|Basic|super-secret|TWILIO/i);
    expect(plan.webPushPlan?.ok).toBe(true);
    expect(plan.webPushPlan?.requests).toHaveLength(1);
  });

  it("blocks private schedule-runner execution when relay consent or due-job validation fails", () => {
    const plan = buildTextAutomationExecutionPlan({
      now: "2026-06-03T18:00:00.000Z",
      scheduledPromotions: [
        {
          id: "scheduled-family-sale",
          title: "Family sale",
          body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
          audience: "parents",
          scheduledFor: "2026-06-03",
          scheduledTime: "17:00",
          status: "scheduled",
          createdAt: "2026-06-02T10:00:00.000Z"
        },
        {
          id: "scheduled-bad-time",
          title: "Bad time",
          body: "Invalid schedule. Reply STOP to opt out.",
          audience: "parents",
          scheduledFor: "2026-06-03",
          scheduledTime: "9 PM",
          status: "scheduled",
          createdAt: "2026-06-02T11:00:00.000Z"
        }
      ],
      relayPayload: validRelayPayload,
      twilio: {
        accountSid: "test-account-sid",
        apiKeySid: "test-api-key-sid",
        apiKeySecret: "super-secret",
        messagingServiceSid: "test-messaging-service-sid",
        origin: "https://relay.chos.example",
        maxMessages: 50,
        maxSegmentsPerMessage: 3
      }
    });

    expect(plan.ok).toBe(false);
    expect(plan.runStatus).toBe("blocked");
    expect(plan.twilioRelayPlan.ok).toBe(false);
    expect(plan.errors).toEqual(expect.arrayContaining([
      "Twilio relay execution plan requires SMS consent evidence before live send.",
      "Scheduled promotion scheduled-bad-time has invalid schedule metadata."
    ]));
  });

  it("blocks private schedule-runner execution when relay dispatch finds an in-flight duplicate", () => {
    const plan = buildTextAutomationExecutionPlan({
      now: "2026-06-03T18:00:00.000Z",
      scheduledPromotions: [
        {
          id: "scheduled-family-sale",
          title: "Family sale",
          body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
          audience: "parents",
          scheduledFor: "2026-06-03",
          scheduledTime: "17:00",
          status: "scheduled",
          createdAt: "2026-06-02T10:00:00.000Z"
        }
      ],
      relayPayload: validRelayPayload,
      twilio: {
        accountSid: "test-account-sid",
        apiKeySid: "test-api-key-sid",
        apiKeySecret: "super-secret",
        messagingServiceSid: "test-messaging-service-sid",
        consentEvidence: validConsentEvidence,
        origin: "https://relay.chos.example",
        maxMessages: 50,
        maxSegmentsPerMessage: 3
      },
      relayDispatch: {
        existingAttempts: [
          {
            relayIdempotencyKey: "chos-message-scheduled-family-sale-12625550101",
            messageId: "message-scheduled-family-sale",
            status: "sending",
            reservedAt: "2026-06-03T17:59:00.000Z"
          }
        ]
      }
    });

    expect(plan.ok).toBe(false);
    expect(plan.runStatus).toBe("blocked");
    expect(plan.twilioRelayPlan.requests).toEqual([]);
    expect(plan.twilioRelayDispatchPlan.requestsToSend).toEqual([]);
    expect(plan.twilioRelayDispatchPlan.attemptsToReserve).toEqual([]);
    expect(plan.twilioRelayDispatchPlan.blocked).toEqual([
      {
        id: "message-scheduled-family-sale",
        reasons: ["Relay idempotency key is already reserved by an in-flight send attempt."]
      }
    ]);
    expect(plan.errors).toEqual(expect.arrayContaining([
      "Relay dispatch blocked message-scheduled-family-sale: Relay idempotency key is already reserved by an in-flight send attempt."
    ]));
  });

  it("blocks private schedule-runner execution when SMS send policy rejects the relay batch", () => {
    const plan = buildTextAutomationExecutionPlan({
      now: "2026-06-03T07:30:00.000Z",
      scheduledPromotions: [
        {
          id: "scheduled-family-sale",
          title: "Family sale",
          body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
          audience: "parents",
          scheduledFor: "2026-06-03",
          scheduledTime: "07:00",
          status: "scheduled",
          createdAt: "2026-06-02T10:00:00.000Z"
        }
      ],
      relayPayload: validRelayPayload,
      twilio: {
        accountSid: "test-account-sid",
        apiKeySid: "test-api-key-sid",
        apiKeySecret: "super-secret",
        messagingServiceSid: "test-messaging-service-sid",
        consentEvidence: validConsentEvidence,
        origin: "https://relay.chos.example",
        maxMessages: 50,
        maxSegmentsPerMessage: 3
      },
      relaySendPolicy: {
        now: "2026-06-03T07:30:00.000Z",
        localTime: "07:30",
        allowedSendWindow: {
          start: "08:00",
          end: "20:00",
          label: "studio local time"
        }
      }
    });

    expect(plan.ok).toBe(false);
    expect(plan.runStatus).toBe("blocked");
    expect(plan.twilioRelayPlan.requests).toEqual([]);
    expect(plan.twilioRelayDispatchPlan.requestsToSend).toEqual([]);
    expect(plan.twilioRelaySendPolicyPlan.requestsToSend).toEqual([]);
    expect(plan.twilioRelaySendPolicyPlan.blocked).toEqual([
      {
        id: "message-scheduled-family-sale",
        reasons: ["Current studio local time is outside the configured SMS send window 08:00-20:00."]
      }
    ]);
  });
});
