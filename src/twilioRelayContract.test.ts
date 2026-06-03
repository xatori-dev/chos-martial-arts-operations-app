import { describe, expect, it } from "vitest";
import type { TwilioRelayPayload } from "./types";
import {
  buildTwilioRelayDispatchPlan,
  buildTwilioInboundConsentUpdatePlanForServer,
  buildTwilioRelayResultFromProviderResponse,
  buildTwilioRelaySendPolicyPlan,
  buildTwilioRelayExecutionPlan,
  buildTwilioMessageRequest,
  createTwilioFormWebhookSignature,
  normalizeTwilioMessageCreateResponseForServer,
  normalizeTwilioInboundSmsWebhookForServer,
  normalizeTwilioStatusCallbackForServer,
  validateTwilioFormWebhookSignature,
  validateTwilioRelayConsentEvidenceForServer,
  validateTwilioRelayHealthResponseForBrowser,
  validateTwilioRelayPayloadForServer
} from "./twilioRelayContract";

const validRelayPayload: TwilioRelayPayload = {
  schemaVersion: "chos-twilio-relay.v1",
  provider: "twilio",
  deliveryMode: "server-relay",
  generatedAt: "2026-06-03T14:00:00.000Z",
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
      createdAt: "2026-06-03T13:00:00.000Z",
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
  generatedAt: "2026-06-03T14:10:00.000Z",
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

describe("twilio relay contract", () => {
  it("accepts a manager-authenticated Cho relay payload and builds a Twilio Messages request", () => {
    const result = validateTwilioRelayPayloadForServer(validRelayPayload, {
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    expect(result.ok).toBe(true);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toEqual([]);
    expect(result.errors).toEqual([]);

    const request = buildTwilioMessageRequest(result.accepted[0].message, {
      accountSid: "test-account-sid",
      messagingServiceSid: "test-messaging-service-sid",
      origin: "https://relay.chos.example"
    });

    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://api.twilio.com/2010-04-01/Accounts/test-account-sid/Messages.json");
    expect(request.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({
      To: "+12625550101",
      Body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
      MessagingServiceSid: "test-messaging-service-sid",
      StatusCallback: "https://relay.chos.example/api/messages/status/message-family-sale"
    });
    expect(result.accepted[0].message.idempotencyKey).toBe("chos-message-family-sale-12625550101");
  });

  it("builds a Twilio Messages request with an approved From sender when no Messaging Service is configured", () => {
    const request = buildTwilioMessageRequest(validRelayPayload.messages[0], {
      accountSid: "test-account-sid",
      messagingServiceSid: "",
      fromNumber: "+12625550100",
      origin: "https://relay.chos.example"
    } as Parameters<typeof buildTwilioMessageRequest>[1] & { fromNumber: string });

    const body = Object.fromEntries(new URLSearchParams(request.body));
    expect(body).toEqual({
      To: "+12625550101",
      Body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
      From: "+12625550100",
      StatusCallback: "https://relay.chos.example/api/messages/status/message-family-sale"
    });
    expect(body).not.toHaveProperty("MessagingServiceSid");
  });

  it("builds a server-only Twilio Basic auth header with production API keys", async () => {
    const contract = await import("./twilioRelayContract");
    const buildTwilioBasicAuthHeader = (contract as unknown as {
      buildTwilioBasicAuthHeader?: (config: {
        accountSid: string;
        authToken?: string;
        apiKeySid?: string;
        apiKeySecret?: string;
      }) => string;
    }).buildTwilioBasicAuthHeader;

    expect(buildTwilioBasicAuthHeader).toBeTypeOf("function");
    expect(buildTwilioBasicAuthHeader?.({
      accountSid: "test-account-sid",
      authToken: "account-auth-token",
      apiKeySid: "test-api-key-sid",
      apiKeySecret: "super-secret"
    })).toBe("Basic dGVzdC1hcGkta2V5LXNpZDpzdXBlci1zZWNyZXQ=");
  });

  it("builds a server-only Twilio relay execution plan from a validated batch", () => {
    const plan = buildTwilioRelayExecutionPlan(validRelayPayload, {
      accountSid: "test-account-sid",
      apiKeySid: "test-api-key-sid",
      apiKeySecret: "super-secret",
      messagingServiceSid: "test-messaging-service-sid",
      consentEvidence: validConsentEvidence,
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    expect(plan.ok).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.validation.ok).toBe(true);
    expect(plan.consentValidation.ok).toBe(true);
    expect(plan.requests).toHaveLength(1);
    expect(plan.requests[0]).toEqual(expect.objectContaining({
      messageId: "message-family-sale",
      relayIdempotencyKey: "chos-message-family-sale-12625550101",
      recipientRole: "parent",
      to: "+12625550101",
      authorizationHeader: "Basic dGVzdC1hcGkta2V5LXNpZDpzdXBlci1zZWNyZXQ="
    }));
    expect(plan.requests[0].request.method).toBe("POST");
    expect(plan.requests[0].request.url).toBe("https://api.twilio.com/2010-04-01/Accounts/test-account-sid/Messages.json");
    expect(plan.requests[0].request.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(Object.fromEntries(new URLSearchParams(plan.requests[0].request.body))).toEqual({
      To: "+12625550101",
      Body: "Family gear sale starts at 5 PM. Reply STOP to opt out.",
      MessagingServiceSid: "test-messaging-service-sid",
      StatusCallback: "https://relay.chos.example/api/messages/status/message-family-sale"
    });
  });

  it("builds a relay dispatch plan that reserves new attempts and replays completed idempotency results", () => {
    const secondMessage = {
      ...validRelayPayload.messages[0],
      id: "message-staff-reminder",
      to: "+12625552101",
      body: "Staff reminder: family night starts at 5 PM. Reply STOP to opt out.",
      recipientName: "Coach Kim",
      recipientRole: "staff" as const,
      recipientId: "staff-kim",
      campaignId: "campaign-family-sale",
      idempotencyKey: "chos-message-staff-reminder-12625552101",
      statusCallbackPath: "/api/messages/status/message-staff-reminder"
    };
    const plan = buildTwilioRelayExecutionPlan({
      ...validRelayPayload,
      messages: [validRelayPayload.messages[0], secondMessage]
    }, {
      accountSid: "test-account-sid",
      apiKeySid: "test-api-key-sid",
      apiKeySecret: "super-secret",
      messagingServiceSid: "test-messaging-service-sid",
      consentEvidence: {
        ...validConsentEvidence,
        contacts: [
          ...validConsentEvidence.contacts,
          {
            contactId: "staff-kim",
            role: "staff",
            name: "Coach Kim",
            phone: "+12625552101",
            consentStatus: "opt-in",
            consentUpdatedAt: "2026-06-02T10:00:00.000Z",
            evidenceSource: "prototype-consent-record"
          }
        ]
      },
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    const dispatchPlan = buildTwilioRelayDispatchPlan(plan, {
      reservedAt: "2026-06-03T19:00:00.000Z",
      existingAttempts: [
        {
          relayIdempotencyKey: "chos-message-family-sale-12625550101",
          messageId: "message-family-sale",
          status: "sent",
          reservedAt: "2026-06-03T18:55:00.000Z",
          result: {
            id: "message-family-sale",
            deliveryStatus: "sent",
            deliveryProviderMessageId: "test-message-sid-1",
            sentAt: "2026-06-03T18:56:00.000Z"
          }
        }
      ]
    });

    expect(dispatchPlan.ok).toBe(true);
    expect(dispatchPlan.errors).toEqual([]);
    expect(dispatchPlan.replayResults).toEqual([
      expect.objectContaining({ id: "message-family-sale", deliveryStatus: "sent", deliveryProviderMessageId: "test-message-sid-1" })
    ]);
    expect(dispatchPlan.requestsToSend).toHaveLength(1);
    expect(dispatchPlan.requestsToSend[0]).toEqual(expect.objectContaining({
      messageId: "message-staff-reminder",
      relayIdempotencyKey: "chos-message-staff-reminder-12625552101",
      to: "+12625552101"
    }));
    expect(dispatchPlan.attemptsToReserve).toEqual([
      {
        relayIdempotencyKey: "chos-message-staff-reminder-12625552101",
        messageId: "message-staff-reminder",
        recipientName: "Coach Kim",
        recipientRole: "staff",
        to: "+12625552101",
        status: "reserved",
        reservedAt: "2026-06-03T19:00:00.000Z"
      }
    ]);
    expect(JSON.stringify(dispatchPlan.attemptsToReserve)).not.toMatch(/authorization|Basic|super-secret|TWILIO/i);
  });

  it("blocks in-flight relay idempotency reservations before duplicate Twilio sends", () => {
    const plan = buildTwilioRelayExecutionPlan(validRelayPayload, {
      accountSid: "test-account-sid",
      apiKeySid: "test-api-key-sid",
      apiKeySecret: "super-secret",
      messagingServiceSid: "test-messaging-service-sid",
      consentEvidence: validConsentEvidence,
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    const dispatchPlan = buildTwilioRelayDispatchPlan(plan, {
      existingAttempts: [
        {
          relayIdempotencyKey: "chos-message-family-sale-12625550101",
          messageId: "message-family-sale",
          status: "sending",
          reservedAt: "2026-06-03T18:59:00.000Z"
        }
      ]
    });

    expect(dispatchPlan.ok).toBe(false);
    expect(dispatchPlan.requestsToSend).toEqual([]);
    expect(dispatchPlan.attemptsToReserve).toEqual([]);
    expect(dispatchPlan.blocked).toEqual([
      {
        id: "message-family-sale",
        reasons: ["Relay idempotency key is already reserved by an in-flight send attempt."]
      }
    ]);
  });

  it("blocks Twilio sends outside the configured local SMS send window", () => {
    const plan = buildTwilioRelayExecutionPlan(validRelayPayload, {
      accountSid: "test-account-sid",
      apiKeySid: "test-api-key-sid",
      apiKeySecret: "super-secret",
      messagingServiceSid: "test-messaging-service-sid",
      consentEvidence: validConsentEvidence,
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    const policyPlan = buildTwilioRelaySendPolicyPlan(plan, {
      now: "2026-06-03T07:30:00.000Z",
      localTime: "07:30",
      allowedSendWindow: {
        start: "08:00",
        end: "20:00",
        label: "studio local time"
      }
    });

    expect(policyPlan.ok).toBe(false);
    expect(policyPlan.requestsToSend).toEqual([]);
    expect(policyPlan.blocked).toEqual([
      {
        id: "message-family-sale",
        reasons: ["Current studio local time is outside the configured SMS send window 08:00-20:00."]
      }
    ]);
  });

  it("blocks Twilio sends when a recipient has reached the configured daily SMS limit", () => {
    const plan = buildTwilioRelayExecutionPlan(validRelayPayload, {
      accountSid: "test-account-sid",
      apiKeySid: "test-api-key-sid",
      apiKeySecret: "super-secret",
      messagingServiceSid: "test-messaging-service-sid",
      consentEvidence: validConsentEvidence,
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    const policyPlan = buildTwilioRelaySendPolicyPlan(plan, {
      now: "2026-06-03T19:30:00.000Z",
      maxMessagesPerPhonePerDay: 1,
      recentSends: [
        {
          to: "+12625550101",
          sentAt: "2026-06-03T18:00:00.000Z",
          messageId: "previous-family-sale"
        }
      ]
    });

    expect(policyPlan.ok).toBe(false);
    expect(policyPlan.blocked).toEqual([
      {
        id: "message-family-sale",
        reasons: ["Recipient has reached the configured daily SMS limit of 1."]
      }
    ]);
  });

  it("validates relay recipients against explicit SMS consent evidence before live Twilio send", () => {
    const result = validateTwilioRelayConsentEvidenceForServer(validRelayPayload, validConsentEvidence);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toEqual([
      expect.objectContaining({
        message: expect.objectContaining({
          id: "message-family-sale",
          recipientId: "parent-student-ari",
          to: "+12625550101"
        }),
        consent: expect.objectContaining({
          contactId: "parent-student-ari",
          consentStatus: "opt-in",
          consentUpdatedAt: "2026-06-01T10:00:00.000Z"
        })
      })
    ]);
  });

  it("rejects relay recipients with missing, unknown, or opted-out SMS consent evidence", () => {
    const payload = {
      ...validRelayPayload,
      messages: [
        {
          ...validRelayPayload.messages[0],
          id: "message-missing-consent",
          recipientId: "parent-student-missing",
          to: "+12625550102",
          statusCallbackPath: "/api/messages/status/message-missing-consent"
        },
        {
          ...validRelayPayload.messages[0],
          id: "message-unknown-consent",
          recipientId: "parent-student-unknown",
          to: "+12625550103",
          statusCallbackPath: "/api/messages/status/message-unknown-consent"
        },
        {
          ...validRelayPayload.messages[0],
          id: "message-opted-out",
          recipientId: "parent-student-opted-out",
          to: "+12625550104",
          statusCallbackPath: "/api/messages/status/message-opted-out"
        }
      ]
    } satisfies TwilioRelayPayload;
    const result = validateTwilioRelayConsentEvidenceForServer(payload, {
      ...validConsentEvidence,
      contacts: [
        {
          contactId: "parent-student-unknown",
          role: "parent",
          phone: "+12625550103",
          consentStatus: "unknown",
          consentUpdatedAt: null
        },
        {
          contactId: "parent-student-opted-out",
          role: "parent",
          phone: "+12625550104",
          consentStatus: "opt-out",
          consentUpdatedAt: "2026-06-02T12:00:00.000Z",
          optOutAt: "2026-06-02T12:00:00.000Z"
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "message-missing-consent",
        reasons: ["No matching opt-in SMS consent evidence for recipient."]
      }),
      expect.objectContaining({
        id: "message-unknown-consent",
        reasons: ["Recipient does not have opt-in SMS consent evidence."]
      }),
      expect.objectContaining({
        id: "message-opted-out",
        reasons: ["Recipient does not have opt-in SMS consent evidence."]
      })
    ]));
  });

  it("blocks Twilio relay execution plans when consent evidence is missing or fails validation", () => {
    const withoutConsent = buildTwilioRelayExecutionPlan(validRelayPayload, {
      accountSid: "test-account-sid",
      apiKeySid: "test-api-key-sid",
      apiKeySecret: "super-secret",
      messagingServiceSid: "test-messaging-service-sid",
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    expect(withoutConsent.ok).toBe(false);
    expect(withoutConsent.requests).toEqual([]);
    expect(withoutConsent.errors).toEqual(expect.arrayContaining([
      "Twilio relay execution plan requires SMS consent evidence before live send."
    ]));

    const withOptOut = buildTwilioRelayExecutionPlan(validRelayPayload, {
      accountSid: "test-account-sid",
      apiKeySid: "test-api-key-sid",
      apiKeySecret: "super-secret",
      messagingServiceSid: "test-messaging-service-sid",
      consentEvidence: {
        ...validConsentEvidence,
        contacts: [
          {
            ...validConsentEvidence.contacts[0],
            consentStatus: "opt-out",
            optOutAt: "2026-06-02T12:00:00.000Z"
          }
        ]
      },
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    expect(withOptOut.ok).toBe(false);
    expect(withOptOut.requests).toEqual([]);
    expect(withOptOut.consentValidation.rejected).toEqual([
      expect.objectContaining({
        id: "message-family-sale",
        reasons: ["Recipient does not have opt-in SMS consent evidence."]
      })
    ]);
  });

  it("accepts a credential-free structured Twilio relay health response for the browser", () => {
    const result = validateTwilioRelayHealthResponseForBrowser({
      status: "ready",
      checkedAt: "2026-06-03T15:00:00.000Z",
      readinessChecks: {
        managerAuth: true,
        twilioCredentials: true,
        senderConfigured: true,
        complianceReady: true,
        webhookSignatureValidation: true,
        relayCanSend: true
      }
    });

    expect(result).toEqual({
      ok: true,
      status: "ready",
      checkedAt: "2026-06-03T15:00:00.000Z",
      errors: [],
      readinessChecks: {
        managerAuth: true,
        twilioCredentials: true,
        senderConfigured: true,
        complianceReady: true,
        webhookSignatureValidation: true,
        relayCanSend: true
      }
    });
  });

  it("rejects unsafe or weak Twilio relay health responses before the browser marks the relay ready", () => {
    expect(validateTwilioRelayHealthResponseForBrowser({
      status: "ready"
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([
        "Relay health response must include credential-free readiness checks."
      ])
    }));

    expect(validateTwilioRelayHealthResponseForBrowser({
      status: "ready",
      readinessChecks: {
        managerAuth: true,
        twilioCredentials: true,
        senderConfigured: true,
        complianceReady: true,
        webhookSignatureValidation: false,
        relayCanSend: true
      }
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([
        "Ready relay health requires all readiness checks to pass."
      ])
    }));

    expect(validateTwilioRelayHealthResponseForBrowser({
      status: "ready",
      readinessChecks: {
        managerAuth: true,
        twilioCredentials: true,
        senderConfigured: true,
        complianceReady: true,
        webhookSignatureValidation: true,
        relayCanSend: true
      },
      TWILIO_AUTH_TOKEN: "twilio-auth-token-value"
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([
        "Relay health response must not include credential-like fields."
      ])
    }));
  });

  it("rejects malformed, over-limit, or non-compliant relay messages before Twilio send", () => {
    const payload = {
      ...validRelayPayload,
      TWILIO_AUTH_TOKEN: "should-never-be-in-browser-payload",
      messages: [
        {
          ...validRelayPayload.messages[0],
          id: "message-bad-callback",
          statusCallbackPath: "https://evil.example/status",
          optOutLanguageDetected: false,
          idempotencyKey: ""
        },
        {
          ...validRelayPayload.messages[0],
          id: "message-bad-phone",
          to: "262-555-0101",
          smsSegmentCount: 4
        }
      ]
    } as unknown;

    const result = validateTwilioRelayPayloadForServer(payload, {
      origin: "https://relay.chos.example",
      maxMessages: 1,
      maxSegmentsPerMessage: 3
    });

    expect(result.ok).toBe(false);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual(expect.arrayContaining([
      "Payload must not include Twilio credentials or credential-like fields.",
      "Relay batch includes 2 messages but the configured maximum is 1."
    ]));
    expect(result.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "message-bad-callback",
        reasons: expect.arrayContaining([
          "Message idempotency key is required for duplicate-send protection.",
          "Marketing SMS must include opt-out language before live Twilio send.",
          "Status callback path must be a relative /api/messages/status/{messageId} path."
        ])
      }),
      expect.objectContaining({
        id: "message-bad-phone",
        reasons: expect.arrayContaining([
          "Recipient phone must be normalized to E.164 before relay send.",
          "SMS segment count exceeds the relay limit of 3."
        ])
      })
    ]));
  });

  it("rejects duplicate relay idempotency keys even when message ids differ", () => {
    const payload = {
      ...validRelayPayload,
      messages: [
        validRelayPayload.messages[0],
        {
          ...validRelayPayload.messages[0],
          id: "message-family-sale-retry",
          statusCallbackPath: "/api/messages/status/message-family-sale-retry"
        }
      ]
    } satisfies TwilioRelayPayload;

    const result = validateTwilioRelayPayloadForServer(payload, {
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    expect(result.ok).toBe(false);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([
      expect.objectContaining({
        id: "message-family-sale-retry",
        reasons: ["Duplicate idempotency key in relay batch."]
      })
    ]);
  });

  it("rejects relay payloads that are not requested by an authenticated staff account", () => {
    const result = validateTwilioRelayPayloadForServer({
      ...validRelayPayload,
      requestedBy: {
        email: "parent123@chos.prototype",
        role: "guardian"
      }
    }, {
      origin: "https://relay.chos.example",
      maxMessages: 50,
      maxSegmentsPerMessage: 3
    });

    expect(result.ok).toBe(false);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual(expect.arrayContaining([
      "Relay payload must be requested by an authenticated staff account."
    ]));
  });

  it("creates and validates Twilio form webhook signatures for inbound SMS callbacks", async () => {
    const parameters = {
      Body: "START",
      From: "+12625550101",
      MessageSid: "test-message-sid-1",
      To: "+12625550000"
    };

    await expect(createTwilioFormWebhookSignature({
      authToken: "12345",
      url: "https://relay.chos.example/api/messages/inbound",
      parameters
    })).resolves.toBe("yIqKGOm5pwJnvoip5oJ9VZRjJDI=");

    await expect(validateTwilioFormWebhookSignature({
      authToken: "12345",
      signature: "yIqKGOm5pwJnvoip5oJ9VZRjJDI=",
      url: "https://relay.chos.example/api/messages/inbound",
      parameters
    })).resolves.toBe(true);
  });

  it("rejects Twilio webhook signatures when the callback URL or parameters are tampered with", async () => {
    const parameters = new URLSearchParams({
      ErrorCode: "30007",
      MessageSid: "test-message-sid-2",
      MessageStatus: "failed"
    });

    await expect(validateTwilioFormWebhookSignature({
      authToken: "12345",
      signature: "knBS7j0Fx7x016dSwCoPp2FEcls=",
      url: "https://relay.chos.example/api/messages/status/message-ari?source=twilio%2Bstatus",
      parameters
    })).resolves.toBe(true);

    parameters.set("MessageStatus", "delivered");
    await expect(validateTwilioFormWebhookSignature({
      authToken: "12345",
      signature: "knBS7j0Fx7x016dSwCoPp2FEcls=",
      url: "https://relay.chos.example/api/messages/status/message-ari?source=twilio%2Bstatus",
      parameters
    })).resolves.toBe(false);

    parameters.set("MessageStatus", "failed");
    await expect(validateTwilioFormWebhookSignature({
      authToken: "12345",
      signature: "knBS7j0Fx7x016dSwCoPp2FEcls=",
      url: "https://relay.chos.example/api/messages/status/message-ari?source=twilio status",
      parameters
    })).resolves.toBe(false);
  });

  it("normalizes Twilio status callback form fields into Cho relay results", () => {
    const result = normalizeTwilioStatusCallbackForServer(new URLSearchParams({
      MessageSid: "test-message-sid-2",
      MessageStatus: "undelivered",
      SmsStatus: "undelivered",
      ErrorCode: "30007",
      ErrorMessage: "Carrier filtered the message."
    }), {
      messageId: "message-family-sale"
    });

    expect(result).toEqual({
      id: "message-family-sale",
      deliveryStatus: "undelivered",
      deliveryProviderMessageId: "test-message-sid-2",
      errorCode: "30007",
      errorMessage: "Carrier filtered the message."
    });
  });

  it("normalizes Twilio create-message resources into Cho relay results", () => {
    const result = normalizeTwilioMessageCreateResponseForServer("message-family-sale", {
      sid: "test-message-sid-3",
      status: "queued",
      date_sent: "Wed, 03 Jun 2026 18:55:00 +0000",
      error_code: null,
      error_message: null
    });

    expect(result).toEqual({
      id: "message-family-sale",
      deliveryStatus: "queued",
      deliveryProviderMessageId: "test-message-sid-3",
      sentAt: "Wed, 03 Jun 2026 18:55:00 +0000"
    });
  });

  it("keeps Twilio scheduled create-message responses as non-failed relay results", () => {
    const result = buildTwilioRelayResultFromProviderResponse({
      messageId: "message-scheduled-promo",
      httpStatus: 201,
      responseBody: {
        sid: "test-message-sid-4",
        status: "scheduled",
        date_created: "Wed, 03 Jun 2026 18:55:00 +0000"
      }
    });

    expect(result).toEqual({
      id: "message-scheduled-promo",
      deliveryStatus: "scheduled",
      deliveryProviderMessageId: "test-message-sid-4",
      sentAt: "Wed, 03 Jun 2026 18:55:00 +0000"
    });
  });

  it("turns Twilio REST API errors into failed Cho relay results without treating error codes as control flow", () => {
    const result = buildTwilioRelayResultFromProviderResponse({
      messageId: "message-family-sale",
      httpStatus: 400,
      responseBody: {
        code: 21610,
        message: "The message From/To pair violates a blacklist rule.",
        more_info: "https://www.twilio.com/docs/errors/21610",
        status: 400
      }
    });

    expect(result).toEqual({
      id: "message-family-sale",
      deliveryStatus: "failed",
      deliveryDetail: "Twilio API HTTP 400.",
      errorCode: "21610",
      errorMessage: "The message From/To pair violates a blacklist rule."
    });
  });

  it("fails closed when a successful Twilio response cannot be normalized", () => {
    const result = buildTwilioRelayResultFromProviderResponse({
      messageId: "message-family-sale",
      httpStatus: 201,
      responseBody: {
        ok: true
      }
    });

    expect(result).toEqual({
      id: "message-family-sale",
      deliveryStatus: "failed",
      deliveryDetail: "Twilio API response did not include a supported Message resource status.",
      errorMessage: "Twilio API response did not include a supported Message resource status."
    });
  });

  it("normalizes Twilio inbound SMS webhook fields and classifies START/STOP keywords", () => {
    expect(normalizeTwilioInboundSmsWebhookForServer(new URLSearchParams({
      MessageSid: "SMINBOUND1111111111111111111111111111",
      From: "+12625550101",
      To: "+12625550000",
      Body: "STOP"
    }))).toEqual({
      from: "+12625550101",
      to: "+12625550000",
      body: "STOP",
      messageSid: "SMINBOUND1111111111111111111111111111",
      keyword: "opt-out"
    });

    expect(normalizeTwilioInboundSmsWebhookForServer({
      SmsSid: "SMSTART1111111111111111111111111111",
      From: "+12625550101",
      To: "+12625550000",
      Body: "START again"
    })).toEqual(expect.objectContaining({
      messageSid: "SMSTART1111111111111111111111111111",
      keyword: "opt-in"
    }));
  });

  it("builds server-side consent updates from Twilio inbound START and STOP keywords", () => {
    const stopPlan = buildTwilioInboundConsentUpdatePlanForServer(new URLSearchParams({
      MessageSid: "SMSTOP111111111111111111111111111111",
      From: "+12625550101",
      To: "+12625550000",
      Body: "STOP"
    }), {
      receivedAt: "2026-06-03T20:00:00.000Z",
      contacts: validConsentEvidence.contacts
    });

    expect(stopPlan.ok).toBe(true);
    expect(stopPlan.errors).toEqual([]);
    expect(stopPlan.keyword).toBe("opt-out");
    expect(stopPlan.phoneUpdate).toEqual({
      phone: "+12625550101",
      consentStatus: "opt-out",
      consentUpdatedAt: "2026-06-03T20:00:00.000Z",
      optOutAt: "2026-06-03T20:00:00.000Z",
      messageSid: "SMSTOP111111111111111111111111111111",
      evidenceSource: "twilio-inbound-keyword"
    });
    expect(stopPlan.contactUpdates).toEqual([
      {
        contactId: "parent-student-ari",
        role: "parent",
        name: "Mina Nguyen",
        phone: "+12625550101",
        consentStatus: "opt-out",
        consentUpdatedAt: "2026-06-03T20:00:00.000Z",
        optOutAt: "2026-06-03T20:00:00.000Z",
        messageSid: "SMSTOP111111111111111111111111111111",
        evidenceSource: "twilio-inbound-keyword"
      }
    ]);
    expect(JSON.stringify(stopPlan)).not.toMatch(/AUTH_TOKEN|API_SECRET|PRIVATE_KEY|ACCOUNT_SID|super-secret/i);

    const startPlan = buildTwilioInboundConsentUpdatePlanForServer({
      SmsSid: "SMSTART1111111111111111111111111111",
      From: "+12625550101",
      To: "+12625550000",
      Body: "UNSTOP"
    }, {
      receivedAt: "2026-06-03T20:05:00.000Z",
      contacts: [
        {
          ...validConsentEvidence.contacts[0],
          consentStatus: "opt-out",
          optOutAt: "2026-06-03T20:00:00.000Z"
        }
      ]
    });

    expect(startPlan.ok).toBe(true);
    expect(startPlan.keyword).toBe("opt-in");
    expect(startPlan.phoneUpdate).toEqual({
      phone: "+12625550101",
      consentStatus: "opt-in",
      consentUpdatedAt: "2026-06-03T20:05:00.000Z",
      messageSid: "SMSTART1111111111111111111111111111",
      evidenceSource: "twilio-inbound-keyword"
    });
    expect(startPlan.contactUpdates[0]).toEqual(expect.not.objectContaining({ optOutAt: expect.any(String) }));
  });

  it("keeps unmatched Twilio STOP keywords as phone-level suppression updates", () => {
    const plan = buildTwilioInboundConsentUpdatePlanForServer({
      MessageSid: "SMUNKNOWN11111111111111111111111111",
      From: "+12625550999",
      To: "+12625550000",
      Body: "STOP all"
    }, {
      receivedAt: "2026-06-03T20:10:00.000Z",
      contacts: validConsentEvidence.contacts
    });

    expect(plan.ok).toBe(true);
    expect(plan.contactUpdates).toEqual([]);
    expect(plan.phoneUpdate).toEqual(expect.objectContaining({
      phone: "+12625550999",
      consentStatus: "opt-out",
      optOutAt: "2026-06-03T20:10:00.000Z"
    }));
  });
});
