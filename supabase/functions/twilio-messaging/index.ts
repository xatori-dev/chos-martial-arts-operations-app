import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const relaySchemaVersion = "chos-twilio-relay.v1";
const relayProvider = "twilio";
const relayDeliveryMode = "server-relay";
const consentEvidenceSchemaVersion = "chos-sms-consent-evidence.v1";
const managerUsername = "manager123";
const validMessageKinds = new Set(["welcome", "reminder", "follow-up", "marketing", "celebration", "profile-update"]);
const validDeliveryStatuses = new Set(["accepted", "scheduled", "queued", "sending", "sent", "delivered", "undelivered", "failed", "canceled"]);
const failedDeliveryStatuses = new Set(["failed", "undelivered", "canceled"]);
const validRecipientRoles = new Set(["student", "parent", "staff"]);
const credentialFieldPattern = /(?:TWILIO_|AUTH_TOKEN|ACCOUNT_SID|API_KEY|SECRET|PASSWORD|PRIVATE_KEY|CREDENTIAL|authorization)/i;
const defaultMaxMessages = 100;
const defaultMaxSegmentsPerMessage = 3;

type SupabaseClientLike = ReturnType<typeof createClient>;

type AuthenticatedManager = {
  userId: string;
  email: string;
  role: "staff";
};

type RelayMessage = {
  id: string;
  to: string;
  body: string;
  recipientName: string;
  recipientRole: "student" | "parent" | "staff";
  recipientId: string;
  kind: string;
  campaignId?: string;
  createdAt: string;
  smsEncoding: "GSM-7" | "UCS-2";
  smsUnitCount: number;
  smsSegmentCount: number;
  optOutLanguageDetected: boolean;
  idempotencyKey: string;
};

type RelayPayload = {
  requestedBy?: {
    email?: string;
    role?: string;
  };
  messages?: unknown[];
};

type RelayResult = {
  id: string;
  deliveryStatus: string;
  deliveryProviderMessageId?: string;
  sentAt?: string;
  deliveryDetail?: string;
  errorCode?: string;
  errorMessage?: string;
};

type ConsentRecord = {
  role: "student" | "parent" | "staff";
  contact_id: string;
  name: string | null;
  phone: string;
  consent_status: "opt-in" | "opt-out" | "unknown";
  consent_updated_at: string | null;
  opt_out_at: string | null;
  evidence_source: string | null;
};

type RelayAttemptRecord = {
  relay_idempotency_key: string;
  message_id: string;
  status: "reserved" | "sending" | "sent" | "failed";
  result: RelayResult | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function textResponse(body: string, status = 200, contentType = "text/plain") {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": contentType }
  });
}

function env(name: string) {
  return Deno.env.get(name)?.trim() ?? "";
}

function envBoolean(name: string) {
  return /^(?:1|true|yes|approved|ready)$/i.test(env(name));
}

function envInteger(name: string, fallback: number) {
  const value = Number(env(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

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

function hasCredentialLikeField(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => credentialFieldPattern.test(key) || hasCredentialLikeField(item, seen));
}

function isE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function normalizePathname(req: Request) {
  const pathname = new URL(req.url).pathname;
  const match =
    pathname.match(/\/functions\/v1\/twilio-messaging(?:\/(.*))?$/) ??
    pathname.match(/\/twilio-messaging(?:\/(.*))?$/);
  return (match?.[1] ?? "").replace(/^\/+|\/+$/g, "");
}

function functionBaseUrl(req: Request) {
  const configured = env("TWILIO_FUNCTION_PUBLIC_URL").replace(/\/+$/g, "");
  if (configured) return configured;
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/(?:send|health|consent|inbound|status(?:\/[^/]+)?)\/?$/i, "");
  return `${url.origin}${pathname}`.replace(/\/+$/g, "");
}

function callbackUrl(req: Request, kind: "inbound" | "status", messageId?: string) {
  const baseUrl = functionBaseUrl(req);
  if (kind === "status") return `${baseUrl}/status/${encodeURIComponent(messageId ?? "")}`;
  return `${baseUrl}/inbound`;
}

function bearerToken(req: Request) {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

function createUserClient(token: string) {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
}

function createServiceClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });
}

