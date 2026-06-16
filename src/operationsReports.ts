import { buildStudentBeltProgress } from "./studentProgress";
import type { BookingDetails, ContactSubmission, DirectMessage, LeadReview, ManagedAccount, MerchandiseItem, MessageLog, ScheduledClass, StudentCheckIn, StudentRecord, StudioClass, StudioEvent } from "./types";

export type ReportsPriorityAction = {
  id: string;
  title: string;
  detail: string;
  count: number;
  path: string;
  tone: "danger" | "warning" | "info" | "success";
};

export type ReportsStudentRisk = {
  id: string;
  name: string;
  missedClassCount: number;
  lastContactedAt?: string;
  status: string;
};

export type ReportsAttendanceGapCandidate = {
  id: string;
  name: string;
  lastAttendanceDate: string;
  daysSinceAttendance: number;
  lastContactedAt?: string;
};

export type ReportsLowStockItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  reorderPoint: number;
  targetStock: number;
  restockQuantity: number;
};

export type ReportsTestCandidate = {
  id: string;
  name: string;
  beltRank: string;
  classesAttended: number;
  classesRequired: number;
  classesOverRequirement: number;
  lastContactedAt?: string;
};

export type ReportsMilestoneCandidate = {
  id: string;
  name: string;
  beltRank: string;
  nextRankName?: string;
  progressPercent: number;
  classesAttended: number;
  classesRequired: number;
  classesRemaining: number;
  lastContactedAt?: string;
};

export type ReportsCelebrationReason = "birthday" | "anniversary";

export type ReportsCelebrationCandidate = {
  id: string;
  name: string;
  reason: ReportsCelebrationReason;
  daysAway: number;
  date: string;
  years?: number;
  lastContactedAt?: string;
};

type ReportsCelebrationEvent = Omit<ReportsCelebrationCandidate, "id" | "name" | "lastContactedAt">;

export type ReportsNewStudentCheckInCandidate = {
  id: string;
  name: string;
  joinedAt: string;
  daysSinceJoin: number;
  program?: string;
  lastContactedAt?: string;
};

export type ReportsLeadCandidate = {
  id: string;
  kind: "contact" | "booking";
  name: string;
  detail: string;
  note: string;
  date: string;
};

export type ReportsDirectMessageReplyCandidate = {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  studentId: string;
  studentName: string;
  body: string;
  createdAt: string;
};

export type ReportsProfileUpdateCandidate = {
  id: string;
  name: string;
  issues: string[];
  issueCount: number;
  lastContactedAt?: string;
};

export type ReportsClassReminderCandidate = {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  date: string;
  time: string;
  daysAway: number;
  lastContactedAt?: string;
};

export type ReportsCalendarItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "schedule" | "event";
};

export type ReportsCommandCenter = {
  summary: {
    currentStudents: number;
    attendanceFollowUps: number;
    trialFollowUps: number;
    leadFollowUps: number;
    directMessageReplies: number;
    newStudentCheckIns: number;
    attendanceGapFollowUps: number;
    pausedFollowUps: number;
    celebrationOutreach: number;
    profileUpdateRequests: number;
    classReminders: number;
    milestoneEncouragements: number;
    testReadinessFollowUps: number;
    checkInsThisWeek: number;
    queuedMessages: number;
    staleQueuedMessages: number;
    upcomingCalendarItems: number;
    lowStockItems: number;
    staleScheduleItems: number;
  };
  priorityActions: ReportsPriorityAction[];
  attendanceRisks: ReportsStudentRisk[];
  attendanceGapCandidates: ReportsAttendanceGapCandidate[];
  leadCandidates: ReportsLeadCandidate[];
  directMessageReplyCandidates: ReportsDirectMessageReplyCandidate[];
  newStudentCheckInCandidates: ReportsNewStudentCheckInCandidate[];
  celebrationCandidates: ReportsCelebrationCandidate[];
  profileUpdateCandidates: ReportsProfileUpdateCandidate[];
  classReminderCandidates: ReportsClassReminderCandidate[];
  milestoneCandidates: ReportsMilestoneCandidate[];
  testReadinessCandidates: ReportsTestCandidate[];
  lowStockItems: ReportsLowStockItem[];
  upcomingCalendarItems: ReportsCalendarItem[];
};

type ReportsCommandCenterInput = {
  today: string;
  students: StudentRecord[];
  checkIns: StudentCheckIn[];
  scheduledClasses: ScheduledClass[];
  studioClasses: StudioClass[];
  studioEvents: StudioEvent[];
  messageLogs: MessageLog[];
  managedAccounts?: ManagedAccount[];
  merchandiseItems: MerchandiseItem[];
  bookings?: BookingDetails[];
  contacts?: ContactSubmission[];
  leadReviews?: LeadReview[];
  directMessages?: DirectMessage[];
};

