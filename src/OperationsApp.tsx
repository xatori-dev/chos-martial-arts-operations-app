import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderPlus,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Moon,
  MoreHorizontal,
  Package,
  Palette,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Search,
  Send,
  Server,
  Sparkles,
  Smartphone,
  Sun,
  Target,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Video,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent as ReactChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import classesLauncherIcon from "./assets/manager-icons/Classes.webp";
import dashboardLauncherIcon from "./assets/manager-icons/Dashboard.webp";
import eventsLauncherIcon from "./assets/manager-icons/Events.webp";
import managerLogoutIcon from "./assets/manager-icons/ManagerLogoutProfessional.png";
import managerPageIcon from "./assets/manager-icons/ManagerPage.webp";
import managerProfileSettingsIcon from "./assets/manager-icons/ManagerProfileSettings.png";
import merchandiseLauncherIcon from "./assets/manager-icons/Merchandise.webp";
import messagesLauncherIcon from "./assets/manager-icons/Messages.webp";
import reportsLauncherIcon from "./assets/manager-icons/Reports.webp";
import schedulingLauncherIcon from "./assets/manager-icons/Scheduling.webp";
import studentsLauncherIcon from "./assets/manager-icons/Students.webp";
import { beltReadinessItems } from "./data";
import { buildOperationsBackupSnapshot, makeOperationsBackupFilename, type ProductionMessagingSetupBackup } from "./operationsBackup";
import { buildReportsCommandCenter, getMerchandiseReorderPoint, getMerchandiseTargetStock, isMissedClassFollowUpDue, isQueuedMessageDeliverable, type ReportsAttendanceGapCandidate, type ReportsCelebrationCandidate, type ReportsClassReminderCandidate, type ReportsDirectMessageReplyCandidate, type ReportsNewStudentCheckInCandidate, type ReportsPriorityAction, type ReportsProfileUpdateCandidate } from "./operationsReports";
import { publicAsset } from "./appAssets";
import {
  beltCaseAsset,
  beltCaseBackgrounds,
  beltCaseDisplayModes,
  beltCaseEffects,
  beltCaseFrames,
  beltCaseLightingOptions,
  beltCaseRailBeltAsset,
  beltCaseStickers,
  beltCaseTrophyBeltAsset,
  defaultBeltCaseSettings,
  defaultBeltCasePlaqueText,
  getBeltJourneyStats,
  readBeltCaseSettings,
  resolveBeltCaseSelection,
  resolveBeltRank,
  sanitizeBeltCasePlaqueText,
  writeBeltCaseSettings,
  type BeltCaseSettings,
  type BeltCaseSticker,
  type BeltCaseStickerId
} from "./beltCase";
import { childUsernameFromName, normalizeChildUsername } from "./childAccountUtils";
import { beltRanks } from "./data";
import { createSupabaseManagedAccount, isSupabaseAuthConfigured } from "./supabaseAccounts";
import {
  readManagerProfile,
  readStaffProfile,
  readStudentProfile,
  writeManagerProfile,
  writeStaffProfile,
  writeStudentProfile,
  type ProfileSettings as ManagerProfileSettings
} from "./profileStorage";
import { useAppState } from "./state";
import { buildStudentBeltProgress, type StudentBeltProgress } from "./studentProgress";
import {
  applyAppTheme,
  applyStoredVisualTheme,
  applyVisualTheme,
  clearStoredVisualTheme,
  defaultVisualThemeColors,
  normalizeVisualThemeColors,
  readStoredAppTheme,
  readStoredVisualTheme,
  visualColorKeys,
  writeStoredAppTheme,
  writeStoredVisualTheme,
  type AppThemeMode,
  type VisualColorKey,
  type VisualThemeColors
} from "./theme";
import { validateTwilioRelayHealthResponseForBrowser, validateTwilioRelayPayloadForServer, type TwilioRelayHealthReadinessChecks } from "./twilioRelayContract";
import type { AccountRole, BeltRank, ChildAccount, ClassWeekday, DirectMessage, ManagedAccount, ManagerAccessKey, MerchandiseItem, MessageCampaign, MessageLog, MessageNotificationSettings, ScheduledClass, ScheduledTextCampaign, StudioClass, StudyGuideFolder, StudyGuideMaterial, StudentRecord, StudioEvent, TextAutomationRun, TrainingVideo, TrainingVideoFolder } from "./types";
import { downloadTextFile, formatMoney, smsOptOutPreflightText, smsSegmentPreflightText, validateEmail } from "./utils";

const beltOptions = beltRanks.map((beltRank) => beltRank.name);
const weekdayOptions: { value: ClassWeekday; label: string; short: string }[] = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" }
];
const defaultScheduleTypeOptions = [
  { value: "class", label: "Class" },
  { value: "private-lesson", label: "Private lesson" },
  { value: "starter-program", label: "Starter Program" },
  { value: "testing-prep", label: "Testing prep" }
];

const starterProgramAppointmentTimes = ["9:00 AM", "10:30 AM", "12:00 PM", "2:00 PM", "4:30 PM", "5:30 PM", "6:30 PM"];

type ManagerLauncherIconKind = "dashboard" | "messages" | "students" | "classes" | "studyGuide" | "events" | "scheduling" | "merchandise" | "videos" | "reports" | "create" | "study" | "test";

type ManagerLauncherItem = {
  label: string;
  icon: ManagerLauncherIconKind;
  future?: boolean;
};

const managerLauncherItems: ManagerLauncherItem[] = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Create", icon: "create" },
  { label: "Messages", icon: "messages" },
  { label: "Students", icon: "students" },
  { label: "Classes", icon: "classes" },
  { label: "Study Guide", icon: "studyGuide" },
  { label: "Events", icon: "events" },
  { label: "Scheduling", icon: "scheduling" },
  { label: "Merchandise", icon: "merchandise" },
  { label: "Videos", icon: "videos" },
  { label: "Reports", icon: "reports" }
];

const studentLauncherItems: ManagerLauncherItem[] = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Classes", icon: "classes" },
  { label: "Study", icon: "study" },
  { label: "Test", icon: "test" },
  { label: "Videos", icon: "videos" }
];

const managerLauncherIconImages: Partial<Record<ManagerLauncherIconKind, string>> = {
  dashboard: dashboardLauncherIcon,
  messages: messagesLauncherIcon,
  students: studentsLauncherIcon,
  classes: classesLauncherIcon,
  events: eventsLauncherIcon,
  scheduling: schedulingLauncherIcon,
  merchandise: merchandiseLauncherIcon,
  reports: reportsLauncherIcon,
  study: reportsLauncherIcon,
  test: eventsLauncherIcon
};

function fullName(student: StudentRecord) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function isCurrentOperationsStudent(student: StudentRecord) {
  return (student.status?.trim() || "Active").toLowerCase() !== "inactive";
}

function selectSessionStudent(students: StudentRecord[], sessionEmail?: string, managedStudentId?: string) {
  const normalizedEmail = sessionEmail?.toLowerCase();
  return (
    (managedStudentId ? students.find((student) => student.id === managedStudentId) : undefined) ??
    (normalizedEmail ? students.find((student) => student.email.toLowerCase() === normalizedEmail) : undefined) ??
    students.find((student) => (student.status ?? "Active").toLowerCase() === "active") ??
    students[0]
  );
}

function scheduleTimeSortValue(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)?/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function sortScheduledItemsByDateTime(items: ScheduledClass[]) {
  return [...items].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      scheduleTimeSortValue(left.time) - scheduleTimeSortValue(right.time) ||
      left.title.localeCompare(right.title)
  );
}

function findNextStudentScheduledClass(scheduledClasses: ScheduledClass[], studentId: string | undefined, today: string) {
  const upcomingItems = sortScheduledItemsByDateTime(scheduledClasses.filter((item) => item.date >= today));
  const linkedItem = studentId ? upcomingItems.find((item) => item.studentId === studentId) : undefined;
  return linkedItem ?? upcomingItems.find((item) => !item.studentId);
}

function findNextStudioEvent(studioEvents: StudioEvent[], today: string) {
  return [...studioEvents]
    .filter((event) => event.date >= today)
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        scheduleTimeSortValue(left.time) - scheduleTimeSortValue(right.time) ||
        left.title.localeCompare(right.title)
    )[0];
}

function formatClockTime(time: string) {
  const [hours = "0", minutes = "00"] = time.split(":");
  const date = new Date(2026, 0, 1, Number(hours), Number(minutes));
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatClassTimeRange(studioClass: Pick<StudioClass, "startTime" | "endTime">) {
  return `${formatClockTime(studioClass.startTime)} - ${formatClockTime(studioClass.endTime)}`;
}

function formatClassDays(daysOfWeek: ClassWeekday[]) {
  return daysOfWeek
    .map((day) => weekdayOptions.find((option) => option.value === day)?.label)
    .filter(Boolean)
    .join(", ");
}

function scheduleTypeLabel(type: string) {
  return defaultScheduleTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function messageKindLabel(kind: MessageLog["kind"]) {
  if (kind === "celebration") return "Celebration text";
  if (kind === "profile-update") return "Profile update text";
  if (kind === "follow-up") return "Missed-class follow-up";
  if (kind === "marketing") return "Marketing blast";
  if (kind === "welcome") return "Welcome text";
  return "Class reminder";
}

function messageAudienceLabel(audience: MessageCampaign["audience"]) {
  if (audience === "parents") return "parents";
  if (audience === "staff") return "staff";
  if (audience === "everyone") return "contacts";
  return "students";
}

function scheduledPromotionStatusLabel(status: ScheduledTextCampaign["status"]) {
  if (status === "queued") return "Queued";
  if (status === "canceled") return "Canceled";
  return "Scheduled";
}

function scheduledPromotionWhenLabel(campaign: Pick<ScheduledTextCampaign, "scheduledFor" | "scheduledTime">) {
  return campaign.scheduledTime ? `${campaign.scheduledFor} at ${formatClockTime(campaign.scheduledTime)}` : campaign.scheduledFor;
}

function automationRunStatusLabel(run: Pick<TextAutomationRun, "status" | "totalQueued">) {
  if (run.status === "no-due-texts") return "No due texts";
  return `${run.totalQueued} queued`;
}

function automationRunBreakdownSummary(run: Pick<TextAutomationRun, "breakdown">) {
  const activeBreakdown = run.breakdown.filter((item) => item.queued > 0);
  return activeBreakdown.length
    ? activeBreakdown.map((item) => `${item.label}: ${item.queued}`).join(" · ")
    : "No automation categories queued texts";
}

const twilioRequiredServerEnvVars = ["TWILIO_ACCOUNT_SID"];
const twilioAuthServerEnv = {
  productionRecommended: ["TWILIO_API_KEY", "TWILIO_API_KEY_SECRET"],
  localFallback: ["TWILIO_AUTH_TOKEN"]
};
const twilioSenderServerEnv = {
  recommended: ["TWILIO_MESSAGING_SERVICE_SID"],
  fallback: ["TWILIO_FROM_NUMBER"]
};
const twilioServerEnvLabels = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_API_KEY + TWILIO_API_KEY_SECRET",
  "TWILIO_AUTH_TOKEN fallback",
  "TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER"
];
const twilioServerReadinessLabel = "Account SID + auth pair + sender option required";
const twilioRelayServerContract = {
  module: "src/twilioRelayContract.ts",
  payloadValidator: "validateTwilioRelayPayloadForServer",
  consentEvidenceValidator: "validateTwilioRelayConsentEvidenceForServer",
  healthResponseValidator: "validateTwilioRelayHealthResponseForBrowser",
  messageRequestBuilder: "buildTwilioMessageRequest",
  relayExecutionPlanner: "buildTwilioRelayExecutionPlan",
  relayDispatchPlanner: "buildTwilioRelayDispatchPlan",
  sendPolicyPlanner: "buildTwilioRelaySendPolicyPlan",
  providerResponseResultBuilder: "buildTwilioRelayResultFromProviderResponse",
  providerMessageResponseNormalizer: "normalizeTwilioMessageCreateResponseForServer",
  basicAuthHeaderBuilder: "buildTwilioBasicAuthHeader"
};
const twilioWebhookServerContract = {
  module: "src/twilioRelayContract.ts",
  signatureValidator: "validateTwilioFormWebhookSignature",
  statusCallbackNormalizer: "normalizeTwilioStatusCallbackForServer",
  inboundSmsNormalizer: "normalizeTwilioInboundSmsWebhookForServer",
  inboundConsentUpdatePlanner: "buildTwilioInboundConsentUpdatePlanForServer"
};
const webPushRequiredServerEnvVars = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
const webPushServerContract = {
  module: "src/webPushContract.ts",
  subscriptionValidator: "validateWebPushSubscriptionPayloadForServer",
  notificationPayloadBuilder: "buildChoWebPushNotificationPayload",
  deliveryPlanner: "buildChoWebPushDeliveryPlan",
  providerResponseResultBuilder: "buildChoWebPushResultFromProviderResponse",
  deliveryReconciliationPlanner: "buildChoWebPushDeliveryReconciliationPlan",
  supportedAccountRoles: ["staff", "student", "guardian"]
};
const messagingServerAdapterContract = {
  module: "src/messagingServerContract.ts",
  healthResponseBuilder: "buildChoMessagingServerHealthResponse",
  requestGateValidator: "validateChoMessagingServerRequestGate",
  relayPlanBuilder: "buildChoMessagingServerRelayPlan",
  pushSubscriptionSyncPlanner: "buildChoMessagingServerPushSubscriptionSyncPlan",
  twilioWebhookPlanner: "buildChoMessagingServerTwilioWebhookPlan"
};
const twilioRelayHealthCheckLabels: { key: keyof TwilioRelayHealthReadinessChecks; label: string }[] = [
  { key: "managerAuth", label: "Manager auth" },
  { key: "twilioCredentials", label: "Twilio credentials" },
  { key: "senderConfigured", label: "Sender configured" },
  { key: "complianceReady", label: "Compliance ready" },
  { key: "webhookSignatureValidation", label: "Webhook signatures" },
  { key: "relayCanSend", label: "Relay can send" }
];

function activeSmsOptOutCount(students: readonly StudentRecord[], managedAccounts: readonly ManagedAccount[]) {
  return (
    students.reduce((count, student) => count + (student.studentSmsOptOutAt?.trim() ? 1 : 0) + (student.guardianSmsOptOutAt?.trim() ? 1 : 0), 0) +
    managedAccounts.filter((account) => account.smsOptOutAt?.trim()).length
  );
}

function isActiveOperationsStudent(student: Pick<StudentRecord, "status">) {
  return (student.status?.trim() || "Active").toLowerCase() !== "inactive";
}

function normalizeConsentPhone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

function smsConsentStatus(optOutAt?: string, consentUpdatedAt?: string) {
  if (optOutAt?.trim()) return "opt-out";
  if (consentUpdatedAt?.trim()) return "opt-in";
  return "unknown";
}

function smsConsentUpdatedAt(optOutAt?: string, consentUpdatedAt?: string) {
  return optOutAt?.trim() || consentUpdatedAt?.trim() || null;
}

function getBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  return window.Notification.permission;
}

async function showDirectMessageBrowserNotification(title: string, options: NotificationOptions) {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (typeof registration.showNotification === "function") {
        await registration.showNotification(title, options);
        return true;
      }
    } catch {
      // Fall back to the page-level Notification constructor below.
    }
  }
  if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
    new window.Notification(title, options);
    return true;
  }
  return false;
}

type AppBadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

async function syncMessageAppBadge(unreadCount: number) {
  if (typeof navigator === "undefined") return false;
  const badgeNavigator = navigator as AppBadgeNavigator;
  try {
    if (unreadCount > 0 && typeof badgeNavigator.setAppBadge === "function") {
      await badgeNavigator.setAppBadge(unreadCount);
      return true;
    }
    if (unreadCount <= 0 && typeof badgeNavigator.clearAppBadge === "function") {
      await badgeNavigator.clearAppBadge();
      return true;
    }
  } catch {
    // Badging is optional; unsupported installed-app contexts should not break messages.
  }
  return false;
}

function webPushPublicKeyToBytes(publicKey: string) {
  const cleanKey = publicKey.trim();
  if (!cleanKey || typeof window === "undefined" || typeof window.atob !== "function") return undefined;
  try {
    const base64 = `${cleanKey}${"=".repeat((4 - (cleanKey.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
    const rawKey = window.atob(base64);
    const output = new Uint8Array(rawKey.length);
    for (let index = 0; index < rawKey.length; index += 1) {
      output[index] = rawKey.charCodeAt(index);
    }
    return output;
  } catch {
    return undefined;
  }
}

function pushSubscriptionToJson(subscription: PushSubscription) {
  if (typeof subscription.toJSON === "function") {
    return JSON.stringify(subscription.toJSON());
  }
  return JSON.stringify({
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null
  });
}

function parsePushSubscriptionJson(rawSubscription?: string) {
  if (!rawSubscription?.trim()) return undefined;
  try {
    const parsed = JSON.parse(rawSubscription) as unknown;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function cleanNotificationSettingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getPushSubscriptionEndpoint(subscription: PushSubscription, subscriptionJson: string) {
  const parsedSubscription = parsePushSubscriptionJson(subscriptionJson) as { endpoint?: unknown } | undefined;
  return typeof parsedSubscription?.endpoint === "string" ? parsedSubscription.endpoint : subscription.endpoint;
}

function buildWebPushSubscriptionSettings(publicKey: string, subscription: PushSubscription): Partial<MessageNotificationSettings> {
  const subscriptionJson = pushSubscriptionToJson(subscription);
  return {
    browserNotificationsEnabled: true,
    browserPermission: "granted",
    pushPublicKey: publicKey.trim(),
    pushSubscriptionEndpoint: getPushSubscriptionEndpoint(subscription, subscriptionJson),
    pushSubscriptionJson: subscriptionJson,
    pushSubscribedAt: new Date().toISOString()
  };
}

function buildWebPushSubscriptionPayload(
  settings: MessageNotificationSettings,
  session: { email: string } | null | undefined,
  accountRole: AccountRole | undefined,
  notificationUrl: string
) {
  const subscription = parsePushSubscriptionJson(settings.pushSubscriptionJson);
  if (!subscription || !settings.pushSubscriptionEndpoint?.trim()) return undefined;
  return {
    schemaVersion: "chos-web-push-subscription.v1",
    provider: "web-push",
    deliveryMode: "server-push",
    generatedAt: new Date().toISOString(),
    requestedBy: session
      ? {
          email: session.email,
          role: accountRole
        }
      : undefined,
    notificationUrl,
    pushSubscribedAt: settings.pushSubscribedAt,
    subscription
  };
}

function messagesNotificationUrl() {
  if (typeof window === "undefined") return "messages";
  return new URL(`${import.meta.env.BASE_URL}messages`, window.location.origin).toString();
}

function appHomeNotificationUrl() {
  if (typeof window === "undefined") return "/";
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

function sessionNotificationScope(email?: string) {
  const keyEmail = email
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return keyEmail || "guest";
}

const homeMessageNotificationStoragePrefix = "chos.homeMessageNotifications";

function homeMessageNotificationStorageKey(email?: string) {
  return `${homeMessageNotificationStoragePrefix}.${sessionNotificationScope(email)}.v1`;
}

function readHomeMessageNotificationSettings(email?: string): MessageNotificationSettings {
  if (typeof window === "undefined") return { browserNotificationsEnabled: false };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(homeMessageNotificationStorageKey(email)) ?? "null") as Partial<MessageNotificationSettings> | null;
    return {
      browserNotificationsEnabled: Boolean(parsed?.browserNotificationsEnabled),
      browserPermission: parsed?.browserPermission,
      lastBrowserNotifiedDirectMessageAt: typeof parsed?.lastBrowserNotifiedDirectMessageAt === "string" ? parsed.lastBrowserNotifiedDirectMessageAt : undefined,
      pushPublicKey: cleanNotificationSettingString(parsed?.pushPublicKey),
      pushSubscriptionEndpoint: cleanNotificationSettingString(parsed?.pushSubscriptionEndpoint),
      pushSubscriptionJson: cleanNotificationSettingString(parsed?.pushSubscriptionJson),
      pushSubscribedAt: cleanNotificationSettingString(parsed?.pushSubscribedAt),
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : undefined
    };
  } catch {
    return { browserNotificationsEnabled: false };
  }
}

function writeHomeMessageNotificationSettings(email: string | undefined, settings: MessageNotificationSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(homeMessageNotificationStorageKey(email), JSON.stringify(settings));
  } catch {
    // Device notification preferences are optional; blocked storage should not break the Profile feed.
  }
}

const twilioRelayEndpointStorageKey = "chos.operations.twilioRelayEndpoint.v1";
const pushServerEndpointStorageKey = "chos.operations.pushServerEndpoint.v1";
const twilioLaunchProfileStorageKey = "chos.operations.twilioLaunchProfile.v1";

type TwilioComplianceSenderType = "not-set" | "10dlc" | "toll-free" | "short-code";
type TwilioComplianceStatus = "not-started" | "pending" | "approved" | "rejected" | "not-used";

type TwilioLaunchProfile = {
  messagingServiceSid: string;
  smsSender: string;
  inboundWebhookUrl: string;
  statusCallbackBaseUrl: string;
  relayHealthCheckUrl: string;
  managerAuthMode: "same-site-cookie" | "server-session" | "oauth-proxy";
  senderType: TwilioComplianceSenderType;
  a2pBrandStatus: TwilioComplianceStatus;
  a2pCampaignStatus: TwilioComplianceStatus;
  tollFreeVerificationStatus: TwilioComplianceStatus;
  complianceNotes: string;
  savedAt?: string;
};

const defaultTwilioLaunchProfile: TwilioLaunchProfile = {
  messagingServiceSid: "",
  smsSender: "",
  inboundWebhookUrl: "",
  statusCallbackBaseUrl: "",
  relayHealthCheckUrl: "",
  managerAuthMode: "same-site-cookie",
  senderType: "not-set",
  a2pBrandStatus: "not-started",
  a2pCampaignStatus: "not-started",
  tollFreeVerificationStatus: "not-started",
  complianceNotes: ""
};

function normalizeTwilioComplianceSenderType(value?: string): TwilioComplianceSenderType {
  if (value === "10dlc" || value === "toll-free" || value === "short-code") return value;
  return "not-set";
}

function normalizeTwilioComplianceStatus(value?: string): TwilioComplianceStatus {
  if (value === "pending" || value === "approved" || value === "rejected" || value === "not-used") return value;
  return "not-started";
}

function sanitizeTwilioLaunchProfile(profile: TwilioLaunchProfile): TwilioLaunchProfile {
  return {
    messagingServiceSid: profile.messagingServiceSid.trim(),
    smsSender: profile.smsSender.trim(),
    inboundWebhookUrl: profile.inboundWebhookUrl.trim(),
    statusCallbackBaseUrl: profile.statusCallbackBaseUrl.trim(),
    relayHealthCheckUrl: profile.relayHealthCheckUrl.trim(),
    managerAuthMode: profile.managerAuthMode,
    senderType: normalizeTwilioComplianceSenderType(profile.senderType),
    a2pBrandStatus: normalizeTwilioComplianceStatus(profile.a2pBrandStatus),
    a2pCampaignStatus: normalizeTwilioComplianceStatus(profile.a2pCampaignStatus),
    tollFreeVerificationStatus: normalizeTwilioComplianceStatus(profile.tollFreeVerificationStatus),
    complianceNotes: profile.complianceNotes.trim(),
    ...(profile.savedAt?.trim() ? { savedAt: profile.savedAt.trim() } : {})
  };
}

function twilioComplianceReady(profile: TwilioLaunchProfile) {
  if (profile.senderType === "10dlc") return profile.a2pBrandStatus === "approved" && profile.a2pCampaignStatus === "approved";
  if (profile.senderType === "toll-free") return profile.tollFreeVerificationStatus === "approved";
  if (profile.senderType === "short-code") return profile.a2pBrandStatus === "not-used" && profile.a2pCampaignStatus === "not-used";
  return false;
}

function buildTwilioComplianceProfile(profile: TwilioLaunchProfile) {
  return {
    senderType: profile.senderType,
    a2pBrandStatus: profile.a2pBrandStatus,
    a2pCampaignStatus: profile.a2pCampaignStatus,
    tollFreeVerificationStatus: profile.tollFreeVerificationStatus,
    complianceNotes: profile.complianceNotes.trim() || null,
    requiresA2p10DlcForUsLongCode: profile.senderType === "10dlc",
    readyForUsProductionTraffic: twilioComplianceReady(profile),
    credentialValuesExcluded: true
  };
}

function readTwilioLaunchProfile() {
  if (typeof window === "undefined") return defaultTwilioLaunchProfile;
  try {
    const rawProfile = window.localStorage.getItem(twilioLaunchProfileStorageKey);
    if (!rawProfile) return defaultTwilioLaunchProfile;
    const parsed = JSON.parse(rawProfile) as Partial<TwilioLaunchProfile>;
    const managerAuthMode = parsed.managerAuthMode === "server-session" || parsed.managerAuthMode === "oauth-proxy" ? parsed.managerAuthMode : "same-site-cookie";
    return sanitizeTwilioLaunchProfile({
      messagingServiceSid: parsed.messagingServiceSid ?? "",
      smsSender: parsed.smsSender ?? "",
      inboundWebhookUrl: parsed.inboundWebhookUrl ?? "",
      statusCallbackBaseUrl: parsed.statusCallbackBaseUrl ?? "",
      relayHealthCheckUrl: parsed.relayHealthCheckUrl ?? "",
      managerAuthMode,
      senderType: normalizeTwilioComplianceSenderType(parsed.senderType),
      a2pBrandStatus: normalizeTwilioComplianceStatus(parsed.a2pBrandStatus),
      a2pCampaignStatus: normalizeTwilioComplianceStatus(parsed.a2pCampaignStatus),
      tollFreeVerificationStatus: normalizeTwilioComplianceStatus(parsed.tollFreeVerificationStatus),
      complianceNotes: parsed.complianceNotes ?? "",
      savedAt: parsed.savedAt
    });
  } catch {
    return defaultTwilioLaunchProfile;
  }
}

function writeTwilioLaunchProfile(profile: TwilioLaunchProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(twilioLaunchProfileStorageKey, JSON.stringify(sanitizeTwilioLaunchProfile(profile)));
  } catch {
    // Launch profile persistence is optional; blocked storage should not break messaging.
  }
}

function readTwilioRelayEndpoint() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(twilioRelayEndpointStorageKey) ?? "";
  } catch {
    return "";
  }
}

function writeTwilioRelayEndpoint(value: string) {
  if (typeof window === "undefined") return;
  try {
    const endpoint = value.trim();
    if (endpoint) {
      window.localStorage.setItem(twilioRelayEndpointStorageKey, endpoint);
    } else {
      window.localStorage.removeItem(twilioRelayEndpointStorageKey);
    }
  } catch {
    // Relay URL persistence is optional; blocked storage should not break messaging.
  }
}

function readPushServerEndpoint() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(pushServerEndpointStorageKey) ?? "";
  } catch {
    return "";
  }
}

function writePushServerEndpoint(value: string) {
  if (typeof window === "undefined") return;
  try {
    const endpoint = value.trim();
    if (endpoint) {
      window.localStorage.setItem(pushServerEndpointStorageKey, endpoint);
    } else {
      window.localStorage.removeItem(pushServerEndpointStorageKey);
    }
  } catch {
    // Push server URL persistence is optional; blocked storage should not break notifications.
  }
}

function buildProductionMessagingSetupBackupInput(settings: MessageNotificationSettings): ProductionMessagingSetupBackup[] {
  return [
    {
      id: "production-messaging",
      twilioRelayEndpoint: readTwilioRelayEndpoint(),
      pushServerEndpoint: readPushServerEndpoint(),
      webPushPublicKey: settings.pushPublicKey ?? "",
      twilioLaunchProfile: readTwilioLaunchProfile()
    }
  ];
}

const visualColorControls: { key: VisualColorKey; label: string; helper: string }[] = [
  { key: "background", label: "Background color", helper: "Main page backdrop" },
  { key: "surface", label: "Panel color", helper: "Cards, lists, and sections" },
  { key: "elevatedSurface", label: "Raised panel color", helper: "Modals and focused cards" },
  { key: "text", label: "Main text color", helper: "Headings and primary text" },
  { key: "mutedText", label: "Helper text color", helper: "Labels, captions, and hints" },
  { key: "primary", label: "Primary accent color", helper: "Highlights and selected states" },
  { key: "secondary", label: "Secondary accent color", helper: "Alternate highlights" },
  { key: "button", label: "Button color", helper: "Primary button backgrounds" },
  { key: "buttonText", label: "Button text color", helper: "Text inside primary buttons" },
  { key: "border", label: "Border color", helper: "Panel and input outlines" },
  { key: "success", label: "Success color", helper: "Positive state accents" },
  { key: "danger", label: "Alert color", helper: "Warning and delete accents" }
];

const visualThemePresets: { label: string; colors: VisualThemeColors }[] = [
  {
    label: "Cho Dark",
    colors: defaultVisualThemeColors
  },
  {
    label: "Clean Light",
    colors: {
      background: "#f3efe7",
      surface: "#ffffff",
      elevatedSurface: "#e9eef4",
      text: "#172033",
      mutedText: "#5f6878",
      primary: "#b8872e",
      secondary: "#286da5",
      button: "#b8872e",
      buttonText: "#ffffff",
      border: "#c9a763",
      success: "#2b8661",
      danger: "#a94953"
    }
  },
  {
    label: "Ocean",
    colors: {
      background: "#092d3a",
      surface: "#11495b",
      elevatedSurface: "#176677",
      text: "#f1fbff",
      mutedText: "#b7d8e0",
      primary: "#62d6e8",
      secondary: "#a7f3d0",
      button: "#62d6e8",
      buttonText: "#06222c",
      border: "#78e4f0",
      success: "#5ee2ac",
      danger: "#ff7a7a"
    }
  },
  {
    label: "Tournament Red",
    colors: {
      background: "#220d13",
      surface: "#3a1620",
      elevatedSurface: "#541d2a",
      text: "#fff4ee",
      mutedText: "#e0b7a8",
      primary: "#ffb45c",
      secondary: "#f24858",
      button: "#f24858",
      buttonText: "#fffaf0",
      border: "#ffb45c",
      success: "#55d08e",
      danger: "#ff6b6b"
    }
  }
];

function isValidVisualColor(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color.trim());
}

function visualThemeMatchesDefault(colors: VisualThemeColors) {
  return visualColorKeys.every((key) => colors[key].toLowerCase() === defaultVisualThemeColors[key].toLowerCase());
}

type ProfileColorPreviewFact = {
  icon: ReactNode;
  label: string;
};

type ProfileColorPreviewCount = {
  label: string;
  value: number;
  tone?: "message" | "event";
};

type ProfileColorPreviewChild = {
  id: string;
  name: string;
  initials: string;
  meta: string;
  selected?: boolean;
};

type ProfileColorPreviewData = {
  kind: "manager" | "staff" | "student" | "parent";
  title: string;
  displayName: string;
  roleLabel: string;
  portraitSrc?: string;
  avatarText?: string;
  facts: ProfileColorPreviewFact[];
  counts: ProfileColorPreviewCount[];
  children?: ProfileColorPreviewChild[];
  selectedChildLabel?: string;
};

function ProfileColorMiniScreen({ preview }: { preview: ProfileColorPreviewData }) {
  const isParentPreview = preview.kind === "parent";
  const previewChildren = preview.children ?? [];
  const selectedChild = previewChildren.find((child) => child.selected) ?? previewChildren[0];
  const screenClassName = [
    "profile-color-mini-screen",
    "manager-home-page",
    preview.kind === "student" ? "student-profile-page" : "",
    preview.kind === "parent" ? "parent-profile-page" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="profile-color-mini-device" aria-label={`${preview.title} mini screen frame`}>
      <div className={screenClassName} aria-label="Live profile mini screen">
        <header className="profile-color-mini-topbar">
          <div>
            <span>{preview.kind === "parent" ? "Parent Profile" : preview.kind === "staff" ? "Staff Profile" : "Profile"}</span>
            <strong>{preview.title}</strong>
          </div>
          <nav aria-label="Mini profile actions">
            <span>{isParentPreview ? "Settings" : preview.kind === "manager" ? "Manager's Panel" : preview.kind === "staff" ? "Staff Panel" : "Student's Panel"}</span>
            <span>Log Out</span>
          </nav>
        </header>

        {isParentPreview ? (
          <main className="profile-color-mini-content profile-color-mini-content--parent">
            <article className="parent-family-card profile-color-mini-family-card">
              <div>
                <p>Family Profile</p>
                <h2>{preview.displayName}</h2>
                <span>{preview.roleLabel}</span>
              </div>
              <div className="parent-family-stats" aria-label="Mini parent family totals">
                {preview.counts.map((count) => (
                  <span key={count.label}><strong>{count.value}</strong> {count.label}</span>
                ))}
              </div>
            </article>

            <section className="parent-child-profiles profile-color-mini-child-profiles" aria-label="Mini child profiles">
              <div className="parent-section-head">
                <div>
                  <h2>Kids Profiles</h2>
                  <p>Live family colors</p>
                </div>
                <button type="button">Add Child</button>
              </div>
              <div className="parent-child-list profile-color-mini-child-list">
                {previewChildren.length ? (
                  previewChildren.slice(0, 3).map((child) => (
                    <article className={`parent-child-card${child.selected ? " is-selected" : ""}`} key={child.id}>
                      <button type="button" aria-label={`${child.name} mini profile`}>
                        <span className="parent-child-avatar" aria-hidden="true">{child.initials}</span>
                        <span>
                          <strong>{child.name}</strong>
                          <small>{child.meta}</small>
                        </span>
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="parent-empty-note">No child profiles yet.</p>
                )}
              </div>
            </section>

            <section className="parent-selected-student profile-color-mini-selected-student" aria-label="Mini selected child">
              <div className="parent-selected-head">
                <div>
                  <span className="parent-child-avatar parent-child-avatar--large" aria-hidden="true">{selectedChild?.initials ?? "P"}</span>
                  <div>
                    <p>Selected Student</p>
                    <h2>{selectedChild?.name ?? "No child selected"}</h2>
                    <span>{preview.selectedChildLabel ?? selectedChild?.meta ?? "Add a child profile to preview student tools."}</span>
                  </div>
                </div>
              </div>
              <nav className="parent-tool-tabs" aria-label="Mini parent student tools">
                <button className="is-active" type="button">Overview</button>
                <button type="button">Classes</button>
              </nav>
            </section>
          </main>
        ) : (
          <main className="profile-color-mini-content">
            <article className="manager-home-profile-card profile-color-mini-profile-card" aria-label={`${preview.displayName} mini profile card`}>
              <div className="profile-color-mini-card-actions" aria-hidden="true">
                <span className="manager-home-profile-settings-link">
                  <img className="manager-home-profile-settings-icon" src={managerProfileSettingsIcon} alt="" draggable="false" />
                </span>
                <span className="manager-home-profile-theme-toggle manager-home-profile-theme-toggle--dark">
                  <span className="manager-home-profile-theme-icons">
                    <Sun size={13} />
                    <Moon size={13} />
                  </span>
                  <span className="manager-home-profile-theme-thumb">
                    <Moon size={12} />
                  </span>
                </span>
              </div>
              <div className="manager-home-profile-frame profile-color-mini-profile-frame">
                {preview.portraitSrc ? (
                  <img src={preview.portraitSrc} alt={`${preview.displayName} profile portrait preview`} draggable="false" />
                ) : (
                  <span aria-hidden="true">{preview.avatarText ?? preview.displayName.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="manager-home-profile-copy">
                <h2>{preview.displayName}</h2>
                <p>{preview.roleLabel}</p>
              </div>
              <dl className="manager-home-profile-facts profile-color-mini-facts">
                {preview.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.icon}</dt>
                    <dd>{fact.label}</dd>
                  </div>
                ))}
              </dl>
            </article>

            <section className="manager-home-feed-panel profile-color-mini-feed" aria-label="Mini profile feed colors">
              <div className="manager-home-feed-counts">
                {preview.counts.map((count, index) => (
                  <button
                    className={`manager-home-count manager-home-count--${count.tone ?? "message"}${index === 0 ? " is-active" : ""}`}
                    key={count.label}
                    type="button"
                  >
                    {count.value} {count.label}
                  </button>
                ))}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

function ProfileColorEditingTool({ sessionEmail, showToast, preview }: { sessionEmail?: string; showToast: (message: string) => void; preview: ProfileColorPreviewData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [colors, setColors] = useState<VisualThemeColors>(() => readStoredVisualTheme(sessionEmail) ?? defaultVisualThemeColors);
  const hasValidDraft = visualColorKeys.every((key) => isValidVisualColor(colors[key]));

  useEffect(() => {
    setColors(readStoredVisualTheme(sessionEmail) ?? defaultVisualThemeColors);
  }, [sessionEmail]);

  useEffect(() => {
    if (!isOpen || !hasValidDraft) return;
    applyVisualTheme(normalizeVisualThemeColors(colors));
  }, [colors, hasValidDraft, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    return () => applyStoredVisualTheme(sessionEmail);
  }, [isOpen, sessionEmail]);

  const openEditor = () => {
    setColors(readStoredVisualTheme(sessionEmail) ?? defaultVisualThemeColors);
    setIsOpen(true);
  };

  const closeEditor = () => {
    applyStoredVisualTheme(sessionEmail);
    setColors(readStoredVisualTheme(sessionEmail) ?? defaultVisualThemeColors);
    setIsOpen(false);
  };

  const updateColor = (key: VisualColorKey, value: string) => {
    setColors((currentColors) => ({ ...currentColors, [key]: value }));
  };

  const applyPreset = (presetColors: VisualThemeColors) => {
    setColors(normalizeVisualThemeColors(presetColors));
  };

  const saveVisualTheme = () => {
    const hasInvalidColor = visualColorKeys.some((key) => !isValidVisualColor(colors[key]));
    if (hasInvalidColor) {
      showToast("Enter 6-digit hex colors before saving.");
      return;
    }

    const normalizedColors = normalizeVisualThemeColors(colors);
    setColors(normalizedColors);
    if (visualThemeMatchesDefault(normalizedColors)) {
      clearStoredVisualTheme(sessionEmail);
      applyVisualTheme(normalizedColors);
      showToast("Personal color theme reset.");
      return;
    }
    writeStoredVisualTheme(sessionEmail, normalizedColors);
    showToast("Personal color theme saved. Changes are live now.");
  };

  const resetVisualTheme = () => {
    setColors(defaultVisualThemeColors);
    applyVisualTheme(defaultVisualThemeColors);
  };

  const previewStyle = {
    "--user-visual-background": isValidVisualColor(colors.background) ? colors.background : defaultVisualThemeColors.background,
    "--user-visual-surface": isValidVisualColor(colors.surface) ? colors.surface : defaultVisualThemeColors.surface,
    "--user-visual-elevatedSurface": isValidVisualColor(colors.elevatedSurface) ? colors.elevatedSurface : defaultVisualThemeColors.elevatedSurface,
    "--user-visual-text": isValidVisualColor(colors.text) ? colors.text : defaultVisualThemeColors.text,
    "--user-visual-mutedText": isValidVisualColor(colors.mutedText) ? colors.mutedText : defaultVisualThemeColors.mutedText,
    "--user-visual-primary": isValidVisualColor(colors.primary) ? colors.primary : defaultVisualThemeColors.primary,
    "--user-visual-secondary": isValidVisualColor(colors.secondary) ? colors.secondary : defaultVisualThemeColors.secondary,
    "--user-visual-button": isValidVisualColor(colors.button) ? colors.button : defaultVisualThemeColors.button,
    "--user-visual-buttonText": isValidVisualColor(colors.buttonText) ? colors.buttonText : defaultVisualThemeColors.buttonText,
    "--user-visual-border": isValidVisualColor(colors.border) ? colors.border : defaultVisualThemeColors.border,
    "--user-visual-success": isValidVisualColor(colors.success) ? colors.success : defaultVisualThemeColors.success,
    "--user-visual-danger": isValidVisualColor(colors.danger) ? colors.danger : defaultVisualThemeColors.danger,
    "--profile-editor-preview-bg": isValidVisualColor(colors.background) ? colors.background : defaultVisualThemeColors.background,
    "--profile-editor-preview-surface": isValidVisualColor(colors.surface) ? colors.surface : defaultVisualThemeColors.surface,
    "--profile-editor-preview-text": isValidVisualColor(colors.text) ? colors.text : defaultVisualThemeColors.text,
    "--profile-editor-preview-muted": isValidVisualColor(colors.mutedText) ? colors.mutedText : defaultVisualThemeColors.mutedText,
    "--profile-editor-preview-button": isValidVisualColor(colors.button) ? colors.button : defaultVisualThemeColors.button,
    "--profile-editor-preview-button-text": isValidVisualColor(colors.buttonText) ? colors.buttonText : defaultVisualThemeColors.buttonText,
    "--profile-editor-preview-border": isValidVisualColor(colors.border) ? colors.border : defaultVisualThemeColors.border
  } as CSSProperties;

  return (
    <section className="profile-color-tool" aria-label="Personal visual editing tool">
      <button
        className="profile-editing-tool-button"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={openEditor}
      >
        <Palette size={18} />
        Editing Tool
      </button>

      {isOpen && (
        <div className="profile-color-workspace-backdrop" role="presentation">
          <div className="profile-color-workspace" role="dialog" aria-modal="true" aria-label="Editing Tool color editor">
            <header className="profile-color-workspace-head">
              <button type="button" className="profile-color-back" onClick={closeEditor}>
                <ChevronLeft size={18} /> Back to Profile Settings
              </button>
              <div>
                <p>Live Editing Tool</p>
                <h3>Personal Color Editor</h3>
                <span>Every valid color change updates your app immediately. Save to keep it for this login.</span>
              </div>
              <button className="profile-color-close" type="button" aria-label="Close Editing Tool" onClick={closeEditor}>
                <X size={20} />
              </button>
            </header>

            <div className="profile-color-editor">
              <section className="profile-color-control-panel" aria-label="Color controls">
                <div className="profile-color-editor-head">
                  <div>
                    <h4>Choose Colors</h4>
                    <p>Use presets or tune each visual layer. Invalid hex text waits until it becomes a full 6-digit color.</p>
                  </div>
                </div>

                <div className="profile-color-presets" aria-label="Color presets">
                  {visualThemePresets.map((preset) => (
                    <button key={preset.label} type="button" onClick={() => applyPreset(preset.colors)}>
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="profile-color-actions">
                  <button type="button" className="profile-color-reset" onClick={resetVisualTheme}>
                    Reset Colors
                  </button>
                  <button type="button" className="profile-color-save" onClick={saveVisualTheme}>
                    Save Colors
                  </button>
                </div>

                <div className="profile-color-grid">
                  {visualColorControls.map((control) => {
                    const colorValue = colors[control.key];
                    const colorPickerValue = isValidVisualColor(colorValue) ? colorValue : defaultVisualThemeColors[control.key];
                    return (
                      <label className="profile-color-field" key={control.key}>
                        <span>
                          <strong>{control.label}</strong>
                          <small>{control.helper}</small>
                        </span>
                        <span className="profile-color-input-row">
                          <input
                            aria-label={control.label}
                            type="color"
                            value={colorPickerValue}
                            onChange={(event) => updateColor(control.key, event.target.value)}
                          />
                          <input
                            aria-label={`${control.label} hex value`}
                            className="input"
                            value={colorValue}
                            onChange={(event) => updateColor(control.key, event.target.value)}
                            maxLength={7}
                            spellCheck={false}
                          />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <aside className="profile-color-preview-panel" aria-label="Live color preview" style={previewStyle}>
                <div className="profile-color-live-status">
                  <span aria-hidden="true" />
                  <strong>Live preview active</strong>
                </div>
                <ProfileColorMiniScreen preview={preview} />
              </aside>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function OperationsShell({ children }: { children: ReactNode }) {
  const { accountRole, session, logout } = useAppState();
  const location = useLocation();

  useEffect(() => {
    applyStoredVisualTheme(session?.email);
    return () => applyVisualTheme(undefined);
  }, [session?.email]);

  return (
    <StaffOperationsShell accountRole={accountRole} sessionEmail={session?.email} logout={logout} path={location.pathname}>
      {children}
    </StaffOperationsShell>
  );
}

function StaffOperationsShell({
  children,
  accountRole,
  sessionEmail,
  logout,
  path
}: {
  children: ReactNode;
  accountRole?: AccountRole;
  sessionEmail?: string;
  logout: () => void;
  path: string;
}) {
  const shellClassName = `manager-shell${accountRole === "student" && path === "/" ? " manager-shell--student-reference" : ""}`;
  const fullPageShellClassName = `manager-full-page-shell${path === "/dashboard" ? " manager-full-page-shell--dashboard" : ""}`;

  if (path === "/" || path === "/manager") {
    return <div className={shellClassName}>{children}</div>;
  }

  return (
    <div className={shellClassName}>
      <section className={fullPageShellClassName} aria-label="Manager workspace">
        <header className="manager-full-topbar" aria-label="Manager page controls">
          <Link className="manager-back-link" to="/manager" aria-label="Back to Manager Page">
            <ChevronLeft size={24} />
            <span>Back to Manager Page</span>
          </Link>
          <Link className="manager-full-logo" to="/" aria-label="Cho's Martial Arts manager home">
            <img src={publicAsset("682e95109aa21_chos-logo.png")} alt="Cho's Martial Arts" />
          </Link>
          <button className="manager-logout-button" type="button" aria-label="Log Out" onClick={logout}>
            <img className="manager-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
          </button>
        </header>
        <main className="manager-main manager-subpage-main">
          <span className="manager-session-email">{sessionEmail ?? "team@chos.prototype"}</span>
          {children}
        </main>
      </section>
    </div>
  );
}

function OperationsPage({ title, text, action, children, className }: { title: string; text?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`operations-page${className ? ` ${className}` : ""}`}>
      <div className="operations-page-head">
        <div className="operations-page-title-copy">
          <ManagerPageTitleFrame title={title} className="operations-page-title-frame" />
          {text && <p>{text}</p>}
        </div>
        {action && <div className="operations-page-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <article className="operation-stat-card">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

type ManagerCalendarEntry = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "class" | "event";
  meta: string;
  path: string;
  titleColor?: string;
};

type ManagerCalendarView = "day" | "week" | "month";

const managerCalendarViewOptions: { value: ManagerCalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" }
];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCalendarDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function isCalendarDateKey(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && toDateKey(parseCalendarDate(date)) === date;
}

function weekDaysForDate(date: Date) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
}

function shiftCalendarMonth(date: Date, direction: number) {
  const dayOfMonth = date.getDate();
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + direction);
  const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return next;
}

function shiftCalendarPeriod(date: Date, view: ManagerCalendarView, direction: number) {
  if (view === "month") return shiftCalendarMonth(date, direction);
  const next = new Date(date);
  next.setDate(date.getDate() + direction * (view === "week" ? 7 : 1));
  return next;
}

function formatWeekRange(weekDays: Date[]) {
  const [firstDay] = weekDays;
  const lastDay = weekDays[weekDays.length - 1];
  const sameMonth = firstDay.getMonth() === lastDay.getMonth() && firstDay.getFullYear() === lastDay.getFullYear();
  const sameYear = firstDay.getFullYear() === lastDay.getFullYear();
  if (sameMonth) {
    return `${firstDay.toLocaleDateString("en-US", { month: "long" })} ${firstDay.getDate()} - ${lastDay.getDate()}, ${lastDay.getFullYear()}`;
  }
  if (sameYear) {
    return `${firstDay.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${lastDay.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${lastDay.getFullYear()}`;
  }
  return `${firstDay.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - ${lastDay.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
}

function compareCalendarEntries(a: ManagerCalendarEntry, b: ManagerCalendarEntry) {
  return (
    a.date.localeCompare(b.date) ||
    scheduleTimeSortValue(a.time) - scheduleTimeSortValue(b.time) ||
    a.title.localeCompare(b.title)
  );
}

function splitCalendarTimeRange(time: string) {
  const match = time.trim().match(/^(.+?)\s*(?:-|\u2013|\u2014)\s*(.+)$/);
  if (!match) return null;
  return {
    start: match[1].trim(),
    end: match[2].trim()
  };
}

function scheduledClassCalendarEntries(item: ScheduledClass, calendarDays: Date[]): ManagerCalendarEntry[] {
  const label = scheduleTypeLabel(item.type);
  const createEntry = (date: string, id = item.id, meta = label): ManagerCalendarEntry => ({
    id,
    title: item.title,
    date,
    time: item.time,
    kind: "class",
    meta,
    path: "/schedule",
    titleColor: item.titleColor
  });

  if (!item.recurring) {
    return [createEntry(item.date)];
  }

  const startDate = parseCalendarDate(item.date);
  const startDateKey = toDateKey(startDate);
  const startWeekday = startDate.getDay();
  return calendarDays
    .filter((day) => day.getDay() === startWeekday && toDateKey(day) >= startDateKey)
    .map((day) => {
      const dateKey = toDateKey(day);
      return createEntry(dateKey, `${item.id}-${dateKey}`, `${label} · recurring`);
    });
}

function useLiveCalendarDate() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function ManagerLiveCalendar({
  addScheduledClass,
  focusDateKey,
  scheduledClasses,
  showToast,
  studioClasses,
  studioEvents
}: {
  addScheduledClass: (scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => ScheduledClass | undefined;
  focusDateKey?: string;
  scheduledClasses: ScheduledClass[];
  showToast: (message: string) => void;
  studioClasses: StudioClass[];
  studioEvents: StudioEvent[];
}) {
  const now = useLiveCalendarDate();
  const todayKey = toDateKey(now);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [calendarView, setCalendarView] = useState<ManagerCalendarView>("month");
  const [visibleMonthDate, setVisibleMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [scheduleActionsOpen, setScheduleActionsOpen] = useState(false);
  const [starterProgramOpen, setStarterProgramOpen] = useState(false);
  const [starterProgramForm, setStarterProgramForm] = useState({
    studentName: "",
    guardianName: "",
    notificationContact: "",
    appointmentTime: "4:30 PM"
  });
  const currentYear = visibleMonthDate.getFullYear();
  const currentMonth = visibleMonthDate.getMonth();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const calendarDays = useMemo(() => {
    const gridStart = new Date(currentYear, currentMonth, 1 - monthStart.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [currentMonth, currentYear, monthStart]);
  const entries = useMemo<ManagerCalendarEntry[]>(
    () => [
      ...studioClasses.flatMap((studioClass) =>
        studioClass.recurring === false
          ? []
          : calendarDays
              .filter((day) => studioClass.daysOfWeek.includes(day.getDay() as ClassWeekday))
              .map((day) => ({
                id: `${studioClass.id}-${toDateKey(day)}`,
                title: studioClass.name,
                date: toDateKey(day),
                time: formatClassTimeRange(studioClass),
                kind: "class" as const,
                meta: "recurring class",
                path: "/classes",
                titleColor: studioClass.titleColor
              }))
      ),
      ...scheduledClasses.flatMap((item) => scheduledClassCalendarEntries(item, calendarDays)),
      ...studioEvents.map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        kind: "event" as const,
        meta: event.audience,
        path: "/events"
      }))
    ].sort(compareCalendarEntries),
    [calendarDays, scheduledClasses, studioClasses, studioEvents]
  );
  const entriesByDate = useMemo(
    () => entries.reduce<Record<string, ManagerCalendarEntry[]>>((groups, entry) => {
      groups[entry.date] = [...(groups[entry.date] ?? []), entry];
      return groups;
    }, {}),
    [entries]
  );
  const selectedEntries = entriesByDate[selectedDateKey] ?? [];
  const selectedDate = parseCalendarDate(selectedDateKey);
  const selectedWeekDays = useMemo(() => weekDaysForDate(selectedDate), [selectedDateKey]);
  const visibleCalendarDays = calendarView === "month" ? calendarDays : calendarView === "week" ? selectedWeekDays : [selectedDate];
  const visibleWeekdayLabels = calendarView === "day" ? [selectedDate.toLocaleDateString("en-US", { weekday: "short" })] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const calendarViewLabel =
    calendarView === "month"
      ? monthLabel
      : calendarView === "week"
        ? `Week of ${selectedWeekDays[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
        : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const periodLabel =
    calendarView === "month"
      ? monthLabel
      : calendarView === "week"
        ? formatWeekRange(selectedWeekDays)
        : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const selectCalendarDate = (date: Date) => {
    setSelectedDateKey(toDateKey(date));
    setVisibleMonthDate(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const shiftVisiblePeriod = (direction: number) => {
    selectCalendarDate(shiftCalendarPeriod(selectedDate, calendarView, direction));
  };

  const openStarterProgram = () => {
    setScheduleActionsOpen(false);
    setStarterProgramOpen(true);
  };

  const closeStarterProgram = () => {
    setStarterProgramOpen(false);
    setStarterProgramForm({ studentName: "", guardianName: "", notificationContact: "", appointmentTime: starterProgramForm.appointmentTime });
  };

  const submitStarterProgram = (event: FormEvent) => {
    event.preventDefault();
    const studentName = starterProgramForm.studentName.trim();
    const guardianName = starterProgramForm.guardianName.trim();
    const notificationContact = starterProgramForm.notificationContact.trim();
    if (!studentName) {
      showToast("Enter the student's name for the starter appointment.");
      return;
    }
    if (guardianName && !notificationContact) {
      showToast("Enter a parent or guardian email or phone for notifications.");
      return;
    }
    const created = addScheduledClass({
      title: `Starter Program - ${studentName}`,
      date: selectedDateKey,
      time: starterProgramForm.appointmentTime,
      type: "starter-program",
      recurring: false,
      titleColor: "#f2dfab",
      notes: [
        "Starter Program first meeting session.",
        guardianName ? `Guardian/Parent: ${guardianName}` : "Guardian/Parent: Not provided",
        notificationContact ? `Notification contact: ${notificationContact}` : "Notification contact: Not provided"
      ].join("\n")
    });
    if (!created) {
      showToast("Starter Program appointment could not be booked.");
      return;
    }
    setStarterProgramForm({ studentName: "", guardianName: "", notificationContact: "", appointmentTime: starterProgramForm.appointmentTime });
    setStarterProgramOpen(false);
    showToast(`${created.title} booked for ${selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`);
  };

  useEffect(() => {
    const todayDate = parseCalendarDate(todayKey);
    setSelectedDateKey(todayKey);
    setVisibleMonthDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  }, [todayKey]);

  useEffect(() => {
    if (!focusDateKey || !isCalendarDateKey(focusDateKey)) return;
    const focusDate = parseCalendarDate(focusDateKey);
    setSelectedDateKey(focusDateKey);
    setVisibleMonthDate(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1));
  }, [focusDateKey]);

  return (
    <section className="manager-calendar-panel" aria-label="Live studio calendar">
      <header className="manager-calendar-head">
        <div>
          <CalendarDays size={34} />
          <div>
            <h2 className="sr-only">{monthLabel}</h2>
            <p>Live studio calendar · updates from today&apos;s date</p>
          </div>
        </div>
        <div className="manager-calendar-view-switch" role="group" aria-label="Calendar view">
          {managerCalendarViewOptions.map((option) => (
            <button
              aria-pressed={calendarView === option.value}
              key={option.value}
              onClick={() => setCalendarView(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="manager-calendar-add-trigger"
          aria-label="Open schedule actions"
          aria-expanded={scheduleActionsOpen}
          aria-haspopup="dialog"
          onClick={() => setScheduleActionsOpen(true)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </header>
      {scheduleActionsOpen && (
        <div className="modal-backdrop manager-calendar-action-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setScheduleActionsOpen(false)}>
          <div
            aria-labelledby="manager-calendar-action-title"
            aria-modal="true"
            className="modal-card manager-calendar-action-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="manager-calendar-action-title">Add to schedule</h2>
                <p>Choose the calendar item you want to create.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close schedule actions" onClick={() => setScheduleActionsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="manager-calendar-action-options">
              <Link to="/events?create=event&returnTo=dashboard" onClick={() => setScheduleActionsOpen(false)}>
                <CalendarDays size={18} aria-hidden="true" />
                Add Event
              </Link>
              <Link to="/classes?create=class" onClick={() => setScheduleActionsOpen(false)}>
                <Users size={18} aria-hidden="true" />
                Add Class
              </Link>
              <button type="button" onClick={openStarterProgram}>
                <UserPlus size={18} aria-hidden="true" />
                Starter Program
              </button>
            </div>
          </div>
        </div>
      )}
      {starterProgramOpen && (
        <div className="modal-backdrop manager-calendar-action-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeStarterProgram()}>
          <form
            aria-labelledby="starter-program-title"
            aria-modal="true"
            className="modal-card modal-form manager-starter-program-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submitStarterProgram}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="starter-program-title">Starter Program</h2>
                <p>Book the first meeting session required before joining class.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close Starter Program" onClick={closeStarterProgram}>
                <X size={18} />
              </button>
            </div>
            <div className="manager-starter-program-date" aria-label="Starter appointment date">
              <CalendarDays size={18} aria-hidden="true" />
              <span>
                <small>Selected date</small>
                <strong>{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong>
              </span>
            </div>
            <label>
              Student&apos;s Name
              <input
                autoFocus
                value={starterProgramForm.studentName}
                onChange={(event) => setStarterProgramForm((current) => ({ ...current, studentName: event.target.value }))}
              />
            </label>
            <label>
              Guardian/Parent Name
              <input
                value={starterProgramForm.guardianName}
                onChange={(event) => setStarterProgramForm((current) => ({ ...current, guardianName: event.target.value }))}
              />
            </label>
            <label>
              Notification Email or Phone
              <input
                value={starterProgramForm.notificationContact}
                onChange={(event) => setStarterProgramForm((current) => ({ ...current, notificationContact: event.target.value }))}
              />
            </label>
            <label>
              Appointment Time
              <select
                value={starterProgramForm.appointmentTime}
                onChange={(event) => setStarterProgramForm((current) => ({ ...current, appointmentTime: event.target.value }))}
              >
                {starterProgramAppointmentTimes.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </label>
            <div className="manager-starter-program-actions">
              <button type="button" onClick={closeStarterProgram}>Cancel</button>
              <button type="submit">
                <UserPlus size={18} aria-hidden="true" />
                Book Starter Appointment
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="manager-calendar-body">
        <div className="manager-calendar-period-nav" role="group" aria-label="Calendar period navigation">
          <button aria-label={`Previous ${calendarView}`} onClick={() => shiftVisiblePeriod(-1)} type="button">
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <strong>{periodLabel}</strong>
          <button aria-label={`Next ${calendarView}`} onClick={() => shiftVisiblePeriod(1)} type="button">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
        <div className={`manager-calendar-grid manager-calendar-grid--${calendarView}`} role="grid" aria-label={`${calendarViewLabel} Cho's studio calendar`}>
          {visibleWeekdayLabels.map((dayName) => (
            <span className="manager-calendar-weekday" key={dayName}>{dayName}</span>
          ))}
          {visibleCalendarDays.map((day) => {
            const dateKey = toDateKey(day);
            const dayEntries = entriesByDate[dateKey] ?? [];
            const dayPreviewLimit = calendarView === "month" ? 2 : 3;
            const isToday = dateKey === todayKey;
            const isOutsideMonth = day.getMonth() !== currentMonth;
            const isSelected = dateKey === selectedDateKey;
            return (
              <button
                type="button"
                className={`manager-calendar-day${isToday ? " is-today" : ""}${isOutsideMonth ? " is-muted" : ""}${isSelected ? " is-selected is-pulsing-selected" : ""}${dayEntries.length ? " has-items" : ""}`}
                key={dateKey}
                onClick={() => selectCalendarDate(day)}
                aria-pressed={isSelected}
                aria-label={`Select ${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}${dayEntries.length ? `, ${dayEntries.length} calendar item${dayEntries.length === 1 ? "" : "s"}` : ", no calendar items"}`}
              >
                <span>{day.getDate()}</span>
                <div>
                  {dayEntries.slice(0, dayPreviewLimit).map((entry) => {
                    const entryStyle = entry.titleColor
                      ? ({ "--manager-calendar-entry-color": entry.titleColor, color: entry.titleColor } as CSSProperties)
                      : undefined;
                    return (
                      <span className={`manager-calendar-entry ${entry.kind}`} key={entry.id} style={entryStyle} title={entry.title}>
                        {entry.title}
                      </span>
                    );
                  })}
                  {dayEntries.length > dayPreviewLimit && <small>+{dayEntries.length - dayPreviewLimit} more</small>}
                </div>
              </button>
            );
          })}
        </div>
        <section className="manager-calendar-selected-panel manager-calendar-selected-panel--fixed" aria-label="Selected date events" aria-live="polite">
          <header>
            <div>
              <h3>{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
              <p>{selectedDateKey === todayKey ? "Today" : "Selected date"}</p>
            </div>
            <span>{selectedEntries.length} event{selectedEntries.length === 1 ? "" : "s"}</span>
          </header>
          {selectedEntries.length ? (
            <div className={`manager-calendar-selected-list manager-calendar-selected-list--no-scrollbar${selectedEntries.length > 2 ? " manager-calendar-selected-list--crowded" : ""}${selectedEntries.length > 3 ? " manager-calendar-selected-list--dense" : ""}`}>
              {selectedEntries.map((entry) => {
                const timeRange = splitCalendarTimeRange(entry.time);
                return (
                  <Link className="manager-calendar-selected-item" key={entry.id} to={entry.path} aria-label={`${entry.time}, ${entry.title}, ${entry.meta}`}>
                    <span className={`manager-calendar-selected-time${timeRange ? " is-range" : ""}`} title={entry.time}>
                      {timeRange ? (
                        <>
                          <span className="manager-calendar-selected-time-value">{timeRange.start}</span>
                          <span className="manager-calendar-selected-time-divider" aria-hidden="true">to</span>
                          <span className="manager-calendar-selected-time-value">{timeRange.end}</span>
                        </>
                      ) : (
                        <span className="manager-calendar-selected-time-value">{entry.time}</span>
                      )}
                    </span>
                    <div className="manager-calendar-selected-copy">
                      <span className={`manager-calendar-selected-kind ${entry.kind}`}>{entry.kind}</span>
                      <strong style={entry.titleColor ? { color: entry.titleColor } : undefined}>{entry.title}</strong>
                      <small>{entry.meta}</small>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p>No classes or events scheduled for this date.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function ManagerLauncherIcon({ icon }: { icon: ManagerLauncherIconKind }) {
  const frameClassName = `manager-launcher-graphic manager-launcher-graphic--${icon}`;
  const imageClassName = `manager-launcher-image manager-launcher-image--${icon}${icon === "students" ? " manager-students-emblem" : ""}`;
  const launcherIconImage = managerLauncherIconImages[icon];

  if (!launcherIconImage) {
    const LauncherSymbol = icon === "create" ? UserPlus : icon === "studyGuide" ? BookOpen : Video;

    return (
      <span className={frameClassName} aria-hidden="true">
        <LauncherSymbol className={`manager-launcher-symbol manager-launcher-symbol--${icon}`} />
      </span>
    );
  }

  return (
    <span className={frameClassName} aria-hidden="true">
      <img
        className={imageClassName}
        src={launcherIconImage}
        alt=""
        draggable="false"
      />
    </span>
  );
}

function managerLauncherPath(item: ManagerLauncherItem) {
  return `/manager?tool=${item.icon}`;
}

function getSelectedStudentLauncherItem(search: string) {
  const requestedTool = new URLSearchParams(search).get("tool");
  return studentLauncherItems.find((item) => item.icon === requestedTool) ?? studentLauncherItems[0];
}

function useStudentPanelSummary() {
  const { currentChildAccount, session, students } = useAppState();
  const selectedStudent = useMemo(() => {
    const sessionEmail = session?.email.toLowerCase();
    const sessionStudent = sessionEmail ? students.find((student) => student.email.toLowerCase() === sessionEmail) : undefined;
    if (sessionStudent) return sessionStudent;
    if (currentChildAccount) return undefined;
    return students.find((student) => (student.status ?? "Active").toLowerCase() === "active") ?? students[0];
  }, [currentChildAccount, session?.email, students]);
  const studentProfile = readStudentProfile(session?.email, selectedStudent, currentChildAccount);
  const studentName = studentProfile.name || (selectedStudent ? fullName(selectedStudent) : currentChildAccount?.name.trim() || "Cho's Student");
  const studentFirstName = studentName.trim().split(/\s+/)[0] || "Student";
  const studentBeltRank = resolveBeltRank(currentChildAccount?.beltSlug ?? selectedStudent?.beltRank ?? "White");
  const classesAttended = selectedStudent?.classesAttended ?? 0;
  const journeyStats = getBeltJourneyStats(studentBeltRank, classesAttended);
  const studentPortrait = studentProfile.photoDataUrl ?? (selectedStudent?.profileImagePath ? publicAsset(selectedStudent.profileImagePath) : publicAsset("assets/CheetahProfilePic/Cheetah.png"));

  return {
    classesAttended,
    journeyStats,
    selectedStudent,
    studentBeltRank,
    studentFirstName,
    studentName,
    studentPortrait
  };
}

function StudentPanelToolPage({
  actionLabel,
  children,
  text,
  title
}: {
  actionLabel: string;
  children: ReactNode;
  text: string;
  title: string;
}) {
  const { journeyStats, studentBeltRank, studentPortrait } = useStudentPanelSummary();
  const progressStyle = {
    "--student-belt-case-progress": `${journeyStats.progressPercent}%`
  } as CSSProperties;

  return (
    <OperationsPage className={`operations-page--workflow student-panel-tool-page student-panel-tool-page--${title.toLowerCase()}`} title={title} text={text}>
      <section className="student-panel-tool-surface" aria-label={`Student ${title} page`}>
        <aside className="student-panel-quick-status" aria-label="Student page quick belt status">
          <div className="student-panel-quick-status-head">
            <img src={studentPortrait} alt="" aria-hidden="true" draggable="false" />
            <div>
              <span>{actionLabel}</span>
              <strong>{studentBeltRank.name} Belt</strong>
              <p>{journeyStats.progressLabel}</p>
            </div>
          </div>
          <div
            className="student-panel-progress student-panel-progress--compact"
            role="progressbar"
            aria-label={`${title} progress to ${journeyStats.nextBeltName}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={journeyStats.progressPercent}
            style={progressStyle}
          >
            <span aria-hidden="true" />
            <small>{journeyStats.progressLabel}</small>
          </div>
          <div className="student-panel-action-row student-panel-action-row--compact">
            <Link to="/">
              <Award size={16} aria-hidden="true" />
              <span>Open Belt Case</span>
            </Link>
            <Link to={managerLauncherPath({ label: "Dashboard", icon: "dashboard" })}>
              <BarChart3 size={16} aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
          </div>
        </aside>
        <div className="student-panel-tool-content">
          {children}
        </div>
      </section>
    </OperationsPage>
  );
}

function ManagerLauncherWorkspace({ tool }: { tool: ManagerLauncherIconKind }) {
  switch (tool) {
    case "dashboard":
      return <DashboardPage />;
    case "create":
      return <CreateAccountsPage />;
    case "messages":
      return <MessagesPage />;
    case "students":
      return <StudentsPage />;
    case "classes":
      return <ClassesPage />;
    case "studyGuide":
      return <ManagerStudyGuidePage />;
    case "events":
      return <EventsPage />;
    case "scheduling":
      return <SchedulePage />;
    case "merchandise":
      return <MerchandisePage />;
    case "videos":
      return <ManagerVideosPage />;
    case "reports":
      return <ReportsPage />;
    default:
      return <DashboardPage />;
  }
}

function StudentPanelDashboardPage() {
  const { scheduledClasses, studioEvents } = useAppState();
  const { classesAttended, journeyStats, selectedStudent, studentBeltRank, studentFirstName, studentName, studentPortrait } = useStudentPanelSummary();
  const today = toDateKey(useLiveCalendarDate());
  const nextScheduledClass = findNextStudentScheduledClass(scheduledClasses, selectedStudent?.id, today);
  const nextEvent = findNextStudioEvent(studioEvents, today);
  const progressStyle = {
    "--student-belt-case-progress": `${journeyStats.progressPercent}%`
  } as CSSProperties;

  return (
    <OperationsPage className="operations-page--workflow student-panel-dashboard-page" title="Dashboard" text="Student overview, upcoming class reminders, and account shortcuts.">
      <section className="student-panel-training-dashboard" aria-label="Student training dashboard">
        <article className="student-panel-journey-card">
          <div className="student-panel-hero-copy">
            <img src={studentPortrait} alt="" aria-hidden="true" draggable="false" />
            <div>
              <span>My Training Journey</span>
              <h2>{studentFirstName}'s Training Panel</h2>
              <p>Keep your belt progress, class plan, and practice goals in one place.</p>
            </div>
          </div>
          <div className="student-panel-rank-row">
            <div>
              <span>Current Rank</span>
              <strong>{studentBeltRank.name} Belt</strong>
            </div>
            <div>
              <span>Next: {journeyStats.nextBeltName}</span>
              <strong>{journeyStats.encouragement}</strong>
            </div>
          </div>
          <div
            className="student-panel-progress"
            role="progressbar"
            aria-label={`Student panel progress to ${journeyStats.nextBeltName}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={journeyStats.progressPercent}
            style={progressStyle}
          >
            <span aria-hidden="true" />
            <small>{journeyStats.progressLabel}</small>
          </div>
          <dl className="student-panel-stat-strip" aria-label="Student training stats">
            <div>
              <dt>{journeyStats.classesAttended}</dt>
              <dd>Classes</dd>
            </div>
            <div>
              <dt>{journeyStats.skillsLearned}</dt>
              <dd>Skills</dd>
            </div>
            <div>
              <dt>{journeyStats.achievementsEarned}</dt>
              <dd>Achievements</dd>
            </div>
          </dl>
        </article>
        <aside className="student-panel-next-card" aria-label="Student next steps">
          <article>
            <CalendarDays size={18} aria-hidden="true" />
            <div>
              <span>Next Class</span>
              <strong>{nextScheduledClass ? nextScheduledClass.title : "No class scheduled"}</strong>
              <p>{nextScheduledClass ? `${nextScheduledClass.date} at ${nextScheduledClass.time}` : "Check back for your next class."}</p>
            </div>
          </article>
          <article>
            <Award size={18} aria-hidden="true" />
            <div>
              <span>Next Event</span>
              <strong>{nextEvent?.title ?? "No event posted"}</strong>
              <p>{nextEvent ? `${nextEvent.date} at ${nextEvent.time}` : "Watch this space for testing and school events."}</p>
            </div>
          </article>
          <div className="student-panel-action-row">
            <Link to="/">
              <Award size={16} aria-hidden="true" />
              <span>Open Belt Case</span>
            </Link>
            <Link to={managerLauncherPath({ label: "Classes", icon: "classes" })}>
              <Users size={16} aria-hidden="true" />
              <span>View Classes</span>
            </Link>
          </div>
        </aside>
      </section>
      <div className="operations-stats">
        <StatCard label="Student" value={studentName} icon={<Users />} />
        <StatCard label="Rank" value={studentBeltRank.name} icon={<Award />} />
        <StatCard label="Classes attended" value={classesAttended} icon={<CheckCircle2 />} />
      </div>
      <section className="operations-panel workflow-directory-panel" aria-label="Student dashboard summary">
        <div className="student-roster-head">
          <div>
            <h2>Today</h2>
            <p>Quick student account details for the current training week.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Student dashboard cards">
          <article className="workflow-directory-group">
            <div className="workflow-directory-group-head">
              <div>
                <span className="workflow-directory-swatch" aria-hidden="true" />
                <h3>Next Class</h3>
              </div>
              <span>{nextScheduledClass?.date ?? "No date"}</span>
            </div>
            <p>{nextScheduledClass ? `${nextScheduledClass.title} at ${nextScheduledClass.time}` : "No class is scheduled yet."}</p>
          </article>
          <article className="workflow-directory-group">
            <div className="workflow-directory-group-head">
              <div>
                <span className="workflow-directory-swatch" aria-hidden="true" />
                <h3>Next Event</h3>
              </div>
              <span>{nextEvent?.date ?? "No date"}</span>
            </div>
            <p>{nextEvent ? `${nextEvent.title} at ${nextEvent.time}` : "No event notification is available yet."}</p>
          </article>
        </div>
      </section>
    </OperationsPage>
  );
}

function StudentPanelClassesPage() {
  const { studioClasses } = useAppState();

  return (
    <StudentPanelToolPage actionLabel="Class Plan" title="Classes" text="Review current Cho's class options and weekly training times.">
      <section className="operations-panel workflow-directory-panel" aria-label="Student class list">
        <div className="student-roster-head">
          <div>
            <h2>Class Schedule</h2>
            <p>Active class groups shown as student-facing schedule information.</p>
          </div>
          <span>{studioClasses.length} class{studioClasses.length === 1 ? "" : "es"}</span>
        </div>
        <div className="workflow-directory-grid" aria-label="Student classes">
          {studioClasses.map((studioClass) => (
            <article className="workflow-directory-group" key={studioClass.id}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{studioClass.name}</h3>
                </div>
                <span>{formatClassTimeRange(studioClass)}</span>
              </div>
              <p>{formatClassDays(studioClass.daysOfWeek)}</p>
              {studioClass.notes && <p>{studioClass.notes}</p>}
            </article>
          ))}
        </div>
      </section>
    </StudentPanelToolPage>
  );
}

function StudentStudyPage() {
  const { studyGuideFolders, studyGuideMaterials } = useAppState();
  const studyItems = [
    { title: "Forms", detail: "Practice beginner forms with clean stances, eyes forward, and steady breathing." },
    { title: "Kicks", detail: "Review front kick, round kick, and side kick control before class." },
    { title: "Respect", detail: "Prepare bow-in etiquette, listening posture, and class focus goals." }
  ];

  return (
    <StudentPanelToolPage actionLabel="Study Focus" title="Study" text="Student practice reminders for at-home martial arts review.">
      <StudyGuideLibrarySection
        ariaLabel="Student study guide materials"
        emptyText="No manager study materials have been published yet."
        folders={studyGuideFolders}
        materials={studyGuideMaterials}
        title="Study Materials"
      />
      <section className="operations-panel workflow-directory-panel" aria-label="Student study guide">
        <div className="student-roster-head">
          <div>
            <h2>Practice Guide</h2>
            <p>Simple study cards for skills students can review before the next class.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Study cards">
          {studyItems.map((item) => (
            <article className="workflow-directory-group" key={item.title}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{item.title}</h3>
                </div>
                <span>Study</span>
              </div>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </StudentPanelToolPage>
  );
}

function completedReadinessItemCount(progress: StudentBeltProgress) {
  if (progress.readyForReview) return beltReadinessItems.length;
  if (!progress.classesRequired) return 0;
  return Math.min(beltReadinessItems.length, Math.max(1, Math.floor((progress.progressPercent / 100) * beltReadinessItems.length)));
}

function StudentTestPage() {
  const { currentManagedAccount, session, students } = useAppState();
  const selectedStudent = selectSessionStudent(students, session?.email, currentManagedAccount?.studentId);
  const progress = selectedStudent ? buildStudentBeltProgress(selectedStudent) : undefined;
  const studentName = selectedStudent ? fullName(selectedStudent) : "Cho's Student";
  const rankLabel = progress ? `${progress.rankName} Belt` : "No rank";
  const classesLabel = progress ? `${progress.classesAttended} of ${progress.classesRequired} classes` : "No class count";
  const reviewStatus = progress?.isBlackBelt
    ? "Ongoing black belt training"
    : progress?.readyForReview
      ? "Ready for instructor review"
      : `${progress?.classesRemaining ?? 0} class${progress?.classesRemaining === 1 ? "" : "es"} to testing review`;
  const statusMetricLabel = progress?.readyForReview || progress?.isBlackBelt ? "Review status" : "Classes to review";
  const statusMetricValue = progress?.readyForReview ? "Ready" : progress?.isBlackBelt ? "Ongoing" : progress?.classesRemaining ?? 0;
  const completeReadinessItems = progress ? completedReadinessItemCount(progress) : 0;

  return (
    <StudentPanelToolPage actionLabel="Testing Path" title="Test" text="Testing readiness reminders and next-step preparation for students.">
      <div className="operations-stats student-test-stats">
        <StatCard label="Student" value={studentName} icon={<Users />} />
        <StatCard label="Current rank" value={rankLabel} icon={<Award />} />
        <StatCard label={statusMetricLabel} value={statusMetricValue} icon={<Target />} />
      </div>

      <section className="operations-panel workflow-directory-panel student-test-progress-panel" aria-label="Student belt progress">
        <div className="student-roster-head">
          <div>
            <h2>{studentName}</h2>
            <p>{reviewStatus}</p>
          </div>
          <span className="student-test-rank-chip">{rankLabel}</span>
        </div>
        {progress ? (
          <div className="student-test-progress-grid">
            <div className="student-test-progress-copy">
              <span>{classesLabel}</span>
              <strong>{progress.progressPercent}% complete</strong>
              <p>{progress.focus}</p>
              {progress.nextRankName && <p>Next rank target: {progress.nextRankName} Belt.</p>}
            </div>
            <div className="student-test-progress-meter" aria-label={`${progress.progressPercent}% of ${progress.classesRequired} classes complete`}>
              <span style={{ width: `${progress.progressPercent}%` }} />
            </div>
          </div>
        ) : (
          <p className="operations-note">No student record is linked to this account yet.</p>
        )}
      </section>
      <section className="operations-panel workflow-directory-panel" aria-label="Student test readiness">
        <div className="student-roster-head">
          <div>
            <h2>Testing Checklist</h2>
            <p>Key readiness points before {studentName} signs up for belt testing.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Testing checklist cards">
          {beltReadinessItems.map((item, index) => (
            <article className={`workflow-directory-group student-test-readiness-card${index < completeReadinessItems ? " is-complete" : ""}`} key={item.id}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{item.label}</h3>
                </div>
                <span>{index < completeReadinessItems ? "Ready" : "Practice"}</span>
              </div>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </StudentPanelToolPage>
  );
}

function formatStudyMaterialSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "Study file";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatStudyGuideFolderOption(folder: StudyGuideFolder, folders: StudyGuideFolder[]) {
  const parentFolder = folder.parentId ? folders.find((candidate) => candidate.id === folder.parentId) : undefined;
  return parentFolder ? `${parentFolder.name} / ${folder.name}` : folder.name;
}

function StudyGuideLibrarySection({
  ariaLabel,
  emptyText,
  folders,
  materials,
  title
}: {
  ariaLabel: string;
  emptyText: string;
  folders: StudyGuideFolder[];
  materials: StudyGuideMaterial[];
  title: string;
}) {
  const folderGroups = folders.map((folder) => ({
    folder,
    materials: materials.filter((material) => material.folderId === folder.id),
    parentFolder: folder.parentId ? folders.find((candidate) => candidate.id === folder.parentId) : undefined
  }));
  const unfiledMaterials = materials.filter((material) => !folders.some((folder) => folder.id === material.folderId));

  return (
    <section className="operations-panel workflow-directory-panel study-guide-library-panel" aria-label={ariaLabel}>
      <div className="student-roster-head">
        <div>
          <h2>{title}</h2>
          <p>{materials.length} study material{materials.length === 1 ? "" : "s"} published for students.</p>
        </div>
      </div>
      {folders.length || materials.length ? (
        <div className="workflow-directory-grid study-guide-library-grid" aria-label={`${title} folders`}>
          {folderGroups.map(({ folder, materials: folderMaterials, parentFolder }) => (
            <section className="workflow-directory-group study-guide-folder-card" key={folder.id} role="group" aria-label={`${folder.name} study guide folder`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{folder.name}</h3>
                </div>
                <span>{folderMaterials.length} file{folderMaterials.length === 1 ? "" : "s"}</span>
              </div>
              <p className="study-guide-folder-subject">{folder.subject}</p>
              {parentFolder && <p className="study-guide-folder-path">Inside {parentFolder.name}</p>}
              {folder.description && <p>{folder.description}</p>}
              {folderMaterials.length ? (
                <div className="study-material-list">
                  {folderMaterials.map((material) => (
                    <article className="study-material-card" key={material.id}>
                      <span className="study-material-file-icon" aria-hidden="true">
                        <FileText />
                      </span>
                      <div className="study-material-details">
                        <h4>{material.title}</h4>
                        {material.description && <p>{material.description}</p>}
                        <span>{material.fileName} · {formatStudyMaterialSize(material.size)}</span>
                      </div>
                      <a className="study-material-download" href={material.fileDataUrl} download={material.fileName}>
                        Open {material.title}
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="study-guide-empty-note">No materials in this folder yet.</p>
              )}
            </section>
          ))}
          {unfiledMaterials.length > 0 && (
            <section className="workflow-directory-group study-guide-folder-card" role="group" aria-label="Unfiled study guide folder">
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>Unfiled</h3>
                </div>
                <span>{unfiledMaterials.length} file{unfiledMaterials.length === 1 ? "" : "s"}</span>
              </div>
              <div className="study-material-list">
                {unfiledMaterials.map((material) => (
                  <article className="study-material-card" key={material.id}>
                    <span className="study-material-file-icon" aria-hidden="true">
                      <FileText />
                    </span>
                    <div className="study-material-details">
                      <h4>{material.title}</h4>
                      {material.description && <p>{material.description}</p>}
                      <span>{material.fileName} · {formatStudyMaterialSize(material.size)}</span>
                    </div>
                    <a className="study-material-download" href={material.fileDataUrl} download={material.fileName}>
                      Open {material.title}
                    </a>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <p className="study-guide-empty-note">{emptyText}</p>
      )}
    </section>
  );
}

function ManagerStudyGuidePage() {
  const { addStudyGuideFolder, addStudyGuideMaterial, showToast, studyGuideFolders, studyGuideMaterials } = useAppState();
  const [folderForm, setFolderForm] = useState({ name: "", subject: "", parentId: "", description: "" });
  const [materialForm, setMaterialForm] = useState({
    title: "",
    folderId: studyGuideFolders[0]?.id ?? "",
    description: "",
    fileName: "",
    mimeType: "",
    size: 0,
    fileDataUrl: ""
  });

  useEffect(() => {
    if (!studyGuideFolders.length) return;
    setMaterialForm((current) => (
      studyGuideFolders.some((folder) => folder.id === current.folderId)
        ? current
        : { ...current, folderId: studyGuideFolders[0].id }
    ));
  }, [studyGuideFolders]);

  const createStudyFolder = (event: FormEvent) => {
    event.preventDefault();
    const savedFolder = addStudyGuideFolder(folderForm);
    if (!savedFolder) {
      showToast("Enter a study folder name, subject, and valid parent folder.");
      return;
    }
    setFolderForm({ name: "", subject: "", parentId: "", description: "" });
    setMaterialForm((current) => ({ ...current, folderId: savedFolder.id }));
    showToast(`${savedFolder.name} study folder created.`);
  };

  const handleStudyMaterialUpload = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const fileDataUrl = typeof reader.result === "string" ? reader.result : "";
      setMaterialForm((current) => ({
        ...current,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        fileDataUrl
      }));
    };
    reader.readAsDataURL(file);
  };

  const publishStudyMaterial = (event: FormEvent) => {
    event.preventDefault();
    const savedMaterial = addStudyGuideMaterial(materialForm);
    if (!savedMaterial) {
      showToast("Create a folder, add a title, and choose a study material file before publishing.");
      return;
    }
    setMaterialForm((current) => ({
      title: "",
      folderId: current.folderId,
      description: "",
      fileName: "",
      mimeType: "",
      size: 0,
      fileDataUrl: ""
    }));
    showToast(`${savedMaterial.title} published to student study materials.`);
  };

  return (
    <OperationsPage className="operations-page--workflow" title="Study Guide" text="Create student study folders and publish downloadable training materials.">
      <div className="operations-stats">
        <StatCard label="Folders" value={studyGuideFolders.length} icon={<FolderPlus />} />
        <StatCard label="Materials" value={studyGuideMaterials.length} icon={<FileText />} />
      </div>
      <div className="operations-two-column study-guide-manager-layout">
        <section className="operations-panel study-guide-manager-panel" aria-label="Manager study guide tools">
          <div className="student-roster-head">
            <div>
              <h2>Study Upload Center</h2>
              <p>Create top-level folders or subfolders, then publish study files into the selected folder.</p>
            </div>
          </div>
          <form className="study-guide-tool-form" aria-label="Create study folder" onSubmit={createStudyFolder}>
            <h3>New Folder</h3>
            <label>
              Folder name
              <input value={folderForm.name} onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })} />
            </label>
            <label>
              Folder subject
              <input value={folderForm.subject} onChange={(event) => setFolderForm({ ...folderForm, subject: event.target.value })} />
            </label>
            <label>
              Parent folder
              <select value={folderForm.parentId} onChange={(event) => setFolderForm({ ...folderForm, parentId: event.target.value })}>
                <option value="">Top-level folder</option>
                {studyGuideFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{formatStudyGuideFolderOption(folder, studyGuideFolders)}</option>
                ))}
              </select>
            </label>
            <label>
              Folder description
              <textarea rows={2} value={folderForm.description} onChange={(event) => setFolderForm({ ...folderForm, description: event.target.value })} />
            </label>
            <button type="submit" className="operations-action student-header-add">
              <FolderPlus size={18} /> Create Folder
            </button>
          </form>
          <form className="study-guide-tool-form" aria-label="Upload study material" onSubmit={publishStudyMaterial}>
            <h3>Publish Material</h3>
            <label>
              Material title
              <input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} />
            </label>
            <label>
              Material folder
              <select value={materialForm.folderId} disabled={!studyGuideFolders.length} onChange={(event) => setMaterialForm({ ...materialForm, folderId: event.target.value })}>
                {studyGuideFolders.length ? (
                  studyGuideFolders.map((folder) => <option key={folder.id} value={folder.id}>{formatStudyGuideFolderOption(folder, studyGuideFolders)}</option>)
                ) : (
                  <option value="">Create a folder first</option>
                )}
              </select>
            </label>
            <label>
              Material description
              <textarea rows={3} value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} />
            </label>
            <label className="study-material-file-upload">
              Upload study material file
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                aria-label="Upload study material file"
                onChange={handleStudyMaterialUpload}
              />
            </label>
            <p className="study-material-upload-ready">{materialForm.fileName ? `${materialForm.fileName} ready to publish.` : "No study material selected yet."}</p>
            <button type="submit" className="operations-action student-header-add">
              <Upload size={18} /> Publish Study Material
            </button>
          </form>
        </section>
        <StudyGuideLibrarySection
          ariaLabel="Manager study guide library"
          emptyText="Create a folder and upload the first study material for students."
          folders={studyGuideFolders}
          materials={studyGuideMaterials}
          title="Student Study Library"
        />
      </div>
    </OperationsPage>
  );
}

function formatVideoFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "Video file";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function VideoLibrarySection({
  ariaLabel,
  emptyText,
  folders,
  title,
  videos
}: {
  ariaLabel: string;
  emptyText: string;
  folders: TrainingVideoFolder[];
  title: string;
  videos: TrainingVideo[];
}) {
  const folderGroups = folders.map((folder) => ({
    folder,
    videos: videos.filter((video) => video.folderId === folder.id)
  }));
  const unfiledVideos = videos.filter((video) => !folders.some((folder) => folder.id === video.folderId));

  return (
    <section className="operations-panel workflow-directory-panel videos-library-panel" aria-label={ariaLabel}>
      <div className="student-roster-head">
        <div>
          <h2>{title}</h2>
          <p>{videos.length} video{videos.length === 1 ? "" : "s"} published for students.</p>
        </div>
      </div>
      {folders.length || videos.length ? (
        <div className="workflow-directory-grid videos-library-grid" aria-label={`${title} folders`}>
          {folderGroups.map(({ folder, videos: folderVideos }) => (
            <section className="workflow-directory-group videos-folder-card" key={folder.id} role="group" aria-label={`${folder.name} video folder`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{folder.name}</h3>
                </div>
                <span>{folderVideos.length} video{folderVideos.length === 1 ? "" : "s"}</span>
              </div>
              <p className="videos-folder-subject">{folder.subject}</p>
              {folder.description && <p>{folder.description}</p>}
              {folderVideos.length ? (
                <div className="training-video-list">
                  {folderVideos.map((video) => (
                    <article className="training-video-card" key={video.id}>
                      <video className="training-video-player" title={`${video.title} video player`} src={video.videoDataUrl} controls preload="metadata" />
                      <div>
                        <h4>{video.title}</h4>
                        {video.description && <p>{video.description}</p>}
                        <span>{video.fileName} · {formatVideoFileSize(video.size)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="videos-empty-note">No videos in this folder yet.</p>
              )}
            </section>
          ))}
          {unfiledVideos.length > 0 && (
            <section className="workflow-directory-group videos-folder-card" role="group" aria-label="Unfiled video folder">
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>Unfiled</h3>
                </div>
                <span>{unfiledVideos.length} video{unfiledVideos.length === 1 ? "" : "s"}</span>
              </div>
              <div className="training-video-list">
                {unfiledVideos.map((video) => (
                  <article className="training-video-card" key={video.id}>
                    <video className="training-video-player" title={`${video.title} video player`} src={video.videoDataUrl} controls preload="metadata" />
                    <div>
                      <h4>{video.title}</h4>
                      {video.description && <p>{video.description}</p>}
                      <span>{video.fileName} · {formatVideoFileSize(video.size)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <p className="videos-empty-note">{emptyText}</p>
      )}
    </section>
  );
}

function ManagerVideosPage() {
  const { addTrainingVideo, addTrainingVideoFolder, showToast, trainingVideoFolders, trainingVideos } = useAppState();
  const [folderForm, setFolderForm] = useState({ name: "", subject: "", description: "" });
  const [videoForm, setVideoForm] = useState({
    title: "",
    folderId: trainingVideoFolders[0]?.id ?? "",
    description: "",
    fileName: "",
    mimeType: "",
    size: 0,
    videoDataUrl: ""
  });

  useEffect(() => {
    if (!trainingVideoFolders.length) return;
    setVideoForm((current) => (
      trainingVideoFolders.some((folder) => folder.id === current.folderId)
        ? current
        : { ...current, folderId: trainingVideoFolders[0].id }
    ));
  }, [trainingVideoFolders]);

  const createFolder = (event: FormEvent) => {
    event.preventDefault();
    const savedFolder = addTrainingVideoFolder(folderForm);
    if (!savedFolder) {
      showToast("Enter a video folder name and subject.");
      return;
    }
    setFolderForm({ name: "", subject: "", description: "" });
    setVideoForm((current) => ({ ...current, folderId: savedFolder.id }));
    showToast(`${savedFolder.name} video folder created.`);
  };

  const handleVideoUpload = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const videoDataUrl = typeof reader.result === "string" ? reader.result : "";
      setVideoForm((current) => ({
        ...current,
        fileName: file.name,
        mimeType: file.type || "video/mp4",
        size: file.size,
        videoDataUrl
      }));
    };
    reader.readAsDataURL(file);
  };

  const publishVideo = (event: FormEvent) => {
    event.preventDefault();
    const savedVideo = addTrainingVideo(videoForm);
    if (!savedVideo) {
      showToast("Create a folder, add a title, and choose a video file before publishing.");
      return;
    }
    setVideoForm((current) => ({
      title: "",
      folderId: current.folderId,
      description: "",
      fileName: "",
      mimeType: "",
      size: 0,
      videoDataUrl: ""
    }));
    showToast(`${savedVideo.title} published to student videos.`);
  };

  return (
    <OperationsPage className="operations-page--workflow" title="Videos" text="Upload student training videos and organize them into subject folders.">
      <div className="operations-stats">
        <StatCard label="Folders" value={trainingVideoFolders.length} icon={<FolderPlus />} />
        <StatCard label="Videos" value={trainingVideos.length} icon={<Video />} />
      </div>
      <div className="operations-two-column videos-manager-layout">
        <section className="operations-panel videos-manager-panel" aria-label="Manager video upload tools">
          <div className="student-roster-head">
            <div>
              <h2>Upload Center</h2>
              <p>Create folders first, then publish videos into the selected student subject folder.</p>
            </div>
          </div>
          <form className="video-tool-form" aria-label="Create video folder" onSubmit={createFolder}>
            <h3>New Folder</h3>
            <label>
              Folder name
              <input value={folderForm.name} onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })} />
            </label>
            <label>
              Folder subject
              <input value={folderForm.subject} onChange={(event) => setFolderForm({ ...folderForm, subject: event.target.value })} />
            </label>
            <label>
              Folder description
              <textarea rows={2} value={folderForm.description} onChange={(event) => setFolderForm({ ...folderForm, description: event.target.value })} />
            </label>
            <button type="submit" className="operations-action student-header-add">
              <FolderPlus size={18} /> Create Folder
            </button>
          </form>
          <form className="video-tool-form" aria-label="Upload student video" onSubmit={publishVideo}>
            <h3>Publish Video</h3>
            <label>
              Video title
              <input value={videoForm.title} onChange={(event) => setVideoForm({ ...videoForm, title: event.target.value })} />
            </label>
            <label>
              Video folder
              <select value={videoForm.folderId} disabled={!trainingVideoFolders.length} onChange={(event) => setVideoForm({ ...videoForm, folderId: event.target.value })}>
                {trainingVideoFolders.length ? (
                  trainingVideoFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)
                ) : (
                  <option value="">Create a folder first</option>
                )}
              </select>
            </label>
            <label>
              Video description
              <textarea rows={3} value={videoForm.description} onChange={(event) => setVideoForm({ ...videoForm, description: event.target.value })} />
            </label>
            <label className="video-file-upload">
              Upload video file
              <input type="file" accept="video/*" aria-label="Upload video file" onChange={handleVideoUpload} />
            </label>
            <p className="video-upload-ready">{videoForm.fileName ? `${videoForm.fileName} ready to publish.` : "No video selected yet."}</p>
            <button type="submit" className="operations-action student-header-add">
              <Upload size={18} /> Publish Video
            </button>
          </form>
        </section>
        <VideoLibrarySection
          ariaLabel="Manager video library"
          emptyText="Create a folder and upload the first training video for students."
          folders={trainingVideoFolders}
          title="Student Video Library"
          videos={trainingVideos}
        />
      </div>
    </OperationsPage>
  );
}

function StudentVideosPage() {
  const { trainingVideoFolders, trainingVideos } = useAppState();

  return (
    <StudentPanelToolPage actionLabel="Video Practice" title="Videos" text="Watch training videos published by Cho's managers.">
      <VideoLibrarySection
        ariaLabel="Student video library"
        emptyText="No training videos have been published yet."
        folders={trainingVideoFolders}
        title="Videos"
        videos={trainingVideos}
      />
    </StudentPanelToolPage>
  );
}

function StudentLauncherWorkspace({ tool }: { tool: ManagerLauncherIconKind }) {
  switch (tool) {
    case "classes":
      return <StudentPanelClassesPage />;
    case "study":
      return <StudentStudyPage />;
    case "test":
      return <StudentTestPage />;
    case "videos":
      return <StudentVideosPage />;
    case "dashboard":
    default:
      return <StudentPanelDashboardPage />;
  }
}

type ManagerHomeThread = {
  id: string;
  kind: "message" | "event";
  sender: string;
  title: string;
  preview: string;
  sentDate: string;
  sentTime: string;
  sentDateTime: string;
  avatar: string;
  accent: string;
  unread?: boolean;
  source?: "direct";
  body?: string;
  audienceLabel?: string;
  replyRecipientId?: string;
  replyRecipientName?: string;
};

type ManagerHomeFeedFilter = "all" | ManagerHomeThread["kind"];

type ManagerComposeKind = ManagerHomeThread["kind"];
type ManagerComposeRecipientRole = "staff" | "student" | "parent";

type ManagerComposeRecipient = {
  id: string;
  name: string;
  role: ManagerComposeRecipientRole;
  subtitle: string;
  detail: string;
};

type ManagerComposeRecipientSummaryItem = {
  id: string;
  label: string;
  detail: string;
  variant: "category" | "person";
};

const managerComposeRecipientRoles: ManagerComposeRecipientRole[] = ["staff", "student", "parent"];

type ManagerHomeAgendaItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "scheduled" | "class" | "event";
  meta: string;
  priority: number;
};

const managerHomeThreads: ManagerHomeThread[] = [
  {
    id: "summer-championship",
    kind: "event",
    sender: "System Admin",
    title: "Event Update: Summer Championship",
    preview: "The schedule for the Summer Championship...",
    sentDate: "May 15, 2026",
    sentTime: "10:30 AM",
    sentDateTime: "2026-05-15T10:30:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#67d8ff",
    unread: true
  },
  {
    id: "practice-reminder",
    kind: "message",
    sender: "Head Coach",
    title: "Practice Session Reminder",
    preview: "Don't forget about tomorrow's training...",
    sentDate: "May 15, 2026",
    sentTime: "9:15 AM",
    sentDateTime: "2026-05-15T09:15:00-05:00",
    avatar: classesLauncherIcon,
    accent: "#7be4ff",
    unread: true
  },
  {
    id: "attendance",
    kind: "message",
    sender: "John Doe",
    title: "Attendance Confirmation",
    preview: "Please confirm your attendance for the...",
    sentDate: "May 15, 2026",
    sentTime: "8:45 AM",
    sentDateTime: "2026-05-15T08:45:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#8a78ff"
  },
  {
    id: "merch",
    kind: "message",
    sender: "Merch Store",
    title: "New Arrivals Just Dropped!",
    preview: "Check out the latest merchandise available...",
    sentDate: "May 14, 2026",
    sentTime: "4:20 PM",
    sentDateTime: "2026-05-14T16:20:00-05:00",
    avatar: merchandiseLauncherIcon,
    accent: "#7bdcff"
  },
  {
    id: "security",
    kind: "message",
    sender: "System Admin",
    title: "Account Security Update",
    preview: "We've updated our security policy to...",
    sentDate: "May 14, 2026",
    sentTime: "11:05 AM",
    sentDateTime: "2026-05-14T11:05:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#67d8ff"
  },
  {
    id: "event-team",
    kind: "event",
    sender: "Event Team",
    title: "Upcoming Event: Parent Meeting",
    preview: "We will be hosting a parent meeting next...",
    sentDate: "May 13, 2026",
    sentTime: "2:45 PM",
    sentDateTime: "2026-05-13T14:45:00-05:00",
    avatar: schedulingLauncherIcon,
    accent: "#ff7a1a"
  }
];

const studentHomeThreads: ManagerHomeThread[] = [
  {
    id: "student-testing-event",
    kind: "event",
    sender: "Event Team",
    title: "Upcoming Event: Color Belt Testing",
    preview: "Testing registration and arrival details are ready...",
    sentDate: "May 15, 2026",
    sentTime: "10:30 AM",
    sentDateTime: "2026-05-15T10:30:00-05:00",
    avatar: eventsLauncherIcon,
    accent: "#ff7a1a",
    unread: true
  },
  {
    id: "student-practice-reminder",
    kind: "message",
    sender: "Head Coach",
    title: "Practice Session Reminder",
    preview: "Bring your belt card and review your form before class...",
    sentDate: "May 15, 2026",
    sentTime: "9:15 AM",
    sentDateTime: "2026-05-15T09:15:00-05:00",
    avatar: classesLauncherIcon,
    accent: "#7be4ff",
    unread: true
  },
  {
    id: "student-attendance",
    kind: "message",
    sender: "Front Desk",
    title: "Attendance Confirmation",
    preview: "Your next class reservation is confirmed...",
    sentDate: "May 15, 2026",
    sentTime: "8:45 AM",
    sentDateTime: "2026-05-15T08:45:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#8a78ff"
  },
  {
    id: "student-merch",
    kind: "message",
    sender: "Merch Store",
    title: "New Student Gear Available",
    preview: "Uniforms, gloves, and training gear are ready for pickup...",
    sentDate: "May 14, 2026",
    sentTime: "4:20 PM",
    sentDateTime: "2026-05-14T16:20:00-05:00",
    avatar: merchandiseLauncherIcon,
    accent: "#7bdcff"
  },
  {
    id: "student-account",
    kind: "message",
    sender: "System Admin",
    title: "Account Security Update",
    preview: "Your student profile settings were reviewed...",
    sentDate: "May 14, 2026",
    sentTime: "11:05 AM",
    sentDateTime: "2026-05-14T11:05:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#67d8ff"
  },
  {
    id: "student-parent-meeting",
    kind: "event",
    sender: "Event Team",
    title: "Upcoming Event: Parent Meeting",
    preview: "Families are invited to review summer training details...",
    sentDate: "May 13, 2026",
    sentTime: "2:45 PM",
    sentDateTime: "2026-05-13T14:45:00-05:00",
    avatar: schedulingLauncherIcon,
    accent: "#ff7a1a"
  }
];

type ParentProfileTab = "dashboard" | "classes" | "study" | "test" | "messages" | "notifications";
type ParentTutorialStepId = "add-child" | "child-name" | "child-age" | "child-username" | "child-password" | "child-belt" | "save-child" | "created-child";
type ParentTutorialCompletion = "completed" | "skipped";
type ParentTutorialTargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
type ParentTutorialTargetPosition = {
  spotlight: ParentTutorialTargetRect;
  coach: ParentTutorialTargetRect;
  placement: "above" | "below" | "center";
};

const parentProfileTabs: { id: ParentProfileTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "classes", label: "Classes" },
  { id: "study", label: "Study" },
  { id: "test", label: "Test" },
  { id: "messages", label: "Messages" },
  { id: "notifications", label: "Notifications" }
];

const parentStudyItems = [
  { title: "Forms at home", detail: "Review the current form slowly, then let the child perform it once without coaching." },
  { title: "Class focus", detail: "Ask what the instructor corrected last class and write one practice goal before the next visit." },
  { title: "Confidence routine", detail: "Use a short bow-in, stance check, and breathing reset for young students before training." }
];

const parentTestingItems = [
  { title: "Class consistency", detail: "Watch attendance and missed classes before signing up for a belt test." },
  { title: "Instructor approval", detail: "Ask Cho's staff to confirm forms, kicks, attitude, and focus before the testing event." },
  { title: "Family logistics", detail: "Check arrival time, uniform, belt card, water, and event notifications before test day." }
];

const parentTutorialStepOrder: ParentTutorialStepId[] = ["add-child", "child-name", "child-age", "child-username", "child-password", "child-belt", "save-child", "created-child"];

const parentTutorialSteps: Record<ParentTutorialStepId, { title: string; detail: string; target: string }> = {
  "add-child": {
    title: "Tap Add Child",
    detail: "Start here. This opens the child profile window where you will create the first student account.",
    target: "add-child"
  },
  "child-name": {
    title: "Type your child's name",
    detail: "Enter the student's name. This is the name parents and staff will see on the child profile card.",
    target: "child-name"
  },
  "child-age": {
    title: "Add their age",
    detail: "Enter the child's age so their profile feels clear when you manage more than one student.",
    target: "child-age"
  },
  "child-username": {
    title: "Create their username",
    detail: "Choose the username your child will type on the login screen. Keep it simple and easy to remember.",
    target: "child-username"
  },
  "child-password": {
    title: "Create their password",
    detail: "Choose the password your child will use with that username when they log into the app.",
    target: "child-password"
  },
  "child-belt": {
    title: "Confirm the current belt",
    detail: "Open or focus the belt selector. White belt is already selected for brand-new students.",
    target: "child-belt"
  },
  "save-child": {
    title: "Save the profile",
    detail: "Click the real save button. The new child profile will be created and selected for you.",
    target: "save-child"
  },
  "created-child": {
    title: "First child profile created",
    detail: "This profile is ready. Open the student side now, or finish here and keep managing from the parent profile.",
    target: "created-child"
  }
};

function parentTutorialStorageKey(sessionEmail?: string) {
  const keyEmail = (sessionEmail ?? "parent")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.parentTutorial.${keyEmail || "parent"}.v1`;
}

function readParentTutorialCompletion(key: string) {
  if (typeof window === "undefined") return undefined;
  try {
    const saved = window.localStorage.getItem(key);
    return saved === "completed" || saved === "skipped" ? saved : undefined;
  } catch {
    return undefined;
  }
}

function writeParentTutorialCompletion(key: string, completion: ParentTutorialCompletion) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, completion);
  } catch {
    // The tutorial still works in-memory if localStorage is unavailable.
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isParentTutorialModalStep(stepId: ParentTutorialStepId | null) {
  return stepId === "child-name" || stepId === "child-age" || stepId === "child-username" || stepId === "child-password" || stepId === "child-belt" || stepId === "save-child";
}

function getNextParentTutorialStep(stepId: ParentTutorialStepId) {
  const currentIndex = parentTutorialStepOrder.indexOf(stepId);
  return parentTutorialStepOrder[currentIndex + 1] ?? stepId;
}

function childBeltLabel(beltSlug: string) {
  return resolveBeltRank(beltSlug).name;
}

function childInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "C") + (parts[1]?.[0] ?? "");
}

const managerComposeStaffRecipients: ManagerComposeRecipient[] = [
  {
    id: "direct-staff-instructors",
    name: "Instructor Team",
    role: "staff",
    subtitle: "Cho's staff",
    detail: "Class, testing, and floor support"
  }
];

const HOME_OVERVIEW_DRAG_THRESHOLD = 6;
const HOME_OVERVIEW_KEYBOARD_STEP = 0.12;
const HOME_OVERVIEW_STAGE_VISUAL_BUFFER = 6;

function clampHomeOverviewProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatMonthYear(value?: string) {
  if (!value) return "May 2026";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "May 2026";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatHomeScheduleDay(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function scheduleItemOccursOnDate(item: ScheduledClass, day: Date) {
  const dateKey = toDateKey(day);
  if (!item.recurring) return item.date === dateKey;
  const startDate = parseCalendarDate(item.date);
  return toDateKey(startDate) <= dateKey && startDate.getDay() === day.getDay();
}

function nextWeeklyScheduleOccurrenceDate(item: ScheduledClass, todayKey: string) {
  if (!item.recurring) return item.date;
  const startDate = parseCalendarDate(item.date);
  const todayDate = parseCalendarDate(todayKey);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(todayDate.getTime()) || item.date >= todayKey) return item.date;

  const daysSinceStart = Math.ceil((todayDate.getTime() - startDate.getTime()) / 86_400_000);
  const weeksSinceStart = Math.ceil(daysSinceStart / 7);
  const nextDate = new Date(startDate);
  nextDate.setDate(startDate.getDate() + weeksSinceStart * 7);
  return toDateKey(nextDate);
}

function oneTimeScheduleStatusLabel(item: ScheduledClass, todayKey: string) {
  if (item.recurring) return undefined;
  return item.date < todayKey ? "Past one-time item" : "Upcoming one-time item";
}

function hasRecurringStudioClass(day: Date, studioClasses: StudioClass[]) {
  return studioClasses.some((studioClass) => studioClass.recurring !== false && studioClass.daysOfWeek.includes(day.getDay() as ClassWeekday));
}

function hasExplicitHomeAgendaItem(day: Date, scheduledClasses: ScheduledClass[], studioEvents: StudioEvent[]) {
  const dateKey = toDateKey(day);
  return scheduledClasses.some((item) => scheduleItemOccursOnDate(item, day)) || studioEvents.some((event) => event.date === dateKey);
}

function findBestHomeAgendaDateInWeek(weekDays: Date[], scheduledClasses: ScheduledClass[], studioClasses: StudioClass[], studioEvents: StudioEvent[]) {
  const explicitDay = weekDays.find((day) => hasExplicitHomeAgendaItem(day, scheduledClasses, studioEvents));
  if (explicitDay) return toDateKey(explicitDay);
  const recurringDay = weekDays.find((day) => hasRecurringStudioClass(day, studioClasses));
  return toDateKey(recurringDay ?? weekDays[0]);
}

function findInitialHomeAgendaDate(today: Date, scheduledClasses: ScheduledClass[], studioClasses: StudioClass[], studioEvents: StudioEvent[]) {
  for (let offset = 0; offset < 70; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    if (hasExplicitHomeAgendaItem(day, scheduledClasses, studioEvents)) return toDateKey(day);
  }

  for (let offset = 0; offset < 70; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    if (hasRecurringStudioClass(day, studioClasses)) return toDateKey(day);
  }

  return toDateKey(today);
}

function agendaSortMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 9999;
  const hour = Number(match[1]);
  const minutes = Number(match[2]);
  const meridian = match[3]?.toUpperCase();
  const normalizedHour = meridian === "PM" && hour < 12 ? hour + 12 : meridian === "AM" && hour === 12 ? 0 : hour;
  return normalizedHour * 60 + minutes;
}

function compareHomeAgendaItems(a: ManagerHomeAgendaItem, b: ManagerHomeAgendaItem) {
  return a.date.localeCompare(b.date) || a.priority - b.priority || agendaSortMinutes(a.time) - agendaSortMinutes(b.time);
}

function studentToComposeRecipient(student: StudentRecord): ManagerComposeRecipient {
  return {
    id: student.id,
    name: fullName(student),
    role: "student",
    subtitle: `${student.beltRank} belt student`,
    detail: student.phone || student.email || "No student contact on file"
  };
}

function studentToParentComposeRecipient(student: StudentRecord): ManagerComposeRecipient {
  const studentName = fullName(student);
  const guardianName = student.guardianName?.trim() || `${studentName} Parent/Guardian`;

  return {
    id: `parent-${student.id}`,
    name: guardianName,
    role: "parent",
    subtitle: `Parent of ${studentName}`,
    detail: student.guardianPhone || student.guardianEmail || student.email || "No parent contact on file"
  };
}

function composeRecipientRoleLabel(role: ManagerComposeRecipientRole) {
  if (role === "staff") return "Staff";
  if (role === "parent") return "Parent";
  return "Student";
}

function composeRecipientGroupTitle(role: ManagerComposeRecipientRole) {
  if (role === "staff") return "Staff";
  if (role === "parent") return "Parents";
  return "Students";
}

function composeRecipientGroupDescription(role: ManagerComposeRecipientRole) {
  if (role === "staff") return "Studio team and instructors";
  if (role === "parent") return "Guardian and family contacts";
  return "Student member contacts";
}

function composeMessagePreview(body: string) {
  const cleanBody = body.replace(/\s+/g, " ").trim();
  if (cleanBody.length <= 78) return cleanBody;
  return `${cleanBody.slice(0, 75).trimEnd()}...`;
}

function formatManagerComposeTimestamp(date: Date) {
  return {
    sentDate: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    sentTime: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    sentDateTime: date.toISOString()
  };
}

function formatDirectMessageTimestamp(createdAt: string) {
  const date = new Date(createdAt);
  return formatManagerComposeTimestamp(Number.isNaN(date.getTime()) ? new Date() : date);
}

function isStaffDirectParticipant(participantId: string) {
  return participantId.trim().toLowerCase().startsWith("direct-staff-");
}

function directParticipantStudentId(participantId: string) {
  const id = participantId.trim();
  return id.startsWith("parent-") ? id.slice("parent-".length) : id;
}

function latestDirectMessagesByThread(directMessages: readonly DirectMessage[]) {
  const latestMessages = new Map<string, DirectMessage>();
  directMessages.forEach((message) => {
    const threadId = message.threadId.trim();
    if (message.status !== "sent" || !threadId || !message.createdAt.trim() || !message.body.trim()) return;
    const previous = latestMessages.get(threadId);
    if (!previous || message.createdAt.localeCompare(previous.createdAt) > 0 || (message.createdAt === previous.createdAt && message.id.localeCompare(previous.id) > 0)) {
      latestMessages.set(threadId, message);
    }
  });
  return [...latestMessages.values()];
}

function sortHomeFeedThreads(threads: ManagerHomeThread[]) {
  return [...threads].sort((left, right) => right.sentDateTime.localeCompare(left.sentDateTime) || left.title.localeCompare(right.title));
}

function buildManagerDirectMessageFeedThreads(
  directMessages: readonly DirectMessage[],
  students: readonly StudentRecord[],
  readThreadIds: ReadonlySet<string>,
  hiddenThreadIds: ReadonlySet<string>
) {
  const currentStudentsById = new Map(students.filter(isCurrentOperationsStudent).map((student) => [student.id, student]));
  return latestDirectMessagesByThread(directMessages)
    .flatMap((message): ManagerHomeThread[] => {
      if (hiddenThreadIds.has(message.threadId) || (!isStaffDirectParticipant(message.senderId) && !isStaffDirectParticipant(message.recipientId))) return [];
      const replyParticipantId = isStaffDirectParticipant(message.senderId) ? message.recipientId : message.senderId;
      if (isStaffDirectParticipant(replyParticipantId)) return [];
      const student = currentStudentsById.get(directParticipantStudentId(replyParticipantId));
      if (!student) return [];
      const timestamp = formatDirectMessageTimestamp(message.createdAt);
      const senderName = message.senderName.trim() || fullName(student);
      const replyRecipientName = (isStaffDirectParticipant(message.senderId) ? message.recipientName : message.senderName).trim() || fullName(student);
      return [{
        id: message.threadId,
        kind: "message",
        sender: senderName,
        title: `App message from ${senderName}`,
        preview: composeMessagePreview(message.body),
        body: message.body.trim(),
        sentDate: timestamp.sentDate,
        sentTime: timestamp.sentTime,
        sentDateTime: timestamp.sentDateTime,
        avatar: messagesLauncherIcon,
        accent: "#7be4ff",
        unread: isStaffDirectParticipant(message.recipientId) && !readThreadIds.has(message.threadId),
        source: "direct",
        audienceLabel: replyParticipantId.startsWith("parent-") ? `${fullName(student)} family app message` : `${fullName(student)} student app message`,
        replyRecipientId: replyParticipantId,
        replyRecipientName
      }];
    });
}

function buildStudentDirectMessageFeedThreads(
  directMessages: readonly DirectMessage[],
  selectedStudent: StudentRecord | undefined,
  readThreadIds: ReadonlySet<string>,
  hiddenThreadIds: ReadonlySet<string>
) {
  if (!selectedStudent || !isCurrentOperationsStudent(selectedStudent)) return [];
  return latestDirectMessagesByThread(directMessages)
    .flatMap((message): ManagerHomeThread[] => {
      if (hiddenThreadIds.has(message.threadId)) return [];
      const studentIsSender = message.senderId === selectedStudent.id;
      const studentIsRecipient = message.recipientId === selectedStudent.id;
      if (!studentIsSender && !studentIsRecipient) return [];
      const replyParticipantId = studentIsSender ? message.recipientId : message.senderId;
      if (!isStaffDirectParticipant(replyParticipantId)) return [];
      const timestamp = formatDirectMessageTimestamp(message.createdAt);
      const senderName = message.senderName.trim() || (studentIsSender ? fullName(selectedStudent) : "Cho's Manager");
      const replyRecipientName = (studentIsSender ? message.recipientName : message.senderName).trim() || "Cho's Manager";
      return [{
        id: message.threadId,
        kind: "message",
        sender: senderName,
        title: `App message from ${senderName}`,
        preview: composeMessagePreview(message.body),
        body: message.body.trim(),
        sentDate: timestamp.sentDate,
        sentTime: timestamp.sentTime,
        sentDateTime: timestamp.sentDateTime,
        avatar: messagesLauncherIcon,
        accent: "#7be4ff",
        unread: studentIsRecipient && !readThreadIds.has(message.threadId),
        source: "direct",
        audienceLabel: studentIsSender ? "message to Cho's staff" : "message for your student profile",
        replyRecipientId: replyParticipantId,
        replyRecipientName
      }];
    });
}

function buildParentDirectMessageFeedThreads(
  directMessages: readonly DirectMessage[],
  selectedChild: ChildAccount | undefined
) {
  if (!selectedChild) return [];
  const parentParticipantId = `parent-${selectedChild.id}`;
  return latestDirectMessagesByThread(directMessages)
    .flatMap((message): ManagerHomeThread[] => {
      const parentIsSender = message.senderId === parentParticipantId;
      const parentIsRecipient = message.recipientId === parentParticipantId;
      if (!parentIsSender && !parentIsRecipient) return [];
      const staffParticipantId = parentIsSender ? message.recipientId : message.senderId;
      if (!isStaffDirectParticipant(staffParticipantId)) return [];
      const timestamp = formatDirectMessageTimestamp(message.createdAt);
      const senderName = message.senderName.trim() || (parentIsSender ? `${selectedChild.name} Family` : "Cho's Manager");
      const replyRecipientName = (parentIsSender ? message.recipientName : message.senderName).trim() || "Cho's Manager";
      return [{
        id: message.threadId,
        kind: "message",
        sender: senderName,
        title: `App message from ${senderName}`,
        preview: composeMessagePreview(message.body),
        body: message.body.trim(),
        sentDate: timestamp.sentDate,
        sentTime: timestamp.sentTime,
        sentDateTime: timestamp.sentDateTime,
        avatar: messagesLauncherIcon,
        accent: "#7be4ff",
        unread: parentIsRecipient,
        source: "direct",
        audienceLabel: `${selectedChild.name} family app message`,
        replyRecipientId: staffParticipantId,
        replyRecipientName
      }];
    });
}

function buildHomeAgendaItems(weekDays: Date[], scheduledClasses: ScheduledClass[], studioClasses: StudioClass[], studioEvents: StudioEvent[]) {
  return weekDays
    .flatMap<ManagerHomeAgendaItem>((day) => {
      const dateKey = toDateKey(day);
      const scheduledItems = scheduledClasses
        .filter((item) => scheduleItemOccursOnDate(item, day))
        .map((item) => ({
          id: `scheduled-${item.id}-${dateKey}`,
          title: item.title,
          date: dateKey,
          time: item.time,
          kind: "scheduled" as const,
          meta: scheduleTypeLabel(item.type),
          priority: 1
        }));
      const eventItems = studioEvents
        .filter((event) => event.date === dateKey)
        .map((event) => ({
          id: `event-${event.id}-${dateKey}`,
          title: event.title,
          date: dateKey,
          time: event.time,
          kind: "event" as const,
          meta: event.audience,
          priority: 2
        }));
      const recurringClassItems = studioClasses
        .filter((studioClass) => studioClass.recurring !== false && studioClass.daysOfWeek.includes(day.getDay() as ClassWeekday))
        .map((studioClass) => ({
          id: `class-${studioClass.id}-${dateKey}`,
          title: studioClass.name,
          date: dateKey,
          time: formatClockTime(studioClass.startTime),
          kind: "class" as const,
          meta: "Recurring class",
          priority: 3
        }));

      return [...scheduledItems, ...eventItems, ...recurringClassItems];
    })
    .sort(compareHomeAgendaItems);
}

function ProfileTitleRule({ variant }: { variant: "top" | "bottom" }) {
  return (
    <svg className={`manager-home-title-rule-art manager-home-title-rule-art--${variant}`} viewBox="0 0 360 54" aria-hidden="true" focusable="false">
      <path className="manager-home-title-rule-main" d="M2 27 H154" />
      <path className="manager-home-title-rule-main" d="M206 27 H358" />
      <path className="manager-home-title-rule-flourish" d="M154 27 C164 27 170 21 176 21 C179 21 180 25 180 27 C180 25 181 21 184 21 C190 21 196 27 206 27" />
      <path className="manager-home-title-rule-flourish" d="M164 30 C171 34 176 33 180 27 C184 33 189 34 196 30" />
      <path className="manager-home-title-rule-accent" d="M180 16 L188 27 L180 38 L172 27 Z" />
      <circle className="manager-home-title-rule-dot" cx="145" cy="27" r="1.45" />
      <circle className="manager-home-title-rule-dot" cx="215" cy="27" r="1.45" />
      <circle className="manager-home-title-rule-dot" cx="180" cy="27" r="1.2" />
    </svg>
  );
}

function ManagerPageTitleFrame({ title, className = "" }: { title: string; className?: string }) {
  const classNames = ["manager-page-title-frame", className].filter(Boolean).join(" ");

  return (
    <div className={classNames}>
      <span className="manager-home-title-rule manager-home-title-rule--top" aria-hidden="true">
        <ProfileTitleRule variant="top" />
      </span>
      <h1>{title}</h1>
      <span className="manager-home-title-rule manager-home-title-rule--bottom" aria-hidden="true">
        <ProfileTitleRule variant="bottom" />
      </span>
    </div>
  );
}

type StudentProfileBottomPanel = "belt" | "messages";
type BeltCaseEditorFrame = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function BeltCaseJourneyRail({
  earnedBeltSlugs,
  railBeltRanks,
  selectedBeltRank
}: {
  earnedBeltSlugs: ReadonlySet<string>;
  railBeltRanks: BeltRank[];
  selectedBeltRank: BeltRank;
}) {
  const railStyle = {
    "--student-belt-case-rail-count": Math.max(railBeltRanks.length - 1, 1)
  } as CSSProperties;

  return (
    <div className="student-belt-case-rank-rail" data-testid="belt-journey-rank-rail" style={railStyle} aria-hidden="true">
      <img className="student-belt-case-rail-base" data-testid="belt-journey-rail" src={beltCaseAsset("sprites/belt-rail.png")} alt="" draggable="false" />
      <div className="student-belt-case-rail-belts">
        {railBeltRanks.map((rank, index) => {
          const isEarned = earnedBeltSlugs.has(rank.slug);
          const isSelected = selectedBeltRank.slug === rank.slug;
          const railBeltStyle = {
            "--student-belt-case-rail-index": index
          } as CSSProperties;
          return (
            <img
              key={rank.slug}
              className={`student-belt-case-rail-belt is-${rank.slug}${isEarned ? " is-earned" : " is-locked"}${isSelected ? " is-selected" : ""}`}
              data-testid={`belt-journey-hanging-belt-${rank.slug}`}
              data-earned={isEarned ? "true" : "false"}
              data-selected={isSelected ? "true" : "false"}
              style={railBeltStyle}
              src={beltCaseRailBeltAsset(rank.slug)}
              alt=""
              draggable="false"
            />
          );
        })}
      </div>
    </div>
  );
}

function BeltCaseAchievementPedestal({
  plaqueText,
  selectedBeltRank,
  trophyBeltSrc
}: {
  plaqueText: string;
  selectedBeltRank: BeltRank;
  trophyBeltSrc: string;
}) {
  return (
    <div className={`student-belt-case-pedestal is-${selectedBeltRank.slug}`} data-testid="belt-case-achievement-pedestal" data-rank={selectedBeltRank.slug}>
      <img
        className="student-belt-case-pedestal-shelf"
        data-testid="belt-journey-current-plaque"
        src={beltCaseAsset("overlays/current-rank-plaque.png")}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      {selectedBeltRank.slug === "white" && (
        <img
          className="student-belt-case-current-belt-shadow"
          src={trophyBeltSrc}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      )}
      <img
        className="student-belt-case-current-belt student-belt-trophy-belt"
        data-testid="belt-journey-current-belt"
        src={trophyBeltSrc}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <div className="student-belt-case-plaque" data-testid="belt-case-plaque">
        <span>{plaqueText}</span>
        <small>Most Recent Achievement</small>
      </div>
    </div>
  );
}

function BeltCaseGlassAndFrame({
  selectedStickers,
  trophyFrameSrc
}: {
  selectedStickers: BeltCaseSticker[];
  trophyFrameSrc: string;
}) {
  return (
    <>
      <img
        className="student-belt-case-layer student-belt-case-layer--frame"
        data-testid="belt-journey-frame-overlay"
        src={trophyFrameSrc}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      {selectedStickers.map((sticker) => (
        <img
          key={sticker.id}
          className={`student-belt-case-sticker is-${sticker.placement}`}
          data-testid="belt-journey-sticker"
          src={beltCaseAsset(sticker.file)}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      ))}
      <span className="student-belt-case-glass-sheen" aria-hidden="true" />
    </>
  );
}

function StudentBeltCasePreview({ beltRank, classesAttended, settings }: { beltRank: BeltRank; classesAttended: number; settings: BeltCaseSettings }) {
  const { earnedBeltRanks, selectedBackground, selectedBeltRank, selectedEffect, selectedFrame, selectedLighting, selectedStickers } = resolveBeltCaseSelection(settings, beltRank);
  const beltDisplayName = `${selectedBeltRank.name} Belt`;
  const earnedBeltCountLabel = `${earnedBeltRanks.length} earned ${earnedBeltRanks.length === 1 ? "belt" : "belts"}`;
  const earnedBeltSlugs = new Set(earnedBeltRanks.map((earnedBeltRank) => earnedBeltRank.slug));
  const isRailVisible = settings.displayModeId !== "spotlight";
  const railBeltRanks = settings.displayModeId === "earned" ? beltRanks.filter((rank) => earnedBeltSlugs.has(rank.slug)) : beltRanks;
  const journeyStats = getBeltJourneyStats(beltRank, classesAttended);
  const trophyBackgroundSrc = beltCaseAsset(selectedBackground.file);
  const trophyFrameSrc = beltCaseAsset(selectedFrame.file);
  const trophyBeltSrc = beltCaseTrophyBeltAsset(selectedBeltRank.slug);
  const previewClassName = `student-belt-case-art ${selectedLighting.className} is-display-${settings.displayModeId} is-rank-${selectedBeltRank.slug}`;
  const previewStyle = {
    "--student-belt-case-rank-color": selectedBeltRank.color,
    "--student-belt-case-rank-text": selectedBeltRank.textColor
  } as CSSProperties;

  return (
    <section className="student-belt-case-panel" aria-label="Student belt case">
      <header className="student-belt-case-journey-head">
        <div>
          <Sparkles size={16} aria-hidden="true" />
          <h2>My Belt Journey</h2>
          <Sparkles size={16} aria-hidden="true" />
        </div>
        <p>Next: {journeyStats.nextBeltName}</p>
        <div
          className="student-belt-case-progress"
          role="progressbar"
          aria-label={`Belt journey progress to ${journeyStats.nextBeltName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={journeyStats.progressPercent}
          style={{ "--student-belt-case-progress": `${journeyStats.progressPercent}%` } as CSSProperties}
        >
          <span aria-hidden="true" />
          <small>{journeyStats.progressLabel}</small>
        </div>
      </header>
      <div className="student-belt-case-preview student-belt-case-preview--display">
        <div className={previewClassName} data-testid="belt-case-showcase-stage" style={previewStyle} role="img" aria-label={`${beltDisplayName} custom display case with ${earnedBeltCountLabel}`}>
          <img
            className="student-belt-case-layer student-belt-case-layer--background student-belt-trophy-background"
            data-testid="belt-journey-cabinet-base"
            src={trophyBackgroundSrc}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <img
            className="student-belt-case-layer student-belt-case-layer--title-arch"
            data-testid="belt-journey-title-arch"
            src={beltCaseAsset("overlays/title-arch.png")}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <span className="student-belt-case-title-layer" aria-hidden="true">My Belt Journey</span>
          <img
            className="student-belt-case-dragon-medallion"
            data-testid="belt-journey-dragon-medallion"
            src={beltCaseAsset("sprites/dragon-medallion.png")}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <span className="student-belt-case-vignette" aria-hidden="true" />
          {"file" in selectedEffect && selectedEffect.file && (
            <img
              className="student-belt-case-layer student-belt-case-layer--effect"
              data-testid="belt-journey-effect-overlay"
              src={beltCaseAsset(selectedEffect.file)}
              alt=""
              aria-hidden="true"
              draggable="false"
            />
          )}
          {isRailVisible && (
            <BeltCaseJourneyRail earnedBeltSlugs={earnedBeltSlugs} railBeltRanks={railBeltRanks} selectedBeltRank={selectedBeltRank} />
          )}
          <BeltCaseAchievementPedestal plaqueText={settings.plaqueText} selectedBeltRank={selectedBeltRank} trophyBeltSrc={trophyBeltSrc} />
          <BeltCaseGlassAndFrame selectedStickers={selectedStickers} trophyFrameSrc={trophyFrameSrc} />
        </div>
        <div className="student-belt-case-preview-meta">
          <span className="student-belt-case-rank-pill">{beltDisplayName}</span>
          <p>{selectedBeltRank.focus}</p>
        </div>
      </div>
      <section className="student-belt-case-current-rank-card" aria-label="Current student rank">
        <img src={trophyBeltSrc} alt="" aria-hidden="true" draggable="false" />
        <div>
          <span>Current Rank</span>
          <strong>{beltDisplayName}</strong>
          <p>{journeyStats.encouragement}</p>
        </div>
        <Sparkles size={30} aria-hidden="true" />
      </section>
      <dl className="student-belt-case-stat-grid" aria-label="Belt journey stats">
        <div>
          <img className="student-belt-case-stat-bg" src={beltCaseAsset("overlays/stat-chip.png")} alt="" aria-hidden="true" draggable="false" />
          <dt><Users size={22} aria-hidden="true" /> <strong>{journeyStats.classesAttended}</strong></dt>
          <dd>Classes Attended</dd>
        </div>
        <div>
          <img className="student-belt-case-stat-bg" src={beltCaseAsset("overlays/stat-chip.png")} alt="" aria-hidden="true" draggable="false" />
          <dt><Sparkles size={22} aria-hidden="true" /> <strong>{journeyStats.skillsLearned}</strong></dt>
          <dd>Skills Learned</dd>
        </div>
        <div>
          <img className="student-belt-case-stat-bg" src={beltCaseAsset("overlays/stat-chip.png")} alt="" aria-hidden="true" draggable="false" />
          <dt><Award size={22} aria-hidden="true" /> <strong>{journeyStats.achievementsEarned}</strong></dt>
          <dd>Achievements Earned</dd>
        </div>
        <div>
          <img className="student-belt-case-stat-bg" src={beltCaseAsset("overlays/stat-chip.png")} alt="" aria-hidden="true" draggable="false" />
          <dt><ShieldCheck size={22} aria-hidden="true" /> <strong>Great Job!</strong></dt>
          <dd>Keep it up!</dd>
        </div>
      </dl>
    </section>
  );
}

function StudentBeltCaseControls({
  beltRank,
  onChange,
  onReset,
  onSave,
  onToggleSticker,
  saveStatus,
  settings
}: {
  beltRank: BeltRank;
  onChange: (patch: Partial<BeltCaseSettings>) => void;
  onReset: () => void;
  onSave: () => void;
  onToggleSticker: (stickerId: BeltCaseStickerId) => void;
  saveStatus: string;
  settings: BeltCaseSettings;
}) {
  const { earnedBeltRanks, selectedBackground, selectedBeltRank, selectedEffect, selectedFrame, selectedLighting, selectedStickers } = resolveBeltCaseSelection(settings, beltRank);
  const earnedBeltSlugs = new Set(earnedBeltRanks.map((earnedBeltRank) => earnedBeltRank.slug));
  const selectedStickerLabel = selectedStickers.length > 0 ? `${selectedStickers.length}/4 stickers equipped` : "No stickers equipped";

  return (
    <div className="student-belt-case-controls student-belt-case-controls--top" aria-label="Belt case creator controls">
      <section className="student-belt-case-loadout" aria-label="Belt case creator loadout">
        <div className="student-belt-case-loadout-preview">
          <span
            className="student-belt-case-loadout-scene"
            style={{ backgroundImage: `url(${beltCaseAsset(selectedBackground.file)})` }}
            aria-hidden="true"
          />
          <div>
            <small>Current Loadout</small>
            <strong>{selectedBackground.label}</strong>
            <span>{selectedFrame.label} case</span>
          </div>
        </div>
        <div className="student-belt-case-loadout-tags" aria-label="Creator option totals">
          <span>{beltCaseBackgrounds.length} scenes</span>
          <span>{beltCaseFrames.length} case frames</span>
          <span>{beltCaseStickers.length} stickers</span>
          <span>{beltRanks.length} belt ranks</span>
        </div>
        <div className="student-belt-case-loadout-readout" aria-label="Current creator selections">
          <span>{selectedLighting.label} lighting</span>
          <span>{selectedEffect.label}</span>
          <span>{selectedBeltRank.name} Belt</span>
          <span>{selectedStickerLabel}</span>
        </div>
      </section>
      <div className="student-belt-case-control-group student-belt-case-control-group--scene">
        <div className="student-belt-case-control-head">
          <Palette size={15} aria-hidden="true" />
          <span>Scene</span>
        </div>
        <div className="student-belt-case-swatch-grid">
          {beltCaseBackgrounds.map((background) => (
            <button
              key={background.id}
              type="button"
              className={`student-belt-case-swatch${settings.backgroundId === background.id ? " is-selected" : ""}`}
              aria-pressed={settings.backgroundId === background.id}
              onClick={() => onChange({ backgroundId: background.id })}
            >
              <span className="student-belt-case-swatch-thumb" style={{ backgroundImage: `url(${beltCaseAsset(background.file)})` }} aria-hidden="true" />
              <span>{background.label}</span>
              <small>{background.tone}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="student-belt-case-control-group student-belt-case-control-group--case">
        <div className="student-belt-case-control-head">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>Case</span>
        </div>
        <div className="student-belt-case-chip-row">
          {beltCaseFrames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              className={`student-belt-case-chip${settings.caseId === frame.id ? " is-selected" : ""}`}
              aria-pressed={settings.caseId === frame.id}
              onClick={() => onChange({ caseId: frame.id })}
            >
              <span className="student-belt-case-chip-thumb" style={{ backgroundImage: `url(${beltCaseAsset(frame.file)})` }} aria-hidden="true" />
              <span>{frame.label}</span>
            </button>
          ))}
        </div>
        <div className="student-belt-case-chip-row">
          {beltCaseLightingOptions.map((lighting) => (
            <button
              key={lighting.id}
              type="button"
              className={`student-belt-case-chip${settings.lightingId === lighting.id ? " is-selected" : ""}`}
              aria-pressed={settings.lightingId === lighting.id}
              onClick={() => onChange({ lightingId: lighting.id })}
            >
              {lighting.label}
            </button>
          ))}
        </div>
      </div>
      <div className="student-belt-case-control-group student-belt-case-control-group--display">
        <div className="student-belt-case-control-head">
          <Sparkles size={15} aria-hidden="true" />
          <span>Display</span>
        </div>
        <div className="student-belt-case-chip-row">
          {beltCaseDisplayModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`student-belt-case-chip${settings.displayModeId === mode.id ? " is-selected" : ""}`}
              aria-pressed={settings.displayModeId === mode.id}
              onClick={() => onChange({ displayModeId: mode.id })}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      <div className="student-belt-case-control-group student-belt-case-control-group--belt">
        <div className="student-belt-case-control-head">
          <Award size={15} aria-hidden="true" />
          <span>Belt</span>
        </div>
        <div className="student-belt-case-belt-grid">
          {beltRanks.map((rank) => {
            const isEarned = earnedBeltSlugs.has(rank.slug);
            const isSelected = selectedBeltRank.slug === rank.slug;
            const rankStyle = {
              "--student-belt-case-belt-color": rank.color,
              "--student-belt-case-belt-text": rank.textColor
            } as CSSProperties;
            return (
              <button
                key={rank.slug}
                type="button"
                className={`student-belt-case-belt-button${isSelected ? " is-selected" : ""}${isEarned ? "" : " is-locked"}`}
                style={rankStyle}
                disabled={!isEarned}
                aria-label={`${isEarned ? "Preview" : "Locked"} ${rank.name} Belt`}
                aria-pressed={isEarned ? isSelected : undefined}
                onClick={() => onChange({ selectedBeltSlug: rank.slug })}
              >
                <span aria-hidden="true" />
                <strong>{rank.name}</strong>
              </button>
            );
          })}
        </div>
      </div>
      <div className="student-belt-case-control-group student-belt-case-control-group--details">
        <div className="student-belt-case-control-head">
          <Target size={15} aria-hidden="true" />
          <span>Details</span>
        </div>
        <label className="student-belt-case-field">
          <span>Plaque</span>
          <input
            aria-label="Customize belt case plaque text"
            maxLength={38}
            value={settings.plaqueText}
            onChange={(event) => onChange({ plaqueText: event.target.value })}
          />
        </label>
        <div className="student-belt-case-sticker-row" aria-label="Sticker badges">
          {beltCaseStickers.map((sticker) => {
            const isSelected = settings.stickerIds.includes(sticker.id);
            return (
              <button
                key={sticker.id}
                type="button"
                className={`student-belt-case-sticker-button${isSelected ? " is-selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => onToggleSticker(sticker.id)}
              >
                <img src={beltCaseAsset(sticker.file)} alt="" aria-hidden="true" draggable="false" />
                <span>{sticker.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="student-belt-case-control-group student-belt-case-control-group--effects">
        <div className="student-belt-case-control-head">
          <Sparkles size={15} aria-hidden="true" />
          <span>Effects</span>
        </div>
        <div className="student-belt-case-chip-row">
          {beltCaseEffects.map((effect) => (
            <button
              key={effect.id}
              type="button"
              className={`student-belt-case-chip${settings.effectId === effect.id ? " is-selected" : ""}`}
              aria-pressed={settings.effectId === effect.id}
              onClick={() => onChange({ effectId: effect.id })}
            >
              {"file" in effect && effect.file ? (
                <span className="student-belt-case-chip-thumb" style={{ backgroundImage: `url(${beltCaseAsset(effect.file)})` }} aria-hidden="true" />
              ) : (
                <span className="student-belt-case-chip-empty" aria-hidden="true" />
              )}
              <span>{effect.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="student-belt-case-actions">
        <button type="button" className="student-belt-case-secondary-action" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="student-belt-case-primary-action" onClick={onSave}>
          Save
        </button>
        <span role="status" aria-live="polite">
          {saveStatus}
        </span>
      </div>
    </div>
  );
}

function StudentBeltCaseEditor({
  beltRank,
  onChange,
  onClose,
  onReset,
  onSave,
  onToggleSticker,
  saveStatus,
  settings,
  style
}: {
  beltRank: BeltRank;
  onChange: (patch: Partial<BeltCaseSettings>) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
  onToggleSticker: (stickerId: BeltCaseStickerId) => void;
  saveStatus: string;
  settings: BeltCaseSettings;
  style?: CSSProperties;
}) {
  return (
    <section className="student-belt-case-editor" id="student-belt-case-editor" data-testid="belt-case-editor-drawer" aria-label="Belt case customize panel" style={style}>
      <header className="student-belt-case-editor-head">
        <div>
          <span>Belt Case</span>
          <h2>Customize Display</h2>
        </div>
        <button className="student-belt-case-editor-close" type="button" aria-label="Close belt case editor" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <StudentBeltCaseControls
        beltRank={beltRank}
        onChange={onChange}
        onReset={onReset}
        onSave={onSave}
        onToggleSticker={onToggleSticker}
        saveStatus={saveStatus}
        settings={settings}
      />
    </section>
  );
}

function StudentReferenceBeltJourney({ beltRank, classesAttended }: { beltRank: BeltRank; classesAttended: number }) {
  const journeyStats = getBeltJourneyStats(beltRank, classesAttended);
  const earnedBeltIndex = beltRanks.findIndex((rank) => rank.slug === beltRank.slug);
  const earnedBeltCount = Math.max(earnedBeltIndex + 1, 1);
  const earnedBeltCountLabel = `${earnedBeltCount} earned ${earnedBeltCount === 1 ? "belt" : "belts"}`;
  const currentRankLabel = `${beltRank.name} Belt`;
  const compactProgressLabel = journeyStats.progressLabel.replace(/ classes to .+$/, " classes left");
  const journeyStyle = {
    "--student-reference-rank-color": beltRank.color,
    "--student-reference-rank-text": beltRank.textColor
  } as CSSProperties;

  return (
    <section className="student-reference-journey" aria-label="Student reference belt journey" style={journeyStyle}>
      <h2 className="student-reference-journey-heading">My Belt Journey</h2>
      <div className="student-reference-journey-frame" role="img" aria-label={`${currentRankLabel} trophy belt case with ${earnedBeltCountLabel}`}>
        <img
          className="student-reference-journey-stage"
          data-testid="student-reference-belt-stage"
          src={publicAsset("assets/student-profile-reference/belt-case-stage.png")}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <div className="student-reference-journey-title" aria-hidden="true">
          <Sparkles size={18} />
          <span>My Belt Journey</span>
          <Sparkles size={18} />
        </div>
        <div className="student-reference-belt-rail" aria-hidden="true">
          {beltRanks.map((rank, index) => {
            const isEarned = index <= earnedBeltIndex;
            return (
              <span
                key={rank.slug}
                className={`student-reference-belt-marker is-${rank.slug}${isEarned ? " is-earned" : " is-locked"}`}
                data-testid={`student-reference-belt-${rank.slug}`}
                data-earned={isEarned ? "true" : "false"}
                style={{ "--student-reference-belt-color": rank.color } as CSSProperties}
              />
            );
          })}
        </div>
      </div>
      <div className="student-reference-journey-progress">
        <p>{journeyStats.nextBeltName === "Black Belt" ? "Black belt focus" : `Next: ${journeyStats.nextBeltName}`}</p>
        <div
          className="student-reference-progress"
          role="progressbar"
          aria-label={`Belt journey progress to ${journeyStats.nextBeltName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={journeyStats.progressPercent}
          style={{ "--student-reference-progress": `${journeyStats.progressPercent}%` } as CSSProperties}
        >
          <span aria-hidden="true" />
          <small>{compactProgressLabel}</small>
        </div>
      </div>
    </section>
  );
}

function HomeProfilePushSubscriptionControls({
  accountLabel,
  isPushSubscribing,
  isPushSubscriptionSyncing,
  onConnectDevicePush,
  onPushServerEndpointChange,
  onSyncPushSubscription,
  onWebPushPublicKeyChange,
  pushServerEndpoint,
  pushSubscriptionReady,
  webPushPublicKey
}: {
  accountLabel: "Student" | "Parent";
  isPushSubscribing: boolean;
  isPushSubscriptionSyncing: boolean;
  onConnectDevicePush: () => void;
  onPushServerEndpointChange: (value: string) => void;
  onSyncPushSubscription: () => void;
  onWebPushPublicKeyChange: (value: string) => void;
  pushServerEndpoint: string;
  pushSubscriptionReady: boolean;
  webPushPublicKey: string;
}) {
  return (
    <div className="student-device-push-setup" aria-label={`${accountLabel} push subscription setup`}>
      <label>
        {accountLabel} Web Push public key
        <input
          value={webPushPublicKey}
          onChange={(event) => onWebPushPublicKeyChange(event.target.value)}
          placeholder="Public VAPID key"
        />
      </label>
      <label>
        {accountLabel} private push server URL
        <input
          type="url"
          value={pushServerEndpoint}
          onChange={(event) => onPushServerEndpointChange(event.target.value)}
          placeholder="https://push.example.com/api/push/subscriptions"
        />
      </label>
      <div className="student-device-push-actions">
        <button type="button" className="student-device-alert-button" onClick={onConnectDevicePush} disabled={!webPushPublicKey.trim() || isPushSubscribing}>
          <Bell size={16} aria-hidden="true" /> {isPushSubscribing ? `Connecting ${accountLabel} Device...` : `Connect ${accountLabel} Device`}
        </button>
        <button type="button" className="student-device-alert-button" onClick={onSyncPushSubscription} disabled={!pushSubscriptionReady || !pushServerEndpoint.trim() || isPushSubscriptionSyncing}>
          <Server size={16} aria-hidden="true" /> {isPushSubscriptionSyncing ? `Syncing ${accountLabel} Push Subscription...` : `Sync ${accountLabel} Push Subscription`}
        </button>
        <span className="student-device-alert-status">Push: {pushSubscriptionReady ? "ready" : "not connected"}</span>
      </div>
    </div>
  );
}

function StudentProfilePage() {
  const { currentChildAccount, directMessages, logout, scheduledClasses, sendDirectMessage, session, showToast, studioClasses, studioEvents, students } = useAppState();
  const today = useLiveCalendarDate();
  const selectedStudent = useMemo(() => {
    const sessionEmail = session?.email.toLowerCase();
    const sessionStudent = sessionEmail ? students.find((student) => student.email.toLowerCase() === sessionEmail) : undefined;
    if (sessionStudent) return sessionStudent;
    if (currentChildAccount) return undefined;
    return students.find((student) => (student.status ?? "Active").toLowerCase() === "active") ?? students[0];
  }, [currentChildAccount, session?.email, students]);
  const [studentProfile, setStudentProfile] = useState(() => readStudentProfile(session?.email, selectedStudent, currentChildAccount));
  const [studentProfileOpen, setStudentProfileOpen] = useState(false);
  const [homeScheduleWeekStartKey, setHomeScheduleWeekStartKey] = useState(() => toDateKey(weekDaysForDate(today)[0]));
  const [selectedHomeScheduleDateKey, setSelectedHomeScheduleDateKey] = useState(() => toDateKey(today));
  const [manualFeedThreads, setManualFeedThreads] = useState(() => studentHomeThreads);
  const [readDirectThreadIds, setReadDirectThreadIds] = useState<Set<string>>(() => new Set());
  const [hiddenDirectThreadIds] = useState<Set<string>>(() => new Set());
  const [studentMessageNotificationSettings, setStudentMessageNotificationSettings] = useState(() => readHomeMessageNotificationSettings(session?.email));
  const [studentNotificationPermission, setStudentNotificationPermission] = useState(() => getBrowserNotificationPermission());
  const [studentWebPushPublicKey, setStudentWebPushPublicKey] = useState(() => studentMessageNotificationSettings.pushPublicKey ?? "");
  const [studentPushServerEndpoint, setStudentPushServerEndpoint] = useState(() => readPushServerEndpoint());
  const [isStudentPushSubscribing, setIsStudentPushSubscribing] = useState(false);
  const [isStudentPushSubscriptionSyncing, setIsStudentPushSubscriptionSyncing] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFeedSearchOpen, setIsFeedSearchOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<ManagerHomeFeedFilter>("all");
  const [replyText, setReplyText] = useState("");
  const [studentBottomPanel, setStudentBottomPanel] = useState<StudentProfileBottomPanel>("belt");
  const feedSearchInputRef = useRef<HTMLInputElement>(null);
  const directFeedThreads = useMemo(
    () => buildStudentDirectMessageFeedThreads(directMessages, selectedStudent, readDirectThreadIds, hiddenDirectThreadIds),
    [directMessages, hiddenDirectThreadIds, readDirectThreadIds, selectedStudent]
  );
  const feedThreads = useMemo(
    () => sortHomeFeedThreads([...directFeedThreads, ...manualFeedThreads]),
    [directFeedThreads, manualFeedThreads]
  );
  const latestUnreadStudentDirectThread = useMemo(
    () => sortHomeFeedThreads(directFeedThreads).find((thread) => thread.source === "direct" && thread.unread),
    [directFeedThreads]
  );
  const messageCount = feedThreads.filter((thread) => thread.kind === "message").length;
  const eventCount = feedThreads.filter((thread) => thread.kind === "event").length;
  const studentNotificationPermissionLabel = studentNotificationPermission === "unsupported" ? "Unavailable" : studentNotificationPermission;
  const studentDeviceNotificationsReady = studentMessageNotificationSettings.browserNotificationsEnabled && studentNotificationPermission === "granted";
  const studentPushSubscriptionReady = Boolean(studentMessageNotificationSettings.pushSubscriptionEndpoint?.trim());
  const visibleThreads = feedThreads.filter((thread) => {
    if (feedFilter !== "all" && thread.kind !== feedFilter) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${thread.kind} ${thread.sender} ${thread.title} ${thread.preview}`.toLowerCase().includes(query);
  });
  const visibleFeedSections = visibleThreads.reduce<{ date: string; threads: ManagerHomeThread[] }[]>((sections, thread) => {
    const currentSection = sections[sections.length - 1];
    if (currentSection?.date === thread.sentDate) {
      currentSection.threads.push(thread);
      return sections;
    }
    sections.push({ date: thread.sentDate, threads: [thread] });
    return sections;
  }, []);
  const homeScheduleWeekDays = useMemo(() => weekDaysForDate(parseCalendarDate(homeScheduleWeekStartKey)), [homeScheduleWeekStartKey]);
  const homeAgendaItems = useMemo(
    () => buildHomeAgendaItems(homeScheduleWeekDays, scheduledClasses, studioClasses, studioEvents),
    [homeScheduleWeekDays, scheduledClasses, studioClasses, studioEvents]
  );
  const homeAgendaItemsByDate = useMemo(
    () => homeAgendaItems.reduce<Record<string, ManagerHomeAgendaItem[]>>((groups, item) => {
      groups[item.date] = [...(groups[item.date] ?? []), item];
      return groups;
    }, {}),
    [homeAgendaItems]
  );
  const selectedHomeScheduleDate = parseCalendarDate(selectedHomeScheduleDateKey);
  const selectedHomeAgendaItems = homeAgendaItemsByDate[selectedHomeScheduleDateKey] ?? [];
  const studentName = studentProfile.name || (selectedStudent ? fullName(selectedStudent) : currentChildAccount?.name.trim() || "Cho's Student");
  const studentBeltRank = resolveBeltRank(currentChildAccount?.beltSlug ?? selectedStudent?.beltRank ?? "White");
  const studentBeltLabel = studentBeltRank.name;
  const studentRoleLabel = currentChildAccount ? `${studentBeltLabel} Belt Student` : `${selectedStudent?.program ?? "Cho's Martial Arts"} Student`;
  const memberSinceLabel = formatMonthYear(currentChildAccount?.createdAt ?? selectedStudent?.joinedAt ?? session?.createdAt);
  const studentClassCount = selectedStudent?.classesAttended ?? 0;
  const studentPortrait = studentProfile.photoDataUrl ?? (selectedStudent?.profileImagePath ? publicAsset(selectedStudent.profileImagePath) : publicAsset("assets/CheetahProfilePic/Cheetah.png"));
  const studentColorPreview: ProfileColorPreviewData = {
    kind: "student",
    title: "Student Profile",
    displayName: studentName,
    roleLabel: studentRoleLabel,
    portraitSrc: studentPortrait,
    avatarText: childInitials(studentName),
    facts: [
      { icon: <Award size={18} />, label: `Rank: ${studentBeltLabel} Belt` },
      { icon: <Target size={18} />, label: `Member Since: ${memberSinceLabel}` },
      { icon: <Users size={18} />, label: `Classes: ${studentClassCount} Attended` }
    ],
    counts: [
      { label: messageCount === 1 ? "Message" : "Messages", value: messageCount, tone: "message" },
      { label: eventCount === 1 ? "Event" : "Events", value: eventCount, tone: "event" }
    ]
  };

  useEffect(() => {
    setStudentProfile(readStudentProfile(session?.email, selectedStudent, currentChildAccount));
  }, [currentChildAccount, selectedStudent, session?.email]);

  useEffect(() => {
    setStudentMessageNotificationSettings(readHomeMessageNotificationSettings(session?.email));
    setStudentNotificationPermission(getBrowserNotificationPermission());
  }, [session?.email]);

  useEffect(() => {
    setStudentWebPushPublicKey(studentMessageNotificationSettings.pushPublicKey ?? "");
  }, [studentMessageNotificationSettings.pushPublicKey]);

  useEffect(() => {
    const defaultDateKey = findInitialHomeAgendaDate(today, scheduledClasses, studioClasses, studioEvents);
    const defaultWeekStart = weekDaysForDate(parseCalendarDate(defaultDateKey))[0];
    setHomeScheduleWeekStartKey(toDateKey(defaultWeekStart));
    setSelectedHomeScheduleDateKey(defaultDateKey);
  }, [scheduledClasses, studioClasses, studioEvents, today]);

  useEffect(() => {
    if (isFeedSearchOpen) feedSearchInputRef.current?.focus();
  }, [isFeedSearchOpen]);

  const updateStudentMessageNotificationSettings = useCallback(
    (settings: Partial<MessageNotificationSettings>) => {
      setStudentMessageNotificationSettings((currentSettings) => {
        const nextSettings: MessageNotificationSettings = {
          ...currentSettings,
          ...settings,
          updatedAt: new Date().toISOString()
        };
        writeHomeMessageNotificationSettings(session?.email, nextSettings);
        return nextSettings;
      });
    },
    [session?.email]
  );

  useEffect(() => {
    const thread = latestUnreadStudentDirectThread;
    if (!studentDeviceNotificationsReady || !thread) return;
    const lastNotifiedAt = studentMessageNotificationSettings.lastBrowserNotifiedDirectMessageAt?.trim() ?? "";
    if (lastNotifiedAt && thread.sentDateTime <= lastNotifiedAt) return;
    const notificationTitle = `New message from ${thread.sender.trim() || "Cho's staff"}`;
    const notificationOptions: NotificationOptions = {
      body: thread.body ?? thread.preview,
      tag: `chos-student-${thread.id}`,
      icon: publicAsset("682e95109aa21_chos-logo.png"),
      badge: publicAsset("682e95109aa21_chos-logo.png"),
      data: {
        url: appHomeNotificationUrl(),
        threadId: thread.id
      }
    };
    void showDirectMessageBrowserNotification(notificationTitle, notificationOptions)
      .then((sent) => {
        if (sent) updateStudentMessageNotificationSettings({ lastBrowserNotifiedDirectMessageAt: thread.sentDateTime });
      })
      .catch(() => undefined);
  }, [
    latestUnreadStudentDirectThread,
    studentDeviceNotificationsReady,
    studentMessageNotificationSettings.lastBrowserNotifiedDirectMessageAt,
    updateStudentMessageNotificationSettings
  ]);

  const changeStudentProfilePhoto = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file for the student profile picture.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        showToast("Could not read that profile image.");
        return;
      }

      setStudentProfile((currentProfile) => {
        const nextProfile = { ...currentProfile, photoDataUrl: result };
        writeStudentProfile(nextProfile, session?.email);
        return nextProfile;
      });
      showToast("Student profile picture updated.");
    };
    reader.onerror = () => showToast("Could not read that profile image.");
    reader.readAsDataURL(file);
  };

  const shiftHomeScheduleWeek = (direction: number) => {
    const nextWeekStart = parseCalendarDate(homeScheduleWeekStartKey);
    nextWeekStart.setDate(nextWeekStart.getDate() + direction * 7);
    const nextWeekDays = weekDaysForDate(nextWeekStart);
    setHomeScheduleWeekStartKey(toDateKey(nextWeekDays[0]));
    setSelectedHomeScheduleDateKey(findBestHomeAgendaDateInWeek(nextWeekDays, scheduledClasses, studioClasses, studioEvents));
  };

  const changeFeedFilter = (nextFilter: ManagerHomeThread["kind"]) => {
    const resolvedFilter: ManagerHomeFeedFilter = feedFilter === nextFilter ? "all" : nextFilter;
    setFeedFilter(resolvedFilter);
    setSelectedThreadId((currentThreadId) => {
      if (!currentThreadId || resolvedFilter === "all") return currentThreadId;
      const currentThread = feedThreads.find((thread) => thread.id === currentThreadId);
      return currentThread?.kind === resolvedFilter ? currentThreadId : null;
    });
  };

  const openFeedThread = (threadId: string) => {
    setSelectedThreadId((currentThreadId) => currentThreadId === threadId ? null : threadId);
    const selectedThread = feedThreads.find((thread) => thread.id === threadId);
    if (selectedThread?.source === "direct") {
      setReadDirectThreadIds((currentIds) => new Set(currentIds).add(threadId));
      return;
    }
    setManualFeedThreads((currentThreads) =>
      currentThreads.map((thread) => thread.id === threadId && thread.unread ? { ...thread, unread: false } : thread)
    );
  };

  const closeFeedSearch = () => {
    setSearchQuery("");
    setIsFeedSearchOpen(false);
  };

  const handleFeedSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") closeFeedSearch();
  };

  const enableStudentMessageNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      updateStudentMessageNotificationSettings({
        browserNotificationsEnabled: false,
        browserPermission: "unsupported"
      });
      setStudentNotificationPermission("unsupported");
      showToast("Device notifications are unavailable in this browser.");
      return;
    }
    const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
    setStudentNotificationPermission(permission);
    updateStudentMessageNotificationSettings({
      browserNotificationsEnabled: permission === "granted",
      browserPermission: permission
    });
    showToast(permission === "granted" ? "Device notifications enabled for your app messages." : "Device notifications were not enabled.");
  };

  const sendStudentTestNotification = async () => {
    if (!studentDeviceNotificationsReady) {
      showToast("Enable message notifications before sending a test.");
      return;
    }
    const sent = await showDirectMessageBrowserNotification("Cho's student test notification", {
      body: "Device notifications are ready for messages in your Profile feed.",
      tag: "chos-student-test-notification",
      icon: publicAsset("682e95109aa21_chos-logo.png"),
      badge: publicAsset("682e95109aa21_chos-logo.png"),
      data: {
        url: appHomeNotificationUrl()
      }
    });
    showToast(sent ? "Student device notification sent." : "Student device notification could not be shown.");
  };

  const updateStudentPushServerEndpoint = (value: string) => {
    setStudentPushServerEndpoint(value);
    writePushServerEndpoint(value);
  };

  const connectStudentDevicePush = async () => {
    const applicationServerKey = webPushPublicKeyToBytes(studentWebPushPublicKey);
    if (!applicationServerKey) {
      showToast("Enter a valid student Web Push public key.");
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window) || !window.Notification.requestPermission || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      updateStudentMessageNotificationSettings({ browserPermission: "unsupported" });
      setStudentNotificationPermission("unsupported");
      showToast("Student Web Push subscriptions are unavailable in this browser.");
      return;
    }
    setIsStudentPushSubscribing(true);
    try {
      const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
      setStudentNotificationPermission(permission);
      if (permission !== "granted") {
        updateStudentMessageNotificationSettings({
          browserNotificationsEnabled: false,
          browserPermission: permission
        });
        showToast("Student push notifications were not enabled.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager || typeof registration.pushManager.subscribe !== "function") {
        showToast("Student Web Push subscriptions are unavailable in this browser.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      updateStudentMessageNotificationSettings(buildWebPushSubscriptionSettings(studentWebPushPublicKey, subscription));
      showToast("Student push subscription ready for private server sync.");
    } catch {
      showToast("Student push subscription failed.");
    } finally {
      setIsStudentPushSubscribing(false);
    }
  };

  const syncStudentPushSubscription = async () => {
    const endpoint = studentPushServerEndpoint.trim();
    if (!endpoint) {
      showToast("Enter a student private push server URL.");
      return;
    }
    const payload = buildWebPushSubscriptionPayload(studentMessageNotificationSettings, session, "student", appHomeNotificationUrl());
    if (!payload) {
      showToast("Connect the student device to Web Push before syncing.");
      return;
    }
    setIsStudentPushSubscriptionSyncing(true);
    try {
      const response = await window.fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        showToast(`Student push subscription sync failed with HTTP ${response.status}.`);
        return;
      }
      showToast("Student push subscription synced to private server.");
    } catch {
      showToast("Student push subscription sync failed.");
    } finally {
      setIsStudentPushSubscriptionSyncing(false);
    }
  };

  const toggleStudentHomeTheme = () => {
    const nextTheme: AppThemeMode = studentProfile.theme === "dark" ? "light" : "dark";
    setStudentProfile((currentProfile) => {
      const nextProfile = { ...currentProfile, theme: nextTheme };
      writeStudentProfile(nextProfile, session?.email);
      return nextProfile;
    });
    applyAppTheme(nextTheme);
    writeStoredAppTheme(nextTheme);
  };

  const saveStudentProfileSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateEmail(studentProfile.email)) {
      showToast("Enter a valid profile email.");
      return;
    }
    writeStudentProfile(studentProfile, session?.email);
    applyAppTheme(studentProfile.theme);
    writeStoredAppTheme(studentProfile.theme);
    setStudentProfileOpen(false);
    showToast("Student profile settings saved.");
  };

  const sendReply = () => {
    if (!replyText.trim()) {
      showToast("Write a reply before sending.");
      return;
    }
    const selectedThread = feedThreads.find((thread) => thread.id === selectedThreadId);
    if (selectedThread?.source === "direct" && selectedThread.replyRecipientId && selectedStudent) {
      const sentMessage = sendDirectMessage({
        senderId: selectedStudent.id,
        senderName: fullName(selectedStudent),
        recipientId: selectedThread.replyRecipientId,
        recipientName: selectedThread.replyRecipientName ?? "Cho's Manager",
        body: replyText
      });
      if (sentMessage) {
        showToast(`Reply sent to ${sentMessage.recipientName}.`);
        setReplyText("");
        return;
      }
      showToast("That app message thread is no longer available.");
      return;
    }
    showToast("Reply queued for Cho's staff.");
    setReplyText("");
  };

  return (
    <section className="student-reference-page" aria-label="Student profile page">
      <img
        className="student-reference-background"
        data-testid="student-reference-background"
        src={publicAsset("assets/student-profile-reference/profile-bg.png")}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <header className="student-reference-header" aria-label="Student profile page header">
        <ManagerPageTitleFrame title="Profile" className="student-reference-title-frame" />
        <nav className="student-reference-top-actions" aria-label="Student profile quick actions">
          <button className="student-reference-top-action" type="button" aria-label="Student Panel" onClick={() => setStudentBottomPanel("belt")}>
            <img src={managerPageIcon} alt="" aria-hidden="true" draggable="false" />
            <span>Student Panel</span>
          </button>
          <button className="student-reference-top-action" type="button" aria-label="Log Out" onClick={logout}>
            <img src={managerLogoutIcon} alt="" aria-hidden="true" draggable="false" />
            <span>Log Out</span>
          </button>
        </nav>
      </header>
      <main className="student-reference-main">
        <section className="student-reference-top-grid" aria-label="Student profile summary and schedule">
          <article className="student-reference-profile-card" aria-label="Student reference profile card">
            <button className="student-reference-profile-settings" type="button" aria-label="Profile Settings" onClick={() => setStudentProfileOpen(true)}>
              <img src={managerProfileSettingsIcon} alt="" aria-hidden="true" draggable="false" />
            </button>
            <button
              className="student-reference-theme-switch"
              type="button"
              role="switch"
              aria-checked={studentProfile.theme === "dark"}
              aria-label={studentProfile.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleStudentHomeTheme}
            >
              {studentProfile.theme === "dark" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
            </button>
            <div className="student-reference-portrait-wrap">
              <img className="student-reference-portrait" src={studentPortrait} alt={`${studentName} profile portrait`} draggable="false" />
              <label className="student-reference-camera" aria-label="Change student profile photo">
                <Camera size={20} aria-hidden="true" />
                <input className="sr-only" type="file" accept="image/*" onChange={changeStudentProfilePhoto} />
              </label>
            </div>
            <h2>{studentName}</h2>
            <p>{studentRoleLabel}</p>
            <ul className="student-reference-facts" aria-label="Student quick facts">
              <li><Award size={20} aria-hidden="true" /><span>Rank: {studentBeltLabel} Belt</span></li>
              <li><Target size={20} aria-hidden="true" /><span>Member Since: {memberSinceLabel}</span></li>
              <li><Users size={20} aria-hidden="true" /><span>Classes: {studentClassCount} Attended</span></li>
            </ul>
          </article>
          <section className="student-reference-schedule-card" aria-label="Student reference weekly schedule">
            <header className="student-reference-week-head">
              <button type="button" aria-label="Previous week" onClick={() => shiftHomeScheduleWeek(-1)}>
                <ChevronLeft size={24} aria-hidden="true" />
              </button>
              <h2>{formatWeekRange(homeScheduleWeekDays)}</h2>
              <button type="button" aria-label="Next week" onClick={() => shiftHomeScheduleWeek(1)}>
                <ChevronRight size={24} aria-hidden="true" />
              </button>
            </header>
            <div className="student-reference-week-strip" role="group" aria-label="Select schedule date">
              {homeScheduleWeekDays.map((day) => {
                const dayKey = toDateKey(day);
                const isSelected = dayKey === selectedHomeScheduleDateKey;
                return (
                  <button
                    key={dayKey}
                    type="button"
                    aria-label={`Select ${formatHomeScheduleDay(day)}`}
                    aria-pressed={isSelected}
                    className={isSelected ? "is-selected" : ""}
                    onClick={() => setSelectedHomeScheduleDateKey(dayKey)}
                  >
                    <span>{day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
                    <strong>{day.getDate()}</strong>
                  </button>
                );
              })}
            </div>
            <section className="student-reference-agenda" aria-label={`Schedule for ${formatHomeScheduleDay(selectedHomeScheduleDate)}`}>
              <h3>{formatHomeScheduleDay(selectedHomeScheduleDate)}</h3>
              {selectedHomeAgendaItems.length ? (
                <div className="student-reference-agenda-list">
                  {selectedHomeAgendaItems.slice(0, 3).map((item) => (
                    <article className="student-reference-agenda-item" key={item.id}>
                      <time dateTime={`${item.date}T${item.time}`}>{item.time}</time>
                      <span className={`student-reference-agenda-icon is-${item.kind}`} aria-hidden="true">
                        {item.kind === "event" ? <CalendarDays size={22} /> : <Users size={22} />}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.meta}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="student-reference-empty">No classes or events scheduled for this day.</p>
              )}
            </section>
          </section>
        </section>
        <section className="student-reference-action-row" aria-label="Student reference action row">
          <div className="student-reference-tabs" role="tablist" aria-label="Student profile bottom views">
            <button
              type="button"
              role="tab"
              id="student-profile-belt-case-tab"
              aria-selected={studentBottomPanel === "belt"}
              aria-controls="student-profile-belt-case-panel"
              tabIndex={studentBottomPanel === "belt" ? 0 : -1}
              onClick={() => setStudentBottomPanel("belt")}
            >
              <Award size={18} aria-hidden="true" />
              <span>Belt Case</span>
            </button>
            <button
              type="button"
              role="tab"
              id="student-profile-messages-tab"
              aria-selected={studentBottomPanel === "messages"}
              aria-controls="student-profile-messages-panel"
              tabIndex={studentBottomPanel === "messages" ? 0 : -1}
              onClick={() => setStudentBottomPanel("messages")}
            >
              <MessagesSquare size={18} aria-hidden="true" />
              <span>Messages</span>
            </button>
          </div>
          <button className="student-reference-star-button" type="button" aria-label="Great Job!">
            <Sparkles size={24} aria-hidden="true" />
          </button>
          <button className="student-reference-edit-button" type="button" onClick={() => setStudentProfileOpen(true)}>
            <FileText size={18} aria-hidden="true" />
            <span>Edit Profile</span>
          </button>
        </section>
        <section className="student-reference-bottom-panel" aria-label="Student profile bottom panel">
          {studentBottomPanel === "belt" ? (
            <section
              className="student-reference-bottom-view is-active"
              id="student-profile-belt-case-panel"
              role="tabpanel"
              aria-label="Student belt case display"
            >
              <StudentReferenceBeltJourney beltRank={studentBeltRank} classesAttended={studentClassCount} />
            </section>
          ) : (
            <section
              className="student-reference-bottom-view is-active"
              id="student-profile-messages-panel"
              role="tabpanel"
              aria-label="Messages and event notifications"
            >
              <div className="manager-home-feed-head student-reference-feed-head">
                <div className="manager-home-feed-counts" aria-label="Feed totals">
                  <button
                    className={`manager-home-count manager-home-count--message${feedFilter === "message" ? " is-active" : ""}`}
                    type="button"
                    aria-pressed={feedFilter === "message"}
                    aria-controls="student-profile-unified-feed"
                    onClick={() => changeFeedFilter("message")}
                  >
                    {messageCount} {messageCount === 1 ? "Message" : "Messages"}
                  </button>
                  <button
                    className={`manager-home-count manager-home-count--event${feedFilter === "event" ? " is-active" : ""}`}
                    type="button"
                    aria-pressed={feedFilter === "event"}
                    aria-controls="student-profile-unified-feed"
                    onClick={() => changeFeedFilter("event")}
                  >
                    {eventCount} Event {eventCount === 1 ? "Notification" : "Notifications"}
                  </button>
                </div>
                <div className="student-device-alert-actions" aria-label="Student device message notification controls">
                  <button type="button" className="student-device-alert-button" onClick={enableStudentMessageNotifications}>
                    <Smartphone size={16} aria-hidden="true" /> Enable Message Notifications
                  </button>
                  <button type="button" className="student-device-alert-button" onClick={sendStudentTestNotification} disabled={!studentDeviceNotificationsReady}>
                    <Bell size={16} aria-hidden="true" /> Send Student Test Notification
                  </button>
                  <span className="student-device-alert-status">Permission: {studentNotificationPermissionLabel}</span>
                </div>
                <HomeProfilePushSubscriptionControls
                  accountLabel="Student"
                  isPushSubscribing={isStudentPushSubscribing}
                  isPushSubscriptionSyncing={isStudentPushSubscriptionSyncing}
                  onConnectDevicePush={connectStudentDevicePush}
                  onPushServerEndpointChange={updateStudentPushServerEndpoint}
                  onSyncPushSubscription={syncStudentPushSubscription}
                  onWebPushPublicKeyChange={setStudentWebPushPublicKey}
                  pushServerEndpoint={studentPushServerEndpoint}
                  pushSubscriptionReady={studentPushSubscriptionReady}
                  webPushPublicKey={studentWebPushPublicKey}
                />
              </div>
              <div className={`manager-home-search-shell${isFeedSearchOpen ? " is-open" : ""}`}>
                {isFeedSearchOpen ? (
                  <div className="manager-home-search" role="search">
                    <Search size={22} aria-hidden="true" />
                    <label className="sr-only" htmlFor="student-profile-feed-search">Search messages and event notifications</label>
                    <input
                      aria-label="Search messages and event notifications"
                      id="student-profile-feed-search"
                      ref={feedSearchInputRef}
                      type="search"
                      placeholder="Search messages and event notifications..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={handleFeedSearchKeyDown}
                    />
                    <button className="manager-home-search-close" type="button" aria-label="Close search messages and event notifications" onClick={closeFeedSearch}>
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="manager-home-search-trigger"
                    type="button"
                    aria-label="Open search messages and event notifications"
                    aria-controls="student-profile-feed-search"
                    aria-expanded="false"
                    onClick={() => setIsFeedSearchOpen(true)}
                  >
                    <Search size={24} />
                  </button>
                )}
              </div>
              <div className="manager-home-unified-feed student-reference-feed" id="student-profile-unified-feed" aria-label="Student message and notification feed">
                {visibleFeedSections.length ? (
                  visibleFeedSections.map((section) => (
                    <section className="manager-home-date-section" key={section.date} aria-label={`Messages and event notifications from ${section.date}`}>
                      <div className="manager-home-date-divider" role="separator" aria-label={`Messages and event notifications from ${section.date}`}>
                        <span>{section.date}</span>
                      </div>
                      {section.threads.map((thread) => {
                        const isSelected = thread.id === selectedThreadId;
                        const isUnread = Boolean(thread.unread);
                        const kindLabel = thread.kind === "event" ? "Event Notification" : "Message";
                        const readStatusLabel = isUnread ? "Unread" : "Read";

                        return (
                          <article className={`manager-home-feed-item manager-home-feed-item--${thread.kind}${isUnread ? " is-unread" : " is-read"}${isSelected ? " is-selected" : ""}`} key={thread.id}>
                            <div className="manager-home-feed-row student-profile-feed-row">
                              <button
                                className="manager-home-feed-button"
                                type="button"
                                aria-expanded={isSelected}
                                aria-controls={`student-profile-feed-detail-${thread.id}`}
                                onClick={() => openFeedThread(thread.id)}
                              >
                                <span className="manager-home-thread-avatar">
                                  <img src={thread.avatar} alt="" draggable="false" />
                                </span>
                                <span className="manager-home-feed-copy">
                                  <strong>{thread.sender}</strong>
                                  <span className={`manager-home-read-status ${isUnread ? "is-unread" : "is-read"}`} aria-label={`${readStatusLabel} ${kindLabel.toLowerCase()}`}>
                                    <span aria-hidden="true" />
                                    <span>{readStatusLabel}</span>
                                  </span>
                                  <em>{kindLabel}</em>
                                  <b>{thread.title}</b>
                                  <small>{thread.preview}</small>
                                  <time className="manager-home-inline-sent" dateTime={thread.sentDateTime} aria-label={`${thread.title} sent at ${thread.sentTime}`}>
                                    {thread.sentTime}
                                  </time>
                                </span>
                              </button>
                            </div>
                            {isSelected && (
                              <div className="manager-home-feed-detail" id={`student-profile-feed-detail-${thread.id}`} aria-label={`${thread.title} details`}>
                                <div className="manager-home-detail-title-row">
                                  <span>{kindLabel}</span>
                                  <time dateTime={thread.sentDateTime}>Sent {thread.sentDate} at {thread.sentTime}</time>
                                </div>
                                <h2>{thread.title}</h2>
                                <header>
                                  <span className="manager-home-thread-avatar">
                                    <img src={thread.avatar} alt="" draggable="false" />
                                  </span>
                                  <div>
                                    <strong>{thread.sender}</strong>
                                    <p>{thread.kind === "event" ? "event notice for students and families" : "message for your student profile"}</p>
                                  </div>
                                  <button type="button" aria-label="More message actions">
                                    <MoreHorizontal size={20} />
                                  </button>
                                </header>
                                <div className="manager-home-message-copy">
                                  <p>Hello {studentName},</p>
                                  <p>{thread.preview.replace("...", ".")} Please review this update before your next class.</p>
                                </div>
                                {thread.kind === "event" && (
                                  <section className="manager-home-event-card" aria-label="Event details">
                                    <h3>Event Details</h3>
                                    <p><CalendarDays size={18} /> <span>Date: July 25 - July 27, 2026</span></p>
                                    <p><MapPin size={18} /> <span>Location: Cho&apos;s Martial Arts</span></p>
                                    <p><Users size={18} /> <span>Participants: Students and families</span></p>
                                    <p><CheckCircle2 size={18} /> <span>Check-in Time: 8:00 AM</span></p>
                                  </section>
                                )}
                                <p>{thread.kind === "event" ? "Arrive on time, bring your gear, and check in with the front desk." : "This message is saved to your Profile page for quick follow-up."}</p>
                                <p>Best regards,<br />{thread.sender}</p>
                                <div className="manager-home-reply">
                                  <input
                                    aria-label="Write a reply"
                                    placeholder="Write a reply..."
                                    value={replyText}
                                    onChange={(event) => setReplyText(event.target.value)}
                                  />
                                  <button type="button" onClick={sendReply}>
                                    <Send size={20} /> Reply
                                  </button>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </section>
                  ))
                ) : (
                  <p className="manager-home-empty">No messages or event notifications match your search.</p>
                )}
              </div>
            </section>
          )}
        </section>
      </main>
      {studentProfileOpen && (
        <div className="modal-backdrop manager-profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setStudentProfileOpen(false)}>
          <form className="modal-card manager-profile-modal" role="dialog" aria-modal="true" aria-label="Student profile settings" onSubmit={saveStudentProfileSettings}>
            <header className="student-modal-head">
              <div>
                <h2>Profile Settings</h2>
                <p>Edit student contact settings and app theme.</p>
              </div>
              <button className="student-modal-close" type="button" aria-label="Close student profile settings" onClick={() => setStudentProfileOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <section className="student-form-section manager-profile-form-section">
              <label className="field-label">
                Name
                <input
                  className="input"
                  value={studentProfile.name}
                  onChange={(event) => setStudentProfile({ ...studentProfile, name: event.target.value })}
                  placeholder="Cho's Student"
                />
              </label>
              <label className="field-label">
                Username
                <input
                  className="input"
                  value={studentProfile.username}
                  onChange={(event) => setStudentProfile({ ...studentProfile, username: event.target.value })}
                  autoComplete="username"
                  placeholder="chos-student"
                />
              </label>
              <label className="field-label">
                Email
                <input
                  className="input"
                  value={studentProfile.email}
                  onChange={(event) => setStudentProfile({ ...studentProfile, email: event.target.value })}
                  placeholder="student@chos.prototype"
                />
              </label>
              <label className="field-label">
                Phone
                <input
                  className="input"
                  value={studentProfile.phone}
                  onChange={(event) => setStudentProfile({ ...studentProfile, phone: event.target.value })}
                  placeholder="(262) 555-0100"
                />
              </label>
              <div className="manager-profile-preferences">
                <div className="manager-theme-setting" role="group" aria-label="App theme">
                  <span>App Theme</span>
                  <div className="manager-theme-options">
                    <button
                      type="button"
                      className={`manager-theme-option${studentProfile.theme === "light" ? " is-active" : ""}`}
                      aria-pressed={studentProfile.theme === "light"}
                      onClick={() => setStudentProfile({ ...studentProfile, theme: "light" })}
                    >
                      <Sun size={16} /> Light
                    </button>
                    <button
                      type="button"
                      className={`manager-theme-option${studentProfile.theme === "dark" ? " is-active" : ""}`}
                      aria-pressed={studentProfile.theme === "dark"}
                      onClick={() => setStudentProfile({ ...studentProfile, theme: "dark" })}
                    >
                      <Moon size={16} /> Dark
                    </button>
                  </div>
                </div>
                <label className="manager-profile-check">
                  <input
                    type="checkbox"
                    checked={studentProfile.updates}
                    onChange={(event) => setStudentProfile({ ...studentProfile, updates: event.target.checked })}
                  />
                  <span>Receive class and event updates</span>
                </label>
              </div>
              <ProfileColorEditingTool sessionEmail={session?.email} showToast={showToast} preview={studentColorPreview} />
            </section>
            <div className="student-editor-actions manager-profile-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> Save Profile Settings
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function LegacyStudentProfilePage() {
  const { currentChildAccount, directMessages, logout, scheduledClasses, sendDirectMessage, session, showToast, studioClasses, studioEvents, students } = useAppState();
  const today = useLiveCalendarDate();
  const selectedStudent = useMemo(() => {
    const sessionEmail = session?.email.toLowerCase();
    const sessionStudent = sessionEmail ? students.find((student) => student.email.toLowerCase() === sessionEmail) : undefined;
    if (sessionStudent) return sessionStudent;
    if (currentChildAccount) return undefined;
    return students.find((student) => (student.status ?? "Active").toLowerCase() === "active") ?? students[0];
  }, [currentChildAccount, session?.email, students]);
  const [studentProfile, setStudentProfile] = useState(() => readStudentProfile(session?.email, selectedStudent, currentChildAccount));
  const [studentProfileOpen, setStudentProfileOpen] = useState(false);
  const [homeScheduleWeekStartKey, setHomeScheduleWeekStartKey] = useState(() => toDateKey(weekDaysForDate(today)[0]));
  const [selectedHomeScheduleDateKey, setSelectedHomeScheduleDateKey] = useState(() => toDateKey(today));
  const [manualFeedThreads, setManualFeedThreads] = useState(() => studentHomeThreads);
  const [readDirectThreadIds, setReadDirectThreadIds] = useState<Set<string>>(() => new Set());
  const [hiddenDirectThreadIds] = useState<Set<string>>(() => new Set());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFeedSearchOpen, setIsFeedSearchOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<ManagerHomeFeedFilter>("all");
  const [replyText, setReplyText] = useState("");
  const [studentBottomPanel, setStudentBottomPanel] = useState<StudentProfileBottomPanel>("belt");
  const [overviewProgress, setOverviewProgress] = useState(1);
  const [overviewHeight, setOverviewHeight] = useState(0);
  const [isOverviewDragging, setIsOverviewDragging] = useState(false);
  const [beltCaseEditorFrame, setBeltCaseEditorFrame] = useState<BeltCaseEditorFrame | null>(null);
  const feedSearchInputRef = useRef<HTMLInputElement>(null);
  const overviewContentRef = useRef<HTMLElement>(null);
  const overviewHandleRef = useRef<HTMLButtonElement>(null);
  const overviewDragRef = useRef({
    hasMoved: false,
    ignoreClick: false,
    pointerId: null as number | null,
    startProgress: 1,
    startY: 0
  });
  const beltCaseEditorStyle = beltCaseEditorFrame ? ({
    "--student-belt-case-editor-top": `${beltCaseEditorFrame.top}px`,
    "--student-belt-case-editor-left": `${beltCaseEditorFrame.left}px`,
    "--student-belt-case-editor-width": `${beltCaseEditorFrame.width}px`,
    "--student-belt-case-editor-height": `${beltCaseEditorFrame.height}px`
  } as CSSProperties) : undefined;
  const directFeedThreads = useMemo(
    () => buildStudentDirectMessageFeedThreads(directMessages, selectedStudent, readDirectThreadIds, hiddenDirectThreadIds),
    [directMessages, hiddenDirectThreadIds, readDirectThreadIds, selectedStudent]
  );
  const feedThreads = useMemo(
    () => sortHomeFeedThreads([...directFeedThreads, ...manualFeedThreads]),
    [directFeedThreads, manualFeedThreads]
  );
  const messageCount = feedThreads.filter((thread) => thread.kind === "message").length;
  const eventCount = feedThreads.filter((thread) => thread.kind === "event").length;
  const visibleThreads = feedThreads.filter((thread) => {
    if (feedFilter !== "all" && thread.kind !== feedFilter) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${thread.kind} ${thread.sender} ${thread.title} ${thread.preview}`.toLowerCase().includes(query);
  });
  const visibleFeedSections = visibleThreads.reduce<{ date: string; threads: ManagerHomeThread[] }[]>((sections, thread) => {
    const currentSection = sections[sections.length - 1];
    if (currentSection?.date === thread.sentDate) {
      currentSection.threads.push(thread);
      return sections;
    }
    sections.push({ date: thread.sentDate, threads: [thread] });
    return sections;
  }, []);
  const homeScheduleWeekDays = useMemo(() => weekDaysForDate(parseCalendarDate(homeScheduleWeekStartKey)), [homeScheduleWeekStartKey]);
  const homeAgendaItems = useMemo(
    () => buildHomeAgendaItems(homeScheduleWeekDays, scheduledClasses, studioClasses, studioEvents),
    [homeScheduleWeekDays, scheduledClasses, studioClasses, studioEvents]
  );
  const homeAgendaItemsByDate = useMemo(
    () => homeAgendaItems.reduce<Record<string, ManagerHomeAgendaItem[]>>((groups, item) => {
      groups[item.date] = [...(groups[item.date] ?? []), item];
      return groups;
    }, {}),
    [homeAgendaItems]
  );
  const selectedHomeScheduleDate = parseCalendarDate(selectedHomeScheduleDateKey);
  const selectedHomeAgendaItems = homeAgendaItemsByDate[selectedHomeScheduleDateKey] ?? [];
  const isOverviewCollapsed = overviewProgress <= 0.01;
  const overviewStageState = isOverviewCollapsed ? "collapsed" : overviewProgress >= 0.99 ? "expanded" : "partial";
  const overviewStageStyle = {
    "--manager-home-overview-height": overviewHeight > 0 ? `${Math.round(overviewHeight * overviewProgress)}px` : "auto",
    "--manager-home-overview-progress": overviewProgress.toFixed(3)
  } as CSSProperties;
  const studentName = studentProfile.name || (selectedStudent ? fullName(selectedStudent) : currentChildAccount?.name.trim() || "Cho's Student");
  const studentFirstName = studentName.trim().split(/\s+/)[0] || "Student";
  const studentBeltRank = resolveBeltRank(currentChildAccount?.beltSlug ?? selectedStudent?.beltRank ?? "Green");
  const studentBeltLabel = studentBeltRank.name;
  const studentRoleLabel = currentChildAccount ? `${studentBeltLabel} Belt Student` : `${selectedStudent?.program ?? "Cho's Martial Arts"} Student`;
  const memberSinceLabel = formatMonthYear(currentChildAccount?.createdAt ?? selectedStudent?.joinedAt ?? session?.createdAt);
  const studentClassCount = selectedStudent?.classesAttended ?? 0;
  const studentPortrait = studentProfile.photoDataUrl ?? (selectedStudent?.profileImagePath ? publicAsset(selectedStudent.profileImagePath) : publicAsset("assets/CheetahProfilePic/Cheetah.png"));
  const studentColorPreview: ProfileColorPreviewData = {
    kind: "student",
    title: "Student Profile",
    displayName: studentName,
    roleLabel: studentRoleLabel,
    portraitSrc: studentPortrait,
    avatarText: childInitials(studentName),
    facts: [
      { icon: <Award size={18} />, label: `Rank: ${studentBeltLabel} Belt` },
      { icon: <Target size={18} />, label: `Member Since: ${memberSinceLabel}` },
      { icon: <Users size={18} />, label: `Classes: ${studentClassCount} Attended` }
    ],
    counts: [
      { label: messageCount === 1 ? "Message" : "Messages", value: messageCount, tone: "message" },
      { label: eventCount === 1 ? "Event" : "Events", value: eventCount, tone: "event" }
    ]
  };
  const [beltCaseSettings, setBeltCaseSettings] = useState(() => readBeltCaseSettings(session?.email, studentBeltRank, studentName));
  const [beltCaseSaveStatus, setBeltCaseSaveStatus] = useState("");
  const [isBeltCaseEditorOpen, setIsBeltCaseEditorOpen] = useState(false);

  useEffect(() => {
    setStudentProfile(readStudentProfile(session?.email, selectedStudent, currentChildAccount));
  }, [currentChildAccount, selectedStudent, session?.email]);

  useEffect(() => {
    setBeltCaseSettings(readBeltCaseSettings(session?.email, studentBeltRank, studentName));
    setBeltCaseSaveStatus("");
    setIsBeltCaseEditorOpen(false);
  }, [session?.email, studentBeltRank, studentName]);

  useEffect(() => {
    const defaultDateKey = findInitialHomeAgendaDate(today, scheduledClasses, studioClasses, studioEvents);
    const defaultWeekStart = weekDaysForDate(parseCalendarDate(defaultDateKey))[0];
    setHomeScheduleWeekStartKey(toDateKey(defaultWeekStart));
    setSelectedHomeScheduleDateKey(defaultDateKey);
  }, [scheduledClasses, studioClasses, studioEvents, today]);

  useEffect(() => {
    const node = overviewContentRef.current;
    if (!node) return;

    const updateOverviewHeight = (entry?: ResizeObserverEntry) => {
      const borderBoxHeight = entry?.borderBoxSize?.[0]?.blockSize ?? 0;
      const measuredHeight =
        node.getBoundingClientRect().height ||
        borderBoxHeight ||
        node.offsetHeight ||
        node.scrollHeight ||
        entry?.contentRect.height ||
        0;
      setOverviewHeight(Math.ceil(measuredHeight + HOME_OVERVIEW_STAGE_VISUAL_BUFFER));
    };

    updateOverviewHeight();

    if (typeof ResizeObserver === "undefined") {
      const updateOverviewHeightFromWindow = () => updateOverviewHeight();
      window.addEventListener("resize", updateOverviewHeightFromWindow);
      return () => window.removeEventListener("resize", updateOverviewHeightFromWindow);
    }

    const observer = new ResizeObserver((entries) => updateOverviewHeight(entries[0]));
    observer.observe(node, { box: "border-box" });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isBeltCaseEditorOpen) {
      setBeltCaseEditorFrame(null);
      return;
    }

    let frameRequest = 0;
    const measureEditorFrame = () => {
      if (frameRequest) {
        window.cancelAnimationFrame(frameRequest);
      }
      frameRequest = window.requestAnimationFrame(() => {
        const overviewElement = overviewContentRef.current;
        if (!overviewElement) return;

        const rect = overviewElement.getBoundingClientRect();
        const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
        const viewportTop = window.visualViewport?.offsetTop ?? 0;
        const viewportPadding = viewportWidth <= 420 ? 8 : viewportWidth <= 760 ? 10 : 14;
        const panelInset = viewportWidth <= 760 ? 8 : 12;
        const left = Math.max(viewportLeft + viewportPadding, rect.left + panelInset);
        const top = Math.max(viewportTop + viewportPadding, rect.top + panelInset);
        const right = Math.min(viewportLeft + viewportWidth - viewportPadding, rect.right - panelInset);
        const bottom = Math.min(viewportTop + viewportHeight - viewportPadding, rect.bottom - panelInset);
        const width = Math.max(240, right - left);
        const height = Math.max(120, bottom - top);
        const nextFrame = {
          top: Math.round(top),
          left: Math.round(left),
          width: Math.round(width),
          height: Math.round(height)
        };

        setBeltCaseEditorFrame((currentFrame) => {
          if (
            currentFrame &&
            currentFrame.top === nextFrame.top &&
            currentFrame.left === nextFrame.left &&
            currentFrame.width === nextFrame.width &&
            currentFrame.height === nextFrame.height
          ) {
            return currentFrame;
          }
          return nextFrame;
        });
      });
    };

    measureEditorFrame();
    window.addEventListener("resize", measureEditorFrame);
    window.visualViewport?.addEventListener("resize", measureEditorFrame);
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measureEditorFrame);
    if (overviewContentRef.current) {
      resizeObserver?.observe(overviewContentRef.current);
    }

    return () => {
      if (frameRequest) {
        window.cancelAnimationFrame(frameRequest);
      }
      window.removeEventListener("resize", measureEditorFrame);
      window.visualViewport?.removeEventListener("resize", measureEditorFrame);
      resizeObserver?.disconnect();
    };
  }, [isBeltCaseEditorOpen, overviewHeight, overviewProgress, overviewStageState]);

  useEffect(() => {
    if (isFeedSearchOpen) feedSearchInputRef.current?.focus();
  }, [isFeedSearchOpen]);

  useEffect(() => {
    if (!isOverviewCollapsed) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && overviewContentRef.current?.contains(activeElement)) {
      overviewHandleRef.current?.focus();
    }
  }, [isOverviewCollapsed]);

  const updateOverviewProgress = (nextProgress: number) => {
    setOverviewProgress(clampHomeOverviewProgress(nextProgress));
  };

  const toggleHomeOverview = () => {
    updateOverviewProgress(overviewProgress > 0.5 ? 0 : 1);
  };

  const handleOverviewHandleClick = () => {
    if (overviewDragRef.current.ignoreClick) {
      overviewDragRef.current.ignoreClick = false;
      return;
    }

    toggleHomeOverview();
  };

  const handleOverviewHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateOverviewProgress(overviewProgress - HOME_OVERVIEW_KEYBOARD_STEP);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateOverviewProgress(overviewProgress + HOME_OVERVIEW_KEYBOARD_STEP);
    }
  };

  const handleOverviewHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    overviewDragRef.current.hasMoved = false;
    overviewDragRef.current.ignoreClick = false;
    overviewDragRef.current.pointerId = event.pointerId;
    overviewDragRef.current.startProgress = overviewProgress;
    overviewDragRef.current.startY = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleOverviewHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = overviewDragRef.current;
    if (dragState.pointerId !== event.pointerId || overviewHeight <= 0) return;

    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaY) >= HOME_OVERVIEW_DRAG_THRESHOLD) {
      dragState.hasMoved = true;
    }

    if (!dragState.hasMoved) return;

    setIsOverviewDragging(true);
    updateOverviewProgress(dragState.startProgress + deltaY / overviewHeight);
  };

  const finishOverviewHandlePointer = (event: ReactPointerEvent<HTMLButtonElement>, shouldToggleOnTap: boolean) => {
    const dragState = overviewDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragState.pointerId = null;
    dragState.ignoreClick = true;
    setIsOverviewDragging(false);

    if (shouldToggleOnTap && !dragState.hasMoved) {
      toggleHomeOverview();
    }
  };

  const updateBeltCaseSettings = (patch: Partial<BeltCaseSettings>) => {
    setBeltCaseSaveStatus("");
    setBeltCaseSettings((currentSettings) => ({
      ...currentSettings,
      ...patch,
      updatedAt: new Date().toISOString()
    }));
  };

  const toggleBeltCaseSticker = (stickerId: BeltCaseStickerId) => {
    setBeltCaseSaveStatus("");
    setBeltCaseSettings((currentSettings) => {
      const isSelected = currentSettings.stickerIds.includes(stickerId);
      return {
        ...currentSettings,
        stickerIds: isSelected ? currentSettings.stickerIds.filter((id) => id !== stickerId) : [...currentSettings.stickerIds, stickerId],
        updatedAt: new Date().toISOString()
      };
    });
  };

  const saveBeltCaseSettings = () => {
    const { selectedBeltRank } = resolveBeltCaseSelection(beltCaseSettings, studentBeltRank);
    const nextSettings = {
      ...beltCaseSettings,
      plaqueText: sanitizeBeltCasePlaqueText(beltCaseSettings.plaqueText, defaultBeltCasePlaqueText(studentName, selectedBeltRank)),
      updatedAt: new Date().toISOString()
    };
    setBeltCaseSettings(nextSettings);
    writeBeltCaseSettings(session?.email, nextSettings);
    setBeltCaseSaveStatus("Saved for this student.");
  };

  const resetBeltCaseSettings = () => {
    const nextSettings = {
      ...defaultBeltCaseSettings(studentBeltRank, studentName),
      updatedAt: new Date().toISOString()
    };
    setBeltCaseSettings(nextSettings);
    writeBeltCaseSettings(session?.email, nextSettings);
    setBeltCaseSaveStatus("Defaults restored.");
  };

  const toggleBeltCaseEditor = () => {
    const shouldOpen = !isBeltCaseEditorOpen;
    setStudentBottomPanel("belt");
    setIsBeltCaseEditorOpen(shouldOpen);
    if (shouldOpen) {
      setIsOverviewDragging(false);
      updateOverviewProgress(1);
    }
  };

  const selectStudentBottomPanel = (panel: StudentProfileBottomPanel) => {
    setStudentBottomPanel(panel);
    if (panel === "messages") {
      setIsBeltCaseEditorOpen(false);
    }
  };

  const changeStudentProfilePhoto = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file for the student profile picture.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        showToast("Could not read that profile image.");
        return;
      }

      setStudentProfile((currentProfile) => {
        const nextProfile = { ...currentProfile, photoDataUrl: result };
        writeStudentProfile(nextProfile, session?.email);
        return nextProfile;
      });
      showToast("Student profile picture updated.");
    };
    reader.onerror = () => showToast("Could not read that profile image.");
    reader.readAsDataURL(file);
  };

  const shiftHomeScheduleWeek = (direction: number) => {
    const nextWeekStart = parseCalendarDate(homeScheduleWeekStartKey);
    nextWeekStart.setDate(nextWeekStart.getDate() + direction * 7);
    const nextWeekDays = weekDaysForDate(nextWeekStart);
    setHomeScheduleWeekStartKey(toDateKey(nextWeekDays[0]));
    setSelectedHomeScheduleDateKey(findBestHomeAgendaDateInWeek(nextWeekDays, scheduledClasses, studioClasses, studioEvents));
  };

  const changeFeedFilter = (nextFilter: ManagerHomeThread["kind"]) => {
    const resolvedFilter: ManagerHomeFeedFilter = feedFilter === nextFilter ? "all" : nextFilter;
    setFeedFilter(resolvedFilter);
    setSelectedThreadId((currentThreadId) => {
      if (!currentThreadId || resolvedFilter === "all") return currentThreadId;
      const currentThread = feedThreads.find((thread) => thread.id === currentThreadId);
      return currentThread?.kind === resolvedFilter ? currentThreadId : null;
    });
  };

  const openFeedThread = (threadId: string) => {
    setSelectedThreadId((currentThreadId) => currentThreadId === threadId ? null : threadId);
    const selectedThread = feedThreads.find((thread) => thread.id === threadId);
    if (selectedThread?.source === "direct") {
      setReadDirectThreadIds((currentIds) => new Set(currentIds).add(threadId));
      return;
    }
    setManualFeedThreads((currentThreads) =>
      currentThreads.map((thread) => thread.id === threadId && thread.unread ? { ...thread, unread: false } : thread)
    );
  };

  const closeFeedSearch = () => {
    setSearchQuery("");
    setIsFeedSearchOpen(false);
  };

  const handleFeedSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") closeFeedSearch();
  };

  const toggleStudentHomeTheme = () => {
    const nextTheme: AppThemeMode = studentProfile.theme === "dark" ? "light" : "dark";
    setStudentProfile((currentProfile) => {
      const nextProfile = { ...currentProfile, theme: nextTheme };
      writeStudentProfile(nextProfile, session?.email);
      return nextProfile;
    });
    applyAppTheme(nextTheme);
    writeStoredAppTheme(nextTheme);
  };

  const saveStudentProfileSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateEmail(studentProfile.email)) {
      showToast("Enter a valid profile email.");
      return;
    }
    writeStudentProfile(studentProfile, session?.email);
    applyAppTheme(studentProfile.theme);
    writeStoredAppTheme(studentProfile.theme);
    setStudentProfileOpen(false);
    showToast("Student profile settings saved.");
  };

  const sendReply = () => {
    if (!replyText.trim()) {
      showToast("Write a reply before sending.");
      return;
    }
    const selectedThread = feedThreads.find((thread) => thread.id === selectedThreadId);
    if (selectedThread?.source === "direct" && selectedThread.replyRecipientId && selectedStudent) {
      const sentMessage = sendDirectMessage({
        senderId: selectedStudent.id,
        senderName: fullName(selectedStudent),
        recipientId: selectedThread.replyRecipientId,
        recipientName: selectedThread.replyRecipientName ?? "Cho's Manager",
        body: replyText
      });
      if (sentMessage) {
        showToast(`Reply sent to ${sentMessage.recipientName}.`);
        setReplyText("");
        return;
      }
      showToast("That app message thread is no longer available.");
      return;
    }
    showToast("Reply queued for Cho's staff.");
    setReplyText("");
  };

  return (
    <section className="manager-home-page student-profile-page" aria-label="Student profile page">
      <header className="manager-home-profile-title manager-page-title-bar" aria-label="Student profile page header">
        <ManagerPageTitleFrame title="Profile" className="manager-home-profile-title-frame" />
        <nav className="manager-home-top-actions" aria-label="Student profile quick actions">
          <Link className="manager-home-top-action student-profile-panel-link" to="/manager" aria-label="Student's Panel">
            <img className="manager-home-panel-icon" src={managerPageIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Student's Panel</span>
          </Link>
          <button className="manager-home-top-action manager-home-logout-button" type="button" aria-label="Log Out" onClick={logout}>
            <img className="manager-home-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Log Out</span>
          </button>
        </nav>
      </header>
      <main className="manager-home-shell">
        <div
          aria-hidden={isOverviewCollapsed}
          className={`manager-home-overview-stage${isOverviewCollapsed ? " is-collapsed" : ""}${isOverviewDragging ? " is-dragging" : ""}`}
          data-overview-progress={overviewProgress.toFixed(2)}
          data-overview-state={overviewStageState}
          style={overviewStageStyle}
        >
          <section
            className="manager-home-overview student-profile-overview"
            aria-label="Student profile overview section"
            ref={overviewContentRef}
          >
            <article className="manager-home-profile-card" aria-label="Student profile overview">
              <button className="manager-home-profile-settings-link" type="button" aria-label="Profile Settings" onClick={() => setStudentProfileOpen(true)}>
                <img className="manager-home-profile-settings-icon" src={managerProfileSettingsIcon} alt="" draggable="false" />
              </button>
              <button
                aria-checked={studentProfile.theme === "dark"}
                aria-label={studentProfile.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className={`manager-home-profile-theme-toggle manager-home-profile-theme-toggle--${studentProfile.theme}`}
                onClick={toggleStudentHomeTheme}
                role="switch"
                type="button"
              >
                <span className="manager-home-profile-theme-icons" aria-hidden="true">
                  <Sun size={15} />
                  <Moon size={15} />
                </span>
                <span className="manager-home-profile-theme-thumb" aria-hidden="true">
                  {studentProfile.theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
                </span>
              </button>
              <label className="manager-home-profile-frame manager-home-profile-upload">
                <span className="sr-only">Upload student profile picture</span>
                <input type="file" accept="image/*" aria-label="Upload student profile picture" onChange={changeStudentProfilePhoto} />
                <img src={studentPortrait} alt={`${studentName} profile portrait`} draggable="false" />
                <span className="manager-home-profile-change-badge" aria-hidden="true">
                  <Camera size={15} />
                </span>
              </label>
              <div className="manager-home-profile-copy">
                <h2>{studentName}</h2>
                <p>{studentRoleLabel}</p>
              </div>
              {currentChildAccount && (
                <section className="student-profile-welcome" aria-label="Student welcome">
                  <span className="student-profile-welcome-badge">
                    <ShieldCheck size={16} aria-hidden="true" /> Ready
                  </span>
                  <h3>Hi {studentFirstName}, welcome to your student app.</h3>
                  <p>Your parent set up this profile so you can practice, check in, and see what is next.</p>
                  <div className="student-profile-welcome-actions">
                    <Link to="/manager" aria-label="Open Practice Tools">
                      <BookOpen size={16} aria-hidden="true" />
                      <span>Practice Tools</span>
                    </Link>
                    <Link to="/check-ins" aria-label="Check In">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>Check In</span>
                    </Link>
                  </div>
                </section>
              )}
              <dl className="manager-home-profile-facts">
                <div>
                  <dt><Award size={20} /></dt>
                  <dd>Rank: {studentBeltLabel} Belt</dd>
                </div>
                <div>
                  <dt><Target size={20} /></dt>
                  <dd>Member Since: {memberSinceLabel}</dd>
                </div>
                <div>
                  <dt><Users size={20} /></dt>
                  <dd>Classes: {studentClassCount} Attended</dd>
                </div>
              </dl>
            </article>
            <section className="manager-home-week-card" aria-label="Student month schedule">
              <header className="manager-home-week-nav">
                <button type="button" aria-label="Previous week" onClick={() => shiftHomeScheduleWeek(-1)}>
                  <ChevronLeft size={20} />
                </button>
                <h2>{formatWeekRange(homeScheduleWeekDays)}</h2>
                <button type="button" aria-label="Next week" onClick={() => shiftHomeScheduleWeek(1)}>
                  <ChevronRight size={20} />
                </button>
              </header>
              <div className="manager-home-week-days" aria-label="Week days">
                {homeScheduleWeekDays.map((day) => {
                  const dateKey = toDateKey(day);
                  const isSelected = dateKey === selectedHomeScheduleDateKey;
                  return (
                    <button
                      aria-label={`Select ${formatHomeScheduleDay(day)}`}
                      aria-pressed={isSelected}
                      className={isSelected ? "is-selected" : undefined}
                      key={dateKey}
                      onClick={() => setSelectedHomeScheduleDateKey(dateKey)}
                      type="button"
                    >
                      <span>{day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
                      <strong>{day.getDate()}</strong>
                    </button>
                  );
                })}
              </div>
              <section className="manager-home-agenda-card" aria-live="polite" aria-label="Selected day agenda">
                <h3>{formatHomeScheduleDay(selectedHomeScheduleDate)}</h3>
                <div className="manager-home-agenda-list">
                  {selectedHomeAgendaItems.length ? (
                    selectedHomeAgendaItems.slice(0, 5).map((item) => (
                      <article className={`manager-home-agenda-item manager-home-agenda-item--${item.kind}`} key={item.id}>
                        <time>{item.time}</time>
                        <span aria-hidden="true">
                          {item.kind === "event" ? <CalendarDays size={20} /> : item.kind === "class" ? <Users size={20} /> : <MessagesSquare size={20} />}
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.meta}</small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>No classes or events scheduled for this date.</p>
                  )}
                </div>
                <Link className="student-profile-full-schedule-link" to="/schedule">
                  <span>View Full Schedule</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </section>
            </section>
          </section>
        </div>
        <button
          aria-expanded={!isOverviewCollapsed}
          aria-label={isOverviewCollapsed ? "Expand student overview" : "Collapse student overview"}
          className={`manager-home-overview-handle${isOverviewCollapsed ? " is-collapsed" : ""}${isOverviewDragging ? " is-dragging" : ""}`}
          onClick={handleOverviewHandleClick}
          onKeyDown={handleOverviewHandleKeyDown}
          onPointerCancel={(event) => finishOverviewHandlePointer(event, false)}
          onPointerDown={handleOverviewHandlePointerDown}
          onPointerMove={handleOverviewHandlePointerMove}
          onPointerUp={(event) => finishOverviewHandlePointer(event, true)}
          ref={overviewHandleRef}
          type="button"
        >
          <span className="manager-home-overview-handle-bar" aria-hidden="true" />
        </button>
        <section className={`manager-home-feed-panel student-profile-bottom-panel${studentBottomPanel === "belt" ? " is-belt-case-active" : ""}${isBeltCaseEditorOpen ? " is-editing-belt-case" : ""}`} aria-label="Student profile bottom panel">
          <header className="student-profile-bottom-head">
            <div className="student-profile-bottom-tabs" role="tablist" aria-label="Student profile bottom views">
              <button
                type="button"
                role="tab"
                id="student-profile-belt-case-tab"
                aria-selected={studentBottomPanel === "belt"}
                aria-controls="student-profile-belt-case-panel"
                tabIndex={studentBottomPanel === "belt" ? 0 : -1}
                onClick={() => selectStudentBottomPanel("belt")}
              >
                <Award size={16} aria-hidden="true" />
                <span>Belt Case</span>
              </button>
              <button
                type="button"
                role="tab"
                id="student-profile-messages-tab"
                aria-selected={studentBottomPanel === "messages"}
                aria-controls="student-profile-messages-panel"
                tabIndex={studentBottomPanel === "messages" ? 0 : -1}
                onClick={() => selectStudentBottomPanel("messages")}
              >
                <MessagesSquare size={16} aria-hidden="true" />
                <span>Messages</span>
              </button>
            </div>
            <div className="student-profile-bottom-actions">
              {studentBottomPanel === "belt" && (
                <>
                  <button className="student-profile-achievement-button" type="button" aria-label={`${studentFirstName}'s achievement summary`}>
                    <Sparkles size={20} aria-hidden="true" />
                  </button>
                  <button
                    className={`student-profile-belt-edit-button${isBeltCaseEditorOpen ? " is-active" : ""}`}
                    type="button"
                    aria-controls="student-belt-case-editor"
                    aria-expanded={isBeltCaseEditorOpen}
                    aria-pressed={isBeltCaseEditorOpen}
                    onClick={toggleBeltCaseEditor}
                  >
                    <Palette size={15} aria-hidden="true" />
                    <span>Customize Belt Case</span>
                  </button>
                </>
              )}
              <button className="student-profile-edit-profile-button" type="button" onClick={() => setStudentProfileOpen(true)}>
                <FileText size={16} aria-hidden="true" />
                <span>Edit Profile</span>
              </button>
            </div>
          </header>
          <div className="student-profile-bottom-panels">
            <section
              className={`student-profile-bottom-view student-profile-belt-case-view${studentBottomPanel === "belt" ? " is-active" : ""}`}
              id="student-profile-belt-case-panel"
              role="tabpanel"
              aria-label="Student belt case display"
              aria-hidden={studentBottomPanel !== "belt"}
              inert={studentBottomPanel !== "belt"}
            >
              <StudentBeltCasePreview beltRank={studentBeltRank} classesAttended={studentClassCount} settings={beltCaseSettings} />
            </section>
            <section
              className={`student-profile-bottom-view student-profile-feed-panel${studentBottomPanel === "messages" ? " is-active" : ""}`}
              id="student-profile-messages-panel"
              role="tabpanel"
              aria-label="Messages and event notifications"
              aria-hidden={studentBottomPanel !== "messages"}
              inert={studentBottomPanel !== "messages"}
            >
          <div className="manager-home-feed-head">
            <div className="manager-home-feed-counts" aria-label="Feed totals">
              <button
                className={`manager-home-count manager-home-count--message${feedFilter === "message" ? " is-active" : ""}`}
                type="button"
                aria-pressed={feedFilter === "message"}
                aria-controls="student-profile-unified-feed"
                onClick={() => changeFeedFilter("message")}
              >
                {messageCount} {messageCount === 1 ? "Message" : "Messages"}
              </button>
              <button
                className={`manager-home-count manager-home-count--event${feedFilter === "event" ? " is-active" : ""}`}
                type="button"
                aria-pressed={feedFilter === "event"}
                aria-controls="student-profile-unified-feed"
                onClick={() => changeFeedFilter("event")}
              >
                {eventCount} Event {eventCount === 1 ? "Notification" : "Notifications"}
              </button>
            </div>
          </div>
          <div className={`manager-home-search-shell${isFeedSearchOpen ? " is-open" : ""}`}>
            {isFeedSearchOpen ? (
              <div className="manager-home-search" role="search">
                <Search size={22} aria-hidden="true" />
                <label className="sr-only" htmlFor="student-profile-feed-search">Search messages and event notifications</label>
                <input
                  aria-label="Search messages and event notifications"
                  id="student-profile-feed-search"
                  ref={feedSearchInputRef}
                  type="search"
                  placeholder="Search messages and event notifications..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={handleFeedSearchKeyDown}
                />
                <button className="manager-home-search-close" type="button" aria-label="Close search messages and event notifications" onClick={closeFeedSearch}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                className="manager-home-search-trigger"
                type="button"
                aria-label="Open search messages and event notifications"
                aria-controls="student-profile-feed-search"
                aria-expanded="false"
                onClick={() => setIsFeedSearchOpen(true)}
              >
                <Search size={24} />
              </button>
            )}
          </div>
          <div className="manager-home-unified-feed" id="student-profile-unified-feed" aria-label="Student message and notification feed">
            {visibleFeedSections.length ? (
              visibleFeedSections.map((section) => (
                <section className="manager-home-date-section" key={section.date} aria-label={`Messages and event notifications from ${section.date}`}>
                  <div className="manager-home-date-divider" role="separator" aria-label={`Messages and event notifications from ${section.date}`}>
                    <span>{section.date}</span>
                  </div>
                  {section.threads.map((thread) => {
                    const isSelected = thread.id === selectedThreadId;
                    const isUnread = Boolean(thread.unread);
                    const kindLabel = thread.kind === "event" ? "Event Notification" : "Message";
                    const readStatusLabel = isUnread ? "Unread" : "Read";

                    return (
                      <article className={`manager-home-feed-item manager-home-feed-item--${thread.kind}${isUnread ? " is-unread" : " is-read"}${isSelected ? " is-selected" : ""}`} key={thread.id}>
                        <div className="manager-home-feed-row student-profile-feed-row">
                          <button
                            className="manager-home-feed-button"
                            type="button"
                            aria-expanded={isSelected}
                            aria-controls={`student-profile-feed-detail-${thread.id}`}
                            onClick={() => openFeedThread(thread.id)}
                          >
                            <span className="manager-home-thread-avatar">
                              <img src={thread.avatar} alt="" draggable="false" />
                            </span>
                            <span className="manager-home-feed-copy">
                              <strong>{thread.sender}</strong>
                              <span className={`manager-home-read-status ${isUnread ? "is-unread" : "is-read"}`} aria-label={`${readStatusLabel} ${kindLabel.toLowerCase()}`}>
                                <span aria-hidden="true" />
                                <span>{readStatusLabel}</span>
                              </span>
                              <em>{kindLabel}</em>
                              <b>{thread.title}</b>
                              <small>{thread.preview}</small>
                              <time className="manager-home-inline-sent" dateTime={thread.sentDateTime} aria-label={`${thread.title} sent at ${thread.sentTime}`}>
                                {thread.sentTime}
                              </time>
                            </span>
                          </button>
                        </div>
                        {isSelected && (
                          <div className="manager-home-feed-detail" id={`student-profile-feed-detail-${thread.id}`} aria-label={`${thread.title} details`}>
                            <div className="manager-home-detail-title-row">
                              <span>{kindLabel}</span>
                              <time dateTime={thread.sentDateTime}>Sent {thread.sentDate} at {thread.sentTime}</time>
                            </div>
                            <h2>{thread.title}</h2>
                            <header>
                              <span className="manager-home-thread-avatar">
                                <img src={thread.avatar} alt="" draggable="false" />
                              </span>
                              <div>
                                <strong>{thread.sender}</strong>
                                <p>{thread.audienceLabel ?? (thread.kind === "event" ? "event notice for students and families" : "message for your student profile")}</p>
                              </div>
                              <button type="button" aria-label="More message actions">
                                <MoreHorizontal size={20} />
                              </button>
                            </header>
                            <div className="manager-home-message-copy">
                              {thread.source === "direct" ? (
                                <p>{thread.body ?? thread.preview}</p>
                              ) : (
                                <>
                                  <p>Hello {studentName},</p>
                                  <p>{thread.preview.replace("...", ".")} Please review this update before your next class.</p>
                                </>
                              )}
                            </div>
                            {thread.kind === "event" && (
                              <section className="manager-home-event-card" aria-label="Event details">
                                <h3>Event Details</h3>
                                <p><CalendarDays size={18} /> <span>Date: July 25 - July 27, 2026</span></p>
                                <p><MapPin size={18} /> <span>Location: Cho&apos;s Martial Arts</span></p>
                                <p><Users size={18} /> <span>Participants: Students and families</span></p>
                                <p><CheckCircle2 size={18} /> <span>Check-in Time: 8:00 AM</span></p>
                              </section>
                            )}
                            <p>{thread.source === "direct" ? "Reply here to keep the conversation with Cho's staff moving." : thread.kind === "event" ? "Arrive on time, bring your gear, and check in with the front desk." : "This message is saved to your Profile page for quick follow-up."}</p>
                            {thread.source !== "direct" && <p>Best regards,<br />{thread.sender}</p>}
                            <div className="manager-home-reply">
                              <input
                                aria-label="Write a reply"
                                placeholder="Write a reply..."
                                value={replyText}
                                onChange={(event) => setReplyText(event.target.value)}
                              />
                              <button type="button" onClick={sendReply}>
                                <Send size={20} /> Reply
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              ))
            ) : (
              <p className="manager-home-empty">No messages or event notifications match your search.</p>
            )}
          </div>
            </section>
          </div>
        </section>
        {studentProfileOpen && (
          <div className="modal-backdrop manager-profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setStudentProfileOpen(false)}>
            <form className="modal-card manager-profile-modal" role="dialog" aria-modal="true" aria-label="Student profile settings" onSubmit={saveStudentProfileSettings}>
              <header className="student-modal-head">
                <div>
                  <h2>Profile Settings</h2>
                  <p>Edit student contact settings and app theme.</p>
                </div>
                <button className="student-modal-close" type="button" aria-label="Close student profile settings" onClick={() => setStudentProfileOpen(false)}>
                  <X size={20} />
                </button>
              </header>
              <section className="student-form-section manager-profile-form-section">
                <label className="field-label">
                  Name
                  <input
                    className="input"
                    value={studentProfile.name}
                    onChange={(event) => setStudentProfile({ ...studentProfile, name: event.target.value })}
                    placeholder="Cho's Student"
                  />
                </label>
                <label className="field-label">
                  Username
                  <input
                    className="input"
                    value={studentProfile.username}
                    onChange={(event) => setStudentProfile({ ...studentProfile, username: event.target.value })}
                    autoComplete="username"
                    placeholder="chos-student"
                  />
                </label>
                <label className="field-label">
                  Email
                  <input
                    className="input"
                    value={studentProfile.email}
                    onChange={(event) => setStudentProfile({ ...studentProfile, email: event.target.value })}
                    placeholder="student@chos.prototype"
                  />
                </label>
                <label className="field-label">
                  Phone
                  <input
                    className="input"
                    value={studentProfile.phone}
                    onChange={(event) => setStudentProfile({ ...studentProfile, phone: event.target.value })}
                    placeholder="(262) 555-0100"
                  />
                </label>
                <div className="manager-profile-preferences">
                  <div className="manager-theme-setting" role="group" aria-label="App theme">
                    <span>App Theme</span>
                    <div className="manager-theme-options">
                      <button
                        type="button"
                        className={`manager-theme-option${studentProfile.theme === "light" ? " is-active" : ""}`}
                        aria-pressed={studentProfile.theme === "light"}
                        onClick={() => setStudentProfile({ ...studentProfile, theme: "light" })}
                      >
                        <Sun size={16} /> Light
                      </button>
                      <button
                        type="button"
                        className={`manager-theme-option${studentProfile.theme === "dark" ? " is-active" : ""}`}
                        aria-pressed={studentProfile.theme === "dark"}
                        onClick={() => setStudentProfile({ ...studentProfile, theme: "dark" })}
                      >
                        <Moon size={16} /> Dark
                      </button>
                    </div>
                  </div>
                  <label className="manager-profile-check">
                    <input
                      type="checkbox"
                      checked={studentProfile.updates}
                      onChange={(event) => setStudentProfile({ ...studentProfile, updates: event.target.checked })}
                    />
                    <span>Receive class and event updates</span>
                  </label>
                </div>
                <ProfileColorEditingTool sessionEmail={session?.email} showToast={showToast} preview={studentColorPreview} />
              </section>
              <div className="student-editor-actions manager-profile-actions">
                <button type="submit">
                  <CheckCircle2 size={18} /> Save Profile Settings
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      {isBeltCaseEditorOpen && (
        <StudentBeltCaseEditor
          beltRank={studentBeltRank}
          onChange={updateBeltCaseSettings}
          onClose={() => setIsBeltCaseEditorOpen(false)}
          onReset={resetBeltCaseSettings}
          onSave={saveBeltCaseSettings}
          onToggleSticker={toggleBeltCaseSticker}
          saveStatus={beltCaseSaveStatus}
          settings={beltCaseSettings}
          style={beltCaseEditorStyle}
        />
      )}
    </section>
  );
}

function ParentProfileTabContent({
  activeTab,
  directMessageThreads,
  isParentPushSubscribing,
  isParentPushSubscriptionSyncing,
  onConnectParentDevicePush,
  onEnableParentMessageNotifications,
  onParentPushServerEndpointChange,
  onParentWebPushPublicKeyChange,
  onSendParentTestNotification,
  onSyncParentPushSubscription,
  parentDeviceNotificationsReady,
  parentNotificationPermissionLabel,
  parentPushServerEndpoint,
  parentPushSubscriptionReady,
  parentWebPushPublicKey,
  selectedChild,
  scheduledClasses,
  studioClasses,
  studioEvents
}: {
  activeTab: ParentProfileTab;
  directMessageThreads: ManagerHomeThread[];
  isParentPushSubscribing: boolean;
  isParentPushSubscriptionSyncing: boolean;
  onConnectParentDevicePush: () => void;
  onEnableParentMessageNotifications: () => void;
  onParentPushServerEndpointChange: (value: string) => void;
  onParentWebPushPublicKeyChange: (value: string) => void;
  onSendParentTestNotification: () => void;
  onSyncParentPushSubscription: () => void;
  parentDeviceNotificationsReady: boolean;
  parentNotificationPermissionLabel: string;
  parentPushServerEndpoint: string;
  parentPushSubscriptionReady: boolean;
  parentWebPushPublicKey: string;
  selectedChild?: ChildAccount;
  scheduledClasses: ScheduledClass[];
  studioClasses: StudioClass[];
  studioEvents: StudioEvent[];
}) {
  const childName = selectedChild?.name ?? "your child";
  const today = toDateKey(useLiveCalendarDate());
  const nextClass = findNextStudentScheduledClass(scheduledClasses, selectedChild?.id, today);
  const nextEvent = findNextStudioEvent(studioEvents, today);

  if (activeTab === "classes") {
    return (
      <section className="parent-tool-panel" aria-label="Parent classes view">
        <header>
          <h2>Classes</h2>
          <p>See the class options and weekly schedule before deciding where {childName} should train next.</p>
        </header>
        <div className="parent-class-grid">
          {studioClasses.map((studioClass) => (
            <article className="parent-class-card" key={studioClass.id}>
              <span className="parent-card-icon" aria-hidden="true"><CalendarDays size={20} /></span>
              <div>
                <h3>{studioClass.name}</h3>
                <p>{formatClassDays(studioClass.daysOfWeek)}</p>
                <strong>{formatClassTimeRange(studioClass)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "study") {
    return (
      <section className="parent-tool-panel" aria-label="Parent study view">
        <header>
          <h2>Study</h2>
          <p>Parent-friendly practice prompts for helping younger students review at home.</p>
        </header>
        <div className="parent-card-list">
          {parentStudyItems.map((item) => (
            <article className="parent-guide-card" key={item.title}>
              <span className="parent-card-icon" aria-hidden="true"><Award size={20} /></span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "test") {
    return (
      <section className="parent-tool-panel" aria-label="Parent test readiness view">
        <header>
          <h2>Test</h2>
          <p>Track what parents should confirm before a child is ready for belt testing.</p>
        </header>
        <div className="parent-card-list">
          {parentTestingItems.map((item) => (
            <article className="parent-guide-card" key={item.title}>
              <span className="parent-card-icon" aria-hidden="true"><Target size={20} /></span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "messages") {
    const messages = studentHomeThreads.filter((thread) => thread.kind === "message");
    const visibleMessages = [...directMessageThreads, ...messages];
    return (
      <section className="parent-tool-panel" aria-label="Parent messages view">
        <header>
          <h2>Messages</h2>
          <p>Review staff and studio messages connected to {childName}&apos;s account.</p>
        </header>
        <div className="parent-device-alert-actions" aria-label="Parent device message notification controls">
          <button type="button" className="student-device-alert-button" onClick={onEnableParentMessageNotifications}>
            <Smartphone size={16} aria-hidden="true" /> Enable Parent Message Notifications
          </button>
          <button type="button" className="student-device-alert-button" onClick={onSendParentTestNotification} disabled={!parentDeviceNotificationsReady}>
            <Bell size={16} aria-hidden="true" /> Send Parent Test Notification
          </button>
          <span className="student-device-alert-status">Permission: {parentNotificationPermissionLabel}</span>
        </div>
        <HomeProfilePushSubscriptionControls
          accountLabel="Parent"
          isPushSubscribing={isParentPushSubscribing}
          isPushSubscriptionSyncing={isParentPushSubscriptionSyncing}
          onConnectDevicePush={onConnectParentDevicePush}
          onPushServerEndpointChange={onParentPushServerEndpointChange}
          onSyncPushSubscription={onSyncParentPushSubscription}
          onWebPushPublicKeyChange={onParentWebPushPublicKeyChange}
          pushServerEndpoint={parentPushServerEndpoint}
          pushSubscriptionReady={parentPushSubscriptionReady}
          webPushPublicKey={parentWebPushPublicKey}
        />
        <div className="parent-message-list">
          {visibleMessages.map((thread) => (
            <article className="parent-message-row" key={thread.id}>
              <img src={thread.avatar} alt="" draggable="false" />
              <div>
                <strong>{thread.title}</strong>
                <span>{thread.sender} - {thread.sentDate} at {thread.sentTime}</span>
                <p>{thread.preview}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "notifications") {
    const eventThreads = studentHomeThreads.filter((thread) => thread.kind === "event");
    return (
      <section className="parent-tool-panel" aria-label="Parent notifications view">
        <header>
          <h2>Notifications</h2>
          <p>Event notices, parent reminders, and testing updates for the family.</p>
        </header>
        <div className="parent-message-list">
          {eventThreads.map((thread) => (
            <article className="parent-message-row" key={thread.id}>
              <img src={thread.avatar} alt="" draggable="false" />
              <div>
                <strong>{thread.title}</strong>
                <span>{thread.sender} - {thread.sentDate} at {thread.sentTime}</span>
                <p>{thread.preview}</p>
              </div>
            </article>
          ))}
          {studioEvents.slice(0, 3).map((event) => (
            <article className="parent-message-row" key={event.id}>
              <span className="parent-card-icon" aria-hidden="true"><CalendarDays size={20} /></span>
              <div>
                <strong>{event.title}</strong>
                <span>{event.date} at {event.time}</span>
                <p>{event.details}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="parent-tool-panel" aria-label="Parent dashboard view">
      <header>
        <h2>Dashboard</h2>
        <p>A quick view of {childName}&apos;s profile, next class, and family alerts.</p>
      </header>
      <div className="parent-dashboard-grid">
        <article>
          <span>Selected Student</span>
          <strong>{selectedChild?.name ?? "No child selected"}</strong>
          <p>{selectedChild ? `Age ${selectedChild.age || "not set"} - ${childBeltLabel(selectedChild.beltSlug)} Belt` : "Create a child profile to start tracking their student tools."}</p>
        </article>
        <article>
          <span>Next Class</span>
          <strong>{nextClass?.title ?? "No class scheduled"}</strong>
          <p>{nextClass ? `${nextClass.date} at ${nextClass.time}` : "Cho's staff can add schedule items from the manager panel."}</p>
        </article>
        <article>
          <span>Next Notification</span>
          <strong>{nextEvent?.title ?? "No event posted"}</strong>
          <p>{nextEvent ? `${nextEvent.date} at ${nextEvent.time}` : "No event notifications are currently queued."}</p>
        </article>
      </div>
    </section>
  );
}

function ParentChildProfileModal({
  form,
  mode,
  onBeltInteract,
  onChange,
  onClose,
  onSubmit
}: {
  form: { name: string; age: string; beltSlug: string; username: string; password: string };
  mode: "add" | "edit";
  onBeltInteract: () => void;
  onChange: (form: { name: string; age: string; beltSlug: string; username: string; password: string }) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const modalTitle = mode === "edit" ? "Edit Child Profile" : "Add Child Profile";

  return (
    <div className="modal-backdrop parent-profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal-card manager-profile-modal parent-child-modal" role="dialog" aria-modal="true" aria-label={modalTitle} onSubmit={onSubmit}>
        <header className="student-modal-head">
          <div>
            <h2>{modalTitle}</h2>
            <p>Keep each child profile clear for parent-supervised student access.</p>
          </div>
          <button className="student-modal-close" type="button" aria-label={`Close ${modalTitle}`} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <section className="student-form-section manager-profile-form-section">
          <label className="field-label">
            Child name
            <input data-parent-tutorial-target="child-name" className="input" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Mina Cho" />
          </label>
          <label className="field-label">
            Child age
            <input data-parent-tutorial-target="child-age" className="input" inputMode="numeric" value={form.age} onChange={(event) => onChange({ ...form, age: event.target.value })} placeholder="8" />
          </label>
          <label className="field-label">
            Child username
            <input data-parent-tutorial-target="child-username" className="input" autoComplete="username" value={form.username} onChange={(event) => onChange({ ...form, username: event.target.value })} placeholder={childUsernameFromName(form.name)} />
          </label>
          <label className="field-label">
            Child password
            <input data-parent-tutorial-target="child-password" className="input" type="password" autoComplete="new-password" value={form.password} onChange={(event) => onChange({ ...form, password: event.target.value })} placeholder="Create a password" />
          </label>
          <label className="field-label">
            Current belt
            <select
              data-parent-tutorial-target="child-belt"
              className="input"
              value={form.beltSlug}
              onClick={onBeltInteract}
              onFocus={onBeltInteract}
              onChange={(event) => {
                onChange({ ...form, beltSlug: event.target.value });
                onBeltInteract();
              }}
            >
              {beltOptions.map((belt) => (
                <option key={belt} value={belt.toLowerCase().replace(/\s+/g, "-")}>
                  {belt}
                </option>
              ))}
            </select>
          </label>
        </section>
        <div className="student-editor-actions manager-profile-actions">
          <button data-parent-tutorial-target="save-child" type="submit">
            <CheckCircle2 size={18} /> Save Child Profile
          </button>
        </div>
      </form>
    </div>
  );
}

function ParentFirstChildTutorialOverlay({
  createdChild,
  onBack,
  onFinish,
  onOpenChildSide,
  onSkip,
  stepId,
  targetPosition
}: {
  createdChild?: ChildAccount;
  onBack: () => void;
  onFinish: () => void;
  onOpenChildSide?: () => void;
  onSkip: () => void;
  stepId: ParentTutorialStepId;
  targetPosition: ParentTutorialTargetPosition | null;
}) {
  const step = parentTutorialSteps[stepId];
  const stepIndex = parentTutorialStepOrder.indexOf(stepId);
  const isFirstStep = stepIndex <= 0;
  const isFinalStep = stepId === "created-child";
  const spotlightStyle = targetPosition
    ? ({
        "--parent-tutorial-top": `${targetPosition.spotlight.top}px`,
        "--parent-tutorial-left": `${targetPosition.spotlight.left}px`,
        "--parent-tutorial-width": `${targetPosition.spotlight.width}px`,
        "--parent-tutorial-height": `${targetPosition.spotlight.height}px`
      } as CSSProperties)
    : undefined;
  const coachStyle = targetPosition
    ? ({
        "--parent-tutorial-coach-top": `${targetPosition.coach.top}px`,
        "--parent-tutorial-coach-left": `${targetPosition.coach.left}px`,
        "--parent-tutorial-coach-width": `${targetPosition.coach.width}px`
      } as CSSProperties)
    : undefined;

  return (
    <div className="parent-tutorial-layer" aria-live="polite">
      {targetPosition && <div className="parent-tutorial-spotlight" style={spotlightStyle} aria-hidden="true" />}
      <section
        className={`parent-tutorial-coach parent-tutorial-coach--${targetPosition?.placement ?? "center"}`}
        role="region"
        aria-label="Parent first child tutorial"
        style={coachStyle}
      >
        <p>Step {stepIndex + 1} of {parentTutorialStepOrder.length}</p>
        <h2>{step.title}</h2>
        <span>{step.detail}</span>
        <div className="parent-tutorial-actions">
          {!isFirstStep && !isFinalStep && (
            <button type="button" onClick={onBack}>
              Back
            </button>
          )}
          {isFinalStep ? (
            <>
              {createdChild && onOpenChildSide && (
                <button className="parent-tutorial-open-child" type="button" onClick={onOpenChildSide}>
                  Open {createdChild.name}&apos;s Student Side
                </button>
              )}
              <button className="parent-tutorial-finish" type="button" onClick={onFinish}>
                Finish
              </button>
            </>
          ) : (
            <button type="button" onClick={onSkip}>
              Skip tutorial
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function ParentChildHandoffPrompt({
  child,
  onDismiss,
  onOpenChildSide
}: {
  child: ChildAccount;
  onDismiss: () => void;
  onOpenChildSide: () => void;
}) {
  return (
    <section className="parent-child-handoff" role="region" aria-label="Child account handoff">
      <span className="parent-child-handoff-icon" aria-hidden="true">
        <CheckCircle2 size={22} />
      </span>
      <div>
        <p>Child account created</p>
        <h3>{child.name} is ready to use the student side.</h3>
        <span>Use the saved username and password later, or open the child app view now.</span>
      </div>
      <div className="parent-child-handoff-actions">
        <button className="parent-child-handoff-primary" type="button" onClick={onOpenChildSide}>
          Open {child.name}&apos;s Student Side
        </button>
        <button type="button" onClick={onDismiss}>
          Stay on Parent Profile
        </button>
      </div>
    </section>
  );
}

function ParentProfilePage() {
  const { addChildAccount, childUsernameExists, directMessages, guardianChildren, loginChildAccount, logout, scheduledClasses, session, showToast, studioClasses, studioEvents, updateChildAccount } = useAppState();
  const [activeTab, setActiveTab] = useState<ParentProfileTab>("dashboard");
  const [selectedChildId, setSelectedChildId] = useState(() => guardianChildren[0]?.id ?? "");
  const [childModalMode, setChildModalMode] = useState<"add" | "edit" | null>(null);
  const [editingChildId, setEditingChildId] = useState("");
  const [childForm, setChildForm] = useState({ name: "", age: "", beltSlug: "white", username: "", password: "" });
  const [childHandoffId, setChildHandoffId] = useState("");
  const [parentMessageNotificationSettings, setParentMessageNotificationSettings] = useState(() => readHomeMessageNotificationSettings(session?.email));
  const [parentNotificationPermission, setParentNotificationPermission] = useState(() => getBrowserNotificationPermission());
  const [parentWebPushPublicKey, setParentWebPushPublicKey] = useState(() => parentMessageNotificationSettings.pushPublicKey ?? "");
  const [parentPushServerEndpoint, setParentPushServerEndpoint] = useState(() => readPushServerEndpoint());
  const [isParentPushSubscribing, setIsParentPushSubscribing] = useState(false);
  const [isParentPushSubscriptionSyncing, setIsParentPushSubscriptionSyncing] = useState(false);
  const [parentProfileOpen, setParentProfileOpen] = useState(false);
  const [parentTheme, setParentTheme] = useState<AppThemeMode>(() => readStoredAppTheme());
  const [tutorialStepId, setTutorialStepId] = useState<ParentTutorialStepId | null>(null);
  const [tutorialFinishedChildId, setTutorialFinishedChildId] = useState("");
  const [tutorialTargetPosition, setTutorialTargetPosition] = useState<ParentTutorialTargetPosition | null>(null);
  const tutorialStorageKey = useMemo(() => parentTutorialStorageKey(session?.email), [session?.email]);
  const selectedChild = guardianChildren.find((child) => child.id === selectedChildId) ?? guardianChildren[0];
  const childHandoff = guardianChildren.find((child) => child.id === childHandoffId);
  const tutorialFinishedChild = guardianChildren.find((child) => child.id === tutorialFinishedChildId);
  const parentDirectMessageThreads = useMemo(
    () => buildParentDirectMessageFeedThreads(directMessages, selectedChild),
    [directMessages, selectedChild]
  );
  const latestUnreadParentDirectThread = useMemo(
    () => sortHomeFeedThreads(parentDirectMessageThreads).find((thread) => thread.source === "direct" && thread.unread),
    [parentDirectMessageThreads]
  );
  const messageCount = studentHomeThreads.filter((thread) => thread.kind === "message").length + parentDirectMessageThreads.length;
  const notificationCount = studentHomeThreads.filter((thread) => thread.kind === "event").length + studioEvents.length;
  const parentNotificationPermissionLabel = parentNotificationPermission === "unsupported" ? "Unavailable" : parentNotificationPermission;
  const parentDeviceNotificationsReady = parentMessageNotificationSettings.browserNotificationsEnabled && parentNotificationPermission === "granted";
  const parentPushSubscriptionReady = Boolean(parentMessageNotificationSettings.pushSubscriptionEndpoint?.trim());
  const tutorialActive = tutorialStepId !== null;
  const parentColorPreview: ProfileColorPreviewData = {
    kind: "parent",
    title: "Parent Profile",
    displayName: "Family Profile",
    roleLabel: guardianChildren.length
      ? `${guardianChildren.length} child profile${guardianChildren.length === 1 ? "" : "s"} connected to this parent login.`
      : "Create the first child profile to unlock student tools.",
    avatarText: "P",
    facts: [],
    counts: [
      { label: "Child Profiles", value: guardianChildren.length },
      { label: "Messages", value: messageCount, tone: "message" },
      { label: "Notifications", value: notificationCount, tone: "event" }
    ],
    children: guardianChildren.map((child) => ({
      id: child.id,
      name: child.name,
      initials: childInitials(child.name),
      meta: `${child.age ? `Age ${child.age}` : "Age not set"} - ${childBeltLabel(child.beltSlug)} Belt`,
      selected: child.id === selectedChild?.id
    })),
    selectedChildLabel: selectedChild
      ? `${selectedChild.age ? `Age ${selectedChild.age}` : "Age not set"} - ${childBeltLabel(selectedChild.beltSlug)} Belt`
      : "Add a child profile to unlock student tools."
  };

  useEffect(() => {
    if (!guardianChildren.length) {
      setSelectedChildId("");
      return;
    }
    if (!guardianChildren.some((child) => child.id === selectedChildId)) {
      setSelectedChildId(guardianChildren[0].id);
    }
  }, [guardianChildren, selectedChildId]);

  const updateParentMessageNotificationSettings = useCallback(
    (settings: Partial<MessageNotificationSettings>) => {
      setParentMessageNotificationSettings((currentSettings) => {
        const nextSettings: MessageNotificationSettings = {
          ...currentSettings,
          ...settings,
          updatedAt: new Date().toISOString()
        };
        writeHomeMessageNotificationSettings(session?.email, nextSettings);
        return nextSettings;
      });
    },
    [session?.email]
  );

  useEffect(() => {
    setParentMessageNotificationSettings(readHomeMessageNotificationSettings(session?.email));
    setParentNotificationPermission(getBrowserNotificationPermission());
  }, [session?.email]);

  useEffect(() => {
    setParentWebPushPublicKey(parentMessageNotificationSettings.pushPublicKey ?? "");
  }, [parentMessageNotificationSettings.pushPublicKey]);

  useEffect(() => {
    const thread = latestUnreadParentDirectThread;
    if (!parentDeviceNotificationsReady || !thread) return;
    const lastNotifiedAt = parentMessageNotificationSettings.lastBrowserNotifiedDirectMessageAt?.trim() ?? "";
    if (lastNotifiedAt && thread.sentDateTime <= lastNotifiedAt) return;
    const notificationTitle = `New family message from ${thread.sender.trim() || "Cho's staff"}`;
    const notificationOptions: NotificationOptions = {
      body: thread.body ?? thread.preview,
      tag: `chos-parent-${thread.id}`,
      icon: publicAsset("682e95109aa21_chos-logo.png"),
      badge: publicAsset("682e95109aa21_chos-logo.png"),
      data: {
        url: appHomeNotificationUrl(),
        threadId: thread.id
      }
    };
    void showDirectMessageBrowserNotification(notificationTitle, notificationOptions)
      .then((sent) => {
        if (sent) updateParentMessageNotificationSettings({ lastBrowserNotifiedDirectMessageAt: thread.sentDateTime });
      })
      .catch(() => undefined);
  }, [
    latestUnreadParentDirectThread,
    parentDeviceNotificationsReady,
    parentMessageNotificationSettings.lastBrowserNotifiedDirectMessageAt,
    updateParentMessageNotificationSettings
  ]);

  useEffect(() => {
    if (guardianChildren.length || tutorialActive || readParentTutorialCompletion(tutorialStorageKey)) return;
    setTutorialFinishedChildId("");
    setTutorialStepId("add-child");
  }, [guardianChildren.length, tutorialActive, tutorialStorageKey]);

  useEffect(() => {
    if (!tutorialStepId) {
      setTutorialTargetPosition(null);
      return;
    }

    let frameId = 0;
    let timeoutId = 0;
    const cancelScheduledMeasure = () => {
      if (frameId && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      frameId = 0;
      timeoutId = 0;
    };
    const scheduleMeasure = () => {
      cancelScheduledMeasure();
      const measure = () => {
        const target = document.querySelector<HTMLElement>(`[data-parent-tutorial-target="${parentTutorialSteps[tutorialStepId].target}"]`);
        if (!target) {
          setTutorialTargetPosition(null);
          return;
        }
        if (typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ block: "center", inline: "nearest" });
        }
        const rect = target.getBoundingClientRect();
        const spotlightPadding = 10;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
        const spotlight = {
          top: clampNumber(rect.top - spotlightPadding, 8, Math.max(8, viewportHeight - 52)),
          left: clampNumber(rect.left - spotlightPadding, 8, Math.max(8, viewportWidth - 52)),
          width: Math.max(rect.width + spotlightPadding * 2, 52),
          height: Math.max(rect.height + spotlightPadding * 2, 52)
        };
        const coachWidth = Math.min(380, Math.max(280, viewportWidth - 28));
        const coachHeight = 210;
        const hasRoomBelow = spotlight.top + spotlight.height + coachHeight + 28 < viewportHeight;
        const placement = hasRoomBelow || spotlight.top < coachHeight + 34 ? "below" : "above";
        const coachTop = placement === "below"
          ? clampNumber(spotlight.top + spotlight.height + 14, 14, Math.max(14, viewportHeight - coachHeight - 14))
          : clampNumber(spotlight.top - coachHeight - 14, 14, Math.max(14, viewportHeight - coachHeight - 14));
        const coachLeft = clampNumber(spotlight.left + spotlight.width / 2 - coachWidth / 2, 14, Math.max(14, viewportWidth - coachWidth - 14));
        setTutorialTargetPosition({
          spotlight,
          coach: { top: coachTop, left: coachLeft, width: coachWidth, height: coachHeight },
          placement
        });
      };

      if (typeof window.requestAnimationFrame === "function") {
        frameId = window.requestAnimationFrame(measure);
        return;
      }
      timeoutId = window.setTimeout(measure, 0);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    return () => {
      cancelScheduledMeasure();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [childModalMode, guardianChildren.length, selectedChildId, tutorialFinishedChildId, tutorialStepId]);

  const advanceTutorialFrom = (stepId: ParentTutorialStepId) => {
    setTutorialStepId((currentStepId) => (currentStepId === stepId ? getNextParentTutorialStep(stepId) : currentStepId));
  };

  const skipParentTutorial = () => {
    writeParentTutorialCompletion(tutorialStorageKey, "skipped");
    setTutorialStepId(null);
    setTutorialTargetPosition(null);
  };

  const finishParentTutorial = () => {
    writeParentTutorialCompletion(tutorialStorageKey, "completed");
    setTutorialStepId(null);
    setTutorialTargetPosition(null);
  };

  const openChildSide = (childId: string) => {
    writeParentTutorialCompletion(tutorialStorageKey, "completed");
    setTutorialStepId(null);
    setTutorialTargetPosition(null);
    setChildHandoffId("");
    loginChildAccount(childId);
  };

  const goBackParentTutorial = () => {
    if (!tutorialStepId) return;
    const currentIndex = parentTutorialStepOrder.indexOf(tutorialStepId);
    const previousStepId = parentTutorialStepOrder[Math.max(currentIndex - 1, 0)];
    if (tutorialStepId === "child-name") {
      setChildModalMode(null);
      setEditingChildId("");
    }
    setTutorialStepId(previousStepId);
  };

  const openAddChild = () => {
    setChildForm({ name: "", age: "", beltSlug: "white", username: "", password: "" });
    setEditingChildId("");
    setChildModalMode("add");
    advanceTutorialFrom("add-child");
  };

  const openParentProfileSettings = () => {
    setParentTheme(readStoredAppTheme());
    setParentProfileOpen(true);
  };

  const enableParentMessageNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      updateParentMessageNotificationSettings({
        browserNotificationsEnabled: false,
        browserPermission: "unsupported"
      });
      setParentNotificationPermission("unsupported");
      showToast("Device notifications are unavailable in this browser.");
      return;
    }
    const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
    setParentNotificationPermission(permission);
    updateParentMessageNotificationSettings({
      browserNotificationsEnabled: permission === "granted",
      browserPermission: permission
    });
    showToast(permission === "granted" ? "Device notifications enabled for parent app messages." : "Device notifications were not enabled.");
  };

  const sendParentTestNotification = async () => {
    if (!parentDeviceNotificationsReady) {
      showToast("Enable parent message notifications before sending a test.");
      return;
    }
    const sent = await showDirectMessageBrowserNotification("Cho's parent test notification", {
      body: "Device notifications are ready for messages in your Parent Profile.",
      tag: "chos-parent-test-notification",
      icon: publicAsset("682e95109aa21_chos-logo.png"),
      badge: publicAsset("682e95109aa21_chos-logo.png"),
      data: {
        url: appHomeNotificationUrl()
      }
    });
    showToast(sent ? "Parent device notification sent." : "Parent device notification could not be shown.");
  };

  const updateParentPushServerEndpoint = (value: string) => {
    setParentPushServerEndpoint(value);
    writePushServerEndpoint(value);
  };

  const connectParentDevicePush = async () => {
    const applicationServerKey = webPushPublicKeyToBytes(parentWebPushPublicKey);
    if (!applicationServerKey) {
      showToast("Enter a valid parent Web Push public key.");
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window) || !window.Notification.requestPermission || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      updateParentMessageNotificationSettings({ browserPermission: "unsupported" });
      setParentNotificationPermission("unsupported");
      showToast("Parent Web Push subscriptions are unavailable in this browser.");
      return;
    }
    setIsParentPushSubscribing(true);
    try {
      const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
      setParentNotificationPermission(permission);
      if (permission !== "granted") {
        updateParentMessageNotificationSettings({
          browserNotificationsEnabled: false,
          browserPermission: permission
        });
        showToast("Parent push notifications were not enabled.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager || typeof registration.pushManager.subscribe !== "function") {
        showToast("Parent Web Push subscriptions are unavailable in this browser.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      updateParentMessageNotificationSettings(buildWebPushSubscriptionSettings(parentWebPushPublicKey, subscription));
      showToast("Parent push subscription ready for private server sync.");
    } catch {
      showToast("Parent push subscription failed.");
    } finally {
      setIsParentPushSubscribing(false);
    }
  };

  const syncParentPushSubscription = async () => {
    const endpoint = parentPushServerEndpoint.trim();
    if (!endpoint) {
      showToast("Enter a parent private push server URL.");
      return;
    }
    const payload = buildWebPushSubscriptionPayload(parentMessageNotificationSettings, session, "guardian", appHomeNotificationUrl());
    if (!payload) {
      showToast("Connect the parent device to Web Push before syncing.");
      return;
    }
    setIsParentPushSubscriptionSyncing(true);
    try {
      const response = await window.fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        showToast(`Parent push subscription sync failed with HTTP ${response.status}.`);
        return;
      }
      showToast("Parent push subscription synced to private server.");
    } catch {
      showToast("Parent push subscription sync failed.");
    } finally {
      setIsParentPushSubscriptionSyncing(false);
    }
  };

  const saveParentProfileSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyAppTheme(parentTheme);
    writeStoredAppTheme(parentTheme);
    setParentProfileOpen(false);
    showToast("Parent profile settings saved.");
  };

  const openEditChild = (child: ChildAccount) => {
    setChildForm({ name: child.name, age: child.age, beltSlug: child.beltSlug, username: child.username, password: child.password ?? "" });
    setEditingChildId(child.id);
    setChildModalMode("edit");
  };

  const closeChildModal = (options?: { preserveTutorialStep?: boolean }) => {
    setChildModalMode(null);
    setEditingChildId("");
    if (!options?.preserveTutorialStep && isParentTutorialModalStep(tutorialStepId)) {
      setTutorialStepId("add-child");
    }
  };

  const updateChildForm = (nextForm: { name: string; age: string; beltSlug: string; username: string; password: string }) => {
    setChildForm(nextForm);
    if (nextForm.name.trim()) {
      advanceTutorialFrom("child-name");
    }
    if (nextForm.age.trim()) {
      advanceTutorialFrom("child-age");
    }
    if (nextForm.username.trim()) {
      advanceTutorialFrom("child-username");
    }
    if (nextForm.password.trim()) {
      advanceTutorialFrom("child-password");
    }
  };

  const handleBeltTutorialInteraction = () => {
    advanceTutorialFrom("child-belt");
  };

  const saveChildProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = normalizeChildUsername(childForm.username);
    const isFirstChildCreation = childModalMode === "add" && guardianChildren.length === 0;
    if (!childForm.name.trim()) {
      if (tutorialActive && childModalMode === "add") {
        setTutorialStepId("child-name");
      }
      showToast("Enter a child name.");
      return;
    }
    if (!normalizedUsername) {
      if (tutorialActive && childModalMode === "add") {
        setTutorialStepId("child-username");
      }
      showToast("Enter a child username.");
      return;
    }
    if (childModalMode === "add" && !childForm.password.trim()) {
      if (tutorialActive) {
        setTutorialStepId("child-password");
      }
      showToast("Create a child password.");
      return;
    }
    if (childUsernameExists(normalizedUsername, { excludeChildId: childModalMode === "edit" ? editingChildId : undefined })) {
      if (tutorialActive && childModalMode === "add") {
        setTutorialStepId("child-username");
      }
      showToast("That child username is already used.");
      return;
    }
    const savedChild = childModalMode === "edit" && editingChildId ? updateChildAccount(editingChildId, childForm) : addChildAccount(childForm);
    if (!savedChild) {
      if (tutorialActive && childModalMode === "add") {
        setTutorialStepId("child-name");
      }
      showToast("Enter a child name.");
      return;
    }
    setSelectedChildId(savedChild.id);
    setChildHandoffId(isFirstChildCreation ? savedChild.id : "");
    closeChildModal({ preserveTutorialStep: true });
    if (tutorialActive && childModalMode === "add") {
      setTutorialFinishedChildId(savedChild.id);
      setTutorialStepId("created-child");
    }
    showToast(`${savedChild.name} child profile saved.`);
  };

  return (
    <section className="manager-home-page parent-profile-page" aria-label="Parent profile page">
      <header className="manager-home-profile-title manager-page-title-bar" aria-label="Parent profile page header">
        <ManagerPageTitleFrame title="Parent Profile" className="manager-home-profile-title-frame" />
        <nav className="manager-home-top-actions" aria-label="Parent profile quick actions">
          <button className="manager-home-top-action parent-profile-settings-action" type="button" aria-label="Profile Settings" onClick={openParentProfileSettings}>
            <img className="manager-home-panel-icon" src={managerProfileSettingsIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Settings</span>
          </button>
          <button data-parent-tutorial-target="add-child" className="manager-home-top-action parent-profile-add-action" type="button" aria-label="Add Child Profile" onClick={openAddChild}>
            <Plus size={28} aria-hidden="true" />
            <span className="manager-home-top-action-label">Add Child</span>
          </button>
          <button className="manager-home-top-action manager-home-logout-button" type="button" aria-label="Log Out" onClick={logout}>
            <img className="manager-home-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Log Out</span>
          </button>
        </nav>
      </header>

      <main className="parent-profile-shell">
        <section className="parent-profile-overview" aria-label="Parent family overview">
          <article className="parent-family-card">
            <div>
              <p>Family Profile</p>
              <h2>Manage every child from one parent page.</h2>
              <span>Built for parents with younger students or multiple children in class.</span>
            </div>
            <div className="parent-family-stats" aria-label="Parent family totals">
              <span><strong>{guardianChildren.length}</strong> Child Profiles</span>
              <span><strong>{messageCount}</strong> Messages</span>
              <span><strong>{notificationCount}</strong> Notifications</span>
            </div>
          </article>

          <section className="parent-child-profiles" aria-label="Parent child profiles">
            <div className="parent-section-head">
              <div>
                <h2>Kids Profiles</h2>
                <p>Create, select, and edit each child before opening their student tools.</p>
              </div>
              <button type="button" onClick={openAddChild}>
                <Plus size={18} /> Add Child
              </button>
            </div>
            <div className="parent-child-list">
              {guardianChildren.length ? (
                guardianChildren.map((child) => {
                  const isSelected = child.id === selectedChild?.id;
                  return (
                    <article
                      aria-label={`${child.name} profile card`}
                      className={`parent-child-card${isSelected ? " is-selected" : ""}`}
                      data-parent-tutorial-target={child.id === tutorialFinishedChildId ? "created-child" : undefined}
                      key={child.id}
                      onClick={() => setSelectedChildId(child.id)}
                      role="group"
                    >
                      <button type="button" aria-label={`Select ${child.name} profile`} aria-pressed={isSelected} onClick={() => setSelectedChildId(child.id)}>
                        <span className="parent-child-avatar" aria-hidden="true">{childInitials(child.name)}</span>
                        <span>
                          <strong>{child.name}</strong>
                          <small>{child.age ? `Age ${child.age}` : "Age not set"} - {childBeltLabel(child.beltSlug)} Belt</small>
                        </span>
                      </button>
                      <button
                        className="parent-child-edit"
                        type="button"
                        aria-label={`Edit ${child.name} profile`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditChild(child);
                        }}
                      >
                        Edit
                      </button>
                    </article>
                  );
                })
              ) : (
                <p className="parent-empty-note">No child profiles yet. Add the first student profile to begin.</p>
              )}
            </div>
          </section>
        </section>

        <section className="parent-selected-student" aria-label="Selected child workspace">
          <div className="parent-selected-head">
            <div>
              <span className="parent-child-avatar parent-child-avatar--large" aria-hidden="true">{selectedChild ? childInitials(selectedChild.name) : "P"}</span>
              <div>
                <p>Selected Student</p>
                <h2>{selectedChild?.name ?? "No child selected"}</h2>
                <span>{selectedChild ? `${selectedChild.age ? `Age ${selectedChild.age}` : "Age not set"} - ${childBeltLabel(selectedChild.beltSlug)} Belt` : "Add a child profile to unlock student tools."}</span>
              </div>
            </div>
            {selectedChild && (
              <button type="button" onClick={() => openEditChild(selectedChild)}>
                Edit Profile
              </button>
            )}
          </div>

          {childHandoff && (
            <ParentChildHandoffPrompt
              child={childHandoff}
              onDismiss={() => setChildHandoffId("")}
              onOpenChildSide={() => openChildSide(childHandoff.id)}
            />
          )}

          <nav className="parent-tool-tabs" aria-label="Parent student tools">
            {parentProfileTabs.map((tab) => (
              <button className={activeTab === tab.id ? "is-active" : ""} key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </nav>

          <ParentProfileTabContent
            activeTab={activeTab}
            directMessageThreads={parentDirectMessageThreads}
            isParentPushSubscribing={isParentPushSubscribing}
            isParentPushSubscriptionSyncing={isParentPushSubscriptionSyncing}
            onConnectParentDevicePush={connectParentDevicePush}
            onEnableParentMessageNotifications={enableParentMessageNotifications}
            onParentPushServerEndpointChange={updateParentPushServerEndpoint}
            onParentWebPushPublicKeyChange={setParentWebPushPublicKey}
            onSendParentTestNotification={sendParentTestNotification}
            onSyncParentPushSubscription={syncParentPushSubscription}
            parentDeviceNotificationsReady={parentDeviceNotificationsReady}
            parentNotificationPermissionLabel={parentNotificationPermissionLabel}
            parentPushServerEndpoint={parentPushServerEndpoint}
            parentPushSubscriptionReady={parentPushSubscriptionReady}
            parentWebPushPublicKey={parentWebPushPublicKey}
            selectedChild={selectedChild}
            scheduledClasses={scheduledClasses}
            studioClasses={studioClasses}
            studioEvents={studioEvents}
          />
        </section>
      </main>

      {parentProfileOpen && (
        <div className="modal-backdrop manager-profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setParentProfileOpen(false)}>
          <form className="modal-card manager-profile-modal parent-profile-settings-modal" role="dialog" aria-modal="true" aria-label="Parent profile settings" onSubmit={saveParentProfileSettings}>
            <header className="student-modal-head">
              <div>
                <h2>Profile Settings</h2>
                <p>Edit parent app theme and personal color settings.</p>
              </div>
              <button className="student-modal-close" type="button" aria-label="Close parent profile settings" onClick={() => setParentProfileOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <section className="student-form-section manager-profile-form-section parent-profile-settings-form">
              <div className="manager-profile-preferences">
                <div className="manager-theme-setting" role="group" aria-label="App theme">
                  <span>App Theme</span>
                  <div className="manager-theme-options">
                    <button
                      type="button"
                      className={`manager-theme-option${parentTheme === "light" ? " is-active" : ""}`}
                      aria-pressed={parentTheme === "light"}
                      onClick={() => setParentTheme("light")}
                    >
                      <Sun size={16} /> Light
                    </button>
                    <button
                      type="button"
                      className={`manager-theme-option${parentTheme === "dark" ? " is-active" : ""}`}
                      aria-pressed={parentTheme === "dark"}
                      onClick={() => setParentTheme("dark")}
                    >
                      <Moon size={16} /> Dark
                    </button>
                  </div>
                </div>
                <div className="manager-profile-check parent-profile-settings-note">
                  <Palette size={18} aria-hidden="true" />
                  <span>Saved colors apply only to this parent login.</span>
                </div>
              </div>
              <ProfileColorEditingTool sessionEmail={session?.email} showToast={showToast} preview={parentColorPreview} />
            </section>
            <div className="student-editor-actions manager-profile-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> Save Profile Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {childModalMode && (
        <ParentChildProfileModal
          form={childForm}
          mode={childModalMode}
          onBeltInteract={handleBeltTutorialInteraction}
          onChange={updateChildForm}
          onClose={() => closeChildModal()}
          onSubmit={saveChildProfile}
        />
      )}
      {tutorialStepId && (
        <ParentFirstChildTutorialOverlay
          createdChild={tutorialStepId === "created-child" ? tutorialFinishedChild : undefined}
          onBack={goBackParentTutorial}
          onFinish={finishParentTutorial}
          onOpenChildSide={tutorialFinishedChild ? () => openChildSide(tutorialFinishedChild.id) : undefined}
          onSkip={skipParentTutorial}
          stepId={tutorialStepId}
          targetPosition={tutorialTargetPosition}
        />
      )}
    </section>
  );
}

function ManagerHomePage() {
  const { addStudioEvent, currentManagedAccount, directMessages, logout, managerAccountAccess, scheduledClasses, sendDirectMessage, session, showToast, studioClasses, studioEvents, students } = useAppState();
  const today = useLiveCalendarDate();
  const isManagerOwner = managerAccountAccess.isManagerOwner;
  const readHomeProfile = isManagerOwner ? readManagerProfile : readStaffProfile;
  const writeHomeProfile = isManagerOwner ? writeManagerProfile : writeStaffProfile;
  const [managerProfile, setManagerProfile] = useState(() => readHomeProfile(session?.email));
  const profileTitle = isManagerOwner ? "Profile" : "Staff Profile";
  const panelLabel = isManagerOwner ? "Manager's Panel" : "Staff Panel";
  const roleLabel = isManagerOwner ? "Head Coach & Manager" : currentManagedAccount?.title?.trim() || "Staff Member";
  const profileKindLabel = isManagerOwner ? "manager" : "staff";
  const activeStudentCount = students.filter((student) => (student.status ?? "Active").toLowerCase() === "active").length;
  const memberSinceLabel = formatMonthYear(session?.createdAt);
  const defaultHomeScheduleDateKey = useMemo(
    () => findInitialHomeAgendaDate(today, scheduledClasses, studioClasses, studioEvents),
    [today, scheduledClasses, studioClasses, studioEvents]
  );
  const [homeScheduleWeekStartKey, setHomeScheduleWeekStartKey] = useState(() => toDateKey(weekDaysForDate(parseCalendarDate(defaultHomeScheduleDateKey))[0]));
  const [selectedHomeScheduleDateKey, setSelectedHomeScheduleDateKey] = useState(defaultHomeScheduleDateKey);
  const [manualFeedThreads, setManualFeedThreads] = useState(() => managerHomeThreads);
  const [readDirectThreadIds, setReadDirectThreadIds] = useState<Set<string>>(() => new Set());
  const [hiddenDirectThreadIds, setHiddenDirectThreadIds] = useState<Set<string>>(() => new Set());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedFeedThreadIds, setSelectedFeedThreadIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isFeedSearchOpen, setIsFeedSearchOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<ManagerHomeFeedFilter>("all");
  const [replyText, setReplyText] = useState("");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeKind, setComposeKind] = useState<ManagerComposeKind>("message");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAllUsers, setComposeAllUsers] = useState(false);
  const [composeSelectedRecipientIds, setComposeSelectedRecipientIds] = useState<Set<string>>(() => new Set());
  const [isComposeContactsOpen, setIsComposeContactsOpen] = useState(false);
  const [collapsedComposeRecipientRoles, setCollapsedComposeRecipientRoles] = useState<Set<ManagerComposeRecipientRole>>(() => new Set());
  const [composeRecipientQuery, setComposeRecipientQuery] = useState("");
  const [composeEventDate, setComposeEventDate] = useState(() => toDateKey(today));
  const [composeEventTime, setComposeEventTime] = useState("6:00 PM");
  const [overviewProgress, setOverviewProgress] = useState(1);
  const [overviewHeight, setOverviewHeight] = useState(0);
  const [isOverviewDragging, setIsOverviewDragging] = useState(false);
  const feedSearchInputRef = useRef<HTMLInputElement>(null);
  const overviewContentRef = useRef<HTMLElement>(null);
  const overviewHandleRef = useRef<HTMLButtonElement>(null);
  const overviewDragRef = useRef({
    hasMoved: false,
    ignoreClick: false,
    pointerId: null as number | null,
    startProgress: 1,
    startY: 0
  });
  const selectedFeedCount = selectedFeedThreadIds.size;
  const currentComposeStudents = useMemo(() => students.filter(isCurrentOperationsStudent), [students]);
  const directFeedThreads = useMemo(
    () => buildManagerDirectMessageFeedThreads(directMessages, currentComposeStudents, readDirectThreadIds, hiddenDirectThreadIds),
    [currentComposeStudents, directMessages, hiddenDirectThreadIds, readDirectThreadIds]
  );
  const feedThreads = useMemo(
    () => sortHomeFeedThreads([...directFeedThreads, ...manualFeedThreads]),
    [directFeedThreads, manualFeedThreads]
  );
  const messageCount = feedThreads.filter((thread) => thread.kind === "message").length;
  const eventCount = feedThreads.filter((thread) => thread.kind === "event").length;
  const composeRecipients = useMemo(
    () => [
      ...managerComposeStaffRecipients,
      ...currentComposeStudents.map(studentToComposeRecipient),
      ...currentComposeStudents.map(studentToParentComposeRecipient)
    ],
    [currentComposeStudents]
  );
  const visibleComposeRecipients = useMemo(() => {
    const query = composeRecipientQuery.trim().toLowerCase();
    return composeRecipients.filter((recipient) => {
      if (!query) return true;
      return `${recipient.name} ${recipient.subtitle} ${recipient.detail}`.toLowerCase().includes(query);
    });
  }, [composeRecipientQuery, composeRecipients]);
  const composeRecipientGroups = useMemo(
    () => managerComposeRecipientRoles.map((role) => ({
      role,
      title: composeRecipientGroupTitle(role),
      description: composeRecipientGroupDescription(role),
      recipients: visibleComposeRecipients.filter((recipient) => recipient.role === role)
    })),
    [visibleComposeRecipients]
  );
  const selectedComposeRecipientCount = composeAllUsers ? composeRecipients.length : composeSelectedRecipientIds.size;
  const composeRecipientSummaryItems = useMemo<ManagerComposeRecipientSummaryItem[]>(() => {
    if (composeAllUsers) {
      return [{
        id: "all-users",
        label: "All Users",
        detail: `${composeRecipients.length} contacts`,
        variant: "category"
      }];
    }

    return managerComposeRecipientRoles.flatMap((role): ManagerComposeRecipientSummaryItem[] => {
      const roleRecipients = composeRecipients.filter((recipient) => recipient.role === role);
      const selectedRoleRecipients = roleRecipients.filter((recipient) => composeSelectedRecipientIds.has(recipient.id));
      if (!selectedRoleRecipients.length) return [];

      if (selectedRoleRecipients.length === roleRecipients.length) {
        return [{
          id: `all-${role}`,
          label: `All ${composeRecipientGroupTitle(role)}`,
          detail: `${roleRecipients.length} ${roleRecipients.length === 1 ? "contact" : "contacts"}`,
          variant: "category" as const
        }];
      }

      return selectedRoleRecipients.map((recipient): ManagerComposeRecipientSummaryItem => ({
        id: recipient.id,
        label: recipient.name,
        detail: composeRecipientRoleLabel(recipient.role),
        variant: "person"
      }));
    });
  }, [composeAllUsers, composeRecipients, composeSelectedRecipientIds]);
  const visibleThreads = feedThreads.filter((thread) => {
    if (feedFilter !== "all" && thread.kind !== feedFilter) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${thread.kind} ${thread.sender} ${thread.title} ${thread.preview}`.toLowerCase().includes(query);
  });
  const visibleFeedSections = visibleThreads.reduce<{ date: string; threads: ManagerHomeThread[] }[]>((sections, thread) => {
    const currentSection = sections[sections.length - 1];
    if (currentSection?.date === thread.sentDate) {
      currentSection.threads.push(thread);
      return sections;
    }
    sections.push({ date: thread.sentDate, threads: [thread] });
    return sections;
  }, []);
  const homeScheduleWeekDays = useMemo(() => weekDaysForDate(parseCalendarDate(homeScheduleWeekStartKey)), [homeScheduleWeekStartKey]);
  const homeAgendaItems = useMemo(
    () => buildHomeAgendaItems(homeScheduleWeekDays, scheduledClasses, studioClasses, studioEvents),
    [homeScheduleWeekDays, scheduledClasses, studioClasses, studioEvents]
  );
  const homeAgendaItemsByDate = useMemo(
    () => homeAgendaItems.reduce<Record<string, ManagerHomeAgendaItem[]>>((groups, item) => {
      groups[item.date] = [...(groups[item.date] ?? []), item];
      return groups;
    }, {}),
    [homeAgendaItems]
  );
  const selectedHomeScheduleDate = parseCalendarDate(selectedHomeScheduleDateKey);
  const selectedHomeAgendaItems = homeAgendaItemsByDate[selectedHomeScheduleDateKey] ?? [];
  const isOverviewCollapsed = overviewProgress <= 0.01;
  const overviewStageState = isOverviewCollapsed ? "collapsed" : overviewProgress >= 0.99 ? "expanded" : "partial";
  const overviewStageStyle = {
    "--manager-home-overview-height": overviewHeight > 0 ? `${Math.round(overviewHeight * overviewProgress)}px` : "auto",
    "--manager-home-overview-progress": overviewProgress.toFixed(3)
  } as CSSProperties;

  useEffect(() => {
    const defaultWeekStart = weekDaysForDate(parseCalendarDate(defaultHomeScheduleDateKey))[0];
    setHomeScheduleWeekStartKey(toDateKey(defaultWeekStart));
    setSelectedHomeScheduleDateKey(defaultHomeScheduleDateKey);
  }, [defaultHomeScheduleDateKey]);

  useEffect(() => {
    const node = overviewContentRef.current;
    if (!node) return;

    const updateOverviewHeight = (entry?: ResizeObserverEntry) => {
      const borderBoxHeight = entry?.borderBoxSize?.[0]?.blockSize ?? 0;
      const measuredHeight =
        node.getBoundingClientRect().height ||
        borderBoxHeight ||
        node.offsetHeight ||
        node.scrollHeight ||
        entry?.contentRect.height ||
        0;
      setOverviewHeight(Math.ceil(measuredHeight + HOME_OVERVIEW_STAGE_VISUAL_BUFFER));
    };

    updateOverviewHeight();

    if (typeof ResizeObserver === "undefined") {
      const updateOverviewHeightFromWindow = () => updateOverviewHeight();
      window.addEventListener("resize", updateOverviewHeightFromWindow);
      return () => window.removeEventListener("resize", updateOverviewHeightFromWindow);
    }

    const observer = new ResizeObserver((entries) => updateOverviewHeight(entries[0]));

    observer.observe(node, { box: "border-box" });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setManagerProfile(readHomeProfile(session?.email));
  }, [readHomeProfile, session?.email]);

  useEffect(() => {
    if (isFeedSearchOpen) feedSearchInputRef.current?.focus();
  }, [isFeedSearchOpen]);

  useEffect(() => {
    if (!isComposeOpen) return;

    const closeComposeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isComposeContactsOpen) {
        setIsComposeContactsOpen(false);
        return;
      }
      if (event.key === "Escape") setIsComposeOpen(false);
    };

    window.addEventListener("keydown", closeComposeOnEscape);
    return () => window.removeEventListener("keydown", closeComposeOnEscape);
  }, [isComposeContactsOpen, isComposeOpen]);

  useEffect(() => {
    if (!isOverviewCollapsed) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && overviewContentRef.current?.contains(activeElement)) {
      overviewHandleRef.current?.focus();
    }
  }, [isOverviewCollapsed]);

  const updateOverviewProgress = (nextProgress: number) => {
    setOverviewProgress(clampHomeOverviewProgress(nextProgress));
  };

  const toggleHomeOverview = () => {
    updateOverviewProgress(overviewProgress > 0.5 ? 0 : 1);
  };

  const handleOverviewHandleClick = () => {
    if (overviewDragRef.current.ignoreClick) {
      overviewDragRef.current.ignoreClick = false;
      return;
    }

    toggleHomeOverview();
  };

  const handleOverviewHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateOverviewProgress(overviewProgress - HOME_OVERVIEW_KEYBOARD_STEP);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateOverviewProgress(overviewProgress + HOME_OVERVIEW_KEYBOARD_STEP);
    }
  };

  const handleOverviewHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    overviewDragRef.current.hasMoved = false;
    overviewDragRef.current.ignoreClick = false;
    overviewDragRef.current.pointerId = event.pointerId;
    overviewDragRef.current.startProgress = overviewProgress;
    overviewDragRef.current.startY = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleOverviewHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = overviewDragRef.current;
    if (dragState.pointerId !== event.pointerId || overviewHeight <= 0) return;

    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaY) >= HOME_OVERVIEW_DRAG_THRESHOLD) {
      dragState.hasMoved = true;
    }

    if (!dragState.hasMoved) return;

    setIsOverviewDragging(true);
    updateOverviewProgress(dragState.startProgress + deltaY / overviewHeight);
  };

  const finishOverviewHandlePointer = (event: ReactPointerEvent<HTMLButtonElement>, shouldToggleOnTap: boolean) => {
    const dragState = overviewDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragState.pointerId = null;
    dragState.ignoreClick = true;
    setIsOverviewDragging(false);

    if (shouldToggleOnTap && !dragState.hasMoved) {
      toggleHomeOverview();
    }
  };

  const changeManagerProfilePhoto = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast(`Choose an image file for the ${profileKindLabel} profile picture.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        showToast("Could not read that profile image.");
        return;
      }

      setManagerProfile((currentProfile) => {
        const nextProfile = { ...currentProfile, photoDataUrl: result };
        writeHomeProfile(nextProfile, session?.email);
        return nextProfile;
      });
      showToast(`${isManagerOwner ? "Manager" : "Staff"} profile picture updated.`);
    };
    reader.onerror = () => showToast("Could not read that profile image.");
    reader.readAsDataURL(file);
  };

  const shiftHomeScheduleWeek = (direction: number) => {
    const nextWeekStart = parseCalendarDate(homeScheduleWeekStartKey);
    nextWeekStart.setDate(nextWeekStart.getDate() + direction * 7);
    const nextWeekDays = weekDaysForDate(nextWeekStart);
    setHomeScheduleWeekStartKey(toDateKey(nextWeekDays[0]));
    setSelectedHomeScheduleDateKey(findBestHomeAgendaDateInWeek(nextWeekDays, scheduledClasses, studioClasses, studioEvents));
  };

  const toggleFeedThreadSelection = (threadId: string) => {
    setSelectedFeedThreadIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(threadId)) {
        nextIds.delete(threadId);
      } else {
        nextIds.add(threadId);
      }
      return nextIds;
    });
  };

  const changeFeedFilter = (nextFilter: ManagerHomeThread["kind"]) => {
    const resolvedFilter: ManagerHomeFeedFilter = feedFilter === nextFilter ? "all" : nextFilter;
    setFeedFilter(resolvedFilter);
    setSelectedFeedThreadIds(new Set<string>());
    setSelectedThreadId((currentThreadId) => {
      if (!currentThreadId || resolvedFilter === "all") return currentThreadId;
      const currentThread = feedThreads.find((thread) => thread.id === currentThreadId);
      return currentThread?.kind === resolvedFilter ? currentThreadId : null;
    });
  };

  const openFeedThread = (threadId: string) => {
    setSelectedThreadId((currentThreadId) => currentThreadId === threadId ? null : threadId);
    const selectedThread = feedThreads.find((thread) => thread.id === threadId);
    if (selectedThread?.source === "direct") {
      setReadDirectThreadIds((currentIds) => new Set(currentIds).add(threadId));
      return;
    }
    setManualFeedThreads((currentThreads) =>
      currentThreads.map((thread) => thread.id === threadId && thread.unread ? { ...thread, unread: false } : thread)
    );
  };

  const deleteSelectedFeedThreads = () => {
    if (!selectedFeedCount) return;
    const idsToDelete = selectedFeedThreadIds;
    setHiddenDirectThreadIds((currentIds) => {
      const nextIds = new Set(currentIds);
      feedThreads.forEach((thread) => {
        if (thread.source === "direct" && idsToDelete.has(thread.id)) nextIds.add(thread.id);
      });
      return nextIds;
    });
    setManualFeedThreads((currentThreads) => currentThreads.filter((thread) => !idsToDelete.has(thread.id)));
    setSelectedThreadId((currentThreadId) => currentThreadId && idsToDelete.has(currentThreadId) ? null : currentThreadId);
    setSelectedFeedThreadIds(new Set());
    showToast(`${selectedFeedCount} ${selectedFeedCount === 1 ? "item" : "items"} deleted from the Home Page feed.`);
  };

  const closeFeedSearch = () => {
    setSearchQuery("");
    setIsFeedSearchOpen(false);
  };

  const handleFeedSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      closeFeedSearch();
    }
  };

  const toggleManagerHomeTheme = () => {
    const nextTheme: AppThemeMode = managerProfile.theme === "dark" ? "light" : "dark";
    setManagerProfile((currentProfile) => {
      const nextProfile = { ...currentProfile, theme: nextTheme };
      writeHomeProfile(nextProfile, session?.email);
      return nextProfile;
    });
    writeStoredAppTheme(nextTheme);
  };

  const resetComposeForm = () => {
    setComposeKind("message");
    setComposeSubject("");
    setComposeBody("");
    setComposeAllUsers(false);
    setComposeSelectedRecipientIds(new Set());
    setIsComposeContactsOpen(false);
    setCollapsedComposeRecipientRoles(new Set());
    setComposeRecipientQuery("");
    setComposeEventDate(toDateKey(today));
    setComposeEventTime("6:00 PM");
  };

  const closeComposeDialog = () => {
    setIsComposeOpen(false);
    resetComposeForm();
  };

  const toggleComposeRecipient = (recipientId: string) => {
    setComposeSelectedRecipientIds((currentIds) => {
      const nextIds = new Set(composeAllUsers ? [] : currentIds);
      if (nextIds.has(recipientId)) {
        nextIds.delete(recipientId);
      } else {
        nextIds.add(recipientId);
      }
      return nextIds;
    });
    setComposeAllUsers(false);
  };

  const selectComposeRecipientGroup = (recipients: ManagerComposeRecipient[]) => {
    if (!recipients.length) return;

    setComposeSelectedRecipientIds((currentIds) => {
      const nextIds = new Set(composeAllUsers ? [] : currentIds);
      recipients.forEach((recipient) => nextIds.add(recipient.id));
      return nextIds;
    });
    setComposeAllUsers(false);
  };

  const getComposeRecipientsByRole = (role: ManagerComposeRecipientRole) => composeRecipients.filter((recipient) => recipient.role === role);

  const isComposeRecipientRoleOnlySelected = (role: ManagerComposeRecipientRole) => {
    if (composeAllUsers) return false;

    const roleRecipientIds = getComposeRecipientsByRole(role).map((recipient) => recipient.id);
    return roleRecipientIds.length > 0
      && composeSelectedRecipientIds.size === roleRecipientIds.length
      && roleRecipientIds.every((recipientId) => composeSelectedRecipientIds.has(recipientId));
  };

  const clearComposeRecipients = () => {
    setComposeAllUsers(false);
    setComposeSelectedRecipientIds(new Set());
  };

  const quickToggleComposeAllUsers = () => {
    if (composeAllUsers) {
      clearComposeRecipients();
      return;
    }

    setComposeAllUsers(true);
    setComposeSelectedRecipientIds(new Set());
  };

  const quickToggleComposeRecipientRole = (role: ManagerComposeRecipientRole) => {
    const roleRecipients = getComposeRecipientsByRole(role);
    if (!roleRecipients.length) return;

    if (isComposeRecipientRoleOnlySelected(role)) {
      clearComposeRecipients();
      return;
    }

    setComposeAllUsers(false);
    setComposeSelectedRecipientIds(new Set(roleRecipients.map((recipient) => recipient.id)));
  };

  const toggleComposeRecipientGroup = (role: ManagerComposeRecipientRole) => {
    setCollapsedComposeRecipientRoles((currentRoles) => {
      const nextRoles = new Set(currentRoles);
      if (nextRoles.has(role)) {
        nextRoles.delete(role);
      } else {
        nextRoles.add(role);
      }
      return nextRoles;
    });
  };

  const sendCompose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = composeSubject.trim();
    const body = composeBody.trim();
    const recipients = composeAllUsers ? composeRecipients : composeRecipients.filter((recipient) => composeSelectedRecipientIds.has(recipient.id));

    if (!subject || !body) {
      showToast("Enter a subject and message body.");
      return;
    }

    if (!recipients.length) {
      showToast("Choose at least one recipient.");
      return;
    }

    if (composeKind === "event" && (!composeEventDate || !composeEventTime.trim())) {
      showToast("Choose an event date and time.");
      return;
    }

    const timestamp = new Date();
    const sent = formatManagerComposeTimestamp(timestamp);
    const createdThread: ManagerHomeThread = {
      id: `compose-${composeKind}-${timestamp.getTime()}`,
      kind: composeKind,
      sender: "Cho's Manager",
      title: subject,
      preview: composeMessagePreview(body),
      sentDate: sent.sentDate,
      sentTime: sent.sentTime,
      sentDateTime: sent.sentDateTime,
      avatar: composeKind === "event" ? eventsLauncherIcon : messagesLauncherIcon,
      accent: composeKind === "event" ? "#ff7a1a" : "#7be4ff"
    };

    if (composeKind === "message") {
      recipients.forEach((recipient) => {
        sendDirectMessage({
          senderId: "direct-staff-seed",
          senderName: "Cho's Manager",
          recipientId: recipient.id,
          recipientName: recipient.name,
          body: `${subject}\n\n${body}`
        });
      });
    } else {
      addStudioEvent({
        title: subject,
        date: composeEventDate,
        time: composeEventTime,
        details: body,
        audience: composeAllUsers ? "public" : "students"
      });
    }

    setManualFeedThreads((currentThreads) => [createdThread, ...currentThreads]);
    setSelectedThreadId(createdThread.id);
    setSelectedFeedThreadIds(new Set());
    setFeedFilter("all");
    setSearchQuery("");
    setIsFeedSearchOpen(false);
    setIsComposeOpen(false);
    resetComposeForm();
    showToast(composeAllUsers ? "Compose sent to all users." : `Compose sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`);
  };

  const sendReply = () => {
    if (!replyText.trim()) {
      showToast("Write a reply before sending.");
      return;
    }
    const selectedThread = feedThreads.find((thread) => thread.id === selectedThreadId);
    if (selectedThread?.source === "direct" && selectedThread.replyRecipientId) {
      const sentMessage = sendDirectMessage({
        senderId: "direct-staff-seed",
        senderName: "Cho's Manager",
        recipientId: selectedThread.replyRecipientId,
        recipientName: selectedThread.replyRecipientName ?? selectedThread.sender,
        body: replyText
      });
      if (sentMessage) {
        showToast(`Reply sent to ${sentMessage.recipientName}.`);
        setReplyText("");
        return;
      }
      showToast("That app message thread is no longer available.");
      return;
    }
    showToast("Reply queued for the selected message.");
    setReplyText("");
  };

  return (
    <section className="manager-home-page" aria-label={isManagerOwner ? "Manager home page" : "Staff home page"}>
      <header className="manager-home-profile-title manager-page-title-bar" aria-label="Profile page header">
        <ManagerPageTitleFrame title={profileTitle} className="manager-home-profile-title-frame" />
        <nav className="manager-home-top-actions" aria-label="Profile quick actions">
          <Link className="manager-home-top-action manager-home-panel-link" to="/manager" aria-label={panelLabel}>
            <img className="manager-home-panel-icon" src={managerPageIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">{panelLabel}</span>
          </Link>
          <button className="manager-home-top-action manager-home-logout-button" type="button" aria-label="Log Out" onClick={logout}>
            <img className="manager-home-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Log Out</span>
          </button>
        </nav>
      </header>
      <main className="manager-home-shell">
        <div
          aria-hidden={isOverviewCollapsed}
          className={`manager-home-overview-stage${isOverviewCollapsed ? " is-collapsed" : ""}${isOverviewDragging ? " is-dragging" : ""}`}
          data-overview-progress={overviewProgress.toFixed(2)}
          data-overview-state={overviewStageState}
          style={overviewStageStyle}
        >
          <section className="manager-home-overview" aria-label={isManagerOwner ? "Manager home overview" : "Staff home overview"} ref={overviewContentRef}>
            <article className="manager-home-profile-card" aria-label={isManagerOwner ? "Manager profile overview" : "Staff profile overview"}>
            <Link className="manager-home-profile-settings-link" to="/manager?profile=settings" aria-label="Profile Settings">
              <img className="manager-home-profile-settings-icon" src={managerProfileSettingsIcon} alt="" draggable="false" />
            </Link>
            <button
              aria-checked={managerProfile.theme === "dark"}
              aria-label={managerProfile.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={`manager-home-profile-theme-toggle manager-home-profile-theme-toggle--${managerProfile.theme}`}
              onClick={toggleManagerHomeTheme}
              role="switch"
              type="button"
            >
              <span className="manager-home-profile-theme-icons" aria-hidden="true">
                <Sun size={15} />
                <Moon size={15} />
              </span>
              <span className="manager-home-profile-theme-thumb" aria-hidden="true">
                {managerProfile.theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
              </span>
            </button>
            <label className="manager-home-profile-frame manager-home-profile-upload">
                <span className="sr-only">Upload {profileKindLabel} profile picture</span>
                <input type="file" accept="image/*" aria-label={`Upload ${profileKindLabel} profile picture`} onChange={changeManagerProfilePhoto} />
                <img src={managerProfile.photoDataUrl ?? publicAsset("assets/CheetahProfilePic/Cheetah.png")} alt={`${managerProfile.name} profile portrait`} draggable="false" />
                <span className="manager-home-profile-change-badge" aria-hidden="true">
                  <Camera size={15} />
                </span>
              </label>
              <div className="manager-home-profile-copy">
                <h2>{managerProfile.name}</h2>
                <p>{roleLabel}</p>
              </div>
              <dl className="manager-home-profile-facts">
                <div>
                  <dt><Award size={20} /></dt>
                  <dd>Team: Summer Champions</dd>
                </div>
                <div>
                  <dt><Target size={20} /></dt>
                  <dd>Member Since: {memberSinceLabel}</dd>
                </div>
                <div>
                  <dt><Users size={20} /></dt>
                  <dd>Team Size: {activeStudentCount} Member{activeStudentCount === 1 ? "" : "s"}</dd>
                </div>
              </dl>
            </article>
            <section className="manager-home-week-card" aria-label="Weekly manager schedule">
              <header className="manager-home-week-nav">
                <button type="button" aria-label="Previous week" onClick={() => shiftHomeScheduleWeek(-1)}>
                  <ChevronLeft size={20} />
                </button>
                <h2>{formatWeekRange(homeScheduleWeekDays)}</h2>
                <button type="button" aria-label="Next week" onClick={() => shiftHomeScheduleWeek(1)}>
                  <ChevronRight size={20} />
                </button>
              </header>
              <div className="manager-home-week-days" aria-label="Week days">
                {homeScheduleWeekDays.map((day) => {
                  const dateKey = toDateKey(day);
                  const isSelected = dateKey === selectedHomeScheduleDateKey;
                  return (
                    <button
                      aria-label={`Select ${formatHomeScheduleDay(day)}`}
                      aria-pressed={isSelected}
                      className={isSelected ? "is-selected" : undefined}
                      key={dateKey}
                      onClick={() => setSelectedHomeScheduleDateKey(dateKey)}
                      type="button"
                    >
                      <span>{day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
                      <strong>{day.getDate()}</strong>
                    </button>
                  );
                })}
              </div>
              <section className="manager-home-agenda-card" aria-live="polite" aria-label="Selected day agenda">
                <h3>{formatHomeScheduleDay(selectedHomeScheduleDate)}</h3>
                <div className="manager-home-agenda-list">
                  {selectedHomeAgendaItems.length ? (
                    selectedHomeAgendaItems.slice(0, 5).map((item) => (
                      <article className={`manager-home-agenda-item manager-home-agenda-item--${item.kind}`} key={item.id}>
                        <time>{item.time}</time>
                        <span aria-hidden="true">
                          {item.kind === "event" ? <CalendarDays size={20} /> : item.kind === "class" ? <Users size={20} /> : <MessagesSquare size={20} />}
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.meta}</small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>No classes or events scheduled for this date.</p>
                  )}
                </div>
              </section>
            </section>
          </section>
        </div>
        <button
          aria-expanded={!isOverviewCollapsed}
          aria-label={isOverviewCollapsed ? "Expand manager overview" : "Collapse manager overview"}
          className={`manager-home-overview-handle${isOverviewCollapsed ? " is-collapsed" : ""}${isOverviewDragging ? " is-dragging" : ""}`}
          onClick={handleOverviewHandleClick}
          onKeyDown={handleOverviewHandleKeyDown}
          onPointerCancel={(event) => finishOverviewHandlePointer(event, false)}
          onPointerDown={handleOverviewHandlePointerDown}
          onPointerMove={handleOverviewHandlePointerMove}
          onPointerUp={(event) => finishOverviewHandlePointer(event, true)}
          ref={overviewHandleRef}
          type="button"
        >
          <span className="manager-home-overview-handle-bar" aria-hidden="true" />
        </button>
        <section className="manager-home-feed-panel" aria-label="Messages and event notifications">
          <div className="manager-home-feed-head">
            <div className="manager-home-feed-counts" aria-label="Feed totals">
              <button
                className={`manager-home-count manager-home-count--message${feedFilter === "message" ? " is-active" : ""}`}
                type="button"
                aria-pressed={feedFilter === "message"}
                aria-controls="manager-home-unified-feed"
                onClick={() => changeFeedFilter("message")}
              >
                {messageCount} {messageCount === 1 ? "Message" : "Messages"}
              </button>
              <button
                className={`manager-home-count manager-home-count--event${feedFilter === "event" ? " is-active" : ""}`}
                type="button"
                aria-pressed={feedFilter === "event"}
                aria-controls="manager-home-unified-feed"
                onClick={() => changeFeedFilter("event")}
              >
                {eventCount} Event {eventCount === 1 ? "Notification" : "Notifications"}
              </button>
              <button className="manager-home-compose" type="button" aria-label="Compose" onClick={() => setIsComposeOpen(true)}>
                <span>Compose</span>
                <Plus size={16} />
              </button>
              {selectedFeedCount > 0 && (
                <span className="manager-home-bulk-actions" aria-live="polite">
                  <strong>{selectedFeedCount} selected</strong>
                  <button type="button" aria-label="Delete selected" onClick={deleteSelectedFeedThreads}>
                    <Trash2 size={17} />
                    <span>Delete</span>
                  </button>
                </span>
              )}
            </div>
          </div>
          <div className={`manager-home-search-shell${isFeedSearchOpen ? " is-open" : ""}`}>
            {isFeedSearchOpen ? (
              <div className="manager-home-search" role="search">
                <Search size={22} aria-hidden="true" />
                <label className="sr-only" htmlFor="manager-home-feed-search">Search messages and event notifications</label>
                <input
                  aria-label="Search messages and event notifications"
                  id="manager-home-feed-search"
                  ref={feedSearchInputRef}
                  type="search"
                  placeholder="Search messages and event notifications..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={handleFeedSearchKeyDown}
                />
                <button className="manager-home-search-close" type="button" aria-label="Close search messages and event notifications" onClick={closeFeedSearch}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                className="manager-home-search-trigger"
                type="button"
                aria-label="Open search messages and event notifications"
                aria-controls="manager-home-feed-search"
                aria-expanded="false"
                onClick={() => setIsFeedSearchOpen(true)}
              >
                <Search size={24} />
              </button>
            )}
          </div>
          <div className="manager-home-unified-feed" id="manager-home-unified-feed" aria-label="Home message and notification feed">
            {visibleFeedSections.length ? (
              visibleFeedSections.map((section) => (
                <section className="manager-home-date-section" key={section.date} aria-label={`Messages and event notifications from ${section.date}`}>
                  <div className="manager-home-date-divider" role="separator" aria-label={`Messages and event notifications from ${section.date}`}>
                    <span>{section.date}</span>
                  </div>
                  {section.threads.map((thread) => {
                    const isSelected = thread.id === selectedThreadId;
                    const isBulkSelected = selectedFeedThreadIds.has(thread.id);
                    const isUnread = Boolean(thread.unread);
                    const kindLabel = thread.kind === "event" ? "Event Notification" : "Message";
                    const readStatusLabel = isUnread ? "Unread" : "Read";

                    return (
                      <article className={`manager-home-feed-item manager-home-feed-item--${thread.kind}${isUnread ? " is-unread" : " is-read"}${isSelected ? " is-selected" : ""}${isBulkSelected ? " is-bulk-selected" : ""}`} key={thread.id}>
                        <div className="manager-home-feed-row">
                          <button
                            className="manager-home-feed-button"
                            type="button"
                            aria-expanded={isSelected}
                            aria-controls={`manager-home-feed-detail-${thread.id}`}
                            onClick={() => openFeedThread(thread.id)}
                          >
                            <span className="manager-home-thread-avatar">
                              <img src={thread.avatar} alt="" draggable="false" />
                            </span>
                            <span className="manager-home-feed-copy">
                              <strong>{thread.sender}</strong>
                              <span className={`manager-home-read-status ${isUnread ? "is-unread" : "is-read"}`} aria-label={`${readStatusLabel} ${kindLabel.toLowerCase()}`}>
                                <span aria-hidden="true" />
                                <span>{readStatusLabel}</span>
                              </span>
                              <em>{kindLabel}</em>
                              <b>{thread.title}</b>
                              <small>{thread.preview}</small>
                              <time className="manager-home-inline-sent" dateTime={thread.sentDateTime} aria-label={`${thread.title} sent at ${thread.sentTime}`}>
                                {thread.sentTime}
                              </time>
                            </span>
                          </button>
                          <label className="manager-home-feed-check">
                            <span className="sr-only">Select {thread.title}</span>
                            <input
                              aria-label={`Select ${thread.title}`}
                              type="checkbox"
                              checked={isBulkSelected}
                              onChange={() => toggleFeedThreadSelection(thread.id)}
                            />
                            <span aria-hidden="true" />
                          </label>
                        </div>
                        {isSelected && (
                          <div className="manager-home-feed-detail" id={`manager-home-feed-detail-${thread.id}`} aria-label={`${thread.title} details`}>
                            <div className="manager-home-detail-title-row">
                              <span>{kindLabel}</span>
                              <time dateTime={thread.sentDateTime}>Sent {thread.sentDate} at {thread.sentTime}</time>
                            </div>
                            <h2>{thread.title}</h2>
                            <header>
                              <span className="manager-home-thread-avatar">
                                <img src={thread.avatar} alt="" draggable="false" />
                              </span>
                              <div>
                                <strong>{thread.sender}</strong>
                                <p>{thread.audienceLabel ?? (thread.kind === "event" ? "event notice to All Students, Coaches" : "message to All Students, Coaches")}</p>
                              </div>
                              <button type="button" aria-label="More message actions">
                                <MoreHorizontal size={20} />
                              </button>
                            </header>
                            <div className="manager-home-message-copy">
                              {thread.source === "direct" ? (
                                <p>{thread.body ?? thread.preview}</p>
                              ) : (
                                <>
                                  <p>Hello everyone,</p>
                                  <p>{thread.preview.replace("...", ".")} Please read the details carefully and reach out if you have any questions.</p>
                                </>
                              )}
                            </div>
                            {thread.kind === "event" && (
                              <section className="manager-home-event-card" aria-label="Event details">
                                <h3>Event Details</h3>
                                <p><CalendarDays size={18} /> <span>Date: July 25 - July 27, 2025</span></p>
                                <p><MapPin size={18} /> <span>Location: Grand Sports Arena, New York</span></p>
                                <p><Users size={18} /> <span>Participants: All registered students</span></p>
                                <p><CheckCircle2 size={18} /> <span>Check-in Time: 8:00 AM on July 25</span></p>
                              </section>
                            )}
                            <p>{thread.source === "direct" ? "Reply here to answer the student or family without leaving the Profile feed." : thread.kind === "event" ? "Make sure to arrive on time and bring all required gear. Let's make this a great event!" : "This message is ready for staff follow-up from the Home Page feed."}</p>
                            {thread.source !== "direct" && <p>Best regards,<br />{thread.sender}</p>}
                            <div className="manager-home-reply">
                              <input
                                aria-label="Write a reply"
                                placeholder="Write a reply..."
                                value={replyText}
                                onChange={(event) => setReplyText(event.target.value)}
                              />
                              <button type="button" onClick={sendReply}>
                                <Send size={20} /> Reply
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              ))
            ) : (
              <p className="manager-home-empty">No messages or event notifications match your search.</p>
            )}
          </div>
        </section>
        {isComposeOpen && (
          <div
            className="manager-compose-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeComposeDialog();
            }}
          >
            <form
              className="manager-compose-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="manager-compose-title"
              onSubmit={sendCompose}
            >
              <header className="manager-compose-head">
                <div>
                  <p>Manager message center</p>
                  <h2 id="manager-compose-title">Compose</h2>
                </div>
                <button className="manager-compose-close" type="button" aria-label="Close compose" onClick={closeComposeDialog}>
                  <X size={20} />
                </button>
              </header>

              <div className="manager-compose-mode" aria-label="Compose type">
                <label className={composeKind === "message" ? "is-selected" : undefined}>
                  <input
                    type="radio"
                    name="manager-compose-kind"
                    checked={composeKind === "message"}
                    onChange={() => setComposeKind("message")}
                  />
                  <span><Mail size={18} /> Contact Message</span>
                </label>
                <label className={composeKind === "event" ? "is-selected" : undefined}>
                  <input
                    type="radio"
                    name="manager-compose-kind"
                    checked={composeKind === "event"}
                    onChange={() => setComposeKind("event")}
                  />
                  <span><CalendarDays size={18} /> Event Notification</span>
                </label>
              </div>

              <div className="manager-compose-layout">
                <section className="manager-compose-message-card" aria-label="Compose message">
                  <label className="manager-compose-field">
                    <span>Subject</span>
                    <input
                      aria-label="Subject"
                      value={composeSubject}
                      onChange={(event) => setComposeSubject(event.target.value)}
                      placeholder={composeKind === "event" ? "Event notice title" : "Message subject"}
                    />
                  </label>
                  <label className="manager-compose-field manager-compose-field--body">
                    <span>Message body</span>
                    <textarea
                      aria-label="Message body"
                      value={composeBody}
                      onChange={(event) => setComposeBody(event.target.value)}
                      placeholder="Write the message..."
                      rows={5}
                    />
                  </label>
                  {composeKind === "event" && (
                    <div className="manager-compose-event-fields">
                      <label className="manager-compose-field">
                        <span>Event date</span>
                        <input
                          aria-label="Event date"
                          type="date"
                          value={composeEventDate}
                          onChange={(event) => setComposeEventDate(event.target.value)}
                        />
                      </label>
                      <label className="manager-compose-field">
                        <span>Event time</span>
                        <input
                          aria-label="Event time"
                          value={composeEventTime}
                          onChange={(event) => setComposeEventTime(event.target.value)}
                          placeholder="6:00 PM"
                        />
                      </label>
                    </div>
                  )}
                </section>

                <section className="manager-compose-recipients" aria-label="Compose recipients">
                  <div className="manager-compose-recipient-toolbar">
                    <div className="manager-compose-recipient-title">
                      <span>Recipients</span>
                      <strong>{selectedComposeRecipientCount} selected</strong>
                    </div>
                    <button
                      className="manager-compose-contacts-toggle"
                      type="button"
                      aria-expanded={isComposeContactsOpen}
                      aria-controls="manager-compose-contacts-dialog"
                      onClick={() => setIsComposeContactsOpen(true)}
                    >
                      <Users size={16} />
                      <span>Contacts</span>
                    </button>
                  </div>
                  <div className="manager-compose-quick-panel" aria-label="Quick recipient actions">
                    <div className="manager-compose-quick-panel-head">
                      <span>Quick Audience</span>
                      <small>Tap an active preset again to clear.</small>
                    </div>
                    <div className="manager-compose-quick-actions">
                      <label className={`manager-compose-quick-option${composeAllUsers ? " is-selected" : ""}`}>
                        <input
                          aria-label="All Users"
                          type="checkbox"
                          checked={composeAllUsers}
                          onChange={quickToggleComposeAllUsers}
                        />
                        <span>
                          <strong>All Users</strong>
                          <small>{composeRecipients.length} contacts</small>
                        </span>
                      </label>
                      <label className={`manager-compose-quick-option${isComposeRecipientRoleOnlySelected("staff") ? " is-selected" : ""}`}>
                        <input
                          aria-label="All Staff"
                          type="checkbox"
                          checked={isComposeRecipientRoleOnlySelected("staff")}
                          onChange={() => quickToggleComposeRecipientRole("staff")}
                        />
                        <span>
                          <strong>All Staff</strong>
                          <small>{getComposeRecipientsByRole("staff").length} contact</small>
                        </span>
                      </label>
                      <label className={`manager-compose-quick-option${isComposeRecipientRoleOnlySelected("student") ? " is-selected" : ""}`}>
                        <input
                          aria-label="All Students"
                          type="checkbox"
                          checked={isComposeRecipientRoleOnlySelected("student")}
                          onChange={() => quickToggleComposeRecipientRole("student")}
                        />
                        <span>
                          <strong>All Students</strong>
                          <small>{getComposeRecipientsByRole("student").length} contacts</small>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="manager-compose-selected-panel" aria-label="Selected compose recipients">
                    <div className="manager-compose-selected-panel-head">
                      <span>Selected Contacts</span>
                      <strong>{selectedComposeRecipientCount}</strong>
                    </div>
                    {composeRecipientSummaryItems.length ? (
                      <div className="manager-compose-selected-chips">
                        {composeRecipientSummaryItems.map((item) => (
                          <span className={`manager-compose-selected-chip manager-compose-selected-chip--${item.variant}`} key={item.id}>
                            <Users size={13} aria-hidden="true" />
                            <span>
                              <strong>{item.label}</strong>
                              <small>{item.detail}</small>
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>No contacts selected yet.</p>
                    )}
                  </div>
                </section>
              </div>

              <footer className="manager-compose-actions">
                <button type="button" className="manager-compose-secondary" onClick={closeComposeDialog}>Cancel</button>
                <button type="submit" className="manager-compose-submit">
                  <Send size={18} />
                  <span>Send Compose</span>
                </button>
              </footer>
            </form>
            {isComposeContactsOpen && (
              <div
                className="manager-compose-contacts-backdrop"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setIsComposeContactsOpen(false);
                }}
              >
                <section
                  className="manager-compose-contacts-modal"
                  id="manager-compose-contacts-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="manager-compose-contacts-title"
                >
                  <header className="manager-compose-contacts-head">
                    <div>
                      <p>Recipient directory</p>
                      <h2 id="manager-compose-contacts-title">Contacts</h2>
                    </div>
                    <button className="manager-compose-close" type="button" aria-label="Close contacts" onClick={() => setIsComposeContactsOpen(false)}>
                      <X size={20} />
                    </button>
                  </header>

                  <div className="manager-compose-contact-tools manager-compose-contact-tools--dialog">
                    <label className="manager-compose-contact-search">
                      <Search size={17} aria-hidden="true" />
                      <span className="sr-only">Search compose contacts</span>
                      <input
                        aria-label="Search compose contacts"
                        type="search"
                        value={composeRecipientQuery}
                        onChange={(event) => setComposeRecipientQuery(event.target.value)}
                        placeholder="Search contacts by name, role, phone, or email"
                      />
                    </label>
                    <span className="manager-compose-contact-count">{visibleComposeRecipients.length} visible · {selectedComposeRecipientCount} selected</span>
                  </div>

                  <div className="manager-compose-contact-categories">
                    {composeRecipientGroups.map((group) => {
                      const isGroupCollapsed = collapsedComposeRecipientRoles.has(group.role);
                      const contactListId = `manager-compose-contact-list-${group.role}`;
                      const selectedGroupCount = composeAllUsers
                        ? group.recipients.length
                        : group.recipients.filter((recipient) => composeSelectedRecipientIds.has(recipient.id)).length;

                      return (
                        <section
                          className={`manager-compose-contact-category manager-compose-contact-category--${group.role}${isGroupCollapsed ? " is-collapsed" : ""}`}
                          key={group.role}
                          role="group"
                          aria-label={`${group.title} contacts`}
                        >
                          <header>
                            <button
                              className="manager-compose-category-toggle"
                              type="button"
                              aria-expanded={!isGroupCollapsed}
                              aria-controls={contactListId}
                              onClick={() => toggleComposeRecipientGroup(group.role)}
                            >
                              <ChevronRight size={16} aria-hidden="true" />
                              <span className="sr-only">{isGroupCollapsed ? "Expand" : "Collapse"} {group.title}</span>
                            </button>
                            <div className="manager-compose-category-summary">
                              <h3>{group.title}</h3>
                              <p>{group.description}</p>
                            </div>
                            <div className="manager-compose-category-actions">
                              <span>{selectedGroupCount}/{group.recipients.length}</span>
                              <button
                                className="manager-compose-category-select"
                                type="button"
                                aria-label={`Select all ${group.title}`}
                                disabled={!group.recipients.length}
                                onClick={() => selectComposeRecipientGroup(group.recipients)}
                              >
                                Select All
                              </button>
                            </div>
                          </header>
                          {!isGroupCollapsed && (
                            <div className="manager-compose-contact-list" id={contactListId} aria-label={`${group.title} contact list`}>
                              {group.recipients.length ? (
                                group.recipients.map((recipient) => (
                                  <label className="manager-compose-contact" key={recipient.id}>
                                    <input
                                      type="checkbox"
                                      aria-label={`${recipient.name} ${composeRecipientRoleLabel(recipient.role)} ${recipient.detail}`}
                                      checked={composeAllUsers || composeSelectedRecipientIds.has(recipient.id)}
                                      onChange={() => toggleComposeRecipient(recipient.id)}
                                    />
                                    <span aria-hidden="true" />
                                    <div>
                                      <strong>{recipient.name}</strong>
                                      <small>{composeRecipientRoleLabel(recipient.role)} · {recipient.subtitle}</small>
                                      <p>{recipient.detail}</p>
                                    </div>
                                  </label>
                                ))
                              ) : (
                                <p className="manager-compose-empty">No matching contacts.</p>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>

                  <footer className="manager-compose-contacts-actions">
                    <button type="button" className="manager-compose-submit" onClick={() => setIsComposeContactsOpen(false)}>Done</button>
                  </footer>
                </section>
              </div>
            )}
          </div>
        )}
      </main>
    </section>
  );
}

function ManagerLauncherPage() {
  const { accountRole, currentManagedAccount, logout, managerAccountAccess, session, showToast, students } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const isManagerOwner = managerAccountAccess.isManagerOwner;
  const isStudentPanel = accountRole === "student";
  const isStaffPanel = accountRole === "staff" && !isManagerOwner;
  const readPanelProfile = isManagerOwner ? readManagerProfile : readStaffProfile;
  const writePanelProfile = isManagerOwner ? writeManagerProfile : writeStaffProfile;
  const profileOwnerLabel = isManagerOwner ? "Manager" : "Staff";
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSettings, setProfileSettings] = useState(() => readPanelProfile(session?.email));
  const [profilePassword, setProfilePassword] = useState({ newPassword: "", confirmPassword: "" });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const launcherItems = isStudentPanel
    ? studentLauncherItems
    : managerLauncherItems.filter((item) => managerAccountAccess.allowedTools.includes(item.icon as ManagerAccessKey));
  const selectedLauncherItem = isStudentPanel
    ? getSelectedStudentLauncherItem(location.search)
    : launcherItems.find((item) => item.icon === new URLSearchParams(location.search).get("tool")) ?? launcherItems[0] ?? managerLauncherItems[0];
  const launcherName = isStudentPanel ? "student" : isStaffPanel ? "staff" : "manager";
  const panelTitle = isStudentPanel ? "Student's Panel" : isStaffPanel ? "STAFF PANEL" : "MANAGER PANEL";
  const panelAriaLabel = isStudentPanel ? "Student dashboard" : isStaffPanel ? "Staff dashboard" : "Manager dashboard";
  const panelHeaderAriaLabel = isStudentPanel ? "Student panel page header" : isStaffPanel ? "Staff panel page header" : "Manager panel page header";
  const panelQuickActionsLabel = isStudentPanel ? "Student panel quick actions" : isStaffPanel ? "Staff panel quick actions" : "Manager panel quick actions";
  const launcherAriaLabel = isStudentPanel ? "Student app launcher" : isStaffPanel ? "Staff app launcher" : "Manager app launcher";
  const workspaceFrameLabel = isStudentPanel ? "Student launcher workspace frame" : isStaffPanel ? "Staff launcher workspace frame" : "Manager launcher workspace frame";
  const sidebarToggleLabel = isSidebarCollapsed ? `Expand ${launcherName} app launcher` : `Collapse ${launcherName} app launcher`;
  const studentRecord = selectSessionStudent(students, session?.email, currentManagedAccount?.studentId);
  const studentPanelProfile = isStudentPanel ? readStudentProfile(session?.email, studentRecord) : undefined;
  const profileActionPhoto = isStudentPanel
    ? studentPanelProfile?.photoDataUrl ?? (studentRecord?.profileImagePath ? publicAsset(studentRecord.profileImagePath) : publicAsset("assets/CheetahProfilePic/Cheetah.png"))
    : profileSettings.photoDataUrl ?? publicAsset("assets/CheetahProfilePic/Cheetah.png");
  const activeStudentCount = students.filter((student) => (student.status ?? "Active").toLowerCase() === "active").length;
  const managerColorPreview: ProfileColorPreviewData = {
    kind: isManagerOwner ? "manager" : "staff",
    title: `${profileOwnerLabel} Profile`,
    displayName: profileSettings.name.trim() || (isManagerOwner ? "Cho's Manager" : "Cho's Staff"),
    roleLabel: isManagerOwner ? "Head Coach & Manager" : currentManagedAccount?.title?.trim() || "Staff Member",
    portraitSrc: profileSettings.photoDataUrl ?? publicAsset("assets/CheetahProfilePic/Cheetah.png"),
    avatarText: "CM",
    facts: [
      { icon: <Award size={18} />, label: "Team: Summer Champions" },
      { icon: <Target size={18} />, label: `Member Since: ${formatMonthYear(session?.createdAt)}` },
      { icon: <Users size={18} />, label: `Team Size: ${activeStudentCount} Member${activeStudentCount === 1 ? "" : "s"}` }
    ],
    counts: [
      { label: "Messages", value: managerHomeThreads.filter((thread) => thread.kind === "message").length, tone: "message" },
      { label: "Events", value: managerHomeThreads.filter((thread) => thread.kind === "event").length, tone: "event" }
    ]
  };

  useEffect(() => {
    if (new URLSearchParams(location.search).get("profile") !== "settings") return;
    if (isStudentPanel) {
      navigate("/manager", { replace: true });
      return;
    }
    setProfileSettings(readPanelProfile(session?.email));
    setProfilePassword({ newPassword: "", confirmPassword: "" });
    setProfileOpen(true);
    navigate("/manager", { replace: true });
  }, [isStudentPanel, location.search, navigate, readPanelProfile, session?.email]);

  const selectProfileTheme = (theme: AppThemeMode) => {
    setProfileSettings((current) => ({ ...current, theme }));
    writePanelProfile({ ...readPanelProfile(session?.email), theme }, session?.email);
    writeStoredAppTheme(theme);
  };

  const closeProfileSettings = () => {
    setProfileOpen(false);
    navigate("/", { replace: true });
  };

  const saveProfileSettings = (event: FormEvent) => {
    event.preventDefault();
    const newPassword = profilePassword.newPassword.trim();
    const confirmPassword = profilePassword.confirmPassword.trim();
    const nextProfile: ManagerProfileSettings = {
      name: profileSettings.name.trim(),
      username: profileSettings.username.trim(),
      email: profileSettings.email.trim(),
      phone: profileSettings.phone.trim(),
      updates: profileSettings.updates,
      theme: profileSettings.theme,
      photoDataUrl: profileSettings.photoDataUrl,
      passwordUpdatedAt: profileSettings.passwordUpdatedAt
    };

    if (!nextProfile.name) {
      showToast(`Enter a ${profileOwnerLabel.toLowerCase()} profile name.`);
      return;
    }

    if (!nextProfile.username) {
      showToast(`Enter a ${profileOwnerLabel.toLowerCase()} username.`);
      return;
    }

    if (!validateEmail(nextProfile.email)) {
      showToast(`Enter a valid ${profileOwnerLabel.toLowerCase()} profile email.`);
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        showToast("Enter a password with at least 8 characters.");
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast(`The ${profileOwnerLabel.toLowerCase()} passwords do not match.`);
        return;
      }

      nextProfile.passwordUpdatedAt = new Date().toISOString();
    }

    applyAppTheme(nextProfile.theme);
    writeStoredAppTheme(nextProfile.theme);
    writePanelProfile(nextProfile, session?.email);
    setProfileSettings(nextProfile);
    setProfilePassword({ newPassword: "", confirmPassword: "" });
    setProfileOpen(false);
    navigate("/", { replace: true });
    showToast(`${profileOwnerLabel} profile settings saved.`);
  };

  return (
    <section className={`manager-launcher-page${isStudentPanel ? " student-launcher-page" : ""}${isStaffPanel ? " staff-launcher-page" : ""}`} aria-label={panelAriaLabel}>
      <main className="manager-launcher-main">
        <header className="manager-launcher-topbar manager-page-title-bar" aria-label={panelHeaderAriaLabel}>
          <ManagerPageTitleFrame title={panelTitle} className="manager-page-title-frame--manager-panel" />
          <nav className="manager-home-top-actions" aria-label={panelQuickActionsLabel}>
            <Link className="manager-home-top-action manager-launcher-profile-link" to="/" aria-label="Profile">
              <img
                className="manager-home-profile-action-photo"
                src={profileActionPhoto}
                alt=""
                draggable="false"
              />
              <span className="manager-home-top-action-label">Profile</span>
            </Link>
            <button className="manager-home-top-action manager-home-logout-button" type="button" aria-label="Log Out" onClick={logout}>
              <img className="manager-home-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
              <span className="manager-home-top-action-label">Log Out</span>
            </button>
          </nav>
        </header>
        <div className={`manager-launcher-body${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`} role="group" aria-label={workspaceFrameLabel}>
          <nav
            className="manager-launcher-grid manager-launcher-sidebar"
            id="manager-launcher-sidebar"
            aria-label={launcherAriaLabel}
            data-orientation="vertical"
            hidden={isSidebarCollapsed}
          >
            {launcherItems.map((item) => {
              const isSelected = item.icon === selectedLauncherItem.icon;
              return (
                <Link
                  className={`manager-launcher-item${isSelected ? " is-selected" : ""}`}
                  key={item.label}
                  to={managerLauncherPath(item)}
                  title={item.label}
                  aria-current={isSelected ? "page" : undefined}
                  data-future={item.future ? "true" : undefined}
                >
                  <ManagerLauncherIcon icon={item.icon} />
                  <span className="manager-launcher-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <button
            className="manager-launcher-rail-toggle"
            type="button"
            aria-label={sidebarToggleLabel}
            aria-controls="manager-launcher-sidebar"
            aria-expanded={!isSidebarCollapsed}
            title={sidebarToggleLabel}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <span className="manager-launcher-rail-toggle-bar" aria-hidden="true" />
          </button>
          <section className="manager-launcher-workspace" aria-label={`${selectedLauncherItem.label} workspace`}>
            {isStudentPanel ? <StudentLauncherWorkspace tool={selectedLauncherItem.icon} /> : <ManagerLauncherWorkspace tool={selectedLauncherItem.icon} />}
          </section>
        </div>
      </main>
      {profileOpen && (
        <div className="modal-backdrop manager-profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeProfileSettings()}>
          <form className="modal-card manager-profile-modal" role="dialog" aria-modal="true" aria-label={`${profileOwnerLabel} profile settings`} onSubmit={saveProfileSettings}>
            <header className="student-modal-head">
              <div>
                <h2>Profile Settings</h2>
                <p>Edit {profileOwnerLabel.toLowerCase()} contact settings and app theme.</p>
              </div>
              <button className="student-modal-close" type="button" aria-label={`Close ${profileOwnerLabel.toLowerCase()} profile settings`} onClick={closeProfileSettings}>
                <X size={20} />
              </button>
            </header>
            <section className="student-form-section manager-profile-form-section">
              <label className="field-label">
                Name
                <input
                  className="input"
                  value={profileSettings.name}
                  onChange={(event) => setProfileSettings({ ...profileSettings, name: event.target.value })}
                  placeholder={isManagerOwner ? "Cho's Manager" : "Cho's Staff"}
                />
              </label>
              <label className="field-label">
                Username
                <input
                  className="input"
                  value={profileSettings.username}
                  onChange={(event) => setProfileSettings({ ...profileSettings, username: event.target.value })}
                  autoComplete="username"
                  placeholder={isManagerOwner ? "chos-manager" : "chos-staff"}
                />
              </label>
              <label className="field-label">
                Email
                <input
                  className="input"
                  value={profileSettings.email}
                  onChange={(event) => setProfileSettings({ ...profileSettings, email: event.target.value })}
                  placeholder={isManagerOwner ? "manager@chos.prototype" : "staff@chos.prototype"}
                />
              </label>
              <label className="field-label">
                Phone
                <input
                  className="input"
                  value={profileSettings.phone}
                  onChange={(event) => setProfileSettings({ ...profileSettings, phone: event.target.value })}
                  placeholder="(262) 555-0100"
                />
              </label>
              <label className="field-label">
                New Password
                <input
                  className="input"
                  type="password"
                  value={profilePassword.newPassword}
                  onChange={(event) => setProfilePassword({ ...profilePassword, newPassword: event.target.value })}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                />
              </label>
              <label className="field-label">
                Confirm Password
                <input
                  className="input"
                  type="password"
                  value={profilePassword.confirmPassword}
                  onChange={(event) => setProfilePassword({ ...profilePassword, confirmPassword: event.target.value })}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                />
              </label>
              <div className="manager-profile-preferences">
                <div className="manager-theme-setting" role="group" aria-label="App theme">
                  <span>App Theme</span>
                  <div className="manager-theme-options">
                    <button
                      type="button"
                      className={`manager-theme-option${profileSettings.theme === "light" ? " is-active" : ""}`}
                      aria-pressed={profileSettings.theme === "light"}
                      onClick={() => selectProfileTheme("light")}
                    >
                      <Sun size={16} /> Light
                    </button>
                    <button
                      type="button"
                      className={`manager-theme-option${profileSettings.theme === "dark" ? " is-active" : ""}`}
                      aria-pressed={profileSettings.theme === "dark"}
                      onClick={() => selectProfileTheme("dark")}
                    >
                      <Moon size={16} /> Dark
                    </button>
                  </div>
                </div>
                <label className="manager-profile-check">
                  <input
                    type="checkbox"
                    checked={profileSettings.updates}
                    onChange={(event) => setProfileSettings({ ...profileSettings, updates: event.target.checked })}
                  />
                  <span>Receive manager updates and reminders</span>
                </label>
              </div>
              <ProfileColorEditingTool sessionEmail={session?.email} showToast={showToast} preview={managerColorPreview} />
            </section>
            <div className="student-editor-actions manager-profile-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> Save Profile Settings
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

type StaffAccountForm = {
  displayName: string;
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
  title: string;
  notes: string;
};

type StudentAccountForm = {
  fullName: string;
  username: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  gender: string;
  studentEmail: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  program: string;
  status: string;
  beltRank: string;
  notes: string;
};

const staffAccessOptions: { key: ManagerAccessKey; label: string; helper: string }[] = [
  { key: "dashboard", label: "Dashboard", helper: "Calendar and overview" },
  { key: "students", label: "Students", helper: "Student directory" },
  { key: "classes", label: "Classes", helper: "Class setup" },
  { key: "scheduling", label: "Scheduling", helper: "Calendar scheduling" },
  { key: "messages", label: "Messages", helper: "Messaging tools" },
  { key: "events", label: "Events", helper: "Event creation" },
  { key: "merchandise", label: "Merchandise", helper: "Store tools" },
  { key: "videos", label: "Videos", helper: "Training videos" },
  { key: "studyGuide", label: "Study Guide", helper: "Study files" },
  { key: "reports", label: "Reports", helper: "Reports tab" },
  { key: "create", label: "Create account access", helper: "Create staff and students" }
];

const managerAccessLabelMap: Record<ManagerAccessKey, string> = staffAccessOptions.reduce(
  (labels, option) => ({ ...labels, [option.key]: option.key === "create" ? "Create" : option.label }),
  {} as Record<ManagerAccessKey, string>
);

const staffPanelAccessOptions = staffAccessOptions.filter((option) => option.key !== "create");
const staffPanelAccessKeys: ManagerAccessKey[] = staffPanelAccessOptions.map((option) => option.key);

function renderStaffAccessList(displayName: string) {
  return (
    <div className="create-account-access-list" aria-label={`${displayName} access`}>
      {staffPanelAccessKeys.map((key) => <span key={key}>{managerAccessLabelMap[key]}</span>)}
    </div>
  );
}

function makeBlankStaffAccountForm(): StaffAccountForm {
  return {
    displayName: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
    title: "Instructor",
    notes: ""
  };
}

function makeBlankStudentAccountForm(): StudentAccountForm {
  return {
    fullName: "",
    username: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    gender: "Not specified",
    studentEmail: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    program: "Youth Taekwondo",
    status: "Active",
    beltRank: "White",
    notes: ""
  };
}

function normalizeCreateUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function CreateAccountsPage() {
  const {
    addOperationsStudent,
    createManagedAccount,
    managedAccounts,
    managedUsernameExists,
    showToast,
    updateManagedAccountStatus
  } = useAppState();
  const [mode, setMode] = useState<"staff" | "student">("staff");
  const [staffForm, setStaffForm] = useState(makeBlankStaffAccountForm);
  const [studentForm, setStudentForm] = useState(makeBlankStudentAccountForm);
  const [savingAccountType, setSavingAccountType] = useState<"staff" | "student" | null>(null);
  const staffAccounts = managedAccounts.filter((account) => account.role === "staff");
  const studentAccounts = managedAccounts.filter((account) => account.role === "student");
  const staffToolCount = staffPanelAccessOptions.length;

  const validatePasswordPair = (password: string, confirmPassword: string) => {
    if (password.trim().length < 8) {
      showToast("Enter a password with at least 8 characters.");
      return false;
    }

    if (password.trim() !== confirmPassword.trim()) {
      showToast("The passwords do not match.");
      return false;
    }

    return true;
  };

  const submitStaffAccount = async (event: FormEvent) => {
    event.preventDefault();
    const username = normalizeCreateUsername(staffForm.username);
    if (!staffForm.displayName.trim() || !username || !staffForm.email.trim() || !staffForm.phone.trim()) {
      showToast("Enter staff name, username, email, and phone.");
      return;
    }

    if (!validateEmail(staffForm.email)) {
      showToast("Enter a valid staff email.");
      return;
    }

    if (!validatePasswordPair(staffForm.password, staffForm.confirmPassword)) return;

    if (managedUsernameExists(username)) {
      showToast("That username is already in use.");
      return;
    }

    const accountInput = {
      displayName: staffForm.displayName,
      username,
      password: staffForm.password,
      role: "staff",
      status: "active",
      email: staffForm.email,
      phone: staffForm.phone,
      title: staffForm.title,
      notes: staffForm.notes,
      access: staffPanelAccessKeys
    } as const;

    if (isSupabaseAuthConfigured()) {
      setSavingAccountType("staff");
      const supabaseAccount = await createSupabaseManagedAccount(accountInput);
      setSavingAccountType(null);
      if (supabaseAccount.status !== "created") {
        showToast(
          supabaseAccount.status === "missing-session"
            ? "Sign in again as Manager123 before creating Supabase accounts."
            : supabaseAccount.status === "unauthorized" || supabaseAccount.status === "error"
              ? supabaseAccount.message
              : "Unable to create Supabase staff account."
        );
        return;
      }
    }

    const account = createManagedAccount(accountInput);

    if (!account) {
      showToast("Unable to create staff account.");
      return;
    }

    setStaffForm(makeBlankStaffAccountForm());
    showToast(`${account.displayName} staff account created.`);
  };

  const submitStudentAccount = async (event: FormEvent) => {
    event.preventDefault();
    const username = normalizeCreateUsername(studentForm.username);
    if (!studentForm.fullName.trim() || !username || !studentForm.studentEmail.trim() || !studentForm.guardianPhone.trim()) {
      showToast("Enter student name, username, email, and guardian phone.");
      return;
    }

    if (!validateEmail(studentForm.studentEmail)) {
      showToast("Enter a valid student email.");
      return;
    }

    if (!validatePasswordPair(studentForm.password, studentForm.confirmPassword)) return;

    if (managedUsernameExists(username)) {
      showToast("That username is already in use.");
      return;
    }

    if (isSupabaseAuthConfigured()) {
      setSavingAccountType("student");
      const supabaseAccount = await createSupabaseManagedAccount({
        displayName: studentForm.fullName,
        username,
        password: studentForm.password,
        role: "student",
        status: "active",
        email: studentForm.studentEmail,
        phone: studentForm.guardianPhone,
        title: `${studentForm.beltRank} Belt Student`,
        notes: studentForm.notes,
        access: []
      });
      setSavingAccountType(null);
      if (supabaseAccount.status !== "created") {
        showToast(
          supabaseAccount.status === "missing-session"
            ? "Sign in again as Manager123 before creating Supabase accounts."
            : supabaseAccount.status === "unauthorized" || supabaseAccount.status === "error"
              ? supabaseAccount.message
              : "Unable to create Supabase student account."
        );
        return;
      }
    }

    const student = addOperationsStudent({
      fullName: studentForm.fullName,
      dateOfBirth: studentForm.dateOfBirth,
      gender: studentForm.gender,
      studentEmail: studentForm.studentEmail,
      guardianName: studentForm.guardianName,
      guardianPhone: studentForm.guardianPhone,
      guardianEmail: studentForm.guardianEmail,
      program: studentForm.program,
      status: studentForm.status,
      beltRank: studentForm.beltRank,
      notes: studentForm.notes
    });

    if (!student) {
      showToast("Enter student name, guardian phone, and email.");
      return;
    }

    const account = createManagedAccount({
      displayName: fullName(student),
      username,
      password: studentForm.password,
      role: "student",
      status: "active",
      email: student.email,
      phone: student.phone,
      title: `${student.beltRank} Belt Student`,
      notes: studentForm.notes,
      studentId: student.id,
      linkedStudent: student
    });

    if (!account) {
      showToast("Student record saved, but the login account could not be created.");
      return;
    }

    setStudentForm(makeBlankStudentAccountForm());
    showToast(`${account.displayName} student login created.`);
  };

  const setManagedAccountLifecycleStatus = (account: ManagedAccount, status: ManagedAccount["status"]) => {
    const updatedAccount = updateManagedAccountStatus(account.id, status);
    if (!updatedAccount) {
      showToast("Unable to update account status.");
      return;
    }

    showToast(`${account.displayName} account ${status === "active" ? "reactivated" : "deactivated"}.`);
  };

  const renderAccountCard = (account: ManagedAccount) => (
    <article className="create-account-card" key={account.id} aria-label={`${account.displayName} ${account.role} account`}>
      <div className="create-account-card-main">
        <span className={`create-account-avatar create-account-avatar--${account.role}`} aria-hidden="true">
          {account.role === "staff" ? <ShieldCheck size={20} /> : <Users size={20} />}
        </span>
        <div>
          <h3>{account.displayName}</h3>
          <p>{account.username}</p>
        </div>
      </div>
      <div className="create-account-card-meta">
        <span>{account.role === "staff" ? account.title || "Staff" : "Student"}</span>
        <span>{account.status === "active" ? "Active" : "Inactive"}</span>
      </div>
      {account.role === "staff" && renderStaffAccessList(account.displayName)}
      <div className="create-account-card-actions">
        {account.status === "inactive" ? (
          <button type="button" onClick={() => setManagedAccountLifecycleStatus(account, "active")} aria-label={`Reactivate ${account.displayName} account`}>
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>Reactivate</span>
          </button>
        ) : (
          <button type="button" className="is-warning" onClick={() => setManagedAccountLifecycleStatus(account, "inactive")} aria-label={`Deactivate ${account.displayName} account`}>
            <X size={15} aria-hidden="true" />
            <span>Deactivate</span>
          </button>
        )}
      </div>
    </article>
  );

  return (
    <OperationsPage
      className="operations-page--create-accounts"
      title="Create Accounts"
      text="Create custom staff and student logins, assign manager-panel access, and keep the setup simple enough to complete in one pass."
    >
      <div className="operations-stats create-account-stats">
        <StatCard label="Staff accounts" value={staffAccounts.length} icon={<ShieldCheck />} />
        <StatCard label="Student logins" value={studentAccounts.length} icon={<Users />} />
        <StatCard label="Staff tools" value={staffToolCount} icon={<UserPlus />} />
      </div>

      <section className="operations-panel create-account-builder" aria-label="Create account builder">
        <div className="create-account-mode-tabs" role="group" aria-label="Account type">
          <button type="button" aria-pressed={mode === "staff"} onClick={() => setMode("staff")}>
            <ShieldCheck size={18} /> Staff
          </button>
          <button type="button" aria-pressed={mode === "student"} onClick={() => setMode("student")}>
            <Users size={18} /> Student
          </button>
        </div>

        {mode === "staff" ? (
          <form className="create-account-form" aria-label="Create staff account" onSubmit={submitStaffAccount}>
            <div className="student-form-grid">
              <label>
                Staff full name
                <input autoFocus value={staffForm.displayName} onChange={(event) => setStaffForm({ ...staffForm, displayName: event.target.value })} placeholder="Jordan Lee" />
              </label>
              <label>
                Staff username
                <input autoComplete="username" value={staffForm.username} onChange={(event) => setStaffForm({ ...staffForm, username: event.target.value })} placeholder="jordan.staff" />
              </label>
              <label>
                Staff password
                <input type="password" autoComplete="new-password" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} placeholder="Minimum 8 characters" />
              </label>
              <label>
                Confirm staff password
                <input type="password" autoComplete="new-password" value={staffForm.confirmPassword} onChange={(event) => setStaffForm({ ...staffForm, confirmPassword: event.target.value })} placeholder="Repeat password" />
              </label>
              <label>
                Staff email
                <input inputMode="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} placeholder="staff@chos.prototype" />
              </label>
              <label>
                Staff phone
                <input value={staffForm.phone} onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })} placeholder="(262) 555-0100" />
              </label>
              <label>
                Staff title
                <input value={staffForm.title} onChange={(event) => setStaffForm({ ...staffForm, title: event.target.value })} placeholder="Instructor" />
              </label>
            </div>

            <fieldset className="create-account-access-grid">
              <legend>Staff panel access</legend>
              {staffPanelAccessOptions.map((option) => (
                <label className="create-account-access-option" key={option.key}>
                  <input aria-label={option.label} type="checkbox" checked disabled />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.helper}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="create-account-notes">
              Notes
              <textarea rows={3} value={staffForm.notes} onChange={(event) => setStaffForm({ ...staffForm, notes: event.target.value })} placeholder="Optional internal notes" />
            </label>

            <div className="student-editor-actions">
              <button type="submit" disabled={savingAccountType === "staff"}>
                <UserPlus size={18} /> {savingAccountType === "staff" ? "Creating Staff..." : "Create Staff Account"}
              </button>
            </div>
          </form>
        ) : (
          <form className="create-account-form" aria-label="Create student account" onSubmit={submitStudentAccount}>
            <div className="student-form-grid">
              <label>
                Student full name
                <input autoFocus value={studentForm.fullName} onChange={(event) => setStudentForm({ ...studentForm, fullName: event.target.value })} placeholder="Avery Kim" />
              </label>
              <label>
                Student username
                <input autoComplete="username" value={studentForm.username} onChange={(event) => setStudentForm({ ...studentForm, username: event.target.value })} placeholder="avery.student" />
              </label>
              <label>
                Student password
                <input type="password" autoComplete="new-password" value={studentForm.password} onChange={(event) => setStudentForm({ ...studentForm, password: event.target.value })} placeholder="Minimum 8 characters" />
              </label>
              <label>
                Confirm student password
                <input type="password" autoComplete="new-password" value={studentForm.confirmPassword} onChange={(event) => setStudentForm({ ...studentForm, confirmPassword: event.target.value })} placeholder="Repeat password" />
              </label>
              <label>
                Student email
                <input inputMode="email" value={studentForm.studentEmail} onChange={(event) => setStudentForm({ ...studentForm, studentEmail: event.target.value })} placeholder="student@chos.prototype" />
              </label>
              <label>
                Date of birth
                <input type="date" value={studentForm.dateOfBirth} onChange={(event) => setStudentForm({ ...studentForm, dateOfBirth: event.target.value })} />
              </label>
              <label>
                Gender
                <select value={studentForm.gender} onChange={(event) => setStudentForm({ ...studentForm, gender: event.target.value })}>
                  {genderOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Parent/guardian name
                <input value={studentForm.guardianName} onChange={(event) => setStudentForm({ ...studentForm, guardianName: event.target.value })} placeholder="Parent or guardian" />
              </label>
              <label>
                Parent/guardian phone
                <input value={studentForm.guardianPhone} onChange={(event) => setStudentForm({ ...studentForm, guardianPhone: event.target.value })} placeholder="(262) 555-0122" />
              </label>
              <label>
                Parent/guardian email
                <input inputMode="email" value={studentForm.guardianEmail} onChange={(event) => setStudentForm({ ...studentForm, guardianEmail: event.target.value })} placeholder="parent@chos.prototype" />
              </label>
              <label>
                Program
                <input value={studentForm.program} onChange={(event) => setStudentForm({ ...studentForm, program: event.target.value })} />
              </label>
              <label>
                Status
                <select value={studentForm.status} onChange={(event) => setStudentForm({ ...studentForm, status: event.target.value })}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Belt rank
                <select value={studentForm.beltRank} onChange={(event) => setStudentForm({ ...studentForm, beltRank: event.target.value })}>
                  {beltOptions.map((rank) => (
                    <option key={rank} value={rank}>{rank}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="create-account-notes">
              Notes
              <textarea rows={3} value={studentForm.notes} onChange={(event) => setStudentForm({ ...studentForm, notes: event.target.value })} placeholder="Optional student notes" />
            </label>

            <div className="student-editor-actions">
              <button type="submit" disabled={savingAccountType === "student"}>
                <UserPlus size={18} /> {savingAccountType === "student" ? "Creating Student..." : "Create Student Account"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="operations-panel create-account-directory" aria-label="Created custom accounts">
        <div className="student-roster-head">
          <div>
            <h2>Created Accounts</h2>
            <p>Saved staff and student usernames can sign in from the main login screen immediately.</p>
          </div>
          <span>{managedAccounts.length} account{managedAccounts.length === 1 ? "" : "s"}</span>
        </div>
        {managedAccounts.length ? (
          <div className="create-account-card-grid">
            {managedAccounts.map(renderAccountCard)}
          </div>
        ) : (
          <p className="operations-note">No custom staff or student accounts have been created yet.</p>
        )}
      </section>
    </OperationsPage>
  );
}

function DashboardPage() {
  const { addScheduledClass, scheduledClasses, showToast, studioClasses, studioEvents } = useAppState();
  const location = useLocation();
  const focusDateParam = new URLSearchParams(location.search).get("date") ?? "";
  const focusDateKey = isCalendarDateKey(focusDateParam) ? focusDateParam : undefined;

  return (
    <OperationsPage className="operations-page--dashboard" title="Dashboard">
      <div className="manager-dashboard-calendar-page manager-launcher-calendar">
        <ManagerLiveCalendar
          addScheduledClass={addScheduledClass}
          scheduledClasses={scheduledClasses}
          showToast={showToast}
          studioClasses={studioClasses}
          studioEvents={studioEvents}
          focusDateKey={focusDateKey}
        />
      </div>
    </OperationsPage>
  );
}

function ReportsMetricCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <article className="operation-stat-card reports-metric-card" aria-label={`${label} report metric`}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function ReportsPriorityActionContent({ action }: { action: ReportsPriorityAction }) {
  return (
    <>
      <span className="reports-action-count">{action.count}</span>
      <span className="reports-action-copy">
        <strong>{action.title}</strong>
        <small>{action.detail}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </>
  );
}

const reportsDirectActionIds = new Set([
  "queued-texts",
  "class-reminders",
  "missed-class-follow-ups",
  "attendance-gap-check-ins",
  "trial-conversions",
  "new-student-check-ins",
  "celebration-outreach",
  "profile-updates",
  "lead-follow-ups",
  "milestone-encouragement",
  "belt-test-invites",
  "paused-students",
  "low-stock",
  "stale-queued-text-cleanup",
  "stale-schedule-cleanup"
]);

function isReportsDirectAction(action: ReportsPriorityAction) {
  return reportsDirectActionIds.has(action.id);
}

function celebrationCandidateLabel(candidate: ReportsCelebrationCandidate) {
  const reasonLabel = candidate.reason === "birthday" ? "Birthday" : "Training anniversary";
  const dateLabel = candidate.daysAway === 0 ? "Today" : `${candidate.daysAway} day${candidate.daysAway === 1 ? "" : "s"}`;
  const yearsLabel = candidate.reason === "anniversary" && candidate.years ? ` · ${candidate.years} year${candidate.years === 1 ? "" : "s"}` : "";
  return `${reasonLabel} · ${dateLabel}${yearsLabel}`;
}

function profileUpdateCandidateLabel(candidate: ReportsProfileUpdateCandidate) {
  const issuePreview = candidate.issues.slice(0, 3).join(" · ");
  const remainingIssues = candidate.issueCount - 3;
  return remainingIssues > 0 ? `${issuePreview} · ${remainingIssues} more` : issuePreview;
}

function classReminderCandidateLabel(candidate: ReportsClassReminderCandidate) {
  const dateLabel = candidate.daysAway === 0 ? "Today" : `${candidate.daysAway} day${candidate.daysAway === 1 ? "" : "s"}`;
  return `${candidate.title} · ${dateLabel} at ${candidate.time}`;
}

function newStudentCheckInCandidateLabel(candidate: ReportsNewStudentCheckInCandidate) {
  const programLabel = candidate.program ? ` · ${candidate.program}` : "";
  return `${candidate.daysSinceJoin} days since joining${programLabel}`;
}

function attendanceGapCandidateLabel(candidate: ReportsAttendanceGapCandidate) {
  return `${candidate.daysSinceAttendance} days since attendance · ${candidate.lastAttendanceDate}`;
}

function directMessageReplyCandidateLabel(candidate: ReportsDirectMessageReplyCandidate) {
  return candidate.senderName;
}

function directMessageReplyCandidateContext(candidate: ReportsDirectMessageReplyCandidate) {
  return candidate.senderName === candidate.studentName ? "Student app message" : `${candidate.studentName} family message`;
}

function ReportsPriorityActionCard({ action, onRunAction }: { action: ReportsPriorityAction; onRunAction: (action: ReportsPriorityAction) => void }) {
  if (isReportsDirectAction(action)) {
    return (
      <button className={`reports-action-card reports-action-card--${action.tone}`} type="button" aria-label={action.title} onClick={() => onRunAction(action)}>
        <ReportsPriorityActionContent action={action} />
      </button>
    );
  }

  return (
    <Link className={`reports-action-card reports-action-card--${action.tone}`} to={action.path} aria-label={action.title}>
      <ReportsPriorityActionContent action={action} />
    </Link>
  );
}

function ReportsPage() {
  const {
    accounts,
    accountRoles,
    bookings,
    checkIns,
    clearStaleQueuedTexts,
    childAccounts,
    contacts,
    deletePastOneTimeScheduledClasses,
    directMessages,
    leadReviews,
    managedAccounts,
    merchandiseItems,
    messageCampaigns,
    messageLogs,
    messageNotificationSettings,
    orders,
    restockLowInventory,
    reviewLeadFollowUps,
    restoreOperationsBackup,
    scheduledClasses,
    scheduledTextCampaigns,
    sendBeltTestInvites,
    sendAttendanceGapCheckIns,
    sendClassReminders,
    sendCelebrationOutreach,
    sendMissedClassFollowUps,
    sendMilestoneEncouragements,
    sendNewStudentCheckIns,
    sendPausedStudentReactivationFollowUps,
    sendProfileUpdateRequests,
    sendQueuedTexts,
    sendTrialConversionFollowUps,
    showToast,
    studioClasses,
    studioEvents,
    students,
    textAutomationRuns,
    studyGuideFolders,
    studyGuideMaterials,
    trainingVideoFolders,
    trainingVideos
  } = useAppState();
  const backupRestoreInputRef = useRef<HTMLInputElement>(null);
  const today = toDateKey(useLiveCalendarDate());
  const backupInput = {
    accounts,
    accountRoles,
    managedAccounts,
    childAccounts,
    students,
    studioClasses,
    scheduledClasses,
    messageCampaigns,
    scheduledTextCampaigns,
    messageLogs,
    automationRuns: textAutomationRuns,
    directMessages,
    messagingSetup: buildProductionMessagingSetupBackupInput(messageNotificationSettings),
    studioEvents,
    merchandiseItems,
    checkIns,
    trainingVideoFolders,
    trainingVideos,
    studyGuideFolders,
    studyGuideMaterials,
    orders,
    bookings,
    contacts,
    leadReviews
  };
  const report = useMemo(
    () =>
      buildReportsCommandCenter({
        today,
        students,
        checkIns,
        scheduledClasses,
        studioClasses,
        studioEvents,
        messageLogs,
        managedAccounts,
        directMessages,
        merchandiseItems,
        bookings,
        contacts,
        leadReviews
      }),
    [bookings, checkIns, contacts, directMessages, leadReviews, managedAccounts, merchandiseItems, messageLogs, scheduledClasses, studioClasses, studioEvents, students, today]
  );
  const backupSnapshot = useMemo(
    () => buildOperationsBackupSnapshot(backupInput),
    [
      accounts,
      accountRoles,
      bookings,
      checkIns,
      childAccounts,
      contacts,
      directMessages,
      leadReviews,
      managedAccounts,
      merchandiseItems,
      messageNotificationSettings,
      messageCampaigns,
      messageLogs,
      orders,
      scheduledClasses,
      scheduledTextCampaigns,
      studioClasses,
      studioEvents,
      students,
      textAutomationRuns,
      studyGuideFolders,
      studyGuideMaterials,
      trainingVideoFolders,
      trainingVideos
    ]
  );
  const visibleBackupSections = backupSnapshot.sections.filter((section) => section.count > 0);
  const topAttendanceRisks = report.attendanceRisks.slice(0, 4);
  const topAttendanceGapCandidates = report.attendanceGapCandidates.slice(0, 4);
  const topLeadCandidates = report.leadCandidates.slice(0, 4);
  const topDirectMessageReplyCandidates = report.directMessageReplyCandidates.slice(0, 4);
  const topNewStudentCheckInCandidates = report.newStudentCheckInCandidates.slice(0, 4);
  const topCelebrationCandidates = report.celebrationCandidates.slice(0, 4);
  const topProfileUpdateCandidates = report.profileUpdateCandidates.slice(0, 4);
  const topClassReminderCandidates = report.classReminderCandidates.slice(0, 4);
  const topMilestoneCandidates = report.milestoneCandidates.slice(0, 4);
  const topTestCandidates = report.testReadinessCandidates.slice(0, 4);
  const topCalendarItems = report.upcomingCalendarItems.slice(0, 4);
  const exportOperationsBackup = () => {
    const snapshot = buildOperationsBackupSnapshot(backupInput);
    downloadTextFile(makeOperationsBackupFilename(snapshot.exportedAt), JSON.stringify(snapshot, null, 2), "application/json");
    showToast("Operations backup JSON exported.");
  };
  const importOperationsBackup = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = restoreOperationsBackup(String(reader.result ?? ""));
        if (!result) {
          showToast("Backup restore failed.");
          return;
        }
        showToast(`Operations backup restored: ${result.restoredRecords} record${result.restoredRecords === 1 ? "" : "s"} across ${result.restoredSections} section${result.restoredSections === 1 ? "" : "s"}.`);
      } catch (error) {
        showToast(error instanceof Error ? `Backup restore failed: ${error.message}` : "Backup restore failed.");
      } finally {
        if (backupRestoreInputRef.current) {
          backupRestoreInputRef.current.value = "";
        }
      }
    };
    reader.onerror = () => {
      showToast("Backup restore failed: the selected file could not be read.");
      if (backupRestoreInputRef.current) {
        backupRestoreInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };
  const runReportsAction = (action: ReportsPriorityAction) => {
    if (action.id === "belt-test-invites") {
      const count = sendBeltTestInvites();
      showToast(count ? `${count} belt testing invitation text${count === 1 ? "" : "s"} queued.` : "No belt testing invitations needed.");
      return;
    }
    if (action.id === "trial-conversions") {
      const count = sendTrialConversionFollowUps();
      showToast(count ? `${count} trial conversion text${count === 1 ? "" : "s"} queued.` : "No trial conversion follow-ups needed.");
      return;
    }
    if (action.id === "new-student-check-ins") {
      const count = sendNewStudentCheckIns();
      showToast(count ? `${count} new-student check-in text${count === 1 ? "" : "s"} queued.` : "No new-student check-ins needed.");
      return;
    }
    if (action.id === "attendance-gap-check-ins") {
      const count = sendAttendanceGapCheckIns();
      showToast(count ? `${count} attendance gap check-in text${count === 1 ? "" : "s"} queued.` : "No attendance-gap check-ins needed.");
      return;
    }
    if (action.id === "celebration-outreach") {
      const count = sendCelebrationOutreach();
      showToast(count ? `${count} celebration text${count === 1 ? "" : "s"} queued.` : "No celebration outreach needed.");
      return;
    }
    if (action.id === "profile-updates") {
      const count = sendProfileUpdateRequests();
      showToast(count ? `${count} profile update text${count === 1 ? "" : "s"} queued.` : "No profile update requests needed.");
      return;
    }
    if (action.id === "lead-follow-ups") {
      const count = reviewLeadFollowUps();
      showToast(count ? `${count} lead follow-up${count === 1 ? "" : "s"} marked reviewed.` : "No public leads need review.");
      return;
    }
    if (action.id === "class-reminders") {
      const count = sendClassReminders();
      showToast(count ? `${count} class reminder text${count === 1 ? "" : "s"} queued.` : "No class reminders needed.");
      return;
    }
    if (action.id === "milestone-encouragement") {
      const count = sendMilestoneEncouragements();
      showToast(count ? `${count} milestone encouragement text${count === 1 ? "" : "s"} queued.` : "No milestone encouragements needed.");
      return;
    }
    if (action.id === "paused-students") {
      const count = sendPausedStudentReactivationFollowUps();
      showToast(count ? `${count} paused-student reactivation text${count === 1 ? "" : "s"} queued.` : "No paused-student reactivation follow-ups needed.");
      return;
    }
    if (action.id === "low-stock") {
      const count = restockLowInventory();
      showToast(count ? `${count} low-stock item${count === 1 ? "" : "s"} restocked to par.` : "No low-stock inventory needs restocking.");
      return;
    }
    if (action.id === "stale-queued-text-cleanup") {
      const count = clearStaleQueuedTexts();
      showToast(count ? `${count} stale queued text${count === 1 ? "" : "s"} removed.` : "No stale queued texts need cleanup.");
      return;
    }
    if (action.id === "stale-schedule-cleanup") {
      const removed = deletePastOneTimeScheduledClasses(today);
      showToast(removed.length ? `${removed.length} stale one-time schedule item${removed.length === 1 ? "" : "s"} removed.` : "No stale one-time schedule items need cleanup.");
      return;
    }
    if (action.id === "queued-texts") {
      const count = sendQueuedTexts();
      showToast(count ? `${count} queued text${count === 1 ? "" : "s"} sent.` : "No queued texts are waiting.");
      return;
    }
    const count = sendMissedClassFollowUps();
    showToast(count ? `${count} missed-class follow-up text${count === 1 ? "" : "s"} queued.` : "No missed-class follow-ups needed.");
  };

  return (
    <OperationsPage className="operations-page--workflow reports-command-page" title="Reports" text="See the work that needs attention first: attendance recovery, trial conversions, testing readiness, queued outreach, inventory, and the next studio dates.">
      <div className="operations-stats reports-stats">
        <ReportsMetricCard label="Current students" value={report.summary.currentStudents} icon={<Users />} />
        <ReportsMetricCard label="Missed-class follow-ups" value={report.summary.attendanceFollowUps} icon={<MessageCircle />} />
        <ReportsMetricCard label="Attendance gaps" value={report.summary.attendanceGapFollowUps} icon={<MessageCircle />} />
        <ReportsMetricCard label="Trial follow-ups" value={report.summary.trialFollowUps} icon={<UserPlus />} />
        <ReportsMetricCard label="Lead follow-ups" value={report.summary.leadFollowUps} icon={<UserPlus />} />
        <ReportsMetricCard label="App replies" value={report.summary.directMessageReplies} icon={<MessagesSquare />} />
        <ReportsMetricCard label="New student check-ins" value={report.summary.newStudentCheckIns} icon={<MessageCircle />} />
        <ReportsMetricCard label="Celebrations" value={report.summary.celebrationOutreach} icon={<CalendarDays />} />
        <ReportsMetricCard label="Profile updates" value={report.summary.profileUpdateRequests} icon={<ShieldCheck />} />
        <ReportsMetricCard label="Class reminders" value={report.summary.classReminders} icon={<Mail />} />
        <ReportsMetricCard label="Milestone nudges" value={report.summary.milestoneEncouragements} icon={<Target />} />
        <ReportsMetricCard label="Test invites" value={report.summary.testReadinessFollowUps} icon={<Award />} />
        <ReportsMetricCard label="Check-ins this week" value={report.summary.checkInsThisWeek} icon={<CheckCircle2 />} />
      </div>

      <section className="operations-panel reports-command-panel" aria-labelledby="reports-command-title">
        <div className="student-roster-head">
          <div>
            <h2 id="reports-command-title">Workload Command Center</h2>
            <p>Jump directly to the tasks most likely to reduce staff follow-up time this week.</p>
          </div>
        </div>
        <div className="reports-action-grid" aria-label="Priority report actions">
          {report.priorityActions.map((action) => (
            <ReportsPriorityActionCard key={action.id} action={action} onRunAction={runReportsAction} />
          ))}
        </div>
      </section>

      <div className="reports-command-grid">
        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-label="Public lead follow-up candidates">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-leads-title">Public Lead Follow-Up</h2>
              <p>{report.summary.leadFollowUps} public contact or starter booking lead{report.summary.leadFollowUps === 1 ? " needs" : "s need"} staff follow-up.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Public lead follow-up list">
            {topLeadCandidates.length ? topLeadCandidates.map((candidate) => (
              <article className="reports-compact-row" key={`${candidate.kind}-${candidate.id}`}>
                <span className="workflow-directory-icon workflow-directory-icon--student" aria-hidden="true" />
                <span>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.detail}</small>
                  <small>{candidate.note}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No public starter bookings or contact inquiries need follow-up.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-label="Unanswered app message reply candidates">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-direct-messages-title">App Message Replies</h2>
              <p>{report.summary.directMessageReplies} inbound student or parent app message{report.summary.directMessageReplies === 1 ? "" : "s"} {report.summary.directMessageReplies === 1 ? "needs" : "need"} staff replies.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="App message reply list">
            {topDirectMessageReplyCandidates.length ? topDirectMessageReplyCandidates.map((candidate) => (
              <article className="reports-compact-row" key={candidate.id}>
                <span className="workflow-directory-icon workflow-directory-icon--message" aria-hidden="true" />
                <span>
                  <strong>{directMessageReplyCandidateLabel(candidate)}</strong>
                  <small>{directMessageReplyCandidateContext(candidate)}</small>
                  <small>{candidate.body}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No inbound student or parent app messages need staff replies.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-label="New student check-in candidates">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-new-students-title">New Student Check-Ins</h2>
              <p>{report.summary.newStudentCheckIns} new student{report.summary.newStudentCheckIns === 1 ? "" : "s"} need a first-week retention check-in.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="New student check-in list">
            {topNewStudentCheckInCandidates.length ? topNewStudentCheckInCandidates.map((student) => (
              <article className="reports-compact-row" key={student.id}>
                <span className="workflow-directory-icon workflow-directory-icon--student" aria-hidden="true" />
                <span>
                  <strong>{student.name}</strong>
                  <small>{newStudentCheckInCandidateLabel(student)}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No first-week student check-ins are waiting.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-labelledby="reports-attendance-title">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-attendance-title">Attendance Recovery</h2>
              <p>{report.summary.attendanceFollowUps} current student{report.summary.attendanceFollowUps === 1 ? "" : "s"} need follow-up before they drift further.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Attendance risk students">
            {topAttendanceRisks.length ? topAttendanceRisks.map((student) => (
              <article className="reports-compact-row" key={student.id}>
                <span className="workflow-directory-icon workflow-directory-icon--schedule" aria-hidden="true" />
                <span>
                  <strong>{student.name}</strong>
                  <small>{student.status} · {student.missedClassCount} missed classes{student.lastContactedAt ? ` · Last contact ${student.lastContactedAt}` : ""}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No current students are above the missed-class follow-up threshold.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-label="Attendance gap check-in candidates">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-attendance-gap-title">Attendance Gap Check-Ins</h2>
              <p>{report.summary.attendanceGapFollowUps} active student{report.summary.attendanceGapFollowUps === 1 ? "" : "s"} have not checked in for three weeks or more.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Attendance gap check-in list">
            {topAttendanceGapCandidates.length ? topAttendanceGapCandidates.map((student) => (
              <article className="reports-compact-row" key={student.id}>
                <span className="workflow-directory-icon workflow-directory-icon--schedule" aria-hidden="true" />
                <span>
                  <strong>{student.name}</strong>
                  <small>{attendanceGapCandidateLabel(student)}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No attendance-gap check-ins are waiting.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-labelledby="reports-celebration-title">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-celebration-title">Celebration Outreach</h2>
              <p>{report.summary.celebrationOutreach} current student birthday or training anniversar{report.summary.celebrationOutreach === 1 ? "y is" : "ies are"} due this week.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Celebration outreach candidates">
            {topCelebrationCandidates.length ? topCelebrationCandidates.map((student) => (
              <article className="reports-compact-row" key={`${student.id}-${student.reason}`}>
                <span className="workflow-directory-icon workflow-directory-icon--event" aria-hidden="true" />
                <span>
                  <strong>{student.name}</strong>
                  <small>{celebrationCandidateLabel(student)}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No current student birthdays or training anniversaries are due this week.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-labelledby="reports-profile-update-title">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-profile-update-title">Student Data Cleanup</h2>
              <p>{report.summary.profileUpdateRequests} current student record{report.summary.profileUpdateRequests === 1 ? " needs" : "s need"} profile-update outreach for safer contact and emergency data.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Student profile update candidates">
            {topProfileUpdateCandidates.length ? topProfileUpdateCandidates.map((student) => (
              <article className="reports-compact-row" key={student.id}>
                <span className="workflow-directory-icon workflow-directory-icon--schedule" aria-hidden="true" />
                <span>
                  <strong>{student.name}</strong>
                  <small>{profileUpdateCandidateLabel(student)}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No current student records need profile-update outreach.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-labelledby="reports-class-reminders-title">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-class-reminders-title">Upcoming Class Reminders</h2>
              <p>{report.summary.classReminders} student-specific class reminder{report.summary.classReminders === 1 ? " is" : "s are"} due in the next two days.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Upcoming class reminder candidates">
            {topClassReminderCandidates.length ? topClassReminderCandidates.map((item) => (
              <article className="reports-compact-row" key={item.id}>
                <span className="workflow-directory-icon workflow-directory-icon--schedule" aria-hidden="true" />
                <span>
                  <strong>{item.studentName}</strong>
                  <small>{classReminderCandidateLabel(item)}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No student-specific classes need reminder outreach in the next two days.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-labelledby="reports-milestone-title">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-milestone-title">Milestone Encouragement</h2>
              <p>{report.summary.milestoneEncouragements} current student{report.summary.milestoneEncouragements === 1 ? "" : "s"} are close enough to their next belt milestone for proactive encouragement.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Near-testing milestone candidates">
            {topMilestoneCandidates.length ? topMilestoneCandidates.map((student) => (
              <article className="reports-compact-row" key={student.id}>
                <span className="workflow-directory-icon workflow-directory-icon--event" aria-hidden="true" />
                <span>
                  <strong>{student.name}</strong>
                  <small>{student.beltRank} · {student.progressPercent}% · {student.classesRemaining} class{student.classesRemaining === 1 ? "" : "es"} to {student.nextRankName ?? "next rank"}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No current students are close enough for milestone encouragement today.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-labelledby="reports-testing-title">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-testing-title">Testing Readiness</h2>
              <p>{report.summary.testReadinessFollowUps} current student{report.summary.testReadinessFollowUps === 1 ? "" : "s"} meet class-count and consistency criteria for testing outreach.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Belt testing candidates">
            {topTestCandidates.length ? topTestCandidates.map((student) => (
              <article className="reports-compact-row" key={student.id}>
                <span className="workflow-directory-icon workflow-directory-icon--event" aria-hidden="true" />
                <span>
                  <strong>{student.name}</strong>
                  <small>{student.beltRank} · {student.classesAttended}/{student.classesRequired} classes</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No current students are ready for belt testing outreach.</p>
            )}
          </div>
        </section>

        <section className="operations-panel workflow-directory-panel reports-detail-panel" aria-labelledby="reports-calendar-title">
          <div className="student-roster-head">
            <div>
              <h2 id="reports-calendar-title">Next Seven Days</h2>
              <p>{report.summary.upcomingCalendarItems} dated schedule item{report.summary.upcomingCalendarItems === 1 ? " needs" : "s need"} staffing, promotion, or prep.</p>
            </div>
          </div>
          <div className="reports-compact-list" aria-label="Upcoming report schedule">
            {topCalendarItems.length ? topCalendarItems.map((item) => (
              <article className="reports-compact-row" key={`${item.kind}-${item.id}`}>
                <span className="workflow-directory-icon workflow-directory-icon--event" aria-hidden="true" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.date} at {item.time}</small>
                </span>
              </article>
            )) : (
              <p className="operations-note">No dated schedule items are coming up in the next seven days.</p>
            )}
          </div>
        </section>
      </div>

      <div className="operations-stats reports-stats reports-stats--secondary">
        <ReportsMetricCard label="Queued messages" value={report.summary.queuedMessages} icon={<Mail />} />
        <ReportsMetricCard label="Stale queued texts" value={report.summary.staleQueuedMessages} icon={<Trash2 />} />
        <ReportsMetricCard label="Upcoming dates" value={report.summary.upcomingCalendarItems} icon={<CalendarDays />} />
        <ReportsMetricCard label="Paused follow-ups" value={report.summary.pausedFollowUps} icon={<Target />} />
        <ReportsMetricCard label="Low stock items" value={report.summary.lowStockItems} icon={<Package />} />
        <ReportsMetricCard label="Stale schedule items" value={report.summary.staleScheduleItems} icon={<CalendarDays />} />
      </div>

      <section className="operations-panel workflow-directory-panel reports-detail-panel reports-maintenance-panel" aria-label="Operations data backup">
        <div className="student-roster-head reports-maintenance-head">
          <div>
            <h2>Data Health &amp; Backup</h2>
            <p>Export one timestamped JSON copy of the current local operations data before major edits, device moves, or cleanup work.</p>
          </div>
          <button className="reports-backup-button" type="button" onClick={exportOperationsBackup}>
            <FileText size={17} /> Export operations backup
          </button>
          <button className="reports-backup-button reports-restore-button" type="button" onClick={() => backupRestoreInputRef.current?.click()}>
            <Upload size={17} /> Import operations backup
          </button>
          <input
            ref={backupRestoreInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="Import operations backup"
            onChange={importOperationsBackup}
          />
        </div>
        <div className="operations-stats reports-backup-stats">
          <ReportsMetricCard label="Tracked records" value={backupSnapshot.summary.totalRecords} icon={<ShieldCheck />} />
          <ReportsMetricCard label="Data sections" value={backupSnapshot.summary.sections} icon={<FileText />} />
          <ReportsMetricCard label="Empty sections" value={backupSnapshot.summary.emptySections} icon={<Target />} />
        </div>
        <div className="reports-backup-section-list" aria-label="Backup data sections">
          {visibleBackupSections.map((section) => (
            <span key={section.id}>{section.count} {section.shortLabel}</span>
          ))}
        </div>
        <p className="operations-note">Saved account passwords, Twilio credentials, VAPID private keys, and raw PushSubscription key material are not included in the export.</p>
        <p className="operations-note">Includes student records, account access, classes, schedules, messages, automation run history, check-ins, merchandise, content libraries, orders, bookings, contacts, lead reviews, and non-secret messaging setup.</p>
      </section>
    </OperationsPage>
  );
}

const genderOptions = ["Not specified", "Female", "Male", "Nonbinary", "Prefer not to say"];
const statusOptions = ["Active", "Trial", "Paused", "Inactive"];
const studentDirectoryStatusFilters = ["All", ...statusOptions] as const;
type StudentDirectoryStatusFilter = typeof studentDirectoryStatusFilters[number];

function normalizeStudentDirectoryStatus(student: StudentRecord) {
  const status = student.status?.trim().toLowerCase();
  return statusOptions.find((option) => option.toLowerCase() === status) ?? "Active";
}

function studentDirectorySearchText(student: StudentRecord) {
  return [
    fullName(student),
    student.email,
    student.phone,
    student.guardianName,
    student.guardianPhone,
    student.guardianEmail,
    student.emergencyContactName,
    student.emergencyContactRelationship,
    student.emergencyContactPhone,
    student.emergencyContactEmail,
    student.program,
    normalizeStudentDirectoryStatus(student),
    student.beltRank,
    student.notes
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function makeBlankStudentForm() {
  return {
    fullName: "",
    dateOfBirth: "",
    gender: "Not specified",
    studentEmail: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    emergencyContactEmail: "",
    enrollmentDate: new Date().toISOString().slice(0, 10),
    program: "Youth Foundations",
    status: "Active",
    beltRank: "White",
    notes: ""
  };
}

function studentToForm(student: StudentRecord) {
  return {
    fullName: fullName(student),
    dateOfBirth: student.dateOfBirth ?? "",
    gender: student.gender ?? "Not specified",
    studentEmail: student.email,
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? student.phone,
    guardianEmail: student.guardianEmail ?? "",
    emergencyContactName: student.emergencyContactName ?? "",
    emergencyContactRelationship: student.emergencyContactRelationship ?? "",
    emergencyContactPhone: student.emergencyContactPhone ?? "",
    emergencyContactEmail: student.emergencyContactEmail ?? "",
    enrollmentDate: student.enrollmentDate ?? student.joinedAt,
    program: student.program ?? "Youth Foundations",
    status: student.status ?? "Active",
    beltRank: student.beltRank,
    notes: student.notes ?? ""
  };
}

function slugClassName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function beltClassName(rank: string) {
  return slugClassName(rank);
}

function audienceLabel(value: StudioEvent["audience"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const studentDirectoryAgeReferenceDate = new Date("2026-05-17T00:00:00");

function parseStudentBirthDate(value?: string) {
  if (!value) return undefined;
  const birthDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(birthDate.getTime()) ? undefined : birthDate;
}

function studentDirectoryAge(student: StudentRecord) {
  const birthDate = parseStudentBirthDate(student.dateOfBirth);
  if (!birthDate) return "Not set";

  let age = studentDirectoryAgeReferenceDate.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    studentDirectoryAgeReferenceDate.getMonth() > birthDate.getMonth() ||
    (studentDirectoryAgeReferenceDate.getMonth() === birthDate.getMonth() && studentDirectoryAgeReferenceDate.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;

  return age.toString();
}

function StudentsPage() {
  const {
    students,
    messageLogs,
    addOperationsStudent,
    updateOperationsStudent,
    deleteOperationsStudent,
    queueStudentMilestoneEncouragement,
    queueStudentProfileUpdateRequest,
    showToast
  } = useAppState();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const [form, setForm] = useState(makeBlankStudentForm);
  const [studentModalMode, setStudentModalMode] = useState<"create" | "edit" | null>(null);
  const [statusFilter, setStatusFilter] = useState<StudentDirectoryStatusFilter>("All");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const welcomeLogs = messageLogs.filter((message) => message.kind === "welcome");
  const normalizedStudentSearchQuery = studentSearchQuery.trim().toLowerCase();
  const statusCounts = useMemo(() => {
    const counts = studentDirectoryStatusFilters.reduce(
      (current, option) => ({ ...current, [option]: option === "All" ? students.length : 0 }),
      {} as Record<StudentDirectoryStatusFilter, number>
    );
    students.forEach((student) => {
      counts[normalizeStudentDirectoryStatus(student)] += 1;
    });
    return counts;
  }, [students]);
  const statusFilteredStudents = useMemo(
    () => (statusFilter === "All" ? students : students.filter((student) => normalizeStudentDirectoryStatus(student) === statusFilter)),
    [statusFilter, students]
  );
  const visibleStudents = useMemo(
    () =>
      normalizedStudentSearchQuery
        ? statusFilteredStudents.filter((student) => studentDirectorySearchText(student).includes(normalizedStudentSearchQuery))
        : statusFilteredStudents,
    [normalizedStudentSearchQuery, statusFilteredStudents]
  );
  const directorySummary =
    normalizedStudentSearchQuery
      ? statusFilter === "All"
        ? `${visibleStudents.length} student${visibleStudents.length === 1 ? "" : "s"} matches search. Clear search to show everyone.`
        : visibleStudents.length
          ? `${visibleStudents.length} ${statusFilter.toLowerCase()} student${visibleStudents.length === 1 ? "" : "s"} matches search. Clear search to show everyone.`
          : `No ${statusFilter.toLowerCase()} students match this search.`
      : statusFilter === "All"
      ? `${students.length} student${students.length === 1 ? "" : "s"} listed by belt. Select a name to open student info.`
      : `${visibleStudents.length} ${statusFilter.toLowerCase()} student${visibleStudents.length === 1 ? "" : "s"} listed by belt. Clear filter to show everyone.`;

  const studentsByBelt = useMemo(() => {
    const knownBelts = beltOptions.map((belt) => belt.toLowerCase());
    const studentsByName = [...visibleStudents].sort((left, right) => fullName(left).localeCompare(fullName(right), undefined, { sensitivity: "base" }));
    const configuredGroups = beltOptions
      .map((belt) => ({
        belt,
        students: studentsByName.filter((student) => student.beltRank.toLowerCase() === belt.toLowerCase())
      }))
      .filter((group) => group.students.length > 0);
    const customGroups = Array.from(new Set(studentsByName.map((student) => student.beltRank).filter((rank) => !knownBelts.includes(rank.toLowerCase()))))
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map((belt) => ({
        belt,
        students: studentsByName.filter((student) => student.beltRank === belt)
      }));

    return [...configuredGroups, ...customGroups];
  }, [visibleStudents]);

  const selectStudent = (student: StudentRecord) => {
    setSelectedStudentId(student.id);
    setForm(studentToForm(student));
    setStudentModalMode("edit");
  };

  const openCreateStudent = () => {
    setSelectedStudentId("");
    setForm(makeBlankStudentForm());
    setStudentModalMode("create");
  };

  const closeStudentModal = () => {
    setStudentModalMode(null);
    setSelectedStudentId("");
    setForm(makeBlankStudentForm());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selectedStudent) {
      const updated = updateOperationsStudent(selectedStudent.id, form);
      if (!updated) {
        showToast("Enter student name, phone, and email.");
        return;
      }
      setForm(studentToForm(updated));
      setStudentModalMode(null);
      showToast(`${fullName(updated)} updated.`);
      return;
    }

    const created = addOperationsStudent(form);
    if (!created) {
      showToast("Enter student name, phone, and email.");
      return;
    }
    closeStudentModal();
    showToast(isCurrentOperationsStudent(created) ? `${fullName(created)} added with welcome text queued.` : `${fullName(created)} added.`);
  };

  const deleteSelectedStudent = () => {
    if (!selectedStudent) return;
    const deleted = deleteOperationsStudent(selectedStudent.id);
    if (!deleted) {
      showToast("Select a student to delete.");
      return;
    }
    closeStudentModal();
    showToast(`${fullName(deleted)} deleted from the student list.`);
  };

  const queueSelectedStudentMilestoneEncouragement = () => {
    if (!selectedStudent) return;
    if (!isCurrentOperationsStudent(selectedStudent)) {
      showToast("Only current students can receive quick outreach.");
      return;
    }
    const queuedMessage = queueStudentMilestoneEncouragement(selectedStudent.id);
    showToast(queuedMessage ? `Progress encouragement queued for ${fullName(selectedStudent)}.` : "Add a phone number before queuing outreach.");
  };

  const queueSelectedStudentProfileUpdateRequest = () => {
    if (!selectedStudent) return;
    if (!isCurrentOperationsStudent(selectedStudent)) {
      showToast("Only current students can receive quick outreach.");
      return;
    }
    const queuedMessage = queueStudentProfileUpdateRequest(selectedStudent.id);
    showToast(queuedMessage ? `Profile update request queued for ${fullName(selectedStudent)}.` : "Add a phone number before queuing outreach.");
  };

  const renderStudentNameButton = (student: StudentRecord) => {
    const studentName = fullName(student);
    const genderLabel = student.gender?.trim() || "Not set";

    return (
      <button key={student.id} type="button" className="student-name-list-button" data-testid="student-name-list-button" aria-label={`Open ${studentName} student info`} onClick={() => selectStudent(student)}>
        <span className="student-name-list-icon" aria-hidden="true" />
        <span className="student-name-list-name">{studentName}</span>
        <span className="student-name-list-cell student-name-list-cell--gender">{genderLabel}</span>
        <span className="student-name-list-cell student-name-list-cell--age">{studentDirectoryAge(student)}</span>
      </button>
    );
  };

  const headerAction = (
    <button type="button" className="operations-action student-header-add" onClick={openCreateStudent}>
      <Plus size={18} /> Create New Student
    </button>
  );
  const modalTitle = selectedStudent ? `${fullName(selectedStudent)} Student Info` : "Create New Student";
  const selectedStudentName = selectedStudent ? fullName(selectedStudent) : "";

  return (
    <OperationsPage className="operations-page--students" title="Students" text="Review each belt group as a compact student list, then select a student name to open their full info." action={headerAction}>
      <div className="students-workspace students-workspace--directory">
        <section className="operations-panel student-roster-panel student-directory-panel student-directory-panel--compact">
          <div className="student-roster-head">
            <div>
              <h2>Student Directory</h2>
              <p>{directorySummary}</p>
            </div>
            <div className="student-directory-tools">
              <label className="student-directory-search">
                <span className="sr-only">Search students</span>
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={studentSearchQuery}
                  aria-label="Search students"
                  placeholder="Search students"
                  onChange={(event) => setStudentSearchQuery(event.target.value)}
                />
                {studentSearchQuery && (
                  <button type="button" aria-label="Clear student search" onClick={() => setStudentSearchQuery("")}>
                    <X size={13} />
                  </button>
                )}
              </label>
              <div className="student-directory-status-filters" aria-label="Student status filters">
                {studentDirectoryStatusFilters.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="student-directory-status-filter"
                    aria-label={option === "All" ? `Show all students (${statusCounts[option]})` : `Show ${option} students (${statusCounts[option]})`}
                    aria-pressed={statusFilter === option}
                    onClick={() => setStatusFilter(option)}
                  >
                    <span>{option}</span>
                    <strong>{statusCounts[option]}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="student-directory-scroll student-belt-directory-grid" aria-label="Student directory by belt">
            {studentsByBelt.length ? studentsByBelt.map(({ belt, students: beltStudents }) => (
              <section key={belt} className={`student-belt-group student-belt-group--card student-belt-group--${beltClassName(belt)}`} role="group" aria-label={`${belt} belt students`}>
                <div className="student-belt-group-head">
                  <div>
                    <span className="student-belt-group-swatch" aria-hidden="true" />
                    <h3>{belt} Belt</h3>
                  </div>
                  <span>{beltStudents.length} student{beltStudents.length === 1 ? "" : "s"}</span>
                </div>
                <div className="student-name-list">
                  <div className="student-name-list-head" aria-hidden="true">
                    <span aria-hidden="true" />
                    <span className="student-name-list-column-label">Name</span>
                    <span className="student-name-list-column-label">Gender</span>
                    <span className="student-name-list-column-label">Age</span>
                  </div>
                  {beltStudents.map(renderStudentNameButton)}
                </div>
              </section>
            )) : (
              <p className="operations-note student-directory-empty">
                {normalizedStudentSearchQuery ? "No matching students in this view." : `No ${statusFilter.toLowerCase()} students match this filter.`}
              </p>
            )}
          </div>
        </section>

        <section className="operations-panel student-welcome-panel">
          <h2>Welcome Text Queue</h2>
          {welcomeLogs.length ? welcomeLogs.map((message) => <MessagePreview key={message.id} message={message} />) : <p>No welcome texts queued yet.</p>}
        </section>
      </div>

      {studentModalMode && (
        <div className="modal-backdrop student-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeStudentModal()}>
          <form
            aria-labelledby="student-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="student-modal-title">{modalTitle}</h2>
                <p>{selectedStudent ? "Review or update student records, contacts, enrollment, belt rank, and notes." : "Enter the full student profile before adding them to the directory."}</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close student form" onClick={closeStudentModal}>
                <X size={18} />
              </button>
            </div>

            {selectedStudent && (
              <section className="student-quick-outreach" aria-label="Student quick outreach">
                <div>
                  <h3>Quick Outreach</h3>
                  <p>Queue a personal text from this record without leaving the student profile.</p>
                </div>
                <div className="student-quick-outreach-actions">
                  <button type="button" aria-label={`Queue progress encouragement for ${selectedStudentName}`} onClick={queueSelectedStudentMilestoneEncouragement}>
                    <Award size={16} /> Progress Encouragement
                  </button>
                  <button type="button" aria-label={`Request profile update from ${selectedStudentName}`} onClick={queueSelectedStudentProfileUpdateRequest}>
                    <ShieldCheck size={16} /> Request Profile Update
                  </button>
                </div>
              </section>
            )}

            <section className="student-form-section">
              <h3>Student Information</h3>
              <div className="student-form-grid">
                <label>
                  Full Name
                  <input autoFocus value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
                </label>
                <label>
                  Date of Birth
                  <input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
                </label>
                <label>
                  Gender
                  <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
                    {genderOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Student Email
                  <input inputMode="email" value={form.studentEmail} onChange={(event) => setForm({ ...form, studentEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Parent/Guardian Information</h3>
              <div className="student-form-grid">
                <label>
                  Parent/Guardian Name
                  <input value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} />
                </label>
                <label>
                  Phone Number
                  <input aria-label="Parent/Guardian Phone Number" value={form.guardianPhone} onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })} />
                </label>
                <label>
                  Email Address
                  <input aria-label="Parent/Guardian Email Address" inputMode="email" value={form.guardianEmail} onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Emergency Contact Information</h3>
              <div className="student-form-grid">
                <label>
                  Contact Name
                  <input aria-label="Emergency Contact Name" value={form.emergencyContactName} onChange={(event) => setForm({ ...form, emergencyContactName: event.target.value })} />
                </label>
                <label>
                  Relationship
                  <input aria-label="Emergency Relationship" value={form.emergencyContactRelationship} onChange={(event) => setForm({ ...form, emergencyContactRelationship: event.target.value })} />
                </label>
                <label>
                  Phone Number
                  <input aria-label="Emergency Phone Number" value={form.emergencyContactPhone} onChange={(event) => setForm({ ...form, emergencyContactPhone: event.target.value })} />
                </label>
                <label>
                  Email Address
                  <input aria-label="Emergency Email Address" inputMode="email" value={form.emergencyContactEmail} onChange={(event) => setForm({ ...form, emergencyContactEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Enrollment Details</h3>
              <div className="student-form-grid">
                <label>
                  Enrollment Date
                  <input type="date" value={form.enrollmentDate} onChange={(event) => setForm({ ...form, enrollmentDate: event.target.value })} />
                </label>
                <label>
                  Program
                  <input value={form.program} onChange={(event) => setForm({ ...form, program: event.target.value })} />
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Belt rank
                  <select value={form.beltRank} onChange={(event) => setForm({ ...form, beltRank: event.target.value })}>
                    {beltOptions.map((rank) => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
            </section>

            <div className="student-editor-actions">
              <button type="submit">
                <Plus size={18} /> {selectedStudent ? "Save Student Changes" : "Create Student"}
              </button>
              {selectedStudent && (
                <button type="button" className="student-delete-action" onClick={deleteSelectedStudent}>
                  <Trash2 size={18} /> Delete Student
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

const blankClassForm = {
  name: "",
  daysOfWeek: [] as ClassWeekday[],
  startTime: "17:00",
  endTime: "17:45",
  recurring: true,
  titleColor: "#b8f5e2",
  notes: ""
};

function studioClassToForm(studioClass: StudioClass) {
  return {
    name: studioClass.name,
    daysOfWeek: studioClass.daysOfWeek,
    startTime: studioClass.startTime,
    endTime: studioClass.endTime,
    recurring: studioClass.recurring ?? true,
    titleColor: studioClass.titleColor ?? "#b8f5e2",
    notes: studioClass.notes ?? ""
  };
}

function ClassCard({ studioClass, onSelect }: { studioClass: StudioClass; onSelect: (studioClass: StudioClass) => void }) {
  const className = studioClass.name;

  return (
    <button type="button" className="workflow-directory-row workflow-directory-row--button workflow-directory-row--class" aria-label={`Edit ${className}`} onClick={() => onSelect(studioClass)}>
      <span className="workflow-directory-icon workflow-directory-icon--class" style={studioClass.titleColor ? { "--workflow-accent": studioClass.titleColor } as CSSProperties : undefined} aria-hidden="true" />
      <span className="workflow-directory-name" style={studioClass.titleColor ? { color: studioClass.titleColor } : undefined}>{className}</span>
      <span className="workflow-directory-cell">{formatClassDays(studioClass.daysOfWeek)}</span>
      <span className="workflow-directory-cell">{formatClassTimeRange(studioClass)}</span>
      <span className="workflow-directory-cell">{studioClass.recurring === false ? "Not recurring on calendar" : "Repeats weekly on calendar"}</span>
    </button>
  );
}

function ClassesPage() {
  const { studioClasses, addStudioClass, updateStudioClass, deleteStudioClass, showToast } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedClassId, setSelectedClassId] = useState("");
  const selectedClass = studioClasses.find((studioClass) => studioClass.id === selectedClassId);
  const [form, setForm] = useState(blankClassForm);
  const [classModalOpen, setClassModalOpen] = useState(false);
  const classGroups = useMemo(
    () => [
      { label: "Recurring Classes", items: studioClasses.filter((studioClass) => studioClass.recurring !== false) },
      { label: "Calendar Off", items: studioClasses.filter((studioClass) => studioClass.recurring === false) }
    ].filter((group) => group.items.length > 0),
    [studioClasses]
  );

  useEffect(() => {
    if (new URLSearchParams(location.search).get("create") !== "class") return;
    setSelectedClassId("");
    setForm(blankClassForm);
    setClassModalOpen(true);
    navigate("/classes", { replace: true });
  }, [location.search, navigate]);

  const resetForm = () => {
    setSelectedClassId("");
    setForm(blankClassForm);
  };

  const openCreateClass = () => {
    resetForm();
    setClassModalOpen(true);
  };

  const closeClassModal = () => {
    setClassModalOpen(false);
    resetForm();
  };

  const selectClass = (studioClass: StudioClass) => {
    setSelectedClassId(studioClass.id);
    setForm(studioClassToForm(studioClass));
    setClassModalOpen(true);
  };

  const toggleDay = (day: ClassWeekday) => {
    setForm((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((item) => item !== day)
        : [...current.daysOfWeek, day].sort((left, right) => left - right) as ClassWeekday[]
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const savedClass = selectedClass
      ? updateStudioClass(selectedClass.id, form)
      : addStudioClass(form);
    if (!savedClass) {
      showToast("Enter a class name, at least one day, and a valid start/end time.");
      return;
    }
    setSelectedClassId(savedClass.id);
    setForm(studioClassToForm(savedClass));
    setClassModalOpen(false);
    showToast(`${savedClass.name} saved to Classes and added to the calendar.`);
  };

  const removeSelectedClass = () => {
    if (!selectedClass) return;
    const removed = deleteStudioClass(selectedClass.id);
    if (!removed) return;
    closeClassModal();
    showToast(`${removed.name} removed from Classes and calendar.`);
  };
  const modalTitle = selectedClass ? `Edit ${selectedClass.name}` : "Create Class";

  return (
    <OperationsPage
      className="operations-page--workflow"
      title="Classes"
      text="Create recurring weekly classes, edit class days, and set start/end times that flow into the main calendar."
      action={
        <button type="button" className="student-header-add" onClick={openCreateClass}>
          <Plus size={18} /> New Class
        </button>
      }
    >
      <section className="operations-panel workflow-directory-panel">
        <div className="student-roster-head">
          <div>
            <h2>Class Directory</h2>
            <p>{studioClasses.length} class{studioClasses.length === 1 ? "" : "es"} organized by calendar status. Select a class row to edit details.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Class directory">
          {classGroups.map((group) => (
            <section key={group.label} className={`workflow-directory-group workflow-directory-group--${slugClassName(group.label)}`} role="group" aria-label={`${group.label} class items`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{group.label}</h3>
                </div>
                <span>{group.items.length} class{group.items.length === 1 ? "" : "es"}</span>
              </div>
              <div className="workflow-directory-list workflow-directory-list--classes">
                <div className="workflow-directory-list-head" aria-hidden="true">
                  <span aria-hidden="true" />
                  <span className="workflow-directory-column-label">Class</span>
                  <span className="workflow-directory-column-label">Days</span>
                  <span className="workflow-directory-column-label">Time</span>
                  <span className="workflow-directory-column-label">Calendar</span>
                </div>
                {group.items.map((studioClass) => (
                  <ClassCard key={studioClass.id} studioClass={studioClass} onSelect={selectClass} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      {classModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeClassModal()}>
          <form
            aria-labelledby="class-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card workflow-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="class-modal-title">{modalTitle}</h2>
                <p>Manage class days, times, calendar recurrence, and display color.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close class editor" onClick={closeClassModal}>
                <X size={18} />
              </button>
            </div>
            <label>
              Class name
              <input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <fieldset className="class-day-picker">
              <legend>Class days</legend>
              {weekdayOptions.map((day) => (
                <label key={day.value}>
                  <input type="checkbox" checked={form.daysOfWeek.includes(day.value)} onChange={() => toggleDay(day.value)} />
                  <span>{day.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="class-time-grid">
              <label>
                Start time
                <input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
              </label>
              <label>
                End time
                <input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
              </label>
            </div>
            <label>
              Title color
              <input type="color" value={form.titleColor} onChange={(event) => setForm({ ...form, titleColor: event.target.value })} />
            </label>
            <label className="operations-checkbox-row">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
              />
              Recurring
            </label>
            <label>
              Class notes
              <textarea value={form.notes} rows={3} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            <div className="student-editor-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> {selectedClass ? "Save Class Changes" : "Create Class"}
              </button>
              {selectedClass && (
                <button type="button" className="student-delete-action" onClick={removeSelectedClass}>
                  <Trash2 size={18} /> Remove Class
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

function ScheduleCard({ item, onRemove, students, todayKey }: { item: ScheduledClass; onRemove: (item: ScheduledClass) => void; students: StudentRecord[]; todayKey: string }) {
  const student = item.studentId ? students.find((entry) => entry.id === item.studentId) : undefined;
  const nextOccurrenceDate = nextWeeklyScheduleOccurrenceDate(item, todayKey);
  const oneTimeStatusLabel = oneTimeScheduleStatusLabel(item, todayKey);
  return (
    <article className="workflow-directory-row workflow-directory-row--schedule">
      <span className="workflow-directory-icon workflow-directory-icon--schedule" style={item.titleColor ? { "--workflow-accent": item.titleColor } as CSSProperties : undefined} aria-hidden="true" />
      <span className="workflow-directory-name" style={item.titleColor ? { color: item.titleColor } : undefined}>
        {item.title}
        <small>{student ? `Student: ${fullName(student)}` : item.notes || scheduleTypeLabel(item.type)}</small>
        <button type="button" className="workflow-row-remove-action" aria-label={`Remove ${item.title} schedule item`} onClick={() => onRemove(item)}>
          <Trash2 size={13} /> Remove
        </button>
      </span>
      <span className="workflow-directory-cell">{item.date}</span>
      <span className="workflow-directory-cell">{item.time}</span>
      <span className="workflow-directory-cell">
        <span>{item.date} at {item.time}</span>
        {item.recurring && (
          <>
            <small>Repeats weekly</small>
            <small>Next occurrence: {nextOccurrenceDate} at {item.time}</small>
          </>
        )}
        {oneTimeStatusLabel && <small>{oneTimeStatusLabel}</small>}
      </span>
    </article>
  );
}

function SchedulePage() {
  const { students, scheduledClasses, addScheduledClass, deleteScheduledClass, deletePastOneTimeScheduledClasses, showToast } = useAppState();
  const todayKey = toDateKey(useLiveCalendarDate());
  const scheduleStudents = useMemo(() => students.filter(isCurrentOperationsStudent), [students]);
  const [form, setForm] = useState({ title: "", date: "2026-05-22", time: "5:30 PM", type: "class", titleColor: "#b8f5e2", recurring: false, studentId: "", notes: "" });
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [customScheduleTypes, setCustomScheduleTypes] = useState<string[]>([]);
  const [isCustomTypeDialogOpen, setIsCustomTypeDialogOpen] = useState(false);
  const [newScheduleTypeName, setNewScheduleTypeName] = useState("");
  const scheduleTypeOptions = useMemo(() => {
    const options = new Map(defaultScheduleTypeOptions.map((option) => [option.value, option]));
    customScheduleTypes.forEach((type) => {
      const trimmed = type.trim();
      if (trimmed && !options.has(trimmed)) {
        options.set(trimmed, { value: trimmed, label: scheduleTypeLabel(trimmed) });
      }
    });
    scheduledClasses.forEach((item) => {
      if (item.type.trim() && !options.has(item.type)) {
        options.set(item.type, { value: item.type, label: scheduleTypeLabel(item.type) });
      }
    });
    return [...options.values()];
  }, [customScheduleTypes, scheduledClasses]);
  const scheduleGroups = useMemo(
    () => scheduleTypeOptions
      .map((option) => ({
        label: option.label,
        value: option.value,
        items: scheduledClasses.filter((item) => item.type === option.value)
      }))
      .filter((group) => group.items.length > 0),
    [scheduleTypeOptions, scheduledClasses]
  );
  const pastOneTimeScheduledClasses = useMemo(
    () => scheduledClasses.filter((item) => !item.recurring && item.date < todayKey),
    [scheduledClasses, todayKey]
  );

  const closeCustomTypeDialog = () => {
    setIsCustomTypeDialogOpen(false);
    setNewScheduleTypeName("");
  };

  const openScheduleModal = () => {
    setScheduleModalOpen(true);
  };

  const closeScheduleModal = () => {
    setScheduleModalOpen(false);
    setForm({ title: "", date: form.date, time: form.time, type: "class", titleColor: "#b8f5e2", recurring: false, studentId: "", notes: "" });
  };

  const submitCustomScheduleType = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newScheduleTypeName.trim();
    if (!trimmed) {
      showToast("Enter a schedule type name.");
      return;
    }
    const existingType = scheduleTypeOptions.find(
      (option) => option.value.toLowerCase() === trimmed.toLowerCase() || option.label.toLowerCase() === trimmed.toLowerCase()
    );
    const scheduleType = existingType?.value ?? trimmed;
    if (!existingType) {
      setCustomScheduleTypes((current) =>
        current.some((type) => type.toLowerCase() === trimmed.toLowerCase()) ? current : [...current, trimmed]
      );
    }
    setForm((current) => ({ ...current, type: scheduleType }));
    closeCustomTypeDialog();
    showToast(`${scheduleTypeLabel(scheduleType)} added to schedule types.`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const created = addScheduledClass({
      title: form.title,
      date: form.date,
      time: form.time,
      type: form.type,
      recurring: form.recurring,
      titleColor: form.titleColor,
      studentId: form.studentId || undefined,
      notes: form.notes
    });
    if (!created) {
      showToast("Enter a schedule title, date, time, and type.");
      return;
    }
    setForm({ title: "", date: form.date, time: form.time, type: "class", titleColor: "#b8f5e2", recurring: false, studentId: "", notes: "" });
    setScheduleModalOpen(false);
    showToast(`${created.title} added to schedule.`);
  };

  const removeScheduledClass = (item: ScheduledClass) => {
    const removed = deleteScheduledClass(item.id);
    if (!removed) return;
    showToast(`${removed.title} removed from schedule.`);
  };

  const clearPastOneTimeScheduledClasses = () => {
    const removed = deletePastOneTimeScheduledClasses(todayKey);
    if (!removed.length) {
      showToast("No past one-time schedule items to clear.");
      return;
    }
    showToast(`${removed.length} past schedule item${removed.length === 1 ? "" : "s"} cleared.`);
  };

  return (
    <OperationsPage
      className="operations-page--workflow operations-page--schedule"
      title="Schedule"
      text="Create class, private lesson, and testing-prep schedule items."
      action={
        <button type="button" className="operations-action student-header-add" onClick={openScheduleModal}>
          <Plus size={18} /> Add Schedule Event
        </button>
      }
    >
      <section className="operations-panel workflow-directory-panel">
        <div className="student-roster-head">
          <div>
            <h2>Schedule Directory</h2>
            <p>{scheduledClasses.length} schedule item{scheduledClasses.length === 1 ? "" : "s"} grouped by type, with one-time entries marked as upcoming or past.</p>
          </div>
          {pastOneTimeScheduledClasses.length > 0 && (
            <button
              type="button"
              className="workflow-maintenance-action"
              aria-label={`Clear ${pastOneTimeScheduledClasses.length} past one-time schedule item${pastOneTimeScheduledClasses.length === 1 ? "" : "s"}`}
              onClick={clearPastOneTimeScheduledClasses}
            >
              <Trash2 size={14} /> Clear Past
            </button>
          )}
        </div>
        <div className="workflow-directory-grid" aria-label="Schedule directory">
          {scheduleGroups.map((group) => (
            <section key={group.value} className={`workflow-directory-group workflow-directory-group--${slugClassName(group.label)}`} role="group" aria-label={`${group.label} schedule items`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{group.label}</h3>
                </div>
                <span>{group.items.length} item{group.items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="workflow-directory-list workflow-directory-list--schedule">
                <div className="workflow-directory-list-head" aria-hidden="true">
                  <span aria-hidden="true" />
                  <span className="workflow-directory-column-label">Title</span>
                  <span className="workflow-directory-column-label">Date</span>
                  <span className="workflow-directory-column-label">Time</span>
                  <span className="workflow-directory-column-label">Status</span>
                </div>
                {group.items.map((item) => <ScheduleCard key={item.id} item={item} onRemove={removeScheduledClass} students={students} todayKey={todayKey} />)}
              </div>
            </section>
          ))}
        </div>
      </section>
      {scheduleModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeScheduleModal()}>
          <form
            aria-labelledby="schedule-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card workflow-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
          <div className="student-modal-head">
            <div>
              <h2 id="schedule-modal-title">Add Schedule Event</h2>
              <p>Create a one-time or recurring schedule item for the calendar.</p>
            </div>
            <button type="button" className="student-modal-close" aria-label="Close schedule editor" onClick={closeScheduleModal}>
              <X size={18} />
            </button>
          </div>
          <label>
            Event title
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label>
            Schedule date
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </label>
          <label>
            Schedule time
            <input value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
          </label>
          <label>
            Title color
            <input type="color" value={form.titleColor} onChange={(event) => setForm({ ...form, titleColor: event.target.value })} />
          </label>
          <label>
            Schedule type
            <select
              value={form.type}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setNewScheduleTypeName("");
                  setIsCustomTypeDialogOpen(true);
                  return;
                }
                setForm({ ...form, type: event.target.value });
              }}
            >
              {scheduleTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="checkbox-row operations-checkbox-row">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
            />
            Recurring
          </label>
          <label>
            Student
            <select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
              <option value="">No specific student</option>
              {scheduleStudents.map((student) => (
                <option key={student.id} value={student.id}>{fullName(student)}</option>
              ))}
            </select>
          </label>
          <button type="submit">
            <Plus size={18} /> Add Schedule Event
          </button>
        </form>
      </div>
      )}
      {isCustomTypeDialogOpen && (
        <div className="modal-backdrop">
          <form
            aria-labelledby="create-schedule-type-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel"
            role="dialog"
            onSubmit={submitCustomScheduleType}
          >
            <div className="drawer-head">
              <div>
                <h2 id="create-schedule-type-title">Create schedule type</h2>
                <p>Name the new schedule type.</p>
              </div>
            </div>
            <label>
              New schedule type name
              <input
                autoFocus
                value={newScheduleTypeName}
                onChange={(event) => setNewScheduleTypeName(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button type="submit">Submit</button>
              <button type="button" onClick={closeCustomTypeDialog}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

function MessagePreview({ message, onSendQueuedText }: { message: MessageLog; onSendQueuedText?: (message: MessageLog) => void }) {
  const isQueued = message.status === "queued";
  const statusLabel = isQueued ? "Queued" : message.status === "failed" ? "Failed" : "Sent";

  return (
    <article className="message-preview" aria-label={`${statusLabel} text to ${message.recipientName}`}>
      <div className="message-preview-head">
        <strong>{messageKindLabel(message.kind)}</strong>
        <span>{message.status}</span>
        {isQueued && onSendQueuedText && (
          <button type="button" className="message-preview-send" aria-label={`Send text to ${message.recipientName}`} onClick={() => onSendQueuedText(message)}>
            <Send size={14} /> Send
          </button>
        )}
      </div>
      <p>{message.recipientName} · {message.recipientPhone}</p>
      <p>{message.body}</p>
    </article>
  );
}

function MessagesPage() {
  const {
    directMessages,
    latestUnreadDirectMessage,
    managedAccounts,
    markMessageNotificationsSeen,
    messageCampaigns,
    messageLogs,
    messageNotificationSettings,
    scheduledTextCampaigns,
    students,
    applyTwilioInboundWebhook,
    applyTwilioRelayResults,
    applyTwilioStatusCallbacks,
    buildTwilioRelayPayload,
    cancelScheduledTextCampaign,
    clearStaleQueuedTexts,
    recordSmsOptOut,
    runTextAutomations,
    scheduleTextCampaign,
    sendEventReminderTexts,
    getTextAudiencePreview,
    sendMarketingBlast,
    sendMissedClassFollowUps,
    sendQueuedTexts,
    sendQueuedText,
    showToast,
    session,
    textAutomationRuns,
    accountRole,
    unreadDirectMessageCount,
    updateMessageNotificationSettings
  } = useAppState();
  const [marketingMessage, setMarketingMessage] = useState("Monthly special: 10% off gloves and uniforms this week.");
  const [marketingAudience, setMarketingAudience] = useState<MessageCampaign["audience"]>("all-students");
  const [scheduledPromotionMessage, setScheduledPromotionMessage] = useState("Family gear sale starts tonight at 5 PM.");
  const [scheduledPromotionAudience, setScheduledPromotionAudience] = useState<MessageCampaign["audience"]>("parents");
  const [scheduledPromotionDate, setScheduledPromotionDate] = useState(() => toDateKey(new Date()));
  const [scheduledPromotionTime, setScheduledPromotionTime] = useState("09:00");
  const [browserPermission, setBrowserPermission] = useState(() => getBrowserNotificationPermission());
  const [smsOptOutPhone, setSmsOptOutPhone] = useState("");
  const [twilioInboundWebhookJson, setTwilioInboundWebhookJson] = useState("");
  const [twilioStatusCallbackJson, setTwilioStatusCallbackJson] = useState("");
  const [twilioRelayEndpoint, setTwilioRelayEndpoint] = useState(() => readTwilioRelayEndpoint());
  const [twilioRelayResultsJson, setTwilioRelayResultsJson] = useState("");
  const [isTwilioRelaySending, setIsTwilioRelaySending] = useState(false);
  const [twilioLaunchProfile, setTwilioLaunchProfile] = useState<TwilioLaunchProfile>(() => readTwilioLaunchProfile());
  const [twilioRelayHealthStatus, setTwilioRelayHealthStatus] = useState("not checked");
  const [twilioRelayHealthChecks, setTwilioRelayHealthChecks] = useState<TwilioRelayHealthReadinessChecks | undefined>();
  const [isTwilioRelayHealthChecking, setIsTwilioRelayHealthChecking] = useState(false);
  const [webPushPublicKey, setWebPushPublicKey] = useState(() => messageNotificationSettings.pushPublicKey ?? "");
  const [pushServerEndpoint, setPushServerEndpoint] = useState(() => readPushServerEndpoint());
  const [isPushSubscribing, setIsPushSubscribing] = useState(false);
  const [isPushSubscriptionSyncing, setIsPushSubscriptionSyncing] = useState(false);
  const today = toDateKey(useLiveCalendarDate());
  const missedCount = students.filter((student) => isMissedClassFollowUpDue(student, today)).length;
  const queuedCount = messageLogs.filter((message) => message.status === "queued" && isQueuedMessageDeliverable(message, students, managedAccounts)).length;
  const staleQueuedCount = messageLogs.filter((message) => message.status === "queued" && !isQueuedMessageDeliverable(message, students, managedAccounts)).length;
  const smsOptOutCount = activeSmsOptOutCount(students, managedAccounts);
  const notificationPermissionLabel = browserPermission === "unsupported" ? "Unavailable" : browserPermission;
  const deviceNotificationsReady = messageNotificationSettings.browserNotificationsEnabled && browserPermission === "granted";
  const relayReadyQueueLabel = `${queuedCount} relay-ready queued text${queuedCount === 1 ? "" : "s"}`;
  const smsOptOutLabel = `${smsOptOutCount} SMS opt-out record${smsOptOutCount === 1 ? "" : "s"} active`;
  const pushSubscriptionReady = Boolean(messageNotificationSettings.pushSubscriptionEndpoint?.trim());
  const twilioComplianceProfile = buildTwilioComplianceProfile(twilioLaunchProfile);
  const twilioComplianceLabel = twilioComplianceProfile.readyForUsProductionTraffic ? "Messaging compliance ready" : "Messaging compliance not verified";
  const twilioComplianceDetail = twilioLaunchProfile.senderType === "not-set"
    ? "Select the approved sender path before live US traffic"
    : `${twilioLaunchProfile.senderType} sender path; A2P brand ${twilioLaunchProfile.a2pBrandStatus}, campaign ${twilioLaunchProfile.a2pCampaignStatus}, toll-free ${twilioLaunchProfile.tollFreeVerificationStatus}`;
  const marketingSmsPreflight = smsSegmentPreflightText(marketingMessage);
  const scheduledPromotionSmsPreflight = smsSegmentPreflightText(scheduledPromotionMessage);
  const marketingOptOutPreflight = smsOptOutPreflightText(marketingMessage);
  const scheduledPromotionOptOutPreflight = smsOptOutPreflightText(scheduledPromotionMessage);
  const marketingAudiencePreview = getTextAudiencePreview(marketingAudience);
  const activeScheduledPromotions = scheduledTextCampaigns.filter((campaign) => campaign.status === "scheduled");
  const visibleScheduledPromotions = scheduledTextCampaigns.filter((campaign) => campaign.status !== "canceled").slice(0, 4);
  const visibleTextAutomationRuns = textAutomationRuns.slice(0, 3);
  const latestUnreadPreview = latestUnreadDirectMessage?.body.trim() || "No unread app replies are waiting.";
  const latestUnreadSender = latestUnreadDirectMessage?.senderName.trim() || "No sender";

  useEffect(() => {
    setBrowserPermission(getBrowserNotificationPermission());
  }, []);

  useEffect(() => {
    setWebPushPublicKey(messageNotificationSettings.pushPublicKey ?? "");
  }, [messageNotificationSettings.pushPublicKey]);

  useEffect(() => {
    void syncMessageAppBadge(unreadDirectMessageCount);
  }, [unreadDirectMessageCount]);

  useEffect(() => {
    const message = latestUnreadDirectMessage;
    if (!messageNotificationSettings.browserNotificationsEnabled || browserPermission !== "granted" || !message) return;
    if (messageNotificationSettings.lastBrowserNotifiedAt && message.createdAt <= messageNotificationSettings.lastBrowserNotifiedAt) return;
    const notificationTitle = `New message from ${message.senderName.trim() || "Cho's contact"}`;
    const notificationOptions: NotificationOptions = {
      body: message.body.trim(),
      tag: `chos-${message.threadId}`,
      icon: publicAsset("682e95109aa21_chos-logo.png"),
      badge: publicAsset("682e95109aa21_chos-logo.png"),
      data: {
        url: messagesNotificationUrl(),
        threadId: message.threadId
      }
    };
    updateMessageNotificationSettings({ lastBrowserNotifiedAt: message.createdAt, browserPermission: "granted" });
    void showDirectMessageBrowserNotification(notificationTitle, notificationOptions).catch(() => undefined);
  }, [
    browserPermission,
    latestUnreadDirectMessage,
    messageNotificationSettings.browserNotificationsEnabled,
    messageNotificationSettings.lastBrowserNotifiedAt,
    updateMessageNotificationSettings
  ]);

  const sendFollowUps = () => {
    const count = sendMissedClassFollowUps();
    showToast(count ? `${count} missed-class follow-up text${count === 1 ? "" : "s"} queued.` : "No missed-class follow-ups needed.");
  };

  const queueEventReminders = () => {
    const count = sendEventReminderTexts();
    showToast(count ? `${count} event reminder text${count === 1 ? "" : "s"} queued.` : "No event reminders needed.");
  };

  const runAutomations = () => {
    const result = runTextAutomations();
    showToast(result.totalQueued ? `${result.totalQueued} automated text${result.totalQueued === 1 ? "" : "s"} queued.` : "No automated texts are due.");
  };

  const sendMarketing = (event: FormEvent) => {
    event.preventDefault();
    if (!marketingMessage.trim()) {
      showToast("Enter a marketing message.");
      return;
    }
    const count = sendMarketingBlast(marketingMessage, marketingAudience);
    if (count) {
      showToast(marketingAudience === "all-students" ? `Marketing blast queued for ${count} student${count === 1 ? "" : "s"}.` : `Text blast queued for ${count} ${messageAudienceLabel(marketingAudience)}.`);
      return;
    }
    showToast(marketingAudience === "all-students" ? "No current student phone numbers are available." : `No ${messageAudienceLabel(marketingAudience)} phone numbers are available.`);
  };

  const schedulePromotion = (event: FormEvent) => {
    event.preventDefault();
    if (!scheduledPromotionMessage.trim()) {
      showToast("Enter a scheduled promotion message.");
      return;
    }
    if (!scheduledPromotionDate.trim()) {
      showToast("Choose a promotion send date.");
      return;
    }
    if (!scheduledPromotionTime.trim()) {
      showToast("Choose a promotion send time.");
      return;
    }
    const scheduledCampaign = scheduleTextCampaign({
      title: "Scheduled promotion",
      body: scheduledPromotionMessage,
      audience: scheduledPromotionAudience,
      scheduledFor: scheduledPromotionDate,
      scheduledTime: scheduledPromotionTime
    });
    if (!scheduledCampaign) {
      showToast("Could not schedule that promotion.");
      return;
    }
    showToast(`Promotion scheduled for ${scheduledPromotionWhenLabel(scheduledCampaign)}.`);
  };

  const cancelScheduledPromotion = (campaign: ScheduledTextCampaign) => {
    const canceledCampaign = cancelScheduledTextCampaign(campaign.id);
    showToast(canceledCampaign ? `Scheduled promotion for ${scheduledPromotionWhenLabel(canceledCampaign)} canceled.` : "That scheduled promotion is no longer pending.");
  };

  const sendQueue = () => {
    const count = sendQueuedTexts();
    showToast(count ? `${count} queued text${count === 1 ? "" : "s"} sent.` : "No queued texts are waiting.");
  };

  const sendSingleQueuedText = (message: MessageLog) => {
    const sentMessage = sendQueuedText(message.id);
    showToast(sentMessage ? `Queued text to ${sentMessage.recipientName} sent.` : "That queued text is no longer waiting.");
  };

  const relayPayloadReadyForLiveSend = (payload: ReturnType<typeof buildTwilioRelayPayload>, origin: string) => {
    const result = validateTwilioRelayPayloadForServer(payload, {
      origin,
      maxMessages: 100,
      maxSegmentsPerMessage: 3
    });
    if (result.ok) return true;
    showToast("Twilio relay payload needs review before live send.");
    return false;
  };

  const twilioSenderComplianceReadyForLiveSend = () => {
    if (twilioComplianceProfile.readyForUsProductionTraffic) return true;
    showToast("Verify sender compliance before live Twilio relay sends.");
    return false;
  };

  const exportTwilioRelayPayload = () => {
    const payload = buildTwilioRelayPayload();
    if (!payload.messages.length) {
      showToast("No deliverable queued texts are ready for Twilio relay export.");
      return;
    }
    if (!relayPayloadReadyForLiveSend(payload, window.location.origin)) return;
    downloadTextFile(`chos-twilio-relay-queue-${today}.json`, JSON.stringify(payload, null, 2), "application/json");
    showToast(`${payload.messages.length} Twilio relay message${payload.messages.length === 1 ? "" : "s"} exported.`);
  };

  const updateTwilioLaunchProfile = (field: "messagingServiceSid" | "smsSender" | "inboundWebhookUrl" | "statusCallbackBaseUrl" | "relayHealthCheckUrl" | "complianceNotes", value: string) => {
    setTwilioLaunchProfile((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateTwilioComplianceSenderType = (value: string) => {
    setTwilioLaunchProfile((current) => ({
      ...current,
      senderType: normalizeTwilioComplianceSenderType(value)
    }));
  };

  const updateTwilioComplianceStatus = (field: "a2pBrandStatus" | "a2pCampaignStatus" | "tollFreeVerificationStatus", value: string) => {
    setTwilioLaunchProfile((current) => ({
      ...current,
      [field]: normalizeTwilioComplianceStatus(value)
    }));
  };

  const updateTwilioLaunchProfileAuthMode = (value: string) => {
    const managerAuthMode = value === "server-session" || value === "oauth-proxy" ? value : "same-site-cookie";
    setTwilioLaunchProfile((current) => ({
      ...current,
      managerAuthMode
    }));
  };

  const saveTwilioLaunchProfile = (event: FormEvent) => {
    event.preventDefault();
    const profile = sanitizeTwilioLaunchProfile({
      ...twilioLaunchProfile,
      savedAt: new Date().toISOString()
    });
    setTwilioLaunchProfile(profile);
    writeTwilioLaunchProfile(profile);
    showToast("Twilio launch profile saved.");
  };

  const checkTwilioRelayHealth = async () => {
    const endpoint = twilioLaunchProfile.relayHealthCheckUrl.trim();
    if (!endpoint) {
      setTwilioRelayHealthChecks(undefined);
      showToast("Enter a relay health check URL.");
      return;
    }
    try {
      new URL(endpoint);
    } catch {
      setTwilioRelayHealthChecks(undefined);
      showToast("Enter a valid relay health check URL.");
      return;
    }
    setIsTwilioRelayHealthChecking(true);
    setTwilioRelayHealthStatus("checking");
    setTwilioRelayHealthChecks(undefined);
    try {
      const response = await window.fetch(endpoint, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        setTwilioRelayHealthStatus(`HTTP ${response.status}`);
        setTwilioRelayHealthChecks(undefined);
        showToast(`Twilio relay health check failed with HTTP ${response.status}.`);
        return;
      }
      const payload = await response.json().catch(() => undefined);
      const health = validateTwilioRelayHealthResponseForBrowser(payload);
      if (!health.ok) {
        const hasSecretLikeField = health.errors.includes("Relay health response must not include credential-like fields.");
        if (hasSecretLikeField) {
          setTwilioRelayHealthStatus("unsafe response");
          setTwilioRelayHealthChecks(undefined);
          showToast("Twilio relay health response included secret-like fields.");
          return;
        }
        setTwilioRelayHealthStatus("invalid response");
        setTwilioRelayHealthChecks(undefined);
        showToast("Twilio relay health response needs readiness checks.");
        return;
      }
      setTwilioRelayHealthChecks(health.readinessChecks);
      if (health.status === "ready") {
        setTwilioRelayHealthStatus("ready");
        showToast("Twilio relay health verified.");
        return;
      }
      if (health.status) {
        setTwilioRelayHealthStatus(health.status);
        showToast("Twilio relay health checked.");
        return;
      }
      if (health.errors.includes("Relay health response must not include credential-like fields.")) {
        setTwilioRelayHealthStatus("unsafe response");
        setTwilioRelayHealthChecks(undefined);
        showToast("Twilio relay health response included secret-like fields.");
        return;
      }
      setTwilioRelayHealthStatus("invalid response");
      setTwilioRelayHealthChecks(undefined);
      showToast("Twilio relay health response needs readiness checks.");
    } catch {
      setTwilioRelayHealthStatus("failed");
      setTwilioRelayHealthChecks(undefined);
      showToast("Twilio relay health check failed.");
    } finally {
      setIsTwilioRelayHealthChecking(false);
    }
  };

  const updateTwilioRelayEndpoint = (value: string) => {
    setTwilioRelayEndpoint(value);
    writeTwilioRelayEndpoint(value);
  };

  const sendToTwilioRelay = async () => {
    const endpoint = twilioRelayEndpoint.trim();
    if (!endpoint) {
      showToast("Enter a private Twilio relay URL.");
      return;
    }
    const payload = buildTwilioRelayPayload();
    if (!payload.messages.length) {
      showToast("No deliverable queued texts are ready for the Twilio relay.");
      return;
    }
    let relayOrigin: string;
    try {
      relayOrigin = new URL(endpoint).origin;
    } catch {
      showToast("Enter a valid private Twilio relay URL.");
      return;
    }
    if (!twilioSenderComplianceReadyForLiveSend()) return;
    if (!relayPayloadReadyForLiveSend(payload, relayOrigin)) return;
    setIsTwilioRelaySending(true);
    try {
      const response = await window.fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        showToast(`Twilio relay request failed with HTTP ${response.status}.`);
        return;
      }
      const responseText = await response.text();
      const result = applyTwilioRelayResults(responseText);
      if (!result) {
        showToast("Relay returned invalid Twilio results JSON.");
        return;
      }
      if (!result.applied) {
        showToast("No matching Twilio relay results were found.");
        return;
      }
      showToast(`${result.applied} Twilio relay result${result.applied === 1 ? "" : "s"} applied.`);
    } catch {
      showToast("Twilio relay request failed.");
    } finally {
      setIsTwilioRelaySending(false);
    }
  };

  const applyTwilioResults = () => {
    const result = applyTwilioRelayResults(twilioRelayResultsJson);
    if (!result) {
      showToast("Paste a valid Twilio relay results JSON.");
      return;
    }
    if (!result.applied) {
      showToast("No matching Twilio relay results were found.");
      return;
    }
    setTwilioRelayResultsJson("");
    showToast(`${result.applied} Twilio relay result${result.applied === 1 ? "" : "s"} applied.`);
  };

  const applyTwilioStatus = () => {
    const result = applyTwilioStatusCallbacks(twilioStatusCallbackJson);
    if (!result) {
      showToast("Paste a valid Twilio status callback JSON.");
      return;
    }
    if (!result.applied) {
      showToast("No matching Twilio status callbacks were found.");
      return;
    }
    setTwilioStatusCallbackJson("");
    showToast(`${result.applied} Twilio status callback${result.applied === 1 ? "" : "s"} applied.`);
  };

  const markSmsOptOut = () => {
    const count = recordSmsOptOut(smsOptOutPhone, true);
    showToast(count ? `SMS opt-out recorded for ${count} contact${count === 1 ? "" : "s"}.` : "No matching SMS contact found.");
    if (count) setSmsOptOutPhone("");
  };

  const clearSmsOptOut = () => {
    const count = recordSmsOptOut(smsOptOutPhone, false);
    showToast(count ? `SMS opt-out cleared for ${count} contact${count === 1 ? "" : "s"}.` : "No matching SMS contact found.");
    if (count) setSmsOptOutPhone("");
  };

  const applyTwilioInbound = () => {
    const result = applyTwilioInboundWebhook(twilioInboundWebhookJson);
    if (!result) {
      showToast("Paste a valid Twilio inbound webhook JSON.");
      return;
    }
    if (result.imported) {
      setTwilioInboundWebhookJson("");
      showToast(`${result.imported} inbound SMS imported.`);
      return;
    }
    const optOutUpdates = result.optedOut + result.optedIn;
    if (optOutUpdates) {
      setTwilioInboundWebhookJson("");
      showToast(`${optOutUpdates} SMS opt-out update${optOutUpdates === 1 ? "" : "s"} applied.`);
      return;
    }
    showToast("No matching SMS contact found for that inbound webhook.");
  };

  const buildSmsConsentEvidencePayload = () => {
    const studentContacts = students
      .filter((student) => isActiveOperationsStudent(student))
      .flatMap((student) => {
        const studentName = fullName(student);
        const contacts = [];
        if (student.phone.trim()) {
          const consentUpdatedAt = student.studentSmsConsentUpdatedAt ?? student.smsConsentUpdatedAt;
          contacts.push({
            contactId: student.id,
            role: "student",
            name: studentName,
            phone: normalizeConsentPhone(student.phone),
            consentStatus: smsConsentStatus(student.studentSmsOptOutAt, consentUpdatedAt),
            consentUpdatedAt: smsConsentUpdatedAt(student.studentSmsOptOutAt, consentUpdatedAt),
            optOutAt: student.studentSmsOptOutAt?.trim() || null,
            evidenceSource: student.studentSmsOptOutAt?.trim() ? "twilio-stop-or-manager-opt-out" : consentUpdatedAt?.trim() ? "prototype-consent-record" : "missing-consent-evidence"
          });
        }
        if (student.guardianPhone?.trim()) {
          const consentUpdatedAt = student.guardianSmsConsentUpdatedAt ?? student.smsConsentUpdatedAt;
          contacts.push({
            contactId: `parent-${student.id}`,
            role: "parent",
            name: student.guardianName?.trim() || `${studentName} Parent/Guardian`,
            phone: normalizeConsentPhone(student.guardianPhone),
            consentStatus: smsConsentStatus(student.guardianSmsOptOutAt, consentUpdatedAt),
            consentUpdatedAt: smsConsentUpdatedAt(student.guardianSmsOptOutAt, consentUpdatedAt),
            optOutAt: student.guardianSmsOptOutAt?.trim() || null,
            evidenceSource: student.guardianSmsOptOutAt?.trim() ? "twilio-stop-or-manager-opt-out" : consentUpdatedAt?.trim() ? "prototype-consent-record" : "missing-consent-evidence"
          });
        }
        return contacts;
      });
    const staffContacts = managedAccounts
      .filter((account) => account.role === "staff" && account.status === "active" && account.phone?.trim())
      .map((account) => ({
        contactId: account.id,
        role: "staff",
        name: account.displayName.trim(),
        phone: normalizeConsentPhone(account.phone ?? ""),
        consentStatus: smsConsentStatus(account.smsOptOutAt, account.smsConsentUpdatedAt),
        consentUpdatedAt: smsConsentUpdatedAt(account.smsOptOutAt, account.smsConsentUpdatedAt),
        optOutAt: account.smsOptOutAt?.trim() || null,
        evidenceSource: account.smsOptOutAt?.trim() ? "twilio-stop-or-manager-opt-out" : account.smsConsentUpdatedAt?.trim() ? "prototype-consent-record" : "missing-consent-evidence"
      }));
    return {
      schemaVersion: "chos-sms-consent-evidence.v1",
      provider: "twilio",
      generatedAt: new Date().toISOString(),
      requestedBy: session
        ? {
            email: session.email,
            role: accountRole
          }
        : undefined,
      serverResponsibilities: [
        "Treat contacts with missing consent evidence as not sendable until valid opt-in proof exists.",
        "Sync opt-in and opt-out status to Twilio Consent Management or an equivalent server-side consent store.",
        "Re-check consent, opt-outs, account status, and phone deliverability immediately before live Twilio sends."
      ],
      contacts: [...studentContacts, ...staffContacts]
    };
  };

  const exportSmsConsentEvidence = () => {
    const payload = buildSmsConsentEvidencePayload();
    downloadTextFile(`chos-sms-consent-evidence-${today}.json`, JSON.stringify(payload, null, 2), "application/json");
    showToast(`${payload.contacts.length} SMS consent record${payload.contacts.length === 1 ? "" : "s"} exported.`);
  };

  const clearStaleTexts = () => {
    const count = clearStaleQueuedTexts();
    showToast(count ? `${count} stale queued text${count === 1 ? "" : "s"} removed.` : "No stale queued texts need cleanup.");
  };

  const buildPushSubscriptionPayload = () => {
    return buildWebPushSubscriptionPayload(messageNotificationSettings, session, accountRole, messagesNotificationUrl());
  };

  const enableDeviceNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !window.Notification.requestPermission) {
      setBrowserPermission("unsupported");
      updateMessageNotificationSettings({ browserNotificationsEnabled: false, browserPermission: "unsupported" });
      showToast("Device notifications are unavailable in this browser.");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setBrowserPermission(permission);
    updateMessageNotificationSettings({ browserNotificationsEnabled: permission === "granted", browserPermission: permission });
    showToast(permission === "granted" ? "Device notifications enabled for app messages." : "Device notifications were not enabled.");
  };

  const sendTestDeviceNotification = async () => {
    if (!deviceNotificationsReady) {
      showToast("Enable device notifications before sending a test.");
      return;
    }
    const sent = await showDirectMessageBrowserNotification("Cho's test notification", {
      body: "Device notifications are ready for app messages.",
      tag: "chos-test-notification",
      icon: publicAsset("682e95109aa21_chos-logo.png"),
      badge: publicAsset("682e95109aa21_chos-logo.png"),
      data: {
        url: messagesNotificationUrl()
      }
    });
    showToast(sent ? "Test device notification sent." : "Test device notification could not be shown.");
  };

  const connectDevicePush = async () => {
    const applicationServerKey = webPushPublicKeyToBytes(webPushPublicKey);
    if (!applicationServerKey) {
      showToast("Enter a valid Web Push public key.");
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window) || !window.Notification.requestPermission || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      updateMessageNotificationSettings({ browserPermission: "unsupported" });
      showToast("Web Push subscriptions are unavailable in this browser.");
      return;
    }
    setIsPushSubscribing(true);
    try {
      const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission !== "granted") {
        updateMessageNotificationSettings({ browserNotificationsEnabled: false, browserPermission: permission });
        showToast("Device push notifications were not enabled.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager || typeof registration.pushManager.subscribe !== "function") {
        showToast("Web Push subscriptions are unavailable in this browser.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      updateMessageNotificationSettings({
        ...buildWebPushSubscriptionSettings(webPushPublicKey, subscription)
      });
      showToast("Device push subscription ready for private server sync.");
    } catch {
      showToast("Device push subscription failed.");
    } finally {
      setIsPushSubscribing(false);
    }
  };

  const exportPushSubscription = () => {
    const payload = buildPushSubscriptionPayload();
    if (!payload) {
      showToast("Connect this device to Web Push before exporting.");
      return;
    }
    downloadTextFile(`chos-web-push-subscription-${today}.json`, JSON.stringify(payload, null, 2), "application/json");
    showToast("Device push subscription exported.");
  };

  const updatePushServerEndpoint = (value: string) => {
    setPushServerEndpoint(value);
    writePushServerEndpoint(value);
  };

  const syncPushSubscription = async () => {
    const endpoint = pushServerEndpoint.trim();
    if (!endpoint) {
      showToast("Enter a private push server URL.");
      return;
    }
    const payload = buildPushSubscriptionPayload();
    if (!payload) {
      showToast("Connect this device to Web Push before syncing.");
      return;
    }
    setIsPushSubscriptionSyncing(true);
    try {
      const response = await window.fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        showToast(`Push subscription sync failed with HTTP ${response.status}.`);
        return;
      }
      showToast("Device push subscription synced to private server.");
    } catch {
      showToast("Device push subscription sync failed.");
    } finally {
      setIsPushSubscriptionSyncing(false);
    }
  };

  const buildProductionMessagingIntegrationManifest = () => {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
    const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}cho-service-worker.js`, window.location.origin).toString();
    return {
      schemaVersion: "chos-production-messaging-integration.v1",
      generatedAt: new Date().toISOString(),
      app: {
        name: "Cho's Martial Arts App Prototype",
        baseUrl,
        messagesPath: "/messages",
        notificationUrl: messagesNotificationUrl(),
        serviceWorkerUrl
      },
      requestedBy: session
        ? {
            email: session.email,
            role: accountRole
          }
        : undefined,
      twilio: {
        relayEndpoint: twilioRelayEndpoint.trim() || null,
        relayPayloadSchemaVersion: "chos-twilio-relay.v1",
        relayMethod: "POST",
        browserCredentialMode: "include",
        accountProfile: {
          messagingServiceSidConfigured: Boolean(twilioLaunchProfile.messagingServiceSid.trim()),
          messagingServiceSid: twilioLaunchProfile.messagingServiceSid.trim() || null,
          smsSender: twilioLaunchProfile.smsSender.trim() || null,
          inboundWebhookUrl: twilioLaunchProfile.inboundWebhookUrl.trim() || null,
          statusCallbackBaseUrl: twilioLaunchProfile.statusCallbackBaseUrl.trim() || null,
          relayHealthCheckUrl: twilioLaunchProfile.relayHealthCheckUrl.trim() || null,
          managerAuthMode: twilioLaunchProfile.managerAuthMode,
          savedAt: twilioLaunchProfile.savedAt ?? null,
          credentialStorage: "server-only",
          credentialValuesExcluded: true
        },
        complianceProfile: twilioComplianceProfile,
        requiredServerEnv: twilioRequiredServerEnvVars,
        authServerEnv: twilioAuthServerEnv,
        senderServerEnv: twilioSenderServerEnv,
        serverContract: twilioRelayServerContract,
        optionalServerEnv: ["TWILIO_STATUS_CALLBACK_BASE_URL"],
        maxMessagesPerBatch: 100,
        maxSegmentsPerMessage: 3,
        webhooks: {
          inboundPath: "/api/messages/inbound",
          statusCallbackPathTemplate: "/api/messages/status/{messageId}",
          contentType: "application/x-www-form-urlencoded",
          signatureHeader: "X-Twilio-Signature",
          requireSignatureVerification: true,
          serverContract: twilioWebhookServerContract
        },
        serverResponsibilities: [
          "Authenticate the manager before accepting relay or push subscription requests.",
          "Store Twilio credentials only in the private server environment.",
          "Confirm A2P 10DLC brand and campaign approval or verified toll-free/short-code sender status before live US traffic.",
          "Validate relay payloads, recipient consent, opt-outs, rate limits, and SMS segment limits server-side.",
          "Verify Twilio webhook signatures before persisting inbound replies or status callbacks."
        ]
      },
      serverAdapterContract: messagingServerAdapterContract,
      webPush: {
        subscriptionSyncEndpoint: pushServerEndpoint.trim() || null,
        subscriptionSchemaVersion: "chos-web-push-subscription.v1",
        notificationPayloadSchemaVersion: "chos-web-push-notification.v1",
        serverContract: webPushServerContract,
        requiredServerEnv: webPushRequiredServerEnvVars,
        publicKeyConfigured: Boolean(webPushPublicKey.trim() || messageNotificationSettings.pushPublicKey?.trim()),
        subscriptionEndpoint: messageNotificationSettings.pushSubscriptionEndpoint?.trim() || null,
        notificationUrl: messagesNotificationUrl(),
        serviceWorkerUrl,
        serverResponsibilities: [
          "Store VAPID private keys only on the private push server.",
          "Persist browser PushSubscription records for authenticated manager devices.",
          "Remove expired subscriptions after push send failures.",
          "Send user-visible notifications that open the messages route."
        ]
      },
      auth: {
        browserCredentialMode: "include",
        managerAuthenticationRequired: true,
        storeSecretsOnServerOnly: true,
        recommendedSession: "same-site secure cookie or equivalent server-managed session",
        serverContract: messagingServerAdapterContract
      }
    };
  };

  const exportProductionMessagingIntegrationManifest = () => {
    const manifest = buildProductionMessagingIntegrationManifest();
    downloadTextFile(`chos-production-messaging-integration-${today}.json`, JSON.stringify(manifest, null, 2), "application/json");
    showToast("Production messaging integration manifest exported.");
  };

  const buildTextAutomationManifest = () => {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
    const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}cho-service-worker.js`, window.location.origin).toString();
    const timeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "local" : "local";
    const automations = [
      {
        key: "missedClassFollowUps",
        label: "Missed-class follow-ups",
        provider: "twilio",
        channel: "sms",
        source: "students with 3 or more missed classes",
        dedupe: "recipient/body/idempotency check before queueing"
      },
      {
        key: "attendanceGapCheckIns",
        label: "Attendance gap check-ins",
        provider: "twilio",
        channel: "sms",
        source: "attendance gap report candidates",
        dedupe: "same student and body on the same automation date"
      },
      {
        key: "trialConversionFollowUps",
        label: "Trial conversion follow-ups",
        provider: "twilio",
        channel: "sms",
        source: "trial students due for conversion outreach",
        dedupe: "same recipient and body on the same automation date"
      },
      {
        key: "newStudentCheckIns",
        label: "New student check-ins",
        provider: "twilio",
        channel: "sms",
        source: "new student report candidates",
        dedupe: "same recipient and body on the same automation date"
      },
      {
        key: "pausedStudentReactivationFollowUps",
        label: "Paused student reactivation follow-ups",
        provider: "twilio",
        channel: "sms",
        source: "paused students due for reactivation outreach",
        dedupe: "same recipient and body on the same automation date"
      },
      {
        key: "celebrationOutreach",
        label: "Celebration outreach",
        provider: "twilio",
        channel: "sms",
        source: "birthday and attendance celebration report candidates",
        dedupe: "same recipient and body on the same automation date"
      },
      {
        key: "profileUpdateRequests",
        label: "Profile update requests",
        provider: "twilio",
        channel: "sms",
        source: "records missing contact or safety details",
        dedupe: "same recipient and body on the same automation date"
      },
      {
        key: "classReminders",
        label: "Class reminders",
        provider: "twilio",
        channel: "sms",
        source: "upcoming class reminder report candidates",
        dedupe: "same recipient and body on the same automation date"
      },
      {
        key: "milestoneEncouragements",
        label: "Milestone encouragements",
        provider: "twilio",
        channel: "sms",
        source: "student milestone report candidates",
        dedupe: "same recipient and body on the same automation date"
      },
      {
        key: "beltTestInvites",
        label: "Belt test invites",
        provider: "twilio",
        channel: "sms",
        source: "belt readiness report candidates",
        dedupe: "same recipient and body on the same automation date"
      },
      {
        key: "eventReminders",
        label: "Event reminders",
        provider: "twilio",
        channel: "sms",
        source: "events due in the next 7 days",
        dedupe: "same event, recipient, and body on the same automation date"
      },
      {
        key: "scheduledPromotions",
        label: "Scheduled promotions",
        provider: "twilio",
        channel: "sms",
        source: "scheduled promotion records due by local date and time",
        dedupe: "scheduled campaign id and generated campaign id"
      }
    ];
    return {
      schemaVersion: "chos-text-automation-manifest.v1",
      generatedAt: new Date().toISOString(),
      app: {
        name: "Cho's Martial Arts App Prototype",
        baseUrl,
        messagesPath: "/messages",
        notificationUrl: messagesNotificationUrl(),
        serviceWorkerUrl
      },
      requestedBy: session
        ? {
            email: session.email,
            role: accountRole
          }
        : undefined,
      automationRun: {
        runEndpointPath: "/api/messages/automations/run",
        method: "POST",
        serverContractModule: "src/textAutomationContract.ts",
        executionPlanner: "buildTextAutomationExecutionPlan",
        serverAdapterContract: messagingServerAdapterContract,
        recommendedCron: "*/15 * * * *",
        recommendedCadence: "Every 15 minutes, plus a manual manager-triggered run endpoint.",
        timezone: timeZone,
        browserCredentialMode: "include",
        managerAuthenticationRequired: true,
        serverJobAuthenticationRequired: true,
        dryRunRecommended: true,
        idempotencyRequired: true
      },
      relay: {
        relayEndpoint: twilioRelayEndpoint.trim() || null,
        relayPayloadSchemaVersion: "chos-twilio-relay.v1",
        relayMethod: "POST",
        browserCredentialMode: "include",
        accountProfile: {
          messagingServiceSidConfigured: Boolean(twilioLaunchProfile.messagingServiceSid.trim()),
          messagingServiceSid: twilioLaunchProfile.messagingServiceSid.trim() || null,
          smsSender: twilioLaunchProfile.smsSender.trim() || null,
          inboundWebhookUrl: twilioLaunchProfile.inboundWebhookUrl.trim() || null,
          statusCallbackBaseUrl: twilioLaunchProfile.statusCallbackBaseUrl.trim() || null,
          relayHealthCheckUrl: twilioLaunchProfile.relayHealthCheckUrl.trim() || null,
          managerAuthMode: twilioLaunchProfile.managerAuthMode,
          credentialStorage: "server-only",
          credentialValuesExcluded: true
        },
        complianceProfile: twilioComplianceProfile,
        requiredServerEnv: twilioRequiredServerEnvVars,
        authServerEnv: twilioAuthServerEnv,
        senderServerEnv: twilioSenderServerEnv,
        serverContract: twilioRelayServerContract,
        optionalServerEnv: ["TWILIO_STATUS_CALLBACK_BASE_URL"],
        maxMessagesPerBatch: 100,
        maxSegmentsPerMessage: 3,
        statusCallbackPathTemplate: "/api/messages/status/{messageId}"
      },
      webPush: {
        subscriptionSyncEndpoint: pushServerEndpoint.trim() || null,
        subscriptionSchemaVersion: "chos-web-push-subscription.v1",
        notificationPayloadSchemaVersion: "chos-web-push-notification.v1",
        serverContract: webPushServerContract,
        requiredServerEnv: webPushRequiredServerEnvVars,
        notificationUrl: messagesNotificationUrl(),
        serviceWorkerUrl
      },
      automations,
      scheduledPromotions: scheduledTextCampaigns
        .filter((campaign) => campaign.status !== "canceled")
        .map((campaign) => ({
          id: campaign.id,
          title: campaign.title,
          audience: campaign.audience,
          audienceLabel: messageAudienceLabel(campaign.audience),
          scheduledFor: campaign.scheduledFor,
          scheduledTime: campaign.scheduledTime ?? null,
          status: campaign.status,
          createdAt: campaign.createdAt,
          queuedAt: campaign.queuedAt ?? null,
          campaignId: campaign.campaignId ?? null,
          body: campaign.body,
          smsPreflight: smsSegmentPreflightText(campaign.body),
          optOutPreflight: smsOptOutPreflightText(campaign.body)
        })),
      recentAutomationRuns: textAutomationRuns.slice(0, 5).map((run) => ({
        id: run.id,
        ranAt: run.ranAt,
        status: run.status,
        totalQueued: run.totalQueued,
        deliveryProvider: run.deliveryProvider,
        deliveryChannel: run.deliveryChannel,
        deliveryMode: run.deliveryMode,
        relayPayloadSchemaVersion: run.relayPayloadSchemaVersion,
        breakdown: run.breakdown
      })),
      deliveryGuards: {
        enforceSmsOptOutServerSide: true,
        enforceRateLimitsServerSide: true,
        validateTwilioRelayPayloadServerSide: true,
        verifyTwilioWebhookSignatures: true,
        storeSecretsOnServerOnly: true,
        excludeBrowserStoredPushKeyMaterial: true,
        requireOptOutLanguageForMarketing: true
      },
      serverResponsibilities: [
        "Run due-date and due-time checks on the private server before queueing automation output.",
        "Authenticate manager-triggered automation runs and separately authenticate cron or worker runs.",
        "Re-check recipient consent, SMS opt-outs, account status, and deliverability immediately before creating relay payloads.",
        "Confirm sender compliance approval before any live Twilio automation run creates US messaging traffic.",
        "Apply idempotency so repeated cron runs do not duplicate the same recipient/body/campaign work.",
        "Batch Twilio relay sends within rate, consent, and segment guardrails.",
        "Persist queued, sent, failed, inbound, and status callback records in the production backend.",
        "Send Web Push notifications for new app messages through the private push server after storing PushSubscription records."
      ]
    };
  };

  const exportTextAutomationManifest = () => {
    const manifest = buildTextAutomationManifest();
    downloadTextFile(`chos-text-automation-manifest-${today}.json`, JSON.stringify(manifest, null, 2), "application/json");
    showToast("Text automation manifest exported.");
  };

  const markAppMessagesSeen = () => {
    markMessageNotificationsSeen();
    showToast("App message notifications marked seen.");
  };

  return (
    <OperationsPage title="Message Settings" text="Manage mass messages, missed-class text follow-ups, message logs, and other message tools.">
      <section className="operations-panel message-settings-panel">
        <h2>Messenger Settings</h2>
        <p>All one-to-one app messenger conversations now stay inside the Home Page messenger container. Use this Manager&apos;s Page tool for message settings, mass texts, text logs, and other messaging operations.</p>
        <Link className="operations-action secondary" to="/">
          <MessageCircle size={18} /> Open Home Page Messages
        </Link>
      </section>
      <div className="operations-two-column message-control-grid">
        <section className="operations-panel message-notification-panel" aria-label="Message notification center">
          <div className="message-panel-kicker">
            <Bell size={18} aria-hidden="true" />
            <span>App alerts</span>
          </div>
          <h2>Notification Center</h2>
          <p className="message-notification-count">{unreadDirectMessageCount} unread app message{unreadDirectMessageCount === 1 ? "" : "s"}</p>
          <article className="message-notification-preview" aria-label="Latest unread app message">
            <strong>{latestUnreadSender}</strong>
            <p>{latestUnreadPreview}</p>
          </article>
          <div className="message-notification-actions">
            <button type="button" className="operations-action" onClick={markAppMessagesSeen} disabled={!directMessages.length}>
              <CheckCircle2 size={18} /> Mark app messages seen
            </button>
            <button type="button" className="operations-action secondary" onClick={enableDeviceNotifications}>
              <Smartphone size={18} /> Enable Device Notifications
            </button>
            <button type="button" className="operations-action secondary" onClick={sendTestDeviceNotification} disabled={!deviceNotificationsReady}>
              <Bell size={18} /> Send Test Notification
            </button>
          </div>
          <div className="message-push-setup" aria-label="Device push subscription setup">
            <label>
              Web Push public key
              <input
                value={webPushPublicKey}
                onChange={(event) => setWebPushPublicKey(event.target.value)}
                placeholder="Public VAPID key from private push server"
              />
            </label>
            <label>
              Private push server URL
              <input
                type="url"
                value={pushServerEndpoint}
                onChange={(event) => updatePushServerEndpoint(event.target.value)}
                placeholder="https://push.example.com/api/push/subscriptions"
              />
            </label>
            <div className="message-notification-actions">
              <button type="button" className="operations-action secondary" onClick={connectDevicePush} disabled={!webPushPublicKey.trim() || isPushSubscribing}>
                <Bell size={18} /> {isPushSubscribing ? "Connecting Device..." : "Connect This Device"}
              </button>
              <button type="button" className="operations-action secondary" onClick={syncPushSubscription} disabled={!pushSubscriptionReady || !pushServerEndpoint.trim() || isPushSubscriptionSyncing}>
                <Server size={18} /> {isPushSubscriptionSyncing ? "Syncing Subscription..." : "Sync Push Subscription"}
              </button>
              <button type="button" className="operations-action secondary" onClick={exportPushSubscription} disabled={!pushSubscriptionReady}>
                <FileText size={18} /> Export Push Subscription JSON
              </button>
            </div>
            <p className="operations-note">{pushSubscriptionReady ? "This device has a Web Push subscription ready for private server storage." : "Paste a public VAPID key from the private push server before connecting this device."}</p>
          </div>
          <p className="operations-note">Device permission: {notificationPermissionLabel}. Preference: {messageNotificationSettings.browserNotificationsEnabled ? "enabled" : "off"}.</p>
        </section>
        <section className="operations-panel message-twilio-panel" aria-label="Twilio delivery setup">
          <div className="message-panel-kicker">
            <Server size={18} aria-hidden="true" />
            <span>SMS provider</span>
          </div>
          <h2>Twilio Delivery Setup</h2>
          <p className="message-provider-status">Private server relay required</p>
          <p>Queued texts are tagged for Twilio SMS delivery, but live sends need a private server endpoint with Twilio credentials. This static prototype never stores Auth Tokens in the browser.</p>
          <div className="message-provider-env" aria-label="Required Twilio server environment variables">
            {twilioServerEnvLabels.map((envVar) => <span key={envVar}>{envVar}</span>)}
          </div>
          <form className="message-launch-profile" aria-label="Twilio account launch profile" onSubmit={saveTwilioLaunchProfile}>
            <h3>Twilio Account Launch Profile</h3>
            <p>Track non-secret production setup details for the private relay and manager-auth layer.</p>
            <label>
              Twilio Messaging Service SID
              <input
                value={twilioLaunchProfile.messagingServiceSid}
                onChange={(event) => updateTwilioLaunchProfile("messagingServiceSid", event.target.value)}
                placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </label>
            <label>
              Twilio SMS sender
              <input
                value={twilioLaunchProfile.smsSender}
                onChange={(event) => updateTwilioLaunchProfile("smsSender", event.target.value)}
                placeholder="+12625550100 or approved sender"
              />
            </label>
            <label>
              Inbound webhook URL
              <input
                type="url"
                value={twilioLaunchProfile.inboundWebhookUrl}
                onChange={(event) => updateTwilioLaunchProfile("inboundWebhookUrl", event.target.value)}
                placeholder="https://relay.example.com/api/messages/inbound"
              />
            </label>
            <label>
              Status callback base URL
              <input
                type="url"
                value={twilioLaunchProfile.statusCallbackBaseUrl}
                onChange={(event) => updateTwilioLaunchProfile("statusCallbackBaseUrl", event.target.value)}
                placeholder="https://relay.example.com"
              />
            </label>
            <label>
              Relay health check URL
              <input
                type="url"
                value={twilioLaunchProfile.relayHealthCheckUrl}
                onChange={(event) => updateTwilioLaunchProfile("relayHealthCheckUrl", event.target.value)}
                placeholder="https://relay.example.com/api/health/twilio"
              />
            </label>
            <label>
              Manager auth mode
              <select
                value={twilioLaunchProfile.managerAuthMode}
                onChange={(event) => updateTwilioLaunchProfileAuthMode(event.target.value)}
              >
                <option value="same-site-cookie">Same-site secure cookie</option>
                <option value="server-session">Server-managed session</option>
                <option value="oauth-proxy">OAuth proxy session</option>
              </select>
            </label>
            <label>
              Messaging compliance sender type
              <select
                value={twilioLaunchProfile.senderType}
                onChange={(event) => updateTwilioComplianceSenderType(event.target.value)}
              >
                <option value="not-set">Not selected</option>
                <option value="10dlc">A2P 10DLC long code</option>
                <option value="toll-free">Verified toll-free</option>
                <option value="short-code">Approved short code</option>
              </select>
            </label>
            <label>
              A2P brand registration status
              <select
                value={twilioLaunchProfile.a2pBrandStatus}
                onChange={(event) => updateTwilioComplianceStatus("a2pBrandStatus", event.target.value)}
              >
                <option value="not-started">Not started</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Needs revision</option>
                <option value="not-used">Not used for sender</option>
              </select>
            </label>
            <label>
              A2P campaign registration status
              <select
                value={twilioLaunchProfile.a2pCampaignStatus}
                onChange={(event) => updateTwilioComplianceStatus("a2pCampaignStatus", event.target.value)}
              >
                <option value="not-started">Not started</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Needs revision</option>
                <option value="not-used">Not used for sender</option>
              </select>
            </label>
            <label>
              Toll-free verification status
              <select
                value={twilioLaunchProfile.tollFreeVerificationStatus}
                onChange={(event) => updateTwilioComplianceStatus("tollFreeVerificationStatus", event.target.value)}
              >
                <option value="not-started">Not started</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Needs revision</option>
                <option value="not-used">Not used for sender</option>
              </select>
            </label>
            <label>
              Messaging compliance notes
              <textarea
                rows={3}
                value={twilioLaunchProfile.complianceNotes}
                onChange={(event) => updateTwilioLaunchProfile("complianceNotes", event.target.value)}
                placeholder="Non-secret registration status notes for the private relay handoff."
              />
            </label>
            <button type="submit" className="operations-action secondary">
              <ShieldCheck size={18} /> Save Launch Profile
            </button>
            <button
              type="button"
              className="operations-action secondary"
              onClick={checkTwilioRelayHealth}
              disabled={!twilioLaunchProfile.relayHealthCheckUrl.trim() || isTwilioRelayHealthChecking}
            >
              <Server size={18} /> {isTwilioRelayHealthChecking ? "Checking Relay..." : "Check Relay Health"}
            </button>
            <p className="operations-note">Relay health: {twilioRelayHealthStatus}</p>
            {twilioRelayHealthChecks && (
              <div className="message-readiness-panel message-relay-health-checks" role="group" aria-label="Twilio relay health readiness checks">
                <ul className="message-readiness-list">
                  {twilioRelayHealthCheckLabels.map((item) => {
                    const isReady = twilioRelayHealthChecks[item.key];
                    return (
                      <li key={item.key} className={isReady ? undefined : "message-readiness-warning"}>
                        <CheckCircle2 size={18} aria-hidden="true" />
                        <span>
                          <strong>{item.label}</strong>
                          <em>{isReady ? "Ready" : "Needs attention"}</em>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <p className="operations-note">Do not paste Auth Tokens, API secrets, account passwords, or VAPID private keys here. Those belong only in the private server environment.</p>
          </form>
          <div className="message-notification-actions">
            <button type="button" className="operations-action secondary" onClick={exportProductionMessagingIntegrationManifest}>
              <FileText size={18} /> Export Integration Manifest
            </button>
          </div>
          <div className="message-readiness-panel" role="group" aria-label="Twilio live readiness checklist">
            <h3>Live Twilio Readiness</h3>
            <ul className="message-readiness-list">
              <li>
                <Server size={18} aria-hidden="true" />
                <span>
                  <strong>Server relay required</strong>
                  <em>{twilioServerReadinessLabel}</em>
                </span>
              </li>
              <li>
                <Send size={18} aria-hidden="true" />
                <span>
                  <strong>{relayReadyQueueLabel}</strong>
                  <em>{staleQueuedCount ? `${staleQueuedCount} stale queued text${staleQueuedCount === 1 ? "" : "s"} blocked` : "No stale queued texts blocking export"}</em>
                </span>
              </li>
              <li>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <strong>{smsOptOutLabel}</strong>
                  <em>Consent guard active</em>
                </span>
              </li>
              <li className={twilioComplianceProfile.readyForUsProductionTraffic ? undefined : "message-readiness-warning"}>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <strong>{twilioComplianceLabel}</strong>
                  <em>{twilioComplianceDetail}</em>
                </span>
              </li>
              <li>
                <Smartphone size={18} aria-hidden="true" />
                <span>
                  <strong>{deviceNotificationsReady ? "Device notifications enabled" : "Device notifications not enabled"}</strong>
                  <em>Permission: {notificationPermissionLabel}. Preference: {messageNotificationSettings.browserNotificationsEnabled ? "enabled" : "off"}.</em>
                </span>
              </li>
              <li>
                <Bell size={18} aria-hidden="true" />
                <span>
                  <strong>{pushSubscriptionReady ? "Push subscription connected" : "Push subscription not connected"}</strong>
                  <em>Private push server sync {pushSubscriptionReady ? "ready" : "needs this device subscription"}</em>
                </span>
              </li>
              <li>
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>
                  <strong>Relay result import ready</strong>
                  <em>Immediate send responses reconcile back into the text log</em>
                </span>
              </li>
              <li>
                <Bell size={18} aria-hidden="true" />
                <span>
                  <strong>Status callback import ready</strong>
                  <em>Twilio delivery callbacks can update live message status</em>
                </span>
              </li>
              <li>
                <MessageCircle size={18} aria-hidden="true" />
                <span>
                  <strong>Inbound webhook import ready</strong>
                  <em>Known SMS replies can become app messages</em>
                </span>
              </li>
              <li className="message-readiness-warning">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <strong>Webhook signature helper ready</strong>
                  <em>Private relay must enforce X-Twilio-Signature before webhook persistence</em>
                </span>
              </li>
            </ul>
          </div>
          <div className="message-consent-guard" aria-label="SMS consent guard">
            <p>{smsOptOutCount} SMS opt-out record{smsOptOutCount === 1 ? "" : "s"} active.</p>
            <label>
              SMS opt-out phone number
              <input value={smsOptOutPhone} onChange={(event) => setSmsOptOutPhone(event.target.value)} placeholder="(262) 555-0101" />
            </label>
            <div className="message-consent-actions">
              <button type="button" className="operations-action secondary" onClick={markSmsOptOut} disabled={!smsOptOutPhone.trim()}>
                <ShieldCheck size={18} /> Mark SMS Opt-Out
              </button>
              <button type="button" className="operations-action secondary" onClick={clearSmsOptOut} disabled={!smsOptOutPhone.trim()}>
                <CheckCircle2 size={18} /> Clear SMS Opt-Out
              </button>
              <button type="button" className="operations-action secondary" onClick={exportSmsConsentEvidence}>
                <FileText size={18} /> Export Consent Evidence
              </button>
            </div>
            <label>
              Twilio inbound webhook JSON
              <textarea rows={4} value={twilioInboundWebhookJson} onChange={(event) => setTwilioInboundWebhookJson(event.target.value)} />
            </label>
            <button type="button" className="operations-action secondary" onClick={applyTwilioInbound} disabled={!twilioInboundWebhookJson.trim()}>
              <MessageCircle size={18} /> Apply Twilio Inbound
            </button>
            <label>
              Twilio status callback JSON
              <textarea rows={4} value={twilioStatusCallbackJson} onChange={(event) => setTwilioStatusCallbackJson(event.target.value)} />
            </label>
            <button type="button" className="operations-action secondary" onClick={applyTwilioStatus} disabled={!twilioStatusCallbackJson.trim()}>
              <Bell size={18} /> Apply Twilio Status
            </button>
          </div>
        </section>
      </div>
      <div className="operations-two-column">
        <section className="operations-panel">
          <h2>Follow-Up Automation</h2>
          <p>{missedCount} student{missedCount === 1 ? "" : "s"} currently missed 3 classes or more.</p>
          <div className="message-automation-actions">
            <button type="button" className="operations-action" onClick={sendFollowUps}>
              <Mail size={18} /> Send Missed-Class Follow-Ups
            </button>
            <button type="button" className="operations-action secondary" onClick={queueEventReminders}>
              <CalendarDays size={18} /> Queue Event Reminders
            </button>
            <button type="button" className="operations-action secondary" onClick={runAutomations}>
              <Sparkles size={18} /> Run Text Automations
            </button>
            <button type="button" className="operations-action secondary" onClick={exportTextAutomationManifest}>
              <FileText size={18} /> Export Automation Manifest
            </button>
          </div>
          <div className="message-automation-history" aria-label="Text automation run history">
            <h3>Automation Run History</h3>
            {visibleTextAutomationRuns.length ? (
              visibleTextAutomationRuns.map((run) => (
                <article key={run.id} className="message-scheduled-promotion">
                  <div>
                    <strong>{automationRunStatusLabel(run)}</strong>
                    {run.status === "no-due-texts" && <small>0 queued</small>}
                    <span>{new Date(run.ranAt).toLocaleString()} · Twilio SMS · {run.relayPayloadSchemaVersion}</span>
                  </div>
                  <p>{automationRunBreakdownSummary(run)}</p>
                </article>
              ))
            ) : (
              <p className="operations-note">No automation runs recorded yet.</p>
            )}
          </div>
        </section>
        <form className="operations-form-panel message-promotion-scheduler" onSubmit={schedulePromotion}>
          <h2>Promotion Automation</h2>
          <p>{activeScheduledPromotions.length} scheduled promotion{activeScheduledPromotions.length === 1 ? "" : "s"}</p>
          <label>
            Promotion audience
            <select value={scheduledPromotionAudience} onChange={(event) => setScheduledPromotionAudience(event.target.value as MessageCampaign["audience"])}>
              <option value="all-students">Students</option>
              <option value="parents">Parents</option>
              <option value="staff">Staff</option>
              <option value="everyone">Everyone</option>
            </select>
          </label>
          <label>
            Promotion send date
            <input type="date" value={scheduledPromotionDate} onChange={(event) => setScheduledPromotionDate(event.target.value)} />
          </label>
          <label>
            Promotion send time
            <input type="time" value={scheduledPromotionTime} onChange={(event) => setScheduledPromotionTime(event.target.value)} />
          </label>
          <label>
            Scheduled promotion message
            <textarea rows={4} value={scheduledPromotionMessage} onChange={(event) => setScheduledPromotionMessage(event.target.value)} />
          </label>
          <p className="message-sms-preflight">{scheduledPromotionSmsPreflight}</p>
          <p className="message-sms-preflight">{scheduledPromotionOptOutPreflight}</p>
          <button type="submit">
            <Sparkles size={18} /> Schedule Promotion
          </button>
          <div className="message-scheduled-promotions" aria-label="Scheduled promotions">
            {visibleScheduledPromotions.length ? (
              visibleScheduledPromotions.map((campaign) => (
                <article key={campaign.id} className="message-scheduled-promotion">
                  <div>
                    <strong>{campaign.title}</strong>
                    <span>{scheduledPromotionWhenLabel(campaign)} · {messageAudienceLabel(campaign.audience)} · {scheduledPromotionStatusLabel(campaign.status)}</span>
                  </div>
                  <p>{campaign.body}</p>
                  {campaign.status === "scheduled" && (
                    <button type="button" className="operations-action secondary" onClick={() => cancelScheduledPromotion(campaign)}>
                      <Trash2 size={16} /> Cancel
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p className="operations-note">No scheduled promotions yet.</p>
            )}
          </div>
        </form>
        <section className="operations-panel">
          <h2>Delivery Queue</h2>
          <p>{queuedCount} text{queuedCount === 1 ? "" : "s"} waiting to be sent.</p>
          <button type="button" className="operations-action" onClick={sendQueue} disabled={!queuedCount}>
            <Send size={18} /> Send Queued Texts
          </button>
          <button type="button" className="operations-action secondary" onClick={exportTwilioRelayPayload} disabled={!queuedCount}>
            <FileText size={18} /> Export Twilio Relay JSON
          </button>
          <label className="message-relay-endpoint-input">
            Private Twilio relay URL
            <input
              type="url"
              value={twilioRelayEndpoint}
              onChange={(event) => updateTwilioRelayEndpoint(event.target.value)}
              placeholder="https://relay.example.com/api/messages/send"
            />
          </label>
          <button type="button" className="operations-action secondary" onClick={sendToTwilioRelay} disabled={!queuedCount || !twilioRelayEndpoint.trim() || isTwilioRelaySending}>
            <Server size={18} /> {isTwilioRelaySending ? "Sending to Relay..." : "Send to Twilio Relay"}
          </button>
          {staleQueuedCount > 0 && (
            <button type="button" className="operations-action secondary" onClick={clearStaleTexts}>
              <Trash2 size={18} /> Clear Stale Texts
            </button>
          )}
          <label className="message-relay-results-input">
            Twilio relay results JSON
            <textarea rows={4} value={twilioRelayResultsJson} onChange={(event) => setTwilioRelayResultsJson(event.target.value)} />
          </label>
          <button type="button" className="operations-action secondary" onClick={applyTwilioResults} disabled={!twilioRelayResultsJson.trim()}>
            <CheckCircle2 size={18} /> Apply Twilio Results
          </button>
          <p className="operations-note">Relay export contains only deliverable queued texts and is designed for a private Twilio server endpoint with manager auth.</p>
        </section>
        <form className="operations-form-panel" onSubmit={sendMarketing}>
          <h2>Marketing Tool</h2>
          <label>
            Audience
            <select value={marketingAudience} onChange={(event) => setMarketingAudience(event.target.value as MessageCampaign["audience"])}>
              <option value="all-students">Students</option>
              <option value="parents">Parents</option>
              <option value="staff">Staff</option>
              <option value="everyone">Everyone</option>
            </select>
          </label>
          <label>
            Marketing message
            <textarea rows={4} value={marketingMessage} onChange={(event) => setMarketingMessage(event.target.value)} />
          </label>
          <div className="message-audience-preview" aria-label="Selected text audience delivery preview">
            <strong>Delivery preview: {marketingAudiencePreview.total} contact{marketingAudiencePreview.total === 1 ? "" : "s"} ready</strong>
            <div>
              <span>Students {marketingAudiencePreview.students}</span>
              <span>Parents {marketingAudiencePreview.parents}</span>
              <span>Staff {marketingAudiencePreview.staff}</span>
            </div>
            <p>Inactive contacts, missing phones, duplicate phones, SMS opt-outs, and missing SMS consent evidence are excluded before queueing.</p>
          </div>
          <p className="message-sms-preflight">{marketingSmsPreflight}</p>
          <p className="message-sms-preflight">{marketingOptOutPreflight}</p>
          <button type="submit">
            <Mail size={18} /> Send Marketing Blast
          </button>
          {messageCampaigns[0] && <p className="operations-note">Latest campaign: {messageCampaigns[0].title}</p>}
        </form>
      </div>
      <section className="operations-panel">
        <h2>Text Log</h2>
        <div className="message-log-grid">
          {messageLogs.map((message) => <MessagePreview key={message.id} message={message} onSendQueuedText={sendSingleQueuedText} />)}
        </div>
      </section>
    </OperationsPage>
  );
}

function CheckInsPage() {
  const { accountRole, currentManagedAccount, session, students, checkIns, recordStudentCheckIn, showToast } = useAppState();
  const today = toDateKey(useLiveCalendarDate());
  const isStudentMode = accountRole === "student";
  const sessionStudent = isStudentMode ? selectSessionStudent(students, session?.email, currentManagedAccount?.studentId) : undefined;
  const checkInStudents = useMemo(() => students.filter(isCurrentOperationsStudent), [students]);
  const firstStudentId = checkInStudents[0]?.id ?? "";
  const [selectedStudentId, setSelectedStudentId] = useState(firstStudentId);
  const selectedStudent = sessionStudent ?? checkInStudents.find((student) => student.id === selectedStudentId) ?? checkInStudents[0];
  const selectedStudentCheckIns = selectedStudent ? checkIns.filter((checkIn) => checkIn.studentId === selectedStudent.id) : [];
  const todayStudentCheckIn = selectedStudentCheckIns.find((checkIn) => checkIn.date === today);
  const knownCheckInDates = [
    selectedStudentCheckIns[0]?.date,
    selectedStudent?.lastCheckIn
  ].filter((date): date is string => Boolean(date));
  const latestCheckInDate = knownCheckInDates.sort((left, right) => right.localeCompare(left))[0];
  const studentAfterCheckIn = selectedStudent ? students.find((student) => student.id === selectedStudent.id) : undefined;
  const displayedStudent = studentAfterCheckIn ?? selectedStudent;
  const checkInProgress = displayedStudent ? buildStudentBeltProgress(displayedStudent) : undefined;
  const checkInProgressStatus = checkInProgress?.isBlackBelt
    ? "Ongoing black belt training"
    : checkInProgress?.readyForReview
      ? "Ready for instructor review"
      : `${checkInProgress?.classesRemaining ?? 0} class${checkInProgress?.classesRemaining === 1 ? "" : "es"} to testing review`;

  const checkIn = () => {
    if (!selectedStudent) return;
    const created = recordStudentCheckIn(selectedStudent.id);
    if (created) {
      showToast(created.queuedMessage ? `${created.studentName} checked in. Progress outreach queued.` : `${created.studentName} checked in.`);
    } else {
      showToast(`${fullName(selectedStudent)} is already checked in today.`);
    }
  };

  return (
    <OperationsPage title={isStudentMode ? "Student Check-In" : "Check-Ins"} text="Students can sign in, track belt progress, and reset missed-class follow-up status.">
      <div className="operations-two-column">
        <section className="operations-panel checkin-panel">
          {!isStudentMode && checkInStudents.length > 0 && (
            <label>
              Student
              <select value={selectedStudent?.id ?? ""} onChange={(event) => setSelectedStudentId(event.target.value)}>
                {checkInStudents.map((student) => (
                  <option key={student.id} value={student.id}>{fullName(student)}</option>
                ))}
              </select>
            </label>
          )}
          {!selectedStudent && <p className="operations-note">No current students are available for check-in.</p>}
          {selectedStudent && (
            <>
              <div className="student-rank-card">
                <Award size={32} />
                <div>
                  <p>Current rank</p>
                  <h2>{displayedStudent?.beltRank ?? selectedStudent.beltRank} Belt</h2>
                </div>
              </div>
              <p>Classes attended: {displayedStudent?.classesAttended ?? selectedStudent.classesAttended}</p>
              <p>Missed classes: {displayedStudent?.missedClassCount ?? selectedStudent.missedClassCount}</p>
              {checkInProgress && (
                <section className="checkin-progress-card" aria-label="Check-in belt progress">
                  <div className="checkin-progress-copy">
                    <span>{checkInProgress.classesAttended} of {checkInProgress.classesRequired} classes complete</span>
                    <strong>{checkInProgressStatus}</strong>
                    {checkInProgress.nextRankName && <p>Next rank target: {checkInProgress.nextRankName} Belt</p>}
                  </div>
                  <div className="checkin-progress-meter" aria-label={`${checkInProgress.progressPercent}% of ${checkInProgress.classesRequired} classes complete`}>
                    <span style={{ width: `${checkInProgress.progressPercent}%` }} />
                  </div>
                </section>
              )}
              <button type="button" className="operations-action" onClick={checkIn} disabled={Boolean(todayStudentCheckIn)}>
                <CheckCircle2 size={18} /> {todayStudentCheckIn ? "Already checked in today" : "Check In Today"}
              </button>
              {todayStudentCheckIn ? (
                <p className="operations-success">Checked in today: {todayStudentCheckIn.date}</p>
              ) : latestCheckInDate ? (
                <p className="operations-note">Last check-in: {latestCheckInDate}</p>
              ) : null}
            </>
          )}
        </section>
        <section className="operations-panel">
          <h2>Recent Check-Ins</h2>
          <div className="operations-list compact">
            {checkIns.length ? checkIns.map((checkIn) => (
              <article className="operations-list-card" key={checkIn.id}>
                <strong>{checkIn.studentName}</strong>
                <p>{checkIn.date} · {checkIn.beltRank} Belt</p>
              </article>
            )) : <p>No check-ins recorded yet.</p>}
          </div>
        </section>
      </div>
    </OperationsPage>
  );
}

function EventCard({ event }: { event: StudioEvent }) {
  return (
    <article className="workflow-directory-row workflow-directory-row--event">
      <span className="workflow-directory-icon workflow-directory-icon--event" aria-hidden="true" />
      <span className="workflow-directory-name">
        {event.title}
        <small>{event.details}</small>
      </span>
      <span className="workflow-directory-cell">{event.date}</span>
      <span className="workflow-directory-cell">{event.time}</span>
      <span className="workflow-directory-cell">{audienceLabel(event.audience)}</span>
    </article>
  );
}

function EventsPage() {
  const { accountRole, studioEvents, addStudioEvent, showToast } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", date: "2026-06-01", time: "6:00 PM", details: "", audience: "students" as StudioEvent["audience"] });
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const isStudent = accountRole === "student";
  const eventSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const shouldReturnToDashboard = eventSearchParams.get("returnTo") === "dashboard";
  const eventGroups = useMemo(
    () => Array.from(new Set(studioEvents.map((event) => event.audience)))
      .sort((left, right) => audienceLabel(left).localeCompare(audienceLabel(right), undefined, { sensitivity: "base" }))
      .map((audience) => ({
        audience,
        label: audienceLabel(audience),
        items: studioEvents.filter((event) => event.audience === audience)
      })),
    [studioEvents]
  );

  useEffect(() => {
    if (isStudent || eventSearchParams.get("create") !== "event") return;
    setEventModalOpen(true);
    navigate(shouldReturnToDashboard ? "/events?returnTo=dashboard" : "/events", { replace: true });
  }, [eventSearchParams, isStudent, navigate, shouldReturnToDashboard]);

  const openEventModal = () => {
    setEventModalOpen(true);
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setForm({ title: "", date: form.date, time: form.time, details: "", audience: "students" });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const created = addStudioEvent(form);
    if (!created) {
      showToast("Enter event title, date, and time.");
      return;
    }
    setForm({ title: "", date: form.date, time: form.time, details: "", audience: "students" });
    setEventModalOpen(false);
    showToast(`${created.title} added to events.`);
    if (shouldReturnToDashboard) {
      navigate(`/dashboard?date=${created.date}`);
    }
  };

  return (
    <OperationsPage
      className="operations-page--workflow"
      title="Events"
      text="Keep students up to date on testing dates, movie night, and special studio events."
      action={!isStudent && (
        <button type="button" className="operations-action student-header-add" onClick={openEventModal}>
          <Plus size={18} /> Add Event
        </button>
      )}
    >
      <section className="operations-panel workflow-directory-panel">
        <div className="student-roster-head">
          <div>
            <h2>Studio Event Board</h2>
            <p>{studioEvents.length} event{studioEvents.length === 1 ? "" : "s"} grouped by audience.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Event directory">
          {eventGroups.map((group) => (
            <section key={group.audience} className={`workflow-directory-group workflow-directory-group--${slugClassName(group.label)}`} role="group" aria-label={`${group.label} events`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{group.label}</h3>
                </div>
                <span>{group.items.length} event{group.items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="workflow-directory-list workflow-directory-list--events">
                <div className="workflow-directory-list-head" aria-hidden="true">
                  <span aria-hidden="true" />
                  <span className="workflow-directory-column-label">Event</span>
                  <span className="workflow-directory-column-label">Date</span>
                  <span className="workflow-directory-column-label">Time</span>
                  <span className="workflow-directory-column-label">Audience</span>
                </div>
                {group.items.map((event) => <EventCard key={event.id} event={event} />)}
              </div>
            </section>
          ))}
        </div>
      </section>
      {eventModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeEventModal()}>
          <form
            aria-labelledby="event-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card workflow-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="event-modal-title">Add Event</h2>
                <p>Create a studio event for students, families, or staff.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close event editor" onClick={closeEventModal}>
                <X size={18} />
              </button>
            </div>
            <label>
              Event title
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>
              Event date
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
            <label>
              Event time
              <input value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
            </label>
            <label>
              Event details
              <textarea rows={4} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} />
            </label>
            <button type="submit">
              <Plus size={18} /> Add Event
            </button>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

const emptyMerchandiseForm = {
  name: "",
  category: "Gloves",
  price: "39",
  stock: "6",
  reorderPoint: "3",
  targetStock: "8",
  description: "",
  imageDataUrl: ""
};

function merchandiseItemToForm(item: MerchandiseItem) {
  return {
    name: item.name,
    category: item.category,
    price: String(item.price),
    stock: String(item.stock),
    reorderPoint: String(getMerchandiseReorderPoint(item)),
    targetStock: String(getMerchandiseTargetStock(item)),
    description: item.description,
    imageDataUrl: item.imageDataUrl ?? ""
  };
}

function MerchandiseCard({ item, onEdit }: { item: MerchandiseItem; onEdit: (item: MerchandiseItem) => void }) {
  return (
    <button type="button" className="workflow-directory-row workflow-directory-row--button workflow-directory-row--merchandise" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}>
      <span className="workflow-directory-product-image">
        {item.imageDataUrl ? <img src={item.imageDataUrl} alt={item.name} /> : <ShoppingCart aria-hidden="true" size={24} />}
      </span>
      <span className="workflow-directory-name">
        {item.name}
        <small>{item.description}</small>
      </span>
      <span className="workflow-directory-cell">{formatMoney(item.price)}</span>
      <span className="workflow-directory-cell">{item.stock} in stock</span>
    </button>
  );
}

function MerchandisePage() {
  const { merchandiseItems, addMerchandiseItem, updateMerchandiseItem, deleteMerchandiseItem, showToast } = useAppState();
  const [form, setForm] = useState(emptyMerchandiseForm);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedMerchandiseId, setSelectedMerchandiseId] = useState("");
  const selectedMerchandise = merchandiseItems.find((item) => item.id === selectedMerchandiseId);
  const inventoryValue = useMemo(() => merchandiseItems.reduce((sum, item) => sum + item.price * item.stock, 0), [merchandiseItems]);
  const merchandiseGroups = useMemo(
    () => Array.from(new Set(merchandiseItems.map((item) => item.category)))
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map((category) => ({
        category,
        items: merchandiseItems.filter((item) => item.category === category).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
      })),
    [merchandiseItems]
  );

  const closeMerchandiseModal = () => {
    setModalMode(null);
    setSelectedMerchandiseId("");
    setForm(emptyMerchandiseForm);
  };

  const openCreateMerchandise = () => {
    setSelectedMerchandiseId("");
    setForm(emptyMerchandiseForm);
    setModalMode("create");
  };

  const openEditMerchandise = (item: MerchandiseItem) => {
    setSelectedMerchandiseId(item.id);
    setForm(merchandiseItemToForm(item));
    setModalMode("edit");
  };

  const handleImageUpload = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, imageDataUrl: typeof reader.result === "string" ? reader.result : "" }));
    };
    reader.readAsDataURL(file);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      reorderPoint: Number(form.reorderPoint),
      targetStock: Number(form.targetStock),
      description: form.description,
      imageDataUrl: form.imageDataUrl || undefined
    };
    const saved = selectedMerchandise && modalMode === "edit"
      ? updateMerchandiseItem(selectedMerchandise.id, payload)
      : addMerchandiseItem(payload);
    if (!saved) {
      showToast("Enter product name, category, price, and stock.");
      return;
    }
    closeMerchandiseModal();
    showToast(`${saved.name} saved to merchandise.`);
  };

  const deleteSelectedMerchandise = () => {
    if (!selectedMerchandise) return;
    const deleted = deleteMerchandiseItem(selectedMerchandise.id);
    if (!deleted) return;
    closeMerchandiseModal();
    showToast(`${deleted.name} removed from merchandise.`);
  };

  const modalTitle = modalMode === "edit" && selectedMerchandise ? `Edit ${selectedMerchandise.name}` : "Add New Merchandise";

  return (
    <OperationsPage
      className="operations-page--workflow"
      title="Merchandise"
      text="Upload and browse gloves, uniforms, sparring equipment, and Cho's apparel."
      action={
        <button type="button" className="operations-action student-header-add" onClick={openCreateMerchandise}>
          <Plus size={18} /> Add New Merchandise
        </button>
      }
    >
      <div className="operations-stats">
        <StatCard label="Products" value={merchandiseItems.length} icon={<Package />} />
        <StatCard label="Inventory value" value={formatMoney(inventoryValue)} icon={<Target />} />
      </div>
      <div className="operations-single-column">
        <section className="operations-panel merchandise-manager-panel workflow-directory-panel">
          <h2>Product List</h2>
          <div className="workflow-directory-grid" aria-label="Product directory">
            {merchandiseGroups.map((group) => (
              <section key={group.category} className={`workflow-directory-group workflow-directory-group--${slugClassName(group.category)}`} role="group" aria-label={`${group.category} merchandise`}>
                <div className="workflow-directory-group-head">
                  <div>
                    <span className="workflow-directory-swatch" aria-hidden="true" />
                    <h3>{group.category}</h3>
                  </div>
                  <span>{group.items.length} product{group.items.length === 1 ? "" : "s"}</span>
                </div>
                <div className="workflow-directory-list workflow-directory-list--merchandise">
                  <div className="workflow-directory-list-head" aria-hidden="true">
                    <span aria-hidden="true" />
                    <span className="workflow-directory-column-label">Product</span>
                    <span className="workflow-directory-column-label">Price</span>
                    <span className="workflow-directory-column-label">Stock</span>
                  </div>
                  {group.items.map((item) => (
                    <MerchandiseCard key={item.id} item={item} onEdit={openEditMerchandise} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
      {modalMode && (
        <div className="modal-backdrop" role="presentation" onClick={closeMerchandiseModal}>
          <form
            aria-labelledby="merchandise-modal-title"
            aria-modal="true"
            className="modal-card operations-form-panel student-modal-card merchandise-modal-card"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="merchandise-modal-title">{modalTitle}</h2>
                <p>Manage the item details, inventory count, and display image shown in the merchandise shop.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close merchandise editor" onClick={closeMerchandiseModal}>
                <X size={18} />
              </button>
            </div>
            <section className="student-form-section">
              <h3>Product Details</h3>
              <div className="student-form-grid">
                <label>
                  Product name
                  <input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label>
                  Category
                  <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                </label>
                <label>
                  Price
                  <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
                </label>
                <label>
                  Stock
                  <input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                </label>
                <label>
                  Reorder point
                  <input type="number" min="0" step="1" value={form.reorderPoint} onChange={(event) => setForm({ ...form, reorderPoint: event.target.value })} />
                </label>
                <label>
                  Target stock
                  <input type="number" min="1" step="1" value={form.targetStock} onChange={(event) => setForm({ ...form, targetStock: event.target.value })} />
                </label>
                <label className="student-form-wide">
                  Description
                  <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              </div>
            </section>
            <section className="student-form-section">
              <h3>Product Image</h3>
              <div className="merchandise-upload-grid">
                <label className="merchandise-image-upload">
                  Product image
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                </label>
                <div className="merchandise-image-preview">
                  {form.imageDataUrl ? <img src={form.imageDataUrl} alt="Uploaded merchandise preview" /> : <span>No product image uploaded.</span>}
                </div>
              </div>
            </section>
            <div className="student-editor-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> {modalMode === "edit" ? "Save Merchandise Changes" : "Create Merchandise"}
              </button>
              {modalMode === "edit" && (
                <button type="button" className="student-delete-action" onClick={deleteSelectedMerchandise}>
                  <Trash2 size={18} /> Delete Merchandise
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

function OperationsHomePage() {
  const { accountRole } = useAppState();
  if (accountRole === "student") return <StudentProfilePage />;
  if (accountRole === "guardian") return <ParentProfilePage />;
  return <ManagerHomePage />;
}

function StaffOnlyRoute({ children }: { children: ReactNode }) {
  const { accountRole } = useAppState();
  return accountRole === "staff" ? <>{children}</> : <Navigate to="/" replace />;
}

function StaffOrStudentRoute({ children }: { children: ReactNode }) {
  const { accountRole } = useAppState();
  return accountRole === "staff" || accountRole === "student" ? <>{children}</> : <Navigate to="/" replace />;
}

function ManagerPanelRoute() {
  const { accountRole } = useAppState();
  if (accountRole === "guardian") return <Navigate to="/" replace />;
  return <ManagerLauncherPage />;
}

export function OperationsApp() {
  return (
    <OperationsShell>
      <Routes>
        <Route path="/" element={<OperationsHomePage />} />
        <Route path="/manager" element={<ManagerPanelRoute />} />
        <Route path="/dashboard" element={<StaffOnlyRoute><DashboardPage /></StaffOnlyRoute>} />
        <Route path="/students" element={<StaffOnlyRoute><StudentsPage /></StaffOnlyRoute>} />
        <Route path="/classes" element={<StaffOnlyRoute><ClassesPage /></StaffOnlyRoute>} />
        <Route path="/study-guide" element={<StaffOnlyRoute><ManagerStudyGuidePage /></StaffOnlyRoute>} />
        <Route path="/schedule" element={<StaffOnlyRoute><SchedulePage /></StaffOnlyRoute>} />
        <Route path="/messages" element={<StaffOnlyRoute><MessagesPage /></StaffOnlyRoute>} />
        <Route path="/check-ins" element={<StaffOrStudentRoute><CheckInsPage /></StaffOrStudentRoute>} />
        <Route path="/events" element={<StaffOnlyRoute><EventsPage /></StaffOnlyRoute>} />
        <Route path="/merchandise" element={<StaffOnlyRoute><MerchandisePage /></StaffOnlyRoute>} />
        <Route path="/videos" element={<StaffOnlyRoute><ManagerVideosPage /></StaffOnlyRoute>} />
        <Route path="/reports" element={<StaffOnlyRoute><ReportsPage /></StaffOnlyRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OperationsShell>
  );
}