function supabaseReady() {
  return Boolean(env("SUPABASE_URL") && env("SUPABASE_ANON_KEY") && env("SUPABASE_SERVICE_ROLE_KEY"));
}

async function authenticateManager(req: Request): Promise<{ ok: true; manager: AuthenticatedManager } | { ok: false; error: string; status: number }> {
  if (!supabaseReady()) return { ok: false, error: "Supabase function secrets are not configured.", status: 500 };
  const token = bearerToken(req);
  if (!token) return { ok: false, error: "Missing manager session.", status: 401 };

  const userClient = createUserClient(token);
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return { ok: false, error: "Invalid manager session.", status: 401 };

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id, username, role, status, is_owner")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.username !== managerUsername ||
    profile.role !== "staff" ||
    profile.status !== "active" ||
    profile.is_owner !== true
  ) {
    return { ok: false, error: "Only the Manager123 owner account can send live Twilio messages.", status: 403 };
  }

  return {
    ok: true,
    manager: {
      userId: authData.user.id,
      email: "manager123@chos.prototype",
      role: "staff"
    }
  };
}

function twilioCredentialsReady() {
  const hasApiKeyPair = Boolean(env("TWILIO_API_KEY") && env("TWILIO_API_KEY_SECRET"));
  return Boolean(env("TWILIO_ACCOUNT_SID") && (hasApiKeyPair || env("TWILIO_AUTH_TOKEN")));
}

function twilioSenderReady() {
  return Boolean(env("TWILIO_MESSAGING_SERVICE_SID") || env("TWILIO_FROM_NUMBER"));
}

function twilioComplianceReady() {
  if (envBoolean("TWILIO_SENDER_COMPLIANCE_READY")) return true;
  const senderType = env("TWILIO_SENDER_TYPE").toLowerCase();
  if (senderType === "10dlc") return envBoolean("TWILIO_A2P_BRAND_APPROVED") && envBoolean("TWILIO_A2P_CAMPAIGN_APPROVED");
  if (senderType === "toll-free") return envBoolean("TWILIO_TOLL_FREE_VERIFICATION_APPROVED");
  return false;
}

function twilioWebhookSignatureReady() {
  return Boolean(env("TWILIO_AUTH_TOKEN"));
}