function fullName(student: Pick<StudentRecord, "firstName" | "lastName">) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDateBetween(dateKey: string, startKey: string, endKey: string) {
  return dateKey >= startKey && dateKey <= endKey;
}

function daysBetween(startKey: string, endKey: string) {
  const startDate = parseDateKey(startKey);
  const endDate = parseDateKey(endKey);
  if (!startDate || !endDate) return undefined;
  const startUtc = Date.UTC(startDate.year, startDate.month - 1, startDate.day);
  const endUtc = Date.UTC(endDate.year, endDate.month - 1, endDate.day);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

function parseDateKey(dateKey: string | undefined) {
  const match = dateKey?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const parsed = {
    year: Number(year),
    month: Number(month),
    day: Number(day)
  };
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  if (date.getUTCFullYear() !== parsed.year || date.getUTCMonth() !== parsed.month - 1 || date.getUTCDate() !== parsed.day) return undefined;
  return parsed;
}

function annualEventWindow(sourceDateKey: string | undefined, today: string) {
  const sourceDate = parseDateKey(sourceDateKey);
  const todayDate = parseDateKey(today);
  if (!sourceDate || !todayDate) return undefined;
  const todayUtc = Date.UTC(todayDate.year, todayDate.month - 1, todayDate.day);
  let eventYear = todayDate.year;
  let eventUtc = Date.UTC(eventYear, sourceDate.month - 1, sourceDate.day);
  if (eventUtc < todayUtc) {
    eventYear += 1;
    eventUtc = Date.UTC(eventYear, sourceDate.month - 1, sourceDate.day);
  }

  const eventDate = new Date(eventUtc);
  return {
    date: eventDate.toISOString().slice(0, 10),
    daysAway: Math.round((eventUtc - todayUtc) / 86_400_000),
    years: eventYear - sourceDate.year
  };
}

function studentStatus(student: StudentRecord) {
  return (student.status?.trim() || "Active").toLowerCase();
}

function isCurrentStudent(student: StudentRecord) {
  return studentStatus(student) !== "inactive";
}

function normalizeMessagePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits || value.trim().toLowerCase();
}

function hasSmsOptOut(value?: string) {
  return Boolean(value?.trim());
}

function hasSmsOptIn(consentUpdatedAt?: string, optOutAt?: string) {
  return Boolean(consentUpdatedAt?.trim() && !hasSmsOptOut(optOutAt));
}

export function hasStudentSmsConsent(student: Pick<StudentRecord, "studentSmsOptOutAt" | "studentSmsConsentUpdatedAt" | "smsConsentUpdatedAt">) {
  return hasSmsOptIn(student.studentSmsConsentUpdatedAt ?? student.smsConsentUpdatedAt, student.studentSmsOptOutAt);
}

export function hasGuardianSmsConsent(student: Pick<StudentRecord, "guardianSmsOptOutAt" | "guardianSmsConsentUpdatedAt" | "smsConsentUpdatedAt">) {
  return hasSmsOptIn(student.guardianSmsConsentUpdatedAt ?? student.smsConsentUpdatedAt, student.guardianSmsOptOutAt);
}

export function hasStaffSmsConsent(account: Pick<ManagedAccount, "smsOptOutAt" | "smsConsentUpdatedAt">) {
  return hasSmsOptIn(account.smsConsentUpdatedAt, account.smsOptOutAt);
}

function slugId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "lead";
}

function dateKeyFromTimestamp(value: string) {
  const cleanValue = value.trim();
  return cleanValue.includes("T") ? cleanValue.slice(0, 10) : cleanValue;
}

function contactMethodSummary(contact: ContactSubmission) {
  const phone = contact.phone.trim();
  const email = contact.email.trim();
  if (phone && email) return `${phone} · ${email}`;
  return phone || email;
}

function isExistingStudentContactLead(contact: ContactSubmission, students: readonly StudentRecord[]) {
  const contactEmail = contact.email.trim().toLowerCase();
  const contactPhone = normalizeMessagePhone(contact.phone);
  return students.some(
    (student) =>
      isCurrentStudent(student) &&
      ((contactEmail && student.email.trim().toLowerCase() === contactEmail) ||
        (contactPhone && normalizeMessagePhone(student.phone) === contactPhone))
  );
}

