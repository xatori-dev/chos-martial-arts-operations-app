import { dataUrlMimeType, isSafeStudyMaterialFile, isSafeTrainingVideoFile } from "./contentSafety";
import { roundCurrency, TAX_RATE } from "./utils";
import type {
  AccountRole,
  BookingDetails,
  ChildAccount,
  ClassWeekday,
  ContactSubmission,
  DirectMessage,
  LeadReview,
  ManagerAccessKey,
  ManagedAccount,
  MerchandiseItem,
  MessageCampaign,
  MessageLog,
  Order,
  ScheduledClass,
  ScheduledTextCampaign,
  StudentCheckIn,
  StudentRecord,
  StudioClass,
  StudioEvent,
  StudyGuideFolder,
  StudyGuideMaterial,
  TextAutomationRun,
  TextAutomationRunKey,
  TrainingVideo,
  TrainingVideoFolder
} from "./types";

type BackupArray<T = unknown> = readonly T[];
type ManagedAccountBackup = Omit<ManagedAccount, "password">;
type ChildAccountBackup = Omit<ChildAccount, "password"> & {
  hasSavedPassword?: boolean;
};
type TwilioComplianceSenderType = "not-set" | "10dlc" | "toll-free" | "short-code";
type TwilioComplianceStatus = "not-started" | "pending" | "approved" | "rejected" | "not-used";