function twilioBasicAuthHeader() {
  const username = env("TWILIO_API_KEY") || env("TWILIO_ACCOUNT_SID");
  const password = env("TWILIO_API_KEY_SECRET") || env("TWILIO_AUTH_TOKEN");
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function relayHealth(managerAuth: boolean) {
  const readinessChecks = {
    managerAuth,
    twilioCredentials: managerAuth && twilioCredentialsReady(),
    senderConfigured: managerAuth && twilioSenderReady(),
    complianceReady: managerAuth && twilioComplianceReady(),
    webhookSignatureValidation: managerAuth && twilioWebhookSignatureReady(),
    relayCanSend: false
  };
  readinessChecks.relayCanSend = Object.values(readinessChecks).every(Boolean);
  return {
    status: managerAuth ? (readinessChecks.relayCanSend ? "ready" : "not-ready") : "unauthorized",
    checkedAt: new Date().toISOString(),
    readinessChecks
  };
}

async function parseJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

async function parseForm(req: Request) {
  const body = await req.text();
  return new URLSearchParams(body);
}

function normalizeDeliveryStatus(value: string) {
  const status = value.trim().toLowerCase();
  return validDeliveryStatuses.has(status) ? status : "";
}

function normalizeRelayResult(messageId: string, httpStatus: number, responseBody: unknown): RelayResult {
  const record = isRecord(responseBody) ? responseBody : {};
  if (httpStatus >= 200 && httpStatus < 300) {
    const deliveryStatus = normalizeDeliveryStatus(stringField(record, "status") || stringField(record, "deliveryStatus") || "queued");
    const providerSid = stringField(record, "sid") || stringField(record, "messageSid");
    const sentAt = stringField(record, "date_sent") || stringField(record, "dateSent") || stringField(record, "date_created") || stringField(record, "dateCreated");
    return {
      id: messageId,
      deliveryStatus: deliveryStatus || "queued",
      ...(providerSid ? { deliveryProviderMessageId: providerSid } : {}),
      ...(sentAt ? { sentAt } : {})
    };
  }

  const errorCode = String(record.code ?? record.error_code ?? record.ErrorCode ?? "").trim();
  const errorMessage = stringField(record, "message") || stringField(record, "error_message") || "Twilio API request failed.";
  return {
    id: messageId,
    deliveryStatus: "failed",
    deliveryDetail: `Twilio API HTTP ${httpStatus}.`,
    ...(errorCode ? { errorCode } : {}),
    errorMessage
  };
}

function normalizeStatusCallback(parameters: URLSearchParams, req: Request, pathMessageId?: string): RelayResult | undefined {
  const providerSid = parameters.get("MessageSid")?.trim() || parameters.get("SmsSid")?.trim() || "";
  const status = normalizeDeliveryStatus(parameters.get("MessageStatus") ?? parameters.get("SmsStatus") ?? "");
  const messageId = pathMessageId?.trim() || parameters.get("messageId")?.trim() || providerSid;
  if (!messageId || !status) return undefined;
  const sentAt = parameters.get("DateSent")?.trim() || undefined;
  const errorCode = parameters.get("ErrorCode")?.trim() || undefined;
  const errorMessage = parameters.get("ErrorMessage")?.trim() || parameters.get("ChannelStatusMessage")?.trim() || undefined;
  return {
    id: messageId,
    deliveryStatus: status,
    ...(providerSid ? { deliveryProviderMessageId: providerSid } : {}),
    ...(sentAt ? { sentAt } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    deliveryDetail: `Twilio status callback ${callbackUrl(req, "status", messageId)}`
  };
}

function inboundKeyword(body: string) {
  const keyword = body.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(keyword)) return "opt-out";
  if (["START", "YES", "UNSTOP"].includes(keyword)) return "opt-in";
  return "";
}

async function hmacSha1Base64(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const bytes = new Uint8Array(signature);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function twilioSignatureBase(url: string, parameters: URLSearchParams) {
  const pairs = Array.from(parameters.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
    return 0;
  });
  return `${url}${pairs.map(([key, value]) => `${key}${value}`).join("")}`;
}

async function verifyTwilioSignature(req: Request, parameters: URLSearchParams, publicUrl: string) {
  const authToken = env("TWILIO_AUTH_TOKEN");
  const signature = req.headers.get("X-Twilio-Signature")?.trim() ?? "";
  if (!authToken || !signature) return false;
  const expected = await hmacSha1Base64(authToken, twilioSignatureBase(publicUrl, parameters));
  return expected === signature;
}

function validateRelayPayload(payload: unknown, manager: AuthenticatedManager) {
  const errors: string[] = [];
  const messages: RelayMessage[] = [];
  if (!isRecord(payload)) return { ok: false, errors: ["Relay payload must be an object."], messages };
  if (hasCredentialLikeField(payload)) errors.push("Relay payload must not include credential-like fields.");
  if (payload.schemaVersion !== relaySchemaVersion) errors.push(`Relay payload schemaVersion must be ${relaySchemaVersion}.`);
  if (payload.provider !== relayProvider) errors.push(`Relay payload provider must be ${relayProvider}.`);
  if (payload.deliveryMode !== relayDeliveryMode) errors.push(`Relay payload deliveryMode must be ${relayDeliveryMode}.`);
  if (!stringField(payload, "generatedAt")) errors.push("Relay payload generatedAt timestamp is required.");

  const typedPayload = payload as RelayPayload;
  if (!isRecord(typedPayload.requestedBy) || typedPayload.requestedBy.email !== manager.email || typedPayload.requestedBy.role !== manager.role) {
    errors.push("Relay payload requestedBy must match the authenticated manager session.");
  }

  const maxMessages = envInteger("TWILIO_MAX_MESSAGES_PER_BATCH", defaultMaxMessages);
  const maxSegmentsPerMessage = envInteger("TWILIO_MAX_SEGMENTS_PER_MESSAGE", defaultMaxSegmentsPerMessage);
  const rawMessages = Array.isArray(typedPayload.messages) ? typedPayload.messages : [];
  if (!rawMessages.length) errors.push("Relay payload must include at least one message.");
  if (rawMessages.length > maxMessages) errors.push(`Relay batch includes ${rawMessages.length} messages but the configured maximum is ${maxMessages}.`);

  const seenMessageIds = new Set<string>();
  const seenIdempotencyKeys = new Set<string>();
  rawMessages.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`Relay message ${index + 1} must be an object.`);
      return;
    }
    const id = stringField(item, "id");
    const to = stringField(item, "to");
    const body = stringField(item, "body");
    const recipientName = stringField(item, "recipientName");
    const recipientRole = stringField(item, "recipientRole");
    const recipientId = stringField(item, "recipientId");
    const kind = stringField(item, "kind");
    const createdAt = stringField(item, "createdAt");
    const smsEncoding = stringField(item, "smsEncoding");
    const smsUnitCount = numberField(item, "smsUnitCount");
    const smsSegmentCount = numberField(item, "smsSegmentCount");
    const idempotencyKey = stringField(item, "idempotencyKey");
    const messageErrors: string[] = [];
    if (!id) messageErrors.push("id is required");
    if (seenMessageIds.has(id)) messageErrors.push("id must be unique");
    if (!isE164Phone(to)) messageErrors.push("to must be E.164");
    if (!body) messageErrors.push("body is required");
    if (!recipientName) messageErrors.push("recipientName is required");
    if (!validRecipientRoles.has(recipientRole)) messageErrors.push("recipientRole must be student, parent, or staff");
    if (!recipientId) messageErrors.push("recipientId is required");
    if (!validMessageKinds.has(kind)) messageErrors.push("kind is not supported");
    if (!createdAt) messageErrors.push("createdAt is required");
    if (smsEncoding !== "GSM-7" && smsEncoding !== "UCS-2") messageErrors.push("smsEncoding must be GSM-7 or UCS-2");
    if (!Number.isInteger(smsUnitCount) || (smsUnitCount ?? 0) < 1) messageErrors.push("smsUnitCount must be positive");
    if (!Number.isInteger(smsSegmentCount) || (smsSegmentCount ?? 0) < 1) {
      messageErrors.push("smsSegmentCount must be positive");
    } else if ((smsSegmentCount ?? 0) > maxSegmentsPerMessage) {
      messageErrors.push(`smsSegmentCount exceeds ${maxSegmentsPerMessage}`);
    }
    if (!idempotencyKey) messageErrors.push("idempotencyKey is required");
    if (seenIdempotencyKeys.has(idempotencyKey)) messageErrors.push("idempotencyKey must be unique");
    if (kind === "marketing" && item.optOutLanguageDetected !== true) messageErrors.push("marketing SMS must include opt-out language");

    if (messageErrors.length) {
      errors.push(`Relay message ${id || index + 1}: ${messageErrors.join("; ")}.`);
      return;
    }
    seenMessageIds.add(id);
    seenIdempotencyKeys.add(idempotencyKey);
    messages.push({
      id,
      to,
      body,
      recipientName,
      recipientRole: recipientRole as RelayMessage["recipientRole"],
      recipientId,
      kind,
      campaignId: stringField(item, "campaignId") || undefined,
      createdAt,
      smsEncoding: smsEncoding as RelayMessage["smsEncoding"],
      smsUnitCount: smsUnitCount as number,
      smsSegmentCount: smsSegmentCount as number,
      optOutLanguageDetected: item.optOutLanguageDetected === true,
      idempotencyKey
    });
  });

  return { ok: errors.length === 0, errors, messages: errors.length ? [] : messages };
}

