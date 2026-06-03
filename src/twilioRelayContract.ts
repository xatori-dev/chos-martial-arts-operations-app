import type { MessageLog, TwilioDeliveryStatus, TwilioRelayMessage, TwilioRelayPayload, TwilioRelayResult } from "./types";

const relaySchemaVersion = "chos-twilio-relay.v1";
const relayProvider = "twilio";
const relayDeliveryMode = "server-relay";
const credentialFieldPattern = /(?:TWILIO_|AUTH_TOKEN|ACCOUNT_SID|API_KEY|SECRET|PASSWORD|PRIVATE_KEY|CREDENTIAL)/i;
const validMessageKinds: ReadonlySet<MessageLog["kind"]> = new Set(["welcome", "reminder", "follow-up", "marketing", "celebration", "profile-update"]);
const validSmsEncodings: ReadonlySet<TwilioRelayMessage["smsEncoding"]> = new Set(["GSM-7", "UCS-2"]);
const validDeliveryStatuses: ReadonlySet<TwilioDeliveryStatus> = new Set(["accepted", "scheduled", "queued", "sending", "sent", "delivered", "undelivered", "failed", "canceled"]);
const validRelayRecipientRoles: ReadonlySet<NonNullable<MessageLog["recipientRole"]>> = new Set(["student", "parent", "staff"]);
const validSmsConsentStatuses: ReadonlySet<TwilioSmsConsentStatus> = new Set(["opt-in", "opt-out", "unknown"]);
const validRelayAttemptStatuses: ReadonlySet<TwilioRelayAttemptStatus> = new Set(["reserved", "sending", "sent", "failed"]);
const relayAttemptPrivateFieldPattern = /^(?:authorization|authorizationHeader|authHeader|request|headers)$/i;
const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const consentEvidenceSchemaVersion = "chos-sms-consent-evidence.v1";

export type TwilioRelayValidationOptions = {
  origin: string;
  maxMessages?: number;
  maxSegmentsPerMessage?: number;
};

export type TwilioRelayRejectedMessage = {
  id: string;
  reasons: string[];
};

export type TwilioRelayAcceptedMessage = {
  message: TwilioRelayMessage;
};

export type TwilioRelayValidationResult = {
  ok: boolean;
  errors: string[];
  rejected: TwilioRelayRejectedMessage[];
  accepted: TwilioRelayAcceptedMessage[];
};

export type TwilioMessageRequestConfig = {
  accountSid: string;
  messagingServiceSid?: string;
  fromNumber?: string;
  origin: string;
};

export type TwilioApiAuthConfig = {
  accountSid: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
};

export type TwilioRelayExecutionPlanConfig = TwilioApiAuthConfig & {
  origin: string;
  messagingServiceSid?: string;
  fromNumber?: string;
  consentEvidence?: unknown;
  maxMessages?: number;
  maxSegmentsPerMessage?: number;
};

export type TwilioMessageRequest = {
  method: "POST";
  url: string;
  headers: {
    "Content-Type": "application/x-www-form-urlencoded";
  };
  body: string;
};

export type TwilioRelayExecutionRequest = {
  messageId: string;
  relayIdempotencyKey: string;
  recipientName: string;
  recipientRole?: MessageLog["recipientRole"];
  to: string;
  authorizationHeader: string;
  request: TwilioMessageRequest;
};

export type TwilioRelayExecutionPlan = {
  ok: boolean;
  serverOnly: true;
  credentialMode?: "api-key" | "account-auth-token";
  errors: string[];
  validation: TwilioRelayValidationResult;
  consentValidation: TwilioRelayConsentValidationResult;
  requests: TwilioRelayExecutionRequest[];
};

export type TwilioRelayAttemptStatus = "reserved" | "sending" | "sent" | "failed";

export type TwilioRelayAttemptRecord = {
  relayIdempotencyKey: string;
  messageId: string;
  recipientName?: string;
  recipientRole?: MessageLog["recipientRole"];
  to?: string;
  status: TwilioRelayAttemptStatus;
  reservedAt: string;
  result?: TwilioRelayResult;
};

export type TwilioRelayDispatchPlanOptions = {
  existingAttempts?: readonly TwilioRelayAttemptRecord[];
  reservedAt?: string;
};

export type TwilioRelayDispatchPlan = {
  ok: boolean;
  serverOnly: true;
  errors: string[];
  requestsToSend: TwilioRelayExecutionRequest[];
  attemptsToReserve: TwilioRelayAttemptRecord[];
  replayResults: TwilioRelayResult[];
  blocked: TwilioRelayRejectedMessage[];
};

export type TwilioRelaySendPolicyRecentSend = {
  to: string;
  sentAt: string;
  messageId?: string;
};

export type TwilioRelaySendPolicyWindow = {
  start: string;
  end: string;
  label?: string;
};

export type TwilioRelaySendPolicyOptions = {
  now?: string | Date;
  localTime?: string;
  allowedSendWindow?: TwilioRelaySendPolicyWindow;
  maxMessagesPerPhonePerDay?: number;
  recentSends?: readonly TwilioRelaySendPolicyRecentSend[];
  maxBatchSegments?: number;
  candidateMessageIds?: readonly string[];
};

export type TwilioRelaySendPolicyPlan = {
  ok: boolean;
  serverOnly: true;
  errors: string[];
  requestsToSend: TwilioRelayExecutionRequest[];
  blocked: TwilioRelayRejectedMessage[];
};

export type TwilioSmsConsentStatus = "opt-in" | "opt-out" | "unknown";

export type TwilioSmsConsentEvidenceContact = {
  contactId: string;
  role: NonNullable<MessageLog["recipientRole"]>;
  name?: string;
  phone: string;
  consentStatus: TwilioSmsConsentStatus;
  consentUpdatedAt?: string;
  optOutAt?: string;
  evidenceSource?: string;
};

export type TwilioRelayConsentAcceptedMessage = TwilioRelayAcceptedMessage & {
  consent: TwilioSmsConsentEvidenceContact;
};

export type TwilioRelayConsentValidationResult = {
  ok: boolean;
  errors: string[];
  rejected: TwilioRelayRejectedMessage[];
  accepted: TwilioRelayConsentAcceptedMessage[];
};

export type TwilioRelayHealthStatus = "ready" | "degraded" | "not-ready" | "unauthorized";

export type TwilioRelayHealthReadinessChecks = {
  managerAuth: boolean;
  twilioCredentials: boolean;
  senderConfigured: boolean;
  complianceReady: boolean;
  webhookSignatureValidation: boolean;
  relayCanSend: boolean;
};

