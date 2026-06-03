import type { AccountRole, TwilioRelayResult } from "./types";
import {
  buildTwilioInboundConsentUpdatePlanForServer,
  buildTwilioRelayDispatchPlan,
  buildTwilioRelayExecutionPlan,
  buildTwilioRelaySendPolicyPlan,
  normalizeTwilioInboundSmsWebhookForServer,
  normalizeTwilioStatusCallbackForServer,
  validateTwilioFormWebhookSignature,
  type TwilioFormWebhookParameters,
  type TwilioInboundConsentUpdatePlan,
  type TwilioInboundConsentUpdatePlanOptions,
  type TwilioInboundSmsWebhook,
  type TwilioRelayDispatchPlan,
  type TwilioRelayDispatchPlanOptions,
  type TwilioRelayExecutionPlan,
  type TwilioRelayExecutionPlanConfig,
  type TwilioRelayHealthReadinessChecks,
  type TwilioRelayHealthStatus,
  type TwilioRelaySendPolicyOptions,
  type TwilioRelaySendPolicyPlan
} from "./twilioRelayContract";
import {
  validateWebPushSubscriptionPayloadForServer,
  type ChoWebPushSubscription
} from "./webPushContract";

type ChoMessagingServerAccountRole = AccountRole;

export type ChoMessagingServerAuthenticatedAccount = {
  email: string;
  role: ChoMessagingServerAccountRole;
  access?: readonly string[];
};

export type ChoMessagingServerHealthResponse = {
  status: TwilioRelayHealthStatus;
  checkedAt: string;
  readinessChecks: TwilioRelayHealthReadinessChecks;
};

export type ChoMessagingServerRequestGateInput = {
  method: string;
  credentialsIncluded: boolean;
  csrfVerified: boolean;
  authenticatedAccount?: ChoMessagingServerAuthenticatedAccount;
  requireStaff?: boolean;
  requiredAccess?: string;
};

export type ChoMessagingServerRequestGateResult = {
  ok: boolean;
  errors: string[];
  authenticatedAccount?: {
    email: string;
    role: ChoMessagingServerAccountRole;
  };
};

export type ChoMessagingServerRelayPlanInput = ChoMessagingServerRequestGateInput & {
  payload: unknown;
  twilio: TwilioRelayExecutionPlanConfig;
  relayDispatch?: TwilioRelayDispatchPlanOptions;
  relaySendPolicy?: TwilioRelaySendPolicyOptions;
};

export type ChoMessagingServerRelayPlan = ChoMessagingServerRequestGateResult & {
  relayExecutionPlan: TwilioRelayExecutionPlan;
  relayDispatchPlan: TwilioRelayDispatchPlan;
  relaySendPolicyPlan: TwilioRelaySendPolicyPlan;
};

export type ChoMessagingServerPushSubscriptionSyncInput = ChoMessagingServerRequestGateInput & {
  payload: unknown;
  allowedOrigin: string;
  allowedPathPrefix?: string;
};

export type ChoMessagingServerPushSubscriptionSyncPlan = ChoMessagingServerRequestGateResult & {
  notificationUrl?: string;
  subscription?: ChoWebPushSubscription;
};

export type ChoMessagingServerTwilioWebhookPlanInput = {
  kind: "inbound" | "status";
  method: string;
  authToken: string;
  url: string;
  signature: string;
  parameters: TwilioFormWebhookParameters;
  consentUpdate?: TwilioInboundConsentUpdatePlanOptions;
};

export type ChoMessagingServerTwilioWebhookPlan = {
  ok: boolean;
  errors: string[];
  inboundMessage?: TwilioInboundSmsWebhook;
  inboundConsentUpdatePlan?: TwilioInboundConsentUpdatePlan;
  statusCallback?: TwilioRelayResult;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string) {
  const value = record[field];
  return typeof value === "string" ? value.trim() : "";
}

function normalizedEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizedMethod(value: string) {
  return value.trim().toUpperCase();
}

function sanitizeAuthenticatedAccount(account?: ChoMessagingServerAuthenticatedAccount) {
  const email = account?.email.trim() ?? "";
  if (!email || !account?.role) return undefined;
  return {
    email,
    role: account.role
  };
}

function sameAccount(left: { email: string; role?: string }, right: { email: string; role?: string }) {
  return normalizedEmail(left.email) === normalizedEmail(right.email) && left.role === right.role;
}

function emptyRelayExecutionPlan(base: TwilioRelayExecutionPlan, errors: string[]): TwilioRelayExecutionPlan {
  return {
    ...base,
    ok: false,
    errors,
    requests: []
  };
}