export type ProductionMessagingSetupBackup = {
  id: "production-messaging";
  twilioRelayEndpoint?: string;
  pushServerEndpoint?: string;
  webPushPublicKey?: string;
  twilioLaunchProfile?: {
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
};

export type OperationsBackupInput = {
  accounts: BackupArray;
  accountRoles: BackupArray;
  managedAccounts: BackupArray<ManagedAccount>;
  childAccounts: BackupArray<ChildAccount>;
  students: BackupArray<StudentRecord>;
  studioClasses: BackupArray<StudioClass>;
  scheduledClasses: BackupArray<ScheduledClass>;
  messageCampaigns: BackupArray<MessageCampaign>;
  scheduledTextCampaigns: BackupArray<ScheduledTextCampaign>;
  messageLogs: BackupArray<MessageLog>;
  automationRuns: BackupArray<TextAutomationRun>;
  directMessages: BackupArray<DirectMessage>;
  messagingSetup: BackupArray<ProductionMessagingSetupBackup>;
  studioEvents: BackupArray<StudioEvent>;
  merchandiseItems: BackupArray<MerchandiseItem>;
  checkIns: BackupArray<StudentCheckIn>;
  trainingVideoFolders: BackupArray<TrainingVideoFolder>;
  trainingVideos: BackupArray<TrainingVideo>;
  studyGuideFolders: BackupArray<StudyGuideFolder>;
  studyGuideMaterials: BackupArray<StudyGuideMaterial>;
  orders: BackupArray<Order>;
  bookings: BackupArray<BookingDetails>;
  contacts: BackupArray<ContactSubmission>;
  leadReviews: BackupArray<LeadReview>;
};

export type OperationsBackupSection = {
  id: keyof OperationsBackupInput;
  label: string;
  shortLabel: string;
  storageKey: string;
  count: number;
};

export type OperationsBackupData = Omit<OperationsBackupInput, "managedAccounts" | "childAccounts"> & {
  managedAccounts: BackupArray<ManagedAccountBackup>;
  childAccounts: BackupArray<ChildAccountBackup>;
};

export type OperationsRestoreSnapshot = Pick<OperationsBackupSnapshot, "schemaVersion" | "exportedAt" | "summary" | "sections"> & {
  data: OperationsBackupData;
};

export type OperationsBackupSnapshot = {
  schemaVersion: "chos-operations-backup.v1";
  exportedAt: string;
  summary: {
    sections: number;
    totalRecords: number;
    emptySections: number;
  };
  sections: OperationsBackupSection[];
  data: OperationsBackupData;
};

const backupSections: Omit<OperationsBackupSection, "count">[] = [
  { id: "students", label: "Students", shortLabel: "students", storageKey: "chos.operations.students.v1" },
  { id: "managedAccounts", label: "Managed Accounts", shortLabel: "managed accounts", storageKey: "chos.managedAccounts.v1" },
  { id: "childAccounts", label: "Child Accounts", shortLabel: "child accounts", storageKey: "chos.childAccounts.v1" },
  { id: "accountRoles", label: "Account Roles", shortLabel: "account roles", storageKey: "chos.accountRoles.v1" },
  { id: "accounts", label: "Registered Accounts", shortLabel: "registered accounts", storageKey: "chos.accounts.v1" },
  { id: "studioClasses", label: "Class Templates", shortLabel: "class templates", storageKey: "chos.operations.classes.v1" },
  { id: "scheduledClasses", label: "Scheduled Classes", shortLabel: "scheduled classes", storageKey: "chos.operations.schedule.v1" },
  { id: "studioEvents", label: "Studio Events", shortLabel: "events", storageKey: "chos.operations.events.v1" },
  { id: "messageCampaigns", label: "Message Campaigns", shortLabel: "campaigns", storageKey: "chos.operations.campaigns.v1" },
  { id: "scheduledTextCampaigns", label: "Scheduled Promotions", shortLabel: "scheduled promotions", storageKey: "chos.operations.scheduledCampaigns.v1" },
  { id: "messageLogs", label: "Text Logs", shortLabel: "text logs", storageKey: "chos.operations.messages.v1" },
  { id: "automationRuns", label: "Text Automation Runs", shortLabel: "automation runs", storageKey: "chos.operations.automationRuns.v1" },
  { id: "directMessages", label: "Direct Messages", shortLabel: "direct messages", storageKey: "chos.operations.directMessages.v1" },
  { id: "messagingSetup", label: "Production Messaging Setup", shortLabel: "messaging setup", storageKey: "chos.operations.messagingSetup.v1" },
  { id: "merchandiseItems", label: "Merchandise", shortLabel: "merchandise items", storageKey: "chos.operations.merchandise.v1" },
  { id: "checkIns", label: "Check-ins", shortLabel: "check-ins", storageKey: "chos.operations.checkins.v1" },
  { id: "trainingVideoFolders", label: "Video Folders", shortLabel: "video folders", storageKey: "chos.operations.videoFolders.v1" },
  { id: "trainingVideos", label: "Training Videos", shortLabel: "training videos", storageKey: "chos.operations.videos.v1" },
  { id: "studyGuideFolders", label: "Study Guide Folders", shortLabel: "study guide folders", storageKey: "chos.operations.studyGuideFolders.v1" },
  { id: "studyGuideMaterials", label: "Study Guide Materials", shortLabel: "study guide materials", storageKey: "chos.operations.studyGuideMaterials.v1" },
  { id: "orders", label: "Orders", shortLabel: "orders", storageKey: "chos.orders.v1" },
  { id: "bookings", label: "Bookings", shortLabel: "bookings", storageKey: "chos.bookings.v1" },
  { id: "contacts", label: "Contacts", shortLabel: "contacts", storageKey: "chos.contacts.v1" },
  { id: "leadReviews", label: "Lead Reviews", shortLabel: "lead reviews", storageKey: "chos.operations.leadReviews.v1" }
];

const optionalRestoreSectionIds = new Set<keyof OperationsBackupInput>(["leadReviews", "scheduledTextCampaigns", "messagingSetup", "automationRuns"]);

const idBackedBackupSectionIds = new Set<keyof OperationsBackupInput>([
  "managedAccounts",
  "childAccounts",
  "students",
  "studioClasses",
  "scheduledClasses",
  "messageCampaigns",
  "scheduledTextCampaigns",
  "messageLogs",
  "automationRuns",
  "directMessages",
  "messagingSetup",
  "studioEvents",
  "merchandiseItems",
  "checkIns",
  "trainingVideoFolders",
  "trainingVideos",
  "studyGuideFolders",
  "studyGuideMaterials",
  "orders",
  "contacts",
  "leadReviews"
]);

const usernameBackedBackupSectionIds = new Set<keyof OperationsBackupInput>([
  "managedAccounts",
  "childAccounts"
]);

const requiredAccountStringFields = ["email", "createdAt"] as const;
const requiredChildProfileStringFields = ["name", "beltSlug", "createdAt"] as const;
const requiredManagedAccountIdentityStringFields = ["displayName", "createdAt"] as const;
const requiredMerchandiseStringFields = ["name", "category", "description", "imageLabel"] as const;
const requiredMerchandiseNumberFields = ["price", "stock"] as const;
const optionalMerchandiseNumberFields = ["reorderPoint", "targetStock"] as const;
const optionalMerchandiseStringFields = ["lastRestockedAt", "imageDataUrl"] as const;
const requiredScheduledClassStringFields = ["title", "date", "time", "type"] as const;
const optionalScheduledClassStringFields = ["studentId", "titleColor", "notes"] as const;
const requiredStudioClassStringFields = ["name", "startTime", "endTime"] as const;
const requiredStudentStringFields = ["firstName", "lastName", "phone", "email", "beltRank", "joinedAt"] as const;
const requiredStudentAttendanceFields = ["classesAttended", "missedClassCount"] as const;
const optionalStudentStringFields = [
  "dateOfBirth",
  "gender",
  "profileImagePath",
  "guardianName",
  "guardianPhone",
  "guardianEmail",
  "studentSmsOptOutAt",
  "guardianSmsOptOutAt",
  "studentSmsConsentUpdatedAt",
  "guardianSmsConsentUpdatedAt",
  "smsConsentUpdatedAt",
  "emergencyContactName",
  "emergencyContactRelationship",
  "emergencyContactPhone",
  "emergencyContactEmail",
  "enrollmentDate",
  "program",
  "status",
  "lastCheckIn",
  "lastContactedAt",
  "notes"
] as const;
const requiredStudioEventStringFields = ["title", "date", "time"] as const;
const requiredMessageLogStringFields = ["recipientName", "recipientPhone", "body", "createdAt"] as const;
const requiredMessageCampaignStringFields = ["title", "body", "createdAt"] as const;
const requiredScheduledTextCampaignStringFields = ["title", "body", "scheduledFor", "createdAt"] as const;
const optionalScheduledTextCampaignStringFields = ["scheduledTime", "queuedAt", "campaignId"] as const;
const optionalMessageLogStringFields = ["sentAt", "campaignId"] as const;
const requiredDirectMessageStringFields = ["threadId", "senderId", "senderName", "recipientId", "recipientName", "body", "createdAt"] as const;
const requiredCheckInStringFields = ["studentId", "studentName", "date", "beltRank"] as const;
const requiredCustomerStringFields = ["firstName", "lastName", "email", "phone", "address", "city", "state", "zip"] as const;
const requiredOrderStringFields = ["orderNumber", "createdAt", "notes", "pickupOption", "status"] as const;
const requiredOrderNumberFields = ["subtotal", "discount", "tax", "total"] as const;
const requiredCartItemStringFields = ["id", "productSlug", "name", "displayPrice"] as const;
const requiredContactStringFields = ["name", "message", "createdAt"] as const;
const optionalContactStringFields = ["email", "phone"] as const;
const requiredLeadReviewStringFields = ["leadId", "label", "reviewedAt"] as const;
const requiredTrainingVideoFolderStringFields = ["name", "subject", "createdAt"] as const;
const requiredTrainingVideoStringFields = ["folderId", "title", "fileName", "mimeType", "createdAt"] as const;
const optionalTrainingVideoFolderStringFields = ["description"] as const;
const optionalTrainingVideoStringFields = ["description"] as const;
const requiredStudyGuideFolderStringFields = ["name", "subject", "createdAt"] as const;
const requiredStudyGuideMaterialStringFields = ["folderId", "title", "fileName", "mimeType", "createdAt"] as const;
const optionalStudyGuideFolderStringFields = ["parentId", "description"] as const;
const optionalStudyGuideMaterialStringFields = ["description"] as const;
const optionalMessagingSetupStringFields = ["twilioRelayEndpoint", "pushServerEndpoint", "webPushPublicKey"] as const;
const requiredTwilioLaunchProfileStringFields = ["messagingServiceSid", "smsSender", "inboundWebhookUrl", "statusCallbackBaseUrl", "relayHealthCheckUrl", "complianceNotes"] as const;
const optionalTwilioLaunchProfileStringFields = ["savedAt"] as const;

type BackupCartItemRecord = Record<(typeof requiredCartItemStringFields)[number], string> & {
  quantity: number;
  unitPrice: number;
};
const supportedAccountRoles = new Set<AccountRole>(["guardian", "student", "staff"]);
const supportedManagedAccountRoles = new Set<ManagedAccount["role"]>(["staff", "student"]);
const supportedManagedAccountStatuses = new Set<ManagedAccount["status"]>(["active", "inactive"]);
const supportedMessageLogKinds = new Set<MessageLog["kind"]>(["welcome", "reminder", "follow-up", "marketing", "celebration", "profile-update"]);
const supportedMessageLogStatuses = new Set<MessageLog["status"]>(["queued", "sent", "failed"]);
const supportedMessageCampaignAudiences = new Set<MessageCampaign["audience"]>(["all-students", "parents", "staff", "everyone", "missed-classes", "new-students"]);
const supportedScheduledTextCampaignStatuses = new Set<ScheduledTextCampaign["status"]>(["scheduled", "queued", "canceled"]);
const supportedStudioEventAudiences = new Set<StudioEvent["audience"]>(["students", "families", "public"]);
const supportedLeadReviewKinds = new Set<LeadReview["kind"]>(["booking", "contact"]);
const supportedTextAutomationRunStatuses = new Set<TextAutomationRun["status"]>(["queued", "no-due-texts"]);
const supportedTextAutomationRunKeys = new Set<TextAutomationRunKey>([
  "missedClassFollowUps",
  "attendanceGapCheckIns",
  "trialConversionFollowUps",
  "newStudentCheckIns",
  "pausedStudentReactivationFollowUps",
  "celebrationOutreach",
  "profileUpdateRequests",
  "classReminders",
  "milestoneEncouragements",
  "beltTestInvites",
  "eventReminders",
  "scheduledPromotions"
]);
const supportedTwilioManagerAuthModes = new Set<NonNullable<ProductionMessagingSetupBackup["twilioLaunchProfile"]>["managerAuthMode"]>(["same-site-cookie", "server-session", "oauth-proxy"]);
const supportedTwilioComplianceSenderTypes = new Set<TwilioComplianceSenderType>(["not-set", "10dlc", "toll-free", "short-code"]);
const supportedTwilioComplianceStatuses = new Set<TwilioComplianceStatus>(["not-started", "pending", "approved", "rejected", "not-used"]);
const supportedClassWeekdays = new Set<ClassWeekday>([0, 1, 2, 3, 4, 5, 6]);
const builtInLoginIdentities = new Set(["manager123@chos.prototype", "dev123@chos.prototype", "student123@chos.prototype", "parent123@chos.prototype", "guest@chos.prototype"]);
const builtInGuardianLoginIdentities = new Set(["parent123@chos.prototype"]);
const builtInLoginUsernames = new Set(["manager123", "dev123", "student123", "parent123"]);
const allowedMerchandiseImageMimeTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const productionMessagingSetupId = "production-messaging";
const messagingSetupCredentialFieldPattern = /(?:TWILIO_|AUTH_TOKEN|ACCOUNT_SID|API_KEY|API_SECRET|SECRET|PASSWORD|PRIVATE_KEY|CREDENTIAL|VAPID_PRIVATE_KEY)/i;
const rawPushSubscriptionFieldPattern = /^(?:pushSubscriptionJson|pushSubscriptionEndpoint|subscription|subscriptionEndpoint|endpoint|keys|p256dh|auth)$/i;
const supportedManagerAccessKeys = new Set<ManagerAccessKey>([
  "dashboard",
  "messages",
  "students",
  "classes",
  "studyGuide",
  "events",
  "scheduling",
  "merchandise",
  "videos",
  "reports",
  "create"
]);
const builtInLoginRoles = new Map<string, AccountRole>([
  ["manager123@chos.prototype", "staff"],
  ["dev123@chos.prototype", "staff"],
  ["student123@chos.prototype", "student"],
  ["parent123@chos.prototype", "guardian"],
  ["guest@chos.prototype", "staff"]
]);

function sanitizeScheduledClassForBackup(scheduledClass: ScheduledClass, activeStudentIds: Set<string>) {
  const id = typeof scheduledClass.id === "string" ? scheduledClass.id.trim() : "";
  const title = typeof scheduledClass.title === "string" ? scheduledClass.title.trim() : "";
  const date = typeof scheduledClass.date === "string" ? scheduledClass.date.trim() : "";
  const time = typeof scheduledClass.time === "string" ? scheduledClass.time.trim() : "";
  const type = typeof scheduledClass.type === "string" ? scheduledClass.type.trim() : "";
  if (!id || !title || !date || !time || !type) return undefined;

  const { titleColor: _titleColor, notes: _notes, recurring: _recurring, studentId: _studentId, ...baseClass } = scheduledClass;
  const recurring = (scheduledClass as { recurring?: unknown }).recurring;
  const studentId = typeof scheduledClass.studentId === "string" ? scheduledClass.studentId.trim() : "";
  const titleColor = typeof scheduledClass.titleColor === "string" ? scheduledClass.titleColor.trim() : "";
  const notes = typeof scheduledClass.notes === "string" ? scheduledClass.notes.trim() : "";
  return {
    ...baseClass,
    id,
    title,
    date,
    time,
    type,
    ...(typeof recurring === "boolean" ? { recurring } : recurring === undefined ? {} : { recurring: true }),
    ...(studentId && activeStudentIds.has(studentId) ? { studentId } : {}),
    ...(titleColor ? { titleColor } : {}),
    ...(notes ? { notes } : {})
  };
}

function sanitizeScheduledClassesForBackup(scheduledClasses: readonly ScheduledClass[], activeStudentIds: Set<string>) {
  const seenScheduleIds = new Set<string>();
  return scheduledClasses.flatMap((scheduledClass) => {
    const sanitizedClass = sanitizeScheduledClassForBackup(scheduledClass, activeStudentIds);
    if (!sanitizedClass || seenScheduleIds.has(sanitizedClass.id)) return [];
    seenScheduleIds.add(sanitizedClass.id);
    return [sanitizedClass];
  });
}

function sanitizeStudioClassForBackup(studioClass: StudioClass) {
  const id = typeof studioClass.id === "string" ? studioClass.id.trim() : "";
  const name = typeof studioClass.name === "string" ? studioClass.name.trim() : "";
  const startTime = typeof studioClass.startTime === "string" ? studioClass.startTime.trim() : "";
  const endTime = typeof studioClass.endTime === "string" ? studioClass.endTime.trim() : "";
  const daysOfWeek = Array.isArray(studioClass.daysOfWeek)
    ? [...new Set(studioClass.daysOfWeek.filter((weekday): weekday is ClassWeekday => Number.isInteger(weekday) && supportedClassWeekdays.has(weekday as ClassWeekday)))].sort((left, right) => left - right)
    : [];
  if (!id || !name || !daysOfWeek.length || !startTime || !endTime || startTime >= endTime) return undefined;

  const { titleColor: _titleColor, notes: _notes, recurring: _recurring, ...baseClass } = studioClass;
  const titleColor = typeof studioClass.titleColor === "string" ? studioClass.titleColor.trim() : "";
  const notes = typeof studioClass.notes === "string" ? studioClass.notes.trim() : "";
  return {
    ...baseClass,
    id,
    name,
    daysOfWeek,
    startTime,
    endTime,
    recurring: typeof studioClass.recurring === "boolean" ? studioClass.recurring : true,
    ...(titleColor ? { titleColor } : {}),
    ...(notes ? { notes } : {})
  };
}

function sanitizeStudioClassesForBackup(studioClasses: readonly StudioClass[]) {
  const seenClassIds = new Set<string>();
  return studioClasses.flatMap((studioClass) => {
    const sanitizedClass = sanitizeStudioClassForBackup(studioClass);
    if (!sanitizedClass || seenClassIds.has(sanitizedClass.id)) return [];
    seenClassIds.add(sanitizedClass.id);
    return [sanitizedClass];
  });
}

function sanitizeStudentForBackup(student: StudentRecord) {
  const id = typeof student.id === "string" ? student.id.trim() : "";
  const requiredFields = requiredStudentStringFields.reduce<Record<(typeof requiredStudentStringFields)[number], string>>(
    (cleanFields, field) => ({ ...cleanFields, [field]: typeof student[field] === "string" ? student[field].trim() : "" }),
    {} as Record<(typeof requiredStudentStringFields)[number], string>
  );
  if (!id || requiredStudentStringFields.some((field) => !requiredFields[field])) return undefined;

  const sanitizedStudent: StudentRecord = {
    ...student,
    id,
    ...requiredFields,
    classesAttended: cleanBackupNonnegativeInteger(student.classesAttended, 0),
    missedClassCount: cleanBackupNonnegativeInteger(student.missedClassCount, 0)
  };
  optionalStudentStringFields.forEach((field) => {
    const value = student[field];
    if (typeof value !== "string") return;
    const trimmedValue = value.trim();
    if (trimmedValue) {
      sanitizedStudent[field] = trimmedValue;
    } else {
      delete sanitizedStudent[field];
    }
  });
  return sanitizedStudent;
}

function sanitizeStudentsForBackup(students: readonly StudentRecord[]) {
  const seenStudentIds = new Set<string>();
  return students.flatMap((student) => {
    const sanitizedStudent = sanitizeStudentForBackup(student);
    if (!sanitizedStudent || seenStudentIds.has(sanitizedStudent.id)) return [];
    seenStudentIds.add(sanitizedStudent.id);
    return [sanitizedStudent];
  });
}

function sanitizeManagedAccountForBackup(account: ManagedAccount, studentIds: Set<string>, activeStudentIds: Set<string>): ManagedAccountBackup {
  const { password: _password, ...safeAccount } = account;
  const username = safeAccount.username.trim();
  const studentId = safeAccount.studentId?.trim();
  const hasRestoredStudent = Boolean(studentId && studentIds.has(studentId));
  const hasActiveStudent = Boolean(studentId && activeStudentIds.has(studentId));
  const linkedAccount: ManagedAccountBackup = hasRestoredStudent
    ? (studentId === safeAccount.studentId ? { ...safeAccount, username } : { ...safeAccount, username, studentId })
    : (() => {
        const { studentId: _studentId, ...unlinkedAccount } = safeAccount;
        return { ...unlinkedAccount, username };
      })();

  const accountWithSafeAccess: ManagedAccountBackup =
    linkedAccount.role === "student" && linkedAccount.access.length ? { ...linkedAccount, access: [] } : linkedAccount;

  if (accountWithSafeAccess.role !== "student" || accountWithSafeAccess.status !== "active") return accountWithSafeAccess;
  return hasActiveStudent ? accountWithSafeAccess : { ...accountWithSafeAccess, status: "inactive" };
}

function sanitizeManagedAccountsForBackup(accounts: readonly ManagedAccount[], studentIds: Set<string>, activeStudentIds: Set<string>) {
  const seenUsernames = new Set<string>();
  return accounts.flatMap((account) => {
    const username = account.username.trim();
    const normalizedUsername = username.toLowerCase();
    if (!username || builtInLoginUsernames.has(normalizedUsername) || seenUsernames.has(normalizedUsername)) return [];
    seenUsernames.add(normalizedUsername);
    return [sanitizeManagedAccountForBackup(account, studentIds, activeStudentIds)];
  });
}

function sanitizeDirectMessageForBackup(message: DirectMessage, activeStudentIds: Set<string>) {
  const id = cleanBackupString(message.id);
  const senderId = cleanBackupString(message.senderId);
  const recipientId = cleanBackupString(message.recipientId);
  const body = cleanBackupString(message.body);
  const createdAt = cleanBackupString(message.createdAt);
  const status = (message as { status?: unknown }).status;
  if (
    !id ||
    !senderId ||
    !recipientId ||
    senderId === recipientId ||
    !body ||
    !createdAt ||
    status !== "sent" ||
    !isRestoredDirectMessageParticipantAvailable(senderId, activeStudentIds) ||
    !isRestoredDirectMessageParticipantAvailable(recipientId, activeStudentIds)
  ) {
    return undefined;
  }

  return {
    ...message,
    id,
    threadId: [senderId, recipientId].sort().join("__"),
    senderId,
    senderName: cleanBackupString(message.senderName) || "Cho's User",
    recipientId,
    recipientName: cleanBackupString(message.recipientName) || "Cho's User",
    body,
    createdAt,
    status: "sent" as const
  };
}

function sanitizeDirectMessagesForBackup(messages: readonly DirectMessage[], activeStudentIds: Set<string>) {
  const seenMessageIds = new Set<string>();
  return messages.flatMap((message) => {
    const sanitizedMessage = sanitizeDirectMessageForBackup(message, activeStudentIds);
    if (!sanitizedMessage || seenMessageIds.has(sanitizedMessage.id)) return [];
    seenMessageIds.add(sanitizedMessage.id);
    return [sanitizedMessage];
  });
}

function sanitizeMessageLogForBackup(messageLog: MessageLog, campaignIds: Set<string>, students: readonly StudentRecord[], managedAccounts: readonly ManagedAccount[]) {
  const id = cleanBackupString(messageLog.id);
  const kind = cleanBackupString(messageLog.kind);
  const recipientName = cleanBackupString(messageLog.recipientName);
  const recipientPhone = cleanBackupString(messageLog.recipientPhone);
  const body = cleanBackupString(messageLog.body);
  const status = cleanBackupString(messageLog.status);
  const createdAt = cleanBackupString(messageLog.createdAt);
  if (
    !id ||
    !supportedMessageLogKinds.has(kind as MessageLog["kind"]) ||
    !recipientName ||
    !recipientPhone ||
    !body ||
    !supportedMessageLogStatuses.has(status as MessageLog["status"]) ||
    !createdAt
  ) {
    return undefined;
  }

  const { campaignId: _campaignId, sentAt: _sentAt, ...baseLog } = messageLog;
  const campaignId = cleanBackupString(messageLog.campaignId);
  const sentAt = cleanBackupString(messageLog.sentAt);
  const sanitizedLog: MessageLog = {
    ...baseLog,
    id,
    kind: kind as MessageLog["kind"],
    recipientName,
    recipientPhone,
    body,
    status: status as MessageLog["status"],
    createdAt,
    ...(sentAt ? { sentAt } : {}),
    ...(campaignId && campaignIds.has(campaignId) ? { campaignId } : {})
  };
  if (sanitizedLog.status === "queued" && !isRestoredQueuedMessageDeliverable(sanitizedLog, students, managedAccounts)) return undefined;
  return sanitizedLog;
}

function sanitizeMessageLogsForBackup(messageLogs: readonly MessageLog[], campaignIds: Set<string>, students: readonly StudentRecord[], managedAccounts: readonly ManagedAccount[]) {
  const seenMessageLogIds = new Set<string>();
  return messageLogs.flatMap((messageLog) => {
    const sanitizedLog = sanitizeMessageLogForBackup(messageLog, campaignIds, students, managedAccounts);
    if (!sanitizedLog || seenMessageLogIds.has(sanitizedLog.id)) return [];
    seenMessageLogIds.add(sanitizedLog.id);
    return [sanitizedLog];
  });
}

function sanitizeMessageCampaignForBackup(campaign: MessageCampaign) {
  const id = cleanBackupString(campaign.id);
  const title = cleanBackupString(campaign.title);
  const body = cleanBackupString(campaign.body);
  const audience = cleanBackupString(campaign.audience);
  const createdAt = cleanBackupString(campaign.createdAt);
  if (!id || !title || !body || !supportedMessageCampaignAudiences.has(audience as MessageCampaign["audience"]) || !createdAt) return undefined;
  return {
    ...campaign,
    id,
    title,
    body,
    audience: audience as MessageCampaign["audience"],
    createdAt
  };
}

function sanitizeMessageCampaignsForBackup(campaigns: readonly MessageCampaign[]) {
  const seenCampaignIds = new Set<string>();
  return campaigns.flatMap((campaign) => {
    const sanitizedCampaign = sanitizeMessageCampaignForBackup(campaign);
    if (!sanitizedCampaign || seenCampaignIds.has(sanitizedCampaign.id)) return [];
    seenCampaignIds.add(sanitizedCampaign.id);
    return [sanitizedCampaign];
  });
}

function sanitizeScheduledTextCampaignForBackup(campaign: ScheduledTextCampaign, messageCampaignIds: Set<string>) {
  const id = cleanBackupString(campaign.id);
  const title = cleanBackupString(campaign.title);
  const body = cleanBackupString(campaign.body);
  const audience = cleanBackupString(campaign.audience);
  const scheduledFor = cleanBackupString(campaign.scheduledFor);
  const status = cleanBackupString(campaign.status);
  const createdAt = cleanBackupString(campaign.createdAt);
  if (
    !id ||
    !title ||
    !body ||
    !supportedMessageCampaignAudiences.has(audience as MessageCampaign["audience"]) ||
    !scheduledFor ||
    !supportedScheduledTextCampaignStatuses.has(status as ScheduledTextCampaign["status"]) ||
    !createdAt
  ) {
    return undefined;
  }
  const queuedAt = cleanBackupString(campaign.queuedAt);
  const campaignId = cleanBackupString(campaign.campaignId);
  const scheduledTime = cleanBackupString(campaign.scheduledTime);
  if (scheduledTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) return undefined;
  return {
    ...campaign,
    id,
    title,
    body,
    audience: audience as MessageCampaign["audience"],
    scheduledFor,
    ...(scheduledTime ? { scheduledTime } : {}),
    status: status as ScheduledTextCampaign["status"],
    createdAt,
    ...(queuedAt ? { queuedAt } : {}),
    ...(campaignId && messageCampaignIds.has(campaignId) ? { campaignId } : {})
  };
}

function sanitizeScheduledTextCampaignsForBackup(campaigns: readonly ScheduledTextCampaign[], messageCampaignIds: Set<string>) {
  const seenCampaignIds = new Set<string>();
  return campaigns.flatMap((campaign) => {
    const sanitizedCampaign = sanitizeScheduledTextCampaignForBackup(campaign, messageCampaignIds);
    if (!sanitizedCampaign || seenCampaignIds.has(sanitizedCampaign.id)) return [];
    seenCampaignIds.add(sanitizedCampaign.id);
    return [sanitizedCampaign];
  });
}

function sanitizeTextAutomationRunBreakdown(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seenKeys = new Set<TextAutomationRunKey>();
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const key = cleanBackupString(entry.key) as TextAutomationRunKey;
    const label = cleanBackupString(entry.label);
    const queued = cleanBackupNonnegativeInteger(entry.queued, 0);
    if (!supportedTextAutomationRunKeys.has(key) || !label || seenKeys.has(key)) return [];
    seenKeys.add(key);
    return [{ key, label, queued }];
  });
}

