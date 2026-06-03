const subscriptionSchemaVersion = "chos-web-push-subscription.v1";
const notificationSchemaVersion = "chos-web-push-notification.v1";
const pushProvider = "web-push";
const pushDeliveryMode = "server-push";
const credentialFieldPattern = /(?:VAPID_PRIVATE_KEY|PRIVATE_KEY|AUTH_TOKEN|API_SECRET|SECRET|PASSWORD|CREDENTIAL|TWILIO_)/i;
const supportedChoAccountRoles = new Set(["staff", "student", "guardian"]);

type ChoWebPushAccountRole = "staff" | "student" | "guardian";

export type WebPushContractOptions = {
  allowedOrigin: string;
  allowedPathPrefix?: string;
};

export type WebPushNotificationPayloadOptions = WebPushContractOptions & {
  fallbackPath: string;
};

export type WebPushDeliveryPlanOptions = WebPushNotificationPayloadOptions & {
  targetAccount?: {
    email: string;
    role: ChoWebPushAccountRole;
  };
  maxSubscriptions?: number;
  now?: number;
};

export type ChoWebPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type ChoWebPushSubscriptionValidationResult = {
  ok: boolean;
  errors: string[];
  requestedBy?: {
    email: string;
    role: "staff" | "student" | "guardian";
  };
  notificationUrl?: string;
  subscription?: ChoWebPushSubscription;
};

export type ChoWebPushNotificationInput = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  threadId?: string;
  unreadCount?: number;
  icon?: string;
  badge?: string;
};

export type ChoWebPushNotificationPayload = {
  schemaVersion: typeof notificationSchemaVersion;
  title: string;
  body: string;
  url: string;
  tag: string;
  threadId?: string;
  unreadCount?: number;
  icon?: string;
  badge?: string;
};

export type ChoWebPushRejectedSubscription = {
  id: string;
  reasons: string[];
};

export type ChoWebPushDeliveryRequest = {
  accountEmail: string;
  accountRole: ChoWebPushAccountRole;
  endpoint: string;
  subscription: ChoWebPushSubscription;
  notificationPayload: ChoWebPushNotificationPayload;
  notificationPayloadJson: string;
  removeSubscriptionOnHttpStatuses: [404, 410];
};

export type ChoWebPushDeliveryPlan = {
  ok: boolean;
  serverOnly: true;
  errors: string[];
  rejected: ChoWebPushRejectedSubscription[];
  notificationPayload: ChoWebPushNotificationPayload;
  requests: ChoWebPushDeliveryRequest[];
};

export type ChoWebPushDeliveryStatus = "sent" | "failed" | "expired";

export type ChoWebPushProviderResponseInput = {
  endpoint: string;
  httpStatus: number;
  responseBody?: unknown;
  fallbackErrorMessage?: string;
  removeSubscriptionOnHttpStatuses?: readonly number[];
};

export type ChoWebPushDeliveryResult = {
  endpoint: string;
  httpStatus: number;
  deliveryStatus: ChoWebPushDeliveryStatus;
  removeSubscription: boolean;
  deliveryDetail?: string;
};

export type ChoWebPushDeliveryReconciliationPlan = {
  ok: boolean;
  serverOnly: true;
  errors: string[];
  sent: ChoWebPushDeliveryResult[];
  failed: ChoWebPushDeliveryResult[];
  expired: ChoWebPushDeliveryResult[];
  subscriptionsToRemove: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string) {
  const value = record[field];
  return typeof value === "string" ? value.trim() : "";
}

function stringOrNumberField(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function hasCredentialLikeField(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => credentialFieldPattern.test(key) || hasCredentialLikeField(item, seen));
}

function normalizedPathPrefix(value?: string) {
  if (!value?.trim()) return "/";
  const prefixed = value.trim().startsWith("/") ? value.trim() : `/${value.trim()}`;
  return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
}

function normalizedOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function scopedUrl(value: string | undefined, options: WebPushContractOptions & { fallbackPath?: string }) {
  const allowedOrigin = normalizedOrigin(options.allowedOrigin);
  const allowedPathPrefix = normalizedPathPrefix(options.allowedPathPrefix);
  const fallback = new URL(options.fallbackPath ?? allowedPathPrefix, allowedOrigin);
  try {
    const candidate = new URL(value?.trim() || fallback.toString(), allowedOrigin);
    return candidate.origin === allowedOrigin && candidate.pathname.startsWith(allowedPathPrefix) ? candidate.toString() : fallback.toString();
  } catch {
    return fallback.toString();
  }
}