function emptyRelayDispatchPlan(errors: string[]): TwilioRelayDispatchPlan {
  return {
    ok: false,
    serverOnly: true,
    errors,
    requestsToSend: [],
    attemptsToReserve: [],
    replayResults: [],
    blocked: []
  };
}

function relayDispatchPlanErrors(plan: TwilioRelayDispatchPlan) {
  return [
    ...plan.errors,
    ...plan.blocked.map((item) => `Relay dispatch blocked ${item.id}: ${item.reasons.join("; ")}`)
  ];
}

function emptyRelaySendPolicyPlan(errors: string[]): TwilioRelaySendPolicyPlan {
  return {
    ok: false,
    serverOnly: true,
    errors,
    requestsToSend: [],
    blocked: []
  };
}

function relaySendPolicyPlanErrors(plan: TwilioRelaySendPolicyPlan) {
  return [
    ...plan.errors,
    ...plan.blocked.map((item) => `Relay send policy blocked ${item.id}: ${item.reasons.join("; ")}`)
  ];
}

export function buildChoMessagingServerHealthResponse(input: {
  checkedAt?: string;
  readinessChecks: TwilioRelayHealthReadinessChecks;
}): ChoMessagingServerHealthResponse {
  const checks = input.readinessChecks;
  const allReady = Object.values(checks).every(Boolean);
  const status: TwilioRelayHealthStatus = checks.managerAuth ? (allReady ? "ready" : "not-ready") : "unauthorized";
  return {
    status,
    checkedAt: input.checkedAt?.trim() || new Date().toISOString(),
    readinessChecks: {
      managerAuth: checks.managerAuth,
      twilioCredentials: checks.twilioCredentials,
      senderConfigured: checks.senderConfigured,
      complianceReady: checks.complianceReady,
      webhookSignatureValidation: checks.webhookSignatureValidation,
      relayCanSend: checks.relayCanSend
    }
  };
}