export type TwilioRelayHealthValidationResult = {
  ok: boolean;
  status?: TwilioRelayHealthStatus;
  checkedAt?: string;
  readinessChecks?: TwilioRelayHealthReadinessChecks;
  errors: string[];
};

export type TwilioFormWebhookParameters = URLSearchParams | Record<string, unknown>;

export type TwilioFormWebhookSignatureInput = {
  authToken: string;
  url: string;
  parameters: TwilioFormWebhookParameters;
};

export type TwilioFormWebhookValidationInput = TwilioFormWebhookSignatureInput & {
  signature: string;
};

export type TwilioStatusCallbackNormalizationOptions = {
  messageId?: string;
  statusCallbackPath?: string;
  statusCallbackUrl?: string;
};

export type TwilioSmsKeyword = "opt-out" | "opt-in";

export type TwilioInboundSmsWebhook = {
  from: string;
  to?: string;
  body: string;
  messageSid?: string;
  keyword?: TwilioSmsKeyword;
};

export type TwilioInboundConsentUpdateStatus = "opt-in" | "opt-out";

export type TwilioInboundConsentPhoneUpdate = {
  phone: string;
  consentStatus: TwilioInboundConsentUpdateStatus;
  consentUpdatedAt: string;
  optOutAt?: string;
  messageSid?: string;
  evidenceSource: "twilio-inbound-keyword";
};

export type TwilioInboundConsentContactUpdate = TwilioInboundConsentPhoneUpdate & {
  contactId: string;
  role: NonNullable<MessageLog["recipientRole"]>;
  name?: string;
};

export type TwilioInboundConsentUpdatePlanOptions = {
  contacts?: unknown;
  receivedAt?: string;
};

export type TwilioInboundConsentUpdatePlan = {
  ok: boolean;
  serverOnly: true;
  errors: string[];
  inboundMessage?: TwilioInboundSmsWebhook;
  keyword?: TwilioSmsKeyword;
  phoneUpdate?: TwilioInboundConsentPhoneUpdate;
  contactUpdates: TwilioInboundConsentContactUpdate[];
  ignoredReason?: string;
};

export type TwilioProviderResponseResultInput = {
  messageId: string;
  httpStatus: number;
  responseBody: unknown;
  fallbackErrorMessage?: string;
};

const validRelayHealthStatuses: ReadonlySet<TwilioRelayHealthStatus> = new Set(["ready", "degraded", "not-ready", "unauthorized"]);
const relayHealthReadinessKeys = [
  "managerAuth",
  "twilioCredentials",
  "senderConfigured",
  "complianceReady",
  "webhookSignatureValidation",
  "relayCanSend"
] as const;
const healthResponseSecretFieldPattern = /(?:TWILIO_AUTH_TOKEN|TWILIO_API_KEY|TWILIO_API_SECRET|ACCOUNT_SID|AUTH_TOKEN|API_SECRET|WEBHOOK_SECRET|PASSWORD|PRIVATE_KEY|VAPID_PRIVATE_KEY)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string) {
  const value = record[field];
  return typeof value === "string" ? value.trim() : "";
}

function numberField(record: Record<string, unknown>, field: string) {
  const value = record[field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringOrNumberField(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function optionalStringField(record: Record<string, unknown>, field: string) {
  const value = stringField(record, field);
  return value || undefined;
}

function hasCredentialLikeField(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => credentialFieldPattern.test(key) || hasCredentialLikeField(item, seen));
}

function hasRelayAttemptPrivateField(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => relayAttemptPrivateFieldPattern.test(key) || hasRelayAttemptPrivateField(item, seen));
}

function hasHealthResponseSecretLikeField(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => {
    if (healthResponseSecretFieldPattern.test(key) && item !== undefined && item !== null) {
      return typeof item !== "string" || item.trim().length > 0;
    }
    return hasHealthResponseSecretLikeField(item, seen);
  });
}

function isE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

function consentIdentityKey(role: string, contactId: string) {
  return `${role}:${contactId}`;
}

