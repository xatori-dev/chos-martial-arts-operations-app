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
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Search,
  Send,
  Server,
  Smile,
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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent as ReactChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
import { buildLiveChatNotificationPlan, enabledWebPushNotificationChannels } from "./notificationRouting";
import { publicAsset } from "./appAssets";
import {
  fetchLiveChatMessages,
  getLiveChatAvailability,
  liveChatMessageMaxLength,
  liveChatRoomKey,
  sendLiveChatMessage,
  subscribeToLiveChatInserts,
  validateLiveChatBody,
  type LiveChatMessage
} from "./supabaseLiveChat";
import {
  getBeltJourneyStats,
  resolveBeltRank
} from "./beltCase";
import { childUsernameFromName, normalizeChildUsername } from "./childAccountUtils";
import { beltRanks } from "./data";
import { createSupabaseManagedAccount, getSupabaseBrowserConfig, isSupabaseAuthConfigured, readSupabaseAuthSession } from "./supabaseAccounts";
import { deleteSupabaseAppStateItem, fetchSupabaseAppStateItem, isSupabaseAppStateRemoteBacked, persistSupabaseAppStateItem } from "./supabaseAppStatePersistence";
import {
  readManagerProfile,
  readGuardianProfile,
  readStaffProfile,
  readStudentProfile,
  writeGuardianProfile,
  writeManagerProfile,
  writeStaffProfile,
  writeStudentProfile,
  type LandingPagePreference,
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
  readStoredVisualTheme,
  visualColorKeys,
  writeStoredAppTheme,
  writeStoredVisualTheme,
  type AppThemeMode,
  type VisualColorKey,
  type VisualThemeColors
} from "./theme";
import { buildTwilioSupabaseMessagingUrls, isSupabaseTwilioMessagingEndpoint, isTwilioRelayHealthReady, twilioConsentSyncUrlForRelayEndpoint } from "./twilioSupabaseMessaging";
import { validateTwilioRelayHealthResponseForBrowser, validateTwilioRelayPayloadForServer, type TwilioRelayHealthReadinessChecks } from "./twilioRelayContract";
import type { AccountRole, BeltRank, ChildAccount, ClassWeekday, DirectMessage, ManagedAccount, ManagerAccessKey, MerchandiseItem, MessageCampaign, MessageLog, MessageNotificationSettings, ScheduledClass, ScheduledTextCampaign, StudioClass, StudyGuideFolder, StudyGuideMaterial, StudentRecord, StudioEvent, TextAutomationRun, TrainingVideo, TrainingVideoFolder } from "./types";
import { downloadTextFile, formatMoney, hasSmsOptOutLanguage, isDeveloperAccountEnabled, profileAvatarPathForSession, smsOptOutPreflightText, smsSegmentPreflightText, validateEmail } from "./utils";

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

type ManagerLauncherIconKind = "dashboard" | "messages" | "students" | "classes" | "studyGuide" | "events" | "scheduling" | "merchandise" | "videos" | "reports" | "create" | "developer" | "study" | "test";

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

const developerLauncherItem: ManagerLauncherItem = { label: "Developer", icon: "developer" };

const studentLauncherItems: ManagerLauncherItem[] = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Classes", icon: "classes" },
  { label: "Study", icon: "study" },
  { label: "Test", icon: "test" },
  { label: "Videos", icon: "videos" }
];

type LandingPageOption = {
  value: LandingPagePreference;
  label: string;
};

const staffLandingPageBaseOptions: LandingPageOption[] = [
  { value: "live-chat", label: "Live Chat" },
  { value: "profile", label: "Profile" },
  { value: "manager-panel", label: "Panel" },
  { value: "check-ins", label: "Check-Ins" }
];

const managerAccessLandingPageOptions: Partial<Record<ManagerAccessKey, LandingPageOption>> = {
  dashboard: { value: "dashboard", label: "Dashboard" },
  messages: { value: "messages", label: "Messages" },
  students: { value: "students", label: "Students" },
  classes: { value: "classes", label: "Classes" },
  scheduling: { value: "schedule", label: "Schedule" },
  events: { value: "events", label: "Events" },
  merchandise: { value: "merchandise", label: "Merchandise" },
  videos: { value: "videos", label: "Videos" },
  studyGuide: { value: "study-guide", label: "Study Guide" },
  reports: { value: "reports", label: "Reports" }
};

const studentLandingPageOptions: LandingPageOption[] = [
  { value: "profile", label: "Profile" },
  { value: "student-panel", label: "Student Panel" },
  { value: "check-ins", label: "Check-Ins" }
];

const parentLandingPageOptions: LandingPageOption[] = [
  { value: "profile", label: "Parent Profile" },
  { value: "parent-dashboard", label: "Dashboard" },
  { value: "parent-classes", label: "Classes" },
  { value: "parent-study", label: "Study" },
  { value: "parent-test", label: "Test" },
  { value: "parent-messages", label: "Messages" },
  { value: "parent-notifications", label: "Notifications" }
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

const twilioRequiredServerEnvVars = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FUNCTION_PUBLIC_URL",
  "TWILIO_SENDER_TYPE",
  "TWILIO_A2P_BRAND_APPROVED",
  "TWILIO_A2P_CAMPAIGN_APPROVED"
];
const twilioAuthServerEnv = {
  productionRecommended: ["TWILIO_API_KEY", "TWILIO_API_KEY_SECRET"],
  webhookSignatureRequired: ["TWILIO_AUTH_TOKEN"]
};
const twilioSenderServerEnv = {
  recommended: ["TWILIO_MESSAGING_SERVICE_SID"],
  fallback: ["TWILIO_FROM_NUMBER"]
};
const twilioServerEnvLabels = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_API_KEY + TWILIO_API_KEY_SECRET",
  "TWILIO_AUTH_TOKEN for webhook signatures",
  "TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER",
  "TWILIO_FUNCTION_PUBLIC_URL",
  "10DLC approval flags"
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
  supportedAccountRoles: ["staff"]
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

type BrowserNotificationPermission = NotificationPermission | "unsupported";

function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") return "unsupported";
  return window.Notification.permission;
}

function canRequestBrowserNotifications() {
  return typeof window !== "undefined" && typeof window.Notification !== "undefined" && typeof window.Notification.requestPermission === "function";
}

function notificationPermissionDisplay(permission: BrowserNotificationPermission) {
  return permission === "unsupported" ? "unavailable" : permission;
}

function notificationHelperText(permission: BrowserNotificationPermission, enabled: boolean) {
  if (permission === "unsupported") return "Device alerts are unavailable in this browser.";
  if (permission === "denied") return "Device alerts are blocked in browser or system settings.";
  if (enabled && permission === "granted") return "Device alerts are on for the selected notification types on this browser.";
  return "Unread messages and Notification Center remain available when device alerts are off.";
}

type ProfileNotificationChannel = {
  id: "messages" | "liveChats" | "mentions";
  label: string;
  description: string;
  enabled: boolean;
};

type ProfileNotificationChannelId = ProfileNotificationChannel["id"];

function profileNotificationChannelSettings(channelId: ProfileNotificationChannelId, enabled: boolean): Partial<MessageNotificationSettings> {
  if (channelId === "liveChats") return { liveChatNotificationsEnabled: enabled };
  if (channelId === "mentions") return { mentionNotificationsEnabled: enabled };
  return { browserNotificationsEnabled: enabled };
}

function profileNotificationChannels(settings: MessageNotificationSettings): ProfileNotificationChannel[] {
  return [
    {
      id: "messages",
      label: "Messages",
      description: "Direct app messages and replies.",
      enabled: settings.browserNotificationsEnabled
    },
    {
      id: "liveChats",
      label: "Live Chats",
      description: "New activity in Live Chat rooms.",
      enabled: Boolean(settings.liveChatNotificationsEnabled)
    },
    {
      id: "mentions",
      label: "Mentions",
      description: "Live Chat messages that mention you.",
      enabled: Boolean(settings.mentionNotificationsEnabled)
    }
  ];
}

function buildNotificationDeviceSyncPatch(settings: MessageNotificationSettings, permission: BrowserNotificationPermission): Partial<MessageNotificationSettings> | undefined {
  const patch: Partial<MessageNotificationSettings> = {};
  if (settings.browserPermission !== permission) patch.browserPermission = permission;

  if (permission !== "granted") {
    if (settings.browserNotificationsEnabled) patch.browserNotificationsEnabled = false;
    if (settings.liveChatNotificationsEnabled) patch.liveChatNotificationsEnabled = false;
    if (settings.mentionNotificationsEnabled) patch.mentionNotificationsEnabled = false;
    if (settings.pushSubscriptionEndpoint) patch.pushSubscriptionEndpoint = undefined;
    if (settings.pushSubscriptionJson) patch.pushSubscriptionJson = undefined;
    if (settings.pushSubscribedAt) patch.pushSubscribedAt = undefined;
  }

  return Object.keys(patch).length ? patch : undefined;
}

function notificationDeviceSyncLabel(permission: BrowserNotificationPermission, enabled: boolean) {
  if (permission === "unsupported") return "unavailable";
  if (permission === "denied") return "blocked";
  if (permission === "granted" && enabled) return "ready";
  return "off";
}

function useNotificationDevicePermissionSync({
  enabled = true,
  settings,
  setPermission,
  updateSettings
}: {
  enabled?: boolean;
  settings: MessageNotificationSettings;
  setPermission: (permission: BrowserNotificationPermission) => void;
  updateSettings: (settings: Partial<MessageNotificationSettings>) => void;
}) {
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const syncDevicePermission = useCallback(() => {
    const permission = getBrowserNotificationPermission();
    setPermission(permission);
    const patch = buildNotificationDeviceSyncPatch(settingsRef.current, permission);
    if (patch) updateSettings(patch);
  }, [setPermission, updateSettings]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    syncDevicePermission();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") syncDevicePermission();
    };

    window.addEventListener("focus", syncDevicePermission);
    window.addEventListener("pageshow", syncDevicePermission);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let permissionStatus: PermissionStatus | undefined;
    let cancelled = false;
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      void navigator.permissions.query({ name: "notifications" as PermissionName }).then((status) => {
        if (cancelled) return;
        permissionStatus = status;
        status.onchange = syncDevicePermission;
      }).catch(() => undefined);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncDevicePermission);
      window.removeEventListener("pageshow", syncDevicePermission);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [enabled, syncDevicePermission]);

  return syncDevicePermission;
}

function useHomeNotificationStorageSync(email: string | undefined, setSettings: (settings: MessageNotificationSettings) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const storageKey = homeMessageNotificationStorageKey(email);
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== storageKey) return;
      setSettings(readHomeMessageNotificationSettings(email));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [email, setSettings]);
}

function ProfileNotificationSettingsControl({
  channels,
  onSendTest,
  onToggle,
  permission,
  pushSubscriptionReady
}: {
  channels: ProfileNotificationChannel[];
  onSendTest: () => void;
  onToggle: (channelId: ProfileNotificationChannel["id"]) => void;
  permission: BrowserNotificationPermission;
  pushSubscriptionReady: boolean;
}) {
  const enabled = channels.some((channel) => channel.enabled);
  const notificationsReady = enabled && permission === "granted";
  const deviceSyncStatus = notificationDeviceSyncLabel(permission, enabled);
  return (
    <section className="profile-notification-settings" aria-label="Profile notification settings">
      <div className="profile-notification-head">
        <div className="profile-notification-copy">
          <span>Notifications</span>
          <strong>Device alert preferences</strong>
          <p>{notificationHelperText(permission, enabled)}</p>
        </div>
      </div>
      <div className="profile-notification-channel-list">
        {channels.map((channel) => (
          <button
            type="button"
            className={`profile-notification-channel${channel.enabled ? " is-on" : ""}`}
            role="switch"
            aria-checked={channel.enabled}
            aria-label={`${channel.label} notifications`}
            key={channel.id}
            onClick={() => onToggle(channel.id)}
          >
            <span className="profile-notification-channel-copy">
              <strong>{channel.label}</strong>
              <small>{channel.description}</small>
            </span>
            <span className="profile-notification-switch" aria-hidden="true">
              <span />
              <b>{channel.enabled ? "On" : "Off"}</b>
            </span>
          </button>
        ))}
      </div>
      <div className="profile-notification-status-list" aria-label="Notification readiness">
        <span>Browser permission: {notificationPermissionDisplay(permission)}</span>
        <span>Device sync: {deviceSyncStatus}</span>
        <span>Push subscription: {pushSubscriptionReady ? "connected" : "not connected"}</span>
      </div>
      <button type="button" className="profile-notification-test" onClick={onSendTest} disabled={!notificationsReady}>
        <Bell size={16} aria-hidden="true" /> Send Test Notification
      </button>
    </section>
  );
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

async function clearDisplayedAppMessageNotifications() {
  await syncMessageAppBadge(0);
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (typeof registration.getNotifications !== "function") return;
    const notifications = await registration.getNotifications();
    notifications.forEach((notification) => {
      const data = notification.data as { url?: unknown } | undefined;
      const notificationUrl = typeof data?.url === "string" ? data.url : "";
      if (notification.tag.startsWith("chos-") || notificationUrl.includes("/messages")) {
        notification.close();
      }
    });
  } catch {
    // Displayed browser notifications are optional and may not be readable in every installed-app context.
  }
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
  const notificationChannels = enabledWebPushNotificationChannels(settings);
  if (!subscription || !settings.pushSubscriptionEndpoint?.trim() || !notificationChannels.length) return undefined;
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
    notificationChannels,
    notificationUrl,
    pushSubscribedAt: settings.pushSubscribedAt,
    subscription
  };
}

function messagesNotificationUrl() {
  if (typeof window === "undefined") return "messages";
  return new URL(`${import.meta.env.BASE_URL}messages`, window.location.origin).toString();
}

function liveChatNotificationUrl() {
  if (typeof window === "undefined") return "live-chat";
  return new URL(`${import.meta.env.BASE_URL}live-chat`, window.location.origin).toString();
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
      liveChatNotificationsEnabled: Boolean(parsed?.liveChatNotificationsEnabled),
      mentionNotificationsEnabled: Boolean(parsed?.mentionNotificationsEnabled),
      browserPermission: parsed?.browserPermission,
      lastBrowserNotifiedDirectMessageAt: typeof parsed?.lastBrowserNotifiedDirectMessageAt === "string" ? parsed.lastBrowserNotifiedDirectMessageAt : undefined,
      lastBrowserNotifiedLiveChatAt: typeof parsed?.lastBrowserNotifiedLiveChatAt === "string" ? parsed.lastBrowserNotifiedLiveChatAt : undefined,
      lastBrowserNotifiedMentionAt: typeof parsed?.lastBrowserNotifiedMentionAt === "string" ? parsed.lastBrowserNotifiedMentionAt : undefined,
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

function normalizeTwilioLaunchProfilePayload(profile?: Partial<TwilioLaunchProfile> | null): TwilioLaunchProfile {
  const managerAuthMode = profile?.managerAuthMode === "server-session" || profile?.managerAuthMode === "oauth-proxy" ? profile.managerAuthMode : "same-site-cookie";
  return sanitizeTwilioLaunchProfile({
    messagingServiceSid: profile?.messagingServiceSid ?? "",
    smsSender: profile?.smsSender ?? "",
    inboundWebhookUrl: profile?.inboundWebhookUrl ?? "",
    statusCallbackBaseUrl: profile?.statusCallbackBaseUrl ?? "",
    relayHealthCheckUrl: profile?.relayHealthCheckUrl ?? "",
    managerAuthMode,
    senderType: normalizeTwilioComplianceSenderType(profile?.senderType),
    a2pBrandStatus: normalizeTwilioComplianceStatus(profile?.a2pBrandStatus),
    a2pCampaignStatus: normalizeTwilioComplianceStatus(profile?.a2pCampaignStatus),
    tollFreeVerificationStatus: normalizeTwilioComplianceStatus(profile?.tollFreeVerificationStatus),
    complianceNotes: profile?.complianceNotes ?? "",
    savedAt: profile?.savedAt
  });
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
  if (isSupabaseAppStateRemoteBacked()) {
    removeMessagingSetupStorageItem(twilioLaunchProfileStorageKey);
    return defaultTwilioLaunchProfile;
  }
  try {
    const rawProfile = window.localStorage.getItem(twilioLaunchProfileStorageKey);
    if (!rawProfile) return defaultTwilioLaunchProfile;
    const parsed = JSON.parse(rawProfile) as Partial<TwilioLaunchProfile>;
    return normalizeTwilioLaunchProfilePayload(parsed);
  } catch {
    return defaultTwilioLaunchProfile;
  }
}

function removeMessagingSetupStorageItem(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Messaging setup persistence is optional; blocked storage should not break messaging.
  }
}

function persistMessagingSetupItem<T>(key: string, value: T | undefined) {
  if (!isSupabaseAppStateRemoteBacked()) return false;
  removeMessagingSetupStorageItem(key);
  if (value === undefined || (typeof value === "string" && !value.trim())) {
    void deleteSupabaseAppStateItem(key);
  } else {
    void persistSupabaseAppStateItem(key, value);
  }
  return true;
}

function writeTwilioLaunchProfile(profile: TwilioLaunchProfile) {
  if (typeof window === "undefined") return;
  const sanitizedProfile = sanitizeTwilioLaunchProfile(profile);
  if (persistMessagingSetupItem(twilioLaunchProfileStorageKey, sanitizedProfile)) return;
  try {
    window.localStorage.setItem(twilioLaunchProfileStorageKey, JSON.stringify(sanitizedProfile));
  } catch {
    // Launch profile persistence is optional; blocked storage should not break messaging.
  }
}

function readTwilioRelayEndpoint() {
  if (typeof window === "undefined") return "";
  if (isSupabaseAppStateRemoteBacked()) {
    removeMessagingSetupStorageItem(twilioRelayEndpointStorageKey);
    return "";
  }
  try {
    return window.localStorage.getItem(twilioRelayEndpointStorageKey) ?? "";
  } catch {
    return "";
  }
}

function writeTwilioRelayEndpoint(value: string) {
  if (typeof window === "undefined") return;
  const endpoint = value.trim();
  if (persistMessagingSetupItem(twilioRelayEndpointStorageKey, endpoint || undefined)) return;
  try {
    if (endpoint) {
      window.localStorage.setItem(twilioRelayEndpointStorageKey, endpoint);
    } else {
      window.localStorage.removeItem(twilioRelayEndpointStorageKey);
    }
  } catch {
    // Relay URL persistence is optional; blocked storage should not break messaging.
  }
}

function supabaseTwilioRelayAuthHeaders(endpoint: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  const { url, publicKey } = getSupabaseBrowserConfig();
  if (!publicKey || !isSupabaseTwilioMessagingEndpoint(endpoint, url)) return {};
  const session = readSupabaseAuthSession();
  if (!session) return {};
  return {
    apikey: publicKey,
    Authorization: `Bearer ${session.accessToken}`
  };
}

function readPushServerEndpoint() {
  if (typeof window === "undefined") return "";
  if (isSupabaseAppStateRemoteBacked()) {
    removeMessagingSetupStorageItem(pushServerEndpointStorageKey);
    return "";
  }
  try {
    return window.localStorage.getItem(pushServerEndpointStorageKey) ?? "";
  } catch {
    return "";
  }
}