export function validateChoMessagingServerRequestGate(input: ChoMessagingServerRequestGateInput): ChoMessagingServerRequestGateResult {
  const errors: string[] = [];
  const method = normalizedMethod(input.method);
  const account = sanitizeAuthenticatedAccount(input.authenticatedAccount);

  if (method !== "POST") errors.push("Messaging server mutations require POST.");
  if (!input.credentialsIncluded) errors.push("Messaging server requests must include authenticated credentials.");
  if (!input.csrfVerified) errors.push("Messaging server mutations require CSRF verification.");
  if (!account) errors.push("Messaging server request requires an authenticated Cho account.");
  if (input.requireStaff && account?.role !== "staff") errors.push("Messaging server request requires an authenticated staff account.");
  if (input.requiredAccess && Array.isArray(input.authenticatedAccount?.access) && !input.authenticatedAccount.access.includes(input.requiredAccess)) {
    errors.push(`Messaging server account must include ${input.requiredAccess} access.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    ...(account ? { authenticatedAccount: account } : {})
  };
}

export function buildChoMessagingServerRelayPlan(input: ChoMessagingServerRelayPlanInput): ChoMessagingServerRelayPlan {
  const gate = validateChoMessagingServerRequestGate({
    ...input,
    requireStaff: true,
    requiredAccess: input.requiredAccess ?? "messages"
  });
  const errors = [...gate.errors];

  if (!isRecord(input.payload) || !isRecord(input.payload.requestedBy)) {
    errors.push("Relay payload must include requestedBy manager identity.");
  } else if (!gate.authenticatedAccount || !sameAccount(gate.authenticatedAccount, {
    email: stringField(input.payload.requestedBy, "email"),
    role: stringField(input.payload.requestedBy, "role")
  })) {
    errors.push("Relay payload requestedBy must match the authenticated manager session.");
  }

  const relayExecutionPlan = buildTwilioRelayExecutionPlan(input.payload, input.twilio);
  let relayDispatchPlan: TwilioRelayDispatchPlan = emptyRelayDispatchPlan(errors.length ? errors : relayExecutionPlan.errors);
  if (errors.length === 0 && relayExecutionPlan.ok) {
    relayDispatchPlan = buildTwilioRelayDispatchPlan(relayExecutionPlan, input.relayDispatch);
  }
  let relaySendPolicyPlan: TwilioRelaySendPolicyPlan = emptyRelaySendPolicyPlan(errors.length ? errors : relayDispatchPlan.errors);
  if (errors.length === 0 && relayExecutionPlan.ok && relayDispatchPlan.ok) {
    relaySendPolicyPlan = buildTwilioRelaySendPolicyPlan(relayExecutionPlan, {
      ...input.relaySendPolicy,
      candidateMessageIds: relayDispatchPlan.requestsToSend.map((request) => request.messageId)
    });
  }

  const combinedErrors = [...errors, ...relayExecutionPlan.errors, ...relayDispatchPlanErrors(relayDispatchPlan), ...relaySendPolicyPlanErrors(relaySendPolicyPlan)];
  const ok = errors.length === 0 && relayExecutionPlan.ok && relayDispatchPlan.ok && relaySendPolicyPlan.ok;

  return {
    ok,
    errors: combinedErrors,
    ...(gate.authenticatedAccount ? { authenticatedAccount: gate.authenticatedAccount } : {}),
    relayExecutionPlan: ok ? relayExecutionPlan : emptyRelayExecutionPlan(relayExecutionPlan, combinedErrors),
    relayDispatchPlan: ok
      ? {
          ...relayDispatchPlan,
          requestsToSend: relaySendPolicyPlan.requestsToSend,
          attemptsToReserve: relayDispatchPlan.attemptsToReserve.filter((attempt) => relaySendPolicyPlan.requestsToSend.some((request) => request.relayIdempotencyKey === attempt.relayIdempotencyKey))
        }
      : relayDispatchPlan.blocked.length || relayDispatchPlan.errors.length
        ? relayDispatchPlan
        : emptyRelayDispatchPlan(combinedErrors),
    relaySendPolicyPlan: ok || relaySendPolicyPlan.blocked.length || relaySendPolicyPlan.errors.length
      ? relaySendPolicyPlan
      : emptyRelaySendPolicyPlan(combinedErrors)
  };
}

export function buildChoMessagingServerPushSubscriptionSyncPlan(input: ChoMessagingServerPushSubscriptionSyncInput): ChoMessagingServerPushSubscriptionSyncPlan {
  const gate = validateChoMessagingServerRequestGate(input);
  const validation = validateWebPushSubscriptionPayloadForServer(input.payload, {
    allowedOrigin: input.allowedOrigin,
    allowedPathPrefix: input.allowedPathPrefix
  });
  const errors = [...gate.errors, ...validation.errors];

  if (validation.requestedBy && gate.authenticatedAccount && !sameAccount(gate.authenticatedAccount, validation.requestedBy)) {
    errors.push("Web Push subscription requestedBy must match the authenticated Cho account.");
  }

  const ok = errors.length === 0 && validation.ok && Boolean(validation.subscription);
  return {
    ok,
    errors,
    ...(gate.authenticatedAccount ? { authenticatedAccount: gate.authenticatedAccount } : {}),
    ...(ok && validation.notificationUrl ? { notificationUrl: validation.notificationUrl } : {}),
    ...(ok && validation.subscription ? { subscription: validation.subscription } : {})
  };
}

export async function buildChoMessagingServerTwilioWebhookPlan(input: ChoMessagingServerTwilioWebhookPlanInput): Promise<ChoMessagingServerTwilioWebhookPlan> {
  const errors: string[] = [];
  if (normalizedMethod(input.method) !== "POST") errors.push("Twilio webhooks require POST.");
  if (!input.authToken.trim()) errors.push("Twilio Auth Token is required for webhook signature verification.");
  if (!input.url.trim()) errors.push("Twilio webhook URL is required for signature verification.");
  if (!input.signature.trim()) errors.push("Twilio webhook signature is required.");

  let signatureVerified = false;
  if (!errors.length) {
    signatureVerified = await validateTwilioFormWebhookSignature({
      authToken: input.authToken,
      url: input.url,
      signature: input.signature,
      parameters: input.parameters
    });
    if (!signatureVerified) errors.push("Twilio webhook signature verification failed.");
  }

  if (errors.length || !signatureVerified) {
    return {
      ok: false,
      errors
    };
  }

  if (input.kind === "inbound") {
    const inboundMessage = normalizeTwilioInboundSmsWebhookForServer(input.parameters);
    if (!inboundMessage) {
      return {
        ok: false,
        errors: ["Twilio inbound webhook could not be normalized."]
      };
    }
    const inboundConsentUpdatePlan = input.consentUpdate
      ? buildTwilioInboundConsentUpdatePlanForServer(input.parameters, input.consentUpdate)
      : undefined;
    if (inboundConsentUpdatePlan && !inboundConsentUpdatePlan.ok) {
      return {
        ok: false,
        errors: inboundConsentUpdatePlan.errors,
        inboundMessage,
        inboundConsentUpdatePlan
      };
    }
    return {
      ok: true,
      errors: [],
      inboundMessage,
      ...(inboundConsentUpdatePlan ? { inboundConsentUpdatePlan } : {})
    };
  }

  const statusCallback = normalizeTwilioStatusCallbackForServer(input.parameters, {
    statusCallbackUrl: input.url
  });
  if (!statusCallback) {
    return {
      ok: false,
      errors: ["Twilio status webhook could not be normalized."]
    };
  }
  return {
    ok: true,
    errors: [],
    statusCallback
  };
}