export function getLeadCandidates(input: Pick<ReportsCommandCenterInput, "bookings" | "contacts" | "leadReviews" | "students">) {
  const reviewedLeadIds = new Set((input.leadReviews ?? []).map((review) => review.leadId.trim()).filter(Boolean));
  const contactCandidates = (input.contacts ?? [])
    .flatMap((contact): ReportsLeadCandidate[] => {
      const id = contact.id.trim();
      const name = contact.name.trim();
      const detail = contactMethodSummary(contact);
      const note = contact.message.trim();
      const createdAt = contact.createdAt.trim();
      if (!id || !name || !detail || !note || !createdAt || reviewedLeadIds.has(id) || isExistingStudentContactLead(contact, input.students)) return [];
      return [{
        id,
        kind: "contact",
        name,
        detail,
        note,
        date: dateKeyFromTimestamp(createdAt)
      }];
    })
    .sort((left, right) => right.date.localeCompare(left.date) || left.name.localeCompare(right.name));

  const bookingCandidates = (input.bookings ?? [])
    .flatMap((booking, index): ReportsLeadCandidate[] => {
      const date = booking.date.trim();
      const time = booking.time.trim();
      if (!date || !time || !Number.isInteger(booking.persons) || booking.persons <= 0) return [];
      const id = `booking-${slugId(`${date}-${time}-${index}`)}`;
      if (reviewedLeadIds.has(id)) return [];
      return [{
        id,
        kind: "booking",
        name: `Starter booking ${date}`,
        detail: `${time} · ${booking.persons} ${booking.persons === 1 ? "person" : "people"}`,
        note: "Starter program reservation",
        date
      }];
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.detail.localeCompare(right.detail));

  return [...contactCandidates, ...bookingCandidates];
}

export function isQueuedMessageDeliverable(
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
        hasStaffSmsConsent(account) &&
        account.displayName.trim().toLowerCase() === recipientName &&
        normalizeMessagePhone(account.phone ?? "") === recipientPhone
    );
  }
  if (message.recipientRole === "parent") {
    return students.some((student) => {
      if (!isCurrentStudent(student)) return false;
      const parentId = `parent-${student.id}`;
      const guardianName = (student.guardianName?.trim() || `${fullName(student)} Parent/Guardian`).toLowerCase();
      const guardianPhone = normalizeMessagePhone(student.guardianPhone ?? "");
      return (
        hasGuardianSmsConsent(student) &&
        (message.recipientId === parentId || guardianName === recipientName) &&
        guardianPhone === recipientPhone
      );
    });
  }
  const studentMatch = students.some(
    (student) =>
      isCurrentStudent(student) &&
      hasStudentSmsConsent(student) &&
      fullName(student).trim().toLowerCase() === recipientName &&
      normalizeMessagePhone(student.phone) === recipientPhone
  );
  if (message.recipientRole === "student") return studentMatch;
  return (
    studentMatch ||
    students.some(
      (student) =>
        isCurrentStudent(student) &&
        hasGuardianSmsConsent(student) &&
        (student.guardianName?.trim().toLowerCase() || "") === recipientName &&
        normalizeMessagePhone(student.guardianPhone ?? "") === recipientPhone
    ) ||
    managedAccounts.some(
      (account) =>
        account.role === "staff" &&
        account.status === "active" &&
        hasStaffSmsConsent(account) &&
        account.displayName.trim().toLowerCase() === recipientName &&
        normalizeMessagePhone(account.phone ?? "") === recipientPhone
    )
  );
}

function isStaffDirectMessageParticipant(participantId: string) {
  return participantId.trim().toLowerCase().startsWith("direct-staff-");
}

function directMessageStudentIdForParticipant(participantId: string) {
  const id = participantId.trim();
  return id.startsWith("parent-") ? id.slice("parent-".length) : id;
}