function statusCallbackMessageId(path: string) {
  const match = path.match(/^\/api\/messages\/status\/([^/?#]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

function trimmed(value?: string) {
  return value?.trim() ?? "";
}

function formWebhookParameterEntries(parameters: TwilioFormWebhookParameters) {
  const entries = parameters instanceof URLSearchParams
    ? Array.from(parameters.entries())
    : Object.entries(parameters).flatMap(([key, value]) => (value === null || value === undefined ? [] : [[key, String(value)]]));
  return entries.sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
    return 0;
  });
}

function formWebhookParameterRecord(parameters: TwilioFormWebhookParameters) {
  const record: Record<string, string> = {};
  formWebhookParameterEntries(parameters).forEach(([key, value]) => {
    record[key] = value;
  });
  return record;
}

function firstWebhookStringField(record: Record<string, string>, fields: readonly string[]) {
  for (const field of fields) {
    const value = record[field]?.trim();
    if (value) return value;
  }
  return "";
}

function firstProviderStringField(record: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    const value = stringOrNumberField(record, field);
    if (value) return value;
  }
  return "";
}

function normalizeTwilioDeliveryStatus(value: string) {
  const status = value.trim().toLowerCase();
  return validDeliveryStatuses.has(status as TwilioDeliveryStatus) ? (status as TwilioDeliveryStatus) : undefined;
}

function extractTwilioCallbackMessageId(value?: string) {
  if (!value?.trim()) return "";
  const match = value.trim().match(/\/api\/messages\/status\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

export function twilioSmsKeywordForBody(body: string): TwilioSmsKeyword | undefined {
  const keyword = body.trim().split(/\s+/)[0]?.toUpperCase();
  if (!keyword) return undefined;
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(keyword)) return "opt-out";
  if (["START", "YES", "UNSTOP"].includes(keyword)) return "opt-in";
  return undefined;
}

export function validateTwilioRelayHealthResponseForBrowser(payload: unknown): TwilioRelayHealthValidationResult {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return {
      ok: false,
      errors: ["Relay health response must be an object."]
    };
  }

  if (hasHealthResponseSecretLikeField(payload)) errors.push("Relay health response must not include credential-like fields.");

  const rawStatus = stringField(payload, "status");
  const status = validRelayHealthStatuses.has(rawStatus as TwilioRelayHealthStatus) ? (rawStatus as TwilioRelayHealthStatus) : undefined;
  if (!status) errors.push("Relay health status must be ready, degraded, not-ready, or unauthorized.");

  const rawReadinessChecks = payload.readinessChecks;
  let readinessChecks: TwilioRelayHealthReadinessChecks | undefined;
  if (!isRecord(rawReadinessChecks)) {
    errors.push("Relay health response must include credential-free readiness checks.");
  } else {
    const normalizedChecks: Partial<TwilioRelayHealthReadinessChecks> = {};
    relayHealthReadinessKeys.forEach((key) => {
      const value = rawReadinessChecks[key];
      if (typeof value !== "boolean") {
        errors.push(`Relay health readiness check ${key} must be boolean.`);
        return;
      }
      normalizedChecks[key] = value;
    });
    if (relayHealthReadinessKeys.every((key) => typeof normalizedChecks[key] === "boolean")) {
      readinessChecks = normalizedChecks as TwilioRelayHealthReadinessChecks;
    }
  }

  if (status === "ready" && readinessChecks && !Object.values(readinessChecks).every(Boolean)) {
    errors.push("Ready relay health requires all readiness checks to pass.");
  }

  const checkedAt = stringField(payload, "checkedAt");
  return {
    ok: errors.length === 0,
    ...(status ? { status } : {}),
    ...(checkedAt ? { checkedAt } : {}),
    ...(readinessChecks ? { readinessChecks } : {}),
    errors
  };
}

export function validateTwilioRelayConsentEvidenceForServer(payload: unknown, consentEvidence: unknown): TwilioRelayConsentValidationResult {
  const errors: string[] = [];
  const rejected: TwilioRelayRejectedMessage[] = [];
  const accepted: TwilioRelayConsentAcceptedMessage[] = [];

  if (!isRecord(consentEvidence)) {
    return {
      ok: false,
      errors: ["SMS consent evidence must be an object."],
      rejected,
      accepted
    };
  }

  if (hasCredentialLikeField(consentEvidence)) errors.push("SMS consent evidence must not include credential-like fields.");
  if (consentEvidence.schemaVersion !== consentEvidenceSchemaVersion) errors.push(`SMS consent evidence schemaVersion must be ${consentEvidenceSchemaVersion}.`);
  if (consentEvidence.provider !== relayProvider) errors.push(`SMS consent evidence provider must be ${relayProvider}.`);

  const contactsByIdentity = new Map<string, TwilioSmsConsentEvidenceContact>();
  if (!Array.isArray(consentEvidence.contacts)) {
    errors.push("SMS consent evidence contacts must be an array.");
  } else {
    consentEvidence.contacts.forEach((contact, index) => {
      if (!isRecord(contact)) {
        errors.push(`SMS consent evidence contact ${index + 1} must be an object.`);
        return;
      }
      const contactId = stringField(contact, "contactId");
      const role = stringField(contact, "role");
      const phone = stringField(contact, "phone");
      const consentStatus = stringField(contact, "consentStatus");
      const contactErrors: string[] = [];
      if (!contactId) contactErrors.push("contactId is required");
      if (!validRelayRecipientRoles.has(role as NonNullable<MessageLog["recipientRole"]>)) contactErrors.push("role must be student, parent, or staff");
      if (!isE164Phone(phone)) contactErrors.push("phone must be E.164");
      if (!validSmsConsentStatuses.has(consentStatus as TwilioSmsConsentStatus)) contactErrors.push("consentStatus must be opt-in, opt-out, or unknown");
      const consentUpdatedAt = optionalStringField(contact, "consentUpdatedAt");
      if (consentStatus === "opt-in" && !consentUpdatedAt) contactErrors.push("opt-in consentUpdatedAt is required");
      if (contactErrors.length) {
        errors.push(`SMS consent evidence contact ${index + 1}: ${contactErrors.join("; ")}.`);
        return;
      }

      const normalizedContact: TwilioSmsConsentEvidenceContact = {
        contactId,
        role: role as NonNullable<MessageLog["recipientRole"]>,
        name: optionalStringField(contact, "name"),
        phone,
        consentStatus: consentStatus as TwilioSmsConsentStatus,
        consentUpdatedAt,
        optOutAt: optionalStringField(contact, "optOutAt"),
        evidenceSource: optionalStringField(contact, "evidenceSource")
      };
      const identityKey = consentIdentityKey(normalizedContact.role, normalizedContact.contactId);
      if (contactsByIdentity.has(identityKey)) {
        errors.push(`SMS consent evidence has duplicate contact ${identityKey}.`);
        return;
      }
      contactsByIdentity.set(identityKey, normalizedContact);
    });
  }

  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    errors.push("Relay payload messages must be available for consent validation.");
  } else {
    payload.messages.forEach((message, index) => {
      if (!isRecord(message)) {
        rejected.push({ id: `message-${index + 1}`, reasons: ["Relay message must be an object."] });
        return;
      }
      const id = stringField(message, "id") || `message-${index + 1}`;
      const role = stringField(message, "recipientRole");
      const recipientId = stringField(message, "recipientId");
      const to = stringField(message, "to");
      const reasons: string[] = [];
      const relayMessageResult = validateRelayMessage(message, index, { maxSegmentsPerMessage: Number.MAX_SAFE_INTEGER });
      if (relayMessageResult.rejected) reasons.push(...relayMessageResult.rejected.reasons);
      if (!validRelayRecipientRoles.has(role as NonNullable<MessageLog["recipientRole"]>)) reasons.push("Relay message recipient role is required for consent validation.");
      if (!recipientId) reasons.push("Relay message recipient id is required for consent validation.");
      if (!isE164Phone(to)) reasons.push("Relay message recipient phone is required for consent validation.");

      let consent: TwilioSmsConsentEvidenceContact | undefined;
      if (!reasons.length) {
        consent = contactsByIdentity.get(consentIdentityKey(role, recipientId));
        if (!consent) {
          reasons.push("No matching opt-in SMS consent evidence for recipient.");
        } else {
          if (consent.phone !== to) reasons.push("Consent evidence phone does not match relay recipient phone.");
          if (consent.consentStatus !== "opt-in") reasons.push("Recipient does not have opt-in SMS consent evidence.");
          if (consent.consentStatus === "opt-in" && !consent.consentUpdatedAt) reasons.push("Opt-in consent evidence timestamp is required.");
        }
      }

      if (reasons.length || !consent || !relayMessageResult.accepted) {
        rejected.push({ id, reasons });
        return;
      }
      accepted.push({
        message: relayMessageResult.accepted.message,
        consent
      });
    });
  }

  return {
    ok: errors.length === 0 && rejected.length === 0,
    errors,
    rejected,
    accepted: errors.length || rejected.length ? [] : accepted
  };
}