async function loadConsentRecords(serviceClient: SupabaseClientLike, messages: readonly RelayMessage[]) {
  const phones = [...new Set(messages.map((message) => message.to))];
  if (!phones.length) return [];
  const { data, error } = await serviceClient
    .from("sms_consent_records")
    .select("role,contact_id,name,phone,consent_status,consent_updated_at,opt_out_at,evidence_source")
    .in("phone", phones);
  if (error) throw new Error(error.message);
  return (data ?? []) as ConsentRecord[];
}

function validateConsent(messages: readonly RelayMessage[], records: readonly ConsentRecord[]) {
  const errors: string[] = [];
  const recordsByIdentity = new Map(records.map((record) => [`${record.role}:${record.contact_id}`, record]));
  messages.forEach((message) => {
    const consent = recordsByIdentity.get(`${message.recipientRole}:${message.recipientId}`);
    if (!consent) {
      errors.push(`${message.id}: no server SMS consent record for ${message.recipientRole}:${message.recipientId}.`);
      return;
    }
    if (consent.phone !== message.to) errors.push(`${message.id}: consent phone does not match relay recipient.`);
    if (consent.consent_status !== "opt-in" || !consent.consent_updated_at || consent.opt_out_at) {
      errors.push(`${message.id}: recipient is not opted in for live SMS.`);
    }
  });
  return errors;
}