function sanitizeTextAutomationRunForBackup(run: TextAutomationRun) {
  const id = cleanBackupString(run.id);
  const ranAt = cleanBackupString(run.ranAt);
  const status = cleanBackupString(run.status) as TextAutomationRun["status"];
  if (!id || !ranAt || !supportedTextAutomationRunStatuses.has(status)) return undefined;
  const breakdown = sanitizeTextAutomationRunBreakdown(run.breakdown);
  const totalQueued = cleanBackupNonnegativeInteger(run.totalQueued, 0);
  return {
    id,
    ranAt,
    status,
    totalQueued,
    deliveryProvider: "twilio" as const,
    deliveryChannel: "sms" as const,
    deliveryMode: "prototype" as const,
    relayPayloadSchemaVersion: "chos-twilio-relay.v1" as const,
    breakdown
  };
}

function sanitizeTextAutomationRunsForBackup(runs: readonly TextAutomationRun[]) {
  const seenRunIds = new Set<string>();
  return runs.flatMap((run) => {
    const sanitizedRun = sanitizeTextAutomationRunForBackup(run);
    if (!sanitizedRun || seenRunIds.has(sanitizedRun.id)) return [];
    seenRunIds.add(sanitizedRun.id);
    return [sanitizedRun];
  });
}

function cleanBackupNonnegativeInteger(value: unknown, fallback: number) {
  const numericValue = typeof value === "number" ? value : (typeof value === "string" && value.trim() ? Number(value.trim()) : Number.NaN);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.floor(numericValue));
}

function cleanBackupNonnegativeNumber(value: unknown) {
  const numericValue = typeof value === "number" ? value : (typeof value === "string" && value.trim() ? Number(value.trim()) : Number.NaN);
  if (!Number.isFinite(numericValue) || numericValue < 0) return undefined;
  return numericValue;
}

function cleanBackupPositiveInteger(value: unknown, fallback: number) {
  const numericValue = typeof value === "number" ? value : (typeof value === "string" && value.trim() ? Number(value.trim()) : Number.NaN);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(1, Math.floor(numericValue));
}

function isSafeMerchandiseImageDataUrl(value: string) {
  const mimeType = dataUrlMimeType(value);
  return Boolean(value.startsWith("data:image/") && mimeType && allowedMerchandiseImageMimeTypes.has(mimeType));
}

function sanitizeMerchandiseItemForBackup(item: MerchandiseItem) {
  const id = cleanBackupString(item.id);
  const name = cleanBackupString(item.name);
  const category = cleanBackupString(item.category);
  const description = cleanBackupString(item.description);
  const imageLabel = cleanBackupString(item.imageLabel);
  const price = cleanBackupNonnegativeNumber(item.price);
  const stockValue = cleanBackupNonnegativeNumber(item.stock);
  const stock = stockValue === undefined ? undefined : Math.floor(stockValue);
  if (!id || !name || !category || !description || !imageLabel || price === undefined || stock === undefined) return undefined;

  const reorderPoint = cleanBackupNonnegativeInteger(item.reorderPoint, 3);
  const targetStock = Math.max(cleanBackupNonnegativeInteger(item.targetStock, 8), reorderPoint + 1);
  const imageDataUrl = cleanBackupString(item.imageDataUrl);
  const lastRestockedAt = cleanBackupString(item.lastRestockedAt);
  const { imageDataUrl: _imageDataUrl, lastRestockedAt: _lastRestockedAt, ...baseItem } = item;
  return {
    ...baseItem,
    id,
    name,
    category,
    price: roundCurrency(price),
    stock,
    reorderPoint,
    targetStock,
    description,
    imageLabel,
    ...(lastRestockedAt ? { lastRestockedAt } : {}),
    ...(imageDataUrl && isSafeMerchandiseImageDataUrl(imageDataUrl) ? { imageDataUrl } : {})
  };
}

function sanitizeMerchandiseItemsForBackup(items: readonly MerchandiseItem[]) {
  const seenItemIds = new Set<string>();
  return items.flatMap((item) => {
    const sanitizedItem = sanitizeMerchandiseItemForBackup(item);
    if (!sanitizedItem || seenItemIds.has(sanitizedItem.id)) return [];
    seenItemIds.add(sanitizedItem.id);
    return [sanitizedItem];
  });
}

function sanitizeBookingForBackup(booking: BookingDetails) {
  const date = booking.date.trim();
  const time = booking.time.trim();
  if (!date || !time) return undefined;
  return {
    ...booking,
    persons: cleanBackupPositiveInteger(booking.persons, 1),
    date,
    time,
    timezone: "America/Chicago" as const
  };
}

function sanitizeContactForBackup(contact: ContactSubmission) {
  const id = typeof contact.id === "string" ? contact.id.trim() : "";
  const name = typeof contact.name === "string" ? contact.name.trim() : "";
  const email = typeof contact.email === "string" ? contact.email.trim() : "";
  const phone = typeof contact.phone === "string" ? contact.phone.trim() : "";
  const message = typeof contact.message === "string" ? contact.message.trim() : "";
  const createdAt = typeof contact.createdAt === "string" ? contact.createdAt.trim() : "";
  if (!id || !name || !message || !createdAt || (!email && !phone)) return undefined;
  return { ...contact, id, name, email, phone, message, createdAt };
}

function sanitizeContactsForBackup(contacts: readonly ContactSubmission[]) {
  const seenContactIds = new Set<string>();
  return contacts.flatMap((contact) => {
    const sanitizedContact = sanitizeContactForBackup(contact);
    if (!sanitizedContact || seenContactIds.has(sanitizedContact.id)) return [];
    seenContactIds.add(sanitizedContact.id);
    return [sanitizedContact];
  });
}

function sanitizeLeadReviewForBackup(review: LeadReview) {
  const id = typeof review.id === "string" ? review.id.trim() : "";
  const leadId = typeof review.leadId === "string" ? review.leadId.trim() : "";
  const label = typeof review.label === "string" ? review.label.trim() : "";
  const reviewedAt = typeof review.reviewedAt === "string" ? review.reviewedAt.trim() : "";
  if (!id || !leadId || !label || !reviewedAt || typeof review.kind !== "string" || !supportedLeadReviewKinds.has(review.kind as LeadReview["kind"])) return undefined;
  return { ...review, id, leadId, kind: review.kind as LeadReview["kind"], label, reviewedAt };
}

function sanitizeLeadReviewsForBackup(reviews: readonly LeadReview[]) {
  const seenReviewIds = new Set<string>();
  const seenLeadIds = new Set<string>();
  return reviews.flatMap((review) => {
    const sanitizedReview = sanitizeLeadReviewForBackup(review);
    if (!sanitizedReview || seenReviewIds.has(sanitizedReview.id) || seenLeadIds.has(sanitizedReview.leadId)) return [];
    seenReviewIds.add(sanitizedReview.id);
    seenLeadIds.add(sanitizedReview.leadId);
    return [sanitizedReview];
  });
}

function sanitizeStudioEventForBackup(event: StudioEvent) {
  const id = typeof event.id === "string" ? event.id.trim() : "";
  const title = typeof event.title === "string" ? event.title.trim() : "";
  const date = typeof event.date === "string" ? event.date.trim() : "";
  const time = typeof event.time === "string" ? event.time.trim() : "";
  const details = typeof event.details === "string" ? event.details.trim() : "";
  if (!id || !title || !date || !time || typeof event.audience !== "string" || !supportedStudioEventAudiences.has(event.audience as StudioEvent["audience"])) {
    return undefined;
  }
  return { ...event, id, title, date, time, details, audience: event.audience as StudioEvent["audience"] };
}

function sanitizeStudioEventsForBackup(events: readonly StudioEvent[]) {
  const seenEventIds = new Set<string>();
  return events.flatMap((event) => {
    const sanitizedEvent = sanitizeStudioEventForBackup(event);
    if (!sanitizedEvent || seenEventIds.has(sanitizedEvent.id)) return [];
    seenEventIds.add(sanitizedEvent.id);
    return [sanitizedEvent];
  });
}

function sanitizeOrderCustomerForBackup(customer: unknown) {
  if (!isRecord(customer)) return undefined;
  const sanitizedCustomer = requiredCustomerStringFields.reduce<Record<(typeof requiredCustomerStringFields)[number], string>>(
    (cleanCustomer, field) => ({ ...cleanCustomer, [field]: typeof customer[field] === "string" ? customer[field].trim() : "" }),
    {} as Record<(typeof requiredCustomerStringFields)[number], string>
  );
  if (requiredCustomerStringFields.some((field) => !sanitizedCustomer[field])) return undefined;
  return { ...customer, ...sanitizedCustomer };
}

