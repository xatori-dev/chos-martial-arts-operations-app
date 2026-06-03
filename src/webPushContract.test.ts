import { describe, expect, it } from "vitest";
import {
  buildChoWebPushDeliveryPlan,
  buildChoWebPushDeliveryReconciliationPlan,
  buildChoWebPushNotificationPayload,
  buildChoWebPushResultFromProviderResponse,
  validateWebPushSubscriptionPayloadForServer
} from "./webPushContract";

const validSubscriptionPayload = {
  schemaVersion: "chos-web-push-subscription.v1",
  provider: "web-push",
  deliveryMode: "server-push",
  generatedAt: "2026-06-03T15:00:00.000Z",
  requestedBy: {
    email: "manager123@chos.prototype",
    role: "staff"
  },
  notificationUrl: "https://cho.example.com/chos-martial-arts-prototype/messages",
  pushSubscribedAt: "2026-06-03T14:55:00.000Z",
  subscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
    expirationTime: null,
    keys: {
      p256dh: "public-browser-push-key",
      auth: "browser-push-auth-secret"
    }
  }
};

describe("web push contract", () => {
  it("accepts a manager-authenticated Cho Web Push subscription handoff", () => {
    const result = validateWebPushSubscriptionPayloadForServer(validSubscriptionPayload, {
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/"
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.subscription?.endpoint).toBe("https://fcm.googleapis.com/fcm/send/subscription-token");
    expect(result.notificationUrl).toBe("https://cho.example.com/chos-martial-arts-prototype/messages");
    expect(result.requestedBy).toEqual({
      email: "manager123@chos.prototype",
      role: "staff"
    });
  });

  it("requires a supported Cho account role before server-side subscription storage", () => {
    const options = {
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/"
    };

    expect(["staff", "student", "guardian"].map((role) =>
      validateWebPushSubscriptionPayloadForServer({
        ...validSubscriptionPayload,
        requestedBy: {
          email: `${role}@chos.prototype`,
          role
        }
      }, options)
    )).toEqual([
      expect.objectContaining({ ok: true, requestedBy: { email: "staff@chos.prototype", role: "staff" } }),
      expect.objectContaining({ ok: true, requestedBy: { email: "student@chos.prototype", role: "student" } }),
      expect.objectContaining({ ok: true, requestedBy: { email: "guardian@chos.prototype", role: "guardian" } })
    ]);

    const missingRoleResult = validateWebPushSubscriptionPayloadForServer({
      ...validSubscriptionPayload,
      requestedBy: {
        email: "unknown@chos.prototype"
      }
    }, options);
    const unknownRoleResult = validateWebPushSubscriptionPayloadForServer({
      ...validSubscriptionPayload,
      requestedBy: {
        email: "owner@chos.prototype",
        role: "owner"
      }
    }, options);

    expect(missingRoleResult).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining(["Web Push payload must include a supported Cho account role."])
    }));
    expect(unknownRoleResult).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining(["Web Push payload must include a supported Cho account role."])
    }));
  });

  it("builds a safe service-worker notification payload for unread app messages", () => {
    const payload = buildChoWebPushNotificationPayload({
      title: "New message from Mina Nguyen",
      body: "Can Ari come to the 5 PM class today?",
      url: "https://cho.example.com/chos-martial-arts-prototype/messages?thread=student-ari",
      tag: "chos-thread-student-ari",
      threadId: "student-ari",
      unreadCount: 3
    }, {
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/",
      fallbackPath: "/chos-martial-arts-prototype/messages"
    });

    expect(payload).toEqual({
      schemaVersion: "chos-web-push-notification.v1",
      title: "New message from Mina Nguyen",
      body: "Can Ari come to the 5 PM class today?",
      url: "https://cho.example.com/chos-martial-arts-prototype/messages?thread=student-ari",
      tag: "chos-thread-student-ari",
      threadId: "student-ari",
      unreadCount: 3
    });
  });

  it("builds a private server Web Push delivery plan for a target Cho account", () => {
    const plan = buildChoWebPushDeliveryPlan([validSubscriptionPayload], {
      title: "New message from Mina Nguyen",
      body: "Can Ari come to the 5 PM class today?",
      url: "https://cho.example.com/chos-martial-arts-prototype/messages?thread=student-ari",
      tag: "chos-thread-student-ari",
      threadId: "student-ari",
      unreadCount: 3
    }, {
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/",
      fallbackPath: "/chos-martial-arts-prototype/messages",
      targetAccount: {
        email: "manager123@chos.prototype",
        role: "staff"
      },
      now: 1780513200000
    });

    expect(plan.ok).toBe(true);
    expect(plan.serverOnly).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.rejected).toEqual([]);
    expect(plan.notificationPayload).toEqual(expect.objectContaining({
      schemaVersion: "chos-web-push-notification.v1",
      title: "New message from Mina Nguyen",
      url: "https://cho.example.com/chos-martial-arts-prototype/messages?thread=student-ari",
      unreadCount: 3
    }));
    expect(plan.requests).toEqual([
      expect.objectContaining({
        accountEmail: "manager123@chos.prototype",
        accountRole: "staff",
        endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
        removeSubscriptionOnHttpStatuses: [404, 410],
        notificationPayloadJson: JSON.stringify(plan.notificationPayload),
        subscription: expect.objectContaining({
          endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
          keys: {
            p256dh: "public-browser-push-key",
            auth: "browser-push-auth-secret"
          }
        })
      })
    ]);
  });

  it("normalizes Web Push provider responses and marks gone subscriptions for cleanup", () => {
    expect(buildChoWebPushResultFromProviderResponse({
      endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
      httpStatus: 201,
      responseBody: null
    })).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
      httpStatus: 201,
      deliveryStatus: "sent",
      removeSubscription: false
    });

    const gone = buildChoWebPushResultFromProviderResponse({
      endpoint: "https://updates.push.services.mozilla.com/wpush/v2/expired-token",
      httpStatus: 410,
      responseBody: {
        message: "Subscription no longer exists",
        VAPID_PRIVATE_KEY: "must-not-echo"
      }
    });

    expect(gone).toEqual({
      endpoint: "https://updates.push.services.mozilla.com/wpush/v2/expired-token",
      httpStatus: 410,
      deliveryStatus: "expired",
      removeSubscription: true,
      deliveryDetail: "Subscription no longer exists"
    });
    expect(JSON.stringify(gone)).not.toMatch(/VAPID|PRIVATE|must-not-echo/i);
  });

  it("builds a Web Push reconciliation plan for sent, failed, and removable subscriptions", () => {
    const plan = buildChoWebPushDeliveryReconciliationPlan([
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token",
        httpStatus: 201,
        deliveryStatus: "sent",
        removeSubscription: false
      },
      {
        endpoint: "https://updates.push.services.mozilla.com/wpush/v2/expired-token",
        httpStatus: 404,
        deliveryStatus: "expired",
        removeSubscription: true,
        deliveryDetail: "Push service returned HTTP 404."
      },
      {
        endpoint: "https://web.push.apple.com/Q/failing-token",
        httpStatus: 429,
        deliveryStatus: "failed",
        removeSubscription: false,
        deliveryDetail: "Rate limited"
      }
    ]);

    expect(plan.ok).toBe(false);
    expect(plan.sent).toEqual([
      expect.objectContaining({ endpoint: "https://fcm.googleapis.com/fcm/send/subscription-token" })
    ]);
    expect(plan.failed).toEqual([
      expect.objectContaining({ endpoint: "https://web.push.apple.com/Q/failing-token", httpStatus: 429 })
    ]);
    expect(plan.subscriptionsToRemove).toEqual([
      "https://updates.push.services.mozilla.com/wpush/v2/expired-token"
    ]);
    expect(plan.errors).toEqual([
      "Web Push delivery failed for https://web.push.apple.com/Q/failing-token: Rate limited"
    ]);
  });

  it("rejects stale or wrong-account subscriptions before building Web Push delivery requests", () => {
    const plan = buildChoWebPushDeliveryPlan([
      {
        ...validSubscriptionPayload,
        requestedBy: {
          email: "parent123@chos.prototype",
          role: "guardian"
        }
      },
      {
        ...validSubscriptionPayload,
        requestedBy: {
          email: "manager123@chos.prototype",
          role: "staff"
        },
        subscription: {
          ...validSubscriptionPayload.subscription,
          endpoint: "https://updates.push.services.mozilla.com/wpush/v2/expired-token",
          expirationTime: 1780513199999
        }
      },
      {
        ...validSubscriptionPayload,
        VAPID_PRIVATE_KEY: "private-key-value"
      }
    ], {
      title: "New Cho's message",
      body: "Open Cho's Martial Arts to view the latest message."
    }, {
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/",
      fallbackPath: "/chos-martial-arts-prototype/messages",
      targetAccount: {
        email: "manager123@chos.prototype",
        role: "staff"
      },
      now: 1780513200000
    });

    expect(plan.ok).toBe(false);
    expect(plan.requests).toEqual([]);
    expect(plan.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "https://fcm.googleapis.com/fcm/send/subscription-token",
        reasons: ["Push subscription does not belong to the target Cho account."]
      }),
      expect.objectContaining({
        id: "https://updates.push.services.mozilla.com/wpush/v2/expired-token",
        reasons: ["Push subscription has expired."]
      }),
      expect.objectContaining({
        reasons: expect.arrayContaining(["Payload must not include VAPID private keys or credential-like fields."])
      })
    ]));
  });

  it("rejects unsafe or incomplete Web Push subscription handoffs before server storage", () => {
    const result = validateWebPushSubscriptionPayloadForServer({
      ...validSubscriptionPayload,
      VAPID_PRIVATE_KEY: "private-key-value",
      notificationUrl: "https://evil.example.com/messages",
      subscription: {
        endpoint: "http://fcm.googleapis.com/fcm/send/insecure",
        expirationTime: "never",
        keys: {
          p256dh: "",
          auth: "browser-push-auth-secret"
        }
      }
    }, {
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/"
    });

    expect(result.ok).toBe(false);
    expect(result.subscription).toBeUndefined();
    expect(result.errors).toEqual(expect.arrayContaining([
      "Payload must not include VAPID private keys or credential-like fields.",
      "Notification URL must stay within the configured app origin and path prefix.",
      "Push subscription endpoint must be an HTTPS URL.",
      "Push subscription keys.p256dh is required.",
      "Push subscription expirationTime must be a number or null when provided."
    ]));
  });

  it("falls back unsafe notification URLs and omits invalid badge counts", () => {
    const payload = buildChoWebPushNotificationPayload({
      title: "",
      body: "",
      url: "https://evil.example.com/messages",
      tag: "",
      threadId: "",
      unreadCount: -1
    }, {
      allowedOrigin: "https://cho.example.com",
      allowedPathPrefix: "/chos-martial-arts-prototype/",
      fallbackPath: "/chos-martial-arts-prototype/messages"
    });

    expect(payload).toEqual({
      schemaVersion: "chos-web-push-notification.v1",
      title: "New Cho's message",
      body: "Open Cho's Martial Arts to view the latest message.",
      url: "https://cho.example.com/chos-martial-arts-prototype/messages",
      tag: "chos-message"
    });
  });
});