function isScopedUrl(value: string, options: WebPushContractOptions) {
  return scopedUrl(value, options) === value.trim();
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validUnreadCount(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function subscriptionId(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;
  const subscription = payload.subscription;
  if (isRecord(subscription)) return stringField(subscription, "endpoint") || fallback;
  return fallback;
}

function firstProviderResponseDetail(responseBody: unknown, fallback?: string) {
  if (!isRecord(responseBody)) return fallback?.trim() || "";
  const detailFields = ["message", "error", "errorMessage", "reason", "statusText", "detail"];
  for (const field of detailFields) {
    const detail = stringOrNumberField(responseBody, field);
    if (detail) return detail;
  }
  return fallback?.trim() || "";
}

export function validateWebPushSubscriptionPayloadForServer(payload: unknown, options: WebPushContractOptions): ChoWebPushSubscriptionValidationResult {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return {
      ok: false,
      errors: ["Web Push subscription payload must be an object."]
    };
  }

  if (hasCredentialLikeField(payload)) errors.push("Payload must not include VAPID private keys or credential-like fields.");
  if (payload.schemaVersion !== subscriptionSchemaVersion) errors.push(`Web Push payload schemaVersion must be ${subscriptionSchemaVersion}.`);
  if (payload.provider !== pushProvider) errors.push(`Web Push payload provider must be ${pushProvider}.`);
  if (payload.deliveryMode !== pushDeliveryMode) errors.push(`Web Push payload deliveryMode must be ${pushDeliveryMode}.`);
  if (!stringField(payload, "generatedAt")) errors.push("Web Push payload generatedAt timestamp is required.");

  const requestedBy = payload.requestedBy;
  if (!isRecord(requestedBy) || !stringField(requestedBy, "email")) errors.push("Web Push payload must include authenticated manager identity.");
  const requestedByRole = isRecord(requestedBy) ? stringField(requestedBy, "role") : "";
  if (!supportedChoAccountRoles.has(requestedByRole)) errors.push("Web Push payload must include a supported Cho account role.");

  const notificationUrl = stringField(payload, "notificationUrl");
  if (!notificationUrl || !isScopedUrl(notificationUrl, options)) {
    errors.push("Notification URL must stay within the configured app origin and path prefix.");
  }

  const subscription = payload.subscription;
  if (!isRecord(subscription)) {
    errors.push("Push subscription must be an object.");
  }

  const endpoint = isRecord(subscription) ? stringField(subscription, "endpoint") : "";
  if (!endpoint) {
    errors.push("Push subscription endpoint is required.");
  } else if (!isHttpsUrl(endpoint)) {
    errors.push("Push subscription endpoint must be an HTTPS URL.");
  }

  const expirationTime = isRecord(subscription) ? subscription.expirationTime : undefined;
  if (expirationTime !== undefined && expirationTime !== null && typeof expirationTime !== "number") {
    errors.push("Push subscription expirationTime must be a number or null when provided.");
  }

  const keys = isRecord(subscription) ? subscription.keys : undefined;
  const p256dh = isRecord(keys) ? stringField(keys, "p256dh") : "";
  const auth = isRecord(keys) ? stringField(keys, "auth") : "";
  if (!p256dh) errors.push("Push subscription keys.p256dh is required.");
  if (!auth) errors.push("Push subscription keys.auth is required.");

  if (errors.length) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    errors,
    requestedBy: {
      email: stringField(requestedBy as Record<string, unknown>, "email"),
      role: requestedByRole as "staff" | "student" | "guardian"
    },
    notificationUrl,
    subscription: {
      endpoint,
      expirationTime: expirationTime as number | null | undefined,
      keys: {
        p256dh,
        auth
      }
    }
  };
}

export function buildChoWebPushResultFromProviderResponse(input: ChoWebPushProviderResponseInput): ChoWebPushDeliveryResult {
  const endpoint = input.endpoint.trim() || "unknown-push-endpoint";
  const httpStatus = Number.isFinite(input.httpStatus) ? Math.floor(input.httpStatus) : 0;
  const removeSubscriptionStatuses = new Set(input.removeSubscriptionOnHttpStatuses ?? [404, 410]);
  const removeSubscription = removeSubscriptionStatuses.has(httpStatus);
  const deliveryDetail = firstProviderResponseDetail(
    input.responseBody,
    input.fallbackErrorMessage || (httpStatus ? `Push service returned HTTP ${httpStatus}.` : "Push service request failed.")
  );

  if (httpStatus >= 200 && httpStatus < 300) {
    return {
      endpoint,
      httpStatus,
      deliveryStatus: "sent",
      removeSubscription: false
    };
  }

  return {
    endpoint,
    httpStatus,
    deliveryStatus: removeSubscription ? "expired" : "failed",
    removeSubscription,
    ...(deliveryDetail ? { deliveryDetail } : {})
  };
}

