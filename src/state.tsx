import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { getProduct, studio } from "./data";
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
  ManagedAccount,
  ManagerAccessKey,
  MerchandiseItem,
  MessageCampaign,
  MessageLog,
  Order,
  StudioClass,
  ScheduledClass,
  StudyGuideFolder,
  StudyGuideMaterial,
  StudentCheckIn,
  StudentRecord,
  StudioEvent,
  TrainingVideo,
  TrainingVideoFolder
} from "./types";
import { applyCoupon, calculateTotals, createOrder, prototypeManagerLogin, prototypeParentLogin, prototypeStudentLogin } from "./utils";

const keys = {
  cart: "chos.cart.v1",
  orders: "chos.orders.v1",
  bookings: "chos.bookings.v1",
  contacts: "chos.contacts.v1",
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
  messageLogs: "chos.operations.messages.v1",
  directMessages: "chos.operations.directMessages.v1",
  studioEvents: "chos.operations.events.v1",
  merchandiseItems: "chos.operations.merchandise.v1",
  checkIns: "chos.operations.checkins.v1",
  videoFolders: "chos.operations.videoFolders.v1",
  videos: "chos.operations.videos.v1",
  studyGuideFolders: "chos.operations.studyGuideFolders.v1",
  studyGuideMaterials: "chos.operations.studyGuideMaterials.v1"
} as const;

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
];

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

const seedStudioEvents: StudioEvent[] = [
  { id: "event-testing-seed", title: "Color Belt Testing", date: "2026-05-30", time: "10:00 AM", details: "Testing date for students cleared by instructors.", audience: "students" },
  { id: "event-movie-night-seed", title: "Movie Night", date: "2026-06-07", time: "6:30 PM", details: "Family movie night at the studio.", audience: "families" }
];

const seedMerchandiseItems: MerchandiseItem[] = [
  { id: "merch-gloves-seed", name: "Youth Boxing Gloves", category: "Gloves", price: 39, stock: 6, description: "Youth 6oz gloves for bag work and sparring prep.", imageLabel: "gloves" },
  { id: "merch-uniform-seed", name: "White Basic Uniform", category: "Uniforms", price: 39, stock: 10, description: "Starter uniform with Cho's logo patches.", imageLabel: "uniform" }
];

interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AccountRecord {
  email: string;
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

const defaultStaffAccess: ManagerAccessKey[] = ["dashboard", "messages", "students", "classes", "events", "scheduling"];

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

interface AppState {
  cart: CartItem[];
  coupon?: Coupon;
  totals: ReturnType<typeof calculateTotals>;
  orders: Order[];
  bookings: BookingDetails[];
  contacts: ContactSubmission[];
  session?: AccountSession;
  accountRole?: AccountRole;
  accounts: AccountRecord[];
  managedAccounts: ManagedAccount[];
  currentManagedAccount?: ManagedAccount;
  managerAccountAccess: ManagerAccountAccess;
  guardianChildren: ChildAccount[];
  students: StudentRecord[];
  studioClasses: StudioClass[];
  scheduledClasses: ScheduledClass[];
  messageCampaigns: MessageCampaign[];
  messageLogs: MessageLog[];
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
  placeOrder: (customer: CustomerInfo, notes: string) => Order;
  saveBooking: (booking: BookingDetails) => void;
  saveContact: (contact: ContactSubmission) => void;
  login: (email: string, remembered: boolean, role?: AccountRole) => void;
  loginManagedAccount: (credentials: { username: string; password: string }) => ManagedAccount | undefined;
  loginChildAccount: (childId: string) => void;
  loginChildCredentials: (credentials: { username: string; password: string }) => ChildAccount | undefined;
  managedUsernameExists: (username: string) => boolean;
  childUsernameExists: (username: string) => boolean;
  logout: () => void;
  register: (email: string) => void;
  setAccountRole: (role: AccountRole) => void;
  createManagedAccount: (account: ManagedAccountInput) => ManagedAccount | undefined;
  addChildAccount: (child: { name: string; age: string; beltSlug: string; username: string; password: string }) => ChildAccount | undefined;
  updateChildAccount: (childId: string, child: { name: string; age: string; beltSlug: string; username: string; password: string }) => ChildAccount | undefined;
  addOperationsStudent: (student: StudentInput) => StudentRecord | undefined;
  updateOperationsStudent: (studentId: string, student: StudentInput) => StudentRecord | undefined;
  deleteOperationsStudent: (studentId: string) => StudentRecord | undefined;
  addStudioClass: (studioClass: StudioClassInput) => StudioClass | undefined;
  updateStudioClass: (classId: string, studioClass: StudioClassInput) => StudioClass | undefined;
  deleteStudioClass: (classId: string) => StudioClass | undefined;
  addScheduledClass: (scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => ScheduledClass | undefined;
  addStudioEvent: (event: { title: string; date: string; time: string; details: string; audience: StudioEvent["audience"] }) => StudioEvent | undefined;
  addTrainingVideoFolder: (folder: TrainingVideoFolderInput) => TrainingVideoFolder | undefined;
  addTrainingVideo: (video: TrainingVideoInput) => TrainingVideo | undefined;
  addStudyGuideFolder: (folder: StudyGuideFolderInput) => StudyGuideFolder | undefined;
  addStudyGuideMaterial: (material: StudyGuideMaterialInput) => StudyGuideMaterial | undefined;
  addMerchandiseItem: (item: MerchandiseInput) => MerchandiseItem | undefined;
  updateMerchandiseItem: (itemId: string, item: MerchandiseInput) => MerchandiseItem | undefined;
  deleteMerchandiseItem: (itemId: string) => MerchandiseItem | undefined;
  recordStudentCheckIn: (studentId: string) => StudentCheckIn | undefined;
  sendMissedClassFollowUps: () => number;
  sendMarketingBlast: (body: string) => number;
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

function readPrototypeSession() {
  const session = readStorage<AccountSession | undefined>(keys.session, undefined);
  if (!session?.email) return undefined;
  if (session.email.toLowerCase() === prototypeManagerLogin.email.toLowerCase()) return session;
  if (session.email.toLowerCase() === prototypeStudentLogin.email.toLowerCase()) return session;
  if (session.email.toLowerCase() === prototypeParentLogin.email.toLowerCase()) return session;
  const managedAccounts = readStorage<ManagedAccount[]>(keys.managedAccounts, []);
  if (managedAccounts.some((account) => account.username.toLowerCase() === session.email.toLowerCase() && account.status !== "inactive")) return session;
  const childAccounts = readStorage<ChildAccount[]>(keys.childAccounts, seedChildAccounts);
  if (childAccounts.some((child) => child.username.toLowerCase() === session.email.toLowerCase())) return session;
  if (session.email.toLowerCase().endsWith(".child")) return session;
  removeStorage(keys.session);
  return undefined;
}

function inferPrototypeAccountRole(email: string): AccountRole | undefined {
  const normalizedEmail = email.toLowerCase();
  if (normalizedEmail === prototypeManagerLogin.email.toLowerCase()) return "staff";
  if (normalizedEmail === prototypeStudentLogin.email.toLowerCase()) return "student";
  if (normalizedEmail === prototypeParentLogin.email.toLowerCase()) return "guardian";
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
      } else {
        removeStorage(keys.session);
      }
      return resolved;
    });
  }, []);
  return [value, update] as const;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function createPrototypeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeChildUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^-|-$/g, "");
}

function normalizeAccountUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function normalizeManagerAccess(access?: ManagerAccessKey[]) {
  const selected = access?.length ? access : defaultStaffAccess;
  return managerAccessKeys.filter((key) => selected.includes(key));
}

function isPrototypeLoginUsername(username: string) {
  const normalizedUsername = username.trim().toLowerCase();
  return [prototypeManagerLogin.username, prototypeStudentLogin.username, prototypeParentLogin.username].some((prototypeUsername) => prototypeUsername.toLowerCase() === normalizedUsername);
}

