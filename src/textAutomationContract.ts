import {
  buildTwilioRelayDispatchPlan,
  buildTwilioRelayExecutionPlan,
  buildTwilioRelaySendPolicyPlan,
  type TwilioRelayDispatchPlan,
  type TwilioRelayDispatchPlanOptions,
  type TwilioRelayExecutionPlan,
  type TwilioRelayExecutionPlanConfig,
  type TwilioRelaySendPolicyOptions,
  type TwilioRelaySendPolicyPlan
} from "./twilioRelayContract";
import { buildChoWebPushDeliveryPlan, type ChoWebPushDeliveryPlan, type ChoWebPushNotificationInput, type WebPushDeliveryPlanOptions } from "./webPushContract";
import type { MessageCampaign, ScheduledTextCampaign } from "./types";

type TextAutomationRunStatus = "queued" | "no-due-texts" | "blocked";
type ScheduledPromotionSkipReason = "future" | "canceled" | "queued" | "invalid";

export type TextAutomationScheduledPromotionPlan = {
  id: string;
  title: string;
  audience: MessageCampaign["audience"];
  scheduledFor: string;
  scheduledTime: string;
  body: string;
  dueKey: string;
};

export type TextAutomationSkippedScheduledPromotion = {
  id: string;
  reason: ScheduledPromotionSkipReason;
};

export type TextAutomationExecutionPlanInput = {
  now: string | Date;
  scheduledPromotions: unknown;
  relayPayload: unknown;
  twilio: TwilioRelayExecutionPlanConfig;
  relayDispatch?: TwilioRelayDispatchPlanOptions;
  relaySendPolicy?: TwilioRelaySendPolicyOptions;
  webPushSubscriptions?: unknown[];
  webPushNotification?: ChoWebPushNotificationInput;
  webPush?: WebPushDeliveryPlanOptions;
  maxDueScheduledPromotions?: number;
};

