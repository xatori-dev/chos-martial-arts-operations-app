import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { childUsernameFromName, normalizeChildUsername } from "./childAccountUtils";
import { isSafeStudyMaterialFile, isSafeTrainingVideoFile } from "./contentSafety";
import { getProduct, studio } from "./data";
import { parseOperationsBackupSnapshot, type OperationsBackupData } from "./operationsBackup";
import { getClassReminderCandidates, getLeadCandidates, getMerchandiseTargetStock, getStudentCelebrationEvents, getStudentProfileIssues, hasGuardianSmsConsent, hasStaffSmsConsent, hasStudentSmsConsent, isAttendanceGapFollowUpDue, isBeltTestInviteDue, isLowStockMerchandiseItem, isMilestoneEncouragementDue, isMissedClassFollowUpDue, isNewStudentCheckInDue, isPausedStudentReviewDue, isProfileUpdateRequestDue, isQueuedMessageDeliverable, isStaleOneTimeScheduledClass, isTrialConversionDue } from "./operationsReports";
import { buildStudentBeltProgress } from "./studentProgress";
import { clearSupabaseAuthSession } from "./supabaseAccounts";
import { normalizeTwilioInboundSmsWebhookForServer, normalizeTwilioStatusCallbackForServer, type TwilioInboundSmsWebhook } from "./twilioRelayContract";
import type {
  AccountRole,
  AccountSession,
  BookingDetails,
  CartItem,
  ChildAccount,
  ContactSubmission,
  Coupon,
  CustomerInfo,
  DirectMessage,
  LeadReview,
  ManagedAccount,
  ManagerAccessKey,
  MerchandiseItem,
  MessageCampaign,
  MessageLog,
  MessageNotificationSettings,
  Order,
  ScheduledTextCampaign,
  StudioClass,
  ScheduledClass,
  StudyGuideFolder,
  StudyGuideMaterial,
  StudentCheckIn,
  StudentRecord,
  StudioEvent,
  TextAutomationRun,
  TextAutomationRunKey,
  TwilioDeliveryStatus,
  TwilioRelayPayload,
  TwilioRelayResult,
  TrainingVideo,
  TrainingVideoFolder
} from "./types";
import { applyCoupon, calculateTotals, createOrder, estimateSmsSegments, hasSmsOptOutLanguage, prototypeManagerLogin, prototypeParentLogin, prototypeStudentLogin } from "./utils";

const keys = {
  cart: "chos.cart.v1",
  orders: "chos.orders.v1",
  bookings: "chos.bookings.v1",
  contacts: "chos.contacts.v1",
  leadReviews: "chos.operations.leadReviews.v1",
  session: "chos.session.v1",
  accounts: "chos.accounts.v1",
  accountRoles: "chos.accountRoles.v1",
  managedAccounts: "chos.managedAccounts.v1",
  childAccounts: "chos.childAccounts.v1",
  coupon: "chos.coupon.v1",
  students: "chos.operations.students.v1",
  studioClasses: "chos.operations.classes.v1",
  scheduledClasses: "chos.operations.schedule.v1",
  messageCampaigns: "chos.operations.campaigns.v1",
  scheduledTextCampaigns: "chos.operations.scheduledCampaigns.v1",
  messageLogs: "chos.operations.messages.v1",
  textAutomationRuns: "chos.operations.automationRuns.v1",
  messageNotificationSettings: "chos.operations.notificationSettings.v1",
  twilioRelayEndpoint: "chos.operations.twilioRelayEndpoint.v1",
  pushServerEndpoint: "chos.operations.pushServerEndpoint.v1",
  twilioLaunchProfile: "chos.operations.twilioLaunchProfile.v1",
  directMessages: "chos.operations.directMessages.v1",
  studioEvents: "chos.operations.events.v1",
  merchandiseItems: "chos.operations.merchandise.v1",
  checkIns: "chos.operations.checkins.v1",
  videoFolders: "chos.operations.videoFolders.v1",
  videos: "chos.operations.videos.v1",
  studyGuideFolders: "chos.operations.studyGuideFolders.v1",
  studyGuideMaterials: "chos.operations.studyGuideMaterials.v1"
} as const;

const prototypeSeedSmsConsentUpdatedAt = "2026-05-01T10:00:00.000Z";

const seedStudents: StudentRecord[] = [
  {
    id: "student-talia-brooks-seed",
    firstName: "Talia",
    lastName: "Brooks",
    dateOfBirth: "2019-09-14",
    gender: "Female",
    phone: "(262) 555-0201",
    email: "talia.brooks@example.com",
    profileImagePath: "assets/student-profiles/talia-brooks.webp",
    guardianName: "Monica Brooks",
    guardianPhone: "(262) 555-0201",
    guardianEmail: "monica.brooks@example.com",
    emergencyContactName: "Evan Hart",
    emergencyContactRelationship: "Uncle",
    emergencyContactPhone: "(262) 555-0301",
    emergencyContactEmail: "evan.hart@example.com",
    enrollmentDate: "2026-04-06",
    program: "Little Dragons",
    status: "Active",
    beltRank: "White",
    classesAttended: 4,
    missedClassCount: 0,
    lastCheckIn: "2026-05-15",
    joinedAt: "2026-04-06",
    notes: "Prototype testing profile for a young beginner student."
  },
  {
    id: "student-evan-ramirez-seed",
    firstName: "Evan",
    lastName: "Ramirez",
    dateOfBirth: "2018-07-22",
    gender: "Male",
    phone: "(262) 555-0202",
    email: "evan.ramirez@example.com",
    profileImagePath: "assets/student-profiles/evan-ramirez.webp",
    guardianName: "Rosa Ramirez",
    guardianPhone: "(262) 555-0202",
    guardianEmail: "rosa.ramirez@example.com",
    emergencyContactName: "Luis Ramirez",
    emergencyContactRelationship: "Grandfather",
    emergencyContactPhone: "(262) 555-0302",
    emergencyContactEmail: "luis.ramirez@example.com",
    enrollmentDate: "2026-03-21",
    program: "Youth Foundations",
    status: "Trial",
    beltRank: "Yellow",
    classesAttended: 11,
    missedClassCount: 1,
    lastCheckIn: "2026-05-11",
    joinedAt: "2026-03-21",
    notes: "Prototype testing profile with trial status."
  },
  {
    id: "student-gia-patel-seed",
    firstName: "Gia",
    lastName: "Patel",
    dateOfBirth: "2017-11-05",
    gender: "Female",
    phone: "(262) 555-0203",
    email: "gia.patel@example.com",
    profileImagePath: "assets/student-profiles/gia-patel.webp",
    guardianName: "Nisha Patel",
    guardianPhone: "(262) 555-0203",
    guardianEmail: "nisha.patel@example.com",
    emergencyContactName: "Arun Patel",
    emergencyContactRelationship: "Father",
    emergencyContactPhone: "(262) 555-0303",
    emergencyContactEmail: "arun.patel@example.com",
    enrollmentDate: "2026-02-19",
    program: "Youth Foundations",
    status: "Active",
    beltRank: "Orange",
    classesAttended: 19,
    missedClassCount: 0,
    lastCheckIn: "2026-05-13",
    joinedAt: "2026-02-19",
    notes: "Prototype testing profile for youth basics and forms."
  },
  {
    id: "student-noah-bennett-seed",
    firstName: "Noah",
    lastName: "Bennett",
    dateOfBirth: "2016-06-18",
    gender: "Male",
    phone: "(262) 555-0204",
    email: "noah.bennett@example.com",
    profileImagePath: "assets/student-profiles/noah-bennett.webp",
    guardianName: "Kelly Bennett",
    guardianPhone: "(262) 555-0204",
    guardianEmail: "kelly.bennett@example.com",
    emergencyContactName: "Mark Bennett",
    emergencyContactRelationship: "Father",
    emergencyContactPhone: "(262) 555-0304",
    emergencyContactEmail: "mark.bennett@example.com",
    enrollmentDate: "2026-01-28",
    program: "Youth Foundations",
    status: "Paused",
    beltRank: "Green",
    classesAttended: 27,
    missedClassCount: 2,
    lastCheckIn: "2026-04-29",
    joinedAt: "2026-01-28",
    notes: "Prototype testing profile for paused student workflows."
  },
  {
    id: "student-iris-morgan-seed",
    firstName: "Iris",
    lastName: "Morgan",
    dateOfBirth: "2015-12-02",
    gender: "Female",
    phone: "(262) 555-0205",
    email: "iris.morgan@example.com",
    profileImagePath: "assets/student-profiles/iris-morgan.webp",
    guardianName: "Avery Morgan",
    guardianPhone: "(262) 555-0205",
    guardianEmail: "avery.morgan@example.com",
    emergencyContactName: "Casey Morgan",
    emergencyContactRelationship: "Aunt",
    emergencyContactPhone: "(262) 555-0305",
    emergencyContactEmail: "casey.morgan@example.com",
    enrollmentDate: "2025-12-14",
    program: "Youth Intermediate",
    status: "Active",
    beltRank: "Blue",
    classesAttended: 36,
    missedClassCount: 0,
    lastCheckIn: "2026-05-16",
    joinedAt: "2025-12-14",
    notes: "Prototype testing profile for steady attendance."
  },
  {
    id: "student-caleb-nguyen-seed",
    firstName: "Caleb",
    lastName: "Nguyen",
    dateOfBirth: "2014-09-30",
    gender: "Male",
    phone: "(262) 555-0206",
    email: "caleb.nguyen@example.com",
    profileImagePath: "assets/student-profiles/caleb-nguyen.webp",
    guardianName: "Linh Nguyen",
    guardianPhone: "(262) 555-0206",
    guardianEmail: "linh.nguyen@example.com",
    emergencyContactName: "Bao Nguyen",
    emergencyContactRelationship: "Uncle",
    emergencyContactPhone: "(262) 555-0306",
    emergencyContactEmail: "bao.nguyen@example.com",
    enrollmentDate: "2025-11-08",
    program: "Youth Intermediate",
    status: "Trial",
    beltRank: "Purple",
    classesAttended: 44,
    missedClassCount: 1,
    lastCheckIn: "2026-05-09",
    joinedAt: "2025-11-08",
    notes: "Prototype testing profile with trial follow-up status."
  },
  {
    id: "student-lila-thompson-seed",
    firstName: "Lila",
    lastName: "Thompson",
    dateOfBirth: "2013-07-07",
    gender: "Female",
    phone: "(262) 555-0207",
    email: "lila.thompson@example.com",
    profileImagePath: "assets/student-profiles/lila-thompson.webp",
    guardianName: "Dana Thompson",
    guardianPhone: "(262) 555-0207",
    guardianEmail: "dana.thompson@example.com",
    emergencyContactName: "Robin Thompson",
    emergencyContactRelationship: "Grandparent",
    emergencyContactPhone: "(262) 555-0307",
    emergencyContactEmail: "robin.thompson@example.com",
    enrollmentDate: "2025-10-02",
    program: "Youth Advanced",
    status: "Inactive",
    beltRank: "Brown",
    classesAttended: 57,
    missedClassCount: 4,
    lastCheckIn: "2026-03-22",
    lastContactedAt: "2026-04-05",
    joinedAt: "2025-10-02",
    notes: "Prototype testing profile for inactive student records."
  },
  {
    id: "student-owen-carter-seed",
    firstName: "Owen",
    lastName: "Carter",
    dateOfBirth: "2011-08-25",
    gender: "Male",
    phone: "(262) 555-0208",
    email: "owen.carter@example.com",
    profileImagePath: "assets/student-profiles/owen-carter.webp",
    guardianName: "Erin Carter",
    guardianPhone: "(262) 555-0208",
    guardianEmail: "erin.carter@example.com",
    emergencyContactName: "Shawn Carter",
    emergencyContactRelationship: "Father",
    emergencyContactPhone: "(262) 555-0308",
    emergencyContactEmail: "shawn.carter@example.com",
    enrollmentDate: "2025-08-18",
    program: "Youth Advanced",
    status: "Active",
    beltRank: "Red",
    classesAttended: 74,
    missedClassCount: 0,
    lastCheckIn: "2026-05-14",
    joinedAt: "2025-08-18",
    notes: "Prototype testing profile for testing-prep workflows."
  },
  {
    id: "student-maya-robinson-seed",
    firstName: "Maya",
    lastName: "Robinson",
    dateOfBirth: "2009-10-12",
    gender: "Female",
    phone: "(262) 555-0209",
    email: "maya.robinson@example.com",
    profileImagePath: "assets/student-profiles/maya-robinson.webp",
    guardianName: "Jordan Robinson",
    guardianPhone: "(262) 555-0209",
    guardianEmail: "jordan.robinson@example.com",
    emergencyContactName: "Pat Robinson",
    emergencyContactRelationship: "Grandparent",
    emergencyContactPhone: "(262) 555-0309",
    emergencyContactEmail: "pat.robinson@example.com",
    enrollmentDate: "2025-06-10",
    program: "Black Belt Prep",
    status: "Paused",
    beltRank: "Dark Brown",
    classesAttended: 92,
    missedClassCount: 3,
    lastCheckIn: "2026-04-18",
    joinedAt: "2025-06-10",
    notes: "Prototype testing profile for dark-brown belt coverage."
  },
  {
    id: "student-andre-coleman-seed",
    firstName: "Andre",
    lastName: "Coleman",
    dateOfBirth: "2007-06-04",
    gender: "Male",
    phone: "(262) 555-0210",
    email: "andre.coleman@example.com",
    profileImagePath: "assets/student-profiles/andre-coleman.webp",
    guardianName: "Michelle Coleman",
    guardianPhone: "(262) 555-0210",
    guardianEmail: "michelle.coleman@example.com",
    emergencyContactName: "Terrence Coleman",
    emergencyContactRelationship: "Father",
    emergencyContactPhone: "(262) 555-0310",
    emergencyContactEmail: "terrence.coleman@example.com",
    enrollmentDate: "2025-04-12",
    program: "Black Belt Leadership",
    status: "Active",
    beltRank: "Black",
    classesAttended: 120,
    missedClassCount: 0,
    lastCheckIn: "2026-05-16",
    joinedAt: "2025-04-12",
    notes: "Prototype testing profile for black belt leadership."
  },
  {
    id: "student-sophie-jensen-seed",
    firstName: "Sophie",
    lastName: "Jensen",
    dateOfBirth: "2005-08-19",
    gender: "Female",
    phone: "(262) 555-0211",
    email: "sophie.jensen@example.com",
    profileImagePath: "assets/student-profiles/sophie-jensen.webp",
    guardianName: "Kara Jensen",
    guardianPhone: "(262) 555-0211",
    guardianEmail: "kara.jensen@example.com",
    emergencyContactName: "Milo Jensen",
    emergencyContactRelationship: "Brother",
    emergencyContactPhone: "(262) 555-0311",
    emergencyContactEmail: "milo.jensen@example.com",
    enrollmentDate: "2025-03-01",
    program: "Adult Taekwondo",
    status: "Trial",
    beltRank: "Black",
    classesAttended: 112,
    missedClassCount: 1,
    lastCheckIn: "2026-05-06",
    joinedAt: "2025-03-01",
    notes: "Prototype testing profile for adult black belt trial status."
  },
  {
    id: "student-marcus-reid-seed",
    firstName: "Marcus",
    lastName: "Reid",
    dateOfBirth: "2003-09-28",
    gender: "Male",
    phone: "(262) 555-0212",
    email: "marcus.reid@example.com",
    profileImagePath: "assets/student-profiles/marcus-reid.webp",
    guardianName: "Alicia Reid",
    guardianPhone: "(262) 555-0212",
    guardianEmail: "alicia.reid@example.com",
    emergencyContactName: "Corey Reid",
    emergencyContactRelationship: "Cousin",
    emergencyContactPhone: "(262) 555-0312",
    emergencyContactEmail: "corey.reid@example.com",
    enrollmentDate: "2026-04-18",
    program: "Adult Foundations",
    status: "Active",
    beltRank: "White",
    classesAttended: 7,
    missedClassCount: 0,
    lastCheckIn: "2026-05-12",
    joinedAt: "2026-04-18",
    notes: "Prototype testing profile for adult beginner workflows."
  },
  {
    id: "student-priya-shah-seed",
    firstName: "Priya",
    lastName: "Shah",
    dateOfBirth: "2000-07-03",
    gender: "Female",
    phone: "(262) 555-0213",
    email: "priya.shah@example.com",
    profileImagePath: "assets/student-profiles/priya-shah.webp",
    guardianName: "Dev Shah",
    guardianPhone: "(262) 555-0213",
    guardianEmail: "dev.shah@example.com",
    emergencyContactName: "Meera Shah",
    emergencyContactRelationship: "Sister",
    emergencyContactPhone: "(262) 555-0313",
    emergencyContactEmail: "meera.shah@example.com",
    enrollmentDate: "2026-03-05",
    program: "Adult Foundations",
    status: "Inactive",
    beltRank: "Yellow",
    classesAttended: 16,
    missedClassCount: 5,
    lastCheckIn: "2026-03-30",
    lastContactedAt: "2026-04-12",
    joinedAt: "2026-03-05",
    notes: "Prototype testing profile for inactive adult beginner state."
  },
  {
    id: "student-elena-torres-seed",
    firstName: "Elena",
    lastName: "Torres",
    dateOfBirth: "1997-08-16",
    gender: "Female",
    phone: "(262) 555-0214",
    email: "elena.torres@example.com",
    profileImagePath: "assets/student-profiles/elena-torres.webp",
    guardianName: "Rafael Torres",
    guardianPhone: "(262) 555-0214",
    guardianEmail: "rafael.torres@example.com",
    emergencyContactName: "Lucia Torres",
    emergencyContactRelationship: "Mother",
    emergencyContactPhone: "(262) 555-0314",
    emergencyContactEmail: "lucia.torres@example.com",
    enrollmentDate: "2026-01-12",
    program: "Adult Foundations",
    status: "Active",
    beltRank: "Orange",
    classesAttended: 24,
    missedClassCount: 0,
    lastCheckIn: "2026-05-10",
    joinedAt: "2026-01-12",
    notes: "Prototype testing profile for adult orange belt state."
  },
  {
    id: "student-jacob-ellis-seed",
    firstName: "Jacob",
    lastName: "Ellis",
    dateOfBirth: "1994-11-09",
    gender: "Male",
    phone: "(262) 555-0215",
    email: "jacob.ellis@example.com",
    profileImagePath: "assets/student-profiles/jacob-ellis.webp",
    guardianName: "Morgan Ellis",
    guardianPhone: "(262) 555-0215",
    guardianEmail: "morgan.ellis@example.com",
    emergencyContactName: "Terry Ellis",
    emergencyContactRelationship: "Brother",
    emergencyContactPhone: "(262) 555-0315",
    emergencyContactEmail: "terry.ellis@example.com",
    enrollmentDate: "2025-12-05",
    program: "MMA Fitness",
    status: "Paused",
    beltRank: "Green",
    classesAttended: 32,
    missedClassCount: 2,
    lastCheckIn: "2026-04-25",
    joinedAt: "2025-12-05",
    notes: "Prototype testing profile for paused adult class membership."
  },
  {
    id: "student-natalie-brooks-seed",
    firstName: "Natalie",
    lastName: "Brooks",
    dateOfBirth: "1991-06-21",
    gender: "Female",
    phone: "(262) 555-0216",
    email: "natalie.brooks@example.com",
    profileImagePath: "assets/student-profiles/natalie-brooks.webp",
    guardianName: "Elliot Brooks",
    guardianPhone: "(262) 555-0216",
    guardianEmail: "elliot.brooks@example.com",
    emergencyContactName: "Mara Brooks",
    emergencyContactRelationship: "Sister",
    emergencyContactPhone: "(262) 555-0316",
    emergencyContactEmail: "mara.brooks@example.com",
    enrollmentDate: "2025-10-16",
    program: "MMA Fitness",
    status: "Trial",
    beltRank: "Blue",
    classesAttended: 41,
    missedClassCount: 1,
    lastCheckIn: "2026-05-07",
    joinedAt: "2025-10-16",
    notes: "Prototype testing profile for trial adult fitness membership."
  },
  {
    id: "student-victor-lane-seed",
    firstName: "Victor",
    lastName: "Lane",
    dateOfBirth: "1987-09-01",
    gender: "Male",
    phone: "(262) 555-0217",
    email: "victor.lane@example.com",
    profileImagePath: "assets/student-profiles/victor-lane.webp",
    guardianName: "Jules Lane",
    guardianPhone: "(262) 555-0217",
    guardianEmail: "jules.lane@example.com",
    emergencyContactName: "Sam Lane",
    emergencyContactRelationship: "Spouse",
    emergencyContactPhone: "(262) 555-0317",
    emergencyContactEmail: "sam.lane@example.com",
    enrollmentDate: "2025-08-04",
    program: "MMA Advanced",
    status: "Active",
    beltRank: "Purple",
    classesAttended: 52,
    missedClassCount: 0,
    lastCheckIn: "2026-05-15",
    joinedAt: "2025-08-04",
    notes: "Prototype testing profile for adult advanced attendance."
  },
  {
    id: "student-hannah-kim-seed",
    firstName: "Hannah",
    lastName: "Kim",
    dateOfBirth: "1983-12-18",
    gender: "Female",
    phone: "(262) 555-0218",
    email: "hannah.kim@example.com",
    profileImagePath: "assets/student-profiles/hannah-kim.webp",
    guardianName: "Peter Kim",
    guardianPhone: "(262) 555-0218",
    guardianEmail: "peter.kim@example.com",
    emergencyContactName: "June Kim",
    emergencyContactRelationship: "Sister",
    emergencyContactPhone: "(262) 555-0318",
    emergencyContactEmail: "june.kim@example.com",
    enrollmentDate: "2025-06-25",
    program: "MMA Advanced",
    status: "Inactive",
    beltRank: "Brown",
    classesAttended: 68,
    missedClassCount: 4,
    lastCheckIn: "2026-03-18",
    lastContactedAt: "2026-04-02",
    joinedAt: "2025-06-25",
    notes: "Prototype testing profile for inactive advanced adult workflows."
  },
  {
    id: "student-derek-miles-seed",
    firstName: "Derek",
    lastName: "Miles",
    dateOfBirth: "1979-08-06",
    gender: "Male",
    phone: "(262) 555-0219",
    email: "derek.miles@example.com",
    profileImagePath: "assets/student-profiles/derek-miles.webp",
    guardianName: "Rachel Miles",
    guardianPhone: "(262) 555-0219",
    guardianEmail: "rachel.miles@example.com",
    emergencyContactName: "Gina Miles",
    emergencyContactRelationship: "Spouse",
    emergencyContactPhone: "(262) 555-0319",
    emergencyContactEmail: "gina.miles@example.com",
    enrollmentDate: "2025-04-20",
    program: "Black Belt Prep",
    status: "Active",
    beltRank: "Red",
    classesAttended: 83,
    missedClassCount: 0,
    lastCheckIn: "2026-05-09",
    joinedAt: "2025-04-20",
    notes: "Prototype testing profile for adult red belt testing prep."
  },
  {
    id: "student-serena-park-seed",
    firstName: "Serena",
    lastName: "Park",
    dateOfBirth: "1975-09-23",
    gender: "Female",
    phone: "(262) 555-0220",
    email: "serena.park@example.com",
    profileImagePath: "assets/student-profiles/serena-park.webp",
    guardianName: "Min Park",
    guardianPhone: "(262) 555-0220",
    guardianEmail: "min.park@example.com",
    emergencyContactName: "Jae Park",
    emergencyContactRelationship: "Spouse",
    emergencyContactPhone: "(262) 555-0320",
    emergencyContactEmail: "jae.park@example.com",
    enrollmentDate: "2025-02-11",
    program: "Black Belt Prep",
    status: "Paused",
    beltRank: "Dark Brown",
    classesAttended: 98,
    missedClassCount: 3,
    lastCheckIn: "2026-04-10",
    joinedAt: "2025-02-11",
    notes: "Prototype testing profile for senior dark-brown belt coverage."
  }
].map((student) => ({ ...student, smsConsentUpdatedAt: prototypeSeedSmsConsentUpdatedAt }));