export function getDirectMessageReplyCandidates(directMessages: readonly DirectMessage[] | undefined, students: readonly StudentRecord[]) {
  const currentStudentsById = new Map(students.filter(isCurrentStudent).map((student) => [student.id, student]));
  const latestMessagesByThread = new Map<string, DirectMessage>();

  (directMessages ?? []).forEach((message) => {
    const threadId = message.threadId.trim();
    const createdAt = message.createdAt.trim();
    if (message.status !== "sent" || !threadId || !createdAt) return;
    const previous = latestMessagesByThread.get(threadId);
    if (!previous || createdAt.localeCompare(previous.createdAt) > 0 || (createdAt === previous.createdAt && message.id.localeCompare(previous.id) > 0)) {
      latestMessagesByThread.set(threadId, message);
    }
  });

  return [...latestMessagesByThread.values()]
    .flatMap((message): ReportsDirectMessageReplyCandidate[] => {
      if (!isStaffDirectMessageParticipant(message.recipientId) || isStaffDirectMessageParticipant(message.senderId)) return [];
      const student = currentStudentsById.get(directMessageStudentIdForParticipant(message.senderId));
      const body = message.body.trim();
      if (!student || !body) return [];
      return [{
        id: message.id,
        threadId: message.threadId,
        senderId: message.senderId,
        senderName: message.senderName.trim() || fullName(student),
        studentId: student.id,
        studentName: fullName(student),
        body,
        createdAt: message.createdAt.trim()
      }];
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.senderName.localeCompare(right.senderName));
}

export function getMerchandiseReorderPoint(item: MerchandiseItem) {
  return Number.isFinite(item.reorderPoint) && item.reorderPoint !== undefined && item.reorderPoint >= 0 ? Math.floor(item.reorderPoint) : 3;
}

export function getMerchandiseTargetStock(item: MerchandiseItem) {
  const reorderPoint = getMerchandiseReorderPoint(item);
  const targetStock = Number.isFinite(item.targetStock) && item.targetStock !== undefined && item.targetStock >= 0 ? Math.floor(item.targetStock) : 8;
  return Math.max(targetStock, reorderPoint + 1);
}

export function isLowStockMerchandiseItem(item: MerchandiseItem) {
  return item.stock <= getMerchandiseReorderPoint(item) && getMerchandiseTargetStock(item) > item.stock;
}

export function isStaleOneTimeScheduledClass(item: ScheduledClass, today: string) {
  return !item.recurring && item.date < today;
}

export function isMissedClassFollowUpDue(student: StudentRecord, today: string) {
  return isCurrentStudent(student) && student.missedClassCount >= 3 && Boolean(student.phone.trim()) && student.lastContactedAt !== today;
}

function attendanceActivityDate(student: StudentRecord) {
  return dateKeyFromTimestamp(student.lastCheckIn?.trim() || student.enrollmentDate?.trim() || student.joinedAt.trim());
}

function profileActivityDate(student: StudentRecord) {
  return dateKeyFromTimestamp(student.profileUpdatedAt?.trim() || student.enrollmentDate?.trim() || student.joinedAt.trim());
}

export function isAttendanceGapFollowUpDue(student: StudentRecord, today: string) {
  const lastAttendanceDate = attendanceActivityDate(student);
  const daysSinceAttendance = daysBetween(lastAttendanceDate, today);
  return Boolean(
    studentStatus(student) === "active" &&
      student.phone.trim() &&
      student.lastContactedAt !== today &&
      student.missedClassCount < 3 &&
      !isNewStudentCheckInDue(student, today) &&
      daysSinceAttendance !== undefined &&
      daysSinceAttendance >= 21
  );
}

export function isTrialConversionDue(student: StudentRecord, today: string) {
  return isCurrentStudent(student) && studentStatus(student) === "trial" && Boolean(student.phone.trim()) && student.lastContactedAt !== today;
}

export function isNewStudentCheckInDue(student: StudentRecord, today: string) {
  const joinedAt = dateKeyFromTimestamp(student.enrollmentDate?.trim() || student.joinedAt.trim());
  const daysSinceJoin = daysBetween(joinedAt, today);
  return Boolean(
    studentStatus(student) === "active" &&
      student.phone.trim() &&
      student.lastContactedAt !== today &&
      daysSinceJoin !== undefined &&
      daysSinceJoin >= 5 &&
      daysSinceJoin <= 14
  );
}

export function isPausedStudentReviewDue(student: StudentRecord, today: string) {
  return isCurrentStudent(student) && studentStatus(student) === "paused" && Boolean(student.phone.trim()) && student.lastContactedAt !== today;
}

export function isBeltTestInviteDue(student: StudentRecord, today: string) {
  const progress = buildStudentBeltProgress(student);
  return Boolean(
    progress.readyForReview &&
      studentStatus(student) === "active" &&
      student.phone.trim() &&
      student.lastContactedAt !== today &&
      student.missedClassCount <= 1
  );
}

export function isMilestoneEncouragementDue(student: StudentRecord, today: string) {
  const progress = buildStudentBeltProgress(student);
  return Boolean(
    !progress.readyForReview &&
      !progress.isBlackBelt &&
      progress.classesRequired > 0 &&
      progress.progressPercent >= 75 &&
      studentStatus(student) === "active" &&
      student.phone.trim() &&
      student.lastContactedAt !== today &&
      student.missedClassCount <= 1
  );
}

function celebrationReasonPriority(reason: ReportsCelebrationReason) {
  return reason === "birthday" ? 0 : 1;
}

function compareCelebrationEvents(left: ReportsCelebrationEvent, right: ReportsCelebrationEvent) {
  return (
    left.daysAway - right.daysAway ||
    celebrationReasonPriority(left.reason) - celebrationReasonPriority(right.reason) ||
    left.date.localeCompare(right.date)
  );
}

export function getStudentCelebrationEvents(student: StudentRecord, today: string) {
  if (!isCurrentStudent(student) || !student.phone.trim() || student.lastContactedAt === today) return [];
  const events: ReportsCelebrationEvent[] = [];
  const birthday = annualEventWindow(student.dateOfBirth, today);
  if (birthday && birthday.daysAway < 7) {
    events.push({ reason: "birthday", daysAway: birthday.daysAway, date: birthday.date });
  }

  const anniversary = annualEventWindow(student.joinedAt, today);
  if (anniversary && anniversary.daysAway < 7 && anniversary.years > 0) {
    events.push({ reason: "anniversary", daysAway: anniversary.daysAway, date: anniversary.date, years: anniversary.years });
  }

  const [nextEvent] = events.sort(compareCelebrationEvents);
  return nextEvent ? [nextEvent] : [];
}

export function getNewStudentCheckInCandidates(students: StudentRecord[], today: string) {
  return students
    .flatMap((student): ReportsNewStudentCheckInCandidate[] => {
      if (!isNewStudentCheckInDue(student, today)) return [];
      const joinedAt = dateKeyFromTimestamp(student.enrollmentDate?.trim() || student.joinedAt.trim());
      const daysSinceJoin = daysBetween(joinedAt, today);
      if (daysSinceJoin === undefined) return [];
      const program = student.program?.trim();
      return [{
        id: student.id,
        name: fullName(student),
        joinedAt,
        daysSinceJoin,
        program: program || undefined,
        lastContactedAt: student.lastContactedAt
      }];
    })
    .sort((left, right) => right.daysSinceJoin - left.daysSinceJoin || left.name.localeCompare(right.name));
}

export function getAttendanceGapCandidates(students: StudentRecord[], today: string) {
  return students
    .flatMap((student): ReportsAttendanceGapCandidate[] => {
      if (!isAttendanceGapFollowUpDue(student, today)) return [];
      const lastAttendanceDate = attendanceActivityDate(student);
      const daysSinceAttendance = daysBetween(lastAttendanceDate, today);
      if (daysSinceAttendance === undefined) return [];
      return [{
        id: student.id,
        name: fullName(student),
        lastAttendanceDate,
        daysSinceAttendance,
        lastContactedAt: student.lastContactedAt
      }];
    })
    .sort((left, right) => right.daysSinceAttendance - left.daysSinceAttendance || left.name.localeCompare(right.name));
}

export function getStudentProfileIssues(student: StudentRecord) {
  const issues: string[] = [];
  if (!student.dateOfBirth?.trim()) issues.push("Birth date missing");
  if (!student.guardianName?.trim()) issues.push("Guardian name missing");
  if (!student.guardianPhone?.trim()) issues.push("Guardian phone missing");
  if (!student.guardianEmail?.trim()) issues.push("Guardian email missing");
  if (!student.emergencyContactName?.trim()) issues.push("Emergency contact missing");
  if (!student.emergencyContactRelationship?.trim()) issues.push("Emergency relationship missing");
  if (!student.emergencyContactPhone?.trim()) issues.push("Emergency phone missing");
  return issues;
}

export function isAnnualProfileVerificationDue(student: StudentRecord, today: string) {
  const lastProfileDate = profileActivityDate(student);
  const daysSinceProfileUpdate = daysBetween(lastProfileDate, today);
  return daysSinceProfileUpdate !== undefined && daysSinceProfileUpdate >= 365;
}

export function getStudentProfileUpdateReasons(student: StudentRecord, today: string) {
  const issues = getStudentProfileIssues(student);
  return isAnnualProfileVerificationDue(student, today) ? [...issues, "Annual profile verification due"] : issues;
}

export function isProfileUpdateRequestDue(student: StudentRecord, today: string) {
  return isCurrentStudent(student) && Boolean(student.phone.trim()) && student.lastContactedAt !== today && getStudentProfileUpdateReasons(student, today).length > 0;
}

function reminderSortMinutes(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const [, hourText, minuteText, periodText] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) return Number.MAX_SAFE_INTEGER;
  const period = periodText.toUpperCase();
  const normalizedHour = period === "AM" ? hour % 12 : (hour % 12) + 12;
  return normalizedHour * 60 + minute;
}