function sanitizeOrderItemForBackup(item: unknown) {
  if (!isRecord(item) || !isNonnegativeFiniteNumber(item.unitPrice) || !isPositiveInteger(item.quantity)) return undefined;
  const unitPrice = item.unitPrice as number;
  const quantity = item.quantity as number;
  const sanitizedItem = requiredCartItemStringFields.reduce<Record<(typeof requiredCartItemStringFields)[number], string>>(
    (cleanItem, field) => ({ ...cleanItem, [field]: typeof item[field] === "string" ? item[field].trim() : "" }),
    {} as Record<(typeof requiredCartItemStringFields)[number], string>
  );
  if (requiredCartItemStringFields.some((field) => !sanitizedItem[field])) return undefined;
  return { ...item, ...sanitizedItem, unitPrice, quantity };
}

function sanitizeOrderForBackup(order: Order) {
  const id = typeof order.id === "string" ? order.id.trim() : "";
  const orderNumber = typeof order.orderNumber === "string" ? order.orderNumber.trim() : "";
  const createdAt = typeof order.createdAt === "string" ? order.createdAt.trim() : "";
  const notes = typeof order.notes === "string" ? order.notes.trim() : "";
  const pickupOption = typeof order.pickupOption === "string" ? order.pickupOption.trim() : "";
  const status = typeof order.status === "string" ? order.status.trim() : "";
  const customer = sanitizeOrderCustomerForBackup(order.customer);
  const items = Array.isArray(order.items)
    ? order.items.flatMap((item) => {
        const sanitizedItem = sanitizeOrderItemForBackup(item);
        return sanitizedItem ? [sanitizedItem] : [];
      })
    : [];
  const subtotal = cartItemsSubtotal(items);
  if (!id || !orderNumber || !createdAt || !pickupOption || !status || !customer || !items.length || subtotal === undefined) return undefined;

  const discountValue = typeof order.discount === "number" && Number.isFinite(order.discount) && order.discount >= 0
    ? Math.min(roundCurrency(order.discount), subtotal)
    : 0;
  const discount = roundCurrency(discountValue);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = roundCurrency(taxable * TAX_RATE);
  const total = roundCurrency(taxable + tax);
  return { ...order, id, orderNumber, createdAt, customer, items, subtotal, discount, tax, total, notes, pickupOption, status };
}

function sanitizeOrdersForBackup(orders: readonly Order[]) {
  const seenOrderIds = new Set<string>();
  return orders.flatMap((order) => {
    const sanitizedOrder = sanitizeOrderForBackup(order);
    if (!sanitizedOrder || seenOrderIds.has(sanitizedOrder.id)) return [];
    seenOrderIds.add(sanitizedOrder.id);
    return [sanitizedOrder];
  });
}

function sanitizeCheckInsForBackup(checkIns: readonly StudentCheckIn[], studentIds: Set<string>) {
  const seenStudentDates = new Set<string>();
  return checkIns.reduce<StudentCheckIn[]>((restorableCheckIns, checkIn) => {
    const studentId = checkIn.studentId.trim();
    const date = checkIn.date.trim();
    if (!studentId || !date || !studentIds.has(studentId)) return restorableCheckIns;
    const studentDate = `${studentId}::${date}`;
    if (seenStudentDates.has(studentDate)) return restorableCheckIns;
    seenStudentDates.add(studentDate);
    restorableCheckIns.push(studentId === checkIn.studentId && date === checkIn.date ? checkIn : { ...checkIn, studentId, date });
    return restorableCheckIns;
  }, []);
}

function cleanBackupString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTwilioManagerAuthMode(value: unknown): NonNullable<ProductionMessagingSetupBackup["twilioLaunchProfile"]>["managerAuthMode"] {
  return value === "server-session" || value === "oauth-proxy" ? value : "same-site-cookie";
}

function normalizeTwilioComplianceSenderType(value: unknown): TwilioComplianceSenderType {
  return typeof value === "string" && supportedTwilioComplianceSenderTypes.has(value as TwilioComplianceSenderType) ? value as TwilioComplianceSenderType : "not-set";
}

function normalizeTwilioComplianceStatus(value: unknown): TwilioComplianceStatus {
  return typeof value === "string" && supportedTwilioComplianceStatuses.has(value as TwilioComplianceStatus) ? value as TwilioComplianceStatus : "not-started";
}

function sanitizeTwilioLaunchProfileForBackup(value: unknown): ProductionMessagingSetupBackup["twilioLaunchProfile"] | undefined {
  if (!isRecord(value)) return undefined;
  const profile: NonNullable<ProductionMessagingSetupBackup["twilioLaunchProfile"]> = {
    messagingServiceSid: cleanBackupString(value.messagingServiceSid),
    smsSender: cleanBackupString(value.smsSender),
    inboundWebhookUrl: cleanBackupString(value.inboundWebhookUrl),
    statusCallbackBaseUrl: cleanBackupString(value.statusCallbackBaseUrl),
    relayHealthCheckUrl: cleanBackupString(value.relayHealthCheckUrl),
    managerAuthMode: normalizeTwilioManagerAuthMode(value.managerAuthMode),
    senderType: normalizeTwilioComplianceSenderType(value.senderType),
    a2pBrandStatus: normalizeTwilioComplianceStatus(value.a2pBrandStatus),
    a2pCampaignStatus: normalizeTwilioComplianceStatus(value.a2pCampaignStatus),
    tollFreeVerificationStatus: normalizeTwilioComplianceStatus(value.tollFreeVerificationStatus),
    complianceNotes: cleanBackupString(value.complianceNotes),
    ...(cleanBackupString(value.savedAt) ? { savedAt: cleanBackupString(value.savedAt) } : {})
  };
  const hasUsefulProfileValue = Boolean(
    profile.messagingServiceSid ||
    profile.smsSender ||
    profile.inboundWebhookUrl ||
    profile.statusCallbackBaseUrl ||
    profile.relayHealthCheckUrl ||
    profile.complianceNotes ||
    profile.savedAt ||
    profile.senderType !== "not-set" ||
    profile.a2pBrandStatus !== "not-started" ||
    profile.a2pCampaignStatus !== "not-started" ||
    profile.tollFreeVerificationStatus !== "not-started"
  );
  return hasUsefulProfileValue ? profile : undefined;
}

function sanitizeProductionMessagingSetupForBackup(entry: unknown): ProductionMessagingSetupBackup | undefined {
  if (!isRecord(entry)) return undefined;
  const twilioRelayEndpoint = cleanBackupString(entry.twilioRelayEndpoint);
  const pushServerEndpoint = cleanBackupString(entry.pushServerEndpoint);
  const webPushPublicKeyCandidate = cleanBackupString(entry.webPushPublicKey);
  const webPushPublicKey = stringLooksLikeRawPushSubscription(webPushPublicKeyCandidate) ? "" : webPushPublicKeyCandidate;
  const twilioLaunchProfile = sanitizeTwilioLaunchProfileForBackup(entry.twilioLaunchProfile);
  const hasUsefulSetup = Boolean(twilioRelayEndpoint || pushServerEndpoint || webPushPublicKey || twilioLaunchProfile);
  if (!hasUsefulSetup) return undefined;
  return {
    id: productionMessagingSetupId,
    ...(twilioRelayEndpoint ? { twilioRelayEndpoint } : {}),
    ...(pushServerEndpoint ? { pushServerEndpoint } : {}),
    ...(webPushPublicKey ? { webPushPublicKey } : {}),
    ...(twilioLaunchProfile ? { twilioLaunchProfile } : {})
  };
}

function sanitizeProductionMessagingSetupListForBackup(entries: readonly unknown[]) {
  const setup = entries.flatMap((entry) => {
    const sanitizedSetup = sanitizeProductionMessagingSetupForBackup(entry);
    return sanitizedSetup ? [sanitizedSetup] : [];
  })[0];
  return setup ? [setup] : [];
}

function sanitizeTrainingVideoFolderForBackup(folder: TrainingVideoFolder) {
  const id = cleanBackupString(folder.id);
  const name = cleanBackupString(folder.name);
  const subject = cleanBackupString(folder.subject);
  const createdAt = cleanBackupString(folder.createdAt);
  if (!id || !name || !subject || !createdAt) return undefined;

  const { description: _description, ...baseFolder } = folder;
  const description = cleanBackupString(folder.description);
  return {
    ...baseFolder,
    id,
    name,
    subject,
    createdAt,
    ...(description ? { description } : {})
  };
}

function sanitizeTrainingVideoFoldersForBackup(folders: readonly TrainingVideoFolder[]) {
  const seenFolderIds = new Set<string>();
  return folders.flatMap((folder) => {
    const sanitizedFolder = sanitizeTrainingVideoFolderForBackup(folder);
    if (!sanitizedFolder || seenFolderIds.has(sanitizedFolder.id)) return [];
    seenFolderIds.add(sanitizedFolder.id);
    return [sanitizedFolder];
  });
}

function sanitizeTrainingVideoForBackup(video: TrainingVideo, videoFolderIds: Set<string>) {
  const id = cleanBackupString(video.id);
  const folderId = cleanBackupString(video.folderId);
  const title = cleanBackupString(video.title);
  const fileName = cleanBackupString(video.fileName);
  const mimeType = cleanBackupString(video.mimeType);
  const videoDataUrl = cleanBackupString(video.videoDataUrl);
  const createdAt = cleanBackupString(video.createdAt);
  if (
    !id ||
    !folderId ||
    !videoFolderIds.has(folderId) ||
    !title ||
    !fileName ||
    !mimeType ||
    !videoDataUrl.startsWith("data:video/") ||
    !isSafeTrainingVideoFile({ mimeType, videoDataUrl }) ||
    !createdAt
  ) {
    return undefined;
  }

  const { description: _description, ...baseVideo } = video;
  const description = cleanBackupString(video.description);
  return {
    ...baseVideo,
    id,
    folderId,
    title,
    ...(description ? { description } : {}),
    fileName,
    mimeType,
    size: cleanBackupNonnegativeInteger(video.size, 0),
    videoDataUrl,
    createdAt
  };
}

function sanitizeTrainingVideosForBackup(videos: readonly TrainingVideo[], videoFolderIds: Set<string>) {
  const seenVideoIds = new Set<string>();
  return videos.flatMap((video) => {
    const sanitizedVideo = sanitizeTrainingVideoForBackup(video, videoFolderIds);
    if (!sanitizedVideo || seenVideoIds.has(sanitizedVideo.id)) return [];
    seenVideoIds.add(sanitizedVideo.id);
    return [sanitizedVideo];
  });
}

function sanitizeStudyGuideFolderBaseForBackup(folder: StudyGuideFolder) {
  const id = cleanBackupString(folder.id);
  const name = cleanBackupString(folder.name);
  const subject = cleanBackupString(folder.subject);
  const createdAt = cleanBackupString(folder.createdAt);
  if (!id || !name || !subject || !createdAt) return undefined;

  const { description: _description, parentId: _parentId, ...baseFolder } = folder;
  const description = cleanBackupString(folder.description);
  const parentId = cleanBackupString(folder.parentId);
  return {
    ...baseFolder,
    id,
    name,
    subject,
    ...(parentId ? { parentId } : {}),
    ...(description ? { description } : {}),
    createdAt
  };
}

function sanitizeStudyGuideFoldersForBackup(folders: readonly StudyGuideFolder[]) {
  const seenFolderIds = new Set<string>();
  const sanitizedFolders = folders.flatMap((folder) => {
    const sanitizedFolder = sanitizeStudyGuideFolderBaseForBackup(folder);
    if (!sanitizedFolder || seenFolderIds.has(sanitizedFolder.id)) return [];
    seenFolderIds.add(sanitizedFolder.id);
    return [sanitizedFolder];
  });
  return sanitizedFolders.map((folder) => {
    const parentId = folder.parentId?.trim();
    if (parentId && parentId !== folder.id && seenFolderIds.has(parentId)) return parentId === folder.parentId ? folder : { ...folder, parentId };
    const { parentId: _parentId, ...unlinkedFolder } = folder;
    return unlinkedFolder;
  });
}

function sanitizeStudyGuideMaterialForBackup(material: StudyGuideMaterial, studyGuideFolderIds: Set<string>) {
  const id = cleanBackupString(material.id);
  const folderId = cleanBackupString(material.folderId);
  const title = cleanBackupString(material.title);
  const fileName = cleanBackupString(material.fileName);
  const mimeType = cleanBackupString(material.mimeType);
  const fileDataUrl = cleanBackupString(material.fileDataUrl);
  const createdAt = cleanBackupString(material.createdAt);
  if (
    !id ||
    !folderId ||
    !studyGuideFolderIds.has(folderId) ||
    !title ||
    !fileName ||
    !mimeType ||
    !fileDataUrl.startsWith("data:") ||
    !isSafeStudyMaterialFile({ mimeType, fileDataUrl }) ||
    !createdAt
  ) {
    return undefined;
  }

  const { description: _description, ...baseMaterial } = material;
  const description = cleanBackupString(material.description);
  return {
    ...baseMaterial,
    id,
    folderId,
    title,
    ...(description ? { description } : {}),
    fileName,
    mimeType,
    size: cleanBackupNonnegativeInteger(material.size, 0),
    fileDataUrl,
    createdAt
  };
}