function writePushServerEndpoint(value: string) {
  if (typeof window === "undefined") return;
  const endpoint = value.trim();
  if (persistMessagingSetupItem(pushServerEndpointStorageKey, endpoint || undefined)) return;
  try {
    if (endpoint) {
      window.localStorage.setItem(pushServerEndpointStorageKey, endpoint);
    } else {
      window.localStorage.removeItem(pushServerEndpointStorageKey);
    }
  } catch {
    // Push server URL persistence is optional; blocked storage should not break notifications.
  }
}

function useSupabaseMessagingSetupString(key: string, onValue: (value: string) => void, fallback = "") {
  useEffect(() => {
    if (!isSupabaseAppStateRemoteBacked()) return undefined;
    let cancelled = false;
    removeMessagingSetupStorageItem(key);
    void fetchSupabaseAppStateItem<string>(key).then((result) => {
      if (cancelled || result.status !== "ok") return;
      const remoteValue = typeof result.data === "string" ? result.data.trim() : "";
      onValue(remoteValue || fallback);
    });
    return () => {
      cancelled = true;
    };
  }, [fallback, key, onValue]);
}

function useSupabaseTwilioLaunchProfile(onValue: (profile: TwilioLaunchProfile) => void) {
  useEffect(() => {
    if (!isSupabaseAppStateRemoteBacked()) return undefined;
    let cancelled = false;
    removeMessagingSetupStorageItem(twilioLaunchProfileStorageKey);
    void fetchSupabaseAppStateItem<Partial<TwilioLaunchProfile>>(twilioLaunchProfileStorageKey).then((result) => {
      if (cancelled || result.status !== "ok" || !result.data || typeof result.data !== "object") return;
      onValue(normalizeTwilioLaunchProfilePayload(result.data));
    });
    return () => {
      cancelled = true;
    };
  }, [onValue]);
}

