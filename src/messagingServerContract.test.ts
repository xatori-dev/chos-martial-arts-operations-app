import { describe, expect, it } from "vitest";
import type { TwilioRelayPayload } from "./types";
import {
  buildChoMessagingServerHealthResponse,
  buildChoMessagingServerPushSubscriptionSyncPlan,
  buildChoMessagingServerRelayPlan,
  buildChoMessagingServerTwilioWebhookPlan
} from "./messagingServerContract";
import { createTwilioFormWebhookSignature, validateTwilioRelayHealthResponseForBrowser } from "./twilioRelayContract";

const managerAccount = {
  email: "manager123@chos.prototype",
  role: "staff" as const,
  access: ["messages"]
};

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
      id: "message-family-sale",
      to: "+12625550101",
      body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
      recipientName: "Mina Nguyen",
      recipientRole: "parent",
      recipientId: "parent-student-ari",
      kind: "marketing",
      campaignId: "campaign-family-sale",
      createdAt: "2026-06-03T18:00:00.000Z",
      smsEncoding: "GSM-7",
      smsUnitCount: 58,
      smsSegmentCount: 1,
      optOutLanguageDetected: true,
      idempotencyKey: "chos-message-family-sale-12625550101",
      statusCallbackPath: "/api/messages/status/message-family-sale"
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

const validPushSubscriptionPayload = {
  schemaVersion: "chos-web-push-subscription.v1",
  provider: "web-push",
  deliveryMode: "server-push",
  generatedAt: "2026-06-03T18:00:00.000Z",
  requestedBy: {
    email: "parent123@chos.prototype",
    role: "guardian"
  },
  notificationUrl: "https://cho.example.com/chos-martial-arts-prototype/",
  pushSubscribedAt: "2026-06-03T18:00:00.000Z",
  subscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/parent-device",
    expirationTime: null,
    keys: {
      p256dh: "public-browser-push-key",
      auth: "browser-push-auth-secret"
    }
  }
};