function sanitizeStudyGuideMaterialsForBackup(materials: readonly StudyGuideMaterial[], studyGuideFolderIds: Set<string>) {
  const seenMaterialIds = new Set<string>();
  return materials.flatMap((material) => {
    const sanitizedMaterial = sanitizeStudyGuideMaterialForBackup(material, studyGuideFolderIds);
    if (!sanitizedMaterial || seenMaterialIds.has(sanitizedMaterial.id)) return [];
    seenMaterialIds.add(sanitizedMaterial.id);
    return [sanitizedMaterial];
  });
}

function guardianParentIdentitiesForBackup(accounts: readonly unknown[]) {
  const guardianIdentities = new Set(builtInGuardianLoginIdentities);
  accounts.forEach((account) => {
    if (isRecord(account) && typeof account.email === "string" && account.email.trim() && registeredBackupAccountRole(account) === "guardian") {
      guardianIdentities.add(account.email.trim().toLowerCase());
    }
  });
  return guardianIdentities;
}

function registeredBackupAccountRole(account: Record<string, unknown>): AccountRole {
  const role = account.role;
  return typeof role === "string" && supportedAccountRoles.has(role as AccountRole) ? role as AccountRole : "guardian";
}

function sanitizeChildAccountForBackup(child: ChildAccount, guardianParentIdentities: Set<string>, seenUsernames: Set<string>) {
  const { password, ...account } = child;
  const parentEmail = account.parentEmail.trim();
  const username = account.username.trim();
  const normalizedUsername = username.toLowerCase();
  if (
    !parentEmail ||
    !guardianParentIdentities.has(parentEmail.toLowerCase()) ||
    !username ||
    builtInLoginUsernames.has(normalizedUsername) ||
    seenUsernames.has(normalizedUsername)
  ) {
    return undefined;
  }
  seenUsernames.add(normalizedUsername);
  return {
    ...account,
    parentEmail,
    username,
    hasSavedPassword: Boolean(password?.trim())
  };
}

function customLoginUsernamesForBackup(managedAccounts: readonly ManagedAccountBackup[], childAccounts: readonly ChildAccountBackup[] = []) {
  return new Set([
    ...managedAccounts.map((account) => account.username.trim().toLowerCase()),
    ...childAccounts.map((child) => child.username.trim().toLowerCase())
  ]);
}

function sanitizeRegisteredAccountsForBackup(accounts: readonly unknown[], customLoginUsernames: Set<string>) {
  const seenEmails = new Set<string>();
  return accounts.flatMap((account) => {
    if (!isRecord(account) || typeof account.email !== "string") return [];
    const { password: _password, ...safeAccount } = account;
    const email = account.email.trim();
    const normalizedEmail = email.toLowerCase();
    if (!email || builtInLoginIdentities.has(normalizedEmail) || customLoginUsernames.has(normalizedEmail) || seenEmails.has(normalizedEmail)) return [];
    seenEmails.add(normalizedEmail);
    return [{ ...safeAccount, email, role: registeredBackupAccountRole(account) }];
  });
}

function expectedAccountRolesForBackup(
  accounts: readonly unknown[],
  managedAccounts: readonly ManagedAccountBackup[],
  childAccounts: readonly ChildAccountBackup[]
) {
  const expectedRoles = new Map<string, AccountRole>(builtInLoginRoles);
  accounts.forEach((account) => {
    if (isRecord(account) && typeof account.email === "string" && account.email.trim()) {
      expectedRoles.set(account.email.trim().toLowerCase(), registeredBackupAccountRole(account));
    }
  });
  managedAccounts.forEach((account) => expectedRoles.set(account.username.trim().toLowerCase(), account.role));
  childAccounts.forEach((child) => expectedRoles.set(child.username.trim().toLowerCase(), "student"));
  return expectedRoles;
}

function sanitizeAccountRolesForBackup(accountRoles: readonly unknown[], expectedRoles: Map<string, AccountRole>) {
  const seenEmails = new Set<string>();
  return accountRoles.flatMap((record) => {
    if (!isRecord(record) || typeof record.email !== "string") return [];
    const email = record.email.trim();
    const normalizedEmail = email.toLowerCase();
    const role = expectedRoles.get(normalizedEmail);
    if (!email || !role || seenEmails.has(normalizedEmail)) return [];
    seenEmails.add(normalizedEmail);
    return [{ email, role }];
  });
}

export function buildOperationsBackupSnapshot(input: OperationsBackupInput, exportedAt = new Date().toISOString()): OperationsBackupSnapshot {
  const students = sanitizeStudentsForBackup(input.students);
  const studentIds = new Set(students.map((student) => student.id));
  const activeStudentIds = new Set(students.filter(isCurrentRestoredStudent).map((student) => student.id));
  const trainingVideoFolders = sanitizeTrainingVideoFoldersForBackup(input.trainingVideoFolders);
  const videoFolderIds = new Set(trainingVideoFolders.map((folder) => folder.id));
  const studyGuideFolders = sanitizeStudyGuideFoldersForBackup(input.studyGuideFolders);
  const studyGuideFolderIds = new Set(studyGuideFolders.map((folder) => folder.id));
  const managedAccounts = sanitizeManagedAccountsForBackup(input.managedAccounts, studentIds, activeStudentIds);
  const messageCampaigns = sanitizeMessageCampaignsForBackup(input.messageCampaigns);
  const campaignIds = new Set(messageCampaigns.map((campaign) => campaign.id));
  const scheduledTextCampaigns = sanitizeScheduledTextCampaignsForBackup(input.scheduledTextCampaigns, campaignIds);
  const accountsBeforeChildCollisionCheck = sanitizeRegisteredAccountsForBackup(input.accounts, customLoginUsernamesForBackup(managedAccounts));
  const guardianParentIdentitiesBeforeChildCollisionCheck = guardianParentIdentitiesForBackup(accountsBeforeChildCollisionCheck);
  const seenChildUsernamesBeforeAccountCollisionCheck = customLoginUsernamesForBackup(managedAccounts);
  const childAccountsBeforeAccountCollisionCheck = input.childAccounts.flatMap((child) => {
    const sanitizedChild = sanitizeChildAccountForBackup(child, guardianParentIdentitiesBeforeChildCollisionCheck, seenChildUsernamesBeforeAccountCollisionCheck);
    return sanitizedChild ? [sanitizedChild] : [];
  });
  const accounts = sanitizeRegisteredAccountsForBackup(input.accounts, customLoginUsernamesForBackup(managedAccounts, childAccountsBeforeAccountCollisionCheck));
  const guardianParentIdentities = guardianParentIdentitiesForBackup(accounts);
  const seenChildUsernames = customLoginUsernamesForBackup(managedAccounts);
  const childAccounts = input.childAccounts.flatMap((child) => {
    const sanitizedChild = sanitizeChildAccountForBackup(child, guardianParentIdentities, seenChildUsernames);
    return sanitizedChild ? [sanitizedChild] : [];
  });
  const expectedAccountRoles = expectedAccountRolesForBackup(accounts, managedAccounts, childAccounts);
  const data: OperationsBackupSnapshot["data"] = {
    accounts,
    accountRoles: sanitizeAccountRolesForBackup(input.accountRoles, expectedAccountRoles),
    managedAccounts,
    childAccounts,
    students,
    studioClasses: sanitizeStudioClassesForBackup(input.studioClasses),
    scheduledClasses: sanitizeScheduledClassesForBackup(input.scheduledClasses, activeStudentIds),
    messageCampaigns,
    scheduledTextCampaigns,
    messageLogs: sanitizeMessageLogsForBackup(input.messageLogs, campaignIds, students, input.managedAccounts),
    automationRuns: sanitizeTextAutomationRunsForBackup(input.automationRuns ?? []),
    directMessages: sanitizeDirectMessagesForBackup(input.directMessages, activeStudentIds),
    messagingSetup: sanitizeProductionMessagingSetupListForBackup(input.messagingSetup ?? []),
    studioEvents: sanitizeStudioEventsForBackup(input.studioEvents),
    merchandiseItems: sanitizeMerchandiseItemsForBackup(input.merchandiseItems),
    checkIns: sanitizeCheckInsForBackup(input.checkIns, studentIds),
    trainingVideoFolders,
    trainingVideos: sanitizeTrainingVideosForBackup(input.trainingVideos, videoFolderIds),
    studyGuideFolders,
    studyGuideMaterials: sanitizeStudyGuideMaterialsForBackup(input.studyGuideMaterials, studyGuideFolderIds),
    orders: sanitizeOrdersForBackup(input.orders),
    bookings: input.bookings.flatMap((booking) => {
      const sanitizedBooking = sanitizeBookingForBackup(booking);
      return sanitizedBooking ? [sanitizedBooking] : [];
    }),
    contacts: sanitizeContactsForBackup(input.contacts),
    leadReviews: sanitizeLeadReviewsForBackup(input.leadReviews)
  };
  const sections = backupSections.map((section) => ({
    ...section,
    count: data[section.id].length
  }));
  const totalRecords = sections.reduce((total, section) => total + section.count, 0);

  return {
    schemaVersion: "chos-operations-backup.v1",
    exportedAt,
    summary: {
      sections: sections.length,
      totalRecords,
      emptySections: sections.filter((section) => section.count === 0).length
    },
    sections,
    data
  };
}