function buildProductionMessagingSetupBackupInput(
  settings: MessageNotificationSettings,
  setup: { twilioRelayEndpoint?: string; pushServerEndpoint?: string; twilioLaunchProfile?: TwilioLaunchProfile } = {}
): ProductionMessagingSetupBackup[] {
  return [
    {
      id: "production-messaging",
      twilioRelayEndpoint: setup.twilioRelayEndpoint ?? readTwilioRelayEndpoint(),
      pushServerEndpoint: setup.pushServerEndpoint ?? readPushServerEndpoint(),
      webPushPublicKey: settings.pushPublicKey ?? "",
      twilioLaunchProfile: setup.twilioLaunchProfile ?? readTwilioLaunchProfile()
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
  const shellClassName = `manager-shell${accountRole === "student" && path === "/profile" ? " manager-shell--student-reference" : ""}`;
  const fullPageShellClassName = `manager-full-page-shell${path === "/dashboard" ? " manager-full-page-shell--dashboard" : ""}`;

  if (path === "/" || path === "/profile" || path === "/manager" || path === "/live-chat") {
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

type ManagerCalendarEntrySource =
  | { type: "studio-class"; id: string }
  | { type: "scheduled-class"; id: string }
  | { type: "studio-event"; id: string };

type ManagerCalendarEntry = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "class" | "event";
  meta: string;
  path: string;
  source: ManagerCalendarEntrySource;
  titleColor?: string;
};

type ManagerCalendarEditForm = {
  title: string;
  date: string;
  time: string;
  type: string;
  recurring: boolean;
  titleColor: string;
  notes: string;
  daysOfWeek: StudioClass["daysOfWeek"];
  startTime: string;
  endTime: string;
  details: string;
  audience: StudioEvent["audience"];
};

function emptyManagerCalendarEditForm(date: string): ManagerCalendarEditForm {
  return {
    title: "",
    date,
    time: "",
    type: "class",
    recurring: false,
    titleColor: "#b8f5e2",
    notes: "",
    daysOfWeek: [],
    startTime: "17:00",
    endTime: "17:45",
    details: "",
    audience: "students"
  };
}

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
    source: { type: "scheduled-class", id: item.id },
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
  deleteScheduledClass,
  deleteStudioClass,
  deleteStudioEvent,
  focusDateKey,
  scheduledClasses,
  showToast,
  studioClasses,
  studioEvents,
  updateScheduledClass,
  updateStudioClass,
  updateStudioEvent
}: {
  addScheduledClass: (scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => ScheduledClass | undefined;
  deleteScheduledClass: (scheduledClassId: string) => ScheduledClass | undefined;
  deleteStudioClass: (classId: string) => StudioClass | undefined;
  deleteStudioEvent: (eventId: string) => StudioEvent | undefined;
  focusDateKey?: string;
  scheduledClasses: ScheduledClass[];
  showToast: (message: string) => void;
  studioClasses: StudioClass[];
  studioEvents: StudioEvent[];
  updateScheduledClass: (scheduledClassId: string, scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => ScheduledClass | undefined;
  updateStudioClass: (classId: string, studioClass: { name: string; daysOfWeek: StudioClass["daysOfWeek"]; startTime: string; endTime: string; recurring?: boolean; titleColor?: string; notes?: string }) => StudioClass | undefined;
  updateStudioEvent: (eventId: string, event: { title: string; date: string; time: string; details: string; audience: StudioEvent["audience"] }) => StudioEvent | undefined;
}) {
  const now = useLiveCalendarDate();
  const todayKey = toDateKey(now);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [calendarView, setCalendarView] = useState<ManagerCalendarView>("month");
  const [visibleMonthDate, setVisibleMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [scheduleActionsOpen, setScheduleActionsOpen] = useState(false);
  const [calendarEditTarget, setCalendarEditTarget] = useState<ManagerCalendarEntrySource | null>(null);
  const [calendarEditForm, setCalendarEditForm] = useState<ManagerCalendarEditForm>(() => emptyManagerCalendarEditForm(todayKey));
  const [calendarDeleteTarget, setCalendarDeleteTarget] = useState<ManagerCalendarEntry | null>(null);
  const [starterProgramOpen, setStarterProgramOpen] = useState(false);
  const [starterProgramForm, setStarterProgramForm] = useState({
    studentName: "",
    guardianName: "",
    notificationContact: "",
    appointmentDate: todayKey,
    appointmentTime: "4:30 PM"
  });
  const starterProgramDateInputRef = useRef<HTMLInputElement>(null);
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
                source: { type: "studio-class" as const, id: studioClass.id },
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
        path: "/events",
        source: { type: "studio-event" as const, id: event.id }
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
  const starterProgramAppointmentDateKey = isCalendarDateKey(starterProgramForm.appointmentDate) ? starterProgramForm.appointmentDate : selectedDateKey;
  const starterProgramAppointmentDate = parseCalendarDate(starterProgramAppointmentDateKey);
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
  const calendarEditScheduleTypeOptions = useMemo(() => {
    const options = new Map(defaultScheduleTypeOptions.map((option) => [option.value, option]));
    scheduledClasses.forEach((item) => {
      if (item.type.trim() && !options.has(item.type)) {
        options.set(item.type, { value: item.type, label: scheduleTypeLabel(item.type) });
      }
    });
    if (calendarEditForm.type.trim() && !options.has(calendarEditForm.type)) {
      options.set(calendarEditForm.type, { value: calendarEditForm.type, label: scheduleTypeLabel(calendarEditForm.type) });
    }
    return [...options.values()];
  }, [calendarEditForm.type, scheduledClasses]);

  const selectCalendarDate = (date: Date) => {
    setSelectedDateKey(toDateKey(date));
    setVisibleMonthDate(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const shiftVisiblePeriod = (direction: number) => {
    selectCalendarDate(shiftCalendarPeriod(selectedDate, calendarView, direction));
  };

  const openStarterProgram = () => {
    setScheduleActionsOpen(false);
    setStarterProgramForm((current) => ({ ...current, appointmentDate: selectedDateKey }));
    setStarterProgramOpen(true);
  };

  const closeStarterProgram = () => {
    setStarterProgramOpen(false);
    setStarterProgramForm({ studentName: "", guardianName: "", notificationContact: "", appointmentDate: selectedDateKey, appointmentTime: starterProgramForm.appointmentTime });
  };

  const openStarterProgramDatePicker = () => {
    const dateInput = starterProgramDateInputRef.current;
    if (!dateInput) return;
    dateInput.focus();
    try {
      dateInput.showPicker?.();
    } catch {
      // The native date input click still opens the picker when showPicker is unavailable or blocked.
    }
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
    if (!isCalendarDateKey(starterProgramForm.appointmentDate)) {
      showToast("Choose a valid Starter Program appointment date.");
      return;
    }
    const appointmentDate = parseCalendarDate(starterProgramForm.appointmentDate);
    const created = addScheduledClass({
      title: `Starter Program - ${studentName}`,
      date: starterProgramForm.appointmentDate,
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
    selectCalendarDate(appointmentDate);
    setStarterProgramForm({ studentName: "", guardianName: "", notificationContact: "", appointmentDate: starterProgramForm.appointmentDate, appointmentTime: starterProgramForm.appointmentTime });
    setStarterProgramOpen(false);
    showToast(`${created.title} booked for ${appointmentDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`);
  };

  const closeCalendarEntryEditor = () => {
    setCalendarEditTarget(null);
    setCalendarEditForm(emptyManagerCalendarEditForm(selectedDateKey));
  };

  const openCalendarEntryEditor = (entry: ManagerCalendarEntry) => {
    if (entry.source.type === "studio-class") {
      const studioClass = studioClasses.find((item) => item.id === entry.source.id);
      if (!studioClass) {
        showToast("That class is no longer available.");
        return;
      }
      setCalendarEditTarget(entry.source);
      setCalendarEditForm({
        ...emptyManagerCalendarEditForm(entry.date),
        title: studioClass.name,
        daysOfWeek: studioClass.daysOfWeek,
        startTime: studioClass.startTime,
        endTime: studioClass.endTime,
        titleColor: studioClass.titleColor ?? "#b8f5e2",
        notes: studioClass.notes ?? ""
      });
      return;
    }

    if (entry.source.type === "scheduled-class") {
      const scheduledClass = scheduledClasses.find((item) => item.id === entry.source.id);
      if (!scheduledClass) {
        showToast("That schedule item is no longer available.");
        return;
      }
      setCalendarEditTarget(entry.source);
      setCalendarEditForm({
        ...emptyManagerCalendarEditForm(scheduledClass.date),
        title: scheduledClass.title,
        date: scheduledClass.date,
        time: scheduledClass.time,
        type: scheduledClass.type,
        recurring: Boolean(scheduledClass.recurring),
        titleColor: scheduledClass.titleColor ?? "#b8f5e2",
        notes: scheduledClass.notes ?? ""
      });
      return;
    }

    const studioEvent = studioEvents.find((event) => event.id === entry.source.id);
    if (!studioEvent) {
      showToast("That event is no longer available.");
      return;
    }
    setCalendarEditTarget(entry.source);
    setCalendarEditForm({
      ...emptyManagerCalendarEditForm(studioEvent.date),
      title: studioEvent.title,
      date: studioEvent.date,
      time: studioEvent.time,
      details: studioEvent.details,
      audience: studioEvent.audience
    });
  };

  const requestCalendarEntryDelete = (entry: ManagerCalendarEntry) => {
    setCalendarDeleteTarget(entry);
  };

  const closeCalendarEntryDelete = () => {
    setCalendarDeleteTarget(null);
  };

  const removeCalendarEntry = (entry: ManagerCalendarEntry) => {
    if (entry.source.type === "studio-class") {
      const removed = deleteStudioClass(entry.source.id);
      showToast(removed ? `${removed.name} removed from classes.` : "That class is no longer available.");
      return;
    }
    if (entry.source.type === "scheduled-class") {
      const removed = deleteScheduledClass(entry.source.id);
      showToast(removed ? `${removed.title} removed from schedule.` : "That schedule item is no longer available.");
      return;
    }
    const removed = deleteStudioEvent(entry.source.id);
    showToast(removed ? `${removed.title} removed from events.` : "That event is no longer available.");
  };

  const confirmCalendarEntryDelete = () => {
    if (!calendarDeleteTarget) return;
    removeCalendarEntry(calendarDeleteTarget);
    closeCalendarEntryDelete();
  };

  const toggleCalendarEditWeekday = (weekday: ClassWeekday) => {
    setCalendarEditForm((current) => {
      const daysOfWeek = current.daysOfWeek.includes(weekday)
        ? current.daysOfWeek.filter((day) => day !== weekday)
        : [...current.daysOfWeek, weekday].sort((left, right) => left - right);
      return { ...current, daysOfWeek: daysOfWeek as StudioClass["daysOfWeek"] };
    });
  };

  const submitCalendarEntryEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!calendarEditTarget) return;

    if (calendarEditTarget.type === "studio-class") {
      const updated = updateStudioClass(calendarEditTarget.id, {
        name: calendarEditForm.title,
        daysOfWeek: calendarEditForm.daysOfWeek,
        startTime: calendarEditForm.startTime,
        endTime: calendarEditForm.endTime,
        recurring: true,
        titleColor: calendarEditForm.titleColor,
        notes: calendarEditForm.notes
      });
      if (!updated) {
        showToast("Enter a class name, day, start time, and end time.");
        return;
      }
      showToast(`${updated.name} updated.`);
      closeCalendarEntryEditor();
      return;
    }

    if (calendarEditTarget.type === "scheduled-class") {
      const existing = scheduledClasses.find((item) => item.id === calendarEditTarget.id);
      const updated = updateScheduledClass(calendarEditTarget.id, {
        title: calendarEditForm.title,
        date: calendarEditForm.date,
        time: calendarEditForm.time,
        type: calendarEditForm.type,
        recurring: calendarEditForm.recurring,
        titleColor: calendarEditForm.titleColor,
        studentId: existing?.studentId,
        notes: calendarEditForm.notes
      });
      if (!updated) {
        showToast("Enter a schedule title, date, time, and type.");
        return;
      }
      selectCalendarDate(parseCalendarDate(updated.date));
      showToast(`${updated.title} updated.`);
      closeCalendarEntryEditor();
      return;
    }

    const updated = updateStudioEvent(calendarEditTarget.id, {
      title: calendarEditForm.title,
      date: calendarEditForm.date,
      time: calendarEditForm.time,
      details: calendarEditForm.details,
      audience: calendarEditForm.audience
    });
    if (!updated) {
      showToast("Enter event title, date, and time.");
      return;
    }
    selectCalendarDate(parseCalendarDate(updated.date));
    showToast(`${updated.title} updated.`);
    closeCalendarEntryEditor();
  };

  const calendarEntryEditorTitle = calendarEditTarget?.type === "studio-event"
    ? "Edit Event"
    : calendarEditTarget?.type === "scheduled-class"
      ? "Edit Schedule Item"
      : "Edit Class";
  const calendarDeleteConfirmLabel = calendarDeleteTarget?.kind === "event" ? "Delete Event" : "Delete Class";
  const calendarDeleteDateLabel = calendarDeleteTarget
    ? parseCalendarDate(calendarDeleteTarget.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

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
        <div className="manager-calendar-header-actions">
          <button
            type="button"
            className="manager-calendar-starter-trigger"
            aria-label="Starter Program"
            onClick={openStarterProgram}
          >
            <UserPlus size={15} aria-hidden="true" />
            <span className="manager-calendar-starter-label" aria-hidden="true">
              <span>Starter</span>
              <span>Program</span>
            </span>
          </button>
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
        </div>
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
            <label className="manager-starter-program-date" onClick={openStarterProgramDatePicker}>
              <CalendarDays size={18} aria-hidden="true" />
              <span>
                <small>Appointment date</small>
                <strong>{starterProgramAppointmentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong>
              </span>
              <input
                aria-label="Appointment Date"
                className="manager-starter-program-date-input"
                ref={starterProgramDateInputRef}
                type="date"
                value={starterProgramForm.appointmentDate}
                onChange={(event) => setStarterProgramForm((current) => ({ ...current, appointmentDate: event.target.value }))}
              />
            </label>
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
      {calendarEditTarget && (
        <div className="modal-backdrop manager-calendar-action-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCalendarEntryEditor()}>
          <form
            aria-labelledby="manager-calendar-edit-title"
            aria-modal="true"
            className="modal-card modal-form manager-calendar-edit-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submitCalendarEntryEdit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="manager-calendar-edit-title">{calendarEntryEditorTitle}</h2>
                <p>Update the calendar item shown in the selected date panel.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close calendar item editor" onClick={closeCalendarEntryEditor}>
                <X size={18} />
              </button>
            </div>

            <label>
              {calendarEditTarget.type === "studio-class" ? "Class title" : calendarEditTarget.type === "studio-event" ? "Event title" : "Schedule title"}
              <input
                autoFocus
                value={calendarEditForm.title}
                onChange={(event) => setCalendarEditForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>

            {calendarEditTarget.type === "studio-class" ? (
              <>
                <fieldset className="manager-calendar-edit-weekdays">
                  <legend>Class days</legend>
                  <div>
                    {weekdayOptions.map((weekday) => (
                      <label key={weekday.value}>
                        <input
                          type="checkbox"
                          checked={calendarEditForm.daysOfWeek.includes(weekday.value)}
                          onChange={() => toggleCalendarEditWeekday(weekday.value)}
                        />
                        {weekday.short}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="manager-calendar-edit-two-up">
                  <label>
                    Start time
                    <input type="time" value={calendarEditForm.startTime} onChange={(event) => setCalendarEditForm((current) => ({ ...current, startTime: event.target.value }))} />
                  </label>
                  <label>
                    End time
                    <input type="time" value={calendarEditForm.endTime} onChange={(event) => setCalendarEditForm((current) => ({ ...current, endTime: event.target.value }))} />
                  </label>
                </div>
                <label>
                  Title color
                  <input type="color" value={calendarEditForm.titleColor} onChange={(event) => setCalendarEditForm((current) => ({ ...current, titleColor: event.target.value }))} />
                </label>
                <label>
                  Notes
                  <textarea rows={3} value={calendarEditForm.notes} onChange={(event) => setCalendarEditForm((current) => ({ ...current, notes: event.target.value }))} />
                </label>
              </>
            ) : calendarEditTarget.type === "scheduled-class" ? (
              <>
                <label>
                  Schedule date
                  <input type="date" value={calendarEditForm.date} onChange={(event) => setCalendarEditForm((current) => ({ ...current, date: event.target.value }))} />
                </label>
                <label>
                  Schedule time
                  <input value={calendarEditForm.time} onChange={(event) => setCalendarEditForm((current) => ({ ...current, time: event.target.value }))} />
                </label>
                <label>
                  Schedule type
                  <select value={calendarEditForm.type} onChange={(event) => setCalendarEditForm((current) => ({ ...current, type: event.target.value }))}>
                    {calendarEditScheduleTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Title color
                  <input type="color" value={calendarEditForm.titleColor} onChange={(event) => setCalendarEditForm((current) => ({ ...current, titleColor: event.target.value }))} />
                </label>
                <label className="checkbox-row operations-checkbox-row">
                  <input
                    type="checkbox"
                    checked={calendarEditForm.recurring}
                    onChange={(event) => setCalendarEditForm((current) => ({ ...current, recurring: event.target.checked }))}
                  />
                  Recurring
                </label>
                <label>
                  Notes
                  <textarea rows={3} value={calendarEditForm.notes} onChange={(event) => setCalendarEditForm((current) => ({ ...current, notes: event.target.value }))} />
                </label>
              </>
            ) : (
              <>
                <label>
                  Event date
                  <input type="date" value={calendarEditForm.date} onChange={(event) => setCalendarEditForm((current) => ({ ...current, date: event.target.value }))} />
                </label>
                <label>
                  Event time
                  <input value={calendarEditForm.time} onChange={(event) => setCalendarEditForm((current) => ({ ...current, time: event.target.value }))} />
                </label>
                <label>
                  Event details
                  <textarea rows={4} value={calendarEditForm.details} onChange={(event) => setCalendarEditForm((current) => ({ ...current, details: event.target.value }))} />
                </label>
                <label>
                  Audience
                  <select value={calendarEditForm.audience} onChange={(event) => setCalendarEditForm((current) => ({ ...current, audience: event.target.value as StudioEvent["audience"] }))}>
                    <option value="students">Students</option>
                    <option value="families">Families</option>
                    <option value="public">Public</option>
                  </select>
                </label>
              </>
            )}

            <div className="manager-starter-program-actions">
              <button type="button" onClick={closeCalendarEntryEditor}>Cancel</button>
              <button type="submit">
                <CheckCircle2 size={18} aria-hidden="true" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
      {calendarDeleteTarget && (
        <div className="modal-backdrop manager-calendar-action-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCalendarEntryDelete()}>
          <div
            aria-labelledby="manager-calendar-delete-title"
            aria-modal="true"
            className="modal-card modal-form manager-calendar-delete-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="manager-calendar-delete-title">Delete calendar item?</h2>
                <p>Are you sure you want to delete {calendarDeleteTarget.title} from {calendarDeleteDateLabel}?</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close delete confirmation" onClick={closeCalendarEntryDelete}>
                <X size={18} />
              </button>
            </div>
            <div className="manager-starter-program-actions manager-calendar-delete-actions">
              <button type="button" onClick={closeCalendarEntryDelete}>Cancel</button>
              <button type="button" className="manager-calendar-delete-confirm" onClick={confirmCalendarEntryDelete}>
                <Trash2 size={18} aria-hidden="true" />
                {calendarDeleteConfirmLabel}
              </button>
            </div>
          </div>
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
                  <article className="manager-calendar-selected-item" key={entry.id}>
                    <Link className="manager-calendar-selected-main" to={entry.path} aria-label={`${entry.time}, ${entry.title}, ${entry.meta}`}>
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
                    <div className="manager-calendar-selected-actions" aria-label={`${entry.title} actions`}>
                      <button type="button" aria-label={`Edit ${entry.title}`} onClick={() => openCalendarEntryEditor(entry)}>
                        <Pencil size={13} aria-hidden="true" />
                      </button>
                      <button type="button" aria-label={`Delete ${entry.title}`} onClick={() => requestCalendarEntryDelete(entry)}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
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
    const LauncherSymbol = icon === "create" ? UserPlus : icon === "studyGuide" ? BookOpen : icon === "developer" ? Server : Video;

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

function DeveloperMetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="operation-stat-card reports-metric-card">
      <span><FileText size={20} /></span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function DeveloperToolsPage() {
  const location = useLocation();
  const {
    accountRole,
    accountRoles,
    accounts,
    childAccounts,
    checkIns,
    directMessages,
    managedAccounts,
    managerAccountAccess,
    merchandiseItems,
    messageCampaigns,
    messageLogs,
    scheduledClasses,
    scheduledTextCampaigns,
    session,
    showToast,
    students,
    studioClasses,
    studioEvents,
    studyGuideFolders,
    studyGuideMaterials,
    textAutomationRuns,
    trainingVideoFolders,
    trainingVideos
  } = useAppState();
  const route = `${location.pathname}${location.search}`;
  const developerFlagLabel = `VITE_ENABLE_DEVELOPER_ACCOUNT=${isDeveloperAccountEnabled() ? "true" : "false"}`;
  const diagnostics = useMemo(() => ({
    generatedAt: new Date().toISOString(),
    session: {
      email: session?.email ?? null,
      accountRole: accountRole ?? null,
      isDeveloper: managerAccountAccess.isDeveloper,
      isManagerOwner: managerAccountAccess.isManagerOwner,
      canCreateAccounts: managerAccountAccess.canCreateAccounts,
      canGrantCreateAccess: managerAccountAccess.canGrantCreateAccess,
      allowedTools: managerAccountAccess.allowedTools,
      route
    },
    environment: {
      mode: import.meta.env.MODE,
      baseUrl: import.meta.env.BASE_URL,
      developerAccountEnabled: isDeveloperAccountEnabled(),
      supabaseAuthConfigured: isSupabaseAuthConfigured()
    },
    counts: {
      accounts: accounts.length,
      accountRoles: accountRoles.length,
      students: students.length,
      managedAccounts: managedAccounts.length,
      childAccounts: childAccounts.length,
      messageLogs: messageLogs.length,
      directMessages: directMessages.length,
      messageCampaigns: messageCampaigns.length,
      scheduledTextCampaigns: scheduledTextCampaigns.length,
      studioEvents: studioEvents.length,
      studioClasses: studioClasses.length,
      scheduledClasses: scheduledClasses.length,
      merchandiseItems: merchandiseItems.length,
      checkIns: checkIns.length,
      trainingVideoFolders: trainingVideoFolders.length,
      trainingVideos: trainingVideos.length,
      studyGuideFolders: studyGuideFolders.length,
      studyGuideMaterials: studyGuideMaterials.length,
      textAutomationRuns: textAutomationRuns.length
    }
  }), [
    accountRole,
    accountRoles.length,
    accounts.length,
    childAccounts.length,
    checkIns.length,
    directMessages.length,
    managedAccounts.length,
    managerAccountAccess.allowedTools,
    managerAccountAccess.canCreateAccounts,
    managerAccountAccess.canGrantCreateAccess,
    managerAccountAccess.isDeveloper,
    managerAccountAccess.isManagerOwner,
    merchandiseItems.length,
    messageCampaigns.length,
    messageLogs.length,
    route,
    scheduledClasses.length,
    scheduledTextCampaigns.length,
    session?.email,
    students.length,
    studioClasses.length,
    studioEvents.length,
    studyGuideFolders.length,
    studyGuideMaterials.length,
    textAutomationRuns.length,
    trainingVideoFolders.length,
    trainingVideos.length
  ]);
  const diagnosticJson = useMemo(() => JSON.stringify(diagnostics, null, 2), [diagnostics]);
  const dataCountCards = [
    { label: "Students", value: students.length },
    { label: "Managed accounts", value: managedAccounts.length },
    { label: "Child accounts", value: childAccounts.length },
    { label: "Messages", value: messageLogs.length },
    { label: "Direct messages", value: directMessages.length },
    { label: "Events", value: studioEvents.length },
    { label: "Classes", value: studioClasses.length },
    { label: "Scheduled classes", value: scheduledClasses.length },
    { label: "Merchandise", value: merchandiseItems.length },
    { label: "Reports inputs", value: students.length + messageLogs.length + managedAccounts.length + checkIns.length }
  ];
  const routeLinks = [
    { label: "Profile", path: "/profile" },
    { label: "Live Chat", path: "/live-chat" },
    { label: "Create Accounts", path: "/manager?tool=create" },
    { label: "Messages", path: "/messages" },
    { label: "Reports", path: "/reports" },
    { label: "Dashboard", path: "/dashboard" }
  ];

  const copyDiagnostics = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(diagnosticJson);
      showToast("Developer diagnostics copied.");
    } catch {
      downloadTextFile(`chos-developer-diagnostics-${new Date().toISOString().slice(0, 10)}.json`, diagnosticJson, "application/json");
      showToast("Developer diagnostics exported.");
    }
  };

  const exportDiagnostics = () => {
    downloadTextFile(`chos-developer-diagnostics-${new Date().toISOString().slice(0, 10)}.json`, diagnosticJson, "application/json");
    showToast("Developer diagnostics exported.");
  };

  return (
    <OperationsPage className="operations-page--workflow developer-tools-page" title="Developer Tools" text="Read-only diagnostics for developer testing and app verification.">
      <section className="operations-panel workflow-directory-panel" aria-label="Developer session diagnostics">
        <div className="student-roster-head">
          <div>
            <h2>Session</h2>
            <p>Current developer identity and authorization state.</p>
          </div>
        </div>
        <div className="operations-stats reports-stats">
          <DeveloperMetricCard label="Session email" value={session?.email ?? "No session"} />
          <DeveloperMetricCard label="Account role" value={accountRole ?? "Unknown"} />
          <DeveloperMetricCard label="Developer identity" value={managerAccountAccess.isDeveloper ? "Developer account" : "Standard account"} />
          <DeveloperMetricCard label="Authorization" value={managerAccountAccess.isManagerOwner ? "Owner access" : "Limited access"} />
          <DeveloperMetricCard label="Current route" value={route} />
        </div>
      </section>

      <section className="operations-panel workflow-directory-panel" aria-label="Developer environment diagnostics">
        <div className="student-roster-head">
          <div>
            <h2>Environment</h2>
            <p>Browser-safe build diagnostics without secrets.</p>
          </div>
        </div>
        <div className="operations-stats reports-stats">
          <DeveloperMetricCard label="Vite mode" value={import.meta.env.MODE} />
          <DeveloperMetricCard label="Base URL" value={import.meta.env.BASE_URL} />
          <DeveloperMetricCard label="Developer flag" value={developerFlagLabel} />
          <DeveloperMetricCard label="Supabase" value={`Supabase auth: ${isSupabaseAuthConfigured() ? "configured" : "not configured"}`} />
        </div>
      </section>

      <section className="operations-panel workflow-directory-panel" aria-label="Developer local data counts">
        <div className="student-roster-head">
          <div>
            <h2>Local Data Counts</h2>
            <p>Quick counts for local prototype records used by app screens and reports.</p>
          </div>
        </div>
        <div className="operations-stats reports-stats">
          {dataCountCards.map((item) => <DeveloperMetricCard key={item.label} label={item.label} value={item.value} />)}
        </div>
      </section>

      <section className="operations-panel workflow-directory-panel" aria-label="Developer route quick links">
        <div className="student-roster-head">
          <div>
            <h2>Route Quick Links</h2>
            <p>Jump to the core pages used during manual verification.</p>
          </div>
        </div>
        <div className="student-quick-actions">
          {routeLinks.map((item) => (
            <Link key={item.path} className="operations-action secondary" to={item.path}>
              <ChevronRight size={18} /> {item.label}
            </Link>
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="operations-action" onClick={copyDiagnostics}>
            <FileText size={18} /> Copy Diagnostics JSON
          </button>
          <button type="button" className="operations-action secondary" onClick={exportDiagnostics}>
            <FileText size={18} /> Export Diagnostics JSON
          </button>
        </div>
      </section>
    </OperationsPage>
  );
}

function uniqueLandingPageOptions(options: LandingPageOption[]) {
  const seen = new Set<LandingPagePreference>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function staffLandingPageOptions(allowedTools: readonly ManagerAccessKey[], panelLabel: string) {
  return uniqueLandingPageOptions([
    ...staffLandingPageBaseOptions.map((option) => option.value === "manager-panel" ? { ...option, label: panelLabel } : option),
    ...allowedTools.flatMap((tool) => managerAccessLandingPageOptions[tool] ? [managerAccessLandingPageOptions[tool]] : [])
  ]);
}

function landingPageValueOrDefault(value: LandingPagePreference, options: readonly LandingPageOption[], fallback: LandingPagePreference) {
  return options.some((option) => option.value === value) ? value : fallback;
}

function FirstPagePreferenceField({
  value,
  options,
  onChange
}: {
  value: LandingPagePreference;
  options: LandingPageOption[];
  onChange: (value: LandingPagePreference) => void;
}) {
  const selectedValue = landingPageValueOrDefault(value, options, options[0]?.value ?? "profile");
  return (
    <label className="field-label">
      First page after login
      <select className="input" value={selectedValue} onChange={(event) => onChange(event.target.value as LandingPagePreference)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function staffLandingPath(preference: LandingPagePreference) {
  switch (preference) {
    case "profile":
      return "/profile";
    case "manager-panel":
      return "/manager";
    case "dashboard":
      return "/dashboard";
    case "messages":
      return "/messages";
    case "students":
      return "/students";
    case "classes":
      return "/classes";
    case "schedule":
      return "/schedule";
    case "check-ins":
      return "/check-ins";
    case "events":
      return "/events";
    case "merchandise":
      return "/merchandise";
    case "reports":
      return "/reports";
    case "videos":
      return "/videos";
    case "study-guide":
      return "/study-guide";
    case "live-chat":
    default:
      return "/live-chat";
  }
}

function studentLandingPath(preference: LandingPagePreference) {
  switch (preference) {
    case "student-panel":
      return "/manager";
    case "check-ins":
      return "/check-ins";
    case "profile":
    default:
      return "/profile";
  }
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
            <Link to="/profile">
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
    case "developer":
      return <DeveloperToolsPage />;
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
            <Link to="/profile">
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

function parentTabFromLandingPage(preference: LandingPagePreference): ParentProfileTab {
  switch (preference) {
    case "parent-classes":
      return "classes";
    case "parent-study":
      return "study";
    case "parent-test":
      return "test";
    case "parent-messages":
      return "messages";
    case "parent-notifications":
      return "notifications";
    case "parent-dashboard":
    default:
      return "dashboard";
  }
}

function parentLandingPath(preference: LandingPagePreference) {
  if (preference === "profile") return "/profile";
  return `/profile?tab=${parentTabFromLandingPage(preference)}`;
}

function parentTabFromSearch(search: string): ParentProfileTab {
  const requestedTab = new URLSearchParams(search).get("tab");
  return parentProfileTabs.some((tab) => tab.id === requestedTab) ? requestedTab as ParentProfileTab : "dashboard";
}

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

type LiveChatRosterMember = {
  id: string;
  name: string;
  detail: string;
  avatarSrc: string;
};

type LiveChatRoom = {
  id: string;
  name: string;
  color: string;
  invitedMemberIds: string[];
  isDefault?: boolean;
};

const liveChatDefaultRoomId = "chos-room";
const liveChatMentionsRoomId = "mentions";

const liveChatRoomColorOptions = [
  { name: "Violet", value: "#8a63f2" },
  { name: "Ruby", value: "#e4567d" },
  { name: "Teal", value: "#20bfa9" },
  { name: "Gold", value: "#e5ad45" },
  { name: "Blue", value: "#4d8cff" },
  { name: "Green", value: "#38b66d" }
];

const liveChatDefaultRooms: LiveChatRoom[] = [
  {
    id: liveChatDefaultRoomId,
    name: "Cho's Room",
    color: liveChatRoomColorOptions[0].value,
    invitedMemberIds: [],
    isDefault: true
  }
];

const liveChatPreviewMessages: LiveChatMessage[] = [
  {
    id: "preview-manager-intro",
    roomKey: liveChatRoomKey,
    senderUserId: null,
    senderName: "Cho's App",
    senderRole: "system",
    senderAvatarPath: null,
    messageKind: "notice",
    body: "Welcome, Manager. Live chat is clean, connected, and ready for testing.",
    createdAt: "2026-06-17T01:10:24.823Z"
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

function managerProfileNameFallback(isDeveloper: boolean, isManagerOwner: boolean) {
  return isDeveloper ? "Developer" : isManagerOwner ? "Cho's Manager" : "Cho's Staff";
}

function buildLiveChatRoster(students: StudentRecord[], managerProfile: ManagerProfileSettings, isManagerOwner: boolean, isDeveloper: boolean, staffAvatarPath: string): LiveChatRosterMember[] {
  const activeStudents = students
    .filter(isCurrentOperationsStudent)
    .slice(0, 17)
    .map((student) => ({
      id: student.id,
      name: fullName(student),
      detail: `${student.beltRank} belt`,
      avatarSrc: student.profileImagePath ? publicAsset(student.profileImagePath) : publicAsset("assets/CheetahProfilePic/Cheetah.png")
    }));

  return [
    {
      id: "current-staff",
      name: managerProfile.name.trim() || (isDeveloper ? "Developer" : isManagerOwner ? "Cho's Manager" : "Cho's Staff"),
      detail: isDeveloper ? "Developer" : isManagerOwner ? "Manager" : "Staff",
      avatarSrc: managerProfile.photoDataUrl ?? publicAsset(staffAvatarPath)
    },
    ...activeStudents
  ];
}

function makeLiveChatRoomId(name: string, rooms: LiveChatRoom[]) {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "room";
  let candidateId = `room-${baseId}`;
  let suffix = 2;

  while (rooms.some((room) => room.id === candidateId)) {
    candidateId = `room-${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidateId;
}

function getLiveChatRoomInviteNames(room: LiveChatRoom | undefined, rosterMembers: LiveChatRosterMember[]) {
  if (!room || room.isDefault) return [];
  return room.invitedMemberIds
    .map((memberId) => rosterMembers.find((member) => member.id === memberId)?.name)
    .filter((name): name is string => Boolean(name));
}

function liveChatMessageMentionsManager(message: LiveChatMessage, managerProfile: ManagerProfileSettings) {
  const profileName = managerProfile.name.trim().toLowerCase();
  const body = message.body.toLowerCase();
  return body.includes("@cho") || (profileName ? body.includes(`@${profileName}`) : false);
}

function formatLiveChatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatLiveChatComposerTimestamp(date: Date) {
  const datePart = date.toLocaleDateString("en-CA").replace(/-/g, "/");
  const timePart = date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

function formatLiveChatHeaderStatus(message: string) {
  const statusMessage = message.replace(/^Preview\s+/i, "");
  return statusMessage ? `${statusMessage[0].toUpperCase()}${statusMessage.slice(1)}` : statusMessage;
}

function appendUniqueLiveChatMessage(messages: LiveChatMessage[], message: LiveChatMessage) {
  if (messages.some((currentMessage) => currentMessage.id === message.id)) return messages;
  return [...messages, message].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

const liveChatFeedBottomThresholdPx = 36;

function getLiveChatFeedBottomScrollTop(feed: HTMLElement) {
  return Math.max(feed.scrollHeight - feed.clientHeight, 0);
}

function isLiveChatFeedNearBottom(feed: HTMLElement) {
  return getLiveChatFeedBottomScrollTop(feed) - feed.scrollTop <= liveChatFeedBottomThresholdPx;
}

function scrollLiveChatFeedToBottom(feed: HTMLElement) {
  feed.scrollTop = getLiveChatFeedBottomScrollTop(feed);
}

function LiveChatMessageLine({ message }: { message: LiveChatMessage }) {
  const label = message.messageKind === "notice" ? "[Notice]" : message.messageKind === "system" ? "[System]" : `[${message.senderName}]`;
  return (
    <li className={`live-chat-message live-chat-message--${message.messageKind}`}>
      <span className="live-chat-message-meta">
        <span className="live-chat-message-sender">{label}</span>
        <time className="live-chat-message-time" dateTime={message.createdAt}>{formatLiveChatTimestamp(message.createdAt)}</time>
      </span>
      <span className="live-chat-message-body">{message.body}</span>
    </li>
  );
}

function LiveChatPage() {
  const { logout, managerAccountAccess, messageNotificationSettings, session, students, updateMessageNotificationSettings } = useAppState();
  const isManagerOwner = managerAccountAccess.isManagerOwner;
  const isDeveloper = managerAccountAccess.isDeveloper;
  const profileAvatarPath = profileAvatarPathForSession(session?.email);
  const staffSenderName = managerProfileNameFallback(isDeveloper, isManagerOwner);
  const readChatProfile = isManagerOwner ? readManagerProfile : readStaffProfile;
  const [managerProfile, setManagerProfile] = useState(() => readChatProfile(session?.email));
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatRooms, setChatRooms] = useState<LiveChatRoom[]>(() => liveChatDefaultRooms);
  const [activeRoomId, setActiveRoomId] = useState(liveChatDefaultRoomId);
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLiveReady, setIsLiveReady] = useState(() => getLiveChatAvailability().available);
  const [liveStatusMessage, setLiveStatusMessage] = useState(() => getLiveChatAvailability().message);
  const [liveChatNotificationPermission, setLiveChatNotificationPermission] = useState(() => getBrowserNotificationPermission());
  const [sendError, setSendError] = useState("");
  const [isRosterCollapsed, setIsRosterCollapsed] = useState(false);
  const [localPreviewMessages, setLocalPreviewMessages] = useState<LiveChatMessage[]>([]);
  const [customRoomMessages, setCustomRoomMessages] = useState<Record<string, LiveChatMessage[]>>({});
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomColor, setNewRoomColor] = useState(liveChatRoomColorOptions[0].value);
  const [newRoomInviteIds, setNewRoomInviteIds] = useState<Set<string>>(() => new Set());
  const [areNewRoomInvitesConfirmed, setAreNewRoomInvitesConfirmed] = useState(false);
  const [timestampDate] = useState(() => new Date());
  const messageFeedRef = useRef<HTMLOListElement | null>(null);
  const roomTabsScrollRef = useRef<HTMLDivElement | null>(null);
  const isMessageFeedPinnedToBottomRef = useRef(true);
  const liveChatNotificationSettingsRef = useRef(messageNotificationSettings);
  const liveChatNotificationPermissionRef = useRef(liveChatNotificationPermission);
  const liveChatProfileNameRef = useRef(managerProfile.name);
  const rosterMembers = useMemo(() => buildLiveChatRoster(students, managerProfile, isManagerOwner, isDeveloper, profileAvatarPath), [isDeveloper, isManagerOwner, managerProfile, profileAvatarPath, students]);
  const profileActionPhoto = managerProfile.photoDataUrl ?? publicAsset(profileAvatarPath);
  const sessionPreviewMessages = useMemo(() => {
    if (!isDeveloper) return liveChatPreviewMessages;
    return liveChatPreviewMessages.map((message) => ({
      ...message,
      senderName: message.senderName === "Cho's Manager" ? "Developer" : message.senderName,
      senderAvatarPath: message.senderName === "Cho's Manager" ? profileAvatarPath : message.senderAvatarPath,
      body: message.body.replace(/@Cho's Manager/g, "@Developer")
    }));
  }, [isDeveloper, profileAvatarPath]);
  const previewMessages = isLiveReady ? sessionPreviewMessages : [...sessionPreviewMessages, ...localPreviewMessages];
  const defaultRoomMessages = chatMessages.length ? chatMessages : previewMessages;
  const mentionMessages = defaultRoomMessages.filter((message) => liveChatMessageMentionsManager(message, managerProfile));
  const isMentionsView = activeRoomId === liveChatMentionsRoomId;
  const activeRoom = chatRooms.find((room) => room.id === activeRoomId) ?? chatRooms[0];
  const activeRoomMessages = activeRoom?.isDefault ? defaultRoomMessages : customRoomMessages[activeRoom?.id ?? ""] ?? [];
  const filteredMessages = isMentionsView ? mentionMessages : activeRoomMessages;
  const activeRoomInviteNames = getLiveChatRoomInviteNames(activeRoom, rosterMembers);
  const activeRoomInviteSummary = activeRoomInviteNames.length ? activeRoomInviteNames.join(", ") : "No invited members yet.";
  const activeRoomEmptyMessage = isMentionsView
    ? "No manager mentions yet."
    : activeRoom?.isDefault
      ? "No live messages yet."
      : `${activeRoom.name} is ready for ${activeRoom.invitedMemberIds.length} invited member${activeRoom.invitedMemberIds.length === 1 ? "" : "s"}.`;
  const onlineCount = Math.max(rosterMembers.length, 1);
  const newRoomInviteCount = newRoomInviteIds.size;
  const newRoomInviteNoun = newRoomInviteCount === 1 ? "Invite" : "Invites";
  const confirmInvitesButtonLabel = areNewRoomInvitesConfirmed
    ? "Invites Confirmed"
    : newRoomInviteCount
      ? `Confirm ${newRoomInviteCount} ${newRoomInviteNoun}`
      : "Confirm Invites";
  const newRoomInviteStatus = areNewRoomInvitesConfirmed
    ? `${newRoomInviteCount} invite${newRoomInviteCount === 1 ? "" : "s"} confirmed`
    : newRoomInviteCount
      ? `${newRoomInviteCount} invite${newRoomInviteCount === 1 ? "" : "s"} selected`
      : "Select users, then confirm invites.";
  const canCreateLiveChatRoom = Boolean(newRoomName.trim()) && (!newRoomInviteCount || areNewRoomInvitesConfirmed);

  useEffect(() => {
    setManagerProfile(readChatProfile(session?.email));
  }, [readChatProfile, session?.email]);

  useEffect(() => {
    liveChatNotificationSettingsRef.current = messageNotificationSettings;
  }, [messageNotificationSettings]);

  useEffect(() => {
    liveChatNotificationPermissionRef.current = liveChatNotificationPermission;
  }, [liveChatNotificationPermission]);

  useEffect(() => {
    liveChatProfileNameRef.current = managerProfile.name;
  }, [managerProfile.name]);

  useNotificationDevicePermissionSync({
    settings: messageNotificationSettings,
    setPermission: setLiveChatNotificationPermission,
    updateSettings: updateMessageNotificationSettings
  });

  const notifyIncomingLiveChatMessage = useCallback((message: LiveChatMessage) => {
    const plan = buildLiveChatNotificationPlan({
      message,
      settings: liveChatNotificationSettingsRef.current,
      browserPermission: liveChatNotificationPermissionRef.current,
      currentUserId: readSupabaseAuthSession()?.userId,
      profileName: liveChatProfileNameRef.current,
      notificationUrl: liveChatNotificationUrl()
    });
    if (!plan) return;

    liveChatNotificationSettingsRef.current = {
      ...liveChatNotificationSettingsRef.current,
      ...plan.settingsPatch
    };
    updateMessageNotificationSettings(plan.settingsPatch);
    void showDirectMessageBrowserNotification(plan.title, {
      ...plan.options,
      icon: publicAsset("682e95109aa21_chos-logo.png"),
      badge: publicAsset("682e95109aa21_chos-logo.png")
    }).catch(() => undefined);
  }, [updateMessageNotificationSettings]);

  useEffect(() => {
    const availability = getLiveChatAvailability();
    setIsLiveReady(availability.available);
    setLiveStatusMessage(availability.message);

    if (!availability.available) {
      setChatMessages([]);
      return;
    }

    let isMounted = true;
    const loadTimer = window.setTimeout(() => {
      if (!isMounted) return;
      setIsLoading(true);
      void fetchLiveChatMessages().then((result) => {
        if (!isMounted) return;
        if (result.status === "ok") {
          setChatMessages(result.data);
          return;
        }
        setLiveStatusMessage(result.message);
        if (result.status === "unavailable") setIsLiveReady(false);
      }).finally(() => {
        if (isMounted) setIsLoading(false);
      });
    }, 0);

    const subscription = subscribeToLiveChatInserts({
      onMessage: (message) => {
        setChatMessages((currentMessages) => appendUniqueLiveChatMessage(currentMessages, message));
        notifyIncomingLiveChatMessage(message);
      },
      onStatus: (status, message) => {
        if (status === "SUBSCRIBED") {
          setIsLiveReady(true);
          setLiveStatusMessage("Live Supabase room connected.");
          return;
        }
        if (message) setLiveStatusMessage(message);
      }
    });

    return () => {
      isMounted = false;
      window.clearTimeout(loadTimer);
      subscription.cleanup();
    };
  }, [notifyIncomingLiveChatMessage]);

  useLayoutEffect(() => {
    const feed = messageFeedRef.current;
    if (!feed) return;
    if (!isMessageFeedPinnedToBottomRef.current) return;

    scrollLiveChatFeedToBottom(feed);
    isMessageFeedPinnedToBottomRef.current = true;
  }, [activeRoomId, filteredMessages.length]);

  useLayoutEffect(() => {
    const roomTabsScroll = roomTabsScrollRef.current;
    if (!roomTabsScroll) return;
    const activeRoomTab = Array.from(roomTabsScroll.querySelectorAll<HTMLButtonElement>("[data-live-chat-room-tab]"))
      .find((tabButton) => tabButton.dataset.roomId === activeRoomId);
    if (activeRoomTab && typeof activeRoomTab.scrollIntoView === "function") {
      activeRoomTab.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [activeRoomId, chatRooms.length]);

  const handleMessageFeedScroll = () => {
    const feed = messageFeedRef.current;
    if (!feed) return;
    isMessageFeedPinnedToBottomRef.current = isLiveChatFeedNearBottom(feed);
  };

  const openCreateRoomDialog = () => {
    setNewRoomName("");
    setNewRoomColor(liveChatRoomColorOptions[0].value);
    setNewRoomInviteIds(new Set());
    setAreNewRoomInvitesConfirmed(false);
    setIsCreateRoomOpen(true);
  };

  const toggleNewRoomInvite = (memberId: string) => {
    setAreNewRoomInvitesConfirmed(false);
    setNewRoomInviteIds((currentInviteIds) => {
      const nextInviteIds = new Set(currentInviteIds);
      if (nextInviteIds.has(memberId)) {
        nextInviteIds.delete(memberId);
      } else {
        nextInviteIds.add(memberId);
      }
      return nextInviteIds;
    });
  };

  const createLiveChatRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedRoomName = newRoomName.trim();
    if (!trimmedRoomName) return;
    if (newRoomInviteIds.size && !areNewRoomInvitesConfirmed) return;

    const newRoom: LiveChatRoom = {
      id: makeLiveChatRoomId(trimmedRoomName, chatRooms),
      name: trimmedRoomName,
      color: newRoomColor,
      invitedMemberIds: Array.from(newRoomInviteIds)
    };

    setChatRooms((currentRooms) => [...currentRooms, newRoom]);
    setCustomRoomMessages((currentMessages) => ({ ...currentMessages, [newRoom.id]: currentMessages[newRoom.id] ?? [] }));
    setActiveRoomId(newRoom.id);
    setIsCreateRoomOpen(false);
    setLiveStatusMessage(`${newRoom.name} created with ${newRoom.invitedMemberIds.length} invited member${newRoom.invitedMemberIds.length === 1 ? "" : "s"}.`);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendError("");

    const validation = validateLiveChatBody(messageText);
    if (!validation.ok) {
      setSendError(validation.message);
      return;
    }

    const targetRoom = isMentionsView ? chatRooms[0] : activeRoom;

    if (targetRoom && !targetRoom.isDefault) {
      const createdAt = new Date().toISOString();
      const senderName = managerProfile.name.trim() || staffSenderName;
      const roomMessage: LiveChatMessage = {
        id: `custom-room-${targetRoom.id}-${createdAt}-${Math.random().toString(36).slice(2)}`,
        roomKey: targetRoom.id,
        senderUserId: null,
        senderName,
        senderRole: "staff",
        senderAvatarPath: managerProfile.photoDataUrl ? null : profileAvatarPath,
        messageKind: "user",
        body: validation.body,
        createdAt
      };

      setCustomRoomMessages((currentMessages) => ({
        ...currentMessages,
        [targetRoom.id]: appendUniqueLiveChatMessage(currentMessages[targetRoom.id] ?? [], roomMessage)
      }));
      setLiveStatusMessage(`${targetRoom.name} message added locally.`);
      setMessageText("");
      return;
    }

    if (!isLiveReady) {
      const createdAt = new Date().toISOString();
      const senderName = managerProfile.name.trim() || staffSenderName;
      const previewMessage: LiveChatMessage = {
        id: `preview-local-${createdAt}-${Math.random().toString(36).slice(2)}`,
        roomKey: liveChatRoomKey,
        senderUserId: null,
        senderName,
        senderRole: "staff",
        senderAvatarPath: managerProfile.photoDataUrl ? null : profileAvatarPath,
        messageKind: "user",
        body: validation.body,
        createdAt
      };

      setLocalPreviewMessages((currentMessages) => appendUniqueLiveChatMessage(currentMessages, previewMessage));
      setLiveStatusMessage("Test message added locally. Supabase sign-in required for live delivery.");
      setMessageText("");
      return;
    }

    setIsSending(true);
    const result = await sendLiveChatMessage({
      body: validation.body,
      senderAvatarPath: managerProfile.photoDataUrl ? undefined : profileAvatarPath
    });
    setIsSending(false);

    if (result.status !== "ok") {
      setSendError(result.message);
      if (result.status === "unavailable") setIsLiveReady(false);
      return;
    }

    setChatMessages((currentMessages) => appendUniqueLiveChatMessage(currentMessages, result.data));
    setMessageText("");
  };

  return (
    <section className="manager-launcher-page live-chat-page" aria-label="Live chat room page">
      <main className="manager-launcher-main live-chat-main">
        <header className="manager-launcher-topbar manager-page-title-bar" aria-label="Live chat page header">
          <ManagerPageTitleFrame title="Live Chats" className="manager-page-title-frame--manager-panel" />
          <nav className="manager-home-top-actions" aria-label="Live chat quick actions">
            <Link className="manager-home-top-action manager-launcher-profile-link" to="/profile" aria-label="Profile">
              <img className="manager-home-profile-action-photo" src={profileActionPhoto} alt="" draggable="false" />
              <span className="manager-home-top-action-label">Profile</span>
            </Link>
            <button className="manager-home-top-action manager-home-logout-button" type="button" aria-label="Log Out" onClick={logout}>
              <img className="manager-home-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
              <span className="manager-home-top-action-label">Log Out</span>
            </button>
          </nav>
        </header>

        <div className={`manager-launcher-body live-chat-shell${isRosterCollapsed ? " is-sidebar-collapsed" : ""}`} role="group" aria-label="Live chat room frame">
          <aside
            className="manager-launcher-grid manager-launcher-sidebar live-chat-roster"
            id="live-chat-roster-members"
            aria-label="Live chat members"
            data-orientation="vertical"
            hidden={isRosterCollapsed}
          >
            {rosterMembers.map((member) => (
              <article className="manager-launcher-item live-chat-roster-member" key={member.id} aria-label={`${member.name}, ${member.detail}`}>
                <span className="manager-launcher-graphic live-chat-roster-avatar">
                  <img className="manager-launcher-image live-chat-roster-image" src={member.avatarSrc} alt="" draggable="false" />
                </span>
                <span className="manager-launcher-label live-chat-roster-label">{member.name}</span>
              </article>
            ))}
          </aside>
        <button
          aria-controls="live-chat-roster-members"
          aria-expanded={!isRosterCollapsed}
          aria-label={isRosterCollapsed ? "Expand live chat member list" : "Collapse live chat member list"}
          className="manager-launcher-rail-toggle live-chat-roster-toggle"
          onClick={() => setIsRosterCollapsed((current) => !current)}
          type="button"
        >
          <span className="manager-launcher-rail-toggle-bar" aria-hidden="true" />
        </button>

        <section className="manager-launcher-workspace live-chat-room-panel" aria-label="Live chat room">
          <div className="live-chat-room-head" aria-label="Live chat room header">
            <div className="live-chat-heading-block">
              <div className="live-chat-heading-row">
                <h2>Live Chat Rooms</h2>
                <div className={`live-chat-online-count${isLiveReady ? " is-live" : ""}`} aria-label="Live chat online count">
                  <span aria-hidden="true" />
                  <strong>{onlineCount.toLocaleString()} Online</strong>
                </div>
              </div>
              <p className="live-chat-status-copy" aria-live="polite">{isLoading ? "Loading live messages..." : formatLiveChatHeaderStatus(liveStatusMessage)}</p>
            </div>
            <div className="live-chat-controls">
              <div className="live-chat-tabs live-chat-room-tabs" role="tablist" aria-label="Live chat rooms">
                <div className="live-chat-room-tab-scroll" ref={roomTabsScrollRef}>
                  {chatRooms.map((room) => (
                    <button
                      className="live-chat-room-tab"
                      key={room.id}
                      data-live-chat-room-tab
                      data-room-id={room.id}
                      role="tab"
                      type="button"
                      aria-selected={activeRoomId === room.id}
                      style={{ "--live-chat-room-tab-color": room.color } as CSSProperties}
                      onClick={() => setActiveRoomId(room.id)}
                    >
                      {room.name}
                    </button>
                  ))}
                  <button className="live-chat-create-room-button" type="button" onClick={openCreateRoomDialog}>
                    <Plus size={15} />
                    <span>Create Room</span>
                  </button>
                  <button
                    className="live-chat-room-tab live-chat-room-tab--mentions"
                    data-live-chat-room-tab
                    data-room-id={liveChatMentionsRoomId}
                    role="tab"
                    type="button"
                    aria-selected={isMentionsView}
                    style={{ "--live-chat-room-tab-color": "#8a63f2" } as CSSProperties}
                    onClick={() => setActiveRoomId(liveChatMentionsRoomId)}
                  >
                    Mentions <strong>{mentionMessages.length}</strong>
                  </button>
                </div>
              </div>
            </div>
            {!isMentionsView && activeRoom && !activeRoom.isDefault && (
              <p className="live-chat-room-invite-summary" aria-label="Live chat room invite summary">
                <Users size={14} aria-hidden="true" />
                <span>{activeRoomInviteSummary}</span>
              </p>
            )}
          </div>

          <ol className="live-chat-feed" aria-label="Live chat messages" ref={messageFeedRef} onScroll={handleMessageFeedScroll}>
            {filteredMessages.length ? filteredMessages.map((message) => <LiveChatMessageLine key={message.id} message={message} />) : (
              <li className="live-chat-empty">
                <MessagesSquare size={24} />
                <span>{activeRoomEmptyMessage}</span>
              </li>
            )}
          </ol>

          <form className="live-chat-composer" aria-label="Live chat composer" onSubmit={sendMessage}>
            <button className="live-chat-emoji-button" type="button" aria-label="Emoji menu" disabled>
              <Smile size={24} />
            </button>
            <label className="sr-only" htmlFor="live-chat-message-input">Enter message.</label>
            <div className="live-chat-input-shell">
              <input
                id="live-chat-message-input"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                maxLength={liveChatMessageMaxLength}
                placeholder="Enter message."
                disabled={isSending}
              />
            </div>
            <button className="live-chat-send-button" type="submit" disabled={isSending}>
              <Send size={22} />
              <span>{isSending ? "Sending" : "Send"}</span>
            </button>
          </form>
          {sendError && <p className="live-chat-error" role="alert">{sendError}</p>}
          <div className="live-chat-footer-line">
            <p className="live-chat-guidelines">Be respectful and follow <span>community guidelines</span>.</p>
            <span className="live-chat-composer-time live-chat-composer-time--footer" aria-label={`Current composer time ${formatLiveChatComposerTimestamp(timestampDate)}`}>
              {formatLiveChatComposerTimestamp(timestampDate)}
            </span>
          </div>
        </section>
        {isCreateRoomOpen && (
          <div
            className="manager-compose-backdrop live-chat-create-room-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsCreateRoomOpen(false);
            }}
          >
            <form
              className="manager-compose-modal live-chat-create-room-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Create chat room"
              onSubmit={createLiveChatRoom}
            >
              <header className="manager-compose-head">
                <div>
                  <p>Live chat rooms</p>
                  <h2 id="live-chat-create-room-title">Create Room</h2>
                </div>
                <button className="manager-compose-close" type="button" aria-label="Close create room" onClick={() => setIsCreateRoomOpen(false)}>
                  <X size={20} />
                </button>
              </header>

              <div className="live-chat-create-room-layout">
                <section className="live-chat-create-room-settings" aria-label="Room settings">
                  <label className="manager-compose-field live-chat-create-room-name">
                    <span>Room name</span>
                    <input
                      aria-label="Room name"
                      value={newRoomName}
                      onChange={(event) => setNewRoomName(event.target.value)}
                      placeholder="Leadership Team"
                      maxLength={42}
                    />
                  </label>

                  <section className="live-chat-room-color-panel" aria-label="Room color">
                    <div className="live-chat-room-modal-section-head">
                      <Palette size={16} aria-hidden="true" />
                      <span>Room Tab Color</span>
                    </div>
                    <div className="live-chat-room-color-options">
                      {liveChatRoomColorOptions.map((option) => (
                        <label className={`live-chat-room-color-option${newRoomColor === option.value ? " is-selected" : ""}`} key={option.name}>
                          <input
                            aria-label={`Room color ${option.name}`}
                            type="radio"
                            name="live-chat-room-color"
                            checked={newRoomColor === option.value}
                            onChange={() => setNewRoomColor(option.value)}
                          />
                          <span style={{ "--live-chat-room-tab-color": option.value } as CSSProperties} aria-hidden="true" />
                          <strong>{option.name}</strong>
                        </label>
                      ))}
                    </div>
                  </section>
                </section>

                <section className="live-chat-room-invite-panel" aria-label="Invite users">
                  <header className="live-chat-room-modal-section-head">
                    <UserPlus size={16} aria-hidden="true" />
                    <span>Invite Users</span>
                    <strong aria-label="Live chat invite count">{newRoomInviteCount} invited</strong>
                  </header>
                  <div className="live-chat-room-invite-list">
                    {rosterMembers.map((member) => (
                      <label className={`live-chat-room-invite-option${newRoomInviteIds.has(member.id) ? " is-selected" : ""}`} key={member.id}>
                        <input
                          type="checkbox"
                          aria-label={`Invite ${member.name}`}
                          checked={newRoomInviteIds.has(member.id)}
                          onChange={() => toggleNewRoomInvite(member.id)}
                        />
                        <img src={member.avatarSrc} alt="" draggable="false" />
                        <span>
                          <strong>{member.name}</strong>
                          <small>{member.detail}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <footer className={`live-chat-room-invite-confirm${areNewRoomInvitesConfirmed ? " is-confirmed" : ""}`}>
                    <p aria-live="polite">{newRoomInviteStatus}</p>
                    <button
                      className="live-chat-confirm-invites-button"
                      type="button"
                      aria-pressed={areNewRoomInvitesConfirmed}
                      disabled={!newRoomInviteCount}
                      onClick={() => setAreNewRoomInvitesConfirmed(true)}
                    >
                      <CheckCircle2 size={17} aria-hidden="true" />
                      <span>{confirmInvitesButtonLabel}</span>
                    </button>
                  </footer>
                </section>
              </div>

              <footer className="manager-compose-actions">
                <button type="button" className="manager-compose-secondary" onClick={() => setIsCreateRoomOpen(false)}>Cancel</button>
                <button type="submit" className="manager-compose-submit" disabled={!canCreateLiveChatRoom}>
                  <FolderPlus size={18} />
                  <span>Create Room</span>
                </button>
              </footer>
            </form>
          </div>
        )}
        </div>
      </main>
    </section>
  );
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
  const studentProfileNotificationChannels = profileNotificationChannels(studentMessageNotificationSettings);
  const studentProfileNotificationsReady = studentProfileNotificationChannels.some((channel) => channel.enabled) && studentNotificationPermission === "granted";
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

  useSupabaseMessagingSetupString(pushServerEndpointStorageKey, setStudentPushServerEndpoint);

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

  useHomeNotificationStorageSync(session?.email, setStudentMessageNotificationSettings);
  useNotificationDevicePermissionSync({
    settings: studentMessageNotificationSettings,
    setPermission: setStudentNotificationPermission,
    updateSettings: updateStudentMessageNotificationSettings
  });

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
    if (!canRequestBrowserNotifications()) {
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

  const toggleStudentProfileNotificationChannel = async (channelId: ProfileNotificationChannelId) => {
    const isEnabled = studentProfileNotificationChannels.some((channel) => channel.id === channelId && channel.enabled);
    if (isEnabled) {
      const permission = getBrowserNotificationPermission();
      setStudentNotificationPermission(permission);
      updateStudentMessageNotificationSettings({
        ...profileNotificationChannelSettings(channelId, false),
        browserPermission: permission
      });
      showToast(channelId === "messages" ? "Device notifications turned off for your app messages." : `${channelId === "liveChats" ? "Live Chat" : "Mention"} notifications turned off.`);
      return;
    }
    if (!canRequestBrowserNotifications()) {
      setStudentNotificationPermission("unsupported");
      updateStudentMessageNotificationSettings({
        ...profileNotificationChannelSettings(channelId, false),
        browserPermission: "unsupported"
      });
      showToast("Device notifications are unavailable in this browser.");
      return;
    }
    const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
    setStudentNotificationPermission(permission);
    updateStudentMessageNotificationSettings({
      ...profileNotificationChannelSettings(channelId, permission === "granted"),
      browserPermission: permission
    });
    showToast(
      permission === "granted"
        ? channelId === "messages"
          ? "Device notifications enabled for your app messages."
          : `${channelId === "liveChats" ? "Live Chat" : "Mention"} notifications enabled.`
        : "Device notifications were not enabled."
    );
  };

  const sendStudentTestNotification = async () => {
    if (!studentProfileNotificationsReady) {
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
              <div className={`manager-home-unified-feed student-reference-feed${selectedThreadId ? " is-note-focused" : ""}`} id="student-profile-unified-feed" aria-label="Student message and notification feed">
                {visibleFeedSections.length ? (
                  visibleFeedSections.map((section) => (
                    <section className="manager-home-date-section" key={section.date} aria-label={`Messages and event notifications from ${section.date}`}>
                      <div className="manager-home-date-divider" role="separator" aria-label={`Messages and event notifications from ${section.date}`}>
                        <span>{section.date}</span>
                      </div>
                      {section.threads.map((thread) => {
                        const isSelected = thread.id === selectedThreadId;
                        const isNoteDimmed = Boolean(selectedThreadId) && !isSelected;
                        const isUnread = Boolean(thread.unread);
                        const kindLabel = thread.kind === "event" ? "Event Notification" : "Message";
                        const readStatusLabel = isUnread ? "Unread" : "Read";

                        return (
                          <article className={`manager-home-feed-item manager-home-feed-item--${thread.kind}${isUnread ? " is-unread" : " is-read"}${isSelected ? " is-selected" : ""}${isNoteDimmed ? " is-note-dimmed" : ""}`} key={thread.id}>
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
                <FirstPagePreferenceField
                  value={studentProfile.landingPage}
                  options={studentLandingPageOptions}
                  onChange={(landingPage) => setStudentProfile({ ...studentProfile, landingPage })}
                />
                <label className="manager-profile-check">
                  <input
                    type="checkbox"
                    checked={studentProfile.updates}
                    onChange={(event) => setStudentProfile({ ...studentProfile, updates: event.target.checked })}
                  />
                  <span>Receive class and event updates</span>
                </label>
                <ProfileNotificationSettingsControl
                  channels={studentProfileNotificationChannels}
                  onSendTest={sendStudentTestNotification}
                  onToggle={toggleStudentProfileNotificationChannel}
                  permission={studentNotificationPermission}
                  pushSubscriptionReady={studentPushSubscriptionReady}
                />
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
  const [selectedParentNoteId, setSelectedParentNoteId] = useState<string | null>(null);
  const nextClass = findNextStudentScheduledClass(scheduledClasses, selectedChild?.id, today);
  const nextEvent = findNextStudioEvent(studioEvents, today);
  const toggleParentNoteFocus = (noteId: string) => {
    setSelectedParentNoteId((currentNoteId) => currentNoteId === noteId ? null : noteId);
  };
  const parentMessageListClassName = `parent-message-list${selectedParentNoteId ? " is-note-focused" : ""}`;
  const parentMessageRowClassName = (noteId: string) =>
    `parent-message-row${selectedParentNoteId === noteId ? " is-selected" : ""}${selectedParentNoteId && selectedParentNoteId !== noteId ? " is-note-dimmed" : ""}`;

  useEffect(() => {
    setSelectedParentNoteId(null);
  }, [activeTab, selectedChild?.id]);

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
        <div className={parentMessageListClassName}>
          {visibleMessages.map((thread) => (
            <button
              aria-pressed={selectedParentNoteId === thread.id}
              className={parentMessageRowClassName(thread.id)}
              key={thread.id}
              onClick={() => toggleParentNoteFocus(thread.id)}
              type="button"
            >
              <img src={thread.avatar} alt="" draggable="false" />
              <div>
                <strong>{thread.title}</strong>
                <span>{thread.sender} - {thread.sentDate} at {thread.sentTime}</span>
                <p>{thread.preview}</p>
              </div>
            </button>
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
        <div className={parentMessageListClassName}>
          {eventThreads.map((thread) => (
            <button
              aria-pressed={selectedParentNoteId === thread.id}
              className={parentMessageRowClassName(thread.id)}
              key={thread.id}
              onClick={() => toggleParentNoteFocus(thread.id)}
              type="button"
            >
              <img src={thread.avatar} alt="" draggable="false" />
              <div>
                <strong>{thread.title}</strong>
                <span>{thread.sender} - {thread.sentDate} at {thread.sentTime}</span>
                <p>{thread.preview}</p>
              </div>
            </button>
          ))}
          {studioEvents.slice(0, 3).map((event) => (
            <button
              aria-pressed={selectedParentNoteId === event.id}
              className={parentMessageRowClassName(event.id)}
              key={event.id}
              onClick={() => toggleParentNoteFocus(event.id)}
              type="button"
            >
              <span className="parent-card-icon" aria-hidden="true"><CalendarDays size={20} /></span>
              <div>
                <strong>{event.title}</strong>
                <span>{event.date} at {event.time}</span>
                <p>{event.details}</p>
              </div>
            </button>
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
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ParentProfileTab>(() => parentTabFromSearch(location.search));
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
  const [parentProfile, setParentProfile] = useState(() => readGuardianProfile(session?.email));
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
  const parentProfileNotificationChannels = profileNotificationChannels(parentMessageNotificationSettings);
  const parentProfileNotificationsReady = parentProfileNotificationChannels.some((channel) => channel.enabled) && parentNotificationPermission === "granted";
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

  useSupabaseMessagingSetupString(pushServerEndpointStorageKey, setParentPushServerEndpoint);

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

  useHomeNotificationStorageSync(session?.email, setParentMessageNotificationSettings);
  useNotificationDevicePermissionSync({
    settings: parentMessageNotificationSettings,
    setPermission: setParentNotificationPermission,
    updateSettings: updateParentMessageNotificationSettings
  });

  useEffect(() => {
    setParentProfile(readGuardianProfile(session?.email));
    setParentMessageNotificationSettings(readHomeMessageNotificationSettings(session?.email));
    setParentNotificationPermission(getBrowserNotificationPermission());
  }, [session?.email]);

  useEffect(() => {
    setActiveTab(parentTabFromSearch(location.search));
  }, [location.search]);

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
    setParentProfile(readGuardianProfile(session?.email));
    setParentProfileOpen(true);
  };

  const enableParentMessageNotifications = async () => {
    if (!canRequestBrowserNotifications()) {
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

  const toggleParentProfileNotificationChannel = async (channelId: ProfileNotificationChannelId) => {
    const isEnabled = parentProfileNotificationChannels.some((channel) => channel.id === channelId && channel.enabled);
    if (isEnabled) {
      const permission = getBrowserNotificationPermission();
      setParentNotificationPermission(permission);
      updateParentMessageNotificationSettings({
        ...profileNotificationChannelSettings(channelId, false),
        browserPermission: permission
      });
      showToast(channelId === "messages" ? "Device notifications turned off for parent app messages." : `${channelId === "liveChats" ? "Live Chat" : "Mention"} notifications turned off.`);
      return;
    }
    if (!canRequestBrowserNotifications()) {
      setParentNotificationPermission("unsupported");
      updateParentMessageNotificationSettings({
        ...profileNotificationChannelSettings(channelId, false),
        browserPermission: "unsupported"
      });
      showToast("Device notifications are unavailable in this browser.");
      return;
    }
    const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
    setParentNotificationPermission(permission);
    updateParentMessageNotificationSettings({
      ...profileNotificationChannelSettings(channelId, permission === "granted"),
      browserPermission: permission
    });
    showToast(
      permission === "granted"
        ? channelId === "messages"
          ? "Device notifications enabled for parent app messages."
          : `${channelId === "liveChats" ? "Live Chat" : "Mention"} notifications enabled.`
        : "Device notifications were not enabled."
    );
  };

  const sendParentTestNotification = async () => {
    if (!parentProfileNotificationsReady) {
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
    writeGuardianProfile(parentProfile, session?.email);
    applyAppTheme(parentProfile.theme);
    writeStoredAppTheme(parentProfile.theme);
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
                      className={`manager-theme-option${parentProfile.theme === "light" ? " is-active" : ""}`}
                      aria-pressed={parentProfile.theme === "light"}
                      onClick={() => setParentProfile({ ...parentProfile, theme: "light" })}
                    >
                      <Sun size={16} /> Light
                    </button>
                    <button
                      type="button"
                      className={`manager-theme-option${parentProfile.theme === "dark" ? " is-active" : ""}`}
                      aria-pressed={parentProfile.theme === "dark"}
                      onClick={() => setParentProfile({ ...parentProfile, theme: "dark" })}
                    >
                      <Moon size={16} /> Dark
                    </button>
                  </div>
                </div>
                <FirstPagePreferenceField
                  value={parentProfile.landingPage}
                  options={parentLandingPageOptions}
                  onChange={(landingPage) => setParentProfile({ ...parentProfile, landingPage })}
                />
                <div className="manager-profile-check parent-profile-settings-note">
                  <Palette size={18} aria-hidden="true" />
                  <span>Saved colors apply only to this parent login.</span>
                </div>
                <ProfileNotificationSettingsControl
                  channels={parentProfileNotificationChannels}
                  onSendTest={sendParentTestNotification}
                  onToggle={toggleParentProfileNotificationChannel}
                  permission={parentNotificationPermission}
                  pushSubscriptionReady={parentPushSubscriptionReady}
                />
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
  const isDeveloper = managerAccountAccess.isDeveloper;
  const readHomeProfile = isManagerOwner ? readManagerProfile : readStaffProfile;
  const writeHomeProfile = isManagerOwner ? writeManagerProfile : writeStaffProfile;
  const [managerProfile, setManagerProfile] = useState(() => readHomeProfile(session?.email));
  const profileTitle = isManagerOwner ? "Profile" : "Staff Profile";
  const panelLabel = isDeveloper ? "Developer Panel" : isManagerOwner ? "Manager's Panel" : "Staff Panel";
  const roleLabel = isDeveloper ? "Developer" : isManagerOwner ? "Head Coach & Manager" : currentManagedAccount?.title?.trim() || "Staff Member";
  const profileKindLabel = isDeveloper ? "developer" : isManagerOwner ? "manager" : "staff";
  const profileAvatarPath = profileAvatarPathForSession(session?.email);
  const profileAvatarSrc = managerProfile.photoDataUrl ?? publicAsset(profileAvatarPath);
  const staffSenderName = managerProfile.name.trim() || managerProfileNameFallback(isDeveloper, isManagerOwner);
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
  const [isFeedDeleteConfirmOpen, setIsFeedDeleteConfirmOpen] = useState(false);
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
  const visibleFeedThreadIds = visibleThreads.map((thread) => thread.id);
  const allVisibleFeedThreadsSelected =
    Boolean(visibleFeedThreadIds.length) && visibleFeedThreadIds.every((threadId) => selectedFeedThreadIds.has(threadId));
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
    if (!selectedFeedCount) setIsFeedDeleteConfirmOpen(false);
  }, [selectedFeedCount]);

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

  const toggleAllVisibleFeedThreadSelection = () => {
    setSelectedFeedThreadIds(() => allVisibleFeedThreadsSelected ? new Set<string>() : new Set(visibleFeedThreadIds));
  };

  const changeFeedFilter = (nextFilter: ManagerHomeThread["kind"]) => {
    const resolvedFilter: ManagerHomeFeedFilter = feedFilter === nextFilter ? "all" : nextFilter;
    setFeedFilter(resolvedFilter);
    setSelectedFeedThreadIds(new Set<string>());
    setIsFeedDeleteConfirmOpen(false);
    setSelectedThreadId((currentThreadId) => {
      if (!currentThreadId || resolvedFilter === "all") return currentThreadId;
      const currentThread = feedThreads.find((thread) => thread.id === currentThreadId);
      return currentThread?.kind === resolvedFilter ? currentThreadId : null;
    });
  };

  const openFeedThread = (threadId: string) => {
    updateOverviewProgress(0);
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

  const requestSelectedFeedDelete = () => {
    if (!selectedFeedCount) return;
    setIsFeedDeleteConfirmOpen(true);
  };

  const closeSelectedFeedDelete = () => {
    setIsFeedDeleteConfirmOpen(false);
  };

  const deleteSelectedFeedThreads = () => {
    if (!selectedFeedCount) return;
    const idsToDelete = selectedFeedThreadIds;
    setIsFeedDeleteConfirmOpen(false);
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
      sender: staffSenderName,
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
          senderName: staffSenderName,
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
        senderName: staffSenderName,
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
    <section className="manager-home-page" aria-label={isDeveloper ? "Developer home page" : isManagerOwner ? "Manager home page" : "Staff home page"}>
      <header className="manager-home-profile-title manager-home-profile-title--with-live-chat manager-page-title-bar" aria-label="Profile page header">
        <ManagerPageTitleFrame title={profileTitle} className="manager-home-profile-title-frame" />
        <nav className="manager-home-top-actions" aria-label="Profile quick actions">
          <Link className="manager-home-top-action manager-home-live-chat-link" to="/live-chat" aria-label="Live Chat">
            <img className="manager-home-live-chat-icon" src={messagesLauncherIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Live Chat</span>
          </Link>
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
          <section className="manager-home-overview" aria-label={isDeveloper ? "Developer home overview" : isManagerOwner ? "Manager home overview" : "Staff home overview"} ref={overviewContentRef}>
            <article className="manager-home-profile-card" aria-label={isDeveloper ? "Developer profile overview" : isManagerOwner ? "Manager profile overview" : "Staff profile overview"}>
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
                <img src={profileAvatarSrc} alt={`${managerProfile.name} profile portrait`} draggable="false" />
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
          aria-label={isOverviewCollapsed ? `Expand ${profileKindLabel} overview` : `Collapse ${profileKindLabel} overview`}
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
          <div className={`manager-home-feed-head${selectedFeedCount > 0 && !isFeedSearchOpen ? " is-selecting" : ""}`}>
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
              {selectedFeedCount === 0 ? (
                <button className="manager-home-compose" type="button" aria-label="Compose" onClick={() => setIsComposeOpen(true)}>
                  <span>Compose</span>
                  <Plus size={16} />
                </button>
              ) : null}
              {selectedFeedCount > 0 && (
                <span className="manager-home-bulk-actions" aria-live="polite">
                  <strong>{selectedFeedCount} selected</strong>
                  <button type="button" aria-label="Delete selected" onClick={requestSelectedFeedDelete}>
                    <Trash2 size={17} />
                    <span>Delete</span>
                  </button>
                </span>
              )}
            </div>
          </div>
          <div className={`manager-home-search-shell${isFeedSearchOpen ? " is-open" : ""}${selectedFeedCount > 0 && !isFeedSearchOpen ? " is-selecting" : ""}`}>
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
              <>
                {selectedFeedCount > 0 && (
                  <label className="manager-home-select-all-toggle">
                    <span>All</span>
                    <input
                      aria-label="Select all visible feed items"
                      type="checkbox"
                      checked={allVisibleFeedThreadsSelected}
                      onChange={toggleAllVisibleFeedThreadSelection}
                    />
                    <span aria-hidden="true" />
                  </label>
                )}
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
              </>
            )}
          </div>
          <div className={`manager-home-unified-feed${selectedThreadId ? " is-note-focused" : ""}`} id="manager-home-unified-feed" aria-label="Home message and notification feed">
            {visibleFeedSections.length ? (
              visibleFeedSections.map((section) => (
                <section className="manager-home-date-section" key={section.date} aria-label={`Messages and event notifications from ${section.date}`}>
                  <div className="manager-home-date-divider" role="separator" aria-label={`Messages and event notifications from ${section.date}`}>
                    <span>{section.date}</span>
                  </div>
                  {section.threads.map((thread) => {
                    const isSelected = thread.id === selectedThreadId;
                    const isNoteDimmed = Boolean(selectedThreadId) && !isSelected;
                    const isBulkSelected = selectedFeedThreadIds.has(thread.id);
                    const isUnread = Boolean(thread.unread);
                    const kindLabel = thread.kind === "event" ? "Event Notification" : "Message";
                    const readStatusLabel = isUnread ? "Unread" : "Read";

                    return (
                      <article className={`manager-home-feed-item manager-home-feed-item--${thread.kind}${isUnread ? " is-unread" : " is-read"}${isSelected ? " is-selected" : ""}${isNoteDimmed ? " is-note-dimmed" : ""}${isBulkSelected ? " is-bulk-selected" : ""}`} key={thread.id}>
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
        {isFeedDeleteConfirmOpen && selectedFeedCount > 0 && (
          <div
            className="modal-backdrop manager-calendar-action-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeSelectedFeedDelete();
            }}
          >
            <div
              aria-describedby="manager-home-delete-description"
              aria-labelledby="manager-home-delete-title"
              aria-modal="true"
              className="modal-card modal-form manager-calendar-delete-dialog manager-home-delete-dialog"
              role="dialog"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="student-modal-head">
                <div>
                  <h2 id="manager-home-delete-title">Delete selected items?</h2>
                  <p id="manager-home-delete-description">
                    This will remove {selectedFeedCount} selected {selectedFeedCount === 1 ? "item" : "items"} from the Home Page feed.
                  </p>
                </div>
                <button type="button" className="student-modal-close" aria-label="Close delete confirmation" onClick={closeSelectedFeedDelete}>
                  <X size={18} />
                </button>
              </div>
              <div className="manager-starter-program-actions manager-calendar-delete-actions">
                <button type="button" onClick={closeSelectedFeedDelete}>Cancel</button>
                <button type="button" className="manager-calendar-delete-confirm" onClick={deleteSelectedFeedThreads}>
                  <Trash2 size={18} aria-hidden="true" />
                  Delete {selectedFeedCount === 1 ? "Item" : `${selectedFeedCount} Items`}
                </button>
              </div>
            </div>
          </div>
        )}
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
  const { accountRole, currentManagedAccount, logout, managerAccountAccess, messageNotificationSettings, session, showToast, students, updateMessageNotificationSettings } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const isManagerOwner = managerAccountAccess.isManagerOwner;
  const isDeveloper = managerAccountAccess.isDeveloper;
  const isStudentPanel = accountRole === "student";
  const isStaffPanel = accountRole === "staff" && !isManagerOwner;
  const readPanelProfile = isManagerOwner ? readManagerProfile : readStaffProfile;
  const writePanelProfile = isManagerOwner ? writeManagerProfile : writeStaffProfile;
  const profileOwnerLabel = isDeveloper ? "Developer" : isManagerOwner ? "Manager" : "Staff";
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSettings, setProfileSettings] = useState(() => readPanelProfile(session?.email));
  const [profileNotificationPermission, setProfileNotificationPermission] = useState(() => getBrowserNotificationPermission());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const managerVisibleLauncherItems = managerAccountAccess.isDeveloper
    ? [...managerLauncherItems, developerLauncherItem]
    : managerLauncherItems;
  const launcherItems = isStudentPanel
    ? studentLauncherItems
    : managerVisibleLauncherItems.filter((item) => item.icon === "developer" ? managerAccountAccess.isDeveloper : managerAccountAccess.allowedTools.includes(item.icon as ManagerAccessKey));
  const selectedLauncherItem = isStudentPanel
    ? getSelectedStudentLauncherItem(location.search)
    : launcherItems.find((item) => item.icon === new URLSearchParams(location.search).get("tool")) ?? launcherItems[0] ?? managerVisibleLauncherItems[0] ?? managerLauncherItems[0];
  const launcherName = isStudentPanel ? "student" : isStaffPanel ? "staff" : isDeveloper ? "developer" : "manager";
  const panelTitle = isStudentPanel ? "Student's Panel" : isStaffPanel ? "STAFF PANEL" : isDeveloper ? "DEVELOPER PANEL" : "MANAGER PANEL";
  const profilePanelLabel = isDeveloper ? "Developer Panel" : isManagerOwner ? "Manager's Panel" : "Staff Panel";
  const profileLandingPageOptions = staffLandingPageOptions(managerAccountAccess.allowedTools, profilePanelLabel);
  const panelAriaLabel = isStudentPanel ? "Student dashboard" : isStaffPanel ? "Staff dashboard" : isDeveloper ? "Developer dashboard" : "Manager dashboard";
  const panelHeaderAriaLabel = isStudentPanel ? "Student panel page header" : isStaffPanel ? "Staff panel page header" : isDeveloper ? "Developer panel page header" : "Manager panel page header";
  const panelQuickActionsLabel = isStudentPanel ? "Student panel quick actions" : isStaffPanel ? "Staff panel quick actions" : isDeveloper ? "Developer panel quick actions" : "Manager panel quick actions";
  const launcherAriaLabel = isStudentPanel ? "Student app launcher" : isStaffPanel ? "Staff app launcher" : isDeveloper ? "Developer app launcher" : "Manager app launcher";
  const workspaceFrameLabel = isStudentPanel ? "Student launcher workspace frame" : isStaffPanel ? "Staff launcher workspace frame" : isDeveloper ? "Developer launcher workspace frame" : "Manager launcher workspace frame";
  const sidebarToggleLabel = isSidebarCollapsed ? `Expand ${launcherName} app launcher` : `Collapse ${launcherName} app launcher`;
  const managerProfileNotificationChannels = profileNotificationChannels(messageNotificationSettings);
  const managerProfilePushSubscriptionReady = Boolean(messageNotificationSettings.pushSubscriptionEndpoint?.trim());
  const studentRecord = selectSessionStudent(students, session?.email, currentManagedAccount?.studentId);
  const studentPanelProfile = isStudentPanel ? readStudentProfile(session?.email, studentRecord) : undefined;
  const profileAvatarPath = profileAvatarPathForSession(session?.email);
  const profileActionPhoto = isStudentPanel
    ? studentPanelProfile?.photoDataUrl ?? (studentRecord?.profileImagePath ? publicAsset(studentRecord.profileImagePath) : publicAsset("assets/CheetahProfilePic/Cheetah.png"))
    : profileSettings.photoDataUrl ?? publicAsset(profileAvatarPath);
  const activeStudentCount = students.filter((student) => (student.status ?? "Active").toLowerCase() === "active").length;
  const managerColorPreview: ProfileColorPreviewData = {
    kind: isManagerOwner ? "manager" : "staff",
    title: `${profileOwnerLabel} Profile`,
    displayName: profileSettings.name.trim() || managerProfileNameFallback(isDeveloper, isManagerOwner),
    roleLabel: isDeveloper ? "Developer" : isManagerOwner ? "Head Coach & Manager" : currentManagedAccount?.title?.trim() || "Staff Member",
    portraitSrc: profileSettings.photoDataUrl ?? publicAsset(profileAvatarPath),
    avatarText: isDeveloper ? "DV" : "CM",
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

  useNotificationDevicePermissionSync({
    enabled: !isStudentPanel,
    settings: messageNotificationSettings,
    setPermission: setProfileNotificationPermission,
    updateSettings: updateMessageNotificationSettings
  });

  useEffect(() => {
    if (new URLSearchParams(location.search).get("profile") !== "settings") return;
    if (isStudentPanel) {
      navigate("/manager", { replace: true });
      return;
    }
    setProfileSettings(readPanelProfile(session?.email));
    setProfileNotificationPermission(getBrowserNotificationPermission());
    setProfileOpen(true);
    navigate("/manager", { replace: true });
  }, [isStudentPanel, location.search, navigate, readPanelProfile, session?.email]);

  useEffect(() => {
    if (profileOpen) setProfileNotificationPermission(getBrowserNotificationPermission());
  }, [profileOpen, session?.email]);

  const selectProfileTheme = (theme: AppThemeMode) => {
    setProfileSettings((current) => ({ ...current, theme }));
    writePanelProfile({ ...readPanelProfile(session?.email), theme }, session?.email);
    writeStoredAppTheme(theme);
  };

  const closeProfileSettings = () => {
    setProfileOpen(false);
    navigate("/profile", { replace: true });
  };

  const saveProfileSettings = (event: FormEvent) => {
    event.preventDefault();
    const nextProfile: ManagerProfileSettings = {
      name: profileSettings.name.trim(),
      username: profileSettings.username.trim(),
      email: profileSettings.email.trim(),
      phone: profileSettings.phone.trim(),
      updates: profileSettings.updates,
      theme: profileSettings.theme,
      landingPage: landingPageValueOrDefault(profileSettings.landingPage, profileLandingPageOptions, "live-chat"),
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

    applyAppTheme(nextProfile.theme);
    writeStoredAppTheme(nextProfile.theme);
    writePanelProfile(nextProfile, session?.email);
    setProfileSettings(nextProfile);
    setProfileOpen(false);
    navigate("/profile", { replace: true });
    showToast(`${profileOwnerLabel} profile settings saved.`);
  };

  const toggleManagerProfileNotificationChannel = async (channelId: ProfileNotificationChannelId) => {
    const isEnabled = managerProfileNotificationChannels.some((channel) => channel.id === channelId && channel.enabled);
    if (isEnabled) {
      const permission = getBrowserNotificationPermission();
      setProfileNotificationPermission(permission);
      updateMessageNotificationSettings({
        ...profileNotificationChannelSettings(channelId, false),
        browserPermission: permission
      });
      showToast(channelId === "messages" ? "Device notifications turned off for app messages." : `${channelId === "liveChats" ? "Live Chat" : "Mention"} notifications turned off.`);
      return;
    }
    if (!canRequestBrowserNotifications()) {
      setProfileNotificationPermission("unsupported");
      updateMessageNotificationSettings({
        ...profileNotificationChannelSettings(channelId, false),
        browserPermission: "unsupported"
      });
      showToast("Device notifications are unavailable in this browser.");
      return;
    }
    const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
    setProfileNotificationPermission(permission);
    updateMessageNotificationSettings({
      ...profileNotificationChannelSettings(channelId, permission === "granted"),
      browserPermission: permission
    });
    showToast(
      permission === "granted"
        ? channelId === "messages"
          ? "Device notifications enabled for app messages."
          : `${channelId === "liveChats" ? "Live Chat" : "Mention"} notifications enabled.`
        : "Device notifications were not enabled."
    );
  };

  const sendManagerProfileTestNotification = async () => {
    const hasEnabledChannel = managerProfileNotificationChannels.some((channel) => channel.enabled);
    if (!hasEnabledChannel || profileNotificationPermission !== "granted") {
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

  return (
    <section className={`manager-launcher-page${isStudentPanel ? " student-launcher-page" : ""}${isStaffPanel ? " staff-launcher-page" : ""}`} aria-label={panelAriaLabel}>
      <main className="manager-launcher-main">
        <header className="manager-launcher-topbar manager-page-title-bar" aria-label={panelHeaderAriaLabel}>
          <ManagerPageTitleFrame title={panelTitle} className="manager-page-title-frame--manager-panel" />
          <nav className="manager-home-top-actions" aria-label={panelQuickActionsLabel}>
            <Link className="manager-home-top-action manager-launcher-profile-link" to="/profile" aria-label="Profile">
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
                  placeholder={managerProfileNameFallback(isDeveloper, isManagerOwner)}
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
              <p className="operations-note">Sign-in passwords are managed in Supabase Auth for Manager123 and cannot be changed from profile settings.</p>
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
                <FirstPagePreferenceField
                  value={profileSettings.landingPage}
                  options={profileLandingPageOptions}
                  onChange={(landingPage) => setProfileSettings({ ...profileSettings, landingPage })}
                />
                <label className="manager-profile-check">
                  <input
                    type="checkbox"
                    checked={profileSettings.updates}
                    onChange={(event) => setProfileSettings({ ...profileSettings, updates: event.target.checked })}
                  />
                  <span>Receive manager updates and reminders</span>
                </label>
                <ProfileNotificationSettingsControl
                  channels={managerProfileNotificationChannels}
                  onSendTest={sendManagerProfileTestNotification}
                  onToggle={toggleManagerProfileNotificationChannel}
                  permission={profileNotificationPermission}
                  pushSubscriptionReady={managerProfilePushSubscriptionReady}
                />
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

type CreateAccountMode = "staff" | "student" | "parent";

const createdAccountPasswordPolicyText = "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.";
const createAccountStaffAccessOptions: { key: ManagerAccessKey; label: string; detail: string }[] = [
  { key: "dashboard", label: "Dashboard", detail: "Calendar and daily overview" },
  { key: "messages", label: "Messages", detail: "Live chat and text tools" },
  { key: "students", label: "Students", detail: "Roster and student records" },
  { key: "classes", label: "Classes", detail: "Class templates" },
  { key: "studyGuide", label: "Study Guide", detail: "Student study materials" },
  { key: "events", label: "Events", detail: "Studio events" },
  { key: "scheduling", label: "Schedule", detail: "Class calendar" },
  { key: "merchandise", label: "Merchandise", detail: "Inventory tools" },
  { key: "videos", label: "Videos", detail: "Training video library" },
  { key: "reports", label: "Reports", detail: "Operations reports" }
];

function isStrongCreatedAccountPassword(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function normalizeCreateUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

const defaultStaffAccess = createAccountStaffAccessOptions.map((option) => option.key);

function CreateAccountsPage() {
  const {
    accounts,
    addOperationsStudent,
    createGuardianAccount,
    createManagedAccount,
    managedAccounts,
    managerAccountAccess,
    showToast,
    updateManagedAccountStatus
  } = useAppState();
  const [mode, setMode] = useState<CreateAccountMode>("staff");
  const [formMessage, setFormMessage] = useState("");
  const [staffForm, setStaffForm] = useState({
    displayName: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
    title: "Instructor",
    notes: "",
    access: defaultStaffAccess
  });
  const [studentForm, setStudentForm] = useState({
    fullName: "",
    username: "",
    password: "",
    confirmPassword: "",
    studentEmail: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    program: "Youth Taekwondo",
    beltRank: "White",
    notes: ""
  });
  const [parentForm, setParentForm] = useState({
    displayName: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
    notes: ""
  });
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  if (!managerAccountAccess.canCreateAccounts) return <Navigate to="/manager" replace />;

  const createLiveSupabaseAccount = async (account: {
    displayName: string;
    username: string;
    password: string;
    role: AccountRole;
    email: string;
    phone?: string;
    title?: string;
    notes?: string;
    access?: ManagerAccessKey[];
    studentId?: string;
  }) => {
    if (!isSupabaseAuthConfigured()) return "local";
    if (!readSupabaseAuthSession()) {
      showFormMessage("Sign into Supabase Manager123 before creating live accounts.");
      showToast("Supabase Manager123 sign-in required before creating live accounts.");
      return "handled";
    }
    setIsCreatingAccount(true);
    try {
      const result = await createSupabaseManagedAccount({ ...account, status: "active" });
      if (result.status === "ok") {
        setFormMessage("");
        showToast("Account created in Supabase.");
        return "created";
      }
      const message = result.status === "error" ? result.message : "Supabase account creation is not configured.";
      showFormMessage(message);
      showToast(message);
      return "handled";
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const validatePasswordFields = (password: string, confirmPassword: string) => {
    const cleanedPassword = password.trim();
    if (!cleanedPassword || !confirmPassword.trim()) return "Enter and confirm a password.";
    if (cleanedPassword !== confirmPassword.trim()) return "Passwords must match.";
    if (!isStrongCreatedAccountPassword(cleanedPassword)) return createdAccountPasswordPolicyText;
    return "";
  };

  const showFormMessage = (message: string) => {
    setFormMessage(message);
  };

  const createStaff = async (event: FormEvent) => {
    event.preventDefault();
    const passwordError = validatePasswordFields(staffForm.password, staffForm.confirmPassword);
    if (passwordError) {
      showFormMessage(passwordError);
      return;
    }
    const username = normalizeCreateUsername(staffForm.username);
    const displayName = staffForm.displayName.trim();
    if (!displayName || !username) {
      showFormMessage("Enter a unique staff username and profile name.");
      return;
    }
    if (isSupabaseAuthConfigured()) {
      const liveCreated = await createLiveSupabaseAccount({
        displayName,
        username,
        password: staffForm.password,
        role: "staff",
        email: staffForm.email.trim() || `${username}@chos.prototype`,
        phone: staffForm.phone,
        title: staffForm.title,
        notes: staffForm.notes,
        access: staffForm.access
      });
      if (liveCreated !== "local") {
        if (liveCreated === "created") setStaffForm({ displayName: "", username: "", password: "", confirmPassword: "", email: "", phone: "", title: "Instructor", notes: "", access: defaultStaffAccess });
        return;
      }
    }
    const account = createManagedAccount({
      displayName: staffForm.displayName,
      username,
      password: staffForm.password,
      role: "staff",
      email: staffForm.email,
      phone: staffForm.phone,
      title: staffForm.title,
      notes: staffForm.notes,
      access: staffForm.access
    });
    if (!account) {
      showFormMessage("Enter a unique staff username and profile name.");
      return;
    }
    setFormMessage("");
    setStaffForm({ displayName: "", username: "", password: "", confirmPassword: "", email: "", phone: "", title: "Instructor", notes: "", access: defaultStaffAccess });
    showToast(`${account.displayName} staff account created.`);
  };

  const createStudent = async (event: FormEvent) => {
    event.preventDefault();
    const passwordError = validatePasswordFields(studentForm.password, studentForm.confirmPassword);
    if (passwordError) {
      showFormMessage(passwordError);
      return;
    }
    const username = normalizeCreateUsername(studentForm.username);
    const studentName = studentForm.fullName.trim();
    if (!studentName || !username) {
      showFormMessage("Enter the student name, username, and password.");
      return;
    }
    if (!studentForm.studentEmail.trim() || !studentForm.guardianPhone.trim()) {
      showFormMessage("Enter the student email and parent/guardian phone.");
      return;
    }
    const linkedStudentId = `student-${username.replace(/[^a-z0-9]+/g, "-")}`;
    if (isSupabaseAuthConfigured()) {
      const liveCreated = await createLiveSupabaseAccount({
        displayName: studentName,
        username,
        password: studentForm.password,
        role: "student",
        email: studentForm.studentEmail.trim() || `${username}@chos.prototype`,
        phone: studentForm.guardianPhone,
        title: `${studentForm.beltRank.trim() || "White"} Belt Student`,
        notes: studentForm.notes,
        access: [],
        studentId: linkedStudentId
      });
      if (liveCreated !== "local") {
        if (liveCreated === "created") {
          addOperationsStudent({
            studentId: linkedStudentId,
            fullName: studentForm.fullName,
            studentEmail: studentForm.studentEmail,
            guardianName: studentForm.guardianName,
            guardianPhone: studentForm.guardianPhone,
            guardianEmail: studentForm.guardianEmail,
            program: studentForm.program,
            beltRank: studentForm.beltRank,
            notes: studentForm.notes
          });
          setStudentForm({ fullName: "", username: "", password: "", confirmPassword: "", studentEmail: "", guardianName: "", guardianPhone: "", guardianEmail: "", program: "Youth Taekwondo", beltRank: "White", notes: "" });
        }
        return;
      }
    }
    const student = addOperationsStudent({
      fullName: studentForm.fullName,
      studentEmail: studentForm.studentEmail,
      guardianName: studentForm.guardianName,
      guardianPhone: studentForm.guardianPhone,
      guardianEmail: studentForm.guardianEmail,
      program: studentForm.program,
      status: "Active",
      beltRank: studentForm.beltRank,
      notes: studentForm.notes
    });
    if (!student) {
      showFormMessage("Enter the student name, email, guardian phone, and belt rank.");
      return;
    }
    const localStudentName = fullName(student);
    const account = createManagedAccount({
      displayName: localStudentName,
      username,
      password: studentForm.password,
      role: "student",
      email: student.email,
      phone: student.phone,
      title: `${student.beltRank} Belt Student`,
      notes: studentForm.notes,
      access: [],
      studentId: student.id
    });
    if (!account) {
      showFormMessage("Enter a unique student username linked to an active student.");
      return;
    }
    setFormMessage("");
    setStudentForm({ fullName: "", username: "", password: "", confirmPassword: "", studentEmail: "", guardianName: "", guardianPhone: "", guardianEmail: "", program: "Youth Taekwondo", beltRank: "White", notes: "" });
    showToast(`${account.displayName} student account created.`);
  };

  const createParent = async (event: FormEvent) => {
    event.preventDefault();
    const passwordError = validatePasswordFields(parentForm.password, parentForm.confirmPassword);
    if (passwordError) {
      showFormMessage(passwordError);
      return;
    }
    const username = normalizeCreateUsername(parentForm.username);
    const displayName = parentForm.displayName.trim();
    if (!displayName || !username) {
      showFormMessage("Enter a unique parent username and profile name.");
      return;
    }
    if (isSupabaseAuthConfigured()) {
      const liveCreated = await createLiveSupabaseAccount({
        displayName,
        username,
        password: parentForm.password,
        role: "guardian",
        email: parentForm.email.trim() || `${username}@chos.prototype`,
        phone: parentForm.phone,
        notes: parentForm.notes,
        access: []
      });
      if (liveCreated !== "local") {
        if (liveCreated === "created") setParentForm({ displayName: "", username: "", password: "", confirmPassword: "", email: "", phone: "", notes: "" });
        return;
      }
    }
    const account = createGuardianAccount({
      displayName: parentForm.displayName,
      username,
      password: parentForm.password,
      email: parentForm.email,
      phone: parentForm.phone,
      notes: parentForm.notes
    });
    if (!account) {
      showFormMessage("Enter a unique parent username and profile name.");
      return;
    }
    setFormMessage("");
    setParentForm({ displayName: "", username: "", password: "", confirmPassword: "", email: "", phone: "", notes: "" });
    showToast(`${account.displayName ?? account.email} parent account created.`);
  };

  const toggleStaffAccess = (key: ManagerAccessKey) => {
    setStaffForm((current) => ({
      ...current,
      access: current.access.includes(key) ? current.access.filter((item) => item !== key) : [...current.access, key]
    }));
  };

  const updateAccountStatus = (account: ManagedAccount, status: ManagedAccount["status"]) => {
    const updated = updateManagedAccountStatus(account.id, status);
    if (!updated) {
      showToast("Unable to update account status.");
      return;
    }
    showToast(`${account.displayName} account ${status === "active" ? "reactivated" : "deactivated"}.`);
  };

  const parentAccounts = accounts.filter((account) => normalizeCreateUsername(account.email) && account.password?.trim() && account.role === "guardian");
  const activeManagedAccounts = managedAccounts.filter((account) => account.status !== "inactive");

  return (
    <OperationsPage
      className="operations-page--create-accounts"
      title="Create Accounts"
      text="Create local sign-in credentials for staff, students, and parents. Manager and Developer are the only accounts that can open this creator."
    >
      <div className="operations-stats create-account-stats">
        <StatCard label="Owner accounts" value={2} icon={<ShieldCheck />} />
        <StatCard label="Managed accounts" value={managedAccounts.length} icon={<UserPlus />} />
        <StatCard label="Parent accounts" value={parentAccounts.length} icon={<Users />} />
      </div>

      <section className="operations-panel create-account-builder" aria-label="Create account panel">
        <div className="student-roster-head">
          <div>
            <h2>Creator</h2>
            <p>Choose the role, set the username and password, then hand the credentials to the family or staff member.</p>
          </div>
        </div>
        <div className="create-account-mode-tabs" role="group" aria-label="Account type">
          {(["staff", "student", "parent"] as const).map((item) => (
            <button key={item} type="button" aria-pressed={mode === item} onClick={() => { setMode(item); setFormMessage(""); }}>
              {item === "staff" ? <UserPlus size={16} /> : item === "student" ? <Award size={16} /> : <Users size={16} />}
              {item === "staff" ? "Staff" : item === "student" ? "Student" : "Parent"}
            </button>
          ))}
        </div>
        {formMessage && <p className="operations-note">{formMessage}</p>}

        {mode === "staff" && (
          <form className="create-account-form" aria-label="Create staff account" onSubmit={createStaff}>
            <div className="student-form-grid">
              <label>Staff full name<input value={staffForm.displayName} onChange={(event) => setStaffForm({ ...staffForm, displayName: event.target.value })} /></label>
              <label>Staff username<input autoComplete="username" value={staffForm.username} onChange={(event) => setStaffForm({ ...staffForm, username: event.target.value })} /></label>
              <label>Staff password<input type="password" autoComplete="new-password" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} /></label>
              <label>Confirm staff password<input type="password" autoComplete="new-password" value={staffForm.confirmPassword} onChange={(event) => setStaffForm({ ...staffForm, confirmPassword: event.target.value })} /></label>
              <label>Staff email<input type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} /></label>
              <label>Staff phone<input value={staffForm.phone} onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })} /></label>
              <label>Staff title<input value={staffForm.title} onChange={(event) => setStaffForm({ ...staffForm, title: event.target.value })} /></label>
            </div>
            <fieldset className="create-account-access-grid">
              <legend>Staff access</legend>
              {createAccountStaffAccessOptions.map((option) => (
                <label key={option.key} className="create-account-access-option">
                  <input type="checkbox" checked={staffForm.access.includes(option.key)} onChange={() => toggleStaffAccess(option.key)} />
                  <span><strong>{option.label} access</strong><small>{option.detail}</small></span>
                </label>
              ))}
            </fieldset>
            <label className="create-account-notes">Staff notes<textarea value={staffForm.notes} onChange={(event) => setStaffForm({ ...staffForm, notes: event.target.value })} /></label>
            <div className="student-editor-actions">
              <button type="submit" disabled={isCreatingAccount}><CheckCircle2 size={18} /> Create Staff Account</button>
            </div>
          </form>
        )}

        {mode === "student" && (
          <form className="create-account-form" aria-label="Create student account" onSubmit={createStudent}>
            <div className="student-form-grid">
              <label>Student full name<input value={studentForm.fullName} onChange={(event) => setStudentForm({ ...studentForm, fullName: event.target.value })} /></label>
              <label>Student username<input autoComplete="username" value={studentForm.username} onChange={(event) => setStudentForm({ ...studentForm, username: event.target.value })} /></label>
              <label>Student password<input type="password" autoComplete="new-password" value={studentForm.password} onChange={(event) => setStudentForm({ ...studentForm, password: event.target.value })} /></label>
              <label>Confirm student password<input type="password" autoComplete="new-password" value={studentForm.confirmPassword} onChange={(event) => setStudentForm({ ...studentForm, confirmPassword: event.target.value })} /></label>
              <label>Student email<input type="email" value={studentForm.studentEmail} onChange={(event) => setStudentForm({ ...studentForm, studentEmail: event.target.value })} /></label>
              <label>Parent/guardian phone<input value={studentForm.guardianPhone} onChange={(event) => setStudentForm({ ...studentForm, guardianPhone: event.target.value })} /></label>
              <label>Parent/guardian name<input value={studentForm.guardianName} onChange={(event) => setStudentForm({ ...studentForm, guardianName: event.target.value })} /></label>
              <label>Parent/guardian email<input type="email" value={studentForm.guardianEmail} onChange={(event) => setStudentForm({ ...studentForm, guardianEmail: event.target.value })} /></label>
              <label>Program<input value={studentForm.program} onChange={(event) => setStudentForm({ ...studentForm, program: event.target.value })} /></label>
              <label>Belt rank<input value={studentForm.beltRank} onChange={(event) => setStudentForm({ ...studentForm, beltRank: event.target.value })} /></label>
            </div>
            <label className="create-account-notes">Student notes<textarea value={studentForm.notes} onChange={(event) => setStudentForm({ ...studentForm, notes: event.target.value })} /></label>
            <div className="student-editor-actions">
              <button type="submit" disabled={isCreatingAccount}><CheckCircle2 size={18} /> Create Student Account</button>
            </div>
          </form>
        )}

        {mode === "parent" && (
          <form className="create-account-form" aria-label="Create parent account" onSubmit={createParent}>
            <div className="student-form-grid">
              <label>Parent full name<input value={parentForm.displayName} onChange={(event) => setParentForm({ ...parentForm, displayName: event.target.value })} /></label>
              <label>Parent username<input autoComplete="username" value={parentForm.username} onChange={(event) => setParentForm({ ...parentForm, username: event.target.value })} /></label>
              <label>Parent password<input type="password" autoComplete="new-password" value={parentForm.password} onChange={(event) => setParentForm({ ...parentForm, password: event.target.value })} /></label>
              <label>Confirm parent password<input type="password" autoComplete="new-password" value={parentForm.confirmPassword} onChange={(event) => setParentForm({ ...parentForm, confirmPassword: event.target.value })} /></label>
              <label>Parent email<input type="email" value={parentForm.email} onChange={(event) => setParentForm({ ...parentForm, email: event.target.value })} /></label>
              <label>Parent phone<input value={parentForm.phone} onChange={(event) => setParentForm({ ...parentForm, phone: event.target.value })} /></label>
            </div>
            <label className="create-account-notes">Parent notes<textarea value={parentForm.notes} onChange={(event) => setParentForm({ ...parentForm, notes: event.target.value })} /></label>
            <div className="student-editor-actions">
              <button type="submit" disabled={isCreatingAccount}><CheckCircle2 size={18} /> Create Parent Account</button>
            </div>
          </form>
        )}
      </section>

      <section className="operations-panel create-account-directory" aria-label="Created account directory">
        <div className="student-roster-head">
          <div>
            <h2>Account Directory</h2>
            <p>{activeManagedAccounts.length} active managed account{activeManagedAccounts.length === 1 ? "" : "s"} plus {parentAccounts.length} parent account{parentAccounts.length === 1 ? "" : "s"}.</p>
          </div>
          <span>{managedAccounts.length + parentAccounts.length} accounts</span>
        </div>
        <div className="create-account-card-grid">
          {managedAccounts.map((account) => (
            <article key={account.id} className="create-account-card" aria-label={`${account.displayName} ${account.role} account`}>
              <div className="create-account-card-main">
                <span className={`create-account-avatar${account.role === "student" ? " create-account-avatar--student" : ""}`} aria-hidden="true">
                  {account.role === "student" ? <Award size={20} /> : <UserPlus size={20} />}
                </span>
                <div>
                  <h3>{account.displayName}</h3>
                  <p>{account.username}</p>
                </div>
              </div>
              <div className="create-account-card-meta">
                <span>{account.status === "inactive" ? "Inactive" : "Active"}</span>
                <span>{account.role === "student" ? "Student" : account.title?.trim() || "Staff"}</span>
              </div>
              {account.role === "staff" && (
                <div className="create-account-access-list" aria-label={`${account.displayName} staff access`}>
                  {(account.access.length ? account.access : ["dashboard"]).map((accessKey) => (
                    <span key={accessKey}>{createAccountStaffAccessOptions.find((option) => option.key === accessKey)?.label ?? accessKey}</span>
                  ))}
                </div>
              )}
              <div className="create-account-card-actions">
                {account.status === "inactive" ? (
                  <button type="button" onClick={() => updateAccountStatus(account, "active")} aria-label={`Reactivate ${account.displayName} account`}>
                    <CheckCircle2 size={16} /> Reactivate
                  </button>
                ) : (
                  <button type="button" className="is-warning" onClick={() => updateAccountStatus(account, "inactive")} aria-label={`Deactivate ${account.displayName} account`}>
                    <X size={16} /> Deactivate
                  </button>
                )}
              </div>
            </article>
          ))}
          {parentAccounts.map((account) => (
            <article key={account.email} className="create-account-card" aria-label={`${account.displayName ?? account.email} parent account`}>
              <div className="create-account-card-main">
                <span className="create-account-avatar" aria-hidden="true"><Users size={20} /></span>
                <div>
                  <h3>{account.displayName ?? account.email}</h3>
                  <p>{account.email}</p>
                </div>
              </div>
              <div className="create-account-card-meta">
                <span>Active</span>
                <span>Guardian</span>
              </div>
            </article>
          ))}
          {!managedAccounts.length && !parentAccounts.length && <p className="operations-note">No created accounts yet.</p>}
        </div>
      </section>
    </OperationsPage>
  );
}

function DashboardPage() {
  const {
    addScheduledClass,
    deleteScheduledClass,
    deleteStudioClass,
    deleteStudioEvent,
    scheduledClasses,
    showToast,
    studioClasses,
    studioEvents,
    updateScheduledClass,
    updateStudioClass,
    updateStudioEvent
  } = useAppState();
  const location = useLocation();
  const focusDateParam = new URLSearchParams(location.search).get("date") ?? "";
  const focusDateKey = isCalendarDateKey(focusDateParam) ? focusDateParam : undefined;

  return (
    <OperationsPage className="operations-page--dashboard" title="Dashboard">
      <div className="manager-dashboard-calendar-page manager-launcher-calendar">
        <ManagerLiveCalendar
          addScheduledClass={addScheduledClass}
          deleteScheduledClass={deleteScheduledClass}
          deleteStudioClass={deleteStudioClass}
          deleteStudioEvent={deleteStudioEvent}
          scheduledClasses={scheduledClasses}
          showToast={showToast}
          studioClasses={studioClasses}
          studioEvents={studioEvents}
          updateScheduledClass={updateScheduledClass}
          updateStudioClass={updateStudioClass}
          updateStudioEvent={updateStudioEvent}
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
  const [backupTwilioRelayEndpoint, setBackupTwilioRelayEndpoint] = useState(() => readTwilioRelayEndpoint());
  const [backupPushServerEndpoint, setBackupPushServerEndpoint] = useState(() => readPushServerEndpoint());
  const [backupTwilioLaunchProfile, setBackupTwilioLaunchProfile] = useState<TwilioLaunchProfile>(() => readTwilioLaunchProfile());
  useSupabaseMessagingSetupString(twilioRelayEndpointStorageKey, setBackupTwilioRelayEndpoint);
  useSupabaseMessagingSetupString(pushServerEndpointStorageKey, setBackupPushServerEndpoint);
  useSupabaseTwilioLaunchProfile(setBackupTwilioLaunchProfile);
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
    messagingSetup: buildProductionMessagingSetupBackupInput(messageNotificationSettings, {
      twilioRelayEndpoint: backupTwilioRelayEndpoint,
      pushServerEndpoint: backupPushServerEndpoint,
      twilioLaunchProfile: backupTwilioLaunchProfile
    }),
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

function studentDirectoryBeltRank(rank: string) {
  const normalizedRank = rank.trim().toLowerCase();
  return beltRanks.find((beltRank) => beltRank.name.toLowerCase() === normalizedRank || beltRank.slug.toLowerCase() === normalizedRank);
}

function studentDirectoryBeltStyle(rank: string) {
  const beltRank = studentDirectoryBeltRank(rank);
  return {
    "--student-belt-color": beltRank?.color ?? "#b8f5e2",
    "--student-belt-text": beltRank?.textColor ?? "#17202d"
  } as CSSProperties;
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

function studentDirectoryLastCheckIn(student: StudentRecord) {
  return student.lastCheckIn?.trim() ? `Last check-in ${student.lastCheckIn}` : "No check-in yet";
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
  const welcomeLogs = useMemo(() => messageLogs.filter((message) => message.kind === "welcome"), [messageLogs]);
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
      ? students.length
        ? `${students.length} student${students.length === 1 ? "" : "s"} listed by belt. Select a name to open student info.`
        : "No students listed yet. Create a student when you are ready."
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
    const ageLabel = studentDirectoryAge(student);
    const genderLabel = student.gender?.trim() || "Not set";
    const programLabel = student.program?.trim() || "Program not set";
    const statusLabel = normalizeStudentDirectoryStatus(student);

    return (
      <button
        key={student.id}
        type="button"
        className="student-name-list-button"
        data-testid="student-name-list-button"
        aria-label={`Open ${studentName} student info`}
        style={studentDirectoryBeltStyle(student.beltRank)}
        onClick={() => selectStudent(student)}
      >
        <span className="student-name-list-belt-rail" aria-hidden="true" />
        <span className="student-name-list-main">
          <span className="student-name-list-name">{studentName}</span>
          <span className="student-name-list-subline">
            <span className="student-name-list-cell student-name-list-cell--age">Age {ageLabel}</span>
            <span className="student-name-list-cell student-name-list-cell--gender">{genderLabel}</span>
            <span className={`student-name-list-status student-name-list-status--${slugClassName(statusLabel)}`}>{statusLabel}</span>
          </span>
        </span>
        <span className="student-name-list-training">
          <span>{programLabel}</span>
          <small>{studentDirectoryLastCheckIn(student)}</small>
        </span>
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
    <OperationsPage className="operations-page--students" title="Students" text="Scan every student by belt rank, then select a compact card to open the full student record." action={headerAction}>
      <div className="students-workspace students-workspace--directory">
        <section className="operations-panel student-roster-panel student-directory-panel student-directory-panel--compact">
          <div className="student-roster-head student-directory-command">
            <div>
              <h2>Belt Board</h2>
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
              <section
                key={belt}
                className={`student-belt-group student-belt-group--card student-belt-group--${beltClassName(belt)}`}
                role="group"
                aria-label={`${belt} belt students`}
                style={studentDirectoryBeltStyle(belt)}
              >
                <div className="student-belt-group-head">
                  <div>
                    <span className="student-belt-group-swatch" aria-hidden="true" />
                    <h3>{belt} Belt</h3>
                  </div>
                  <span className="student-belt-group-count">{beltStudents.length} student{beltStudents.length === 1 ? "" : "s"}</span>
                </div>
                <div className="student-name-list">
                  {beltStudents.map(renderStudentNameButton)}
                </div>
              </section>
            )) : (
              <p className="operations-note student-directory-empty">
                {normalizedStudentSearchQuery
                  ? "No matching students in this view."
                  : students.length === 0 && statusFilter === "All"
                    ? "No students are in the directory yet."
                    : `No ${statusFilter.toLowerCase()} students match this filter.`}
              </p>
            )}
          </div>

          <section className="student-welcome-panel student-welcome-rail" aria-label="Welcome text queue">
            <div className="student-welcome-rail-head">
              <h2>Welcome Text Queue</h2>
              <span>{welcomeLogs.length} queued</span>
            </div>
            <div className="student-welcome-rail-list">
              {welcomeLogs.length ? welcomeLogs.map((message) => <MessagePreview key={message.id} message={message} />) : <p>No welcome texts queued yet.</p>}
            </div>
          </section>
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
    unreadDirectMessages,
    unreadDirectMessageCount,
    updateMessageNotificationSettings
  } = useAppState();
  const supabaseBrowserConfig = getSupabaseBrowserConfig();
  const twilioSupabaseRelayUrls = buildTwilioSupabaseMessagingUrls(supabaseBrowserConfig.url);
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
  const [twilioRelayEndpoint, setTwilioRelayEndpoint] = useState(() => readTwilioRelayEndpoint() || twilioSupabaseRelayUrls.sendUrl);
  const [twilioRelayResultsJson, setTwilioRelayResultsJson] = useState("");
  const [isTwilioRelaySending, setIsTwilioRelaySending] = useState(false);
  const [isSmsConsentSyncing, setIsSmsConsentSyncing] = useState(false);
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
  const twilioRelayHealthReady = isTwilioRelayHealthReady(twilioRelayHealthStatus, twilioRelayHealthChecks);
  const twilioComposeCanLiveSend = Boolean(
    marketingMessage.trim() &&
      marketingAudiencePreview.total &&
      twilioRelayEndpoint.trim() &&
      twilioRelayHealthReady &&
      twilioComplianceProfile.readyForUsProductionTraffic &&
      hasSmsOptOutLanguage(marketingMessage) &&
      !isTwilioRelaySending &&
      !isSmsConsentSyncing
  );
  const activeScheduledPromotions = scheduledTextCampaigns.filter((campaign) => campaign.status === "scheduled");
  const visibleScheduledPromotions = scheduledTextCampaigns.filter((campaign) => campaign.status !== "canceled").slice(0, 4);
  const visibleTextAutomationRuns = textAutomationRuns.slice(0, 3);
  const latestUnreadPreview = latestUnreadDirectMessage?.body.trim() || "No unread app replies are waiting.";
  const latestUnreadSender = latestUnreadDirectMessage?.senderName.trim() || "No sender";
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<Set<string>>(() => new Set());
  const unreadNotificationIds = useMemo(() => unreadDirectMessages.map((message) => message.id), [unreadDirectMessages]);
  const unreadNotificationIdKey = unreadNotificationIds.join("|");
  const selectedUnreadNotificationIds = useMemo(
    () => unreadNotificationIds.filter((id) => selectedNotificationIds.has(id)),
    [selectedNotificationIds, unreadNotificationIds]
  );
  const selectedNotificationCount = selectedUnreadNotificationIds.length;
  const allUnreadNotificationsSelected = Boolean(unreadNotificationIds.length) && selectedNotificationCount === unreadNotificationIds.length;

  useSupabaseMessagingSetupString(twilioRelayEndpointStorageKey, setTwilioRelayEndpoint, twilioSupabaseRelayUrls.sendUrl);
  useSupabaseMessagingSetupString(pushServerEndpointStorageKey, setPushServerEndpoint);
  useSupabaseTwilioLaunchProfile(setTwilioLaunchProfile);

  useNotificationDevicePermissionSync({
    settings: messageNotificationSettings,
    setPermission: setBrowserPermission,
    updateSettings: updateMessageNotificationSettings
  });

  useEffect(() => {
    setWebPushPublicKey(messageNotificationSettings.pushPublicKey ?? "");
  }, [messageNotificationSettings.pushPublicKey]);

  useEffect(() => {
    if (unreadDirectMessageCount > 0) {
      void syncMessageAppBadge(unreadDirectMessageCount);
      return;
    }
    void clearDisplayedAppMessageNotifications();
  }, [unreadDirectMessageCount]);

  useEffect(() => {
    const unreadIds = new Set(unreadNotificationIds);
    setSelectedNotificationIds((current) => {
      const nextSelectedIds = new Set(Array.from(current).filter((id) => unreadIds.has(id)));
      return nextSelectedIds.size === current.size ? current : nextSelectedIds;
    });
  }, [unreadNotificationIdKey, unreadNotificationIds]);

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

  const queueMarketingBlast = (showQueuedToast = true) => {
    if (!marketingMessage.trim()) {
      showToast("Enter a marketing message.");
      return 0;
    }
    const count = sendMarketingBlast(marketingMessage, marketingAudience);
    if (count) {
      if (showQueuedToast) {
        showToast(marketingAudience === "all-students" ? `Marketing blast queued for ${count} student${count === 1 ? "" : "s"}.` : `Text blast queued for ${count} ${messageAudienceLabel(marketingAudience)}.`);
      }
      return count;
    }
    showToast(marketingAudience === "all-students" ? "No current student phone numbers are available." : `No ${messageAudienceLabel(marketingAudience)} phone numbers are available.`);
    return 0;
  };

  const sendMarketing = (event: FormEvent) => {
    event.preventDefault();
    queueMarketingBlast();
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

  const twilioRelayHealthReadyForLiveSend = () => {
    if (twilioRelayHealthReady) return true;
    showToast("Check the Twilio relay health and resolve every readiness check before live sends.");
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
    const endpoint = twilioLaunchProfile.relayHealthCheckUrl.trim() || twilioSupabaseRelayUrls.healthUrl;
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
        headers: { Accept: "application/json", ...supabaseTwilioRelayAuthHeaders(endpoint) }
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
    if (!twilioRelayHealthReadyForLiveSend()) return;
    setIsTwilioRelaySending(true);
    try {
      const response = await window.fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...supabaseTwilioRelayAuthHeaders(endpoint) },
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

  const syncSmsConsentEvidenceToRelay = async (showSuccessToast = true) => {
    const endpoint = twilioConsentSyncUrlForRelayEndpoint(twilioRelayEndpoint.trim() || twilioSupabaseRelayUrls.sendUrl, supabaseBrowserConfig.url);
    const payload = buildSmsConsentEvidencePayload();
    if (!payload.contacts.length) {
      showToast("No SMS consent records are available to sync.");
      return false;
    }
    setIsSmsConsentSyncing(true);
    try {
      const response = await window.fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...supabaseTwilioRelayAuthHeaders(endpoint) },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        showToast(`SMS consent sync failed with HTTP ${response.status}.`);
        return false;
      }
      const result = (await response.json().catch(() => undefined)) as { synced?: unknown } | undefined;
      const synced = typeof result?.synced === "number" ? result.synced : payload.contacts.length;
      if (showSuccessToast) showToast(`${synced} SMS consent record${synced === 1 ? "" : "s"} synced to the Twilio relay.`);
      return true;
    } catch {
      showToast("SMS consent sync failed.");
      return false;
    } finally {
      setIsSmsConsentSyncing(false);
    }
  };

  const sendMarketingViaTwilio = async () => {
    if (!twilioComposeCanLiveSend) {
      if (!hasSmsOptOutLanguage(marketingMessage)) {
        showToast("Add opt-out language before live marketing sends.");
        return;
      }
      if (!twilioSenderComplianceReadyForLiveSend()) return;
      if (!twilioRelayHealthReadyForLiveSend()) return;
    }
    const count = queueMarketingBlast(false);
    if (!count) return;
    const synced = await syncSmsConsentEvidenceToRelay(false);
    if (!synced) return;
    await sendToTwilioRelay();
  };

  const clearStaleTexts = () => {
    const count = clearStaleQueuedTexts();
    showToast(count ? `${count} stale queued text${count === 1 ? "" : "s"} removed.` : "No stale queued texts need cleanup.");
  };

  const buildPushSubscriptionPayload = () => {
    return buildWebPushSubscriptionPayload(messageNotificationSettings, session, accountRole, messagesNotificationUrl());
  };

  const enableDeviceNotifications = async () => {
    if (!canRequestBrowserNotifications()) {
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
        relayEndpoint: twilioRelayEndpoint.trim() || twilioSupabaseRelayUrls.sendUrl,
        consentSyncEndpoint: twilioConsentSyncUrlForRelayEndpoint(twilioRelayEndpoint.trim() || twilioSupabaseRelayUrls.sendUrl, supabaseBrowserConfig.url),
        relayPayloadSchemaVersion: "chos-twilio-relay.v1",
        relayMethod: "POST",
        browserCredentialMode: "include",
        accountProfile: {
          messagingServiceSidConfigured: Boolean(twilioLaunchProfile.messagingServiceSid.trim()),
          messagingServiceSid: twilioLaunchProfile.messagingServiceSid.trim() || null,
          smsSender: twilioLaunchProfile.smsSender.trim() || null,
          inboundWebhookUrl: twilioLaunchProfile.inboundWebhookUrl.trim() || twilioSupabaseRelayUrls.inboundWebhookUrl,
          statusCallbackBaseUrl: twilioLaunchProfile.statusCallbackBaseUrl.trim() || twilioSupabaseRelayUrls.baseUrl,
          relayHealthCheckUrl: twilioLaunchProfile.relayHealthCheckUrl.trim() || twilioSupabaseRelayUrls.healthUrl,
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
          inboundPath: "/inbound",
          inboundWebhookUrl: twilioLaunchProfile.inboundWebhookUrl.trim() || twilioSupabaseRelayUrls.inboundWebhookUrl,
          statusCallbackPathTemplate: "/status/{messageId}",
          statusCallbackUrlTemplate: twilioSupabaseRelayUrls.statusCallbackUrlTemplate,
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
        relayEndpoint: twilioRelayEndpoint.trim() || twilioSupabaseRelayUrls.sendUrl,
        consentSyncEndpoint: twilioConsentSyncUrlForRelayEndpoint(twilioRelayEndpoint.trim() || twilioSupabaseRelayUrls.sendUrl, supabaseBrowserConfig.url),
        relayPayloadSchemaVersion: "chos-twilio-relay.v1",
        relayMethod: "POST",
        browserCredentialMode: "include",
        accountProfile: {
          messagingServiceSidConfigured: Boolean(twilioLaunchProfile.messagingServiceSid.trim()),
          messagingServiceSid: twilioLaunchProfile.messagingServiceSid.trim() || null,
          smsSender: twilioLaunchProfile.smsSender.trim() || null,
          inboundWebhookUrl: twilioLaunchProfile.inboundWebhookUrl.trim() || twilioSupabaseRelayUrls.inboundWebhookUrl,
          statusCallbackBaseUrl: twilioLaunchProfile.statusCallbackBaseUrl.trim() || twilioSupabaseRelayUrls.baseUrl,
          relayHealthCheckUrl: twilioLaunchProfile.relayHealthCheckUrl.trim() || twilioSupabaseRelayUrls.healthUrl,
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
        statusCallbackPathTemplate: "/status/{messageId}",
        statusCallbackUrlTemplate: twilioSupabaseRelayUrls.statusCallbackUrlTemplate
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

  const toggleNotificationSelection = (messageId: string) => {
    setSelectedNotificationIds((current) => {
      const nextSelectedIds = new Set(current);
      if (nextSelectedIds.has(messageId)) {
        nextSelectedIds.delete(messageId);
      } else {
        nextSelectedIds.add(messageId);
      }
      return nextSelectedIds;
    });
  };

  const toggleSelectAllNotifications = () => {
    setSelectedNotificationIds(allUnreadNotificationsSelected ? new Set() : new Set(unreadNotificationIds));
  };

  const markSelectedAppMessagesSeen = () => {
    if (!selectedNotificationCount) return;
    markMessageNotificationsSeen(selectedUnreadNotificationIds);
    setSelectedNotificationIds(new Set());
    showToast(`${selectedNotificationCount} app message notification${selectedNotificationCount === 1 ? "" : "s"} marked seen.`);
  };

  const markAppMessagesSeen = () => {
    markMessageNotificationsSeen();
    setSelectedNotificationIds(new Set());
    showToast("App message notifications marked seen.");
  };

  return (
    <OperationsPage title="Message Settings" text="Manage mass messages, missed-class text follow-ups, message logs, and other message tools.">
      <section className="operations-panel message-settings-panel">
        <h2>Messenger Settings</h2>
        <p>All one-to-one app messenger conversations now stay inside the Home Page messenger container. Use this Manager&apos;s Page tool for message settings, mass texts, text logs, and other messaging operations.</p>
        <Link className="operations-action secondary" to="/profile">
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
          {unreadDirectMessages.length ? (
            <>
              <div className="message-notification-select-row">
                <button type="button" className="operations-action secondary" onClick={toggleSelectAllNotifications}>
                  <CheckCircle2 size={18} /> {allUnreadNotificationsSelected ? "Clear Selection" : "Select All"}
                </button>
                <span>{selectedNotificationCount} selected</span>
              </div>
              <div className="message-notification-list" aria-label="Unread app message notifications">
                {unreadDirectMessages.map((message) => {
                  const isSelected = selectedNotificationIds.has(message.id);
                  const timestamp = formatDirectMessageTimestamp(message.createdAt);
                  return (
                    <button
                      type="button"
                      className={`message-notification-item${isSelected ? " is-selected" : ""}`}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Deselect" : "Select"} notification from ${message.senderName}`}
                      key={message.id}
                      onClick={() => toggleNotificationSelection(message.id)}
                    >
                      <span className="message-notification-item-head">
                        <strong>{message.senderName}</strong>
                        <time dateTime={message.createdAt}>{timestamp.sentDate} {timestamp.sentTime}</time>
                      </span>
                      <span>{message.body}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <article className="message-notification-preview" aria-label="Latest unread app message">
              <strong>{latestUnreadSender}</strong>
              <p>{latestUnreadPreview}</p>
            </article>
          )}
          <div className="message-notification-actions">
            <button type="button" className="operations-action" onClick={markSelectedAppMessagesSeen} disabled={!selectedNotificationCount}>
              <CheckCircle2 size={18} /> Mark Selected Seen
            </button>
            <button type="button" className="operations-action secondary" onClick={markAppMessagesSeen} disabled={!unreadDirectMessageCount}>
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
                placeholder={twilioSupabaseRelayUrls.inboundWebhookUrl}
              />
            </label>
            <label>
              Status callback base URL
              <input
                type="url"
                value={twilioLaunchProfile.statusCallbackBaseUrl}
                onChange={(event) => updateTwilioLaunchProfile("statusCallbackBaseUrl", event.target.value)}
                placeholder={twilioSupabaseRelayUrls.baseUrl}
              />
            </label>
            <label>
              Relay health check URL
              <input
                type="url"
                value={twilioLaunchProfile.relayHealthCheckUrl}
                onChange={(event) => updateTwilioLaunchProfile("relayHealthCheckUrl", event.target.value)}
                placeholder={twilioSupabaseRelayUrls.healthUrl}
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
              disabled={isTwilioRelayHealthChecking}
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
              <button type="button" className="operations-action secondary" onClick={() => void syncSmsConsentEvidenceToRelay()} disabled={isSmsConsentSyncing}>
                <Server size={18} /> {isSmsConsentSyncing ? "Syncing Consent..." : "Sync Consent to Relay"}
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
              placeholder={twilioSupabaseRelayUrls.sendUrl}
            />
          </label>
          <button type="button" className="operations-action secondary" onClick={() => updateTwilioRelayEndpoint(twilioSupabaseRelayUrls.sendUrl)}>
            <Server size={18} /> Use Supabase Twilio Relay
          </button>
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
          <h2>Compose</h2>
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
          <button type="button" className="operations-action secondary" onClick={() => void sendMarketingViaTwilio()} disabled={!twilioComposeCanLiveSend}>
            <Server size={18} /> {isTwilioRelaySending || isSmsConsentSyncing ? "Sending via Twilio..." : "Send via Twilio"}
          </button>
          <p className="operations-note">Live sends use the Supabase Twilio relay, synced consent evidence, approved sender compliance, and relay health checks before Twilio is called.</p>
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

function OperationsLandingRedirect() {
  const { accountRole, managerAccountAccess, session } = useAppState();

  if (accountRole === "student") {
    const studentProfile = readStudentProfile(session?.email);
    const landingPage = landingPageValueOrDefault(studentProfile.landingPage, studentLandingPageOptions, "profile");
    return <Navigate to={studentLandingPath(landingPage)} replace />;
  }

  if (accountRole === "guardian") {
    const parentProfile = readGuardianProfile(session?.email);
    const landingPage = landingPageValueOrDefault(parentProfile.landingPage, parentLandingPageOptions, "profile");
    return <Navigate to={parentLandingPath(landingPage)} replace />;
  }

  const panelLabel = managerAccountAccess.isDeveloper ? "Developer Panel" : managerAccountAccess.isManagerOwner ? "Manager's Panel" : "Staff Panel";
  const landingOptions = staffLandingPageOptions(managerAccountAccess.allowedTools, panelLabel);
  const staffProfile = managerAccountAccess.isManagerOwner ? readManagerProfile(session?.email) : readStaffProfile(session?.email);
  const landingPage = landingPageValueOrDefault(staffProfile.landingPage, landingOptions, "live-chat");
  return <Navigate to={staffLandingPath(landingPage)} replace />;
}

function StaffOnlyRoute({ children }: { children: ReactNode }) {
  const { accountRole } = useAppState();
  return accountRole === "staff" ? <>{children}</> : <Navigate to="/profile" replace />;
}

function StaffOrStudentRoute({ children }: { children: ReactNode }) {
  const { accountRole } = useAppState();
  return accountRole === "staff" || accountRole === "student" ? <>{children}</> : <Navigate to="/profile" replace />;
}

function ManagerPanelRoute() {
  const { accountRole } = useAppState();
  if (accountRole === "guardian") return <Navigate to="/profile" replace />;
  return <ManagerLauncherPage />;
}

export function OperationsApp() {
  return (
    <OperationsShell>
      <Routes>
        <Route path="/" element={<OperationsLandingRedirect />} />
        <Route path="/profile" element={<OperationsHomePage />} />
        <Route path="/manager" element={<ManagerPanelRoute />} />
        <Route path="/dashboard" element={<StaffOnlyRoute><DashboardPage /></StaffOnlyRoute>} />
        <Route path="/students" element={<StaffOnlyRoute><StudentsPage /></StaffOnlyRoute>} />
        <Route path="/classes" element={<StaffOnlyRoute><ClassesPage /></StaffOnlyRoute>} />
        <Route path="/study-guide" element={<StaffOnlyRoute><ManagerStudyGuidePage /></StaffOnlyRoute>} />
        <Route path="/schedule" element={<StaffOnlyRoute><SchedulePage /></StaffOnlyRoute>} />
        <Route path="/live-chat" element={<StaffOnlyRoute><LiveChatPage /></StaffOnlyRoute>} />
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