describe("messaging server contract", () => {
  it("builds a credential-free Twilio relay health response for browser readiness checks", () => {
    const health = buildChoMessagingServerHealthResponse({
      checkedAt: "2026-06-03T18:30:00.000Z",
      readinessChecks: {
        managerAuth: true,
        twilioCredentials: true,
        senderConfigured: true,
        complianceReady: true,
        webhookSignatureValidation: true,
        relayCanSend: true
      }
    });

    expect(health).toEqual({
      status: "ready",
      checkedAt: "2026-06-03T18:30:00.000Z",
      readinessChecks: {
        managerAuth: true,
        twilioCredentials: true,
        senderConfigured: true,
        complianceReady: true,
        webhookSignatureValidation: true,
        relayCanSend: true
      }
    });
    expect(JSON.stringify(health)).not.toMatch(/TWILIO_AUTH_TOKEN|API_SECRET|PRIVATE_KEY|super-secret/i);
    expect(validateTwilioRelayHealthResponseForBrowser(health).ok).toBe(true);
  });

  it("builds an authenticated private relay send plan only when the server session matches the payload manager", () => {
    const plan = buildChoMessagingServerRelayPlan({
      method: "POST",
      credentialsIncluded: true,
      csrfVerified: true,
      authenticatedAccount: managerAccount,
      payload: validRelayPayload,
      twilio: {
        accountSid: "test-account-sid",
        apiKeySid: "test-api-key-sid",
        apiKeySecret: "super-secret",
        messagingServiceSid: "test-messaging-service-sid",
        consentEvidence: validConsentEvidence,
        origin: "https://relay.chos.example",
        maxMessages: 50,
        maxSegmentsPerMessage: 3
      }
    });

    expect(plan.ok).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.authenticatedAccount).toEqual({
      email: "manager123@chos.prototype",
      role: "staff"
    });
    expect(plan.relayExecutionPlan.ok).toBe(true);
    expect(plan.relayExecutionPlan.requests).toHaveLength(1);

    const mismatchedPlan = buildChoMessagingServerRelayPlan({
      method: "POST",
      credentialsIncluded: true,
      csrfVerified: true,
      authenticatedAccount: {
        email: "other-manager@chos.prototype",
        role: "staff",
        access: ["messages"]
      },
      payload: validRelayPayload,
      twilio: {
        accountSid: "test-account-sid",
        apiKeySid: "test-api-key-sid",
        apiKeySecret: "super-secret",
        messagingServiceSid: "test-messaging-service-sid",
        consentEvidence: validConsentEvidence,
        origin: "https://relay.chos.example"
      }
    });

    expect(mismatchedPlan.ok).toBe(false);
    expect(mismatchedPlan.relayExecutionPlan.requests).toEqual([]);
    expect(mismatchedPlan.errors).toEqual(expect.arrayContaining([
      "Relay payload requestedBy must match the authenticated manager session."
    ]));
  });

  it("adds durable relay dispatch planning to the authenticated Twilio server plan", () => {
    const plan = buildChoMessagingServerRelayPlan({
      method: "POST",
      credentialsIncluded: true,
      csrfVerified: true,
      authenticatedAccount: managerAccount,
      payload: validRelayPayload,
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
            relayIdempotencyKey: "chos-message-family-sale-12625550101",
            messageId: "message-family-sale",
            status: "sent",
            reservedAt: "2026-06-03T18:10:00.000Z",
            result: {
              id: "message-family-sale",
              deliveryStatus: "sent",
              deliveryProviderMessageId: "test-message-sid-1",
              sentAt: "2026-06-03T18:11:00.000Z"
            }
          }
        ]
      }
    });

    expect(plan.ok).toBe(true);
    expect(plan.relayDispatchPlan.ok).toBe(true);
    expect(plan.relayDispatchPlan.requestsToSend).toEqual([]);
    expect(plan.relayDispatchPlan.attemptsToReserve).toEqual([]);
    expect(plan.relayDispatchPlan.replayResults).toEqual([
      expect.objectContaining({
        id: "message-family-sale",
        deliveryStatus: "sent",
        deliveryProviderMessageId: "test-message-sid-1"
      })
    ]);
  });

  it("blocks the authenticated Twilio server plan when relay dispatch finds an in-flight duplicate", () => {
    const plan = buildChoMessagingServerRelayPlan({
      method: "POST",
      credentialsIncluded: true,
      csrfVerified: true,
      authenticatedAccount: managerAccount,
      payload: validRelayPayload,
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
            relayIdempotencyKey: "chos-message-family-sale-12625550101",
            messageId: "message-family-sale",
            status: "sending",
            reservedAt: "2026-06-03T18:10:00.000Z"
          }
        ]
      }
    });

    expect(plan.ok).toBe(false);
    expect(plan.relayExecutionPlan.requests).toEqual([]);
    expect(plan.relayDispatchPlan.requestsToSend).toEqual([]);
    expect(plan.relayDispatchPlan.attemptsToReserve).toEqual([]);
    expect(plan.relayDispatchPlan.blocked).toEqual([
      {
        id: "message-family-sale",
        reasons: ["Relay idempotency key is already reserved by an in-flight send attempt."]
      }
    ]);
    expect(plan.errors).toEqual(expect.arrayContaining([
      "Relay dispatch blocked message-family-sale: Relay idempotency key is already reserved by an in-flight send attempt."
    ]));
  });

  it("blocks the authenticated Twilio server plan when SMS send policy rejects live sends", () => {
    const plan = buildChoMessagingServerRelayPlan({
      method: "POST",
      credentialsIncluded: true,
      csrfVerified: true,
      authenticatedAccount: managerAccount,
      payload: validRelayPayload,
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
    expect(plan.relayExecutionPlan.requests).toEqual([]);
    expect(plan.relayDispatchPlan.requestsToSend).toEqual([]);
    expect(plan.relaySendPolicyPlan.requestsToSend).toEqual([]);
    expect(plan.relaySendPolicyPlan.blocked).toEqual([
      {
        id: "message-family-sale",
        reasons: ["Current studio local time is outside the configured SMS send window 08:00-20:00."]
      }
    ]);
    expect(plan.errors).toEqual(expect.arrayContaining([
      "Relay send policy blocked message-family-sale: Current studio local time is outside the configured SMS send window 08:00-20:00."
    ]));
  });

  it("validates push subscription sync against the authenticated Cho account before server storage", () => {
    const plan = buildChoMessagingServerPushSubscriptionSyncPlan({
      method: "POST",
      credentialsIncluded: true,
      csrfVerified: true,
      authenticatedAccount: {
        email: "parent123@chos.prototype",
        role: "guardian"
      },
      payload: validPushSubscriptionPayload,
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/"
    });

    expect(plan.ok).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.subscription?.endpoint).toBe("https://fcm.googleapis.com/fcm/send/parent-device");

    const wrongAccountPlan = buildChoMessagingServerPushSubscriptionSyncPlan({
      method: "POST",
      credentialsIncluded: true,
      csrfVerified: true,
      authenticatedAccount: {
        email: "student123@chos.prototype",
        role: "student"
      },
      payload: validPushSubscriptionPayload,
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/"
    });

    expect(wrongAccountPlan.ok).toBe(false);
    expect(wrongAccountPlan.subscription).toBeUndefined();
    expect(wrongAccountPlan.errors).toEqual(expect.arrayContaining([
      "Web Push subscription requestedBy must match the authenticated Cho account."
    ]));
  });

  it("requires a valid Twilio webhook signature before normalizing inbound or status callbacks", async () => {
    const signedPlan = await buildChoMessagingServerTwilioWebhookPlan({
      kind: "status",
      method: "POST",
      authToken: "12345",
      url: "https://relay.chos.example/api/messages/status/message-ari?source=twilio%2Bstatus",
      signature: "knBS7j0Fx7x016dSwCoPp2FEcls=",
      parameters: new URLSearchParams({
        ErrorCode: "30007",
        MessageSid: "test-message-sid-2",
        MessageStatus: "failed"
      })
    });

    expect(signedPlan.ok).toBe(true);
    expect(signedPlan.errors).toEqual([]);
    expect(signedPlan.statusCallback).toEqual(expect.objectContaining({
      id: "message-ari",
      deliveryStatus: "failed",
      deliveryProviderMessageId: "test-message-sid-2"
    }));

    const unsignedPlan = await buildChoMessagingServerTwilioWebhookPlan({
      kind: "inbound",
      method: "POST",
      authToken: "12345",
      url: "https://relay.chos.example/api/messages/inbound",
      signature: "invalid-signature",
      parameters: new URLSearchParams({
        Body: "STOP",
        From: "+12625550101",
        MessageSid: "SMINBOUND1111111111111111111111111111",
        To: "+12625550000"
      })
    });

    expect(unsignedPlan.ok).toBe(false);
    expect(unsignedPlan.inboundMessage).toBeUndefined();
    expect(unsignedPlan.errors).toEqual(expect.arrayContaining([
      "Twilio webhook signature verification failed."
    ]));
  });

  it("builds signed inbound SMS consent updates only after Twilio webhook verification", async () => {
    const url = "https://relay.chos.example/api/messages/inbound";
    const parameters = new URLSearchParams({
      Body: "STOP",
      From: "+12625550101",
      MessageSid: "SMINBOUNDSTOP111111111111111111111",
      To: "+12625550000"
    });
    const signature = await createTwilioFormWebhookSignature({
      authToken: "12345",
      url,
      parameters
    });

    const plan = await buildChoMessagingServerTwilioWebhookPlan({
      kind: "inbound",
      method: "POST",
      authToken: "12345",
      url,
      signature,
      parameters,
      consentUpdate: {
        receivedAt: "2026-06-03T20:15:00.000Z",
        contacts: validConsentEvidence.contacts
      }
    });

    expect(plan.ok).toBe(true);
    expect(plan.inboundMessage).toEqual(expect.objectContaining({
      from: "+12625550101",
      keyword: "opt-out"
    }));
    expect(plan.inboundConsentUpdatePlan).toEqual(expect.objectContaining({
      ok: true,
      keyword: "opt-out",
      contactUpdates: [
        expect.objectContaining({
          contactId: "parent-student-ari",
          role: "parent",
          consentStatus: "opt-out",
          optOutAt: "2026-06-03T20:15:00.000Z"
        })
      ],
      phoneUpdate: expect.objectContaining({
        phone: "+12625550101",
        consentStatus: "opt-out"
      })
    }));
  });
});