export function makeOperationsBackupFilename(exportedAt = new Date().toISOString()) {
  return `chos-operations-backup-${exportedAt.slice(0, 10)}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseBackupJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Backup file must contain valid JSON.");
  }
}

function normalizedBackupUsername(entry: Record<string, unknown>) {
  return typeof entry.username === "string" ? entry.username.trim().toLowerCase() : "";
}

function hasMissingStringField<T extends string>(entry: Record<T, unknown>, field: T) {
  return typeof entry[field] !== "string" || !entry[field].trim();
}

function hasPaddedStringField<T extends string>(entry: Record<T, unknown>, field: T) {
  return typeof entry[field] === "string" && entry[field].trim() !== entry[field];
}

function hasInvalidRequiredStringField<T extends string>(entry: Record<T, unknown>, field: T) {
  return hasMissingStringField(entry, field) || hasPaddedStringField(entry, field);
}

function hasInvalidOptionalStringField<T extends string>(entry: Record<T, unknown>, field: T) {
  return entry[field] !== undefined && (typeof entry[field] !== "string" || hasPaddedStringField(entry, field));
}

function isNonnegativeFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) > 0;
}

function isSupportedManagerAccessList(value: unknown): value is ManagerAccessKey[] {
  return Array.isArray(value) && value.every((accessKey): accessKey is ManagerAccessKey => typeof accessKey === "string" && supportedManagerAccessKeys.has(accessKey as ManagerAccessKey));
}

function isSupportedClassWeekdayList(value: unknown): value is ClassWeekday[] {
  if (!Array.isArray(value) || !value.length) return false;
  const uniqueWeekdays = new Set(value);
  return uniqueWeekdays.size === value.length && value.every((weekday): weekday is ClassWeekday => Number.isInteger(weekday) && supportedClassWeekdays.has(weekday as ClassWeekday));
}

function hasRequiredCustomerFields(value: unknown) {
  return isRecord(value) && requiredCustomerStringFields.every((field) => !hasMissingStringField(value, field));
}

function hasLeadContactMethod(entry: Record<string, unknown>) {
  return (
    (typeof entry.email === "string" && Boolean(entry.email.trim())) ||
    (typeof entry.phone === "string" && Boolean(entry.phone.trim()))
  );
}

function isValidCartItemRecord(item: unknown): item is BackupCartItemRecord {
  return (
    isRecord(item) &&
    requiredCartItemStringFields.every((field) => !hasMissingStringField(item, field)) &&
    isNonnegativeFiniteNumber(item.unitPrice) &&
    isPositiveInteger(item.quantity)
  );
}

function hasValidCartItems(value: unknown): value is BackupCartItemRecord[] {
  return Array.isArray(value) && value.length > 0 && value.every(isValidCartItemRecord);
}

function hasInvalidMerchandiseThresholds(entry: Record<string, unknown>) {
  const reorderPoint = entry.reorderPoint;
  const targetStock = entry.targetStock;
  if (reorderPoint === undefined || targetStock === undefined) return false;
  if (typeof reorderPoint !== "number" || typeof targetStock !== "number") return true;
  if (!isNonnegativeFiniteNumber(reorderPoint) || !isNonnegativeFiniteNumber(targetStock)) return true;
  return targetStock <= reorderPoint;
}

function cartItemsSubtotal(value: unknown) {
  if (!hasValidCartItems(value)) return undefined;
  return roundCurrency(value.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
}

function isCurrencyMatch(value: unknown, expected: number) {
  return typeof value === "number" && Number.isFinite(value) && roundCurrency(value) === expected;
}

function hasConsistentOrderTotals(order: Record<string, unknown>) {
  const subtotal = cartItemsSubtotal(order.items);
  if (subtotal === undefined) return false;
  const discountValue = order.discount;
  if (!isNonnegativeFiniteNumber(discountValue) || typeof discountValue !== "number" || discountValue > subtotal) return false;
  const discount = roundCurrency(discountValue);
  const taxable = Math.max(subtotal - discount, 0);
  const expectedTax = roundCurrency(taxable * TAX_RATE);
  const expectedTotal = roundCurrency(taxable + expectedTax);
  return (
    isCurrencyMatch(order.subtotal, subtotal) &&
    isCurrencyMatch(order.tax, expectedTax) &&
    isCurrencyMatch(order.total, expectedTotal)
  );
}

function hasBrokenOptionalReference<T>(records: readonly T[], getReference: (record: T) => string | undefined, validIds: Set<string>) {
  return records.some((record) => {
    const reference = getReference(record)?.trim();
    return Boolean(reference && !validIds.has(reference));
  });
}

function hasBrokenRequiredReference<T>(records: readonly T[], getReference: (record: T) => string | undefined, validIds: Set<string>) {
  return records.some((record) => {
    const reference = getReference(record)?.trim();
    return !reference || !validIds.has(reference);
  });
}

function isCurrentRestoredStudent(student: Pick<StudentRecord, "status">) {
  return (student.status?.trim() || "Active").toLowerCase() !== "inactive";
}

function isRestoredDirectMessageParticipantAvailable(participantId: string, activeStudentIds: Set<string>) {
  const cleanParticipantId = participantId.trim();
  if (!cleanParticipantId) return false;
  if (cleanParticipantId.startsWith("direct-staff-")) return true;
  const studentId = cleanParticipantId.startsWith("parent-") ? cleanParticipantId.slice("parent-".length) : cleanParticipantId;
  return activeStudentIds.has(studentId);
}

function normalizeMessagePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits || value.trim().toLowerCase();
}

function restoredStudentFullName(student: Pick<StudentRecord, "firstName" | "lastName">) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function isRestoredQueuedMessageDeliverable(
  message: Pick<MessageLog, "recipientName" | "recipientPhone" | "recipientRole" | "recipientId">,
  students: readonly StudentRecord[],
  managedAccounts: readonly ManagedAccount[] = []
) {
  const recipientName = message.recipientName.trim().toLowerCase();
  const recipientPhone = normalizeMessagePhone(message.recipientPhone);
  if (!recipientName || !recipientPhone) return false;
  if (message.recipientRole === "staff") {
    return managedAccounts.some(
      (account) =>
        account.role === "staff" &&
        account.status === "active" &&
        (message.recipientId === account.id || account.displayName.trim().toLowerCase() === recipientName) &&
        normalizeMessagePhone(account.phone ?? "") === recipientPhone
    );
  }
  if (message.recipientRole === "parent") {
    return students.some((student) => {
      if (!isCurrentRestoredStudent(student)) return false;
      const parentId = `parent-${student.id}`;
      const guardianName = (student.guardianName?.trim() || `${restoredStudentFullName(student)} Parent/Guardian`).toLowerCase();
      return (
        (message.recipientId === parentId || guardianName === recipientName) &&
        normalizeMessagePhone(student.guardianPhone ?? "") === recipientPhone
      );
    });
  }
  const studentMatch = students.some(
    (student) =>
      isCurrentRestoredStudent(student) &&
      restoredStudentFullName(student).trim().toLowerCase() === recipientName &&
      normalizeMessagePhone(student.phone) === recipientPhone
  );
  if (message.recipientRole === "student") return studentMatch;
  return (
    studentMatch ||
    students.some(
      (student) =>
        isCurrentRestoredStudent(student) &&
        (student.guardianName?.trim().toLowerCase() || "") === recipientName &&
        normalizeMessagePhone(student.guardianPhone ?? "") === recipientPhone
    ) ||
    managedAccounts.some(
      (account) =>
        account.role === "staff" &&
        account.status === "active" &&
        account.displayName.trim().toLowerCase() === recipientName &&
        normalizeMessagePhone(account.phone ?? "") === recipientPhone
    )
  );
}

function hasDuplicateCheckInDatePairs(checkIns: readonly Pick<StudentCheckIn, "studentId" | "date">[]) {
  const pairs = checkIns.map((checkIn) => `${checkIn.studentId.trim()}::${checkIn.date.trim()}`);
  return new Set(pairs).size !== pairs.length;
}

function hasMessagingSetupCredentialLikeField(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasMessagingSetupCredentialLikeField(item, seen));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) => messagingSetupCredentialFieldPattern.test(key) || hasMessagingSetupCredentialLikeField(item, seen)
  );
}

function hasRawPushSubscriptionMaterial(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === "string") return stringLooksLikeRawPushSubscription(value);
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasRawPushSubscriptionMaterial(item, seen));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) => rawPushSubscriptionFieldPattern.test(key) || hasRawPushSubscriptionMaterial(item, seen)
  );
}

function stringLooksLikeRawPushSubscription(value: string) {
  const trimmed = value.trim();
  if (!trimmed || !/(?:endpoint|p256dh|PushSubscription|"keys"|"auth")/i.test(trimmed)) return false;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return hasRawPushSubscriptionMaterial(parsed);
  } catch {
    return /endpoint/i.test(trimmed) && /p256dh/i.test(trimmed) && /auth/i.test(trimmed);
  }
}

function hasInvalidTwilioLaunchProfile(profile: Record<string, unknown>) {
  return (
    requiredTwilioLaunchProfileStringFields.some((field) => typeof profile[field] !== "string" || hasPaddedStringField(profile, field)) ||
    optionalTwilioLaunchProfileStringFields.some((field) => hasInvalidOptionalStringField(profile, field)) ||
    typeof profile.managerAuthMode !== "string" ||
    !supportedTwilioManagerAuthModes.has(profile.managerAuthMode as NonNullable<ProductionMessagingSetupBackup["twilioLaunchProfile"]>["managerAuthMode"]) ||
    typeof profile.senderType !== "string" ||
    !supportedTwilioComplianceSenderTypes.has(profile.senderType as TwilioComplianceSenderType) ||
    typeof profile.a2pBrandStatus !== "string" ||
    !supportedTwilioComplianceStatuses.has(profile.a2pBrandStatus as TwilioComplianceStatus) ||
    typeof profile.a2pCampaignStatus !== "string" ||
    !supportedTwilioComplianceStatuses.has(profile.a2pCampaignStatus as TwilioComplianceStatus) ||
    typeof profile.tollFreeVerificationStatus !== "string" ||
    !supportedTwilioComplianceStatuses.has(profile.tollFreeVerificationStatus as TwilioComplianceStatus)
  );
}

function validateProductionMessagingSetupEntries(entries: readonly Record<string, unknown>[]) {
  if (entries.length > 1) {
    throw new Error("messagingSetup entries must contain a single production messaging setup record in the operations backup.");
  }
  if (entries.some((entry) => entry.id !== productionMessagingSetupId)) {
    throw new Error("messagingSetup entries must use the production-messaging id in the operations backup.");
  }
  if (entries.some((entry) => hasMessagingSetupCredentialLikeField(entry))) {
    throw new Error("messagingSetup entries must not include provider secrets in the operations backup.");
  }
  if (entries.some((entry) => hasRawPushSubscriptionMaterial(entry))) {
    throw new Error("messagingSetup entries must not include raw push subscription material in the operations backup.");
  }
  if (entries.some((entry) => optionalMessagingSetupStringFields.some((field) => hasInvalidOptionalStringField(entry, field)))) {
    throw new Error("messagingSetup entries must include valid portable endpoint fields in the operations backup.");
  }
  if (entries.some((entry) => entry.twilioLaunchProfile !== undefined && !isRecord(entry.twilioLaunchProfile))) {
    throw new Error("messagingSetup entries must include valid Twilio launch profile metadata in the operations backup.");
  }
  if (
    entries.some((entry) =>
      isRecord(entry.twilioLaunchProfile) && hasInvalidTwilioLaunchProfile(entry.twilioLaunchProfile)
    )
  ) {
    throw new Error("messagingSetup entries must include valid Twilio launch profile metadata in the operations backup.");
  }
}

function readBackupArray(data: Record<string, unknown>, id: keyof OperationsBackupInput) {
  const value = data[id];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${id} must be an array in the operations backup.`);
  }
  const entries = [...value];
  if (entries.some((entry) => !isRecord(entry))) {
    throw new Error(`${id} entries must be objects in the operations backup.`);
  }
  if (idBackedBackupSectionIds.has(id) && entries.some((entry) => typeof entry.id !== "string" || !entry.id.trim())) {
    throw new Error(`${id} entries must include string ids in the operations backup.`);
  }
  if (idBackedBackupSectionIds.has(id) && entries.some((entry) => hasPaddedStringField(entry, "id"))) {
    throw new Error(`${id} entries must use trimmed stable ids in the operations backup.`);
  }
  if (idBackedBackupSectionIds.has(id)) {
    const uniqueIds = new Set(entries.map((entry) => (entry.id as string).trim()));
    if (uniqueIds.size !== entries.length) {
      throw new Error(`${id} entries must have unique ids in the operations backup.`);
    }
  }
  if (usernameBackedBackupSectionIds.has(id) && entries.some((entry) => typeof entry.username !== "string" || !entry.username.trim())) {
    throw new Error(`${id} entries must include string usernames in the operations backup.`);
  }
  if (usernameBackedBackupSectionIds.has(id) && entries.some((entry) => hasPaddedStringField(entry, "username"))) {
    throw new Error(`${id} entries must use trimmed usernames in the operations backup.`);
  }
  if (usernameBackedBackupSectionIds.has(id)) {
    const uniqueUsernames = new Set(entries.map(normalizedBackupUsername));
    if (uniqueUsernames.size !== entries.length) {
      throw new Error(`${id} entries must have unique usernames in the operations backup.`);
    }
  }
  if (id === "accounts" && entries.some((entry) => requiredAccountStringFields.some((field) => hasMissingStringField(entry, field)))) {
    throw new Error("accounts entries must include required account identity fields in the operations backup.");
  }
  if (id === "accounts" && entries.some((entry) => hasPaddedStringField(entry, "email"))) {
    throw new Error("accounts entries must use trimmed emails in the operations backup.");
  }
  if (id === "childAccounts" && entries.some((entry) => typeof entry.parentEmail !== "string" || !entry.parentEmail.trim())) {
    throw new Error("childAccounts entries must include string parent emails in the operations backup.");
  }
  if (id === "childAccounts" && entries.some((entry) => hasPaddedStringField(entry, "parentEmail"))) {
    throw new Error("childAccounts entries must use trimmed parent emails in the operations backup.");
  }
  if (id === "childAccounts" && entries.some((entry) => requiredChildProfileStringFields.some((field) => typeof entry[field] !== "string" || !entry[field].trim()) || typeof entry.age !== "string")) {
    throw new Error("childAccounts entries must include required profile fields in the operations backup.");
  }
  if (id === "childAccounts" && entries.some((entry) => entry.hasSavedPassword !== undefined && typeof entry.hasSavedPassword !== "boolean")) {
    throw new Error("childAccounts entries must use supported password metadata in the operations backup.");
  }
  if (id === "students" && entries.some((entry) => requiredStudentStringFields.some((field) => typeof entry[field] !== "string" || !entry[field].trim()))) {
    throw new Error("students entries must include required string workflow fields in the operations backup.");
  }
  if (id === "students" && entries.some((entry) => requiredStudentAttendanceFields.some((field) => typeof entry[field] !== "number" || !Number.isFinite(entry[field]) || entry[field] < 0))) {
    throw new Error("students entries must include nonnegative numeric attendance fields in the operations backup.");
  }
  if (id === "merchandiseItems" && entries.some((entry) => requiredMerchandiseStringFields.some((field) => hasMissingStringField(entry, field)))) {
    throw new Error("merchandiseItems entries must include required string inventory fields in the operations backup.");
  }
  if (
    id === "merchandiseItems" &&
    entries.some((entry) =>
      requiredMerchandiseStringFields.some((field) => hasPaddedStringField(entry, field)) ||
      optionalMerchandiseStringFields.some((field) => hasInvalidOptionalStringField(entry, field)) ||
      (typeof entry.imageDataUrl === "string" && !isSafeMerchandiseImageDataUrl(entry.imageDataUrl))
    )
  ) {
    throw new Error("merchandiseItems entries must include valid inventory fields in the operations backup.");
  }
  if (
    id === "merchandiseItems" &&
    entries.some((entry) =>
      requiredMerchandiseNumberFields.some((field) => !isNonnegativeFiniteNumber(entry[field])) ||
      optionalMerchandiseNumberFields.some((field) => entry[field] !== undefined && !isNonnegativeFiniteNumber(entry[field]))
    )
  ) {
    throw new Error("merchandiseItems entries must include nonnegative numeric inventory fields in the operations backup.");
  }
  if (id === "merchandiseItems" && entries.some(hasInvalidMerchandiseThresholds)) {
    throw new Error("merchandiseItems entries must use target stock above reorder point in the operations backup.");
  }
  if (
    id === "orders" &&
    entries.some((entry) =>
      requiredOrderStringFields.some((field) => typeof entry[field] !== "string" || (field !== "notes" && !entry[field].trim())) ||
      !hasRequiredCustomerFields(entry.customer)
    )
  ) {
    throw new Error("orders entries must include required commerce fields in the operations backup.");
  }
  if (
    id === "orders" &&
    entries.some((entry) =>
      requiredOrderNumberFields.some((field) => !isNonnegativeFiniteNumber(entry[field])) ||
      !hasValidCartItems(entry.items) ||
      !hasConsistentOrderTotals(entry)
    )
  ) {
    throw new Error("orders entries must include valid commerce totals and items in the operations backup.");
  }
  if (
    id === "bookings" &&
    entries.some((entry) =>
      !isPositiveInteger(entry.persons) ||
      hasInvalidRequiredStringField(entry, "date") ||
      hasInvalidRequiredStringField(entry, "time") ||
      entry.timezone !== "America/Chicago"
    )
  ) {
    throw new Error("bookings entries must include valid starter booking fields in the operations backup.");
  }
  if (id === "contacts" && entries.some((entry) => requiredContactStringFields.some((field) => hasMissingStringField(entry, field)) || !hasLeadContactMethod(entry))) {
    throw new Error("contacts entries must include required lead fields in the operations backup.");
  }
  if (
    id === "contacts" &&
    entries.some((entry) =>
      requiredContactStringFields.some((field) => hasPaddedStringField(entry, field)) ||
      optionalContactStringFields.some((field) => hasInvalidOptionalStringField(entry, field))
    )
  ) {
    throw new Error("contacts entries must include valid lead fields in the operations backup.");
  }
  if (
    id === "leadReviews" &&
    entries.some((entry) =>
      requiredLeadReviewStringFields.some((field) => hasInvalidRequiredStringField(entry, field)) ||
      typeof entry.kind !== "string" ||
      !supportedLeadReviewKinds.has(entry.kind as LeadReview["kind"])
    )
  ) {
    throw new Error("leadReviews entries must include valid reviewed lead fields in the operations backup.");
  }
  if (id === "messageLogs" && entries.some((entry) => requiredMessageLogStringFields.some((field) => hasMissingStringField(entry, field)))) {
    throw new Error("messageLogs entries must include required outreach fields in the operations backup.");
  }
  if (
    id === "messageLogs" &&
    entries.some((entry) =>
      requiredMessageLogStringFields.some((field) => hasPaddedStringField(entry, field)) ||
      optionalMessageLogStringFields.some((field) => hasInvalidOptionalStringField(entry, field))
    )
  ) {
    throw new Error("messageLogs entries must include valid outreach fields in the operations backup.");
  }
  if (id === "messageLogs" && entries.some((entry) => typeof entry.kind !== "string" || !supportedMessageLogKinds.has(entry.kind as MessageLog["kind"]))) {
    throw new Error("messageLogs entries must use supported outreach kinds in the operations backup.");
  }
  if (id === "messageLogs" && entries.some((entry) => typeof entry.status !== "string" || !supportedMessageLogStatuses.has(entry.status as MessageLog["status"]))) {
    throw new Error("messageLogs entries must use supported delivery statuses in the operations backup.");
  }
  if (
    id === "automationRuns" &&
    entries.some((entry) =>
      hasInvalidRequiredStringField(entry, "ranAt") ||
      typeof entry.status !== "string" ||
      !supportedTextAutomationRunStatuses.has(entry.status as TextAutomationRun["status"]) ||
      !isNonnegativeFiniteNumber(entry.totalQueued) ||
      entry.deliveryProvider !== "twilio" ||
      entry.deliveryChannel !== "sms" ||
      entry.deliveryMode !== "prototype" ||
      entry.relayPayloadSchemaVersion !== "chos-twilio-relay.v1" ||
      !Array.isArray(entry.breakdown) ||
      entry.breakdown.some((item: unknown) =>
        !isRecord(item) ||
        typeof item.key !== "string" ||
        !supportedTextAutomationRunKeys.has(item.key as TextAutomationRunKey) ||
        hasInvalidRequiredStringField(item, "label") ||
        !isNonnegativeFiniteNumber(item.queued)
      )
    )
  ) {
    throw new Error("automationRuns entries must include valid Twilio scheduler audit fields in the operations backup.");
  }
  if (
    id === "messageCampaigns" &&
    entries.some((entry) =>
      requiredMessageCampaignStringFields.some((field) => hasInvalidRequiredStringField(entry, field)) ||
      typeof entry.audience !== "string" ||
      !supportedMessageCampaignAudiences.has(entry.audience as MessageCampaign["audience"])
    )
  ) {
    throw new Error("messageCampaigns entries must include valid campaign fields in the operations backup.");
  }
  if (
    id === "scheduledTextCampaigns" &&
    entries.some((entry) =>
      requiredScheduledTextCampaignStringFields.some((field) => hasInvalidRequiredStringField(entry, field)) ||
      optionalScheduledTextCampaignStringFields.some((field) => hasInvalidOptionalStringField(entry, field)) ||
      (entry.scheduledTime !== undefined && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.scheduledTime.trim())) ||
      typeof entry.audience !== "string" ||
      !supportedMessageCampaignAudiences.has(entry.audience as MessageCampaign["audience"]) ||
      typeof entry.status !== "string" ||
      !supportedScheduledTextCampaignStatuses.has(entry.status as ScheduledTextCampaign["status"])
    )
  ) {
    throw new Error("scheduledTextCampaigns entries must include valid scheduled promotion fields in the operations backup.");
  }
  if (
    id === "directMessages" &&
    entries.some((entry) =>
      requiredDirectMessageStringFields.some((field) => hasInvalidRequiredStringField(entry, field)) ||
      entry.status !== "sent" ||
      entry.senderId === entry.recipientId ||
      entry.threadId !== [entry.senderId, entry.recipientId].sort().join("__")
    )
  ) {
    throw new Error("directMessages entries must include valid sent direct message fields in the operations backup.");
  }
  if (
    id === "studioClasses" &&
    entries.some((entry) =>
      requiredStudioClassStringFields.some((field) => hasMissingStringField(entry, field)) ||
      !isSupportedClassWeekdayList(entry.daysOfWeek) ||
      entry.startTime >= entry.endTime ||
      (entry.recurring !== undefined && typeof entry.recurring !== "boolean")
    )
  ) {
    throw new Error("studioClasses entries must include valid class schedule fields in the operations backup.");
  }
  if (id === "scheduledClasses" && entries.some((entry) => requiredScheduledClassStringFields.some((field) => hasMissingStringField(entry, field)))) {
    throw new Error("scheduledClasses entries must include required scheduling fields in the operations backup.");
  }
  if (
    id === "scheduledClasses" &&
    entries.some((entry) =>
      requiredScheduledClassStringFields.some((field) => hasPaddedStringField(entry, field)) ||
      optionalScheduledClassStringFields.some((field) => entry[field] !== undefined && (typeof entry[field] !== "string" || hasPaddedStringField(entry, field))) ||
      (entry.recurring !== undefined && typeof entry.recurring !== "boolean")
    )
  ) {
    throw new Error("scheduledClasses entries must include valid scheduling fields in the operations backup.");
  }
  if (id === "studioEvents" && entries.some((entry) => requiredStudioEventStringFields.some((field) => hasMissingStringField(entry, field)) || typeof entry.details !== "string")) {
    throw new Error("studioEvents entries must include required event fields in the operations backup.");
  }
  if (id === "studioEvents" && entries.some((entry) => typeof entry.audience !== "string" || !supportedStudioEventAudiences.has(entry.audience as StudioEvent["audience"]))) {
    throw new Error("studioEvents entries must use supported audiences in the operations backup.");
  }
  if (id === "checkIns" && entries.some((entry) => requiredCheckInStringFields.some((field) => hasMissingStringField(entry, field)))) {
    throw new Error("checkIns entries must include required attendance fields in the operations backup.");
  }
  if (id === "trainingVideoFolders" && entries.some((entry) => requiredTrainingVideoFolderStringFields.some((field) => hasMissingStringField(entry, field)))) {
    throw new Error("trainingVideoFolders entries must include required library fields in the operations backup.");
  }
  if (
    id === "trainingVideoFolders" &&
    entries.some((entry) =>
      requiredTrainingVideoFolderStringFields.some((field) => hasPaddedStringField(entry, field)) ||
      optionalTrainingVideoFolderStringFields.some((field) => hasInvalidOptionalStringField(entry, field))
    )
  ) {
    throw new Error("trainingVideoFolders entries must include valid library fields in the operations backup.");
  }
  if (
    id === "trainingVideos" &&
    entries.some((entry) =>
      requiredTrainingVideoStringFields.some((field) => hasInvalidRequiredStringField(entry, field)) ||
      optionalTrainingVideoStringFields.some((field) => hasInvalidOptionalStringField(entry, field)) ||
      typeof entry.videoDataUrl !== "string" ||
      !entry.videoDataUrl.startsWith("data:video/") ||
      !isSafeTrainingVideoFile({ mimeType: typeof entry.mimeType === "string" ? entry.mimeType : "", videoDataUrl: entry.videoDataUrl }) ||
      !isNonnegativeFiniteNumber(entry.size)
    )
  ) {
    throw new Error("trainingVideos entries must include valid uploaded video fields in the operations backup.");
  }
  if (id === "studyGuideFolders" && entries.some((entry) => requiredStudyGuideFolderStringFields.some((field) => hasMissingStringField(entry, field)))) {
    throw new Error("studyGuideFolders entries must include required library fields in the operations backup.");
  }
  if (
    id === "studyGuideFolders" &&
    entries.some((entry) =>
      requiredStudyGuideFolderStringFields.some((field) => hasPaddedStringField(entry, field)) ||
      optionalStudyGuideFolderStringFields.some((field) => hasInvalidOptionalStringField(entry, field))
    )
  ) {
    throw new Error("studyGuideFolders entries must include valid library fields in the operations backup.");
  }
  if (
    id === "studyGuideMaterials" &&
    entries.some((entry) =>
      requiredStudyGuideMaterialStringFields.some((field) => hasInvalidRequiredStringField(entry, field)) ||
      optionalStudyGuideMaterialStringFields.some((field) => hasInvalidOptionalStringField(entry, field)) ||
      typeof entry.fileDataUrl !== "string" ||
      !entry.fileDataUrl.startsWith("data:") ||
      !isSafeStudyMaterialFile({ mimeType: typeof entry.mimeType === "string" ? entry.mimeType : "", fileDataUrl: entry.fileDataUrl }) ||
      !isNonnegativeFiniteNumber(entry.size)
    )
  ) {
    throw new Error("studyGuideMaterials entries must include valid uploaded material fields in the operations backup.");
  }
  if (id === "managedAccounts" && entries.some((entry) => typeof entry.role !== "string" || !supportedManagedAccountRoles.has(entry.role as ManagedAccount["role"]))) {
    throw new Error("managedAccounts entries must use supported roles in the operations backup.");
  }
  if (id === "managedAccounts" && entries.some((entry) => requiredManagedAccountIdentityStringFields.some((field) => hasMissingStringField(entry, field)))) {
    throw new Error("managedAccounts entries must include required identity fields in the operations backup.");
  }
  if (id === "managedAccounts" && entries.some((entry) => typeof entry.status !== "string" || !supportedManagedAccountStatuses.has(entry.status as ManagedAccount["status"]))) {
    throw new Error("managedAccounts entries must use supported statuses in the operations backup.");
  }
  if (
    id === "managedAccounts" &&
    entries.some((entry) => !isSupportedManagerAccessList(entry.access))
  ) {
    throw new Error("managedAccounts entries must include supported access lists in the operations backup.");
  }
  if (
    id === "managedAccounts" &&
    entries.some((entry) => entry.role === "student" && Array.isArray(entry.access) && entry.access.length > 0)
  ) {
    throw new Error("Student managedAccounts entries cannot include staff access in the operations backup.");
  }
  if (id === "messagingSetup") {
    validateProductionMessagingSetupEntries(entries as Record<string, unknown>[]);
  }
  return entries;
}