function compareClassReminderCandidates(left: ReportsClassReminderCandidate, right: ReportsClassReminderCandidate) {
  return left.daysAway - right.daysAway ||
    reminderSortMinutes(left.time) - reminderSortMinutes(right.time) ||
    left.date.localeCompare(right.date) ||
    left.studentName.localeCompare(right.studentName) ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id);
}

export function getClassReminderCandidates(students: StudentRecord[], scheduledClasses: ScheduledClass[], today: string) {
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const nextReminderByStudent = new Map<string, ReportsClassReminderCandidate>();
  scheduledClasses
    .flatMap((item) => {
      if (!item.studentId) return [];
      const daysAway = daysBetween(today, item.date);
      if (daysAway === undefined || daysAway < 0 || daysAway > 2) return [];
      const student = studentsById.get(item.studentId);
      if (!student || !isCurrentStudent(student) || !student.phone.trim() || student.lastContactedAt === today) return [];
      return [{
        id: item.id,
        studentId: student.id,
        studentName: fullName(student),
        title: item.title,
        date: item.date,
        time: item.time,
        daysAway,
        lastContactedAt: student.lastContactedAt
      }];
    })
    .forEach((candidate) => {
      const previous = nextReminderByStudent.get(candidate.studentId);
      if (!previous || compareClassReminderCandidates(candidate, previous) < 0) {
        nextReminderByStudent.set(candidate.studentId, candidate);
      }
    });

  return [...nextReminderByStudent.values()].sort(compareClassReminderCandidates);
}