const seedScheduledClasses: ScheduledClass[] = [
  { id: "schedule-youth-beginners", title: "Youth Beginners", date: "2026-05-18", time: "5:00 PM", type: "class", notes: "Beginner martial arts fundamentals." },
  { id: "schedule-private-intro", title: "Private Intro Lesson", date: "2026-05-19", time: "12:30 PM", type: "private-lesson", studentId: "student-talia-brooks-seed", notes: "Welcome and starter assessment." }
];

const seedStudioClasses: StudioClass[] = [
  { id: "class-youth-foundations", name: "Youth Foundations", daysOfWeek: [0, 2], startTime: "17:00", endTime: "17:45", notes: "Beginner youth fundamentals and confidence work." },
  { id: "class-family-training", name: "Family Training", daysOfWeek: [2, 4], startTime: "18:00", endTime: "18:50", notes: "All-belt family class with basics, forms, and fitness." }
];

const seedMessageLogs: MessageLog[] = [
  {
    id: "message-reminder-seed",
    kind: "reminder",
    recipientName: "Talia Brooks",
    recipientPhone: "(262) 555-0201",
    body: "Reminder: Youth Beginners meets this week at Cho's Martial Arts.",
    status: "sent",
    createdAt: "2026-05-10T15:00:00.000Z"
  }
];

const seedDirectMessages: DirectMessage[] = [
  {
    id: "direct-message-talia-seed-1",
    threadId: "direct-staff-seed__student-talia-brooks-seed",
    senderId: "direct-staff-seed",
    senderName: "Cho's Manager",
    recipientId: "student-talia-brooks-seed",
    recipientName: "Talia Brooks",
    body: "Hi Talia, your next class notes are ready when you arrive.",
    createdAt: "2026-05-13T18:00:00.000Z",
    status: "sent"
  },
  {
    id: "direct-message-talia-seed-2",
    threadId: "direct-staff-seed__student-talia-brooks-seed",
    senderId: "student-talia-brooks-seed",
    senderName: "Talia Brooks",
    recipientId: "direct-staff-seed",
    recipientName: "Cho's Manager",
    body: "Thank you, I will be there for training.",
    createdAt: "2026-05-13T18:05:00.000Z",
    status: "sent"
  }
];

const defaultMessageNotificationSettings: MessageNotificationSettings = {
  browserNotificationsEnabled: false
};

const seedStudioEvents: StudioEvent[] = [
  { id: "event-testing-seed", title: "Color Belt Testing", date: "2026-05-30", time: "10:00 AM", details: "Testing date for students cleared by instructors.", audience: "students" },
  { id: "event-movie-night-seed", title: "Movie Night", date: "2026-06-07", time: "6:30 PM", details: "Family movie night at the studio.", audience: "families" }
];

const seedMerchandiseItems: MerchandiseItem[] = [
  { id: "merch-gloves-seed", name: "Youth Boxing Gloves", category: "Gloves", price: 39, stock: 2, reorderPoint: 3, targetStock: 8, description: "Youth 6oz gloves for bag work and sparring prep.", imageLabel: "gloves" },
  { id: "merch-uniform-seed", name: "White Basic Uniform", category: "Uniforms", price: 39, stock: 10, reorderPoint: 4, targetStock: 12, description: "Starter uniform with Cho's logo patches.", imageLabel: "uniform" }
];

interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AccountRecord {
  email: string;
  password?: string;
  role?: AccountRole;
  createdAt: string;
}

interface AccountRoleRecord {
  email: string;
  role: AccountRole;
}

const managerAccessKeys: ManagerAccessKey[] = [
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
];

const ownerManagerAccess: ManagerAccessKey[] = managerAccessKeys;
const staffManagerAccess: ManagerAccessKey[] = managerAccessKeys.filter((key) => key !== "create");

type StudioClassInput = {
  name: string;
  daysOfWeek: StudioClass["daysOfWeek"];
  startTime: string;
  endTime: string;
  recurring?: boolean;
  titleColor?: string;
  notes?: string;
};

const seedChildAccounts: ChildAccount[] = [
  {
    id: "child-mina-cho",
    parentEmail: prototypeParentLogin.email,
    name: "Mina Cho",
    username: "mina-cho.child",
    age: "8",
    beltSlug: "green",
    createdAt: "2026-05-01T10:00:00.000Z"
  },
  {
    id: "child-eli-cho",
    parentEmail: prototypeParentLogin.email,
    name: "Eli Cho",
    username: "eli-cho.child",
    age: "5",
    beltSlug: "white",
    createdAt: "2026-05-01T10:05:00.000Z"
  }
];

type StudentInput = {
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  studentEmail: string;
  guardianName?: string;
  guardianPhone: string;
  guardianEmail?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  enrollmentDate?: string;
  program?: string;
  status?: string;
  beltRank: string;
  notes?: string;
};

type ManagedAccountInput = {
  displayName: string;
  username: string;
  password: string;
  role: "staff" | "student";
  status?: ManagedAccount["status"];
  email?: string;
  phone?: string;
  title?: string;
  notes?: string;
  access?: ManagerAccessKey[];
  studentId?: string;
  linkedStudent?: StudentRecord;
};

type RegisteredAccountInput = {
  email: string;
  password: string;
  role?: AccountRole;
};

type ManagerAccountAccess = {
  isManagerOwner: boolean;
  canCreateAccounts: boolean;
  canGrantCreateAccess: boolean;
  allowedTools: ManagerAccessKey[];
};

type MerchandiseInput = {
  name: string;
  category: string;
  price: number;
  stock: number;
  reorderPoint?: number;
  targetStock?: number;
  description?: string;
  imageDataUrl?: string;
};

type TrainingVideoFolderInput = {
  name: string;
  subject: string;
  description?: string;
};

type TrainingVideoInput = {
  folderId: string;
  title: string;
  description?: string;
  fileName: string;
  mimeType: string;
  size: number;
  videoDataUrl: string;
};

type StudyGuideFolderInput = {
  name: string;
  subject: string;
  parentId?: string;
  description?: string;
};

type StudyGuideMaterialInput = {
  folderId: string;
  title: string;
  description?: string;
  fileName: string;
  mimeType: string;
  size: number;
  fileDataUrl: string;
};

type StudentCheckInResult = StudentCheckIn & {
  queuedMessage?: MessageLog;
};

type TextAutomationRunResult = {
  missedClassFollowUps: number;
  attendanceGapCheckIns: number;
  trialConversionFollowUps: number;
  newStudentCheckIns: number;
  pausedStudentReactivationFollowUps: number;
  celebrationOutreach: number;
  profileUpdateRequests: number;
  classReminders: number;
  milestoneEncouragements: number;
  beltTestInvites: number;
  eventReminders: number;
  scheduledPromotions: number;
  totalQueued: number;
};

const textAutomationRunBreakdownLabels: { key: TextAutomationRunKey; label: string }[] = [
  { key: "missedClassFollowUps", label: "Missed-class follow-ups" },
  { key: "attendanceGapCheckIns", label: "Attendance gap check-ins" },
  { key: "trialConversionFollowUps", label: "Trial conversion follow-ups" },
  { key: "newStudentCheckIns", label: "New student check-ins" },
  { key: "pausedStudentReactivationFollowUps", label: "Paused reactivation follow-ups" },
  { key: "celebrationOutreach", label: "Celebration outreach" },
  { key: "profileUpdateRequests", label: "Profile update requests" },
  { key: "classReminders", label: "Class reminders" },
  { key: "milestoneEncouragements", label: "Milestone encouragements" },
  { key: "beltTestInvites", label: "Belt test invites" },
  { key: "eventReminders", label: "Event reminders" },
  { key: "scheduledPromotions", label: "Scheduled promotions" }
];

function buildTextAutomationRunLog(result: TextAutomationRunResult, ranAt = new Date().toISOString()): TextAutomationRun {
  return {
    id: createPrototypeId("automation-run"),
    ranAt,
    status: result.totalQueued > 0 ? "queued" : "no-due-texts",
    totalQueued: result.totalQueued,
    deliveryProvider: "twilio",
    deliveryChannel: "sms",
    deliveryMode: "prototype",
    relayPayloadSchemaVersion: "chos-twilio-relay.v1",
    breakdown: textAutomationRunBreakdownLabels.map(({ key, label }) => ({
      key,
      label,
      queued: result[key]
    }))
  };
}

type TextAudiencePreview = {
  audience: MessageCampaign["audience"];
  total: number;
  students: number;
  parents: number;
  staff: number;
};

type TwilioRelayApplySummary = {
  applied: number;
  sent: number;
  failed: number;
  ignored: number;
};

type TwilioInboundApplySummary = {
  imported: number;
  optedOut: number;
  optedIn: number;
  ignored: number;
};

interface AppState {
  cart: CartItem[];
  coupon?: Coupon;
  totals: ReturnType<typeof calculateTotals>;
  orders: Order[];
  bookings: BookingDetails[];
  contacts: ContactSubmission[];
  leadReviews: LeadReview[];
  session?: AccountSession;
  accountRole?: AccountRole;
  accounts: AccountRecord[];
  accountRoles: AccountRoleRecord[];
  managedAccounts: ManagedAccount[];
  currentManagedAccount?: ManagedAccount;
  managerAccountAccess: ManagerAccountAccess;
  childAccounts: ChildAccount[];
  guardianChildren: ChildAccount[];
  currentChildAccount?: ChildAccount;
  students: StudentRecord[];
  studioClasses: StudioClass[];
  scheduledClasses: ScheduledClass[];
  messageCampaigns: MessageCampaign[];
  scheduledTextCampaigns: ScheduledTextCampaign[];
  messageLogs: MessageLog[];
  textAutomationRuns: TextAutomationRun[];
  messageNotificationSettings: MessageNotificationSettings;
  unreadDirectMessageCount: number;
  latestUnreadDirectMessage?: DirectMessage;
  directMessages: DirectMessage[];
  studioEvents: StudioEvent[];
  merchandiseItems: MerchandiseItem[];
  checkIns: StudentCheckIn[];
  trainingVideoFolders: TrainingVideoFolder[];
  trainingVideos: TrainingVideo[];
  studyGuideFolders: StudyGuideFolder[];
  studyGuideMaterials: StudyGuideMaterial[];
  toasts: Toast[];
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  dismissToast: (id: string) => void;
  addProductToCart: (productSlug: string, quantity: number) => void;
  addBookingToCart: (booking: BookingDetails) => void;
  updateCartQuantity: (id: string, quantity: number) => void;
  removeCartItem: (id: string) => void;
  clearCart: () => void;
  applyCartCoupon: (code: string) => Coupon;
  clearCoupon: () => void;
  placeOrder: (customer: CustomerInfo, notes: string) => Order | undefined;
  saveBooking: (booking: BookingDetails) => void;
  saveContact: (contact: ContactSubmission) => void;
  login: (email: string, remembered: boolean, role?: AccountRole) => void;
  loginRegisteredAccount: (credentials: { username: string; password: string }) => AccountRecord | undefined;
  loginManagedAccount: (credentials: { username: string; password: string }) => ManagedAccount | undefined;
  loginChildAccount: (childId: string) => void;
  loginChildCredentials: (credentials: { username: string; password: string }) => ChildAccount | undefined;
  managedUsernameExists: (username: string) => boolean;
  childUsernameExists: (username: string, options?: { excludeChildId?: string }) => boolean;
  logout: () => void;
  register: (account: RegisteredAccountInput) => AccountRecord | undefined;
  setAccountRole: (role: AccountRole) => void;
  createManagedAccount: (account: ManagedAccountInput) => ManagedAccount | undefined;
  updateManagedAccountStatus: (accountId: string, status: ManagedAccount["status"]) => ManagedAccount | undefined;
  addChildAccount: (child: { name: string; age: string; beltSlug: string; username: string; password: string }) => ChildAccount | undefined;
  updateChildAccount: (childId: string, child: { name: string; age: string; beltSlug: string; username: string; password: string }) => ChildAccount | undefined;
  addOperationsStudent: (student: StudentInput) => StudentRecord | undefined;
  updateOperationsStudent: (studentId: string, student: StudentInput) => StudentRecord | undefined;
  deleteOperationsStudent: (studentId: string) => StudentRecord | undefined;
  addStudioClass: (studioClass: StudioClassInput) => StudioClass | undefined;
  updateStudioClass: (classId: string, studioClass: StudioClassInput) => StudioClass | undefined;
  deleteStudioClass: (classId: string) => StudioClass | undefined;
  addScheduledClass: (scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => ScheduledClass | undefined;
  deleteScheduledClass: (scheduledClassId: string) => ScheduledClass | undefined;
  deletePastOneTimeScheduledClasses: (todayKey: string) => ScheduledClass[];
  addStudioEvent: (event: { title: string; date: string; time: string; details: string; audience: StudioEvent["audience"] }) => StudioEvent | undefined;
  addTrainingVideoFolder: (folder: TrainingVideoFolderInput) => TrainingVideoFolder | undefined;
  addTrainingVideo: (video: TrainingVideoInput) => TrainingVideo | undefined;
  addStudyGuideFolder: (folder: StudyGuideFolderInput) => StudyGuideFolder | undefined;
  addStudyGuideMaterial: (material: StudyGuideMaterialInput) => StudyGuideMaterial | undefined;
  addMerchandiseItem: (item: MerchandiseInput) => MerchandiseItem | undefined;
  updateMerchandiseItem: (itemId: string, item: MerchandiseInput) => MerchandiseItem | undefined;
  deleteMerchandiseItem: (itemId: string) => MerchandiseItem | undefined;
  restockLowInventory: () => number;
  reviewLeadFollowUps: () => number;
  restoreOperationsBackup: (rawBackup: string) => { restoredRecords: number; restoredSections: number } | undefined;
  recordSmsOptOut: (phone: string, optedOut: boolean) => number;
  recordStudentCheckIn: (studentId: string) => StudentCheckInResult | undefined;
  sendMissedClassFollowUps: () => number;
  sendAttendanceGapCheckIns: () => number;
  sendTrialConversionFollowUps: () => number;
  sendNewStudentCheckIns: () => number;
  sendPausedStudentReactivationFollowUps: () => number;
  sendCelebrationOutreach: () => number;
  sendProfileUpdateRequests: () => number;
  sendClassReminders: () => number;
  sendMilestoneEncouragements: () => number;
  sendBeltTestInvites: () => number;
  sendEventReminderTexts: () => number;
  runTextAutomations: () => TextAutomationRunResult;
  queueStudentMilestoneEncouragement: (studentId: string) => MessageLog | undefined;
  queueStudentProfileUpdateRequest: (studentId: string) => MessageLog | undefined;
  scheduleTextCampaign: (campaign: { body: string; audience: MessageCampaign["audience"]; scheduledFor: string; scheduledTime?: string; title?: string }) => ScheduledTextCampaign | undefined;
  cancelScheduledTextCampaign: (campaignId: string) => ScheduledTextCampaign | undefined;
  getTextAudiencePreview: (audience: MessageCampaign["audience"]) => TextAudiencePreview;
  sendMarketingBlast: (body: string, audience?: MessageCampaign["audience"]) => number;
  buildTwilioRelayPayload: () => TwilioRelayPayload;
  applyTwilioRelayResults: (rawResults: string) => TwilioRelayApplySummary | undefined;
  applyTwilioStatusCallbacks: (rawCallbacks: string) => TwilioRelayApplySummary | undefined;
  applyTwilioInboundWebhook: (rawWebhook: string) => TwilioInboundApplySummary | undefined;
  sendQueuedTexts: () => number;
  sendQueuedText: (messageId: string) => MessageLog | undefined;
  clearStaleQueuedTexts: () => number;
  updateMessageNotificationSettings: (settings: Partial<MessageNotificationSettings>) => void;
  markMessageNotificationsSeen: () => void;
  sendDirectMessage: (message: { senderId: string; senderName: string; recipientId: string; recipientName: string; body: string }) => DirectMessage | undefined;
}

const Context = createContext<AppState | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private browsing, blocked-storage contexts, or when large image uploads exceed quota.
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can fail in private browsing or blocked-storage contexts.
  }
}

function readSessionStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session storage can fail in blocked-storage contexts.
  }
}

function removeSessionStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Session storage can fail in blocked-storage contexts.
  }
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStorage<T>(key, fallback));
  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
        writeStorage(key, resolved);
        return resolved;
      });
    },
    [key]
  );
  return [value, update] as const;
}

function notificationSettingsScope(email?: string) {
  const keyEmail = email
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return keyEmail || "guest";
}

function scopedMessageNotificationSettingsKey(email?: string) {
  return email?.trim()
    ? `chos.operations.notificationSettings.${notificationSettingsScope(email)}.v1`
    : keys.messageNotificationSettings;
}

function isPrototypeManagerNotificationSession(email?: string) {
  return email?.trim().toLowerCase() === prototypeManagerLogin.email.toLowerCase();
}

function cleanNotificationString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanNotificationPermission(value: unknown): MessageNotificationSettings["browserPermission"] {
  return value === "default" || value === "granted" || value === "denied" || value === "unsupported" ? value : undefined;
}

function normalizeMessageNotificationSettings(value: unknown): MessageNotificationSettings {
  if (!value || typeof value !== "object") return { ...defaultMessageNotificationSettings };
  const settings = value as Partial<MessageNotificationSettings>;
  return {
    browserNotificationsEnabled: Boolean(settings.browserNotificationsEnabled),
    ...(cleanNotificationPermission(settings.browserPermission) ? { browserPermission: cleanNotificationPermission(settings.browserPermission) } : {}),
    ...(cleanNotificationString(settings.lastSeenDirectMessageAt) ? { lastSeenDirectMessageAt: cleanNotificationString(settings.lastSeenDirectMessageAt) } : {}),
    ...(cleanNotificationString(settings.lastBrowserNotifiedAt) ? { lastBrowserNotifiedAt: cleanNotificationString(settings.lastBrowserNotifiedAt) } : {}),
    ...(cleanNotificationString(settings.lastBrowserNotifiedDirectMessageAt) ? { lastBrowserNotifiedDirectMessageAt: cleanNotificationString(settings.lastBrowserNotifiedDirectMessageAt) } : {}),
    ...(cleanNotificationString(settings.pushPublicKey) ? { pushPublicKey: cleanNotificationString(settings.pushPublicKey) } : {}),
    ...(cleanNotificationString(settings.pushSubscriptionEndpoint) ? { pushSubscriptionEndpoint: cleanNotificationString(settings.pushSubscriptionEndpoint) } : {}),
    ...(cleanNotificationString(settings.pushSubscriptionJson) ? { pushSubscriptionJson: cleanNotificationString(settings.pushSubscriptionJson) } : {}),
    ...(cleanNotificationString(settings.pushSubscribedAt) ? { pushSubscribedAt: cleanNotificationString(settings.pushSubscribedAt) } : {}),
    ...(cleanNotificationString(settings.updatedAt) ? { updatedAt: cleanNotificationString(settings.updatedAt) } : {})
  };
}