async function loadRelayAttempts(serviceClient: SupabaseClientLike, messages: readonly RelayMessage[]) {
  const keys = [...new Set(messages.map((message) => message.idempotencyKey))];
  if (!keys.length) return [];
  const { data, error } = await serviceClient
    .from("twilio_relay_attempts")
    .select("relay_idempotency_key,message_id,status,result")
    .in("relay_idempotency_key", keys);
  if (error) throw new Error(error.message);
  return (data ?? []) as RelayAttemptRecord[];
}

async function reserveRelayAttempts(serviceClient: SupabaseClientLike, messages: readonly RelayMessage[], manager: AuthenticatedManager) {
  const now = new Date().toISOString();
  const { error } = await serviceClient
    .from("twilio_relay_attempts")
    .upsert(messages.map((message) => ({
      relay_idempotency_key: message.idempotencyKey,
      message_id: message.id,
      recipient_name: message.recipientName,
      recipient_role: message.recipientRole,
      recipient_phone: message.to,
      status: "reserved",
      reserved_at: now,
      created_by: manager.userId
    })), { onConflict: "relay_idempotency_key", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

function messageLogStatusForResult(result: RelayResult) {
  return failedDeliveryStatuses.has(result.deliveryStatus) ? "failed" : "sent";
}

async function applyRelayResult(serviceClient: SupabaseClientLike, result: RelayResult, idempotencyKey: string) {
  const now = new Date().toISOString();
  const sentAt = result.sentAt || now;
  const attemptStatus = failedDeliveryStatuses.has(result.deliveryStatus) ? "failed" : "sent";
  const attemptUpdate = {
    status: attemptStatus,
    sent_at: sentAt,
    delivery_provider_message_id: result.deliveryProviderMessageId ?? null,
    delivery_status: result.deliveryStatus,
    delivery_detail: result.deliveryDetail ?? null,
    error_code: result.errorCode ?? null,
    error_message: result.errorMessage ?? null,
    result
  };
  const { error: attemptError } = await serviceClient
    .from("twilio_relay_attempts")
    .update(attemptUpdate)
    .eq("relay_idempotency_key", idempotencyKey);
  if (attemptError) throw new Error(attemptError.message);

  const { error: messageError } = await serviceClient
    .from("message_logs")
    .update({
      status: messageLogStatusForResult(result),
      sent_at: sentAt,
      delivery_channel: "sms",
      delivery_provider: "twilio",
      delivery_mode: "live",
      delivery_status: result.deliveryStatus,
      delivery_detail: result.deliveryDetail ?? result.errorMessage ?? null,
      delivery_provider_message_id: result.deliveryProviderMessageId ?? null
    })
    .eq("id", result.id);
  if (messageError) throw new Error(messageError.message);
}

async function sendTwilioMessage(req: Request, message: RelayMessage) {
  const body = new URLSearchParams({
    To: message.to,
    Body: message.body,
    StatusCallback: callbackUrl(req, "status", message.id)
  });
  const messagingServiceSid = env("TWILIO_MESSAGING_SERVICE_SID");
  if (messagingServiceSid) {
    body.set("MessagingServiceSid", messagingServiceSid);
  } else {
    body.set("From", env("TWILIO_FROM_NUMBER"));
  }

  let responseBody: unknown;
  let status = 0;
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env("TWILIO_ACCOUNT_SID"))}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: twilioBasicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
    status = response.status;
    responseBody = await response.json().catch(() => undefined);
  } catch (error) {
    return {
      id: message.id,
      deliveryStatus: "failed",
      deliveryDetail: "Twilio API request failed before receiving a response.",
      errorMessage: error instanceof Error ? error.message : "Twilio API request failed."
    };
  }
  return normalizeRelayResult(message.id, status, responseBody);
}