function validateBackupSectionCompleteness(data: Record<string, unknown>) {
  const missingSections = backupSections.filter((section) => data[section.id] === undefined && !optionalRestoreSectionIds.has(section.id)).map((section) => section.id);
  if (missingSections.length) {
    throw new Error(`Backup file is missing required operations sections: ${missingSections.join(", ")}.`);
  }
}

function validateUniqueLoginUsernames(data: Pick<OperationsBackupData, "managedAccounts" | "childAccounts">) {
  const usernames = [...data.managedAccounts, ...data.childAccounts].map(normalizedBackupUsername);
  const uniqueUsernames = new Set(usernames);
  if (uniqueUsernames.size !== usernames.length) {
    throw new Error("Account usernames must be unique across restored login records.");
  }
  if (usernames.some((username) => builtInLoginUsernames.has(username))) {
    throw new Error("Custom login usernames cannot collide with built-in prototype logins in the operations backup.");
  }
}

function validateRegisteredAccountLoginIdentityCollisions(data: {
  accounts: readonly Record<string, unknown>[];
  managedAccounts: readonly ManagedAccountBackup[];
  childAccounts: readonly ChildAccountBackup[];
}) {
  const customLoginUsernames = new Set([
    ...data.managedAccounts.map((account) => account.username.trim().toLowerCase()),
    ...data.childAccounts.map((child) => child.username.trim().toLowerCase())
  ]);
  if (data.accounts.some((account) => customLoginUsernames.has((account.email as string).trim().toLowerCase()))) {
    throw new Error("Registered accounts cannot collide with restored custom login usernames in the operations backup.");
  }
}