function readOptionalMessageNotificationSettings(key: string) {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    return normalizeMessageNotificationSettings(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function readMessageNotificationSettingsForSession(email?: string): MessageNotificationSettings {
  const scopedSettings = email?.trim() ? readOptionalMessageNotificationSettings(scopedMessageNotificationSettingsKey(email)) : undefined;
  if (scopedSettings) return scopedSettings;
  if (isPrototypeManagerNotificationSession(email)) {
    return readOptionalMessageNotificationSettings(keys.messageNotificationSettings) ?? { ...defaultMessageNotificationSettings };
  }
  return { ...defaultMessageNotificationSettings };
}

function writeMessageNotificationSettingsForSession(email: string | undefined, settings: MessageNotificationSettings) {
  const normalizedSettings = normalizeMessageNotificationSettings(settings);
  writeStorage(scopedMessageNotificationSettingsKey(email), normalizedSettings);
  if (isPrototypeManagerNotificationSession(email)) {
    writeStorage(keys.messageNotificationSettings, normalizedSettings);
  }
}

function isCurrentStudentEnrollment(student: Pick<StudentRecord, "status">) {
  return (student.status?.trim() || "Active").toLowerCase() !== "inactive";
}

function hasValidManagedStudentLink(account: Pick<ManagedAccount, "role" | "studentId">, students: readonly Pick<StudentRecord, "id" | "status">[]) {
  if (account.role !== "student") return true;
  const studentId = account.studentId?.trim();
  return Boolean(studentId && students.some((student) => student.id === studentId && isCurrentStudentEnrollment(student)));
}

function hasValidManagedStudentInputLink(account: Pick<ManagedAccountInput, "role" | "status" | "studentId" | "linkedStudent">, students: readonly Pick<StudentRecord, "id" | "status">[]) {
  if (account.role !== "student" || (account.status ?? "active") !== "active") return true;
  const studentId = account.studentId?.trim();
  const linkedStudent = account.linkedStudent?.id === studentId ? account.linkedStudent : students.find((student) => student.id === studentId);
  return Boolean(studentId && linkedStudent && isCurrentStudentEnrollment(linkedStudent));
}

function validatePrototypeSession(session: AccountSession | undefined) {
  if (!session?.email) return undefined;
  const normalizedEmail = session.email.toLowerCase();
  if (normalizedEmail === prototypeManagerLogin.email.toLowerCase()) return session;
  if (normalizedEmail === prototypeStudentLogin.email.toLowerCase()) return session;
  if (normalizedEmail === prototypeParentLogin.email.toLowerCase()) return session;
  const accounts = readStorage<AccountRecord[]>(keys.accounts, []);
  const managedAccounts = readStorage<ManagedAccount[]>(keys.managedAccounts, []);
  const childAccounts = readStorage<ChildAccount[]>(keys.childAccounts, seedChildAccounts);
  const registeredAccount = accounts.some((account) => account.email.trim().toLowerCase() === normalizedEmail && Boolean(account.password?.trim()));
  if (registeredAccount && isRegisteredAccountLoginCollision(normalizedEmail, managedAccounts, childAccounts)) {
    removeStorage(keys.session);
    return undefined;
  }
  if (registeredAccount) return session;
  const students = readStorage<StudentRecord[]>(keys.students, seedStudents);
  if (managedAccounts.some((account) => account.username.toLowerCase() === normalizedEmail && account.status !== "inactive" && hasValidManagedStudentLink(account, students))) return session;
  if (childAccounts.some((child) => child.username.toLowerCase() === normalizedEmail)) return session;
  removeStorage(keys.session);
  return undefined;
}

function readPrototypeSession() {
  const session = readSessionStorage<AccountSession | undefined>(keys.session, undefined);
  const validatedSession = validatePrototypeSession(session);
  if (validatedSession) return validatedSession;
  removeSessionStorage(keys.session);
  removeStorage(keys.session);
  return undefined;
}

function inferBuiltInPrototypeAccountRole(email: string): AccountRole | undefined {
  const normalizedEmail = email.toLowerCase();
  if (normalizedEmail === prototypeManagerLogin.email.toLowerCase()) return "staff";
  if (normalizedEmail === prototypeStudentLogin.email.toLowerCase()) return "student";
  if (normalizedEmail === prototypeParentLogin.email.toLowerCase()) return "guardian";
  return undefined;
}

function isBuiltInPrototypeIdentity(email: string) {
  return Boolean(inferBuiltInPrototypeAccountRole(email.trim().toLowerCase()));
}

function inferPrototypeAccountRole(email: string): AccountRole | undefined {
  const builtInRole = inferBuiltInPrototypeAccountRole(email);
  if (builtInRole) return builtInRole;
  const normalizedEmail = email.toLowerCase();
  if (normalizedEmail.endsWith(".child")) return "student";
  return undefined;
}

function useSessionState() {
  const [value, setValue] = useState<AccountSession | undefined>(() => readPrototypeSession());
  const update = useCallback((next: AccountSession | undefined | ((previous: AccountSession | undefined) => AccountSession | undefined)) => {
    setValue((previous) => {
      const resolved = typeof next === "function" ? (next as (previous: AccountSession | undefined) => AccountSession | undefined)(previous) : next;
      if (resolved) {
        writeStorage(keys.session, resolved);
        writeSessionStorage(keys.session, resolved);
      } else {
        removeStorage(keys.session);
        removeSessionStorage(keys.session);
      }
      return resolved;
    });
  }, []);
  return [value, update] as const;
}

function dateStamp(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayStamp() {
  return dateStamp(new Date());
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  if (!year || !month || !day) return dateKey;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return dateKeyFromDate(date);
}

function createPrototypeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeAccountUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function normalizeRegisteredAccountRole(role?: AccountRole): AccountRole {
  return role === "staff" || role === "student" || role === "guardian" ? role : "guardian";
}

function isPrototypeLoginUsername(username: string) {
  const normalizedUsername = username.trim().toLowerCase();
  return [prototypeManagerLogin.username, prototypeStudentLogin.username, prototypeParentLogin.username].some((prototypeUsername) => prototypeUsername.toLowerCase() === normalizedUsername);
}

function isChildUsernameUnavailable(username: string, childAccounts: readonly ChildAccount[], managedAccounts: readonly ManagedAccount[], excludeChildId?: string) {
  const normalizedUsername = normalizeChildUsername(username);
  if (!normalizedUsername) return false;
  const normalizedLower = normalizedUsername.toLowerCase();
  return (
    isPrototypeLoginUsername(normalizedUsername) ||
    managedAccounts.some((account) => account.username.toLowerCase() === normalizedLower) ||
    childAccounts.some((child) => child.id !== excludeChildId && child.username.toLowerCase() === normalizedLower)
  );
}

function isRegisteredAccountLoginCollision(email: string, managedAccounts: readonly Pick<ManagedAccount, "username">[], childAccounts: readonly Pick<ChildAccount, "username">[]) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;
  return (
    managedAccounts.some((account) => account.username.trim().toLowerCase() === normalizedEmail) ||
    childAccounts.some((child) => child.username.trim().toLowerCase() === normalizedEmail)
  );
}

function managedAccountCreationKey(account: Pick<ManagedAccount, "displayName" | "username" | "password" | "role" | "status" | "studentId" | "email" | "phone" | "title" | "notes" | "access">) {
  return [
    normalizeContactText(account.displayName),
    normalizeAccountUsername(account.username),
    account.password.trim(),
    account.role,
    account.status,
    account.studentId?.trim() ?? "",
    normalizeContactText(account.email ?? ""),
    normalizeContactText(account.phone ?? ""),
    normalizeContactText(account.title ?? ""),
    normalizeContactText(account.notes ?? ""),
    account.access.join(",")
  ].join("::");
}

function childAccountCreationKey(child: Pick<ChildAccount, "parentEmail" | "name" | "username" | "password" | "age" | "beltSlug">) {
  return [
    child.parentEmail.trim().toLowerCase(),
    normalizeContactText(child.name),
    normalizeChildUsername(child.username),
    child.password?.trim() ?? "",
    child.age.trim(),
    child.beltSlug
  ].join("::");
}

function registeredAccountCreationKey(account: Pick<AccountRecord, "email" | "password" | "role">) {
  return [account.email.trim().toLowerCase(), account.password?.trim() ?? "", normalizeRegisteredAccountRole(account.role)].join("::");
}

function studentFullName(student: Pick<StudentRecord, "firstName" | "lastName">) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function isCurrentOperationsStudent(student: StudentRecord) {
  return isCurrentStudentEnrollment(student);
}

function isValidBookingDetails(booking: BookingDetails) {
  return (
    Number.isInteger(booking.persons) &&
    booking.persons > 0 &&
    Boolean(booking.date.trim()) &&
    Boolean(booking.time.trim()) &&
    booking.timezone === "America/Chicago"
  );
}

function normalizeBookingDetails(booking: BookingDetails): BookingDetails {
  return {
    persons: booking.persons,
    date: booking.date.trim(),
    time: booking.time.trim(),
    timezone: booking.timezone
  };
}

function bookingDetailsKey(booking: BookingDetails) {
  const normalizedBooking = normalizeBookingDetails(booking);
  return [normalizedBooking.date, normalizedBooking.time, normalizedBooking.timezone, normalizedBooking.persons].join("::");
}

function isValidContactSubmission(contact: ContactSubmission) {
  return Boolean(contact.name.trim() && contact.message.trim() && (contact.email.trim() || contact.phone.trim()));
}

function normalizeMessagePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits || value.trim().toLowerCase();
}

function hasSmsOptOut(value?: string) {
  return Boolean(value?.trim());
}

function hasStudentSmsSendConsent(student: StudentRecord) {
  return Boolean(student.phone.trim() && hasStudentSmsConsent(student));
}

function normalizeTwilioRelayPhone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

const twilioDeliveryStatuses = new Set<TwilioDeliveryStatus>(["accepted", "scheduled", "queued", "sending", "sent", "delivered", "undelivered", "failed", "canceled"]);
const failedTwilioDeliveryStatuses = new Set<TwilioDeliveryStatus>(["undelivered", "failed", "canceled"]);

function normalizeTwilioDeliveryStatus(value: unknown): TwilioDeliveryStatus | undefined {
  if (typeof value !== "string") return undefined;
  const status = value.trim().toLowerCase();
  return twilioDeliveryStatuses.has(status as TwilioDeliveryStatus) ? (status as TwilioDeliveryStatus) : undefined;
}

function normalizeContactText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

type TextBlastRecipient = {
  id: string;
  role: NonNullable<MessageLog["recipientRole"]>;
  name: string;
  phone: string;
};

function textDeliveryMetadata(status: NonNullable<MessageLog["deliveryStatus"]>) {
  return {
    deliveryChannel: "sms" as const,
    deliveryProvider: "twilio" as const,
    deliveryMode: "prototype" as const,
    deliveryStatus: status,
    deliveryDetail: "Ready for a server-side Twilio relay; simulated inside the static prototype."
  };
}

function studentTextRecipient(student: StudentRecord): TextBlastRecipient | undefined {
  const phone = student.phone.trim();
  if (!phone || !isCurrentOperationsStudent(student) || !hasStudentSmsConsent(student)) return undefined;
  return {
    id: student.id,
    role: "student",
    name: studentFullName(student),
    phone
  };
}

function parentTextRecipient(student: StudentRecord): TextBlastRecipient | undefined {
  const phone = student.guardianPhone?.trim();
  if (!phone || !isCurrentOperationsStudent(student) || !hasGuardianSmsConsent(student)) return undefined;
  const studentName = studentFullName(student);
  return {
    id: `parent-${student.id}`,
    role: "parent",
    name: student.guardianName?.trim() || `${studentName} Parent/Guardian`,
    phone
  };
}

function staffTextRecipient(account: ManagedAccount): TextBlastRecipient | undefined {
  const phone = account.phone?.trim();
  if (!phone || account.role !== "staff" || account.status !== "active" || !hasStaffSmsConsent(account)) return undefined;
  return {
    id: account.id,
    role: "staff",
    name: account.displayName.trim(),
    phone
  };
}

function uniqueTextBlastRecipients(recipients: readonly TextBlastRecipient[]) {
  const seenPhones = new Set<string>();
  return recipients.filter((recipient) => {
    const phoneKey = normalizeMessagePhone(recipient.phone);
    if (!recipient.name.trim() || !phoneKey || seenPhones.has(phoneKey)) return false;
    seenPhones.add(phoneKey);
    return true;
  });
}

function getTextBlastRecipients(audience: MessageCampaign["audience"], students: readonly StudentRecord[], managedAccounts: readonly ManagedAccount[]) {
  const studentRecipients = students.flatMap((student) => {
    const recipient = studentTextRecipient(student);
    return recipient ? [recipient] : [];
  });
  const parentRecipients = students.flatMap((student) => {
    const recipient = parentTextRecipient(student);
    return recipient ? [recipient] : [];
  });
  const staffRecipients = managedAccounts.flatMap((account) => {
    const recipient = staffTextRecipient(account);
    return recipient ? [recipient] : [];
  });

  if (audience === "parents") return uniqueTextBlastRecipients(parentRecipients);
  if (audience === "staff") return uniqueTextBlastRecipients(staffRecipients);
  if (audience === "everyone") return uniqueTextBlastRecipients([...studentRecipients, ...parentRecipients, ...staffRecipients]);
  return uniqueTextBlastRecipients(studentRecipients);
}

function studioClassCreationKey(studioClass: Pick<StudioClass, "name" | "daysOfWeek" | "startTime" | "endTime" | "recurring" | "notes">) {
  return [
    normalizeContactText(studioClass.name),
    [...studioClass.daysOfWeek].sort((left, right) => left - right).join(","),
    studioClass.startTime.trim(),
    studioClass.endTime.trim(),
    studioClass.recurring === false ? "calendar-off" : "recurring",
    normalizeContactText(studioClass.notes ?? "")
  ].join("::");
}

function scheduledClassCreationKey(scheduledClass: Pick<ScheduledClass, "title" | "date" | "time" | "type" | "recurring" | "studentId" | "notes">) {
  return [
    normalizeContactText(scheduledClass.title),
    scheduledClass.date.trim(),
    scheduledClass.time.trim(),
    scheduledClass.type.trim().toLowerCase(),
    scheduledClass.recurring ? "recurring" : "single",
    scheduledClass.studentId?.trim() ?? "",
    normalizeContactText(scheduledClass.notes ?? "")
  ].join("::");
}

function studioEventCreationKey(event: Pick<StudioEvent, "title" | "date" | "time" | "details" | "audience">) {
  return [
    normalizeContactText(event.title),
    event.date.trim(),
    event.time.trim(),
    normalizeContactText(event.details),
    event.audience
  ].join("::");
}

function merchandiseItemCatalogKey(item: Pick<MerchandiseItem, "name" | "category"> | Pick<MerchandiseInput, "name" | "category">) {
  return [normalizeContactText(item.name), normalizeContactText(item.category)].join("::");
}

function trainingVideoFolderCreationKey(folder: Pick<TrainingVideoFolder, "name" | "subject"> | Pick<TrainingVideoFolderInput, "name" | "subject">) {
  return [normalizeContactText(folder.name), normalizeContactText(folder.subject)].join("::");
}

function trainingVideoCreationKey(video: Pick<TrainingVideo, "folderId" | "title" | "fileName" | "mimeType" | "videoDataUrl"> | Pick<TrainingVideoInput, "folderId" | "title" | "fileName" | "mimeType" | "videoDataUrl">) {
  return [video.folderId.trim(), normalizeContactText(video.title), normalizeContactText(video.fileName), video.mimeType.trim().toLowerCase(), video.videoDataUrl.trim()].join("::");
}

function studyGuideFolderCreationKey(folder: Pick<StudyGuideFolder, "name" | "subject" | "parentId"> | Pick<StudyGuideFolderInput, "name" | "subject" | "parentId">) {
  return [normalizeContactText(folder.name), normalizeContactText(folder.subject), folder.parentId?.trim() ?? ""].join("::");
}

function studyGuideMaterialCreationKey(material: Pick<StudyGuideMaterial, "folderId" | "title" | "fileName" | "mimeType" | "fileDataUrl"> | Pick<StudyGuideMaterialInput, "folderId" | "title" | "fileName" | "mimeType" | "fileDataUrl">) {
  return [material.folderId.trim(), normalizeContactText(material.title), normalizeContactText(material.fileName), material.mimeType.trim().toLowerCase(), material.fileDataUrl.trim()].join("::");
}

function contactSubmissionDateKey(contact: Pick<ContactSubmission, "createdAt">) {
  const createdAt = contact.createdAt.trim();
  return createdAt.includes("T") ? createdAt.slice(0, 10) : createdAt;
}

function contactSubmissionKey(contact: ContactSubmission) {
  return [
    contactSubmissionDateKey(contact),
    normalizeContactText(contact.name),
    contact.email.trim().toLowerCase(),
    normalizeMessagePhone(contact.phone),
    normalizeContactText(contact.message)
  ].join("::");
}

function studentEnrollmentKey(student: Pick<StudentRecord, "firstName" | "lastName" | "email" | "phone">) {
  return [
    studentFullName(student).trim().toLowerCase(),
    student.email.trim().toLowerCase(),
    normalizeMessagePhone(student.phone)
  ].join("::");
}

function isMessageLogLinkedToStudent(message: Pick<MessageLog, "recipientName" | "recipientPhone" | "recipientRole" | "recipientId">, student: StudentRecord) {
  const messagePhone = normalizeMessagePhone(message.recipientPhone);
  if (message.recipientRole === "parent") {
    return (
      message.recipientId === `parent-${student.id}` ||
      (
        message.recipientName.trim().toLowerCase() === (student.guardianName?.trim().toLowerCase() ?? "") &&
        messagePhone === normalizeMessagePhone(student.guardianPhone ?? "")
      )
    );
  }
  return (
    message.recipientName.trim().toLowerCase() === studentFullName(student).trim().toLowerCase() &&
    messagePhone === normalizeMessagePhone(student.phone)
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceWholeWord(value: string, search: string, replacement: string) {
  const cleanSearch = search.trim();
  const cleanReplacement = replacement.trim();
  if (!cleanSearch || cleanSearch === cleanReplacement) return value;
  return value.replace(new RegExp(`\\b${escapeRegExp(cleanSearch)}\\b`, "g"), cleanReplacement);
}

function retargetQueuedMessageBody(body: string, previousStudent: StudentRecord, updatedStudent: StudentRecord) {
  const previousName = studentFullName(previousStudent);
  const updatedName = studentFullName(updatedStudent);
  const fullNameRetargeted = previousName === updatedName ? body : body.split(previousName).join(updatedName);
  return replaceWholeWord(fullNameRetargeted, previousStudent.firstName, updatedStudent.firstName);
}

function retargetQueuedMessageForStudent(message: MessageLog, previousStudent: StudentRecord, updatedStudent: StudentRecord): MessageLog {
  if (message.status !== "queued" || !isMessageLogLinkedToStudent(message, previousStudent)) return message;
  if (message.recipientRole === "parent") {
    return {
      ...message,
      recipientName: updatedStudent.guardianName?.trim() || `${studentFullName(updatedStudent)} Parent/Guardian`,
      recipientPhone: updatedStudent.guardianPhone?.trim() ?? "",
      recipientId: `parent-${updatedStudent.id}`,
      body: retargetQueuedMessageBody(message.body, previousStudent, updatedStudent)
    };
  }
  return {
    ...message,
    recipientName: studentFullName(updatedStudent),
    recipientPhone: updatedStudent.phone,
    recipientId: updatedStudent.id,
    recipientRole: message.recipientRole ?? "student",
    body: retargetQueuedMessageBody(message.body, previousStudent, updatedStudent)
  };
}

function managedStudentAccountDetails(student: StudentRecord) {
  return {
    displayName: studentFullName(student),
    email: student.email,
    phone: student.phone,
    title: `${student.beltRank} Belt Student`
  };
}

function isDirectMessageParticipantAvailable(participantId: string, students: readonly StudentRecord[]) {
  const cleanParticipantId = participantId.trim();
  if (!cleanParticipantId) return false;
  if (cleanParticipantId.startsWith("direct-staff-")) return true;
  const studentId = cleanParticipantId.startsWith("parent-") ? cleanParticipantId.slice("parent-".length) : cleanParticipantId;
  return students.some((student) => student.id === studentId && isCurrentOperationsStudent(student));
}

function isStaffDirectMessageParticipant(participantId: string) {
  return participantId.trim().toLowerCase().startsWith("direct-staff-");
}

function directMessageStudentIdForParticipant(participantId: string) {
  const cleanParticipantId = participantId.trim();
  return cleanParticipantId.startsWith("parent-") ? cleanParticipantId.slice("parent-".length) : cleanParticipantId;
}

function getUnreadDirectMessageNotifications(directMessages: readonly DirectMessage[], settings: MessageNotificationSettings, students: readonly StudentRecord[]) {
  const lastSeen = settings.lastSeenDirectMessageAt?.trim() ?? "";
  const currentStudentIds = new Set(students.filter(isCurrentOperationsStudent).map((student) => student.id));
  return directMessages
    .filter((message) => {
      const createdAt = message.createdAt.trim();
      if (message.status !== "sent" || !createdAt || createdAt <= lastSeen) return false;
      if (!isStaffDirectMessageParticipant(message.recipientId) || isStaffDirectMessageParticipant(message.senderId)) return false;
      return currentStudentIds.has(directMessageStudentIdForParticipant(message.senderId));
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
}

function isDirectMessageLinkedToStudent(message: Pick<DirectMessage, "senderId" | "recipientId">, studentId: string) {
  const studentParticipantIds = new Set([studentId, `parent-${studentId}`]);
  return studentParticipantIds.has(message.senderId.trim()) || studentParticipantIds.has(message.recipientId.trim());
}

function directMessageParticipantNameForStudent(participantId: string, student: StudentRecord) {
  const cleanParticipantId = participantId.trim();
  const studentName = studentFullName(student);
  if (cleanParticipantId === student.id) return studentName;
  if (cleanParticipantId === `parent-${student.id}`) return student.guardianName?.trim() || `${studentName} Parent/Guardian`;
  return undefined;
}

function retargetDirectMessageForStudent(message: DirectMessage, student: StudentRecord): DirectMessage {
  const senderName = directMessageParticipantNameForStudent(message.senderId, student);
  const recipientName = directMessageParticipantNameForStudent(message.recipientId, student);
  if (!senderName && !recipientName) return message;
  return {
    ...message,
    senderName: senderName ?? message.senderName,
    recipientName: recipientName ?? message.recipientName
  };
}

function retargetCheckInForStudent(checkIn: StudentCheckIn, student: StudentRecord): StudentCheckIn {
  if (checkIn.studentId !== student.id) return checkIn;
  const studentName = studentFullName(student);
  if (checkIn.studentName === studentName) return checkIn;
  return { ...checkIn, studentName };
}

function splitStudentName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ")
  };
}

function normalizeStudentInput(student: StudentInput, fallbackEnrollmentDate = todayStamp()) {
  const { firstName, lastName } = splitStudentName(student.fullName);
  const phone = student.guardianPhone.trim() || student.emergencyContactPhone?.trim() || "";
  const email = student.studentEmail.trim();
  const beltRank = student.beltRank.trim() || "White";
  const enrollmentDate = student.enrollmentDate?.trim() || fallbackEnrollmentDate;
  if (!firstName || !phone || !email) return undefined;

  return {
    firstName,
    lastName,
    dateOfBirth: student.dateOfBirth?.trim() || undefined,
    gender: student.gender?.trim() || undefined,
    phone,
    email,
    guardianName: student.guardianName?.trim() || undefined,
    guardianPhone: student.guardianPhone.trim() || undefined,
    guardianEmail: student.guardianEmail?.trim() || undefined,
    emergencyContactName: student.emergencyContactName?.trim() || undefined,
    emergencyContactRelationship: student.emergencyContactRelationship?.trim() || undefined,
    emergencyContactPhone: student.emergencyContactPhone?.trim() || undefined,
    emergencyContactEmail: student.emergencyContactEmail?.trim() || undefined,
    enrollmentDate,
    program: student.program?.trim() || "Youth Foundations",
    status: student.status?.trim() || "Active",
    beltRank,
    profileUpdatedAt: todayStamp(),
    joinedAt: enrollmentDate,
    notes: student.notes?.trim()
  };
}

function welcomeTextForStudent(student: StudentRecord) {
  return `Welcome ${student.firstName} to Cho's Martial Arts. Start here: ${studio.facebookUrl} and ${studio.instagramUrl}. Website: ${studio.mapsUrl}`;
}

function missedClassTextForStudent(student: StudentRecord) {
  return `We missed you in class, ${student.firstName}. You missed ${student.missedClassCount} classes. Reply or call ${studio.phone} so we can help you get back on schedule.`;
}

function trialConversionTextForStudent(student: StudentRecord) {
  return `Hi ${student.firstName}, we would love to help you choose the best Cho's program after your trial. Reply or call ${studio.phone} and we will help with the next step.`;
}

function newStudentCheckInTextForStudent(student: StudentRecord) {
  const programLabel = student.program?.trim() ? ` in ${student.program.trim()}` : "";
  return `Hi ${student.firstName}, how is your first week${programLabel} at Cho's Martial Arts going? Reply or call ${studio.phone} if we can help with schedule, gear, or training questions.`;
}

function attendanceGapCheckInTextForStudent(student: StudentRecord) {
  return `Hi ${student.firstName}, we missed seeing you at Cho's Martial Arts. Reply or call ${studio.phone} if you need help finding a class time or getting back on the mat.`;
}

function pausedStudentTextForStudent(student: StudentRecord) {
  return `Hi ${student.firstName}, we would love to help you get back on the mat. Reply or call ${studio.phone} and we will find the right class time.`;
}

function beltTestInviteTextForStudent(student: StudentRecord) {
  return `Hi ${student.firstName}, your class count and consistency show you may be ready for belt testing review. Reply or call ${studio.phone} and we will confirm the next step.`;
}

function milestoneEncouragementTextForStudent(student: StudentRecord) {
  const progress = buildStudentBeltProgress(student);
  const nextRankLabel = progress.nextRankName ? `${progress.nextRankName} Belt` : "your next rank";
  return `Hi ${student.firstName}, you are ${progress.progressPercent}% of the way to your next belt milestone for ${nextRankLabel}. Keep training strong and ask your instructor what to focus on next.`;
}

function celebrationTextForStudent(student: StudentRecord, event: ReturnType<typeof getStudentCelebrationEvents>[number]) {
  if (event.reason === "birthday") {
    return `Hi ${student.firstName}, Cho's Martial Arts is celebrating your birthday this week. Keep training strong and enjoy your special day.`;
  }
  const yearLabel = event.years === 1 ? "1 year" : `${event.years ?? 0} years`;
  return `Hi ${student.firstName}, your Cho's training anniversary is this week. Thank you for training with us for ${yearLabel}; we are proud of your progress.`;
}

function profileUpdateTextForStudent(student: StudentRecord) {
  const issues = getStudentProfileIssues(student);
  const issueLabel = issues.length === 1 ? issues[0].toLowerCase() : "profile information";
  return `Hi ${student.firstName}, Cho's Martial Arts is updating student profile information for safety and communication. Please reply with your current ${issueLabel} or call ${studio.phone}.`;
}

function classReminderTextForStudent(student: StudentRecord, reminder: ReturnType<typeof getClassReminderCandidates>[number]) {
  return `Hi ${student.firstName}, reminder: ${reminder.title} is scheduled for ${reminder.date} at ${reminder.time} at Cho's Martial Arts. Reply or call ${studio.phone} if you need help.`;
}

function eventReminderTextForRecipient(event: StudioEvent, student: StudentRecord, recipient: TextBlastRecipient) {
  const detail = event.details.trim() ? ` ${event.details.trim()}` : "";
  if (recipient.role === "parent") {
    return `Hi ${recipient.name}, reminder: ${event.title} is scheduled for ${event.date} at ${event.time} at Cho's Martial Arts for ${studentFullName(student)}.${detail} Reply or call ${studio.phone} if you need help.`;
  }
  return `Hi ${student.firstName}, reminder: ${event.title} is scheduled for ${event.date} at ${event.time} at Cho's Martial Arts.${detail} Reply or call ${studio.phone} if you need help.`;
}

function eventReminderRecipients(event: StudioEvent, student: StudentRecord) {
  const recipients: TextBlastRecipient[] = [];
  const studentRecipient = studentTextRecipient(student);
  const guardianRecipient = parentTextRecipient(student);
  if (event.audience === "students" && studentRecipient) recipients.push(studentRecipient);
  if (event.audience === "families" && guardianRecipient) recipients.push(guardianRecipient);
  if (event.audience === "public") {
    if (studentRecipient) recipients.push(studentRecipient);
    if (guardianRecipient) recipients.push(guardianRecipient);
  }
  return recipients;
}

function getEventReminderCandidates(events: readonly StudioEvent[], students: readonly StudentRecord[], today: string) {
  const reminderEnd = addDaysToDateKey(today, 7);
  const upcomingEvents = events.filter((event) => {
    const eventDate = event.date.trim();
    return Boolean(eventDate && eventDate >= today && eventDate <= reminderEnd);
  });
  return upcomingEvents.flatMap((event) =>
    students.flatMap((student) =>
      eventReminderRecipients(event, student).map((recipient) => ({
        event,
        student,
        recipient
      }))
    )
  );
}

function studentIdsForMessageLogs(logs: readonly Pick<MessageLog, "recipientId" | "recipientRole">[]) {
  return new Set(
    logs.flatMap((log) => {
      const recipientId = log.recipientId?.trim();
      if (!recipientId) return [];
      if (log.recipientRole === "parent" && recipientId.startsWith("parent-")) return [recipientId.slice("parent-".length)];
      if (log.recipientRole === "student") return [recipientId];
      return [];
    })
  );
}

function buildTwilioRelayMessage(message: MessageLog) {
  const smsEstimate = estimateSmsSegments(message.body);
  const to = normalizeTwilioRelayPhone(message.recipientPhone);
  const phoneKey = to.replace(/\D/g, "");
  return {
    id: message.id,
    to,
    body: message.body,
    recipientName: message.recipientName,
    recipientRole: message.recipientRole,
    recipientId: message.recipientId,
    kind: message.kind,
    campaignId: message.campaignId,
    createdAt: message.createdAt,
    smsEncoding: smsEstimate.encoding,
    smsUnitCount: smsEstimate.units,
    smsSegmentCount: smsEstimate.segments,
    optOutLanguageDetected: hasSmsOptOutLanguage(message.body),
    idempotencyKey: `chos-${message.id}-${phoneKey}`,
    statusCallbackPath: `/api/messages/status/${encodeURIComponent(message.id)}`
  };
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeTwilioRelayResult(value: unknown): TwilioRelayResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = stringField(record.id) ?? stringField(record.messageId) ?? stringField(record.MessageId);
  const deliveryStatus = normalizeTwilioDeliveryStatus(record.deliveryStatus ?? record.status ?? record.MessageStatus);
  if (!id || !deliveryStatus) return undefined;
  return {
    id,
    deliveryStatus,
    deliveryProviderMessageId: stringField(record.deliveryProviderMessageId) ?? stringField(record.sid) ?? stringField(record.messageSid) ?? stringField(record.MessageSid),
    sentAt: stringField(record.sentAt) ?? stringField(record.dateSent),
    deliveryDetail: stringField(record.deliveryDetail),
    errorCode: stringField(record.errorCode) ?? stringField(record.ErrorCode),
    errorMessage: stringField(record.errorMessage) ?? stringField(record.ErrorMessage)
  };
}

function parseTwilioRelayResults(rawResults: string) {
  const cleanResults = rawResults.trim();
  if (!cleanResults) return undefined;
  try {
    const parsed = JSON.parse(cleanResults) as unknown;
    const rawItems = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { results?: unknown }).results)
        ? (parsed as { results: unknown[] }).results
        : undefined;
    if (!rawItems) return undefined;
    return rawItems.flatMap((item) => {
      const result = normalizeTwilioRelayResult(item);
      return result ? [result] : [];
    });
  } catch {
    return undefined;
  }
}

function parseTwilioStatusCallbackForm(rawCallbacks: string): unknown[] | undefined {
  if (!rawCallbacks.includes("=")) return undefined;
  const params = new URLSearchParams(rawCallbacks);
  const record: Record<string, string> = {};
  params.forEach((value, key) => {
    record[key] = value;
  });
  return Object.keys(record).length ? [record] : undefined;
}

function twilioStatusCallbackItems(parsed: unknown): unknown[] | undefined {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return undefined;
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.callbacks)) return record.callbacks;
  if (Array.isArray(record.statusCallbacks)) return record.statusCallbacks;
  if (Array.isArray(record.results)) return record.results;
  return [record];
}