async function handleHealth(req: Request) {
  const auth = await authenticateManager(req);
  return jsonResponse(relayHealth(auth.ok));
}

async function handleConsentSync(req: Request) {
  const auth = await authenticateManager(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);
  const payload = await parseJson(req);
  if (!isRecord(payload) || payload.schemaVersion !== consentEvidenceSchemaVersion || payload.provider !== relayProvider || !Array.isArray(payload.contacts)) {
    return jsonResponse({ error: "SMS consent evidence payload is invalid." }, 400);
  }
  if (hasCredentialLikeField(payload)) return jsonResponse({ error: "SMS consent evidence must not include credential-like fields." }, 400);

  const rows = payload.contacts.flatMap((contact: unknown) => {
    if (!isRecord(contact)) return [];
    const role = stringField(contact, "role");
    const contactId = stringField(contact, "contactId");
    const phone = stringField(contact, "phone");
    const consentStatus = stringField(contact, "consentStatus") || "unknown";
    if (!validRecipientRoles.has(role) || !contactId || !isE164Phone(phone) || !["opt-in", "opt-out", "unknown"].includes(consentStatus)) return [];
    return [{
      role,
      contact_id: contactId,
      name: stringField(contact, "name") || null,
      phone,
      consent_status: consentStatus,
      consent_updated_at: stringField(contact, "consentUpdatedAt") || null,
      opt_out_at: stringField(contact, "optOutAt") || null,
      evidence_source: stringField(contact, "evidenceSource") || null,
      updated_by: auth.manager.userId
    }];
  });

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from("sms_consent_records")
    .upsert(rows, { onConflict: "role,contact_id" });
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ synced: rows.length });
}

async function handleSend(req: Request) {
  const auth = await authenticateManager(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);
  const health = relayHealth(true);
  if (health.status !== "ready") return jsonResponse({ error: "Twilio relay is not ready for live sends.", health }, 503);

  const payload = await parseJson(req);
  const validation = validateRelayPayload(payload, auth.manager);
  if (!validation.ok) return jsonResponse({ error: "Relay payload failed validation.", errors: validation.errors }, 400);

  const serviceClient = createServiceClient();
  try {
    const consentRecords = await loadConsentRecords(serviceClient, validation.messages);
    const consentErrors = validateConsent(validation.messages, consentRecords);
    if (consentErrors.length) return jsonResponse({ error: "Relay payload failed server consent validation.", errors: consentErrors }, 409);

    const existingAttempts = await loadRelayAttempts(serviceClient, validation.messages);
    const replayResults: RelayResult[] = [];
    const blocked: string[] = [];
    const existingByKey = new Map(existingAttempts.map((attempt) => [attempt.relay_idempotency_key, attempt]));
    const messagesToSend = validation.messages.filter((message) => {
      const attempt = existingByKey.get(message.idempotencyKey);
      if (!attempt) return true;
      if (attempt.message_id !== message.id) {
        blocked.push(`${message.id}: idempotency key belongs to another message.`);
        return false;
      }
      if (attempt.result) {
        replayResults.push(attempt.result);
        return false;
      }
      blocked.push(`${message.id}: idempotency key is already ${attempt.status}.`);
      return false;
    });
    if (blocked.length) return jsonResponse({ error: "Relay dispatch blocked duplicate or in-flight sends.", errors: blocked }, 409);

    await reserveRelayAttempts(serviceClient, messagesToSend, auth.manager);
    const results: RelayResult[] = [...replayResults];
    for (const message of messagesToSend) {
      await serviceClient.from("twilio_relay_attempts").update({ status: "sending" }).eq("relay_idempotency_key", message.idempotencyKey);
      const result = await sendTwilioMessage(req, message);
      await applyRelayResult(serviceClient, result, message.idempotencyKey);
      results.push(result);
    }
    return jsonResponse({ results });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Twilio relay send failed." }, 500);
  }
}