function twilioFormWebhookSignatureBase(url: string, parameters: TwilioFormWebhookParameters) {
  return `${url}${formWebhookParameterEntries(parameters).map(([key, value]) => `${key}${value}`).join("")}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const triplet = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += base64Alphabet[(triplet >> 18) & 63];
    output += base64Alphabet[(triplet >> 12) & 63];
    output += index + 1 < bytes.length ? base64Alphabet[(triplet >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? base64Alphabet[triplet & 63] : "=";
  }
  return output;
}

function constantTimeStringEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

async function hmacSha1Base64(secret: string, value: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto HMAC support is required for Twilio webhook signature validation.");
  const encoder = new TextEncoder();
  const key = await subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64(new Uint8Array(signature));
}

export async function createTwilioFormWebhookSignature(input: TwilioFormWebhookSignatureInput) {
  if (!input.authToken.trim()) throw new Error("Twilio Auth Token is required for webhook signature creation.");
  if (!input.url.trim()) throw new Error("Twilio webhook URL is required for signature creation.");
  return hmacSha1Base64(input.authToken, twilioFormWebhookSignatureBase(input.url, input.parameters));
}

export async function validateTwilioFormWebhookSignature(input: TwilioFormWebhookValidationInput) {
  if (!input.authToken.trim() || !input.url.trim() || !input.signature.trim()) return false;
  const expectedSignature = await createTwilioFormWebhookSignature(input);
  return constantTimeStringEqual(expectedSignature, input.signature.trim());
}

export function normalizeTwilioStatusCallbackForServer(parameters: TwilioFormWebhookParameters, options: TwilioStatusCallbackNormalizationOptions = {}): TwilioRelayResult | undefined {
  const record = formWebhookParameterRecord(parameters);
  const deliveryProviderMessageId = firstWebhookStringField(record, ["deliveryProviderMessageId", "sid", "messageSid", "MessageSid", "SmsSid", "SmsMessageSid"]);
  const id =
    options.messageId?.trim() ||
    firstWebhookStringField(record, ["id", "messageId", "MessageId", "messageLogId", "MessageLogId"]) ||
    extractTwilioCallbackMessageId(options.statusCallbackPath) ||
    extractTwilioCallbackMessageId(options.statusCallbackUrl) ||
    extractTwilioCallbackMessageId(firstWebhookStringField(record, ["statusCallbackPath", "statusCallbackUrl", "StatusCallback"])) ||
    deliveryProviderMessageId;
  const deliveryStatus = normalizeTwilioDeliveryStatus(firstWebhookStringField(record, ["deliveryStatus", "status", "MessageStatus", "messageStatus", "SmsStatus"]));
  if (!id || !deliveryStatus) return undefined;
  const sentAt = firstWebhookStringField(record, ["sentAt", "dateSent", "DateSent"]);
  const deliveryDetail = firstWebhookStringField(record, ["deliveryDetail"]);
  const errorCode = firstWebhookStringField(record, ["errorCode", "ErrorCode"]);
  const errorMessage = firstWebhookStringField(record, ["errorMessage", "ErrorMessage", "ChannelStatusMessage"]);
  return {
    id,
    deliveryStatus,
    ...(deliveryProviderMessageId ? { deliveryProviderMessageId } : {}),
    ...(sentAt ? { sentAt } : {}),
    ...(deliveryDetail ? { deliveryDetail } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(errorMessage ? { errorMessage } : {})
  };
}

export function normalizeTwilioMessageCreateResponseForServer(messageId: string, responseBody: unknown): TwilioRelayResult | undefined {
  const id = messageId.trim();
  if (!id || !isRecord(responseBody)) return undefined;
  const deliveryStatus = normalizeTwilioDeliveryStatus(firstProviderStringField(responseBody, ["deliveryStatus", "status", "Status", "MessageStatus"]));
  if (!deliveryStatus) return undefined;
  const deliveryProviderMessageId = firstProviderStringField(responseBody, ["deliveryProviderMessageId", "sid", "Sid", "messageSid", "MessageSid", "SmsSid", "SmsMessageSid"]);
  const sentAt = firstProviderStringField(responseBody, ["sentAt", "dateSent", "date_sent", "DateSent", "dateCreated", "date_created", "DateCreated"]);
  const errorCode = firstProviderStringField(responseBody, ["errorCode", "error_code", "ErrorCode"]);
  const errorMessage = firstProviderStringField(responseBody, ["errorMessage", "error_message", "ErrorMessage"]);
  return {
    id,
    deliveryStatus,
    ...(deliveryProviderMessageId ? { deliveryProviderMessageId } : {}),
    ...(sentAt ? { sentAt } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(errorMessage ? { errorMessage } : {})
  };
}

export function buildTwilioRelayResultFromProviderResponse(input: TwilioProviderResponseResultInput): TwilioRelayResult {
  const messageId = input.messageId.trim() || "unknown-message";
  const httpStatus = Number.isFinite(input.httpStatus) ? Math.floor(input.httpStatus) : 0;
  if (httpStatus >= 200 && httpStatus < 300) {
    const normalized = normalizeTwilioMessageCreateResponseForServer(messageId, input.responseBody);
    if (normalized) return normalized;
    const errorMessage = input.fallbackErrorMessage?.trim() || "Twilio API response did not include a supported Message resource status.";
    return {
      id: messageId,
      deliveryStatus: "failed",
      deliveryDetail: errorMessage,
      errorMessage
    };
  }

  const record = isRecord(input.responseBody) ? input.responseBody : {};
  const errorCode = firstProviderStringField(record, ["code", "errorCode", "error_code", "ErrorCode"]);
  const errorMessage = firstProviderStringField(record, ["message", "errorMessage", "error_message", "ErrorMessage"]) || input.fallbackErrorMessage?.trim() || "Twilio API request failed.";
  const deliveryProviderMessageId = firstProviderStringField(record, ["sid", "Sid", "messageSid", "MessageSid", "SmsSid", "SmsMessageSid"]);
  return {
    id: messageId,
    deliveryStatus: "failed",
    deliveryDetail: httpStatus ? `Twilio API HTTP ${httpStatus}.` : "Twilio API request failed.",
    ...(deliveryProviderMessageId ? { deliveryProviderMessageId } : {}),
    ...(errorCode ? { errorCode } : {}),
    errorMessage
  };
}

export function normalizeTwilioInboundSmsWebhookForServer(parameters: TwilioFormWebhookParameters): TwilioInboundSmsWebhook | undefined {
  const record = formWebhookParameterRecord(parameters);
  const from = firstWebhookStringField(record, ["From", "from"]);
  const body = firstWebhookStringField(record, ["Body", "body"]);
  if (!from || !body) return undefined;
  const to = firstWebhookStringField(record, ["To", "to"]);
  const messageSid = firstWebhookStringField(record, ["MessageSid", "SmsSid", "SmsMessageSid", "messageSid", "smsSid"]);
  const keyword = twilioSmsKeywordForBody(body);
  return {
    from,
    ...(to ? { to } : {}),
    body,
    ...(messageSid ? { messageSid } : {}),
    ...(keyword ? { keyword } : {})
  };
}

function normalizeInboundConsentContacts(value: unknown) {
  const errors: string[] = [];
  const contacts: TwilioSmsConsentEvidenceContact[] = [];
  if (value === undefined) return { errors, contacts };
  if (hasCredentialLikeField(value)) errors.push("Inbound consent contacts must not include credential-like fields.");

  const rawContacts = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.contacts)
      ? value.contacts
      : undefined;
  if (!rawContacts) {
    errors.push("Inbound consent contacts must be an array.");
    return { errors, contacts };
  }

  rawContacts.forEach((contact, index) => {
    if (!isRecord(contact)) {
      errors.push(`Inbound consent contact ${index + 1} must be an object.`);
      return;
    }
    const contactId = stringField(contact, "contactId");
    const role = stringField(contact, "role");
    const phone = stringField(contact, "phone");
    const contactErrors: string[] = [];
    if (!contactId) contactErrors.push("contactId is required");
    if (!validRelayRecipientRoles.has(role as NonNullable<MessageLog["recipientRole"]>)) contactErrors.push("role must be student, parent, or staff");
    if (!isE164Phone(phone)) contactErrors.push("phone must be E.164");
    const consentStatus = optionalStringField(contact, "consentStatus");
    if (consentStatus && !validSmsConsentStatuses.has(consentStatus as TwilioSmsConsentStatus)) contactErrors.push("consentStatus must be opt-in, opt-out, or unknown");
    if (contactErrors.length) {
      errors.push(`Inbound consent contact ${index + 1}: ${contactErrors.join("; ")}.`);
      return;
    }
    contacts.push({
      contactId,
      role: role as NonNullable<MessageLog["recipientRole"]>,
      name: optionalStringField(contact, "name"),
      phone,
      consentStatus: (consentStatus || "unknown") as TwilioSmsConsentStatus,
      consentUpdatedAt: optionalStringField(contact, "consentUpdatedAt"),
      optOutAt: optionalStringField(contact, "optOutAt"),
      evidenceSource: optionalStringField(contact, "evidenceSource")
    });
  });

  return { errors, contacts };
}

function inboundConsentPhoneUpdate(inboundMessage: TwilioInboundSmsWebhook, consentStatus: TwilioInboundConsentUpdateStatus, receivedAt: string): TwilioInboundConsentPhoneUpdate {
  return {
    phone: inboundMessage.from,
    consentStatus,
    consentUpdatedAt: receivedAt,
    ...(consentStatus === "opt-out" ? { optOutAt: receivedAt } : {}),
    ...(inboundMessage.messageSid ? { messageSid: inboundMessage.messageSid } : {}),
    evidenceSource: "twilio-inbound-keyword"
  };
}

export function buildTwilioInboundConsentUpdatePlanForServer(parameters: TwilioFormWebhookParameters, options: TwilioInboundConsentUpdatePlanOptions = {}): TwilioInboundConsentUpdatePlan {
  const errors: string[] = [];
  const contactUpdates: TwilioInboundConsentContactUpdate[] = [];
  const inboundMessage = normalizeTwilioInboundSmsWebhookForServer(parameters);
  if (!inboundMessage) {
    return {
      ok: false,
      serverOnly: true,
      errors: ["Twilio inbound SMS webhook could not be normalized."],
      contactUpdates
    };
  }

  if (!isE164Phone(inboundMessage.from)) errors.push("Inbound SMS From phone must be E.164 before consent update.");
  const contactPlan = normalizeInboundConsentContacts(options.contacts);
  errors.push(...contactPlan.errors);
  if (errors.length) {
    return {
      ok: false,
      serverOnly: true,
      errors,
      inboundMessage,
      ...(inboundMessage.keyword ? { keyword: inboundMessage.keyword } : {}),
      contactUpdates
    };
  }

  if (!inboundMessage.keyword) {
    return {
      ok: true,
      serverOnly: true,
      errors,
      inboundMessage,
      contactUpdates,
      ignoredReason: "Inbound SMS is not a START/STOP consent keyword."
    };
  }

  const receivedAt = trimmed(options.receivedAt) || new Date().toISOString();
  const consentStatus: TwilioInboundConsentUpdateStatus = inboundMessage.keyword === "opt-out" ? "opt-out" : "opt-in";
  const phoneUpdate = inboundConsentPhoneUpdate(inboundMessage, consentStatus, receivedAt);
  contactPlan.contacts
    .filter((contact) => contact.phone === inboundMessage.from)
    .forEach((contact) => {
      contactUpdates.push({
        ...phoneUpdate,
        contactId: contact.contactId,
        role: contact.role,
        ...(contact.name ? { name: contact.name } : {})
      });
    });

  return {
    ok: true,
    serverOnly: true,
    errors,
    inboundMessage,
    keyword: inboundMessage.keyword,
    phoneUpdate,
    contactUpdates
  };
}

function validateRelayMessage(value: unknown, index: number, options: Required<Pick<TwilioRelayValidationOptions, "maxSegmentsPerMessage">>) {
  if (!isRecord(value)) {
    return {
      rejected: { id: `message-${index + 1}`, reasons: ["Relay message must be an object."] },
      accepted: undefined
    };
  }

  const id = stringField(value, "id") || `message-${index + 1}`;
  const to = stringField(value, "to");
  const body = stringField(value, "body");
  const recipientName = stringField(value, "recipientName");
  const kind = stringField(value, "kind") as MessageLog["kind"];
  const createdAt = stringField(value, "createdAt");
  const smsEncoding = stringField(value, "smsEncoding") as TwilioRelayMessage["smsEncoding"];
  const smsUnitCount = numberField(value, "smsUnitCount");
  const smsSegmentCount = numberField(value, "smsSegmentCount");
  const idempotencyKey = stringField(value, "idempotencyKey");
  const statusCallbackPath = stringField(value, "statusCallbackPath");
  const callbackMessageId = statusCallbackMessageId(statusCallbackPath);
  const reasons: string[] = [];

  if (!stringField(value, "id")) reasons.push("Message id is required.");
  if (!isE164Phone(to)) reasons.push("Recipient phone must be normalized to E.164 before relay send.");
  if (!body) reasons.push("Message body is required.");
  if (!recipientName) reasons.push("Recipient name is required.");
  if (!validMessageKinds.has(kind)) reasons.push("Message kind is not supported by the relay contract.");
  if (!createdAt) reasons.push("Message creation timestamp is required.");
  if (!validSmsEncodings.has(smsEncoding)) reasons.push("SMS encoding metadata must be GSM-7 or UCS-2.");
  if (!isPositiveInteger(smsUnitCount)) reasons.push("SMS unit count must be a positive integer.");
  if (!isPositiveInteger(smsSegmentCount)) {
    reasons.push("SMS segment count must be a positive integer.");
  } else if (smsSegmentCount > options.maxSegmentsPerMessage) {
    reasons.push(`SMS segment count exceeds the relay limit of ${options.maxSegmentsPerMessage}.`);
  }
  if (!idempotencyKey) reasons.push("Message idempotency key is required for duplicate-send protection.");
  if (!callbackMessageId || callbackMessageId !== id) reasons.push("Status callback path must be a relative /api/messages/status/{messageId} path.");
  if (kind === "marketing" && value.optOutLanguageDetected !== true) reasons.push("Marketing SMS must include opt-out language before live Twilio send.");

  if (reasons.length) {
    return { rejected: { id, reasons }, accepted: undefined };
  }

  const message: TwilioRelayMessage = {
    id,
    to,
    body,
    recipientName,
    recipientRole: typeof value.recipientRole === "string" ? (value.recipientRole as MessageLog["recipientRole"]) : undefined,
    recipientId: stringField(value, "recipientId") || undefined,
    kind,
    campaignId: stringField(value, "campaignId") || undefined,
    createdAt,
    smsEncoding,
    smsUnitCount: smsUnitCount as number,
    smsSegmentCount: smsSegmentCount as number,
    optOutLanguageDetected: value.optOutLanguageDetected === true,
    idempotencyKey,
    statusCallbackPath
  };

  return { rejected: undefined, accepted: { message } };
}

export function validateTwilioRelayPayloadForServer(payload: unknown, options: TwilioRelayValidationOptions): TwilioRelayValidationResult {
  const maxMessages = options.maxMessages ?? 100;
  const maxSegmentsPerMessage = options.maxSegmentsPerMessage ?? 3;
  const errors: string[] = [];
  const rejected: TwilioRelayRejectedMessage[] = [];
  const accepted: TwilioRelayAcceptedMessage[] = [];

  if (!isRecord(payload)) {
    return {
      ok: false,
      errors: ["Relay payload must be an object."],
      rejected,
      accepted
    };
  }

  if (hasCredentialLikeField(payload)) errors.push("Payload must not include Twilio credentials or credential-like fields.");
  if (payload.schemaVersion !== relaySchemaVersion) errors.push(`Relay payload schemaVersion must be ${relaySchemaVersion}.`);
  if (payload.provider !== relayProvider) errors.push(`Relay payload provider must be ${relayProvider}.`);
  if (payload.deliveryMode !== relayDeliveryMode) errors.push(`Relay payload deliveryMode must be ${relayDeliveryMode}.`);
  if (!stringField(payload, "generatedAt")) errors.push("Relay payload generatedAt timestamp is required.");

  const requestedBy = payload.requestedBy;
  if (!isRecord(requestedBy) || !stringField(requestedBy, "email")) errors.push("Relay payload must include authenticated manager identity.");
  if (!isRecord(requestedBy) || stringField(requestedBy, "role") !== "staff") errors.push("Relay payload must be requested by an authenticated staff account.");

  if (!Array.isArray(payload.messages)) {
    errors.push("Relay payload messages must be an array.");
  } else {
    if (!payload.messages.length) errors.push("Relay payload must include at least one message.");
    if (payload.messages.length > maxMessages) errors.push(`Relay batch includes ${payload.messages.length} messages but the configured maximum is ${maxMessages}.`);

    const seenIds = new Set<string>();
    const seenIdempotencyKeys = new Set<string>();
    payload.messages.forEach((message, index) => {
      const result = validateRelayMessage(message, index, { maxSegmentsPerMessage });
      if (result.rejected) {
        rejected.push(result.rejected);
        return;
      }
      if (!result.accepted) return;
      if (seenIds.has(result.accepted.message.id)) {
        rejected.push({ id: result.accepted.message.id, reasons: ["Duplicate message id in relay batch."] });
        return;
      }
      seenIds.add(result.accepted.message.id);
      if (seenIdempotencyKeys.has(result.accepted.message.idempotencyKey)) {
        rejected.push({ id: result.accepted.message.id, reasons: ["Duplicate idempotency key in relay batch."] });
        return;
      }
      seenIdempotencyKeys.add(result.accepted.message.idempotencyKey);
      accepted.push(result.accepted);
    });
  }

  return {
    ok: errors.length === 0 && rejected.length === 0,
    errors,
    rejected,
    accepted: errors.length || rejected.length ? [] : accepted
  };
}

export function buildTwilioMessageRequest(message: TwilioRelayMessage, config: TwilioMessageRequestConfig): TwilioMessageRequest {
  const origin = normalizeOrigin(config.origin);
  const messagingServiceSid = trimmed(config.messagingServiceSid);
  const fromNumber = trimmed(config.fromNumber);
  if (!messagingServiceSid && !fromNumber) {
    throw new Error("Twilio sender configuration requires TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.");
  }
  const body = new URLSearchParams({
    To: message.to,
    Body: message.body,
    StatusCallback: new URL(message.statusCallbackPath, origin).toString()
  });
  if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
  if (fromNumber) body.set("From", fromNumber);

  return {
    method: "POST",
    url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid.trim())}/Messages.json`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  };
}