function parseTwilioStatusCallbacks(rawCallbacks: string) {
  const cleanCallbacks = rawCallbacks.trim();
  if (!cleanCallbacks) return undefined;
  try {
    const rawItems = twilioStatusCallbackItems(JSON.parse(cleanCallbacks) as unknown);
    if (!rawItems) return undefined;
    return rawItems.flatMap((item) => {
      const result = item && typeof item === "object" ? normalizeTwilioStatusCallbackForServer(item as Record<string, unknown>) : undefined;
      return result ? [result] : [];
    });
  } catch {
    const rawItems = parseTwilioStatusCallbackForm(cleanCallbacks);
    if (!rawItems) return undefined;
    return rawItems.flatMap((item) => {
      const result = item && typeof item === "object" ? normalizeTwilioStatusCallbackForServer(item as Record<string, unknown>) : undefined;
      return result ? [result] : [];
    });
  }
}

function twilioRelayDeliveryDetail(result: TwilioRelayResult) {
  const base = result.deliveryDetail?.trim() || `Twilio status: ${result.deliveryStatus}.`;
  const errorCode = result.errorCode?.trim();
  const errorMessage = result.errorMessage?.trim().replace(/\.+$/, "");
  if (!errorCode && !errorMessage) return base;
  const errorLabel = errorCode && errorMessage ? `Error ${errorCode}: ${errorMessage}.` : `Error ${errorCode || errorMessage}.`;
  return `${base.replace(/\s*\.*$/, ".")} ${errorLabel}`;
}

function applyTwilioRelayResultToMessage(message: MessageLog, result: TwilioRelayResult, appliedAt: string): MessageLog {
  const failed = failedTwilioDeliveryStatuses.has(result.deliveryStatus);
  return {
    ...message,
    status: failed ? "failed" : "sent",
    sentAt: failed ? message.sentAt : (result.sentAt ?? message.sentAt ?? appliedAt),
    deliveryChannel: "sms",
    deliveryProvider: "twilio",
    deliveryMode: "live",
    deliveryStatus: result.deliveryStatus,
    deliveryDetail: twilioRelayDeliveryDetail(result),
    deliveryProviderMessageId: result.deliveryProviderMessageId ?? message.deliveryProviderMessageId
  };
}

function parseTwilioInboundWebhook(rawWebhook: string): TwilioInboundSmsWebhook | undefined {
  const cleanWebhook = rawWebhook.trim();
  if (!cleanWebhook) return undefined;
  try {
    const parsed = JSON.parse(cleanWebhook) as unknown;
    if (!parsed || typeof parsed !== "object") return undefined;
    return normalizeTwilioInboundSmsWebhookForServer(parsed as Record<string, unknown>);
  } catch {
    return cleanWebhook.includes("=") ? normalizeTwilioInboundSmsWebhookForServer(new URLSearchParams(cleanWebhook)) : undefined;
  }
}

function inboundSmsDirectSenderForPhone(phone: string, students: readonly StudentRecord[]) {
  const phoneKey = normalizeMessagePhone(phone);
  if (!phoneKey) return undefined;
  for (const student of students) {
    if (!isCurrentOperationsStudent(student)) continue;
    if (normalizeMessagePhone(student.guardianPhone ?? "") === phoneKey) {
      return {
        senderId: `parent-${student.id}`,
        senderName: student.guardianName?.trim() || `${studentFullName(student)} Parent/Guardian`
      };
    }
    if (normalizeMessagePhone(student.phone) === phoneKey) {
      return {
        senderId: student.id,
        senderName: studentFullName(student)
      };
    }
  }
  return undefined;
}

function makeMessageLog(input: Omit<MessageLog, "id" | "createdAt" | "status">): MessageLog {
  return {
    ...input,
    id: createPrototypeId("message"),
    createdAt: new Date().toISOString(),
    status: "queued",
    ...textDeliveryMetadata("queued"),
    deliveryDetail: input.deliveryDetail ?? textDeliveryMetadata("queued").deliveryDetail
  };
}

function messageLogDateKey(message: Pick<MessageLog, "createdAt">) {
  const createdAt = message.createdAt.trim();
  return createdAt.includes("T") ? createdAt.slice(0, 10) : createdAt;
}

function messageLogOutreachKey(message: Pick<MessageLog, "kind" | "recipientName" | "recipientPhone" | "body" | "createdAt">) {
  return [
    messageLogDateKey(message),
    message.kind,
    message.recipientName.trim().toLowerCase(),
    normalizeMessagePhone(message.recipientPhone),
    message.body.trim()
  ].join("::");
}