async function handleInbound(req: Request) {
  const parameters = await parseForm(req);
  const publicUrl = callbackUrl(req, "inbound");
  if (!(await verifyTwilioSignature(req, parameters, publicUrl))) return textResponse("Forbidden", 403);

  const from = parameters.get("From")?.trim() ?? "";
  const body = parameters.get("Body")?.trim() ?? "";
  const messageSid = parameters.get("MessageSid")?.trim() || parameters.get("SmsSid")?.trim() || "";
  const keyword = inboundKeyword(body);
  const serviceClient = createServiceClient();

  if (keyword && isE164Phone(from)) {
    const now = new Date().toISOString();
    await serviceClient
      .from("sms_consent_records")
      .update({
        consent_status: keyword,
        consent_updated_at: now,
        opt_out_at: keyword === "opt-out" ? now : null,
        evidence_source: "twilio-inbound-keyword",
        twilio_message_sid: messageSid || null
      })
      .eq("phone", from);
  } else if (from && body && messageSid) {
    const { data: contacts } = await serviceClient
      .from("sms_consent_records")
      .select("role,contact_id,name,phone")
      .eq("phone", from)
      .limit(1);
    const contact = Array.isArray(contacts) ? contacts[0] : undefined;
    if (contact?.contact_id) {
      const senderId = contact.contact_id;
      const recipientId = "direct-staff-seed";
      await serviceClient.from("direct_messages").upsert({
        id: `twilio-${messageSid}`,
        thread_id: [recipientId, senderId].sort().join("__"),
        sender_id: senderId,
        sender_name: contact.name || from,
        recipient_id: recipientId,
        recipient_name: "Cho's Manager",
        body,
        status: "sent",
        created_at: new Date().toISOString()
      }, { onConflict: "id" });
    }
  }

  return textResponse("<Response></Response>", 200, "text/xml");
}

async function handleStatus(req: Request, pathMessageId?: string) {
  const parameters = await parseForm(req);
  const publicUrl = callbackUrl(req, "status", pathMessageId);
  if (!(await verifyTwilioSignature(req, parameters, publicUrl))) return textResponse("Forbidden", 403);
  const result = normalizeStatusCallback(parameters, req, pathMessageId);
  if (!result) return textResponse("", 204);

  const serviceClient = createServiceClient();
  const update = {
    status: messageLogStatusForResult(result),
    sent_at: result.sentAt ?? new Date().toISOString(),
    delivery_channel: "sms",
    delivery_provider: "twilio",
    delivery_mode: "live",
    delivery_status: result.deliveryStatus,
    delivery_detail: result.deliveryDetail ?? result.errorMessage ?? null,
    delivery_provider_message_id: result.deliveryProviderMessageId ?? null
  };
  if (pathMessageId) {
    await serviceClient.from("message_logs").update(update).eq("id", pathMessageId);
  } else if (result.deliveryProviderMessageId) {
    await serviceClient.from("message_logs").update(update).eq("delivery_provider_message_id", result.deliveryProviderMessageId);
  }
  await serviceClient
    .from("twilio_relay_attempts")
    .update({
      status: failedDeliveryStatuses.has(result.deliveryStatus) ? "failed" : "sent",
      delivery_provider_message_id: result.deliveryProviderMessageId ?? null,
      delivery_status: result.deliveryStatus,
      delivery_detail: result.deliveryDetail ?? null,
      error_code: result.errorCode ?? null,
      error_message: result.errorMessage ?? null,
      result
    })
    .or(`message_id.eq.${result.id},delivery_provider_message_id.eq.${result.deliveryProviderMessageId ?? ""}`);
  return textResponse("", 204);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const route = normalizePathname(req);
  if (req.method === "GET" && (!route || route === "health")) return handleHealth(req);
  if (req.method === "POST" && (!route || route === "send")) return handleSend(req);
  if (req.method === "POST" && route === "consent") return handleConsentSync(req);
  if (req.method === "POST" && route === "inbound") return handleInbound(req);
  const statusMatch = route.match(/^status(?:\/(.+))?$/);
  if (req.method === "POST" && statusMatch) return handleStatus(req, statusMatch[1] ? decodeURIComponent(statusMatch[1]) : undefined);
  return jsonResponse({ error: "Not found." }, 404);
});