function validateAccountRecords(accounts: readonly Record<string, unknown>[]) {
  const emails = accounts.map((record) => (typeof record.email === "string" ? record.email.trim().toLowerCase() : ""));
  if (new Set(emails).size !== emails.length) {
    throw new Error("accounts entries must have unique emails in the operations backup.");
  }
  if (emails.some((email) => builtInLoginIdentities.has(email))) {
    throw new Error("Registered accounts cannot collide with built-in prototype identities in the operations backup.");
  }
}

function validateAccountRoleRecords(accountRoles: readonly Record<string, unknown>[]) {
  const emails = accountRoles.map((record) => (typeof record.email === "string" ? record.email.trim().toLowerCase() : ""));
  if (emails.some((email) => !email)) {
    throw new Error("accountRoles entries must include string emails in the operations backup.");
  }
  if (accountRoles.some((record) => hasPaddedStringField(record, "email"))) {
    throw new Error("accountRoles entries must use trimmed emails in the operations backup.");
  }
  if (accountRoles.some((record) => typeof record.role !== "string" || !supportedAccountRoles.has(record.role as AccountRole))) {
    throw new Error("accountRoles entries must use supported roles in the operations backup.");
  }
  if (new Set(emails).size !== emails.length) {
    throw new Error("accountRoles entries must have unique emails in the operations backup.");
  }
  if (
    accountRoles.some((record) => {
      const email = (record.email as string).trim().toLowerCase();
      const reservedRole = builtInLoginRoles.get(email);
      return reservedRole !== undefined && record.role !== reservedRole;
    })
  ) {
    throw new Error("Built-in prototype accountRoles must match their reserved roles in the operations backup.");
  }
}

function validateAccountRoleIdentities(data: {
  accounts: readonly Record<string, unknown>[];
  accountRoles: readonly Record<string, unknown>[];
  managedAccounts: readonly ManagedAccountBackup[];
  childAccounts: readonly ChildAccountBackup[];
}) {
  const loginIdentities = new Set([
    ...builtInLoginIdentities,
    ...data.accounts.map((account) => (account.email as string).trim().toLowerCase()),
    ...data.managedAccounts.map((account) => account.username.trim().toLowerCase()),
    ...data.childAccounts.map((child) => child.username.trim().toLowerCase())
  ]);
  const hasOrphanedRole = data.accountRoles.some((record) => !loginIdentities.has((record.email as string).trim().toLowerCase()));
  if (hasOrphanedRole) {
    throw new Error("accountRoles entries can only reference restored login identities in the operations backup.");
  }
}

function validateAccountRoleConsistency(data: {
  accounts: readonly Record<string, unknown>[];
  accountRoles: readonly Record<string, unknown>[];
  managedAccounts: readonly ManagedAccountBackup[];
  childAccounts: readonly ChildAccountBackup[];
}) {
  const expectedRoles = new Map<string, AccountRole>(builtInLoginRoles);
  data.accounts.forEach((account) => expectedRoles.set((account.email as string).trim().toLowerCase(), registeredBackupAccountRole(account)));
  data.managedAccounts.forEach((account) => expectedRoles.set(account.username.trim().toLowerCase(), account.role));
  data.childAccounts.forEach((child) => expectedRoles.set(child.username.trim().toLowerCase(), "student"));

  const hasMismatchedRole = data.accountRoles.some((record) => {
    const expectedRole = expectedRoles.get((record.email as string).trim().toLowerCase());
    return expectedRole !== undefined && record.role !== expectedRole;
  });
  if (hasMismatchedRole) {
    throw new Error("accountRoles entries must match restored login account roles in the operations backup.");
  }
}

function validateChildAccountParentIdentities(data: {
  accounts: readonly Record<string, unknown>[];
  accountRoles: readonly Record<string, unknown>[];
  childAccounts: readonly ChildAccountBackup[];
}) {
  const registeredAccountEmails = new Set(data.accounts.map((account) => (account.email as string).trim().toLowerCase()));
  const guardianIdentities = new Set([
    ...builtInGuardianLoginIdentities,
    ...registeredAccountEmails,
    ...data.accountRoles
      .filter((record) => record.role === "guardian" && registeredAccountEmails.has((record.email as string).trim().toLowerCase()))
      .map((record) => (record.email as string).trim().toLowerCase())
  ]);
  if (data.childAccounts.some((child) => !guardianIdentities.has(child.parentEmail.trim().toLowerCase()))) {
    throw new Error("childAccounts entries can only reference restored guardian parent identities in the operations backup.");
  }
}

function validateRestoredReferences(data: OperationsBackupData) {
  const studentIds = new Set(data.students.map((student) => student.id));
  const activeStudentIds = new Set(data.students.filter(isCurrentRestoredStudent).map((student) => student.id));
  const campaignIds = new Set(data.messageCampaigns.map((campaign) => campaign.id));
  const videoFolderIds = new Set(data.trainingVideoFolders.map((folder) => folder.id));
  const studyGuideFolderIds = new Set(data.studyGuideFolders.map((folder) => folder.id));

  if (hasBrokenOptionalReference(data.managedAccounts, (account) => account.studentId, studentIds)) {
    throw new Error("managedAccounts entries can only reference restored students in the operations backup.");
  }
  if (data.managedAccounts.some((account) => account.role === "student" && account.status === "active" && !account.studentId?.trim())) {
    throw new Error("Active student managedAccounts entries must reference restored students in the operations backup.");
  }
  if (
    data.managedAccounts.some((account) =>
      account.role === "student" &&
      account.status === "active" &&
      Boolean(account.studentId?.trim()) &&
      !activeStudentIds.has(account.studentId?.trim() ?? "")
    )
  ) {
    throw new Error("Active student managedAccounts entries can only reference restored active students in the operations backup.");
  }
  if (hasBrokenOptionalReference(data.scheduledClasses, (scheduledClass) => scheduledClass.studentId, studentIds)) {
    throw new Error("scheduledClasses entries can only reference restored students in the operations backup.");
  }
  if (hasBrokenOptionalReference(data.scheduledClasses, (scheduledClass) => scheduledClass.studentId, activeStudentIds)) {
    throw new Error("scheduledClasses entries can only reference restored active students in the operations backup.");
  }
  if (hasBrokenRequiredReference(data.checkIns, (checkIn) => checkIn.studentId, studentIds)) {
    throw new Error("checkIns entries can only reference restored students in the operations backup.");
  }
  if (hasDuplicateCheckInDatePairs(data.checkIns)) {
    throw new Error("checkIns entries must have unique student date pairs in the operations backup.");
  }
  if (hasBrokenOptionalReference(data.messageLogs, (messageLog) => messageLog.campaignId, campaignIds)) {
    throw new Error("messageLogs entries can only reference restored message campaigns in the operations backup.");
  }
  if (hasBrokenOptionalReference(data.scheduledTextCampaigns, (campaign) => campaign.campaignId, campaignIds)) {
    throw new Error("scheduledTextCampaigns entries can only reference restored message campaigns in the operations backup.");
  }
  if (data.messageLogs.some((messageLog) => messageLog.status === "queued" && !isRestoredQueuedMessageDeliverable(messageLog, data.students, data.managedAccounts as ManagedAccount[]))) {
    throw new Error("Queued messageLogs entries can only reference restored active recipients in the operations backup.");
  }
  if (
    data.directMessages.some((message) =>
      !isRestoredDirectMessageParticipantAvailable(message.senderId, activeStudentIds) ||
      !isRestoredDirectMessageParticipantAvailable(message.recipientId, activeStudentIds)
    )
  ) {
    throw new Error("directMessages entries can only reference restored active chat participants in the operations backup.");
  }
  if (hasBrokenRequiredReference(data.trainingVideos, (video) => video.folderId, videoFolderIds)) {
    throw new Error("trainingVideos entries can only reference restored video folders in the operations backup.");
  }
  if (hasBrokenOptionalReference(data.studyGuideFolders, (folder) => folder.parentId, studyGuideFolderIds)) {
    throw new Error("studyGuideFolders entries can only reference restored study guide folders in the operations backup.");
  }
  if (hasBrokenRequiredReference(data.studyGuideMaterials, (material) => material.folderId, studyGuideFolderIds)) {
    throw new Error("studyGuideMaterials entries can only reference restored study guide folders in the operations backup.");
  }
}

export function parseOperationsBackupSnapshot(raw: string): OperationsRestoreSnapshot {
  const parsed = parseBackupJson(raw);
  if (!isRecord(parsed) || parsed.schemaVersion !== "chos-operations-backup.v1") {
    throw new Error("Unsupported backup schema. Choose a Cho's operations backup JSON file.");
  }
  if (!isRecord(parsed.data)) {
    throw new Error("Backup file is missing operations data.");
  }

  const data: OperationsBackupData = {
    accounts: readBackupArray(parsed.data, "accounts"),
    accountRoles: readBackupArray(parsed.data, "accountRoles"),
    managedAccounts: readBackupArray(parsed.data, "managedAccounts") as OperationsBackupData["managedAccounts"],
    childAccounts: readBackupArray(parsed.data, "childAccounts") as OperationsBackupData["childAccounts"],
    students: readBackupArray(parsed.data, "students") as OperationsBackupData["students"],
    studioClasses: readBackupArray(parsed.data, "studioClasses") as OperationsBackupData["studioClasses"],
    scheduledClasses: readBackupArray(parsed.data, "scheduledClasses") as OperationsBackupData["scheduledClasses"],
    messageCampaigns: readBackupArray(parsed.data, "messageCampaigns") as OperationsBackupData["messageCampaigns"],
    scheduledTextCampaigns: readBackupArray(parsed.data, "scheduledTextCampaigns") as OperationsBackupData["scheduledTextCampaigns"],
    messageLogs: readBackupArray(parsed.data, "messageLogs") as OperationsBackupData["messageLogs"],
    automationRuns: readBackupArray(parsed.data, "automationRuns") as OperationsBackupData["automationRuns"],
    directMessages: readBackupArray(parsed.data, "directMessages") as OperationsBackupData["directMessages"],
    messagingSetup: readBackupArray(parsed.data, "messagingSetup") as OperationsBackupData["messagingSetup"],
    studioEvents: readBackupArray(parsed.data, "studioEvents") as OperationsBackupData["studioEvents"],
    merchandiseItems: readBackupArray(parsed.data, "merchandiseItems") as OperationsBackupData["merchandiseItems"],
    checkIns: readBackupArray(parsed.data, "checkIns") as OperationsBackupData["checkIns"],
    trainingVideoFolders: readBackupArray(parsed.data, "trainingVideoFolders") as OperationsBackupData["trainingVideoFolders"],
    trainingVideos: readBackupArray(parsed.data, "trainingVideos") as OperationsBackupData["trainingVideos"],
    studyGuideFolders: readBackupArray(parsed.data, "studyGuideFolders") as OperationsBackupData["studyGuideFolders"],
    studyGuideMaterials: readBackupArray(parsed.data, "studyGuideMaterials") as OperationsBackupData["studyGuideMaterials"],
    orders: readBackupArray(parsed.data, "orders") as OperationsBackupData["orders"],
    bookings: readBackupArray(parsed.data, "bookings") as OperationsBackupData["bookings"],
    contacts: readBackupArray(parsed.data, "contacts") as OperationsBackupData["contacts"],
    leadReviews: readBackupArray(parsed.data, "leadReviews") as OperationsBackupData["leadReviews"]
  };
  validateBackupSectionCompleteness(parsed.data);
  const accountRecords = data.accounts as readonly Record<string, unknown>[];
  const accountRoleRecords = data.accountRoles as readonly Record<string, unknown>[];
  validateAccountRecords(accountRecords);
  validateAccountRoleRecords(accountRoleRecords);
  validateAccountRoleIdentities({
    accounts: accountRecords,
    accountRoles: accountRoleRecords,
    managedAccounts: data.managedAccounts,
    childAccounts: data.childAccounts
  });
  validateAccountRoleConsistency({
    accounts: accountRecords,
    accountRoles: accountRoleRecords,
    managedAccounts: data.managedAccounts,
    childAccounts: data.childAccounts
  });
  validateUniqueLoginUsernames(data);
  validateRegisteredAccountLoginIdentityCollisions({
    accounts: accountRecords,
    managedAccounts: data.managedAccounts,
    childAccounts: data.childAccounts
  });
  validateChildAccountParentIdentities({
    accounts: accountRecords,
    accountRoles: accountRoleRecords,
    childAccounts: data.childAccounts
  });
  validateRestoredReferences(data);
  const sections = backupSections.map((section) => ({
    ...section,
    count: data[section.id].length
  }));
  const totalRecords = sections.reduce((total, section) => total + section.count, 0);

  return {
    schemaVersion: "chos-operations-backup.v1",
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    summary: {
      sections: sections.length,
      totalRecords,
      emptySections: sections.filter((section) => section.count === 0).length
    },
    sections,
    data
  };
}