function isTimeKey(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function localTimeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function scheduledTextCampaignDue(campaign: ScheduledTextCampaign, now: Date) {
  const today = dateStamp(now);
  if (campaign.scheduledFor < today) return true;
  if (campaign.scheduledFor > today) return false;
  return (campaign.scheduledTime?.trim() || "00:00") <= localTimeKey(now);
}

function scheduledTextCampaignKey(campaign: Pick<ScheduledTextCampaign, "scheduledFor" | "audience" | "body" | "scheduledTime">) {
  return [
    campaign.scheduledFor.trim(),
    campaign.scheduledTime?.trim() || "00:00",
    campaign.audience,
    normalizeContactText(campaign.body)
  ].join("::");
}

function directMessageDateKey(message: Pick<DirectMessage, "createdAt">) {
  const createdAt = message.createdAt.trim();
  return createdAt.includes("T") ? createdAt.slice(0, 10) : createdAt;
}

function directMessageOutboxKey(message: Pick<DirectMessage, "threadId" | "senderId" | "recipientId" | "body" | "createdAt" | "status">) {
  return [
    directMessageDateKey(message),
    message.threadId.trim(),
    message.senderId.trim(),
    message.recipientId.trim(),
    message.status,
    message.body.trim()
  ].join("::");
}

function prependUniqueMessageLogs(logs: readonly MessageLog[], current: readonly MessageLog[]) {
  const seenKeys = new Set(current.map(messageLogOutreachKey));
  const inserted = logs.filter((log) => {
    const key = messageLogOutreachKey(log);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  return {
    inserted,
    next: inserted.length ? [...inserted, ...current] : [...current]
  };
}

function cleanNonnegativeInteger(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value as number));
}

function cleanMerchandiseThresholds(item: MerchandiseInput) {
  const reorderPoint = cleanNonnegativeInteger(item.reorderPoint, 3);
  const targetStock = cleanNonnegativeInteger(item.targetStock, 8);
  return {
    reorderPoint,
    targetStock: Math.max(targetStock, reorderPoint + 1)
  };
}

function restoreRegisteredAccountPasswords(restoredAccounts: OperationsBackupData["accounts"], currentAccounts: AccountRecord[]) {
  const currentByEmail = new Map(currentAccounts.map((account) => [account.email.trim().toLowerCase(), account]));
  return restoredAccounts.map((account) => {
    const restoredAccount = account as AccountRecord;
    return {
      ...restoredAccount,
      password: currentByEmail.get(restoredAccount.email.trim().toLowerCase())?.password
    };
  }) as AccountRecord[];
}

function restoreManagedAccountPasswords(restoredAccounts: OperationsBackupData["managedAccounts"], currentAccounts: ManagedAccount[]) {
  const currentById = new Map(currentAccounts.map((account) => [account.id, account]));
  const currentByUsername = new Map(currentAccounts.map((account) => [account.username.toLowerCase(), account]));
  return restoredAccounts.map((account) => ({
    ...account,
    password: currentById.get(account.id)?.password ?? currentByUsername.get(account.username.toLowerCase())?.password ?? ""
  })) as ManagedAccount[];
}

function restoreChildAccountPasswords(restoredAccounts: OperationsBackupData["childAccounts"], currentAccounts: ChildAccount[]) {
  const currentById = new Map(currentAccounts.map((account) => [account.id, account]));
  const currentByUsername = new Map(currentAccounts.map((account) => [account.username.toLowerCase(), account]));
  return restoredAccounts.map(({ hasSavedPassword: _hasSavedPassword, ...account }) => ({
    ...account,
    password: currentById.get(account.id)?.password ?? currentByUsername.get(account.username.toLowerCase())?.password
  })) as ChildAccount[];
}

function assertRestoredLoginPasswordsAvailable(
  restoredAccounts: AccountRecord[],
  restoredManagedAccounts: ManagedAccount[],
  restoredChildAccounts: ChildAccount[],
  restoredChildAccountBackups: OperationsBackupData["childAccounts"],
  restoredAccountRoles: readonly AccountRoleRecord[]
) {
  const restoredStudentRoleUsernames = new Set(
    restoredAccountRoles
      .filter((record) => record.role === "student")
      .map((record) => record.email.trim().toLowerCase())
  );
  const passwordProtectedChildIds = new Set(
    restoredChildAccountBackups
      .filter((child) => child.hasSavedPassword || restoredStudentRoleUsernames.has(child.username.trim().toLowerCase()))
      .map((child) => child.id)
  );
  const missingRegisteredPasswords = restoredAccounts.some((account) => !account.password?.trim());
  const missingManagedPasswords = restoredManagedAccounts.some((account) => !account.password.trim());
  const missingChildPasswords = restoredChildAccounts.some((child) => passwordProtectedChildIds.has(child.id) && !child.password?.trim());
  if (missingRegisteredPasswords || missingManagedPasswords || missingChildPasswords) {
    throw new Error("Backup includes custom login accounts whose passwords are not available locally. Exported backups redact saved passwords, so import on a device that already has those logins saved or recreate the custom logins before importing.");
  }
}

function writeRestoredPlainStorageValue(key: string, value?: string) {
  if (typeof window === "undefined" || value === undefined) return;
  try {
    const cleanValue = value.trim();
    if (cleanValue) {
      window.localStorage.setItem(key, cleanValue);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Non-secret messaging setup is optional; blocked storage should not break the main restore.
  }
}

function restoreProductionMessagingSetupStorage(setup: OperationsBackupData["messagingSetup"][number] | undefined) {
  if (!setup) return;
  writeRestoredPlainStorageValue(keys.twilioRelayEndpoint, setup.twilioRelayEndpoint);
  writeRestoredPlainStorageValue(keys.pushServerEndpoint, setup.pushServerEndpoint);
  if (setup.twilioLaunchProfile) {
    writeStorage(keys.twilioLaunchProfile, setup.twilioLaunchProfile);
  }
}

function withRestoredMessagingPublicKey(settings: MessageNotificationSettings, setup: OperationsBackupData["messagingSetup"][number] | undefined): MessageNotificationSettings {
  const publicKey = setup?.webPushPublicKey?.trim();
  if (!publicKey) return settings;
  return {
    ...settings,
    pushPublicKey: publicKey,
    updatedAt: new Date().toISOString()
  };
}

function isSessionAvailableAfterRestore(
  currentSession: AccountSession | undefined,
  restoredAccounts: AccountRecord[],
  restoredManagedAccounts: ManagedAccount[],
  restoredChildAccounts: ChildAccount[],
  restoredStudents: readonly StudentRecord[]
) {
  const normalizedEmail = currentSession?.email.trim().toLowerCase();
  if (!normalizedEmail) return false;
  if (inferBuiltInPrototypeAccountRole(normalizedEmail)) return true;
  if (restoredAccounts.some((account) => account.email.trim().toLowerCase() === normalizedEmail && Boolean(account.password?.trim()))) {
    return true;
  }
  if (restoredManagedAccounts.some((account) => account.username.toLowerCase() === normalizedEmail && account.status !== "inactive" && hasValidManagedStudentLink(account, restoredStudents))) {
    return true;
  }
  return restoredChildAccounts.some((child) => child.username.toLowerCase() === normalizedEmail);
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useStoredState<CartItem[]>(keys.cart, []);
  const [orders, setOrders] = useStoredState<Order[]>(keys.orders, []);
  const [bookings, setBookings] = useStoredState<BookingDetails[]>(keys.bookings, []);
  const [contacts, setContacts] = useStoredState<ContactSubmission[]>(keys.contacts, []);
  const [leadReviews, setLeadReviews] = useStoredState<LeadReview[]>(keys.leadReviews, []);
  const [session, setSession] = useSessionState();
  const [accounts, setAccounts] = useStoredState<AccountRecord[]>(keys.accounts, []);
  const [accountRoles, setAccountRoles] = useStoredState<AccountRoleRecord[]>(keys.accountRoles, []);
  const [managedAccounts, setManagedAccounts] = useStoredState<ManagedAccount[]>(keys.managedAccounts, []);
  const [childAccounts, setChildAccounts] = useStoredState<ChildAccount[]>(keys.childAccounts, seedChildAccounts);
  const [coupon, setCoupon] = useStoredState<Coupon | undefined>(keys.coupon, undefined);
  const [students, setStudents] = useStoredState<StudentRecord[]>(keys.students, seedStudents);
  const [studioClasses, setStudioClasses] = useStoredState<StudioClass[]>(keys.studioClasses, seedStudioClasses);
  const [scheduledClasses, setScheduledClasses] = useStoredState<ScheduledClass[]>(keys.scheduledClasses, seedScheduledClasses);
  const [messageCampaigns, setMessageCampaigns] = useStoredState<MessageCampaign[]>(keys.messageCampaigns, []);
  const [scheduledTextCampaigns, setScheduledTextCampaigns] = useStoredState<ScheduledTextCampaign[]>(keys.scheduledTextCampaigns, []);
  const [messageLogs, setMessageLogs] = useStoredState<MessageLog[]>(keys.messageLogs, seedMessageLogs);
  const [textAutomationRuns, setTextAutomationRuns] = useStoredState<TextAutomationRun[]>(keys.textAutomationRuns, []);
  const [messageNotificationSettings, setMessageNotificationSettingsState] = useState<MessageNotificationSettings>(() => readMessageNotificationSettingsForSession(session?.email));
  const [directMessages, setDirectMessages] = useStoredState<DirectMessage[]>(keys.directMessages, seedDirectMessages);
  const [studioEvents, setStudioEvents] = useStoredState<StudioEvent[]>(keys.studioEvents, seedStudioEvents);
  const [merchandiseItems, setMerchandiseItems] = useStoredState<MerchandiseItem[]>(keys.merchandiseItems, seedMerchandiseItems);
  const [checkIns, setCheckIns] = useStoredState<StudentCheckIn[]>(keys.checkIns, []);
  const [trainingVideoFolders, setTrainingVideoFolders] = useStoredState<TrainingVideoFolder[]>(keys.videoFolders, []);
  const [trainingVideos, setTrainingVideos] = useStoredState<TrainingVideo[]>(keys.videos, []);
  const [studyGuideFolders, setStudyGuideFolders] = useStoredState<StudyGuideFolder[]>(keys.studyGuideFolders, []);
  const [studyGuideMaterials, setStudyGuideMaterials] = useStoredState<StudyGuideMaterial[]>(keys.studyGuideMaterials, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const cartRef = useRef(cart);
  const ordersRef = useRef(orders);
  const bookingsRef = useRef(bookings);
  const contactsRef = useRef(contacts);
  const accountsRef = useRef(accounts);
  const studioClassesRef = useRef(studioClasses);
  const scheduledClassesRef = useRef(scheduledClasses);
  const studioEventsRef = useRef(studioEvents);
  const studentsRef = useRef(students);
  const checkInsRef = useRef(checkIns);
  const scheduledTextCampaignsRef = useRef(scheduledTextCampaigns);
  const messageLogsRef = useRef(messageLogs);
  const textAutomationRunsRef = useRef(textAutomationRuns);
  const directMessagesRef = useRef(directMessages);
  const leadReviewsRef = useRef(leadReviews);
  const managedAccountsRef = useRef(managedAccounts);
  const childAccountsRef = useRef(childAccounts);
  const merchandiseItemsRef = useRef(merchandiseItems);
  const trainingVideoFoldersRef = useRef(trainingVideoFolders);
  const trainingVideosRef = useRef(trainingVideos);
  const studyGuideFoldersRef = useRef(studyGuideFolders);
  const studyGuideMaterialsRef = useRef(studyGuideMaterials);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  useEffect(() => {
    studioClassesRef.current = studioClasses;
  }, [studioClasses]);

  useEffect(() => {
    scheduledClassesRef.current = scheduledClasses;
  }, [scheduledClasses]);

  useEffect(() => {
    studioEventsRef.current = studioEvents;
  }, [studioEvents]);

  useEffect(() => {
    trainingVideoFoldersRef.current = trainingVideoFolders;
  }, [trainingVideoFolders]);

  useEffect(() => {
    trainingVideosRef.current = trainingVideos;
  }, [trainingVideos]);

  useEffect(() => {
    studyGuideFoldersRef.current = studyGuideFolders;
  }, [studyGuideFolders]);

  useEffect(() => {
    studyGuideMaterialsRef.current = studyGuideMaterials;
  }, [studyGuideMaterials]);

  const updateCartState = useCallback(
    (next: CartItem[] | ((current: CartItem[]) => CartItem[])) => {
      const current = cartRef.current;
      const resolved = typeof next === "function" ? (next as (currentCart: CartItem[]) => CartItem[])(current) : next;
      if (resolved === current) return resolved;
      cartRef.current = resolved;
      setCart(resolved);
      return resolved;
    },
    [setCart]
  );

  const updateOrdersState = useCallback(
    (next: Order[] | ((current: Order[]) => Order[])) => {
      const current = ordersRef.current;
      const resolved = typeof next === "function" ? (next as (currentOrders: Order[]) => Order[])(current) : next;
      if (resolved === current) return resolved;
      ordersRef.current = resolved;
      setOrders(resolved);
      return resolved;
    },
    [setOrders]
  );

  const updateBookingsState = useCallback(
    (next: BookingDetails[] | ((current: BookingDetails[]) => BookingDetails[])) => {
      const current = bookingsRef.current;
      const resolved = typeof next === "function" ? (next as (currentBookings: BookingDetails[]) => BookingDetails[])(current) : next;
      if (resolved === current) return resolved;
      bookingsRef.current = resolved;
      setBookings(resolved);
      return resolved;
    },
    [setBookings]
  );

  const updateAccountsState = useCallback(
    (next: AccountRecord[] | ((current: AccountRecord[]) => AccountRecord[])) => {
      const current = accountsRef.current;
      const resolved = typeof next === "function" ? (next as (currentAccounts: AccountRecord[]) => AccountRecord[])(current) : next;
      if (resolved === current) return resolved;
      accountsRef.current = resolved;
      setAccounts(resolved);
      return resolved;
    },
    [setAccounts]
  );

  const updateStudioClassesState = useCallback(
    (next: StudioClass[] | ((current: StudioClass[]) => StudioClass[])) => {
      const current = studioClassesRef.current;
      const resolved = typeof next === "function" ? (next as (currentClasses: StudioClass[]) => StudioClass[])(current) : next;
      if (resolved === current) return resolved;
      studioClassesRef.current = resolved;
      setStudioClasses(resolved);
      return resolved;
    },
    [setStudioClasses]
  );

  const updateScheduledClassesState = useCallback(
    (next: ScheduledClass[] | ((current: ScheduledClass[]) => ScheduledClass[])) => {
      const current = scheduledClassesRef.current;
      const resolved = typeof next === "function" ? (next as (currentClasses: ScheduledClass[]) => ScheduledClass[])(current) : next;
      if (resolved === current) return resolved;
      scheduledClassesRef.current = resolved;
      setScheduledClasses(resolved);
      return resolved;
    },
    [setScheduledClasses]
  );

  const updateStudioEventsState = useCallback(
    (next: StudioEvent[] | ((current: StudioEvent[]) => StudioEvent[])) => {
      const current = studioEventsRef.current;
      const resolved = typeof next === "function" ? (next as (currentEvents: StudioEvent[]) => StudioEvent[])(current) : next;
      if (resolved === current) return resolved;
      studioEventsRef.current = resolved;
      setStudioEvents(resolved);
      return resolved;
    },
    [setStudioEvents]
  );

  const updateManagedAccountsState = useCallback(
    (next: ManagedAccount[] | ((current: ManagedAccount[]) => ManagedAccount[])) => {
      const current = managedAccountsRef.current;
      const resolved = typeof next === "function" ? (next as (currentAccounts: ManagedAccount[]) => ManagedAccount[])(current) : next;
      if (resolved === current) return resolved;
      managedAccountsRef.current = resolved;
      setManagedAccounts(resolved);
      return resolved;
    },
    [setManagedAccounts]
  );

  const updateChildAccountsState = useCallback(
    (next: ChildAccount[] | ((current: ChildAccount[]) => ChildAccount[])) => {
      const current = childAccountsRef.current;
      const resolved = typeof next === "function" ? (next as (currentAccounts: ChildAccount[]) => ChildAccount[])(current) : next;
      if (resolved === current) return resolved;
      childAccountsRef.current = resolved;
      setChildAccounts(resolved);
      return resolved;
    },
    [setChildAccounts]
  );

  const updateMerchandiseItemsState = useCallback(
    (next: MerchandiseItem[] | ((current: MerchandiseItem[]) => MerchandiseItem[])) => {
      const current = merchandiseItemsRef.current;
      const resolved = typeof next === "function" ? (next as (currentItems: MerchandiseItem[]) => MerchandiseItem[])(current) : next;
      if (resolved === current) return resolved;
      merchandiseItemsRef.current = resolved;
      setMerchandiseItems(resolved);
      return resolved;
    },
    [setMerchandiseItems]
  );

  const updateTrainingVideoFoldersState = useCallback(
    (next: TrainingVideoFolder[] | ((current: TrainingVideoFolder[]) => TrainingVideoFolder[])) => {
      const current = trainingVideoFoldersRef.current;
      const resolved = typeof next === "function" ? (next as (currentFolders: TrainingVideoFolder[]) => TrainingVideoFolder[])(current) : next;
      if (resolved === current) return resolved;
      trainingVideoFoldersRef.current = resolved;
      setTrainingVideoFolders(resolved);
      return resolved;
    },
    [setTrainingVideoFolders]
  );

  const updateTrainingVideosState = useCallback(
    (next: TrainingVideo[] | ((current: TrainingVideo[]) => TrainingVideo[])) => {
      const current = trainingVideosRef.current;
      const resolved = typeof next === "function" ? (next as (currentVideos: TrainingVideo[]) => TrainingVideo[])(current) : next;
      if (resolved === current) return resolved;
      trainingVideosRef.current = resolved;
      setTrainingVideos(resolved);
      return resolved;
    },
    [setTrainingVideos]
  );

  const updateStudyGuideFoldersState = useCallback(
    (next: StudyGuideFolder[] | ((current: StudyGuideFolder[]) => StudyGuideFolder[])) => {
      const current = studyGuideFoldersRef.current;
      const resolved = typeof next === "function" ? (next as (currentFolders: StudyGuideFolder[]) => StudyGuideFolder[])(current) : next;
      if (resolved === current) return resolved;
      studyGuideFoldersRef.current = resolved;
      setStudyGuideFolders(resolved);
      return resolved;
    },
    [setStudyGuideFolders]
  );

  const updateStudyGuideMaterialsState = useCallback(
    (next: StudyGuideMaterial[] | ((current: StudyGuideMaterial[]) => StudyGuideMaterial[])) => {
      const current = studyGuideMaterialsRef.current;
      const resolved = typeof next === "function" ? (next as (currentMaterials: StudyGuideMaterial[]) => StudyGuideMaterial[])(current) : next;
      if (resolved === current) return resolved;
      studyGuideMaterialsRef.current = resolved;
      setStudyGuideMaterials(resolved);
      return resolved;
    },
    [setStudyGuideMaterials]
  );

  useEffect(() => {
    setMessageNotificationSettingsState(readMessageNotificationSettingsForSession(session?.email));
  }, [session?.email]);

  const setMessageNotificationSettings = useCallback(
    (next: MessageNotificationSettings | ((previous: MessageNotificationSettings) => MessageNotificationSettings)) => {
      setMessageNotificationSettingsState((previous) => {
        const resolved = typeof next === "function" ? (next as (previous: MessageNotificationSettings) => MessageNotificationSettings)(previous) : next;
        writeMessageNotificationSettingsForSession(session?.email, resolved);
        return normalizeMessageNotificationSettings(resolved);
      });
    },
    [session?.email]
  );

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    checkInsRef.current = checkIns;
  }, [checkIns]);

  useEffect(() => {
    scheduledTextCampaignsRef.current = scheduledTextCampaigns;
  }, [scheduledTextCampaigns]);

  useEffect(() => {
    messageLogsRef.current = messageLogs;
  }, [messageLogs]);

  useEffect(() => {
    textAutomationRunsRef.current = textAutomationRuns;
  }, [textAutomationRuns]);

  useEffect(() => {
    directMessagesRef.current = directMessages;
  }, [directMessages]);

  useEffect(() => {
    leadReviewsRef.current = leadReviews;
  }, [leadReviews]);

  useEffect(() => {
    managedAccountsRef.current = managedAccounts;
  }, [managedAccounts]);

  useEffect(() => {
    childAccountsRef.current = childAccounts;
  }, [childAccounts]);

  useEffect(() => {
    merchandiseItemsRef.current = merchandiseItems;
  }, [merchandiseItems]);

  const unreadDirectMessages = useMemo(
    () => getUnreadDirectMessageNotifications(directMessages, messageNotificationSettings, students),
    [directMessages, messageNotificationSettings, students]
  );
  const latestUnreadDirectMessage = unreadDirectMessages[0];
  const unreadDirectMessageCount = unreadDirectMessages.length;

  const updateMessageNotificationSettings = useCallback(
    (settings: Partial<MessageNotificationSettings>) => {
      setMessageNotificationSettings((current) => ({
        ...current,
        ...settings,
        updatedAt: new Date().toISOString()
      }));
    },
    [setMessageNotificationSettings]
  );

  const markMessageNotificationsSeen = useCallback(() => {
    const latestMessage = getUnreadDirectMessageNotifications(directMessagesRef.current, messageNotificationSettings, studentsRef.current)[0];
    const lastSeenDirectMessageAt = latestMessage?.createdAt ?? new Date().toISOString();
    setMessageNotificationSettings((current) => ({
      ...current,
      lastSeenDirectMessageAt,
      updatedAt: new Date().toISOString()
    }));
  }, [messageNotificationSettings, setMessageNotificationSettings]);

  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    const id = createPrototypeId("toast");
    setToasts((current) => [...current, { id, message, actionLabel, onAction }]);
    const timer = window.setTimeout(() => {
      toastTimersRef.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
    toastTimersRef.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimersRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(
    () => () => {
      toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current.clear();
    },
    []
  );

  const appendUniqueMessageLogs = useCallback(
    (logs: readonly MessageLog[]) => {
      const { inserted, next } = prependUniqueMessageLogs(logs, messageLogsRef.current);
      if (inserted.length) {
        messageLogsRef.current = next;
        setMessageLogs(next);
      }
      return inserted;
    },
    [setMessageLogs]
  );

  const findExistingMessageLog = useCallback(
    (log: MessageLog) => messageLogsRef.current.find((message) => messageLogOutreachKey(message) === messageLogOutreachKey(log)),
    []
  );

  const totals = useMemo(() => calculateTotals(cart, coupon), [cart, coupon]);
  const currentManagedAccount = useMemo(() => {
    if (!session) return undefined;
    const normalizedEmail = session.email.toLowerCase();
    return managedAccounts.find((account) => account.username.toLowerCase() === normalizedEmail && account.status !== "inactive" && hasValidManagedStudentLink(account, students));
  }, [managedAccounts, session, students]);
  const currentRegisteredAccount = useMemo(() => {
    if (!session) return undefined;
    const normalizedEmail = session.email.toLowerCase();
    return accounts.find((account) => account.email.trim().toLowerCase() === normalizedEmail && Boolean(account.password?.trim()));
  }, [accounts, session]);
  const currentChildAccount = useMemo(() => {
    if (!session) return undefined;
    const normalizedEmail = session.email.toLowerCase();
    return childAccounts.find((child) => child.username.toLowerCase() === normalizedEmail);
  }, [childAccounts, session]);
  const accountRole = useMemo(() => {
    if (!session) return undefined;
    const normalizedEmail = session.email.toLowerCase();
    const registeredRole: AccountRole | undefined = currentRegisteredAccount ? normalizeRegisteredAccountRole(currentRegisteredAccount.role) : undefined;
    const childRole: AccountRole | undefined = currentChildAccount ? "student" : undefined;
    return inferBuiltInPrototypeAccountRole(session.email) ?? currentManagedAccount?.role ?? registeredRole ?? childRole ?? accountRoles.find((record) => record.email.toLowerCase() === normalizedEmail)?.role ?? inferPrototypeAccountRole(session.email);
  }, [accountRoles, currentChildAccount, currentManagedAccount, currentRegisteredAccount, session]);
  const managerAccountAccess = useMemo<ManagerAccountAccess>(() => {
    const isManagerOwner = session?.email.toLowerCase() === prototypeManagerLogin.email.toLowerCase();
    const normalizedEmail = session?.email.toLowerCase();
    const storedRole = normalizedEmail ? accountRoles.find((record) => record.email.toLowerCase() === normalizedEmail)?.role : undefined;
    const builtInRole = normalizedEmail ? inferBuiltInPrototypeAccountRole(normalizedEmail) : undefined;
    const allowedTools = isManagerOwner
      ? ownerManagerAccess
      : currentManagedAccount
        ? currentManagedAccount.role === "staff"
          ? staffManagerAccess
          : []
        : currentRegisteredAccount
          ? normalizeRegisteredAccountRole(currentRegisteredAccount.role) === "staff"
            ? staffManagerAccess
            : []
          : currentChildAccount
            ? []
            : !builtInRole && storedRole === "staff"
              ? staffManagerAccess
              : [];

    return {
      isManagerOwner,
      canCreateAccounts: isManagerOwner || allowedTools.includes("create"),
      canGrantCreateAccess: isManagerOwner,
      allowedTools
    };
  }, [accountRoles, currentChildAccount, currentManagedAccount, currentRegisteredAccount, session]);
  const guardianChildren = useMemo(
    () => (session ? childAccounts.filter((child) => child.parentEmail.toLowerCase() === session.email.toLowerCase()) : []),
    [childAccounts, session]
  );

  const saveRoleForEmail = useCallback(
    (email: string, role: AccountRole) => {
      setAccountRoles((current) => {
        const normalizedEmail = email.toLowerCase();
        const authoritativeRole = inferBuiltInPrototypeAccountRole(normalizedEmail) ?? role;
        const existing = current.some((record) => record.email.toLowerCase() === normalizedEmail);
        return existing
          ? current.map((record) => (record.email.toLowerCase() === normalizedEmail ? { ...record, role: authoritativeRole } : record))
          : [...current, { email, role: authoritativeRole }];
      });
    },
    [setAccountRoles]
  );

  const addProductToCart = useCallback(
    (productSlug: string, quantity: number) => {
      const product = getProduct(productSlug);
      if (!product || !Number.isFinite(quantity) || quantity <= 0) return;
      updateCartState((current) => {
        const existing = current.find((item) => item.productSlug === productSlug && !item.booking);
        if (existing) {
          return current.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item));
        }
        return [
          ...current,
          {
            id: `cart-${productSlug}-${Date.now()}`,
            productSlug,
            name: product.name,
            unitPrice: product.price,
            displayPrice: product.displayPrice,
            quantity
          }
        ];
      });
    },
    [updateCartState]
  );

  const saveBooking = useCallback(
    (booking: BookingDetails) => {
      if (!isValidBookingDetails(booking)) return;
      const normalizedBooking = normalizeBookingDetails(booking);
      updateBookingsState((current) => {
        if (current.some((item) => bookingDetailsKey(item) === bookingDetailsKey(normalizedBooking))) return current;
        return [...current, normalizedBooking];
      });
    },
    [updateBookingsState]
  );

  const addBookingToCart = useCallback(
    (booking: BookingDetails) => {
      const product = getProduct("starter-program");
      if (!product || !isValidBookingDetails(booking)) return;
      const normalizedBooking = normalizeBookingDetails(booking);
      const bookingKey = bookingDetailsKey(normalizedBooking);
      updateCartState((current) => {
        const isExistingStarterBooking = current.some((item) => item.productSlug === product.slug && item.booking && bookingDetailsKey(item.booking) === bookingKey);
        if (isExistingStarterBooking) return current;
        return [
          ...current,
          {
            id: `booking-${Date.now()}`,
            productSlug: product.slug,
            name: `${product.name} - ${normalizedBooking.date} ${normalizedBooking.time}`,
            unitPrice: product.price * normalizedBooking.persons,
            displayPrice: product.displayPrice,
            quantity: 1,
            booking: normalizedBooking
          }
        ];
      });
      saveBooking(normalizedBooking);
    },
    [saveBooking, updateCartState]
  );

  const updateCartQuantity = useCallback(
    (id: string, quantity: number) => {
      if (!Number.isFinite(quantity)) return;
      updateCartState((current) => current.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item)));
    },
    [updateCartState]
  );

  const removeCartItem = useCallback(
    (id: string) => {
      updateCartState((current) => current.filter((item) => item.id !== id));
    },
    [updateCartState]
  );

  const clearCart = useCallback(() => {
    updateCartState([]);
    setCoupon(undefined);
  }, [setCoupon, updateCartState]);

  const applyCartCoupon = useCallback(
    (code: string) => {
      const nextCoupon = applyCoupon(code, calculateTotals(cart).subtotal);
      setCoupon(nextCoupon);
      return nextCoupon;
    },
    [cart, setCoupon]
  );

  const clearCoupon = useCallback(() => setCoupon(undefined), [setCoupon]);

  const placeOrder = useCallback(
    (customer: CustomerInfo, notes: string) => {
      const currentCart = cartRef.current;
      if (!currentCart.length) return undefined;
      const order = createOrder({ existingOrdersCount: ordersRef.current.length, customer, items: currentCart, coupon, notes });
      updateOrdersState((current) => [...current, order]);
      updateCartState([]);
      setCoupon(undefined);
      return order;
    },
    [coupon, setCoupon, updateCartState, updateOrdersState]
  );

  const saveContact = useCallback(
    (contact: ContactSubmission) => {
      if (!isValidContactSubmission(contact)) return;
      if (contactsRef.current.some((item) => contactSubmissionKey(item) === contactSubmissionKey(contact))) return;
      const nextContacts = [...contactsRef.current, contact];
      contactsRef.current = nextContacts;
      setContacts(nextContacts);
    },
    [setContacts]
  );

  const login = useCallback(
    (email: string, remembered: boolean, role?: AccountRole) => {
      setSession({ email, remembered, createdAt: new Date().toISOString() });
      if (role) saveRoleForEmail(email, role);
    },
    [saveRoleForEmail, setSession]
  );

  const loginRegisteredAccount = useCallback(
    (credentials: { username: string; password: string }) => {
      const normalizedEmail = credentials.username.trim().toLowerCase();
      const password = credentials.password.trim();
      if (!normalizedEmail || !password || isBuiltInPrototypeIdentity(normalizedEmail)) return undefined;
      if (isRegisteredAccountLoginCollision(normalizedEmail, managedAccountsRef.current, childAccountsRef.current)) return undefined;
      const account = accountsRef.current.find((item) => item.email.trim().toLowerCase() === normalizedEmail && item.password === password);
      if (!account) return undefined;
      saveRoleForEmail(account.email, normalizeRegisteredAccountRole(account.role));
      setSession({ email: account.email, remembered: true, createdAt: new Date().toISOString() });
      return account;
    },
    [saveRoleForEmail, setSession]
  );

  const managedUsernameExists = useCallback(
    (username: string) => {
      const normalizedUsername = normalizeAccountUsername(username);
      if (!normalizedUsername) return false;
      return (
        isPrototypeLoginUsername(normalizedUsername) ||
        managedAccountsRef.current.some((account) => account.username.toLowerCase() === normalizedUsername.toLowerCase()) ||
        childAccountsRef.current.some((child) => child.username.toLowerCase() === normalizedUsername.toLowerCase())
      );
    },
    []
  );

  const loginManagedAccount = useCallback(
    (credentials: { username: string; password: string }) => {
      const normalizedUsername = normalizeAccountUsername(credentials.username);
      const password = credentials.password.trim();
      if (!normalizedUsername || !password) return undefined;
      const account = managedAccountsRef.current.find(
        (item) =>
          item.username.toLowerCase() === normalizedUsername.toLowerCase() &&
          item.password === password &&
          item.status !== "inactive" &&
          hasValidManagedStudentLink(item, studentsRef.current)
      );
      if (!account) return undefined;
      saveRoleForEmail(account.username, account.role);
      setSession({ email: account.username, remembered: true, createdAt: new Date().toISOString() });
      return account;
    },
    [saveRoleForEmail, setSession]
  );

  const logout = useCallback(() => {
    clearSupabaseAuthSession();
    setSession(undefined);
  }, [setSession]);

  const setAccountRole = useCallback(
    (role: AccountRole) => {
      if (!session) return;
      saveRoleForEmail(session.email, role);
    },
    [saveRoleForEmail, session]
  );

  const createManagedAccount = useCallback(
    (account: ManagedAccountInput) => {
      const displayName = account.displayName.trim();
      const username = normalizeAccountUsername(account.username);
      const password = account.password.trim();
      if (!displayName || !username || !password) return undefined;
      const role = account.role;
      const status = account.status ?? "active";
      const studentId = account.studentId?.trim() || undefined;
      if (!hasValidManagedStudentInputLink({ ...account, status, studentId }, students)) return undefined;
      const createdAccount: ManagedAccount = {
        id: createPrototypeId("managed-account"),
        displayName,
        username,
        password,
        role,
        status,
        email: account.email?.trim() || undefined,
        phone: account.phone?.trim() || undefined,
        title: account.title?.trim() || undefined,
        notes: account.notes?.trim() || undefined,
        access: role === "staff" ? staffManagerAccess : [],
        studentId: role === "student" ? studentId : undefined,
        createdBy: session?.email,
        createdAt: new Date().toISOString()
      };
      const existingAccount = managedAccountsRef.current.find((currentAccount) => managedAccountCreationKey(currentAccount) === managedAccountCreationKey(createdAccount));
      if (existingAccount) return existingAccount;
      if (managedUsernameExists(username)) return undefined;
      updateManagedAccountsState((current) => [createdAccount, ...current]);
      saveRoleForEmail(username, role);
      return createdAccount;
    },
    [managedUsernameExists, saveRoleForEmail, session?.email, students, updateManagedAccountsState]
  );

  const updateManagedAccountStatus = useCallback(
    (accountId: string, status: ManagedAccount["status"]) => {
      const existingAccount = managedAccounts.find((account) => account.id === accountId);
      if (!existingAccount) return undefined;
      if (status === "active" && !hasValidManagedStudentLink(existingAccount, students)) return undefined;
      const updatedAccount: ManagedAccount = { ...existingAccount, status };
      setManagedAccounts((current) => current.map((account) => (account.id === accountId ? updatedAccount : account)));
      return updatedAccount;
    },
    [managedAccounts, setManagedAccounts, students]
  );

  const addChildAccount = useCallback(
    (child: { name: string; age: string; beltSlug: string; username: string; password: string }) => {
      if (!session) return undefined;
      const cleanedName = child.name.trim();
      if (!cleanedName) return undefined;
      const username = normalizeChildUsername(child.username) || childUsernameFromName(cleanedName);
      const password = child.password.trim();
      if (!username || !password) return undefined;
      const createdChild: ChildAccount = {
        id: createPrototypeId("child"),
        parentEmail: session.email,
        name: cleanedName,
        username,
        password,
        age: child.age.trim(),
        beltSlug: child.beltSlug,
        createdAt: new Date().toISOString()
      };
      const existingChild = childAccountsRef.current.find((currentChild) => childAccountCreationKey(currentChild) === childAccountCreationKey(createdChild));
      if (existingChild) return existingChild;
      if (isChildUsernameUnavailable(username, childAccountsRef.current, managedAccountsRef.current)) return undefined;
      updateChildAccountsState((current) => [...current, createdChild]);
      saveRoleForEmail(username, "student");
      return createdChild;
    },
    [saveRoleForEmail, session, updateChildAccountsState]
  );

  const updateChildAccount = useCallback(
    (childId: string, child: { name: string; age: string; beltSlug: string; username: string; password: string }) => {
      if (!session) return undefined;
      const existingChild = childAccounts.find((item) => item.id === childId && item.parentEmail.toLowerCase() === session.email.toLowerCase());
      if (!existingChild) return undefined;
      const cleanedName = child.name.trim();
      if (!cleanedName) return undefined;
      const username = normalizeChildUsername(child.username) || existingChild.username;
      const password = child.password.trim() || existingChild.password || "";
      if (!username) return undefined;
      if (isChildUsernameUnavailable(username, childAccounts, managedAccounts, childId)) return undefined;
      const updatedChild: ChildAccount = {
        ...existingChild,
        name: cleanedName,
        username,
        password: password || undefined,
        age: child.age.trim(),
        beltSlug: child.beltSlug
      };
      setChildAccounts((current) => current.map((item) => (item.id === childId ? updatedChild : item)));
      saveRoleForEmail(username, "student");
      return updatedChild;
    },
    [childAccounts, managedAccounts, saveRoleForEmail, session, setChildAccounts]
  );

  const loginChildAccount = useCallback(
    (childId: string) => {
      const child = childAccountsRef.current.find((item) => item.id === childId);
      if (!child || !session || child.parentEmail.toLowerCase() !== session.email.toLowerCase()) return;
      saveRoleForEmail(child.username, "student");
      setSession({ email: child.username, remembered: true, createdAt: new Date().toISOString() });
    },
    [saveRoleForEmail, session, setSession]
  );

  const loginChildCredentials = useCallback(
    (credentials: { username: string; password: string }) => {
      const normalizedUsername = normalizeChildUsername(credentials.username);
      const password = credentials.password.trim();
      if (!normalizedUsername || !password) return undefined;
      const child = childAccountsRef.current.find((item) => item.username.toLowerCase() === normalizedUsername.toLowerCase() && item.password === password);
      if (!child) return undefined;
      saveRoleForEmail(child.username, "student");
      setSession({ email: child.username, remembered: true, createdAt: new Date().toISOString() });
      return child;
    },
    [saveRoleForEmail, setSession]
  );

  const childUsernameExists = useCallback(
    (username: string, options?: { excludeChildId?: string }) => isChildUsernameUnavailable(username, childAccountsRef.current, managedAccountsRef.current, options?.excludeChildId),
    []
  );

  const register = useCallback(
    (account: RegisteredAccountInput) => {
      const email = account.email.trim().toLowerCase();
      const password = account.password.trim();
      const role = normalizeRegisteredAccountRole(account.role);
      if (!email || !password || isBuiltInPrototypeIdentity(email)) return undefined;
      const createdAccount = { email, password, role, createdAt: new Date().toISOString() };
      const existingAccount = accountsRef.current.find((currentAccount) => registeredAccountCreationKey(currentAccount) === registeredAccountCreationKey(createdAccount));
      if (existingAccount) return existingAccount;
      if (accountsRef.current.some((currentAccount) => currentAccount.email.trim().toLowerCase() === email)) return undefined;
      if (isRegisteredAccountLoginCollision(email, managedAccountsRef.current, childAccountsRef.current)) return undefined;
      updateAccountsState((current) => [...current, createdAccount]);
      return createdAccount;
    },
    [updateAccountsState]
  );

  const addOperationsStudent = useCallback(
    (student: StudentInput) => {
      const normalizedStudent = normalizeStudentInput(student);
      if (!normalizedStudent) return undefined;
      const matchingStudent = studentsRef.current.find((item) => studentEnrollmentKey(item) === studentEnrollmentKey(normalizedStudent));
      if (matchingStudent) return matchingStudent;
      const createdStudent: StudentRecord = {
        ...normalizedStudent,
        id: createPrototypeId("student"),
        classesAttended: 0,
        missedClassCount: 0
      };
      const nextStudents = [createdStudent, ...studentsRef.current];
      studentsRef.current = nextStudents;
      setStudents(nextStudents);
      if (isCurrentStudentEnrollment(createdStudent)) {
        appendUniqueMessageLogs([
          makeMessageLog({
            kind: "welcome",
            recipientName: studentFullName(createdStudent),
            recipientPhone: createdStudent.phone,
            body: welcomeTextForStudent(createdStudent)
          })
        ]);
      }
      return createdStudent;
    },
    [appendUniqueMessageLogs, setStudents]
  );

  const updateOperationsStudent = useCallback(
    (studentId: string, student: StudentInput) => {
      const existing = studentsRef.current.find((item) => item.id === studentId);
      if (!existing) return undefined;
      const normalizedStudent = normalizeStudentInput(student, existing.enrollmentDate || existing.joinedAt);
      if (!normalizedStudent) return undefined;
      const updatedStudent: StudentRecord = {
        ...existing,
        ...normalizedStudent
      };
      const wasCurrentEnrollment = isCurrentStudentEnrollment(existing);
      const nextStudents = studentsRef.current.map((item) => (item.id === studentId ? updatedStudent : item));
      studentsRef.current = nextStudents;
      setStudents(nextStudents);
      setCheckIns((current) => current.map((checkIn) => retargetCheckInForStudent(checkIn, updatedStudent)));
      if (!isCurrentStudentEnrollment(updatedStudent)) {
        updateScheduledClassesState((current) => current.map((item) => (item.studentId === studentId ? { ...item, studentId: undefined } : item)));
        setMessageLogs((current) =>
          current.filter((message) => message.status !== "queued" || !isMessageLogLinkedToStudent(message, existing))
        );
        setManagedAccounts((current) =>
          current.map((account) => (account.role === "student" && account.studentId === studentId ? { ...account, ...managedStudentAccountDetails(updatedStudent), status: "inactive" } : account))
        );
        setDirectMessages((current) => current.filter((message) => !isDirectMessageLinkedToStudent(message, studentId)));
      } else {
        const shouldReactivateLinkedStudentLogin = !wasCurrentEnrollment;
        setManagedAccounts((current) =>
          current.map((account) =>
            account.role === "student" && account.studentId === studentId
              ? { ...account, ...managedStudentAccountDetails(updatedStudent), status: shouldReactivateLinkedStudentLogin ? "active" : account.status }
              : account
          )
        );
        setMessageLogs((current) => current.map((message) => retargetQueuedMessageForStudent(message, existing, updatedStudent)));
        setDirectMessages((current) => current.map((message) => retargetDirectMessageForStudent(message, updatedStudent)));
      }
      return updatedStudent;
    },
    [setCheckIns, setDirectMessages, setManagedAccounts, setMessageLogs, setStudents, updateScheduledClassesState]
  );

  const deleteOperationsStudent = useCallback(
    (studentId: string) => {
      const existing = studentsRef.current.find((item) => item.id === studentId);
      if (!existing) return undefined;
      const nextStudents = studentsRef.current.filter((item) => item.id !== studentId);
      studentsRef.current = nextStudents;
      setStudents(nextStudents);
      updateScheduledClassesState((current) => current.map((item) => (item.studentId === studentId ? { ...item, studentId: undefined } : item)));
      const nextCheckIns = checkInsRef.current.filter((item) => item.studentId !== studentId);
      checkInsRef.current = nextCheckIns;
      setCheckIns(nextCheckIns);
      updateManagedAccountsState((current) => current.map((account) => (account.studentId === studentId ? { ...account, status: "inactive", studentId: undefined } : account)));
      const nextDirectMessages = directMessagesRef.current.filter((message) => !isDirectMessageLinkedToStudent(message, studentId));
      directMessagesRef.current = nextDirectMessages;
      setDirectMessages(nextDirectMessages);
      const nextMessageLogs = messageLogsRef.current.filter((item) => !isMessageLogLinkedToStudent(item, existing));
      messageLogsRef.current = nextMessageLogs;
      setMessageLogs(nextMessageLogs);
      return existing;
    },
    [setCheckIns, setDirectMessages, setMessageLogs, setStudents, updateManagedAccountsState, updateScheduledClassesState]
  );

  const addScheduledClass = useCallback(
    (scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => {
      const title = scheduledClass.title.trim();
      const type = scheduledClass.type.trim();
      if (!title || !scheduledClass.date || !scheduledClass.time.trim() || !type) return undefined;
      const studentId = scheduledClass.studentId?.trim();
      if (studentId && !studentsRef.current.some((student) => student.id === studentId && isCurrentStudentEnrollment(student))) return undefined;
      const createdClass: ScheduledClass = {
        id: createPrototypeId("schedule"),
        title,
        date: scheduledClass.date,
        time: scheduledClass.time.trim(),
        type,
        recurring: scheduledClass.recurring || undefined,
        titleColor: scheduledClass.titleColor?.trim() || undefined,
        studentId: studentId || undefined,
        notes: scheduledClass.notes?.trim()
      };
      const existingClass = scheduledClassesRef.current.find((item) => scheduledClassCreationKey(item) === scheduledClassCreationKey(createdClass));
      if (existingClass) return existingClass;
      updateScheduledClassesState((current) => [createdClass, ...current]);
      return createdClass;
    },
    [updateScheduledClassesState]
  );

  const deleteScheduledClass = useCallback(
    (scheduledClassId: string) => {
      const existing = scheduledClassesRef.current.find((item) => item.id === scheduledClassId);
      if (!existing) return undefined;
      updateScheduledClassesState((current) => current.filter((item) => item.id !== scheduledClassId));
      return existing;
    },
    [updateScheduledClassesState]
  );

  const deletePastOneTimeScheduledClasses = useCallback(
    (todayKey: string) => {
      const staleItems = scheduledClassesRef.current.filter((item) => isStaleOneTimeScheduledClass(item, todayKey));
      if (!staleItems.length) return [];
      const staleIds = new Set(staleItems.map((item) => item.id));
      updateScheduledClassesState((current) => current.filter((item) => !staleIds.has(item.id)));
      return staleItems;
    },
    [updateScheduledClassesState]
  );

  const cleanStudioClass = useCallback((studioClass: StudioClassInput) => {
    const name = studioClass.name.trim();
    const daysOfWeek = [...new Set(studioClass.daysOfWeek)].sort((left, right) => left - right) as StudioClass["daysOfWeek"];
    const startTime = studioClass.startTime.trim();
    const endTime = studioClass.endTime.trim();
    if (!name || !daysOfWeek.length || !startTime || !endTime || startTime >= endTime) return undefined;
    return {
      name,
      daysOfWeek,
      startTime,
      endTime,
      recurring: studioClass.recurring ?? true,
      titleColor: studioClass.titleColor?.trim() || undefined,
      notes: studioClass.notes?.trim()
    };
  }, []);

  const addStudioClass = useCallback(
    (studioClass: StudioClassInput) => {
      const cleaned = cleanStudioClass(studioClass);
      if (!cleaned) return undefined;
      const createdClass: StudioClass = {
        id: createPrototypeId("class"),
        ...cleaned
      };
      const existingClass = studioClassesRef.current.find((item) => studioClassCreationKey(item) === studioClassCreationKey(createdClass));
      if (existingClass) return existingClass;
      updateStudioClassesState((current) => [createdClass, ...current]);
      return createdClass;
    },
    [cleanStudioClass, updateStudioClassesState]
  );

  const updateStudioClass = useCallback(
    (classId: string, studioClass: StudioClassInput) => {
      const existing = studioClassesRef.current.find((item) => item.id === classId);
      if (!existing) return undefined;
      const cleaned = cleanStudioClass(studioClass);
      if (!cleaned) return undefined;
      const updatedClass: StudioClass = {
        ...existing,
        ...cleaned
      };
      updateStudioClassesState((current) => current.map((item) => (item.id === classId ? updatedClass : item)));
      return updatedClass;
    },
    [cleanStudioClass, updateStudioClassesState]
  );

  const deleteStudioClass = useCallback(
    (classId: string) => {
      const existing = studioClassesRef.current.find((item) => item.id === classId);
      if (!existing) return undefined;
      updateStudioClassesState((current) => current.filter((item) => item.id !== classId));
      return existing;
    },
    [updateStudioClassesState]
  );

  const addStudioEvent = useCallback(
    (event: { title: string; date: string; time: string; details: string; audience: StudioEvent["audience"] }) => {
      const title = event.title.trim();
      if (!title || !event.date || !event.time.trim()) return undefined;
      const createdEvent: StudioEvent = {
        id: createPrototypeId("event"),
        title,
        date: event.date,
        time: event.time.trim(),
        details: event.details.trim(),
        audience: event.audience
      };
      const existingEvent = studioEventsRef.current.find((item) => studioEventCreationKey(item) === studioEventCreationKey(createdEvent));
      if (existingEvent) return existingEvent;
      updateStudioEventsState((current) => [createdEvent, ...current]);
      return createdEvent;
    },
    [updateStudioEventsState]
  );

  const addTrainingVideoFolder = useCallback(
    (folder: TrainingVideoFolderInput) => {
      const name = folder.name.trim();
      const subject = folder.subject.trim();
      if (!name || !subject) return undefined;
      const createdFolder: TrainingVideoFolder = {
        id: createPrototypeId("video-folder"),
        name,
        subject,
        description: folder.description?.trim() || undefined,
        createdAt: new Date().toISOString()
      };
      const existingFolder = trainingVideoFoldersRef.current.find((currentFolder) => trainingVideoFolderCreationKey(currentFolder) === trainingVideoFolderCreationKey(createdFolder));
      if (existingFolder) return existingFolder;
      updateTrainingVideoFoldersState((current) => [...current, createdFolder]);
      return createdFolder;
    },
    [updateTrainingVideoFoldersState]
  );

  const addTrainingVideo = useCallback(
    (video: TrainingVideoInput) => {
      const title = video.title.trim();
      const fileName = video.fileName.trim();
      const mimeType = video.mimeType.trim() || "video/mp4";
      const folderExists = trainingVideoFoldersRef.current.some((folder) => folder.id === video.folderId);
      if (!title || !folderExists || !fileName || !video.videoDataUrl.startsWith("data:video/") || !isSafeTrainingVideoFile(video)) return undefined;
      const createdVideo: TrainingVideo = {
        id: createPrototypeId("video"),
        folderId: video.folderId,
        title,
        description: video.description?.trim() || undefined,
        fileName,
        mimeType,
        size: Number.isFinite(video.size) && video.size >= 0 ? video.size : 0,
        videoDataUrl: video.videoDataUrl,
        createdAt: new Date().toISOString()
      };
      const existingVideo = trainingVideosRef.current.find((currentVideo) => trainingVideoCreationKey(currentVideo) === trainingVideoCreationKey(createdVideo));
      if (existingVideo) return existingVideo;
      updateTrainingVideosState((current) => [...current, createdVideo]);
      return createdVideo;
    },
    [updateTrainingVideosState]
  );

  const addStudyGuideFolder = useCallback(
    (folder: StudyGuideFolderInput) => {
      const name = folder.name.trim();
      const subject = folder.subject.trim();
      const parentId = folder.parentId?.trim() || undefined;
      const parentExists = !parentId || studyGuideFoldersRef.current.some((currentFolder) => currentFolder.id === parentId);
      if (!name || !subject || !parentExists) return undefined;
      const createdFolder: StudyGuideFolder = {
        id: createPrototypeId("study-folder"),
        name,
        subject,
        parentId,
        description: folder.description?.trim() || undefined,
        createdAt: new Date().toISOString()
      };
      const existingFolder = studyGuideFoldersRef.current.find((currentFolder) => studyGuideFolderCreationKey(currentFolder) === studyGuideFolderCreationKey(createdFolder));
      if (existingFolder) return existingFolder;
      updateStudyGuideFoldersState((current) => [...current, createdFolder]);
      return createdFolder;
    },
    [updateStudyGuideFoldersState]
  );

  const addStudyGuideMaterial = useCallback(
    (material: StudyGuideMaterialInput) => {
      const title = material.title.trim();
      const fileName = material.fileName.trim();
      const mimeType = material.mimeType.trim() || "application/octet-stream";
      const folderExists = studyGuideFoldersRef.current.some((folder) => folder.id === material.folderId);
      if (!title || !folderExists || !fileName || !material.fileDataUrl.startsWith("data:") || !isSafeStudyMaterialFile(material)) return undefined;
      const createdMaterial: StudyGuideMaterial = {
        id: createPrototypeId("study-material"),
        folderId: material.folderId,
        title,
        description: material.description?.trim() || undefined,
        fileName,
        mimeType,
        size: Number.isFinite(material.size) && material.size >= 0 ? material.size : 0,
        fileDataUrl: material.fileDataUrl,
        createdAt: new Date().toISOString()
      };
      const existingMaterial = studyGuideMaterialsRef.current.find((currentMaterial) => studyGuideMaterialCreationKey(currentMaterial) === studyGuideMaterialCreationKey(createdMaterial));
      if (existingMaterial) return existingMaterial;
      updateStudyGuideMaterialsState((current) => [...current, createdMaterial]);
      return createdMaterial;
    },
    [updateStudyGuideMaterialsState]
  );

  const addMerchandiseItem = useCallback(
    (item: MerchandiseInput) => {
      const name = item.name.trim();
      const category = item.category.trim();
      if (!name || !category || !Number.isFinite(item.price) || !Number.isFinite(item.stock) || item.price < 0 || item.stock < 0) return undefined;
      const thresholds = cleanMerchandiseThresholds(item);
      const createdItem: MerchandiseItem = {
        id: createPrototypeId("merch"),
        name,
        category,
        price: item.price,
        stock: Math.floor(item.stock),
        reorderPoint: thresholds.reorderPoint,
        targetStock: thresholds.targetStock,
        description: item.description?.trim() || `${category} available for pickup at Cho's Martial Arts.`,
        imageLabel: category.toLowerCase(),
        imageDataUrl: item.imageDataUrl
      };
      const existingItem = merchandiseItemsRef.current.find((currentItem) => merchandiseItemCatalogKey(currentItem) === merchandiseItemCatalogKey(createdItem));
      if (existingItem) return existingItem;
      updateMerchandiseItemsState((current) => [createdItem, ...current]);
      return createdItem;
    },
    [updateMerchandiseItemsState]
  );

  const updateMerchandiseItem = useCallback(
    (itemId: string, item: MerchandiseInput) => {
      const name = item.name.trim();
      const category = item.category.trim();
      if (!name || !category || !Number.isFinite(item.price) || !Number.isFinite(item.stock) || item.price < 0 || item.stock < 0) return undefined;
      const thresholds = cleanMerchandiseThresholds(item);
      const existingItem = merchandiseItemsRef.current.find((currentItem) => currentItem.id === itemId);
      if (!existingItem) return undefined;
      const updatedItem: MerchandiseItem = {
        ...existingItem,
        name,
        category,
        price: item.price,
        stock: Math.floor(item.stock),
        reorderPoint: thresholds.reorderPoint,
        targetStock: thresholds.targetStock,
        description: item.description?.trim() || `${category} available for pickup at Cho's Martial Arts.`,
        imageLabel: category.toLowerCase(),
        imageDataUrl: item.imageDataUrl
      };
      updateMerchandiseItemsState((current) =>
        current.map((currentItem) => {
          if (currentItem.id !== itemId) return currentItem;
          return updatedItem;
        })
      );
      return updatedItem;
    },
    [updateMerchandiseItemsState]
  );

  const restockLowInventory = useCallback(() => {
    const targets = merchandiseItemsRef.current.filter(isLowStockMerchandiseItem);
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((item) => item.id));
    const restockedAt = todayStamp();
    const nextMerchandiseItems = merchandiseItemsRef.current.map((item) =>
      targetIds.has(item.id)
        ? {
            ...item,
            stock: getMerchandiseTargetStock(item),
            lastRestockedAt: restockedAt
          }
        : item
    );
    updateMerchandiseItemsState(nextMerchandiseItems);
    return targets.length;
  }, [updateMerchandiseItemsState]);

  const reviewLeadFollowUps = useCallback(() => {
    const candidates = getLeadCandidates({ bookings: bookingsRef.current, contacts: contactsRef.current, leadReviews: leadReviewsRef.current, students: studentsRef.current });
    if (!candidates.length) return 0;
    const reviewedAt = new Date().toISOString();
    const seenLeadIds = new Set(leadReviewsRef.current.map((review) => review.leadId.trim()).filter(Boolean));
    const nextReviews = candidates.flatMap((candidate) => {
      if (seenLeadIds.has(candidate.id)) return [];
      seenLeadIds.add(candidate.id);
      return [{
        id: createPrototypeId("lead-review"),
        leadId: candidate.id,
        kind: candidate.kind,
        label: candidate.name,
        reviewedAt
      }];
    });
    if (!nextReviews.length) return 0;
    const nextLeadReviews = [...leadReviewsRef.current, ...nextReviews];
    leadReviewsRef.current = nextLeadReviews;
    setLeadReviews(nextLeadReviews);
    return nextReviews.length;
  }, [setLeadReviews]);

  const deleteMerchandiseItem = useCallback(
    (itemId: string) => {
      const existingItem = merchandiseItemsRef.current.find((item) => item.id === itemId);
      if (!existingItem) return undefined;
      updateMerchandiseItemsState((current) => current.filter((item) => item.id !== itemId));
      return existingItem;
    },
    [updateMerchandiseItemsState]
  );

  const restoreOperationsBackup = useCallback(
    (rawBackup: string) => {
      const snapshot = parseOperationsBackupSnapshot(rawBackup);
      const restoredAccountRoles = snapshot.data.accountRoles as AccountRoleRecord[];
      const restoredAccounts = restoreRegisteredAccountPasswords(snapshot.data.accounts, accounts);
      const restoredManagedAccounts = restoreManagedAccountPasswords(snapshot.data.managedAccounts, managedAccounts);
      const restoredChildAccounts = restoreChildAccountPasswords(snapshot.data.childAccounts, childAccounts);
      assertRestoredLoginPasswordsAvailable(restoredAccounts, restoredManagedAccounts, restoredChildAccounts, snapshot.data.childAccounts, restoredAccountRoles);
      const restoredStudents = snapshot.data.students as StudentRecord[];
      const restoredScheduledTextCampaigns = snapshot.data.scheduledTextCampaigns as ScheduledTextCampaign[];
      const restoredMessageLogs = snapshot.data.messageLogs as MessageLog[];
      const restoredTextAutomationRuns = snapshot.data.automationRuns as TextAutomationRun[];
      const restoredDirectMessages = snapshot.data.directMessages as DirectMessage[];
      const restoredCheckIns = snapshot.data.checkIns as StudentCheckIn[];
      const restoredContacts = snapshot.data.contacts as ContactSubmission[];
      const restoredLeadReviews = snapshot.data.leadReviews as LeadReview[];
      const restoredMessagingSetup = snapshot.data.messagingSetup[0];
      updateAccountsState(restoredAccounts);
      setAccountRoles(restoredAccountRoles);
      updateManagedAccountsState(restoredManagedAccounts);
      updateChildAccountsState(restoredChildAccounts);
      studentsRef.current = restoredStudents;
      setStudents(restoredStudents);
      updateStudioClassesState(snapshot.data.studioClasses as StudioClass[]);
      updateScheduledClassesState(snapshot.data.scheduledClasses as ScheduledClass[]);
      setMessageCampaigns(snapshot.data.messageCampaigns as MessageCampaign[]);
      scheduledTextCampaignsRef.current = restoredScheduledTextCampaigns;
      setScheduledTextCampaigns(restoredScheduledTextCampaigns);
      messageLogsRef.current = restoredMessageLogs;
      setMessageLogs(restoredMessageLogs);
      textAutomationRunsRef.current = restoredTextAutomationRuns;
      setTextAutomationRuns(restoredTextAutomationRuns);
      directMessagesRef.current = restoredDirectMessages;
      setDirectMessages(restoredDirectMessages);
      updateStudioEventsState(snapshot.data.studioEvents as StudioEvent[]);
      updateMerchandiseItemsState(snapshot.data.merchandiseItems as MerchandiseItem[]);
      checkInsRef.current = restoredCheckIns;
      setCheckIns(restoredCheckIns);
      updateTrainingVideoFoldersState(snapshot.data.trainingVideoFolders as TrainingVideoFolder[]);
      updateTrainingVideosState(snapshot.data.trainingVideos as TrainingVideo[]);
      updateStudyGuideFoldersState(snapshot.data.studyGuideFolders as StudyGuideFolder[]);
      updateStudyGuideMaterialsState(snapshot.data.studyGuideMaterials as StudyGuideMaterial[]);
      updateOrdersState(snapshot.data.orders as Order[]);
      updateBookingsState(snapshot.data.bookings as BookingDetails[]);
      contactsRef.current = restoredContacts;
      setContacts(restoredContacts);
      leadReviewsRef.current = restoredLeadReviews;
      setLeadReviews(restoredLeadReviews);
      restoreProductionMessagingSetupStorage(restoredMessagingSetup);
      if (restoredMessagingSetup?.webPushPublicKey?.trim()) {
        setMessageNotificationSettings((current) => withRestoredMessagingPublicKey(current, restoredMessagingSetup));
      }
      if (!isSessionAvailableAfterRestore(session, restoredAccounts, restoredManagedAccounts, restoredChildAccounts, restoredStudents)) {
        setSession(undefined);
      }
      return {
        restoredRecords: snapshot.summary.totalRecords,
        restoredSections: snapshot.sections.filter((section) => section.count > 0).length
      };
    },
    [
      childAccounts,
      accounts,
      managedAccounts,
      session,
      setAccountRoles,
      setCheckIns,
      setContacts,
      setDirectMessages,
      setLeadReviews,
      setMessageNotificationSettings,
      setTextAutomationRuns,
      setMessageCampaigns,
      setMessageLogs,
      setScheduledTextCampaigns,
      setSession,
      setStudents,
      updateAccountsState,
      updateBookingsState,
      updateChildAccountsState,
      updateManagedAccountsState,
      updateMerchandiseItemsState,
      updateStudyGuideFoldersState,
      updateStudyGuideMaterialsState,
      updateStudioClassesState,
      updateScheduledClassesState,
      updateStudioEventsState,
      updateTrainingVideoFoldersState,
      updateTrainingVideosState,
      updateOrdersState
    ]
  );

  const recordSmsOptOut = useCallback(
    (phone: string, optedOut: boolean) => {
      const phoneKey = normalizeMessagePhone(phone);
      if (!phoneKey) return 0;
      const updatedAt = new Date().toISOString();
      let updatedContacts = 0;
      const nextStudents = studentsRef.current.map((student) => {
        let nextStudent = student;
        if (normalizeMessagePhone(student.phone) === phoneKey) {
          updatedContacts += 1;
          const { studentSmsOptOutAt: _studentSmsOptOutAt, ...restStudent } = nextStudent;
          nextStudent = optedOut
            ? { ...nextStudent, studentSmsOptOutAt: updatedAt, studentSmsConsentUpdatedAt: updatedAt, smsConsentUpdatedAt: updatedAt }
            : { ...restStudent, studentSmsConsentUpdatedAt: updatedAt, smsConsentUpdatedAt: updatedAt };
        }
        if (normalizeMessagePhone(student.guardianPhone ?? "") === phoneKey) {
          updatedContacts += 1;
          const { guardianSmsOptOutAt: _guardianSmsOptOutAt, ...restStudent } = nextStudent;
          nextStudent = optedOut
            ? { ...nextStudent, guardianSmsOptOutAt: updatedAt, guardianSmsConsentUpdatedAt: updatedAt, smsConsentUpdatedAt: updatedAt }
            : { ...restStudent, guardianSmsConsentUpdatedAt: updatedAt, smsConsentUpdatedAt: updatedAt };
        }
        return nextStudent;
      });
      const nextManagedAccounts = managedAccountsRef.current.map((account) => {
        if (normalizeMessagePhone(account.phone ?? "") !== phoneKey) return account;
        updatedContacts += 1;
        const { smsOptOutAt: _smsOptOutAt, ...restAccount } = account;
        return optedOut
          ? { ...account, smsOptOutAt: updatedAt, smsConsentUpdatedAt: updatedAt }
          : { ...restAccount, smsConsentUpdatedAt: updatedAt };
      });
      if (updatedContacts) {
        studentsRef.current = nextStudents;
        setStudents(nextStudents);
        updateManagedAccountsState(nextManagedAccounts);
      }
      return updatedContacts;
    },
    [setStudents, updateManagedAccountsState]
  );

  const recordStudentCheckIn = useCallback(
    (studentId: string) => {
      const student = studentsRef.current.find((item) => item.id === studentId);
      if (!student) return undefined;
      if (!isCurrentOperationsStudent(student)) return undefined;
      const checkInDate = todayStamp();
      const alreadyCheckedIn = checkInsRef.current.some((checkIn) => checkIn.studentId === studentId && checkIn.date === checkInDate);
      if (alreadyCheckedIn) return undefined;
      const createdCheckIn: StudentCheckIn = {
        id: createPrototypeId("checkin"),
        studentId: student.id,
        studentName: studentFullName(student),
        date: checkInDate,
        beltRank: student.beltRank
      };
      const updatedStudent: StudentRecord = {
        ...student,
        classesAttended: student.classesAttended + 1,
        missedClassCount: 0,
        lastCheckIn: checkInDate
      };
      const reachedBeltReview = !isBeltTestInviteDue(student, checkInDate) && isBeltTestInviteDue(updatedStudent, checkInDate);
      const reachedMilestone = !isMilestoneEncouragementDue(student, checkInDate) && isMilestoneEncouragementDue(updatedStudent, checkInDate);
      const canTextUpdatedStudent = hasStudentSmsSendConsent(updatedStudent);
      const queuedMessage = canTextUpdatedStudent && reachedBeltReview
        ? makeMessageLog({
            kind: "follow-up",
            recipientName: studentFullName(updatedStudent),
            recipientPhone: updatedStudent.phone,
            body: beltTestInviteTextForStudent(updatedStudent)
          })
        : canTextUpdatedStudent && reachedMilestone
          ? makeMessageLog({
              kind: "follow-up",
              recipientName: studentFullName(updatedStudent),
              recipientPhone: updatedStudent.phone,
              body: milestoneEncouragementTextForStudent(updatedStudent)
            })
          : undefined;
      const insertedMessages = queuedMessage ? appendUniqueMessageLogs([queuedMessage]) : [];
      const nextStudents = studentsRef.current.map((item) =>
          item.id === studentId
            ? {
                ...item,
                classesAttended: item.classesAttended + 1,
                missedClassCount: 0,
                lastCheckIn: checkInDate,
                lastContactedAt: insertedMessages.length ? checkInDate : item.lastContactedAt
              }
            : item
      );
      studentsRef.current = nextStudents;
      setStudents(nextStudents);
      checkInsRef.current = [createdCheckIn, ...checkInsRef.current];
      setCheckIns((current) =>
        current.some((checkIn) => checkIn.studentId === studentId && checkIn.date === checkInDate)
          ? current
          : [createdCheckIn, ...current]
      );
      return insertedMessages[0] ? { ...createdCheckIn, queuedMessage: insertedMessages[0] } : createdCheckIn;
    },
    [appendUniqueMessageLogs, setCheckIns, setStudents]
  );

  const sendMissedClassFollowUps = useCallback(() => {
    const today = todayStamp();
    const targets = studentsRef.current.filter((student) => isMissedClassFollowUpDue(student, today) && hasStudentSmsSendConsent(student));
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((student) => student.id));
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: missedClassTextForStudent(student)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendAttendanceGapCheckIns = useCallback(() => {
    const today = todayStamp();
    const targets = studentsRef.current.filter((student) => isAttendanceGapFollowUpDue(student, today) && hasStudentSmsSendConsent(student));
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((student) => student.id));
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: attendanceGapCheckInTextForStudent(student)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendTrialConversionFollowUps = useCallback(() => {
    const today = todayStamp();
    const targets = studentsRef.current.filter((student) => isTrialConversionDue(student, today) && hasStudentSmsSendConsent(student));
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((student) => student.id));
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: trialConversionTextForStudent(student)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendNewStudentCheckIns = useCallback(() => {
    const today = todayStamp();
    const targets = studentsRef.current.filter((student) => isNewStudentCheckInDue(student, today) && hasStudentSmsSendConsent(student));
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((student) => student.id));
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: newStudentCheckInTextForStudent(student)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendPausedStudentReactivationFollowUps = useCallback(() => {
    const today = todayStamp();
    const targets = studentsRef.current.filter((student) => isPausedStudentReviewDue(student, today) && hasStudentSmsSendConsent(student));
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((student) => student.id));
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: pausedStudentTextForStudent(student)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendCelebrationOutreach = useCallback(() => {
    const today = todayStamp();
    const targetEvents = studentsRef.current.flatMap((student) => (
      hasStudentSmsSendConsent(student) ? getStudentCelebrationEvents(student, today).map((event) => ({ student, event })) : []
    ));
    if (!targetEvents.length) return 0;
    const targetIds = new Set(targetEvents.map(({ student }) => student.id));
    const logs = targetEvents.map(({ student, event }) =>
      makeMessageLog({
        kind: "celebration",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: celebrationTextForStudent(student, event)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendProfileUpdateRequests = useCallback(() => {
    const today = todayStamp();
    const targets = studentsRef.current.filter((student) => isProfileUpdateRequestDue(student, today) && hasStudentSmsSendConsent(student));
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((student) => student.id));
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "profile-update",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: profileUpdateTextForStudent(student)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendClassReminders = useCallback(() => {
    const today = todayStamp();
    const currentStudents = studentsRef.current;
    const targets = getClassReminderCandidates(currentStudents, scheduledClassesRef.current, today);
    if (!targets.length) return 0;
    const studentsById = new Map(currentStudents.map((student) => [student.id, student]));
    const sendableTargets = targets.filter((target) => {
      const student = studentsById.get(target.studentId);
      return Boolean(student && hasStudentSmsSendConsent(student));
    });
    const targetStudentIds = new Set(sendableTargets.map((target) => target.studentId));
    const logs = sendableTargets.flatMap((target) => {
      const student = studentsById.get(target.studentId);
      if (!student) return [];
      return makeMessageLog({
        kind: "reminder",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: classReminderTextForStudent(student, target)
      });
    });
    if (!logs.length) return 0;
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetStudentIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendMilestoneEncouragements = useCallback(() => {
    const today = todayStamp();
    const targets = studentsRef.current.filter((student) => isMilestoneEncouragementDue(student, today) && hasStudentSmsSendConsent(student));
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((student) => student.id));
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: milestoneEncouragementTextForStudent(student)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendBeltTestInvites = useCallback(() => {
    const today = todayStamp();
    const targets = studentsRef.current.filter((student) => isBeltTestInviteDue(student, today) && hasStudentSmsSendConsent(student));
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((student) => student.id));
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: beltTestInviteTextForStudent(student)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const nextStudents = studentsRef.current.map((student) => (targetIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
    studentsRef.current = nextStudents;
    setStudents(nextStudents);
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const sendEventReminderTexts = useCallback(() => {
    const today = todayStamp();
    const targets = getEventReminderCandidates(studioEventsRef.current, studentsRef.current, today);
    if (!targets.length) return 0;
    const logs = targets.map(({ event, student, recipient }) =>
      makeMessageLog({
        kind: "reminder",
        recipientName: recipient.name,
        recipientPhone: recipient.phone,
        recipientRole: recipient.role,
        recipientId: recipient.id,
        body: eventReminderTextForRecipient(event, student, recipient)
      })
    );
    const insertedLogs = appendUniqueMessageLogs(logs);
    const contactedStudentIds = studentIdsForMessageLogs(insertedLogs);
    if (contactedStudentIds.size) {
      const nextStudents = studentsRef.current.map((student) => (contactedStudentIds.has(student.id) ? { ...student, lastContactedAt: today } : student));
      studentsRef.current = nextStudents;
      setStudents(nextStudents);
    }
    return insertedLogs.length;
  }, [appendUniqueMessageLogs, setStudents]);

  const scheduleTextCampaign = useCallback(
    (campaign: { body: string; audience: MessageCampaign["audience"]; scheduledFor: string; scheduledTime?: string; title?: string }) => {
      const body = campaign.body.trim();
      const scheduledFor = campaign.scheduledFor.trim();
      const scheduledTime = campaign.scheduledTime?.trim();
      if (!body || !isDateKey(scheduledFor) || (scheduledTime && !isTimeKey(scheduledTime))) return undefined;
      const createdCampaign: ScheduledTextCampaign = {
        id: createPrototypeId("scheduled-campaign"),
        title: campaign.title?.trim() || "Scheduled promotion",
        body,
        audience: campaign.audience,
        scheduledFor,
        ...(scheduledTime ? { scheduledTime } : {}),
        status: "scheduled",
        createdAt: new Date().toISOString()
      };
      const existingCampaign = scheduledTextCampaignsRef.current.find(
        (item) => item.status === "scheduled" && scheduledTextCampaignKey(item) === scheduledTextCampaignKey(createdCampaign)
      );
      if (existingCampaign) return existingCampaign;
      const nextScheduledCampaigns = [createdCampaign, ...scheduledTextCampaignsRef.current];
      scheduledTextCampaignsRef.current = nextScheduledCampaigns;
      setScheduledTextCampaigns(nextScheduledCampaigns);
      return createdCampaign;
    },
    [setScheduledTextCampaigns]
  );

  const cancelScheduledTextCampaign = useCallback(
    (campaignId: string) => {
      const existingCampaign = scheduledTextCampaignsRef.current.find((campaign) => campaign.id === campaignId && campaign.status === "scheduled");
      if (!existingCampaign) return undefined;
      const canceledCampaign: ScheduledTextCampaign = {
        ...existingCampaign,
        status: "canceled"
      };
      const nextScheduledCampaigns = scheduledTextCampaignsRef.current.map((campaign) => (campaign.id === campaignId ? canceledCampaign : campaign));
      scheduledTextCampaignsRef.current = nextScheduledCampaigns;
      setScheduledTextCampaigns(nextScheduledCampaigns);
      return canceledCampaign;
    },
    [setScheduledTextCampaigns]
  );

  const runScheduledTextCampaigns = useCallback(() => {
    const now = new Date();
    const dueCampaigns = scheduledTextCampaignsRef.current.filter((campaign) => campaign.status === "scheduled" && scheduledTextCampaignDue(campaign, now));
    if (!dueCampaigns.length) return 0;
    const queuedAt = new Date().toISOString();
    let totalQueued = 0;
    const createdCampaigns: MessageCampaign[] = [];
    const completedScheduledCampaignIds = new Map<string, string | undefined>();

    dueCampaigns.forEach((scheduledCampaign) => {
      const recipients = getTextBlastRecipients(scheduledCampaign.audience, studentsRef.current, managedAccountsRef.current);
      if (!recipients.length) return;
      const campaign: MessageCampaign = {
        id: createPrototypeId("campaign"),
        title: scheduledCampaign.title.trim() || "Scheduled promotion",
        body: scheduledCampaign.body,
        audience: scheduledCampaign.audience,
        createdAt: queuedAt
      };
      const logs = recipients.map((recipient) =>
        makeMessageLog({
          kind: "marketing",
          recipientName: recipient.name,
          recipientPhone: recipient.phone,
          recipientRole: recipient.role,
          recipientId: recipient.id,
          body: scheduledCampaign.body,
          campaignId: campaign.id
        })
      );
      const insertedLogs = appendUniqueMessageLogs(logs);
      if (insertedLogs.length) {
        totalQueued += insertedLogs.length;
        createdCampaigns.push(campaign);
      }
      completedScheduledCampaignIds.set(scheduledCampaign.id, insertedLogs.length ? campaign.id : undefined);
    });

    if (completedScheduledCampaignIds.size) {
      const nextScheduledCampaigns = scheduledTextCampaignsRef.current.map((campaign) => {
        if (!completedScheduledCampaignIds.has(campaign.id)) return campaign;
        const campaignId = completedScheduledCampaignIds.get(campaign.id);
        return {
          ...campaign,
          status: "queued" as const,
          queuedAt,
          ...(campaignId ? { campaignId } : {})
        };
      });
      scheduledTextCampaignsRef.current = nextScheduledCampaigns;
      setScheduledTextCampaigns(nextScheduledCampaigns);
    }

    if (createdCampaigns.length) {
      setMessageCampaigns((current) => [...createdCampaigns, ...current]);
    }
    return totalQueued;
  }, [appendUniqueMessageLogs, setMessageCampaigns, setScheduledTextCampaigns]);

  const runTextAutomations = useCallback(() => {
    const result: TextAutomationRunResult = {
      missedClassFollowUps: sendMissedClassFollowUps(),
      attendanceGapCheckIns: sendAttendanceGapCheckIns(),
      trialConversionFollowUps: sendTrialConversionFollowUps(),
      newStudentCheckIns: sendNewStudentCheckIns(),
      pausedStudentReactivationFollowUps: sendPausedStudentReactivationFollowUps(),
      celebrationOutreach: sendCelebrationOutreach(),
      profileUpdateRequests: sendProfileUpdateRequests(),
      classReminders: sendClassReminders(),
      milestoneEncouragements: sendMilestoneEncouragements(),
      beltTestInvites: sendBeltTestInvites(),
      eventReminders: sendEventReminderTexts(),
      scheduledPromotions: runScheduledTextCampaigns(),
      totalQueued: 0
    };
    result.totalQueued =
      result.missedClassFollowUps +
      result.attendanceGapCheckIns +
      result.trialConversionFollowUps +
      result.newStudentCheckIns +
      result.pausedStudentReactivationFollowUps +
      result.celebrationOutreach +
      result.profileUpdateRequests +
      result.classReminders +
      result.milestoneEncouragements +
      result.beltTestInvites +
      result.eventReminders +
      result.scheduledPromotions;
    const automationRun = buildTextAutomationRunLog(result);
    const nextAutomationRuns = [automationRun, ...textAutomationRunsRef.current].slice(0, 20);
    textAutomationRunsRef.current = nextAutomationRuns;
    setTextAutomationRuns(nextAutomationRuns);
    return result;
  }, [
    sendAttendanceGapCheckIns,
    sendBeltTestInvites,
    sendCelebrationOutreach,
    sendClassReminders,
    sendEventReminderTexts,
    sendMilestoneEncouragements,
    sendMissedClassFollowUps,
    sendNewStudentCheckIns,
    sendPausedStudentReactivationFollowUps,
    sendProfileUpdateRequests,
    runScheduledTextCampaigns,
    sendTrialConversionFollowUps,
    setTextAutomationRuns
  ]);

  const queueStudentMilestoneEncouragement = useCallback(
    (studentId: string) => {
      const student = studentsRef.current.find((item) => item.id === studentId);
      if (!student || !isCurrentStudentEnrollment(student) || !hasStudentSmsSendConsent(student)) return undefined;
      const today = todayStamp();
      const log = makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: milestoneEncouragementTextForStudent(student)
      });
      const [insertedLog] = appendUniqueMessageLogs([log]);
      const queuedLog = insertedLog ?? findExistingMessageLog(log);
      const nextStudents = studentsRef.current.map((item) => (item.id === student.id ? { ...item, lastContactedAt: today } : item));
      studentsRef.current = nextStudents;
      setStudents(nextStudents);
      return queuedLog;
    },
    [appendUniqueMessageLogs, findExistingMessageLog, setStudents]
  );

  const queueStudentProfileUpdateRequest = useCallback(
    (studentId: string) => {
      const student = studentsRef.current.find((item) => item.id === studentId);
      if (!student || !isCurrentStudentEnrollment(student) || !hasStudentSmsSendConsent(student)) return undefined;
      const today = todayStamp();
      const log = makeMessageLog({
        kind: "profile-update",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: profileUpdateTextForStudent(student)
      });
      const [insertedLog] = appendUniqueMessageLogs([log]);
      const queuedLog = insertedLog ?? findExistingMessageLog(log);
      const nextStudents = studentsRef.current.map((item) => (item.id === student.id ? { ...item, lastContactedAt: today } : item));
      studentsRef.current = nextStudents;
      setStudents(nextStudents);
      return queuedLog;
    },
    [appendUniqueMessageLogs, findExistingMessageLog, setStudents]
  );

  const sendMarketingBlast = useCallback(
    (body: string, audience: MessageCampaign["audience"] = "all-students") => {
      const cleanBody = body.trim();
      if (!cleanBody) return 0;
      const recipients = getTextBlastRecipients(audience, studentsRef.current, managedAccountsRef.current);
      const logs = recipients
        .map((recipient) =>
          makeMessageLog({
            kind: "marketing",
            recipientName: recipient.name,
            recipientPhone: recipient.phone,
            recipientRole: recipient.role,
            recipientId: recipient.id,
            body: cleanBody
          })
        );
      if (!logs.length) return 0;
      const campaign: MessageCampaign = {
        id: createPrototypeId("campaign"),
        title: audience === "all-students" ? "Marketing blast" : "Audience text blast",
        body: cleanBody,
        audience,
        createdAt: new Date().toISOString()
      };
      const logsWithCampaign = logs.map((log) => ({ ...log, campaignId: campaign.id }));
      const insertedLogs = appendUniqueMessageLogs(logsWithCampaign);
      if (!insertedLogs.length) return 0;
      setMessageCampaigns((current) => [campaign, ...current]);
      return insertedLogs.length;
    },
    [appendUniqueMessageLogs, setMessageCampaigns]
  );

  const getTextAudiencePreview = useCallback((audience: MessageCampaign["audience"]): TextAudiencePreview => {
    const recipients = getTextBlastRecipients(audience, studentsRef.current, managedAccountsRef.current);
    return {
      audience,
      total: recipients.length,
      students: recipients.filter((recipient) => recipient.role === "student").length,
      parents: recipients.filter((recipient) => recipient.role === "parent").length,
      staff: recipients.filter((recipient) => recipient.role === "staff").length
    };
  }, []);

  const buildTwilioRelayPayload = useCallback((): TwilioRelayPayload => {
    const currentStudents = studentsRef.current;
    const currentManagedAccounts = managedAccountsRef.current;
    const messages = messageLogsRef.current
      .filter((message) => message.status === "queued" && isQueuedMessageDeliverable(message, currentStudents, currentManagedAccounts))
      .map(buildTwilioRelayMessage);
    return {
      schemaVersion: "chos-twilio-relay.v1",
      provider: "twilio",
      deliveryMode: "server-relay",
      generatedAt: new Date().toISOString(),
      requestedBy: session
        ? {
            email: session.email,
            role: accountRole
          }
        : undefined,
      messages
    };
  }, [accountRole, session]);

  const applyTwilioResultsToMessageLogs = useCallback(
    (results: TwilioRelayResult[]) => {
      if (!results.length) return { applied: 0, sent: 0, failed: 0, ignored: 0 };
      const appliedAt = new Date().toISOString();
      const unappliedResults = [...results];
      let applied = 0;
      let sent = 0;
      let failed = 0;
      const nextMessageLogs = messageLogsRef.current.map((message) => {
        const resultIndex = unappliedResults.findIndex((result) => {
          if (result.id === message.id) return true;
          if (result.id && result.id === message.deliveryProviderMessageId) return true;
          return Boolean(result.deliveryProviderMessageId && result.deliveryProviderMessageId === message.deliveryProviderMessageId);
        });
        if (resultIndex < 0) return message;
        const [result] = unappliedResults.splice(resultIndex, 1);
        applied += 1;
        if (failedTwilioDeliveryStatuses.has(result.deliveryStatus)) {
          failed += 1;
        } else {
          sent += 1;
        }
        return applyTwilioRelayResultToMessage(message, result, appliedAt);
      });
      if (applied) {
        messageLogsRef.current = nextMessageLogs;
        setMessageLogs(nextMessageLogs);
      }
      return { applied, sent, failed, ignored: unappliedResults.length };
    },
    [setMessageLogs]
  );

  const applyTwilioRelayResults = useCallback(
    (rawResults: string) => {
      const results = parseTwilioRelayResults(rawResults);
      if (!results) return undefined;
      return applyTwilioResultsToMessageLogs(results);
    },
    [applyTwilioResultsToMessageLogs]
  );

  const applyTwilioStatusCallbacks = useCallback(
    (rawCallbacks: string) => {
      const results = parseTwilioStatusCallbacks(rawCallbacks);
      if (!results) return undefined;
      return applyTwilioResultsToMessageLogs(results);
    },
    [applyTwilioResultsToMessageLogs]
  );

  const sendQueuedTexts = useCallback(() => {
    const currentMessageLogs = messageLogsRef.current;
    const currentStudents = studentsRef.current;
    const currentManagedAccounts = managedAccountsRef.current;
    const deliverableQueuedIds = new Set(
      currentMessageLogs.filter((message) => message.status === "queued" && isQueuedMessageDeliverable(message, currentStudents, currentManagedAccounts)).map((message) => message.id)
    );
    const staleQueuedIds = new Set(
      currentMessageLogs.filter((message) => message.status === "queued" && !isQueuedMessageDeliverable(message, currentStudents, currentManagedAccounts)).map((message) => message.id)
    );
    if (!deliverableQueuedIds.size && !staleQueuedIds.size) return 0;
    const sentAt = new Date().toISOString();
    const nextMessageLogs = currentMessageLogs.flatMap((message): MessageLog[] => {
      if (message.status !== "queued") return [message];
      if (deliverableQueuedIds.has(message.id)) return [{ ...message, status: "sent", sentAt, deliveryStatus: "sent" }];
      if (staleQueuedIds.has(message.id)) return [];
      return [message];
    });
    messageLogsRef.current = nextMessageLogs;
    setMessageLogs(nextMessageLogs);
    return deliverableQueuedIds.size;
  }, [setMessageLogs]);

  const sendQueuedText = useCallback(
    (messageId: string) => {
      const currentMessageLogs = messageLogsRef.current;
      const queuedMessage = currentMessageLogs.find((message) => message.id === messageId && message.status === "queued");
      if (!queuedMessage) return undefined;
      if (!isQueuedMessageDeliverable(queuedMessage, studentsRef.current, managedAccountsRef.current)) {
        const nextMessageLogs = currentMessageLogs.filter((message) => message.id !== messageId || message.status !== "queued");
        messageLogsRef.current = nextMessageLogs;
        setMessageLogs(nextMessageLogs);
        return undefined;
      }
      const sentAt = new Date().toISOString();
      const sentMessage: MessageLog = { ...queuedMessage, status: "sent", sentAt, deliveryStatus: "sent" };
      const nextMessageLogs = currentMessageLogs.map((message) => (message.id === messageId && message.status === "queued" ? sentMessage : message));
      messageLogsRef.current = nextMessageLogs;
      setMessageLogs(nextMessageLogs);
      return sentMessage;
    },
    [setMessageLogs]
  );

  const clearStaleQueuedTexts = useCallback(() => {
    const currentMessageLogs = messageLogsRef.current;
    const currentStudents = studentsRef.current;
    const currentManagedAccounts = managedAccountsRef.current;
    const staleQueuedIds = new Set(
      currentMessageLogs.filter((message) => message.status === "queued" && !isQueuedMessageDeliverable(message, currentStudents, currentManagedAccounts)).map((message) => message.id)
    );
    if (!staleQueuedIds.size) return 0;
    const nextMessageLogs = currentMessageLogs.filter((message) => message.status !== "queued" || !staleQueuedIds.has(message.id));
    messageLogsRef.current = nextMessageLogs;
    setMessageLogs(nextMessageLogs);
    return staleQueuedIds.size;
  }, [setMessageLogs]);

  const applyTwilioInboundWebhook = useCallback(
    (rawWebhook: string) => {
      const webhook = parseTwilioInboundWebhook(rawWebhook);
      if (!webhook) return undefined;
      const keyword = webhook.keyword;
      if (keyword === "opt-out" || keyword === "opt-in") {
        const updatedContacts = recordSmsOptOut(webhook.from, keyword === "opt-out");
        return {
          imported: 0,
          optedOut: keyword === "opt-out" ? updatedContacts : 0,
          optedIn: keyword === "opt-in" ? updatedContacts : 0,
          ignored: updatedContacts ? 0 : 1
        };
      }
      const sender = inboundSmsDirectSenderForPhone(webhook.from, studentsRef.current);
      if (!sender) return { imported: 0, optedOut: 0, optedIn: 0, ignored: 1 };
      const id = webhook.messageSid ? `twilio-${webhook.messageSid}` : createPrototypeId("twilio-direct");
      if (directMessagesRef.current.some((message) => message.id === id)) return { imported: 0, optedOut: 0, optedIn: 0, ignored: 1 };
      const recipientId = "direct-staff-seed";
      const createdMessage: DirectMessage = {
        id,
        threadId: [recipientId, sender.senderId].sort().join("__"),
        senderId: sender.senderId,
        senderName: sender.senderName,
        recipientId,
        recipientName: "Cho's Manager",
        body: webhook.body.trim(),
        createdAt: new Date().toISOString(),
        status: "sent"
      };
      const nextDirectMessages = [...directMessagesRef.current, createdMessage];
      directMessagesRef.current = nextDirectMessages;
      setDirectMessages(nextDirectMessages);
      return { imported: 1, optedOut: 0, optedIn: 0, ignored: 0 };
    },
    [recordSmsOptOut, setDirectMessages]
  );

  const sendDirectMessage = useCallback(
    (message: { senderId: string; senderName: string; recipientId: string; recipientName: string; body: string }) => {
      const body = message.body.trim();
      if (!message.senderId || !message.recipientId || message.senderId === message.recipientId || !body) return undefined;
      const currentStudents = studentsRef.current;
      if (!isDirectMessageParticipantAvailable(message.senderId, currentStudents) || !isDirectMessageParticipantAvailable(message.recipientId, currentStudents)) return undefined;
      const threadId = [message.senderId, message.recipientId].sort().join("__");
      const createdMessage: DirectMessage = {
        id: createPrototypeId("direct"),
        threadId,
        senderId: message.senderId,
        senderName: message.senderName.trim() || "Cho's User",
        recipientId: message.recipientId,
        recipientName: message.recipientName.trim() || "Cho's User",
        body,
        createdAt: new Date().toISOString(),
        status: "sent"
      };
      const existingMessage = directMessagesRef.current.find((item) => directMessageOutboxKey(item) === directMessageOutboxKey(createdMessage));
      if (existingMessage) return existingMessage;
      const nextDirectMessages = [...directMessagesRef.current, createdMessage];
      directMessagesRef.current = nextDirectMessages;
      setDirectMessages(nextDirectMessages);
      return createdMessage;
    },
    [setDirectMessages]
  );

  const value: AppState = {
    cart,
    coupon,
    totals,
    orders,
    bookings,
    contacts,
    leadReviews,
    session,
    accountRole,
    accounts,
    accountRoles,
    managedAccounts,
    currentManagedAccount,
    managerAccountAccess,
    childAccounts,
    guardianChildren,
    currentChildAccount,
    students,
    studioClasses,
    scheduledClasses,
    messageCampaigns,
    scheduledTextCampaigns,
    messageLogs,
    textAutomationRuns,
    messageNotificationSettings,
    unreadDirectMessageCount,
    latestUnreadDirectMessage,
    directMessages,
    studioEvents,
    merchandiseItems,
    checkIns,
    trainingVideoFolders,
    trainingVideos,
    studyGuideFolders,
    studyGuideMaterials,
    toasts,
    showToast,
    dismissToast,
    addProductToCart,
    addBookingToCart,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    applyCartCoupon,
    clearCoupon,
    placeOrder,
    saveBooking,
    saveContact,
    login,
    loginRegisteredAccount,
    loginManagedAccount,
    loginChildAccount,
    loginChildCredentials,
    managedUsernameExists,
    childUsernameExists,
    logout,
    register,
    setAccountRole,
    createManagedAccount,
    updateManagedAccountStatus,
    addChildAccount,
    updateChildAccount,
    addOperationsStudent,
    updateOperationsStudent,
    deleteOperationsStudent,
    addStudioClass,
    updateStudioClass,
    deleteStudioClass,
    addScheduledClass,
    deleteScheduledClass,
    deletePastOneTimeScheduledClasses,
    addStudioEvent,
    addTrainingVideoFolder,
    addTrainingVideo,
    addStudyGuideFolder,
    addStudyGuideMaterial,
    addMerchandiseItem,
    updateMerchandiseItem,
    deleteMerchandiseItem,
    restockLowInventory,
    reviewLeadFollowUps,
    restoreOperationsBackup,
    recordSmsOptOut,
    recordStudentCheckIn,
    sendMissedClassFollowUps,
    sendAttendanceGapCheckIns,
    sendTrialConversionFollowUps,
    sendNewStudentCheckIns,
    sendPausedStudentReactivationFollowUps,
    sendCelebrationOutreach,
    sendProfileUpdateRequests,
    sendClassReminders,
    sendMilestoneEncouragements,
    sendBeltTestInvites,
    sendEventReminderTexts,
    runTextAutomations,
    queueStudentMilestoneEncouragement,
    queueStudentProfileUpdateRequest,
    scheduleTextCampaign,
    cancelScheduledTextCampaign,
    getTextAudiencePreview,
    sendMarketingBlast,
    buildTwilioRelayPayload,
    applyTwilioRelayResults,
    applyTwilioStatusCallbacks,
    applyTwilioInboundWebhook,
    sendQueuedTexts,
    sendQueuedText,
    clearStaleQueuedTexts,
    updateMessageNotificationSettings,
    markMessageNotificationsSeen,
    sendDirectMessage
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState() {
  const value = useContext(Context);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}