function namesSummary(names: string[], fallback: string) {
  if (!names.length) return fallback;
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

export function buildReportsCommandCenter(input: ReportsCommandCenterInput): ReportsCommandCenter {
  const currentStudents = input.students.filter(isCurrentStudent);
  const attendanceRisks = currentStudents
    .filter((student) => isMissedClassFollowUpDue(student, input.today))
    .map((student) => ({
      id: student.id,
      name: fullName(student),
      missedClassCount: student.missedClassCount,
      lastContactedAt: student.lastContactedAt,
      status: student.status?.trim() || "Active"
    }))
    .sort((left, right) => right.missedClassCount - left.missedClassCount || left.name.localeCompare(right.name));
  const attendanceGapCandidates = getAttendanceGapCandidates(currentStudents, input.today);
  const trialStudents = currentStudents.filter((student) => isTrialConversionDue(student, input.today));
  const newStudentCheckInCandidates = getNewStudentCheckInCandidates(currentStudents, input.today);
  const pausedStudents = currentStudents.filter((student) => isPausedStudentReviewDue(student, input.today));
  const leadCandidates = getLeadCandidates(input);
  const directMessageReplyCandidates = getDirectMessageReplyCandidates(input.directMessages, currentStudents);
  const celebrationCandidates = currentStudents
    .flatMap((student) =>
      getStudentCelebrationEvents(student, input.today).map((event) => ({
        id: student.id,
        name: fullName(student),
        lastContactedAt: student.lastContactedAt,
        ...event
      }))
    )
    .sort((left, right) => left.daysAway - right.daysAway || left.name.localeCompare(right.name) || left.reason.localeCompare(right.reason));
  const profileUpdateCandidates = currentStudents
    .filter((student) => isProfileUpdateRequestDue(student, input.today))
    .map((student) => {
      const issues = getStudentProfileUpdateReasons(student, input.today);
      return {
        id: student.id,
        name: fullName(student),
        issues,
        issueCount: issues.length,
        lastContactedAt: student.lastContactedAt
      };
    })
    .sort((left, right) => right.issueCount - left.issueCount || left.name.localeCompare(right.name));
  const classReminderCandidates = getClassReminderCandidates(currentStudents, input.scheduledClasses, input.today);
  const milestoneCandidates = currentStudents
    .filter((student) => isMilestoneEncouragementDue(student, input.today))
    .map((student) => {
      const progress = buildStudentBeltProgress(student);
      return {
        id: student.id,
        name: fullName(student),
        beltRank: progress.rankName,
        nextRankName: progress.nextRankName,
        progressPercent: progress.progressPercent,
        classesAttended: progress.classesAttended,
        classesRequired: progress.classesRequired,
        classesRemaining: progress.classesRemaining,
        lastContactedAt: student.lastContactedAt
      };
    })
    .sort((left, right) => right.progressPercent - left.progressPercent || left.classesRemaining - right.classesRemaining || left.name.localeCompare(right.name));
  const testReadinessCandidates = currentStudents
    .filter((student) => isBeltTestInviteDue(student, input.today))
    .map((student) => {
      const progress = buildStudentBeltProgress(student);
      return {
        id: student.id,
        name: fullName(student),
        beltRank: progress.rankName,
        classesAttended: progress.classesAttended,
        classesRequired: progress.classesRequired,
        classesOverRequirement: progress.classesOverRequirement,
        lastContactedAt: student.lastContactedAt
      };
    })
    .sort((left, right) => right.classesOverRequirement - left.classesOverRequirement || left.name.localeCompare(right.name));
  const lowStockItems = input.merchandiseItems
    .filter(isLowStockMerchandiseItem)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      stock: item.stock,
      reorderPoint: getMerchandiseReorderPoint(item),
      targetStock: getMerchandiseTargetStock(item),
      restockQuantity: getMerchandiseTargetStock(item) - item.stock
    }))
    .sort((left, right) => left.stock - right.stock || left.name.localeCompare(right.name));
  const weekStart = addDays(input.today, -6);
  const checkInsThisWeek = input.checkIns.filter((checkIn) => isDateBetween(checkIn.date, weekStart, input.today)).length;
  const calendarEnd = addDays(input.today, 7);
  const upcomingCalendarItems = [
    ...input.scheduledClasses
      .filter((item) => isDateBetween(item.date, input.today, calendarEnd))
      .map((item) => ({ id: item.id, title: item.title, date: item.date, time: item.time, kind: "schedule" as const })),
    ...input.studioEvents
      .filter((event) => isDateBetween(event.date, input.today, calendarEnd))
      .map((event) => ({ id: event.id, title: event.title, date: event.date, time: event.time, kind: "event" as const }))
  ].sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
  const deliverableQueuedMessages = input.messageLogs.filter((message) => message.status === "queued" && isQueuedMessageDeliverable(message, input.students, input.managedAccounts));
  const staleQueuedMessages = input.messageLogs.filter((message) => message.status === "queued" && !isQueuedMessageDeliverable(message, input.students, input.managedAccounts));
  const queuedMessages = deliverableQueuedMessages.length;
  const queuedMessageNames = deliverableQueuedMessages.map((message) => message.recipientName);
  const staleQueuedMessageNames = staleQueuedMessages.map((message) => message.recipientName);
  const staleScheduleItems = input.scheduledClasses.filter((item) => isStaleOneTimeScheduledClass(item, input.today));
  const priorityActions: ReportsPriorityAction[] = [];

  if (queuedMessages) {
    priorityActions.push({
      id: "queued-texts",
      title: "Send queued texts",
      detail: namesSummary(queuedMessageNames, "No texts are waiting in the delivery queue."),
      count: queuedMessages,
      path: "/messages",
      tone: "info"
    });
  }

  if (staleQueuedMessages.length) {
    priorityActions.push({
      id: "stale-queued-text-cleanup",
      title: "Clear stale queued texts",
      detail: namesSummary(staleQueuedMessageNames, "No stale queued texts need cleanup."),
      count: staleQueuedMessages.length,
      path: "/messages",
      tone: "warning"
    });
  }

  if (leadCandidates.length) {
    priorityActions.push({
      id: "lead-follow-ups",
      title: "Review new leads",
      detail: namesSummary(leadCandidates.map((candidate) => candidate.name), "No public leads need follow-up."),
      count: leadCandidates.length,
      path: "/reports#reports-leads-title",
      tone: "info"
    });
  }

  if (directMessageReplyCandidates.length) {
    priorityActions.push({
      id: "direct-message-replies",
      title: "Reply to app messages",
      detail: namesSummary(directMessageReplyCandidates.map((candidate) => candidate.senderName), "No app messages need staff replies."),
      count: directMessageReplyCandidates.length,
      path: "/profile",
      tone: "info"
    });
  }

  if (classReminderCandidates.length) {
    priorityActions.push({
      id: "class-reminders",
      title: "Send class reminders",
      detail: namesSummary(classReminderCandidates.map((item) => item.studentName), "No class reminders are waiting."),
      count: classReminderCandidates.length,
      path: "/messages",
      tone: "info"
    });
  }

  if (attendanceRisks.length) {
    priorityActions.push({
      id: "missed-class-follow-ups",
      title: "Send missed-class follow-ups",
      detail: namesSummary(attendanceRisks.map((student) => student.name), "No missed-class follow-ups are waiting."),
      count: attendanceRisks.length,
      path: "/messages",
      tone: "danger"
    });
  }

  if (attendanceGapCandidates.length) {
    priorityActions.push({
      id: "attendance-gap-check-ins",
      title: "Check attendance gaps",
      detail: namesSummary(attendanceGapCandidates.map((student) => student.name), "No attendance-gap check-ins are waiting."),
      count: attendanceGapCandidates.length,
      path: "/messages",
      tone: "warning"
    });
  }

  if (trialStudents.length) {
    priorityActions.push({
      id: "trial-conversions",
      title: "Convert trial students",
      detail: namesSummary(trialStudents.map(fullName), "No active trial students need conversion review."),
      count: trialStudents.length,
      path: "/students",
      tone: "info"
    });
  }

  if (newStudentCheckInCandidates.length) {
    priorityActions.push({
      id: "new-student-check-ins",
      title: "Check in with new students",
      detail: namesSummary(newStudentCheckInCandidates.map((student) => student.name), "No new-student check-ins are waiting."),
      count: newStudentCheckInCandidates.length,
      path: "/messages",
      tone: "info"
    });
  }

  if (celebrationCandidates.length) {
    priorityActions.push({
      id: "celebration-outreach",
      title: "Send celebration outreach",
      detail: namesSummary(celebrationCandidates.map((student) => student.name), "No celebration outreach is waiting."),
      count: celebrationCandidates.length,
      path: "/messages",
      tone: "info"
    });
  }

  if (profileUpdateCandidates.length) {
    priorityActions.push({
      id: "profile-updates",
      title: "Request profile updates",
      detail: namesSummary(profileUpdateCandidates.map((student) => student.name), "No student records need profile-update outreach."),
      count: profileUpdateCandidates.length,
      path: "/students",
      tone: "warning"
    });
  }

  if (milestoneCandidates.length) {
    priorityActions.push({
      id: "milestone-encouragement",
      title: "Send milestone encouragement",
      detail: namesSummary(milestoneCandidates.map((student) => student.name), "No milestone encouragement is waiting."),
      count: milestoneCandidates.length,
      path: "/messages",
      tone: "success"
    });
  }

  if (testReadinessCandidates.length) {
    priorityActions.push({
      id: "belt-test-invites",
      title: "Invite belt test candidates",
      detail: namesSummary(testReadinessCandidates.map((student) => student.name), "No current students are ready for belt testing outreach."),
      count: testReadinessCandidates.length,
      path: "/messages",
      tone: "success"
    });
  }

  if (lowStockItems.length) {
    priorityActions.push({
      id: "low-stock",
      title: "Restock low inventory",
      detail: namesSummary(lowStockItems.map((item) => item.name), "Inventory is above the low-stock threshold."),
      count: lowStockItems.length,
      path: "/merchandise",
      tone: "warning"
    });
  }

  if (staleScheduleItems.length) {
    priorityActions.push({
      id: "stale-schedule-cleanup",
      title: "Clear stale schedule items",
      detail: namesSummary(staleScheduleItems.map((item) => item.title), "No old one-time schedule items need cleanup."),
      count: staleScheduleItems.length,
      path: "/schedule",
      tone: "warning"
    });
  }

  if (pausedStudents.length) {
    priorityActions.push({
      id: "paused-students",
      title: "Review paused students",
      detail: namesSummary(pausedStudents.map(fullName), "No paused students need review."),
      count: pausedStudents.length,
      path: "/students",
      tone: "warning"
    });
  }

  if (!priorityActions.length) {
    priorityActions.push({
      id: "weekly-review",
      title: "Review weekly operations",
      detail: `${input.studioClasses.length} class template${input.studioClasses.length === 1 ? "" : "s"} ready for the current schedule.`,
      count: input.studioClasses.length,
      path: "/schedule",
      tone: "success"
    });
  }

  return {
    summary: {
      currentStudents: currentStudents.length,
      attendanceFollowUps: attendanceRisks.length,
      trialFollowUps: trialStudents.length,
      leadFollowUps: leadCandidates.length,
      directMessageReplies: directMessageReplyCandidates.length,
      newStudentCheckIns: newStudentCheckInCandidates.length,
      attendanceGapFollowUps: attendanceGapCandidates.length,
      pausedFollowUps: pausedStudents.length,
      celebrationOutreach: celebrationCandidates.length,
      profileUpdateRequests: profileUpdateCandidates.length,
      classReminders: classReminderCandidates.length,
      milestoneEncouragements: milestoneCandidates.length,
      testReadinessFollowUps: testReadinessCandidates.length,
      checkInsThisWeek,
      queuedMessages,
      staleQueuedMessages: staleQueuedMessages.length,
      upcomingCalendarItems: upcomingCalendarItems.length,
      lowStockItems: lowStockItems.length,
      staleScheduleItems: staleScheduleItems.length
    },
    priorityActions,
    attendanceRisks,
    attendanceGapCandidates,
    leadCandidates,
    directMessageReplyCandidates,
    newStudentCheckInCandidates,
    celebrationCandidates,
    profileUpdateCandidates,
    classReminderCandidates,
    milestoneCandidates,
    testReadinessCandidates,
    lowStockItems,
    upcomingCalendarItems
  };
}