export function buildTwilioBasicAuthHeader(config: TwilioApiAuthConfig) {
  const accountSid = trimmed(config.accountSid);
  const authToken = trimmed(config.authToken);
  const apiKeySid = trimmed(config.apiKeySid);
  const apiKeySecret = trimmed(config.apiKeySecret);
  if ((apiKeySid && !apiKeySecret) || (!apiKeySid && apiKeySecret)) {
    throw new Error("Twilio API key SID and secret must be provided together.");
  }
  const username = apiKeySid || accountSid;
  const password = apiKeySecret || authToken;
  if (!username || !password) {
    throw new Error("Twilio API Basic auth requires an API key pair or Account SID/Auth Token.");
  }
  return `Basic ${bytesToBase64(new TextEncoder().encode(`${username}:${password}`))}`;
}

export function buildTwilioRelayExecutionPlan(payload: unknown, config: TwilioRelayExecutionPlanConfig): TwilioRelayExecutionPlan {
  const validation = validateTwilioRelayPayloadForServer(payload, {
    origin: config.origin,
    maxMessages: config.maxMessages,
    maxSegmentsPerMessage: config.maxSegmentsPerMessage
  });
  const errors = [...validation.errors];
  if (validation.rejected.length) {
    errors.push("Relay payload contains rejected messages.");
  }

  const consentValidation: TwilioRelayConsentValidationResult = config.consentEvidence === undefined
    ? {
        ok: false,
        errors: ["Twilio relay execution plan requires SMS consent evidence before live send."],
        rejected: [],
        accepted: []
      }
    : validateTwilioRelayConsentEvidenceForServer(payload, config.consentEvidence);
  errors.push(...consentValidation.errors);
  if (consentValidation.rejected.length) {
    errors.push("Relay consent evidence contains rejected recipients.");
  }

  let authorizationHeader = "";
  try {
    authorizationHeader = buildTwilioBasicAuthHeader(config);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Twilio API Basic auth configuration is invalid.");
  }

  const requests: TwilioRelayExecutionRequest[] = [];
  if (validation.ok && consentValidation.ok && authorizationHeader) {
    validation.accepted.forEach(({ message }) => {
      try {
        requests.push({
          messageId: message.id,
          relayIdempotencyKey: message.idempotencyKey,
          recipientName: message.recipientName,
          recipientRole: message.recipientRole,
          to: message.to,
          authorizationHeader,
          request: buildTwilioMessageRequest(message, {
            accountSid: config.accountSid,
            messagingServiceSid: config.messagingServiceSid,
            fromNumber: config.fromNumber,
            origin: config.origin
          })
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Could not build Twilio request for ${message.id}.`);
      }
    });
  }

  return {
    ok: validation.ok && errors.length === 0 && requests.length === validation.accepted.length,
    serverOnly: true,
    credentialMode: trimmed(config.apiKeySid) ? "api-key" : trimmed(config.authToken) ? "account-auth-token" : undefined,
    errors,
    validation,
    consentValidation,
    requests
  };
}

function blockRelayRequest(request: TwilioRelayExecutionRequest, reasons: string[]): TwilioRelayRejectedMessage {
  return {
    id: request.messageId || "unknown-message",
    reasons
  };
}

function isTimeKey(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function policyDateKey(value: string | Date | undefined) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : "";
  const text = typeof value === "string" ? value.trim() : new Date().toISOString();
  const dateKey = text.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : "";
}

function policyLocalTime(value: string | Date | undefined, explicitLocalTime?: string) {
  const localTime = trimmed(explicitLocalTime);
  if (isTimeKey(localTime)) return localTime;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  const text = typeof value === "string" ? value.trim() : new Date().toISOString();
  const timeKey = text.includes("T") ? text.slice(11, 16) : "";
  return isTimeKey(timeKey) ? timeKey : "";
}

function isTimeInsideWindow(time: string, window: TwilioRelaySendPolicyWindow) {
  const start = window.start.trim();
  const end = window.end.trim();
  if (start <= end) return time >= start && time <= end;
  return time >= start || time <= end;
}

function relaySendPolicyErrors(options: TwilioRelaySendPolicyOptions) {
  const errors: string[] = [];
  if (options.allowedSendWindow) {
    if (!isTimeKey(options.allowedSendWindow.start)) errors.push("SMS send policy window start must be HH:mm.");
    if (!isTimeKey(options.allowedSendWindow.end)) errors.push("SMS send policy window end must be HH:mm.");
  }
  if (options.maxMessagesPerPhonePerDay !== undefined && (!Number.isInteger(options.maxMessagesPerPhonePerDay) || options.maxMessagesPerPhonePerDay < 1)) {
    errors.push("SMS send policy maxMessagesPerPhonePerDay must be a positive integer.");
  }
  if (options.maxBatchSegments !== undefined && (!Number.isInteger(options.maxBatchSegments) || options.maxBatchSegments < 1)) {
    errors.push("SMS send policy maxBatchSegments must be a positive integer.");
  }
  if (options.recentSends && hasCredentialLikeField(options.recentSends)) {
    errors.push("SMS send policy recent sends must not include credential-like fields.");
  }
  return errors;
}

function existingRelayAttemptBlockingReasons(existing: TwilioRelayAttemptRecord, request: TwilioRelayExecutionRequest) {
  const reasons: string[] = [];
  const existingMessageId = trimmed(existing.messageId);
  if (existingMessageId && existingMessageId !== request.messageId) {
    reasons.push("Relay idempotency key belongs to a different message id.");
  }

  if (existing.result) {
    if (existing.result.id !== request.messageId) {
      reasons.push("Stored relay result does not match the requested message id.");
    }
    if (!validDeliveryStatuses.has(existing.result.deliveryStatus)) {
      reasons.push("Stored relay result has an unsupported delivery status.");
    }
    return reasons;
  }

  if (existing.status === "reserved" || existing.status === "sending") {
    reasons.push("Relay idempotency key is already reserved by an in-flight send attempt.");
    return reasons;
  }

  reasons.push("Completed relay attempt is missing a replayable result.");
  return reasons;
}

export function buildTwilioRelayDispatchPlan(executionPlan: TwilioRelayExecutionPlan, options: TwilioRelayDispatchPlanOptions = {}): TwilioRelayDispatchPlan {
  const errors: string[] = [];
  const requestsToSend: TwilioRelayExecutionRequest[] = [];
  const attemptsToReserve: TwilioRelayAttemptRecord[] = [];
  const replayResults: TwilioRelayResult[] = [];
  const blocked: TwilioRelayRejectedMessage[] = [];
  const existingAttempts = options.existingAttempts ?? [];

  if (!executionPlan.ok) {
    errors.push("Twilio relay execution plan must be ok before dispatch planning.");
  }
  if (hasCredentialLikeField(existingAttempts)) {
    errors.push("Relay attempt ledger must not include credential-like fields.");
  }
  if (hasRelayAttemptPrivateField(existingAttempts)) {
    errors.push("Relay attempt ledger must not include Twilio request material or authorization headers.");
  }

  const existingByIdempotencyKey = new Map<string, TwilioRelayAttemptRecord>();
  const duplicateExistingKeys = new Set<string>();
  existingAttempts.forEach((attempt, index) => {
    const relayIdempotencyKey = trimmed(attempt.relayIdempotencyKey);
    if (!relayIdempotencyKey) {
      errors.push(`Relay attempt ledger entry ${index + 1} is missing an idempotency key.`);
      return;
    }
    if (!trimmed(attempt.messageId)) {
      errors.push(`Relay attempt ledger entry ${index + 1} is missing a message id.`);
    }
    if (!trimmed(attempt.reservedAt)) {
      errors.push(`Relay attempt ledger entry ${index + 1} is missing a reservation timestamp.`);
    }
    if (!validRelayAttemptStatuses.has(attempt.status)) {
      errors.push(`Relay attempt ledger entry ${index + 1} has an unsupported status.`);
    }
    if (existingByIdempotencyKey.has(relayIdempotencyKey)) {
      duplicateExistingKeys.add(relayIdempotencyKey);
      return;
    }
    existingByIdempotencyKey.set(relayIdempotencyKey, attempt);
  });
  duplicateExistingKeys.forEach((key) => {
    errors.push(`Relay attempt ledger has duplicate idempotency key ${key}.`);
  });

  if (errors.length) {
    return {
      ok: false,
      serverOnly: true,
      errors,
      requestsToSend,
      attemptsToReserve,
      replayResults,
      blocked
    };
  }

  const reservedAt = trimmed(options.reservedAt) || new Date().toISOString();
  const plannedKeys = new Set<string>();
  executionPlan.requests.forEach((request) => {
    const relayIdempotencyKey = trimmed(request.relayIdempotencyKey);
    if (!relayIdempotencyKey) {
      blocked.push(blockRelayRequest(request, ["Relay request is missing an idempotency key."]));
      return;
    }
    if (plannedKeys.has(relayIdempotencyKey)) {
      blocked.push(blockRelayRequest(request, ["Relay request duplicates an idempotency key already planned for dispatch."]));
      return;
    }
    plannedKeys.add(relayIdempotencyKey);

    const existing = existingByIdempotencyKey.get(relayIdempotencyKey);
    if (existing) {
      const reasons = existingRelayAttemptBlockingReasons(existing, request);
      if (reasons.length) {
        blocked.push(blockRelayRequest(request, reasons));
        return;
      }
      if (existing.result) {
        replayResults.push(existing.result);
      }
      return;
    }

    requestsToSend.push(request);
    attemptsToReserve.push({
      relayIdempotencyKey,
      messageId: request.messageId,
      recipientName: request.recipientName,
      ...(request.recipientRole ? { recipientRole: request.recipientRole } : {}),
      to: request.to,
      status: "reserved",
      reservedAt
    });
  });

  return {
    ok: blocked.length === 0,
    serverOnly: true,
    errors,
    requestsToSend: blocked.length ? [] : requestsToSend,
    attemptsToReserve: blocked.length ? [] : attemptsToReserve,
    replayResults,
    blocked
  };
}

export function buildTwilioRelaySendPolicyPlan(executionPlan: TwilioRelayExecutionPlan, options: TwilioRelaySendPolicyOptions = {}): TwilioRelaySendPolicyPlan {
  const errors = relaySendPolicyErrors(options);
  const blocked: TwilioRelayRejectedMessage[] = [];
  const requestsToSend: TwilioRelayExecutionRequest[] = [];

  if (!executionPlan.ok) {
    errors.push("Twilio relay execution plan must be ok before send policy planning.");
  }

  const candidateIds = options.candidateMessageIds ? new Set(options.candidateMessageIds.map((id) => id.trim()).filter(Boolean)) : undefined;
  const candidateRequests = executionPlan.requests.filter((request) => !candidateIds || candidateIds.has(request.messageId));
  const messagesById = new Map(executionPlan.validation.accepted.map(({ message }) => [message.id, message]));
  const nowDateKey = policyDateKey(options.now);
  const nowTime = policyLocalTime(options.now, options.localTime);

  if ((options.allowedSendWindow || options.maxMessagesPerPhonePerDay !== undefined) && !nowDateKey) {
    errors.push("SMS send policy requires a valid current date.");
  }
  if (options.allowedSendWindow && !nowTime) {
    errors.push("SMS send policy requires a valid current local time.");
  }

  if (options.maxBatchSegments !== undefined) {
    const totalSegments = candidateRequests.reduce((total, request) => total + (messagesById.get(request.messageId)?.smsSegmentCount ?? 0), 0);
    if (totalSegments > options.maxBatchSegments) {
      errors.push(`Relay batch has ${totalSegments} SMS segments but the configured maximum is ${options.maxBatchSegments}.`);
    }
  }

  if (errors.length) {
    return {
      ok: false,
      serverOnly: true,
      errors,
      requestsToSend,
      blocked
    };
  }

  const sendsByPhoneToday = new Map<string, number>();
  if (options.maxMessagesPerPhonePerDay !== undefined) {
    (options.recentSends ?? []).forEach((send) => {
      const to = trimmed(send.to);
      if (!to || policyDateKey(send.sentAt) !== nowDateKey) return;
      sendsByPhoneToday.set(to, (sendsByPhoneToday.get(to) ?? 0) + 1);
    });
  }

  candidateRequests.forEach((request) => {
    const reasons: string[] = [];
    if (options.allowedSendWindow && !isTimeInsideWindow(nowTime, options.allowedSendWindow)) {
      const label = options.allowedSendWindow.label?.trim() || "local time";
      reasons.push(`Current ${label} is outside the configured SMS send window ${options.allowedSendWindow.start}-${options.allowedSendWindow.end}.`);
    }
    if (options.maxMessagesPerPhonePerDay !== undefined) {
      const sentCount = sendsByPhoneToday.get(request.to) ?? 0;
      if (sentCount >= options.maxMessagesPerPhonePerDay) {
        reasons.push(`Recipient has reached the configured daily SMS limit of ${options.maxMessagesPerPhonePerDay}.`);
      } else {
        sendsByPhoneToday.set(request.to, sentCount + 1);
      }
    }

    if (reasons.length) {
      blocked.push(blockRelayRequest(request, reasons));
      return;
    }
    requestsToSend.push(request);
  });

  return {
    ok: blocked.length === 0,
    serverOnly: true,
    errors,
    requestsToSend: blocked.length ? [] : requestsToSend,
    blocked
  };
}

export function isTwilioRelayPayload(value: unknown): value is TwilioRelayPayload {
  return validateTwilioRelayPayloadForServer(value, { origin: "https://relay.invalid" }).ok;
}