export type TextAutomationExecutionPlan = {
  ok: boolean;
  serverOnly: true;
  runStatus: TextAutomationRunStatus;
  errors: string[];
  dueScheduledPromotions: TextAutomationScheduledPromotionPlan[];
  skippedScheduledPromotions: TextAutomationSkippedScheduledPromotion[];
  twilioRelayPlan: TwilioRelayExecutionPlan;
  twilioRelayDispatchPlan: TwilioRelayDispatchPlan;
  twilioRelaySendPolicyPlan: TwilioRelaySendPolicyPlan;
  webPushPlan?: ChoWebPushDeliveryPlan;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string) {
  const value = record[field];
  return typeof value === "string" ? value.trim() : "";
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function isTimeKey(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function normalizeNow(value: string | Date) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateKey = trimmed.slice(0, 10);
    const timeKey = trimmed.includes("T") ? trimmed.slice(11, 16) : "00:00";
    if (isDateKey(dateKey) && isTimeKey(timeKey)) return { dateKey, timeKey };
  } else if (Number.isFinite(value.getTime())) {
    return {
      dateKey: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
      timeKey: `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
    };
  }
  return { dateKey: "", timeKey: "" };
}

function scheduledPromotionDue(campaign: Pick<ScheduledTextCampaign, "scheduledFor" | "scheduledTime">, now: { dateKey: string; timeKey: string }) {
  if (campaign.scheduledFor < now.dateKey) return true;
  if (campaign.scheduledFor > now.dateKey) return false;
  return (campaign.scheduledTime?.trim() || "00:00") <= now.timeKey;
}

function scheduledPromotionPlan(record: Record<string, unknown>) {
  const id = stringField(record, "id");
  const title = stringField(record, "title") || "Scheduled promotion";
  const audience = stringField(record, "audience") as MessageCampaign["audience"];
  const scheduledFor = stringField(record, "scheduledFor");
  const scheduledTime = stringField(record, "scheduledTime") || "00:00";
  const body = stringField(record, "body");
  return {
    id,
    title,
    audience,
    scheduledFor,
    scheduledTime,
    body,
    dueKey: `scheduled-promotion:${id}:${scheduledFor}:${scheduledTime}`
  };
}

function classifyScheduledPromotions(value: unknown, now: { dateKey: string; timeKey: string }, maxDueScheduledPromotions: number) {
  const errors: string[] = [];
  const dueScheduledPromotions: TextAutomationScheduledPromotionPlan[] = [];
  const skippedScheduledPromotions: TextAutomationSkippedScheduledPromotion[] = [];
  if (!Array.isArray(value)) {
    return {
      errors: ["Text automation scheduledPromotions must be an array."],
      dueScheduledPromotions,
      skippedScheduledPromotions
    };
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      const id = `scheduled-promotion-${index + 1}`;
      skippedScheduledPromotions.push({ id, reason: "invalid" });
      errors.push(`Scheduled promotion ${id} must be an object.`);
      return;
    }
    const status = stringField(item, "status");
    const plan = scheduledPromotionPlan(item);
    const id = plan.id || `scheduled-promotion-${index + 1}`;
    if (status === "canceled") {
      skippedScheduledPromotions.push({ id, reason: "canceled" });
      return;
    }
    if (status === "queued") {
      skippedScheduledPromotions.push({ id, reason: "queued" });
      return;
    }
    if (status !== "scheduled" || !plan.id || !plan.body || !isDateKey(plan.scheduledFor) || !isTimeKey(plan.scheduledTime)) {
      skippedScheduledPromotions.push({ id, reason: "invalid" });
      errors.push(`Scheduled promotion ${id} has invalid schedule metadata.`);
      return;
    }
    if (!scheduledPromotionDue(plan, now)) {
      skippedScheduledPromotions.push({ id, reason: "future" });
      return;
    }
    dueScheduledPromotions.push(plan);
  });

  if (dueScheduledPromotions.length > maxDueScheduledPromotions) {
    errors.push(`Text automation run has ${dueScheduledPromotions.length} due scheduled promotions but the configured maximum is ${maxDueScheduledPromotions}.`);
  }

  return { errors, dueScheduledPromotions, skippedScheduledPromotions };
}

function emptyTwilioRelayDispatchPlan(errors: string[]): TwilioRelayDispatchPlan {
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

function safeBlockedAutomationRelayPlan(plan: TwilioRelayExecutionPlan, errors: string[]): TwilioRelayExecutionPlan {
  return {
    ...plan,
    ok: false,
    errors,
    requests: []
  };
}

function safeBlockedAutomationDispatchPlan(plan: TwilioRelayDispatchPlan, errors: string[]): TwilioRelayDispatchPlan {
  return {
    ...plan,
    ok: false,
    errors,
    requestsToSend: [],
    attemptsToReserve: []
  };
}

function relayDispatchErrors(plan: TwilioRelayDispatchPlan) {
  return [
    ...plan.errors,
    ...plan.blocked.map((item) => `Relay dispatch blocked ${item.id}: ${item.reasons.join("; ")}`)
  ];
}

function emptyTwilioRelaySendPolicyPlan(errors: string[]): TwilioRelaySendPolicyPlan {
  return {
    ok: false,
    serverOnly: true,
    errors,
    requestsToSend: [],
    blocked: []
  };
}

function safeBlockedAutomationSendPolicyPlan(plan: TwilioRelaySendPolicyPlan, errors: string[]): TwilioRelaySendPolicyPlan {
  return {
    ...plan,
    ok: false,
    errors,
    requestsToSend: []
  };
}

function relaySendPolicyErrors(plan: TwilioRelaySendPolicyPlan) {
  return [
    ...plan.errors,
    ...plan.blocked.map((item) => `Relay send policy blocked ${item.id}: ${item.reasons.join("; ")}`)
  ];
}

export function buildTextAutomationExecutionPlan(input: TextAutomationExecutionPlanInput): TextAutomationExecutionPlan {
  const now = normalizeNow(input.now);
  const errors: string[] = [];
  if (!now.dateKey || !now.timeKey) errors.push("Text automation execution plan requires a valid run timestamp.");

  const schedulePlan = classifyScheduledPromotions(input.scheduledPromotions, now, input.maxDueScheduledPromotions ?? 50);
  errors.push(...schedulePlan.errors);

  const twilioRelayPlan = buildTwilioRelayExecutionPlan(input.relayPayload, input.twilio);
  errors.push(...twilioRelayPlan.errors);

  const twilioRelayDispatchPlan = twilioRelayPlan.ok
    ? buildTwilioRelayDispatchPlan(twilioRelayPlan, input.relayDispatch)
    : emptyTwilioRelayDispatchPlan(twilioRelayPlan.errors);
  errors.push(...relayDispatchErrors(twilioRelayDispatchPlan));

  const twilioRelaySendPolicyPlan = twilioRelayPlan.ok && twilioRelayDispatchPlan.ok
    ? buildTwilioRelaySendPolicyPlan(twilioRelayPlan, {
        ...input.relaySendPolicy,
        candidateMessageIds: twilioRelayDispatchPlan.requestsToSend.map((request) => request.messageId)
      })
    : emptyTwilioRelaySendPolicyPlan([...twilioRelayPlan.errors, ...twilioRelayDispatchPlan.errors]);
  errors.push(...relaySendPolicyErrors(twilioRelaySendPolicyPlan));

  const webPushPlan = input.webPush
    ? buildChoWebPushDeliveryPlan(
        input.webPushSubscriptions ?? [],
        input.webPushNotification ?? {
          title: "Text automations queued",
          body: "Open Cho's Martial Arts to review the latest automation run."
        },
        input.webPush
      )
    : undefined;
  if (webPushPlan) {
    errors.push(...webPushPlan.errors);
    webPushPlan.rejected.forEach((item) => {
      errors.push(`Web Push subscription ${item.id}: ${item.reasons.join("; ")}`);
    });
  }

  const ok = errors.length === 0 && twilioRelayPlan.ok && twilioRelayDispatchPlan.ok && twilioRelaySendPolicyPlan.ok && (!webPushPlan || webPushPlan.ok);
  const runStatus: TextAutomationRunStatus = ok
    ? twilioRelayPlan.requests.length || schedulePlan.dueScheduledPromotions.length || (webPushPlan?.requests.length ?? 0)
      ? "queued"
      : "no-due-texts"
    : "blocked";

  return {
    ok,
    serverOnly: true,
    runStatus,
    errors,
    dueScheduledPromotions: schedulePlan.dueScheduledPromotions,
    skippedScheduledPromotions: schedulePlan.skippedScheduledPromotions,
    twilioRelayPlan: ok ? twilioRelayPlan : safeBlockedAutomationRelayPlan(twilioRelayPlan, errors),
    twilioRelayDispatchPlan: ok
      ? {
          ...twilioRelayDispatchPlan,
          requestsToSend: twilioRelaySendPolicyPlan.requestsToSend,
          attemptsToReserve: twilioRelayDispatchPlan.attemptsToReserve.filter((attempt) => twilioRelaySendPolicyPlan.requestsToSend.some((request) => request.relayIdempotencyKey === attempt.relayIdempotencyKey))
        }
      : safeBlockedAutomationDispatchPlan(twilioRelayDispatchPlan, errors),
    twilioRelaySendPolicyPlan: ok ? twilioRelaySendPolicyPlan : safeBlockedAutomationSendPolicyPlan(twilioRelaySendPolicyPlan, errors),
    ...(webPushPlan ? { webPushPlan } : {})
  };
}