function childUsernameFromName(name: string) {
  const usernameBase = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${usernameBase || "student"}.child`;
}

function studentFullName(student: Pick<StudentRecord, "firstName" | "lastName">) {
  return `${student.firstName} ${student.lastName}`.trim();
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

function makeMessageLog(input: Omit<MessageLog, "id" | "createdAt" | "status">): MessageLog {
  return {
    ...input,
    id: createPrototypeId("message"),
    createdAt: new Date().toISOString(),
    status: "queued"
  };
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useStoredState<CartItem[]>(keys.cart, []);
  const [orders, setOrders] = useStoredState<Order[]>(keys.orders, []);
  const [bookings, setBookings] = useStoredState<BookingDetails[]>(keys.bookings, []);
  const [contacts, setContacts] = useStoredState<ContactSubmission[]>(keys.contacts, []);
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
  const [messageLogs, setMessageLogs] = useStoredState<MessageLog[]>(keys.messageLogs, seedMessageLogs);
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

  const totals = useMemo(() => calculateTotals(cart, coupon), [cart, coupon]);
  const currentManagedAccount = useMemo(() => {
    if (!session) return undefined;
    const normalizedEmail = session.email.toLowerCase();
    return managedAccounts.find((account) => account.username.toLowerCase() === normalizedEmail && account.status !== "inactive");
  }, [managedAccounts, session]);
  const accountRole = useMemo(() => {
    if (!session) return undefined;
    const normalizedEmail = session.email.toLowerCase();
    return accountRoles.find((record) => record.email.toLowerCase() === normalizedEmail)?.role ?? currentManagedAccount?.role ?? inferPrototypeAccountRole(session.email);
  }, [accountRoles, currentManagedAccount, session]);
  const managerAccountAccess = useMemo<ManagerAccountAccess>(() => {
    const isManagerOwner = session?.email.toLowerCase() === prototypeManagerLogin.email.toLowerCase();
    const normalizedEmail = session?.email.toLowerCase();
    const storedRole = normalizedEmail ? accountRoles.find((record) => record.email.toLowerCase() === normalizedEmail)?.role : undefined;
    const allowedTools = isManagerOwner
      ? managerAccessKeys
      : currentManagedAccount?.role === "staff"
        ? normalizeManagerAccess(currentManagedAccount.access)
        : storedRole === "staff"
          ? defaultStaffAccess
        : [];

    return {
      isManagerOwner,
      canCreateAccounts: isManagerOwner || allowedTools.includes("create"),
      canGrantCreateAccess: isManagerOwner,
      allowedTools
    };
  }, [accountRoles, currentManagedAccount, session]);
  const guardianChildren = useMemo(
    () => (session ? childAccounts.filter((child) => child.parentEmail.toLowerCase() === session.email.toLowerCase()) : []),
    [childAccounts, session]
  );

  const saveRoleForEmail = useCallback(
    (email: string, role: AccountRole) => {
      setAccountRoles((current) => {
        const normalizedEmail = email.toLowerCase();
        const existing = current.some((record) => record.email.toLowerCase() === normalizedEmail);
        return existing ? current.map((record) => (record.email.toLowerCase() === normalizedEmail ? { ...record, role } : record)) : [...current, { email, role }];
      });
    },
    [setAccountRoles]
  );

  const addProductToCart = useCallback(
    (productSlug: string, quantity: number) => {
      const product = getProduct(productSlug);
      if (!product) return;
      setCart((current) => {
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
    [setCart]
  );

  const saveBooking = useCallback(
    (booking: BookingDetails) => {
      setBookings((current) => [...current, booking]);
    },
    [setBookings]
  );

  const addBookingToCart = useCallback(
    (booking: BookingDetails) => {
      const product = getProduct("starter-program");
      if (!product) return;
      setCart((current) => [
        ...current,
        {
          id: `booking-${Date.now()}`,
          productSlug: product.slug,
          name: `${product.name} - ${booking.date} ${booking.time}`,
          unitPrice: product.price * booking.persons,
          displayPrice: product.displayPrice,
          quantity: 1,
          booking
        }
      ]);
      saveBooking(booking);
    },
    [saveBooking, setCart]
  );

  const updateCartQuantity = useCallback(
    (id: string, quantity: number) => {
      setCart((current) => current.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item)));
    },
    [setCart]
  );

  const removeCartItem = useCallback(
    (id: string) => {
      setCart((current) => current.filter((item) => item.id !== id));
    },
    [setCart]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    setCoupon(undefined);
  }, [setCart, setCoupon]);

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
      const order = createOrder({ existingOrdersCount: orders.length, customer, items: cart, coupon, notes });
      setOrders((current) => [...current, order]);
      setCart([]);
      setCoupon(undefined);
      return order;
    },
    [cart, coupon, orders.length, setCart, setCoupon, setOrders]
  );

  const saveContact = useCallback(
    (contact: ContactSubmission) => {
      setContacts((current) => [...current, contact]);
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

  const managedUsernameExists = useCallback(
    (username: string) => {
      const normalizedUsername = normalizeAccountUsername(username);
      if (!normalizedUsername) return false;
      return (
        isPrototypeLoginUsername(normalizedUsername) ||
        managedAccounts.some((account) => account.username.toLowerCase() === normalizedUsername.toLowerCase()) ||
        childAccounts.some((child) => child.username.toLowerCase() === normalizedUsername.toLowerCase())
      );
    },
    [childAccounts, managedAccounts]
  );

  const loginManagedAccount = useCallback(
    (credentials: { username: string; password: string }) => {
      const normalizedUsername = normalizeAccountUsername(credentials.username);
      const password = credentials.password.trim();
      if (!normalizedUsername || !password) return undefined;
      const account = managedAccounts.find(
        (item) => item.username.toLowerCase() === normalizedUsername.toLowerCase() && item.password === password && item.status !== "inactive"
      );
      if (!account) return undefined;
      saveRoleForEmail(account.username, account.role);
      setSession({ email: account.username, remembered: true, createdAt: new Date().toISOString() });
      return account;
    },
    [managedAccounts, saveRoleForEmail, setSession]
  );

  const logout = useCallback(() => setSession(undefined), [setSession]);

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
      if (managedUsernameExists(username)) return undefined;
      const role = account.role;
      const createdAccount: ManagedAccount = {
        id: createPrototypeId("managed-account"),
        displayName,
        username,
        password,
        role,
        status: account.status ?? "active",
        email: account.email?.trim() || undefined,
        phone: account.phone?.trim() || undefined,
        title: account.title?.trim() || undefined,
        notes: account.notes?.trim() || undefined,
        access: role === "staff" ? normalizeManagerAccess(account.access) : [],
        studentId: account.studentId,
        createdBy: session?.email,
        createdAt: new Date().toISOString()
      };
      setManagedAccounts((current) => [createdAccount, ...current]);
      saveRoleForEmail(username, role);
      return createdAccount;
    },
    [managedUsernameExists, saveRoleForEmail, session?.email, setManagedAccounts]
  );

  const addChildAccount = useCallback(
    (child: { name: string; age: string; beltSlug: string; username: string; password: string }) => {
      if (!session) return undefined;
      const cleanedName = child.name.trim();
      if (!cleanedName) return undefined;
      const username = normalizeChildUsername(child.username) || childUsernameFromName(cleanedName);
      const password = child.password.trim();
      if (!username || !password) return undefined;
      if (childAccounts.some((item) => item.username.toLowerCase() === username.toLowerCase())) return undefined;
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
      setChildAccounts((current) => [...current, createdChild]);
      saveRoleForEmail(username, "student");
      return createdChild;
    },
    [childAccounts, saveRoleForEmail, session, setChildAccounts]
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
      if (childAccounts.some((item) => item.id !== childId && item.username.toLowerCase() === username.toLowerCase())) return undefined;
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
    [childAccounts, saveRoleForEmail, session, setChildAccounts]
  );

  const loginChildAccount = useCallback(
    (childId: string) => {
      const child = childAccounts.find((item) => item.id === childId);
      if (!child) return;
      saveRoleForEmail(child.username, "student");
      setSession({ email: child.username, remembered: true, createdAt: new Date().toISOString() });
    },
    [childAccounts, saveRoleForEmail, setSession]
  );

  const loginChildCredentials = useCallback(
    (credentials: { username: string; password: string }) => {
      const normalizedUsername = normalizeChildUsername(credentials.username);
      const password = credentials.password.trim();
      if (!normalizedUsername || !password) return undefined;
      const child = childAccounts.find((item) => item.username.toLowerCase() === normalizedUsername.toLowerCase() && item.password === password);
      if (!child) return undefined;
      saveRoleForEmail(child.username, "student");
      setSession({ email: child.username, remembered: true, createdAt: new Date().toISOString() });
      return child;
    },
    [childAccounts, saveRoleForEmail, setSession]
  );

  const childUsernameExists = useCallback(
    (username: string) => {
      const normalizedUsername = normalizeChildUsername(username);
      return Boolean(normalizedUsername && childAccounts.some((item) => item.username.toLowerCase() === normalizedUsername.toLowerCase()));
    },
    [childAccounts]
  );

  const register = useCallback(
    (email: string) => {
      setAccounts((current) => (current.some((account) => account.email === email) ? current : [...current, { email, createdAt: new Date().toISOString() }]));
    },
    [setAccounts]
  );

  const addOperationsStudent = useCallback(
    (student: StudentInput) => {
      const normalizedStudent = normalizeStudentInput(student);
      if (!normalizedStudent) return undefined;
      const createdStudent: StudentRecord = {
        ...normalizedStudent,
        id: createPrototypeId("student"),
        classesAttended: 0,
        missedClassCount: 0
      };
      setStudents((current) => [createdStudent, ...current]);
      setMessageLogs((current) => [
        makeMessageLog({
          kind: "welcome",
          recipientName: studentFullName(createdStudent),
          recipientPhone: createdStudent.phone,
          body: welcomeTextForStudent(createdStudent)
        }),
        ...current
      ]);
      return createdStudent;
    },
    [setMessageLogs, setStudents]
  );

  const updateOperationsStudent = useCallback(
    (studentId: string, student: StudentInput) => {
      const existing = students.find((item) => item.id === studentId);
      if (!existing) return undefined;
      const normalizedStudent = normalizeStudentInput(student, existing.enrollmentDate || existing.joinedAt);
      if (!normalizedStudent) return undefined;
      const updatedStudent: StudentRecord = {
        ...existing,
        ...normalizedStudent
      };
      setStudents((current) => current.map((item) => (item.id === studentId ? updatedStudent : item)));
      return updatedStudent;
    },
    [setStudents, students]
  );

  const deleteOperationsStudent = useCallback(
    (studentId: string) => {
      const existing = students.find((item) => item.id === studentId);
      if (!existing) return undefined;
      setStudents((current) => current.filter((item) => item.id !== studentId));
      setScheduledClasses((current) => current.map((item) => (item.studentId === studentId ? { ...item, studentId: undefined } : item)));
      setCheckIns((current) => current.filter((item) => item.studentId !== studentId));
      setMessageLogs((current) => current.filter((item) => item.recipientPhone !== existing.phone));
      return existing;
    },
    [setCheckIns, setMessageLogs, setScheduledClasses, setStudents, students]
  );

  const addScheduledClass = useCallback(
    (scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => {
      const title = scheduledClass.title.trim();
      const type = scheduledClass.type.trim();
      if (!title || !scheduledClass.date || !scheduledClass.time.trim() || !type) return undefined;
      const createdClass: ScheduledClass = {
        id: createPrototypeId("schedule"),
        title,
        date: scheduledClass.date,
        time: scheduledClass.time.trim(),
        type,
        recurring: scheduledClass.recurring || undefined,
        titleColor: scheduledClass.titleColor?.trim() || undefined,
        studentId: scheduledClass.studentId,
        notes: scheduledClass.notes?.trim()
      };
      setScheduledClasses((current) => [createdClass, ...current]);
      return createdClass;
    },
    [setScheduledClasses]
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
      setStudioClasses((current) => [createdClass, ...current]);
      return createdClass;
    },
    [cleanStudioClass, setStudioClasses]
  );

  const updateStudioClass = useCallback(
    (classId: string, studioClass: StudioClassInput) => {
      const existing = studioClasses.find((item) => item.id === classId);
      if (!existing) return undefined;
      const cleaned = cleanStudioClass(studioClass);
      if (!cleaned) return undefined;
      const updatedClass: StudioClass = {
        ...existing,
        ...cleaned
      };
      setStudioClasses((current) => current.map((item) => (item.id === classId ? updatedClass : item)));
      return updatedClass;
    },
    [cleanStudioClass, setStudioClasses, studioClasses]
  );

  const deleteStudioClass = useCallback(
    (classId: string) => {
      const existing = studioClasses.find((item) => item.id === classId);
      if (!existing) return undefined;
      setStudioClasses((current) => current.filter((item) => item.id !== classId));
      return existing;
    },
    [setStudioClasses, studioClasses]
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
      setStudioEvents((current) => [createdEvent, ...current]);
      return createdEvent;
    },
    [setStudioEvents]
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
      setTrainingVideoFolders((current) => [...current, createdFolder]);
      return createdFolder;
    },
    [setTrainingVideoFolders]
  );

  const addTrainingVideo = useCallback(
    (video: TrainingVideoInput) => {
      const title = video.title.trim();
      const fileName = video.fileName.trim();
      const mimeType = video.mimeType.trim() || "video/mp4";
      const folderExists = trainingVideoFolders.some((folder) => folder.id === video.folderId);
      if (!title || !folderExists || !fileName || !video.videoDataUrl.startsWith("data:video/")) return undefined;
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
      setTrainingVideos((current) => [...current, createdVideo]);
      return createdVideo;
    },
    [setTrainingVideos, trainingVideoFolders]
  );

  const addStudyGuideFolder = useCallback(
    (folder: StudyGuideFolderInput) => {
      const name = folder.name.trim();
      const subject = folder.subject.trim();
      const parentId = folder.parentId?.trim() || undefined;
      const parentExists = !parentId || studyGuideFolders.some((currentFolder) => currentFolder.id === parentId);
      if (!name || !subject || !parentExists) return undefined;
      const createdFolder: StudyGuideFolder = {
        id: createPrototypeId("study-folder"),
        name,
        subject,
        parentId,
        description: folder.description?.trim() || undefined,
        createdAt: new Date().toISOString()
      };
      setStudyGuideFolders((current) => [...current, createdFolder]);
      return createdFolder;
    },
    [setStudyGuideFolders, studyGuideFolders]
  );

  const addStudyGuideMaterial = useCallback(
    (material: StudyGuideMaterialInput) => {
      const title = material.title.trim();
      const fileName = material.fileName.trim();
      const mimeType = material.mimeType.trim() || "application/octet-stream";
      const folderExists = studyGuideFolders.some((folder) => folder.id === material.folderId);
      if (!title || !folderExists || !fileName || !material.fileDataUrl.startsWith("data:")) return undefined;
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
      setStudyGuideMaterials((current) => [...current, createdMaterial]);
      return createdMaterial;
    },
    [setStudyGuideMaterials, studyGuideFolders]
  );

  const addMerchandiseItem = useCallback(
    (item: MerchandiseInput) => {
      const name = item.name.trim();
      const category = item.category.trim();
      if (!name || !category || !Number.isFinite(item.price) || !Number.isFinite(item.stock) || item.price < 0 || item.stock < 0) return undefined;
      const createdItem: MerchandiseItem = {
        id: createPrototypeId("merch"),
        name,
        category,
        price: item.price,
        stock: item.stock,
        description: item.description?.trim() || `${category} available for pickup at Cho's Martial Arts.`,
        imageLabel: category.toLowerCase(),
        imageDataUrl: item.imageDataUrl
      };
      setMerchandiseItems((current) => [createdItem, ...current]);
      return createdItem;
    },
    [setMerchandiseItems]
  );

  const updateMerchandiseItem = useCallback(
    (itemId: string, item: MerchandiseInput) => {
      const name = item.name.trim();
      const category = item.category.trim();
      if (!name || !category || !Number.isFinite(item.price) || !Number.isFinite(item.stock) || item.price < 0 || item.stock < 0) return undefined;
      let updatedItem: MerchandiseItem | undefined;
      setMerchandiseItems((current) =>
        current.map((currentItem) => {
          if (currentItem.id !== itemId) return currentItem;
          updatedItem = {
            ...currentItem,
            name,
            category,
            price: item.price,
            stock: item.stock,
            description: item.description?.trim() || `${category} available for pickup at Cho's Martial Arts.`,
            imageLabel: category.toLowerCase(),
            imageDataUrl: item.imageDataUrl
          };
          return updatedItem;
        })
      );
      return updatedItem;
    },
    [setMerchandiseItems]
  );

  const deleteMerchandiseItem = useCallback(
    (itemId: string) => {
      let deletedItem: MerchandiseItem | undefined;
      setMerchandiseItems((current) => {
        deletedItem = current.find((item) => item.id === itemId);
        return current.filter((item) => item.id !== itemId);
      });
      return deletedItem;
    },
    [setMerchandiseItems]
  );

  const recordStudentCheckIn = useCallback(
    (studentId: string) => {
      const student = students.find((item) => item.id === studentId);
      if (!student) return undefined;
      const checkInDate = todayStamp();
      const createdCheckIn: StudentCheckIn = {
        id: createPrototypeId("checkin"),
        studentId: student.id,
        studentName: studentFullName(student),
        date: checkInDate,
        beltRank: student.beltRank
      };
      setStudents((current) =>
        current.map((item) =>
          item.id === studentId
            ? {
                ...item,
                classesAttended: item.classesAttended + 1,
                missedClassCount: 0,
                lastCheckIn: checkInDate
              }
            : item
        )
      );
      setCheckIns((current) => [createdCheckIn, ...current]);
      return createdCheckIn;
    },
    [setCheckIns, setStudents, students]
  );

  const sendMissedClassFollowUps = useCallback(() => {
    const targets = students.filter((student) => student.missedClassCount >= 3 && student.phone.trim());
    if (!targets.length) return 0;
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: missedClassTextForStudent(student)
      })
    );
    setMessageLogs((current) => [...logs, ...current]);
    setStudents((current) => current.map((student) => (student.missedClassCount >= 3 ? { ...student, lastContactedAt: todayStamp() } : student)));
    return logs.length;
  }, [setMessageLogs, setStudents, students]);

  const sendMarketingBlast = useCallback(
    (body: string) => {
      const cleanBody = body.trim();
      if (!cleanBody) return 0;
      const campaign: MessageCampaign = {
        id: createPrototypeId("campaign"),
        title: "Marketing blast",
        body: cleanBody,
        audience: "all-students",
        createdAt: new Date().toISOString()
      };
      const logs = students
        .filter((student) => student.phone.trim())
        .map((student) =>
          makeMessageLog({
            kind: "marketing",
            recipientName: studentFullName(student),
            recipientPhone: student.phone,
            body: cleanBody,
            campaignId: campaign.id
          })
        );
      setMessageCampaigns((current) => [campaign, ...current]);
      setMessageLogs((current) => [...logs, ...current]);
      return logs.length;
    },
    [setMessageCampaigns, setMessageLogs, students]
  );

  const sendDirectMessage = useCallback(
    (message: { senderId: string; senderName: string; recipientId: string; recipientName: string; body: string }) => {
      const body = message.body.trim();
      if (!message.senderId || !message.recipientId || message.senderId === message.recipientId || !body) return undefined;
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
      setDirectMessages((current) => [...current, createdMessage]);
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
    session,
    accountRole,
    accounts,
    managedAccounts,
    currentManagedAccount,
    managerAccountAccess,
    guardianChildren,
    students,
    studioClasses,
    scheduledClasses,
    messageCampaigns,
    messageLogs,
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
    loginManagedAccount,
    loginChildAccount,
    loginChildCredentials,
    managedUsernameExists,
    childUsernameExists,
    logout,
    register,
    setAccountRole,
    createManagedAccount,
    addChildAccount,
    updateChildAccount,
    addOperationsStudent,
    updateOperationsStudent,
    deleteOperationsStudent,
    addStudioClass,
    updateStudioClass,
    deleteStudioClass,
    addScheduledClass,
    addStudioEvent,
    addTrainingVideoFolder,
    addTrainingVideo,
    addStudyGuideFolder,
    addStudyGuideMaterial,
    addMerchandiseItem,
    updateMerchandiseItem,
    deleteMerchandiseItem,
    recordStudentCheckIn,
    sendMissedClassFollowUps,
    sendMarketingBlast,
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