export function buildChoWebPushDeliveryReconciliationPlan(results: readonly ChoWebPushDeliveryResult[]): ChoWebPushDeliveryReconciliationPlan {
  const sent: ChoWebPushDeliveryResult[] = [];
  const failed: ChoWebPushDeliveryResult[] = [];
  const expired: ChoWebPushDeliveryResult[] = [];
  const removeSet = new Set<string>();

  results.forEach((result) => {
    if (result.deliveryStatus === "sent") {
      sent.push(result);
      return;
    }
    if (result.removeSubscription) {
      expired.push(result);
      if (result.endpoint.trim()) removeSet.add(result.endpoint);
      return;
    }
    failed.push(result);
  });

  const errors = failed.map((result) => `Web Push delivery failed for ${result.endpoint}: ${result.deliveryDetail || `HTTP ${result.httpStatus}`}`);

  return {
    ok: errors.length === 0,
    serverOnly: true,
    errors,
    sent,
    failed,
    expired,
    subscriptionsToRemove: Array.from(removeSet)
  };
}

export function buildChoWebPushNotificationPayload(input: ChoWebPushNotificationInput, options: WebPushNotificationPayloadOptions): ChoWebPushNotificationPayload {
  const unreadCount = validUnreadCount(input.unreadCount);
  const threadId = input.threadId?.trim();
  const icon = input.icon ? scopedUrl(input.icon, options) : undefined;
  const badge = input.badge ? scopedUrl(input.badge, options) : undefined;
  return {
    schemaVersion: notificationSchemaVersion,
    title: input.title?.trim() || "New Cho's message",
    body: input.body?.trim() || "Open Cho's Martial Arts to view the latest message.",
    url: scopedUrl(input.url, options),
    tag: input.tag?.trim() || "chos-message",
    ...(threadId ? { threadId } : {}),
    ...(unreadCount !== undefined ? { unreadCount } : {}),
    ...(icon ? { icon } : {}),
    ...(badge ? { badge } : {})
  };
}

export function buildChoWebPushDeliveryPlan(subscriptionPayloads: unknown, input: ChoWebPushNotificationInput, options: WebPushDeliveryPlanOptions): ChoWebPushDeliveryPlan {
  const errors: string[] = [];
  const rejected: ChoWebPushRejectedSubscription[] = [];
  const requests: ChoWebPushDeliveryRequest[] = [];
  const notificationPayload = buildChoWebPushNotificationPayload(input, options);
  const notificationPayloadJson = JSON.stringify(notificationPayload);
  const maxSubscriptions = options.maxSubscriptions ?? 100;
  const now = options.now ?? Date.now();

  if (!Array.isArray(subscriptionPayloads)) {
    return {
      ok: false,
      serverOnly: true,
      errors: ["Web Push delivery plan subscriptions must be an array."],
      rejected,
      notificationPayload,
      requests
    };
  }
  if (!subscriptionPayloads.length) errors.push("Web Push delivery plan requires at least one stored subscription.");
  if (subscriptionPayloads.length > maxSubscriptions) errors.push(`Web Push delivery plan includes ${subscriptionPayloads.length} subscriptions but the configured maximum is ${maxSubscriptions}.`);

  subscriptionPayloads.slice(0, maxSubscriptions).forEach((payload, index) => {
    const id = subscriptionId(payload, `subscription-${index + 1}`);
    const validation = validateWebPushSubscriptionPayloadForServer(payload, options);
    const reasons = [...validation.errors];
    if (validation.ok && validation.subscription && validation.requestedBy) {
      if (options.targetAccount) {
        const accountMatches =
          normalizedEmail(validation.requestedBy.email) === normalizedEmail(options.targetAccount.email) &&
          validation.requestedBy.role === options.targetAccount.role;
        if (!accountMatches) reasons.push("Push subscription does not belong to the target Cho account.");
      }
      if (validation.subscription.expirationTime !== undefined && validation.subscription.expirationTime !== null && validation.subscription.expirationTime <= now) {
        reasons.push("Push subscription has expired.");
      }
      if (!reasons.length) {
        requests.push({
          accountEmail: validation.requestedBy.email,
          accountRole: validation.requestedBy.role,
          endpoint: validation.subscription.endpoint,
          subscription: validation.subscription,
          notificationPayload,
          notificationPayloadJson,
          removeSubscriptionOnHttpStatuses: [404, 410]
        });
        return;
      }
    }
    rejected.push({ id, reasons });
  });

  if (!requests.length) errors.push("Web Push delivery plan has no sendable subscriptions.");

  return {
    ok: errors.length === 0 && rejected.length === 0 && requests.length > 0,
    serverOnly: true,
    errors,
    rejected,
    notificationPayload,
    requests: errors.length || rejected.length ? [] : requests
  };
}
