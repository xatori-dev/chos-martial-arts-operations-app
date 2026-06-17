import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { buildOperationsBackupSnapshot, type OperationsBackupInput } from "./operationsBackup";
import { AppStateProvider, useAppState } from "./state";
import type { AccountSession } from "./types";
import { prototypeDeveloperLogin, prototypeManagerLogin } from "./utils";
import serviceWorkerSource from "../public/cho-service-worker.js?raw";

function stubMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

function stubResizeObserver(height = 360) {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe = (target: Element) => {
      this.callback([
        {
          target,
          contentRect: { height } as DOMRectReadOnly
        } as ResizeObserverEntry
      ], this as unknown as ResizeObserver);
    };

    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverMock
  });
}

function stubUnsupportedScreenOrientation() {
  Object.defineProperty(window.screen, "orientation", {
    configurable: true,
    value: undefined
  });
}

function stubScreenOrientationLock(lock = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(window.screen, "orientation", {
    configurable: true,
    value: { lock }
  });

  return lock;
}

function seedActiveSession(session: AccountSession) {
  const serializedSession = JSON.stringify(session);
  window.localStorage.setItem("chos.session.v1", serializedSession);
  window.sessionStorage.setItem("chos.session.v1", serializedSession);
}

function clearActiveSession() {
  window.localStorage.removeItem("chos.session.v1");
  window.sessionStorage.removeItem("chos.session.v1");
}

function renderLoggedInApp(path = "/", role: "staff" | "student" | "guardian" = "staff") {
  const email =
    role === "guardian"
      ? "parent123@chos.prototype"
      : role === "student"
        ? "student123@chos.prototype"
        : "manager123@chos.prototype";
  seedActiveSession({ email, remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
  window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email, role }]));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

function renderLoggedInDeveloperApp(path = "/") {
  const email = "dev123@chos.prototype";
  vi.stubEnv("VITE_ENABLE_DEVELOPER_ACCOUNT", "true");
  seedActiveSession({ email, remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
  window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email, role: "guardian" }]));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

type ChoServiceWorkerTestEvent = {
  data?: {
    json?: () => unknown;
    text?: () => string;
  };
  notification?: {
    close: () => void;
    data?: {
      url?: string;
      threadId?: string;
    };
  };
  waitUntil: (promise: Promise<unknown>) => void;
};

type ChoServiceWorkerHandler = (event: ChoServiceWorkerTestEvent) => void;

function loadChoServiceWorkerForTest(
  scope = "https://chos.example/chos-martial-arts-prototype/",
  workerNavigator: { setAppBadge?: (contents?: number) => Promise<void>; clearAppBadge?: () => Promise<void> } = {}
) {
  const listeners = new Map<string, ChoServiceWorkerHandler>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue([]);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const selfMock = {
    location: { origin: "https://chos.example" },
    registration: { scope, showNotification },
    clients: { matchAll, openWindow },
    navigator: workerNavigator,
    addEventListener: vi.fn((eventName: string, handler: ChoServiceWorkerHandler) => {
      listeners.set(eventName, handler);
    })
  };

  new Function("self", serviceWorkerSource)(selfMock);

  return {
    listeners,
    showNotification,
    navigator: workerNavigator,
    clients: {
      matchAll,
      openWindow
    }
  };
}

function renderManagedStaffApp(path: string, account: Record<string, unknown>) {
  window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([account]));
  seedActiveSession({ email: String(account.username), remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
  window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: account.username, role: "staff" }]));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

function renderManagedStudentApp(path: string, account: Record<string, unknown>, students: Record<string, unknown>[]) {
  window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([account]));
  window.localStorage.setItem("chos.operations.students.v1", JSON.stringify(students));
  seedActiveSession({ email: String(account.username), remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
  window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: account.username, role: "student" }]));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

function scopedProfileKey(scope: "manager" | "staff" | "student" | "guardian", email: string) {
  const keyEmail = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.profile.${scope}.${keyEmail}.v1`;
}

function beltCaseStorageKey(email: string) {
  const keyEmail = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.beltCase.student.${keyEmail || "student"}.v1`;
}

function parentTutorialKey(email: string) {
  const keyEmail = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.parentTutorial.${keyEmail || "parent"}.v1`;
}

const testVisualColorKeys = [
  "background",
  "surface",
  "elevatedSurface",
  "text",
  "mutedText",
  "primary",
  "secondary",
  "button",
  "buttonText",
  "border",
  "success",
  "danger"
];

function visualThemeKey(email: string) {
  const keyEmail = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.visualTheme.${keyEmail || "guest"}.v1`;
}

function resetDocumentTheme() {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-custom-colors");
  document.documentElement.style.colorScheme = "";
  testVisualColorKeys.forEach((key) => {
    document.documentElement.style.removeProperty(`--user-visual-${key}`);
  });
}

function renderLoggedOutApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

const completeStudentSafetyFields = {
  dateOfBirth: "2012-09-01",
  guardianName: "Family Contact",
  guardianPhone: "(262) 555-0100",
  guardianEmail: "family@example.com",
  emergencyContactName: "Emergency Contact",
  emergencyContactRelationship: "Parent",
  emergencyContactPhone: "(262) 555-0200",
  smsConsentUpdatedAt: "2026-05-01T10:00:00.000Z"
};

function dateKeyOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type OperationsBackupInputOverrides = Omit<Partial<OperationsBackupInput>, "automationRuns" | "messagingSetup"> & {
  automationRuns?: readonly Record<string, unknown>[];
  messagingSetup?: readonly Record<string, unknown>[];
};

function makeOperationsBackupInput(overrides: OperationsBackupInputOverrides = {}): OperationsBackupInput {
  return {
    accounts: [],
    accountRoles: [],
    managedAccounts: [],
    childAccounts: [],
    students: [],
    studioClasses: [],
    scheduledClasses: [],
    messageCampaigns: [],
    scheduledTextCampaigns: [],
    messageLogs: [],
    automationRuns: [],
    directMessages: [],
    messagingSetup: [],
    studioEvents: [],
    merchandiseItems: [],
    checkIns: [],
    trainingVideoFolders: [],
    trainingVideos: [],
    studyGuideFolders: [],
    studyGuideMaterials: [],
    orders: [],
    bookings: [],
    contacts: [],
    leadReviews: [],
    ...overrides
  } as unknown as OperationsBackupInput;
}

function CheckInDoubleCallHarness({ studentId, todayKey }: { studentId: string; todayKey: string }) {
  const { checkIns, recordStudentCheckIn, students } = useAppState();
  const student = students.find((item) => item.id === studentId);
  const todayCheckIns = checkIns.filter((checkIn) => checkIn.studentId === studentId && checkIn.date === todayKey);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          recordStudentCheckIn(studentId);
          recordStudentCheckIn(studentId);
        }}
      >
        Double check in
      </button>
      <p>Harness classes: {student?.classesAttended ?? "missing"}</p>
      <p>Harness today logs: {todayCheckIns.length}</p>
    </div>
  );
}

function AddAndCheckInStudentHarness({ todayKey }: { todayKey: string }) {
  const { addOperationsStudent, checkIns, recordStudentCheckIn, students } = useAppState();
  const student = students.find((item) => item.email === "same-day@example.com");
  const todayCheckIns = student ? checkIns.filter((checkIn) => checkIn.studentId === student.id && checkIn.date === todayKey) : [];

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const createdStudent = addOperationsStudent({
            fullName: "Same Day Student",
            studentEmail: "same-day@example.com",
            guardianName: "Sam Parent",
            guardianPhone: "(262) 555-0140",
            status: "Active",
            beltRank: "White"
          });
          if (createdStudent) {
            recordStudentCheckIn(createdStudent.id);
          }
        }}
      >
        Add and check in student
      </button>
      <p>Harness same-day classes: {student?.classesAttended ?? "missing"}</p>
      <p>Harness same-day check-ins: {todayCheckIns.length}</p>
    </div>
  );
}

function DeactivateAndCheckInStudentHarness({ studentId, todayKey }: { studentId: string; todayKey: string }) {
  const { checkIns, recordStudentCheckIn, students, updateOperationsStudent } = useAppState();
  const student = students.find((item) => item.id === studentId);
  const todayCheckIns = checkIns.filter((checkIn) => checkIn.studentId === studentId && checkIn.date === todayKey);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0100",
            status: "Inactive",
            beltRank: "Yellow"
          });
          recordStudentCheckIn(studentId);
        }}
      >
        Deactivate and check in student
      </button>
      <p>Harness inactive status: {student?.status ?? "missing"}</p>
      <p>Harness inactive classes: {student?.classesAttended ?? "missing"}</p>
      <p>Harness inactive check-ins: {todayCheckIns.length}</p>
    </div>
  );
}

function DeleteAndCheckInStudentHarness({ studentId, todayKey }: { studentId: string; todayKey: string }) {
  const { checkIns, deleteOperationsStudent, recordStudentCheckIn, students } = useAppState();
  const student = students.find((item) => item.id === studentId);
  const todayCheckIns = checkIns.filter((checkIn) => checkIn.studentId === studentId && checkIn.date === todayKey);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          deleteOperationsStudent(studentId);
          recordStudentCheckIn(studentId);
        }}
      >
        Delete and check in student
      </button>
      <p>Harness deleted student: {student ? `${student.status}:${student.classesAttended}` : "missing"}</p>
      <p>Harness deleted check-ins: {todayCheckIns.length}</p>
    </div>
  );
}

function ScheduleStudentAssignmentHarness({ studentId }: { studentId: string }) {
  const { addScheduledClass, scheduledClasses } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addScheduledClass({
            title: "Inactive Private Lesson",
            date: dateKeyOffset(1),
            time: "4:30 PM",
            type: "private-lesson",
            studentId
          });
        }}
      >
        Add inactive schedule
      </button>
      <p>Harness scheduled items: {scheduledClasses.length}</p>
    </div>
  );
}

function AddAndScheduleStudentHarness() {
  const { addOperationsStudent, addScheduledClass, scheduledClasses, students } = useAppState();
  const student = students.find((item) => item.email === "schedule-same-day@example.com");
  const scheduledLessons = student ? scheduledClasses.filter((item) => item.studentId === student.id) : [];

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const createdStudent = addOperationsStudent({
            fullName: "Schedule Same Day",
            studentEmail: "schedule-same-day@example.com",
            guardianName: "Sam Parent",
            guardianPhone: "(262) 555-0142",
            status: "Active",
            beltRank: "White"
          });
          if (createdStudent) {
            addScheduledClass({
              title: "Same Day Intro Lesson",
              date: "2026-06-15",
              time: "4:30 PM",
              type: "private-lesson",
              studentId: createdStudent.id,
              notes: "First-day assessment."
            });
          }
        }}
      >
        Add and schedule student
      </button>
      <p>Harness same-day schedule student: {student?.email ?? "missing"}</p>
      <p>Harness same-day schedule items: {scheduledLessons.length}</p>
    </div>
  );
}

function ScheduleDoubleAddHarness() {
  const { addScheduledClass, scheduledClasses } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstSchedule = addScheduledClass({
            title: "Youth Testing Prep",
            date: "2026-06-12",
            time: "4:30 PM",
            type: "class",
            recurring: true,
            titleColor: "#c51625",
            notes: "Forms review."
          });
          const secondSchedule = addScheduledClass({
            title: " Youth Testing Prep ",
            date: "2026-06-12",
            time: " 4:30 PM ",
            type: " class ",
            recurring: true,
            titleColor: "#c51625",
            notes: " Forms review. "
          });
          setReturnMatch(firstSchedule && secondSchedule && firstSchedule.id === secondSchedule.id ? "same" : "different");
        }}
      >
        Add schedule twice
      </button>
      <p>Harness duplicate schedule returns: {returnMatch}</p>
      <p>Harness duplicate scheduled items: {scheduledClasses.length}</p>
    </div>
  );
}

function StudioEventDoubleAddHarness() {
  const { addStudioEvent, studioEvents } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstEvent = addStudioEvent({
            title: "Family Board Breaking Night",
            date: "2026-06-20",
            time: "6:00 PM",
            details: "Students can invite family for board breaking demos.",
            audience: "families"
          });
          const secondEvent = addStudioEvent({
            title: " Family Board Breaking Night ",
            date: "2026-06-20",
            time: " 6:00 PM ",
            details: " Students can invite family for board breaking demos. ",
            audience: "families"
          });
          setReturnMatch(firstEvent && secondEvent && firstEvent.id === secondEvent.id ? "same" : "different");
        }}
      >
        Add event twice
      </button>
      <p>Harness duplicate event returns: {returnMatch}</p>
      <p>Harness duplicate events: {studioEvents.length}</p>
    </div>
  );
}

function MerchandiseDoubleAddHarness() {
  const { addMerchandiseItem, merchandiseItems } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstItem = addMerchandiseItem({
            name: "Red Sparring Gloves",
            category: "Gloves",
            price: 49,
            stock: 8,
            reorderPoint: 3,
            targetStock: 14,
            description: "Competition gloves for sparring days.",
            imageDataUrl: "data:image/png;base64,gloves"
          });
          const secondItem = addMerchandiseItem({
            name: " Red Sparring Gloves ",
            category: " Gloves ",
            price: 49,
            stock: 8,
            reorderPoint: 3,
            targetStock: 14,
            description: " Competition gloves for sparring days. ",
            imageDataUrl: "data:image/png;base64,gloves"
          });
          setReturnMatch(firstItem && secondItem && firstItem.id === secondItem.id ? "same" : "different");
        }}
      >
        Add merchandise twice
      </button>
      <p>Harness duplicate merchandise returns: {returnMatch}</p>
      <p>Harness duplicate merchandise items: {merchandiseItems.length}</p>
    </div>
  );
}

function StudioClassDoubleAddHarness() {
  const { addStudioClass, studioClasses } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstClass = addStudioClass({
            name: "Youth Sparring",
            daysOfWeek: [3, 1],
            startTime: "17:15",
            endTime: "18:00",
            recurring: true,
            titleColor: "#c51625",
            notes: "Pads, footwork, and controlled sparring."
          });
          const secondClass = addStudioClass({
            name: " Youth Sparring ",
            daysOfWeek: [1, 3, 1],
            startTime: " 17:15 ",
            endTime: " 18:00 ",
            recurring: true,
            titleColor: "#c51625",
            notes: " Pads, footwork, and controlled sparring. "
          });
          setReturnMatch(firstClass && secondClass && firstClass.id === secondClass.id ? "same" : "different");
        }}
      >
        Add class twice
      </button>
      <p>Harness duplicate class returns: {returnMatch}</p>
      <p>Harness duplicate classes: {studioClasses.length}</p>
    </div>
  );
}

function TrainingVideoFolderDoubleAddHarness() {
  const { addTrainingVideoFolder, trainingVideoFolders } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstFolder = addTrainingVideoFolder({
            name: "Forms",
            subject: "Beginner Forms",
            description: "White belt form review videos."
          });
          const secondFolder = addTrainingVideoFolder({
            name: " Forms ",
            subject: " Beginner Forms ",
            description: " White belt form review videos. "
          });
          setReturnMatch(firstFolder && secondFolder && firstFolder.id === secondFolder.id ? "same" : "different");
        }}
      >
        Add video folder twice
      </button>
      <p>Harness duplicate video folder returns: {returnMatch}</p>
      <p>Harness duplicate video folders: {trainingVideoFolders.length}</p>
    </div>
  );
}

function StudyGuideFolderDoubleAddHarness() {
  const { addStudyGuideFolder, studyGuideFolders } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstFolder = addStudyGuideFolder({
            name: "White Belt Basics",
            subject: "Foundations",
            description: "Start here for first-rank review."
          });
          const secondFolder = addStudyGuideFolder({
            name: " White Belt Basics ",
            subject: " Foundations ",
            description: " Start here for first-rank review. "
          });
          setReturnMatch(firstFolder && secondFolder && firstFolder.id === secondFolder.id ? "same" : "different");
        }}
      >
        Add study folder twice
      </button>
      <p>Harness duplicate study folder returns: {returnMatch}</p>
      <p>Harness duplicate study folders: {studyGuideFolders.length}</p>
    </div>
  );
}

function TrainingVideoDoubleAddHarness() {
  const { addTrainingVideoFolder, addTrainingVideo, trainingVideos } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const folder = addTrainingVideoFolder({
            name: "Forms",
            subject: "Beginner Forms",
            description: "White belt form review videos."
          });
          const firstVideo = folder
            ? addTrainingVideo({
                title: "Roundhouse Basics",
                folderId: folder.id,
                description: "Practice chamber, pivot, and clean retraction.",
                fileName: "roundhouse-demo.mp4",
                mimeType: "video/mp4",
                size: 2048,
                videoDataUrl: "data:video/mp4;base64,cm91bmRob3VzZQ=="
              })
            : undefined;
          const secondVideo = folder
            ? addTrainingVideo({
                title: " Roundhouse Basics ",
                folderId: folder.id,
                description: " Practice chamber, pivot, and clean retraction. ",
                fileName: " roundhouse-demo.mp4 ",
                mimeType: " video/mp4 ",
                size: 2048,
                videoDataUrl: "data:video/mp4;base64,cm91bmRob3VzZQ=="
              })
            : undefined;
          setReturnMatch(firstVideo && secondVideo && firstVideo.id === secondVideo.id ? "same" : "different");
        }}
      >
        Add video twice
      </button>
      <p>Harness duplicate video returns: {returnMatch}</p>
      <p>Harness duplicate videos: {trainingVideos.length}</p>
    </div>
  );
}

function StudyGuideMaterialDoubleAddHarness() {
  const { addStudyGuideFolder, addStudyGuideMaterial, studyGuideMaterials } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const folder = addStudyGuideFolder({
            name: "White Belt Basics",
            subject: "Foundations",
            description: "Start here for first-rank review."
          });
          const firstMaterial = folder
            ? addStudyGuideMaterial({
                title: "Front Kick Checklist",
                folderId: folder.id,
                description: "Read before practicing front kicks at home.",
                fileName: "front-kick-notes.pdf",
                mimeType: "application/pdf",
                size: 1024,
                fileDataUrl: "data:application/pdf;base64,Zm9vdHdvcms="
              })
            : undefined;
          const secondMaterial = folder
            ? addStudyGuideMaterial({
                title: " Front Kick Checklist ",
                folderId: folder.id,
                description: " Read before practicing front kicks at home. ",
                fileName: " front-kick-notes.pdf ",
                mimeType: " application/pdf ",
                size: 1024,
                fileDataUrl: "data:application/pdf;base64,Zm9vdHdvcms="
              })
            : undefined;
          setReturnMatch(firstMaterial && secondMaterial && firstMaterial.id === secondMaterial.id ? "same" : "different");
        }}
      >
        Add study material twice
      </button>
      <p>Harness duplicate study material returns: {returnMatch}</p>
      <p>Harness duplicate study materials: {studyGuideMaterials.length}</p>
    </div>
  );
}

function StudentQuickOutreachHarness({ studentId }: { studentId: string }) {
  const { messageLogs, queueStudentMilestoneEncouragement, queueStudentProfileUpdateRequest, students } = useAppState();
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          queueStudentMilestoneEncouragement(studentId);
          queueStudentProfileUpdateRequest(studentId);
        }}
      >
        Queue inactive outreach
      </button>
      <p>Harness messages: {messageLogs.length}</p>
      <p>Harness last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function StudentProfileUpdateDoubleCallHarness({ studentId }: { studentId: string }) {
  const { messageLogs, queueStudentProfileUpdateRequest, students } = useAppState();
  const [returnNames, setReturnNames] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstMessage = queueStudentProfileUpdateRequest(studentId);
          const secondMessage = queueStudentProfileUpdateRequest(studentId);
          setReturnNames(`${firstMessage?.recipientName ?? "none"},${secondMessage?.recipientName ?? "none"}`);
        }}
      >
        Request profile update twice
      </button>
      <p>Harness quick return names: {returnNames}</p>
      <p>Harness quick messages: {messageLogs.length}</p>
      <p>Harness quick last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndQueueMilestoneHarness({ studentId }: { studentId: string }) {
  const { messageLogs, queueStudentMilestoneEncouragement, students, updateOperationsStudent } = useAppState();
  const [returnName, setReturnName] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          const queuedMessage = queueStudentMilestoneEncouragement(studentId);
          setReturnName(queuedMessage?.recipientName ?? "none");
        }}
      >
        Deactivate and queue milestone
      </button>
      <p>Harness milestone student status: {student?.status ?? "missing"}</p>
      <p>Harness milestone return name: {returnName}</p>
      <p>Harness milestone messages: {messageLogs.length}</p>
      <p>Harness milestone last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndSendMilestonesHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendMilestoneEncouragements, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendMilestoneEncouragements()));
        }}
      >
        Deactivate and send milestones
      </button>
      <p>Harness bulk milestone status: {student?.status ?? "missing"}</p>
      <p>Harness bulk milestone return count: {returnCount}</p>
      <p>Harness bulk milestone messages: {messageLogs.length}</p>
      <p>Harness bulk milestone last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndQueueProfileUpdateHarness({ studentId }: { studentId: string }) {
  const { messageLogs, queueStudentProfileUpdateRequest, students, updateOperationsStudent } = useAppState();
  const [returnName, setReturnName] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          const queuedMessage = queueStudentProfileUpdateRequest(studentId);
          setReturnName(queuedMessage?.recipientName ?? "none");
        }}
      >
        Deactivate and request profile update
      </button>
      <p>Harness profile student status: {student?.status ?? "missing"}</p>
      <p>Harness profile return name: {returnName}</p>
      <p>Harness profile messages: {messageLogs.length}</p>
      <p>Harness profile last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndSendProfileUpdatesHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendProfileUpdateRequests, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendProfileUpdateRequests()));
        }}
      >
        Deactivate and send profile updates
      </button>
      <p>Harness bulk profile status: {student?.status ?? "missing"}</p>
      <p>Harness bulk profile return count: {returnCount}</p>
      <p>Harness bulk profile messages: {messageLogs.length}</p>
      <p>Harness bulk profile last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndSendClassRemindersHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendClassReminders, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendClassReminders()));
        }}
      >
        Deactivate and send class reminders
      </button>
      <p>Harness class reminder status: {student?.status ?? "missing"}</p>
      <p>Harness class reminder return count: {returnCount}</p>
      <p>Harness class reminder messages: {messageLogs.length}</p>
      <p>Harness class reminder last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndSendCelebrationsHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendCelebrationOutreach, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendCelebrationOutreach()));
        }}
      >
        Deactivate and send celebrations
      </button>
      <p>Harness celebration status: {student?.status ?? "missing"}</p>
      <p>Harness celebration return count: {returnCount}</p>
      <p>Harness celebration messages: {messageLogs.length}</p>
      <p>Harness celebration last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndSendPausedReviewHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendPausedStudentReactivationFollowUps, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendPausedStudentReactivationFollowUps()));
        }}
      >
        Deactivate and review paused students
      </button>
      <p>Harness paused status: {student?.status ?? "missing"}</p>
      <p>Harness paused return count: {returnCount}</p>
      <p>Harness paused messages: {messageLogs.length}</p>
      <p>Harness paused last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndSendNewStudentCheckInsHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendNewStudentCheckIns, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendNewStudentCheckIns()));
        }}
      >
        Deactivate and send new student check-ins
      </button>
      <p>Harness new student status: {student?.status ?? "missing"}</p>
      <p>Harness new student return count: {returnCount}</p>
      <p>Harness new student messages: {messageLogs.length}</p>
      <p>Harness new student last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndSendMissedClassHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendMissedClassFollowUps, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendMissedClassFollowUps()));
        }}
      >
        Deactivate and send missed-class follow-ups
      </button>
      <p>Harness missed-class status: {student?.status ?? "missing"}</p>
      <p>Harness missed-class return count: {returnCount}</p>
      <p>Harness missed-class messages: {messageLogs.length}</p>
      <p>Harness missed-class last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndCheckAttendanceGapsHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendAttendanceGapCheckIns, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendAttendanceGapCheckIns()));
        }}
      >
        Deactivate and check attendance gaps
      </button>
      <p>Harness attendance-gap status: {student?.status ?? "missing"}</p>
      <p>Harness attendance-gap return count: {returnCount}</p>
      <p>Harness attendance-gap messages: {messageLogs.length}</p>
      <p>Harness attendance-gap last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndConvertTrialHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendTrialConversionFollowUps, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendTrialConversionFollowUps()));
        }}
      >
        Deactivate and convert trial students
      </button>
      <p>Harness trial status: {student?.status ?? "missing"}</p>
      <p>Harness trial return count: {returnCount}</p>
      <p>Harness trial messages: {messageLogs.length}</p>
      <p>Harness trial last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DeactivateAndSendBeltInvitesHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendBeltTestInvites, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendBeltTestInvites()));
        }}
      >
        Deactivate and invite belt candidates
      </button>
      <p>Harness belt status: {student?.status ?? "missing"}</p>
      <p>Harness belt return count: {returnCount}</p>
      <p>Harness belt messages: {messageLogs.length}</p>
      <p>Harness belt last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function BulkOutreachDoubleCallHarness() {
  const { messageLogs, sendCelebrationOutreach, students } = useAppState();
  const [returnCounts, setReturnCounts] = useState("none");
  const student = students.find((item) => item.id === "student-ari");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstCount = sendCelebrationOutreach();
          const secondCount = sendCelebrationOutreach();
          setReturnCounts(`${firstCount},${secondCount}`);
        }}
      >
        Send celebration outreach twice
      </button>
      <p>Harness return counts: {returnCounts}</p>
      <p>Harness messages: {messageLogs.length}</p>
      <p>Harness last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function MarketingBlastDoubleCallHarness() {
  const { messageCampaigns, messageLogs, sendMarketingBlast } = useAppState();
  const [returnCounts, setReturnCounts] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstCount = sendMarketingBlast("June family night is open for registration.");
          const secondCount = sendMarketingBlast("June family night is open for registration.");
          setReturnCounts(`${firstCount},${secondCount}`);
        }}
      >
        Send marketing blast twice
      </button>
      <p>Harness marketing return counts: {returnCounts}</p>
      <p>Harness campaigns: {messageCampaigns.length}</p>
      <p>Harness marketing messages: {messageLogs.length}</p>
    </div>
  );
}

function DeactivateAndSendMarketingBlastHarness({ studentId }: { studentId: string }) {
  const { messageCampaigns, messageLogs, sendMarketingBlast, students, updateOperationsStudent } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0101",
            status: "Inactive",
            beltRank: "Yellow"
          });
          setReturnCount(String(sendMarketingBlast("June family night is open for registration.")));
        }}
      >
        Deactivate and send marketing blast
      </button>
      <p>Harness marketing student status: {student?.status ?? "missing"}</p>
      <p>Harness marketing return count: {returnCount}</p>
      <p>Harness marketing campaign count: {messageCampaigns.length}</p>
      <p>Harness marketing message count: {messageLogs.length}</p>
    </div>
  );
}

function QueuedTextsDoubleSendHarness() {
  const { messageLogs, sendQueuedTexts } = useAppState();
  const [returnCounts, setReturnCounts] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstCount = sendQueuedTexts();
          const secondCount = sendQueuedTexts();
          setReturnCounts(`${firstCount},${secondCount}`);
        }}
      >
        Send queued texts twice
      </button>
      <p>Harness send return counts: {returnCounts}</p>
      <p>Harness queued statuses: {messageLogs.map((message) => message.status).join(",")}</p>
    </div>
  );
}

function SingleQueuedTextDoubleSendHarness() {
  const { messageLogs, sendQueuedText } = useAppState();
  const [returnNames, setReturnNames] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstMessage = sendQueuedText("message-ari");
          const secondMessage = sendQueuedText("message-ari");
          setReturnNames(`${firstMessage?.recipientName ?? "none"},${secondMessage?.recipientName ?? "none"}`);
        }}
      >
        Send Ari queued text twice
      </button>
      <p>Harness single send returns: {returnNames}</p>
      <p>Harness single statuses: {messageLogs.map((message) => message.status).join(",")}</p>
    </div>
  );
}

function DeactivateAndSendQueuedTextHarness({ studentId }: { studentId: string }) {
  const { messageLogs, sendQueuedText, students, updateOperationsStudent } = useAppState();
  const [returnName, setReturnName] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0100",
            status: "Inactive",
            beltRank: "Yellow"
          });
          const sentMessage = sendQueuedText("message-ari");
          setReturnName(sentMessage?.recipientName ?? "none");
        }}
      >
        Deactivate and send queued text
      </button>
      <p>Harness queued student status: {student?.status ?? "missing"}</p>
      <p>Harness queued send return: {returnName}</p>
      <p>Harness queued message statuses: {messageLogs.map((message) => message.status).join(",") || "none"}</p>
    </div>
  );
}

function StaleQueuedTextsDoubleClearHarness() {
  const { clearStaleQueuedTexts, messageLogs } = useAppState();
  const [returnCounts, setReturnCounts] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstCount = clearStaleQueuedTexts();
          const secondCount = clearStaleQueuedTexts();
          setReturnCounts(`${firstCount},${secondCount}`);
        }}
      >
        Clear stale queued texts twice
      </button>
      <p>Harness stale clear returns: {returnCounts}</p>
      <p>Harness stale messages: {messageLogs.length}</p>
    </div>
  );
}

function LeadReviewDoubleCallHarness() {
  const { leadReviews, reviewLeadFollowUps } = useAppState();
  const [returnCounts, setReturnCounts] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstCount = reviewLeadFollowUps();
          const secondCount = reviewLeadFollowUps();
          setReturnCounts(`${firstCount},${secondCount}`);
        }}
      >
        Review leads twice
      </button>
      <p>Harness lead review returns: {returnCounts}</p>
      <p>Harness lead reviews: {leadReviews.length}</p>
    </div>
  );
}

function SaveContactAndReviewLeadsHarness() {
  const { contacts, leadReviews, reviewLeadFollowUps, saveContact } = useAppState();
  const [returnCount, setReturnCount] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          saveContact({
            id: "contact-ari",
            name: "Ari Nguyen",
            email: "ari@example.com",
            phone: "(262) 555-0101",
            message: "We want to try the starter program.",
            createdAt: `${dateKeyOffset(0)}T10:00:00.000Z`
          });
          setReturnCount(String(reviewLeadFollowUps()));
        }}
      >
        Save contact and review leads
      </button>
      <p>Harness saved contacts: {contacts.length}</p>
      <p>Harness same-action lead return: {returnCount}</p>
      <p>Harness same-action lead reviews: {leadReviews.length}</p>
    </div>
  );
}

function LowInventoryRestockDoubleCallHarness() {
  const { merchandiseItems, restockLowInventory } = useAppState();
  const [returnCounts, setReturnCounts] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstCount = restockLowInventory();
          const secondCount = restockLowInventory();
          setReturnCounts(`${firstCount},${secondCount}`);
        }}
      >
        Restock inventory twice
      </button>
      <p>Harness restock returns: {returnCounts}</p>
      <p>Harness inventory stocks: {merchandiseItems.map((item) => `${item.id}:${item.stock}`).join(",")}</p>
    </div>
  );
}

function StudentCreationHarness() {
  const { addOperationsStudent, messageLogs, students } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addOperationsStudent({
            fullName: "Cora Miles",
            studentEmail: "cora@example.com",
            guardianName: "Mina Miles",
            guardianPhone: "(262) 555-0102",
            status: "Inactive",
            beltRank: "Blue"
          });
        }}
      >
        Create inactive student
      </button>
      <p>Harness students: {students.length}</p>
      <p>Harness messages: {messageLogs.length}</p>
    </div>
  );
}

function StudentCreationDoubleCallHarness() {
  const { addOperationsStudent, messageLogs, students } = useAppState();
  const [returnNames, setReturnNames] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstStudent = addOperationsStudent({
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Minh Nguyen",
            guardianPhone: "(262) 555-0101",
            status: "Active",
            beltRank: "White"
          });
          const secondStudent = addOperationsStudent({
            fullName: " Ari Nguyen ",
            studentEmail: " ARI@example.com ",
            guardianName: "Minh Nguyen",
            guardianPhone: "(262) 555-0101",
            status: "Active",
            beltRank: "White"
          });
          setReturnNames(`${firstStudent ? `${firstStudent.firstName} ${firstStudent.lastName}` : "none"},${secondStudent ? `${secondStudent.firstName} ${secondStudent.lastName}` : "none"}`);
        }}
      >
        Create student twice
      </button>
      <p>Harness duplicate student returns: {returnNames}</p>
      <p>Harness duplicate students: {students.length}</p>
      <p>Harness duplicate messages: {messageLogs.length}</p>
    </div>
  );
}

function ManagedStudentAccountCreationHarness({ studentId }: { studentId: string }) {
  void studentId;
  const { managedAccounts } = useAppState();

  return (
    <div>
      <button type="button">Check managed account creation</button>
      <p>Harness managed accounts: {managedAccounts.length}</p>
    </div>
  );
}

function ManagedAccountDoubleCreateHarness() {
  const state = useAppState() as unknown as { createManagedAccount?: unknown };
  const { accountRoles, managedAccounts } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => setReturnMatch(state.createManagedAccount === undefined ? "retired" : "available")}
      >
        Check managed account creation
      </button>
      <p>Harness duplicate managed returns: {returnMatch}</p>
      <p>Harness duplicate managed accounts: {managedAccounts.length}</p>
      <p>Harness duplicate managed roles: {accountRoles.length}</p>
    </div>
  );
}

function ImmediateManagedAccountLoginHarness() {
  const state = useAppState() as unknown as { loginManagedAccount?: unknown };
  const { session } = useAppState();
  const [loginHelper, setLoginHelper] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => setLoginHelper(state.loginManagedAccount === undefined ? "retired" : "available")}
      >
        Check managed account login
      </button>
      <p>Harness managed login helper: {loginHelper}</p>
      <p>Harness session email: {session?.email ?? "none"}</p>
    </div>
  );
}

function ChildAccountDoubleCreateHarness() {
  const { accountRoles, addChildAccount, childAccounts } = useAppState();
  const [returnMatch, setReturnMatch] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstChild = addChildAccount({
            name: "Kai Cho",
            age: "7",
            beltSlug: "yellow",
            username: "kai cho",
            password: "Dragon123"
          });
          const secondChild = addChildAccount({
            name: " Kai Cho ",
            age: " 7 ",
            beltSlug: "yellow",
            username: " Kai Cho ",
            password: " Dragon123 "
          });
          setReturnMatch(firstChild && secondChild && firstChild.id === secondChild.id ? "same" : "different");
        }}
      >
        Create child account twice
      </button>
      <p>Harness duplicate child returns: {returnMatch}</p>
      <p>Harness duplicate child accounts: {childAccounts.length}</p>
      <p>Harness duplicate child roles: {accountRoles.length}</p>
    </div>
  );
}

function EmptyCheckoutHarness() {
  const { orders, placeOrder } = useAppState();
  const customer = {
    firstName: "Ari",
    lastName: "Nguyen",
    email: "ari@example.com",
    phone: "(262) 555-0101",
    address: "N89W16863 Appleton Ave",
    city: "Menomonee Falls",
    state: "WI",
    zip: "53051"
  };

  return (
    <div>
      <button type="button" onClick={() => placeOrder(customer, "Empty cart attempt")}>
        Place empty order
      </button>
      <p>Harness orders: {orders.length}</p>
    </div>
  );
}

function CheckoutDoubleSubmitHarness() {
  const { cart, orders, placeOrder } = useAppState();
  const [returnOrders, setReturnOrders] = useState("none");
  const customer = {
    firstName: "Ari",
    lastName: "Nguyen",
    email: "ari@example.com",
    phone: "(262) 555-0101",
    address: "N89W16863 Appleton Ave",
    city: "Menomonee Falls",
    state: "WI",
    zip: "53051"
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstOrder = placeOrder(customer, "Pickup after class");
          const secondOrder = placeOrder(customer, "Pickup after class");
          setReturnOrders(`${firstOrder?.orderNumber ?? "none"},${secondOrder?.orderNumber ?? "none"}`);
        }}
      >
        Place order twice
      </button>
      <p>Harness checkout returns: {returnOrders}</p>
      <p>Harness checkout orders: {orders.length}</p>
      <p>Harness checkout cart items: {cart.length}</p>
    </div>
  );
}

function CartQuantityHarness() {
  const { addProductToCart, cart, totals } = useAppState();
  const gloveQuantity = cart.find((item) => item.productSlug === "youth-6oz-boxing-gloves")?.quantity ?? 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addProductToCart("youth-6oz-boxing-gloves", 1);
          addProductToCart("youth-6oz-boxing-gloves", -3);
          addProductToCart("white-basic-uniform-w-patches-and-logo", 0);
        }}
      >
        Add invalid cart quantities
      </button>
      <p>Harness cart items: {cart.length}</p>
      <p>Harness glove quantity: {gloveQuantity}</p>
      <p>Harness subtotal: {totals.subtotal}</p>
    </div>
  );
}

function CartQuantityUpdateHarness() {
  const { addProductToCart, cart, totals, updateCartQuantity } = useAppState();
  const gloveItem = cart.find((item) => item.productSlug === "youth-6oz-boxing-gloves");

  return (
    <div>
      <button type="button" onClick={() => addProductToCart("youth-6oz-boxing-gloves", 2)}>
        Add valid cart item
      </button>
      <button type="button" onClick={() => updateCartQuantity(gloveItem?.id ?? "missing-cart-item", Number.NaN)}>
        Apply invalid cart update
      </button>
      <p>Harness update items: {cart.length}</p>
      <p>Harness update quantity: {gloveItem?.quantity ?? 0}</p>
      <p>Harness update subtotal: {totals.subtotal}</p>
    </div>
  );
}

function BookingPartySizeHarness() {
  const { addBookingToCart, bookings, cart, totals } = useAppState();
  const booking = { date: "2026-06-12", time: "4:30 PM", timezone: "America/Chicago" as const };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addBookingToCart({ ...booking, persons: 0 });
          addBookingToCart({ ...booking, persons: -2 });
          addBookingToCart({ ...booking, persons: Number.NaN });
          addBookingToCart({ ...booking, persons: 1.5 });
          addBookingToCart({ ...booking, persons: 2 });
        }}
      >
        Add invalid starter bookings
      </button>
      <p>Harness booking cart items: {cart.length}</p>
      <p>Harness saved bookings: {bookings.length}</p>
      <p>Harness booking subtotal: {totals.subtotal}</p>
    </div>
  );
}

function DirectBookingSaveHarness() {
  const { bookings, saveBooking } = useAppState();
  const booking = { date: "2026-06-12", time: "4:30 PM", timezone: "America/Chicago" as const };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          saveBooking({ ...booking, persons: 0 });
          saveBooking({ ...booking, persons: Number.NaN });
          saveBooking({ ...booking, persons: 1.5 });
          saveBooking({ ...booking, persons: 2, date: "" });
          saveBooking({ ...booking, persons: 2, time: "" });
          saveBooking({ ...booking, persons: 2 });
        }}
      >
        Save invalid direct bookings
      </button>
      <p>Harness direct bookings: {bookings.length}</p>
    </div>
  );
}

function DirectBookingDoubleSaveHarness() {
  const { bookings, saveBooking } = useAppState();
  const booking = { persons: 2, date: "2026-06-12", time: "4:30 PM", timezone: "America/Chicago" as const };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          saveBooking(booking);
          saveBooking({ ...booking, date: " 2026-06-12 ", time: " 4:30 PM " });
        }}
      >
        Save booking twice
      </button>
      <p>Harness direct duplicate bookings: {bookings.length}</p>
    </div>
  );
}

function BookingDoubleAddHarness() {
  const { addBookingToCart, bookings, cart, totals } = useAppState();
  const booking = { persons: 2, date: "2026-06-12", time: "4:30 PM", timezone: "America/Chicago" as const };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addBookingToCart(booking);
          addBookingToCart({ ...booking, date: " 2026-06-12 ", time: " 4:30 PM " });
        }}
      >
        Add starter booking twice
      </button>
      <p>Harness duplicate booking cart items: {cart.length}</p>
      <p>Harness duplicate saved bookings: {bookings.length}</p>
      <p>Harness duplicate booking subtotal: {totals.subtotal}</p>
    </div>
  );
}

function ProductThenBookingAddHarness() {
  const { addBookingToCart, addProductToCart, bookings, cart, totals } = useAppState();
  const booking = { persons: 2, date: "2026-06-12", time: "4:30 PM", timezone: "America/Chicago" as const };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addProductToCart("youth-6oz-boxing-gloves", 1);
          addBookingToCart(booking);
        }}
      >
        Add product then starter booking
      </button>
      <p>Harness mixed cart items: {cart.length}</p>
      <p>Harness mixed saved bookings: {bookings.length}</p>
      <p>Harness mixed cart subtotal: {totals.subtotal}</p>
    </div>
  );
}

function RestoreBackupSessionHarness({ backup }: { backup: ReturnType<typeof buildOperationsBackupSnapshot> }) {
  const { restoreOperationsBackup, session } = useAppState();

  return (
    <div>
      <button type="button" onClick={() => restoreOperationsBackup(JSON.stringify(backup))}>
        Restore backup harness
      </button>
      <p>Harness session email: {session?.email ?? "none"}</p>
    </div>
  );
}

function RestoreAndSendMissedClassHarness({ backup, studentId }: { backup: ReturnType<typeof buildOperationsBackupSnapshot>; studentId: string }) {
  const { messageLogs, restoreOperationsBackup, sendMissedClassFollowUps, students } = useAppState();
  const [returnCount, setReturnCount] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          restoreOperationsBackup(JSON.stringify(backup));
          setReturnCount(String(sendMissedClassFollowUps()));
        }}
      >
        Restore and send missed follow-ups
      </button>
      <p>Harness restored missed status: {student?.status ?? "missing"}</p>
      <p>Harness restored missed return count: {returnCount}</p>
      <p>Harness restored missed messages: {messageLogs.length}</p>
      <p>Harness restored missed last contacted: {student?.lastContactedAt ?? "none"}</p>
    </div>
  );
}

function DirectContactSaveHarness() {
  const { contacts, saveContact } = useAppState();
  const contact = {
    id: "contact-valid",
    name: "Ari Nguyen",
    email: "",
    phone: "(262) 555-0101",
    message: "Interested in the starter program.",
    createdAt: "2026-06-02T10:00:00.000Z"
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          saveContact({ ...contact, id: "contact-missing-name", name: "" });
          saveContact({ ...contact, id: "contact-missing-method", email: "", phone: "" });
          saveContact({ ...contact, id: "contact-missing-message", message: "" });
          saveContact(contact);
        }}
      >
        Save invalid direct contacts
      </button>
      <p>Harness direct contacts: {contacts.length}</p>
    </div>
  );
}

function DirectContactDoubleSaveHarness() {
  const { contacts, saveContact } = useAppState();
  const contact = {
    id: "contact-first",
    name: "Ari Nguyen",
    email: "ari@example.com",
    phone: "(262) 555-0101",
    message: "Interested in the starter program.",
    createdAt: "2026-06-02T10:00:00.000Z"
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          saveContact(contact);
          saveContact({
            ...contact,
            id: "contact-second",
            name: " Ari Nguyen ",
            email: " ARI@example.com ",
            phone: "2625550101",
            message: " Interested in the starter program. ",
            createdAt: "2026-06-02T10:00:01.000Z"
          });
        }}
      >
        Save contact twice
      </button>
      <p>Harness duplicate contacts: {contacts.length}</p>
    </div>
  );
}

function DirectMessageRecipientHarness() {
  const { directMessages, sendDirectMessage } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          sendDirectMessage({
            senderId: "direct-staff-seed",
            senderName: "Cho's Manager",
            recipientId: "student-inactive",
            recipientName: "Cora Miles",
            body: "Inactive student should not receive this."
          });
          sendDirectMessage({
            senderId: "direct-staff-seed",
            senderName: "Cho's Manager",
            recipientId: "parent-student-inactive",
            recipientName: "Inactive Parent",
            body: "Inactive parent should not receive this."
          });
          sendDirectMessage({
            senderId: "direct-staff-seed",
            senderName: "Cho's Manager",
            recipientId: "student-active",
            recipientName: "Ari Nguyen",
            body: "Active student should receive this."
          });
        }}
      >
        Send inactive direct messages
      </button>
      <p>Harness direct messages: {directMessages.length}</p>
    </div>
  );
}

function DirectMessageSenderHarness() {
  const { directMessages, sendDirectMessage } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          sendDirectMessage({
            senderId: "student-inactive",
            senderName: "Cora Miles",
            recipientId: "direct-staff-seed",
            recipientName: "Cho's Manager",
            body: "Inactive student should not send this."
          });
          sendDirectMessage({
            senderId: "student-missing",
            senderName: "Missing Student",
            recipientId: "direct-staff-seed",
            recipientName: "Cho's Manager",
            body: "Unknown student should not send this."
          });
          sendDirectMessage({
            senderId: "student-active",
            senderName: "Ari Nguyen",
            recipientId: "direct-staff-seed",
            recipientName: "Cho's Manager",
            body: "Active student should send this."
          });
        }}
      >
        Send invalid sender direct messages
      </button>
      <p>Harness sender direct messages: {directMessages.length}</p>
    </div>
  );
}

function DirectMessageDoubleSendHarness() {
  const { directMessages, sendDirectMessage } = useAppState();
  const [returnNames, setReturnNames] = useState("none");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const firstMessage = sendDirectMessage({
            senderId: "direct-staff-seed",
            senderName: "Cho's Manager",
            recipientId: "student-active",
            recipientName: "Ari Nguyen",
            body: "See you at class tonight."
          });
          const secondMessage = sendDirectMessage({
            senderId: "direct-staff-seed",
            senderName: "Cho's Manager",
            recipientId: "student-active",
            recipientName: "Ari Nguyen",
            body: "See you at class tonight."
          });
          setReturnNames(`${firstMessage?.recipientName ?? "none"},${secondMessage?.recipientName ?? "none"}`);
        }}
      >
        Send direct message twice
      </button>
      <p>Harness direct return names: {returnNames}</p>
      <p>Harness direct sent messages: {directMessages.length}</p>
    </div>
  );
}

function DeactivateAndSendDirectMessageHarness({ studentId }: { studentId: string }) {
  const { directMessages, sendDirectMessage, students, updateOperationsStudent } = useAppState();
  const [returnName, setReturnName] = useState("none");
  const student = students.find((item) => item.id === studentId);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          updateOperationsStudent(studentId, {
            fullName: "Ari Nguyen",
            studentEmail: "ari@example.com",
            guardianName: "Family Contact",
            guardianPhone: "(262) 555-0100",
            status: "Inactive",
            beltRank: "Yellow"
          });
          const sentMessage = sendDirectMessage({
            senderId: "direct-staff-seed",
            senderName: "Cho's Manager",
            recipientId: studentId,
            recipientName: "Ari Nguyen",
            body: "Ari should not receive this after deactivation."
          });
          setReturnName(sentMessage?.recipientName ?? "none");
        }}
      >
        Deactivate and send direct message
      </button>
      <p>Harness direct student status: {student?.status ?? "missing"}</p>
      <p>Harness direct send return: {returnName}</p>
      <p>Harness direct sent count: {directMessages.length}</p>
    </div>
  );
}

function DirectStudyMaterialSafetyHarness() {
  const { addStudyGuideMaterial, studyGuideMaterials } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addStudyGuideMaterial({
            title: "Unsafe HTML",
            folderId: "study-folder-existing",
            fileName: "unsafe.html",
            mimeType: "text/html",
            size: 128,
            fileDataUrl: "data:text/html,<script>alert(1)</script>"
          });
          addStudyGuideMaterial({
            title: "Unsafe SVG",
            folderId: "study-folder-existing",
            fileName: "unsafe.svg",
            mimeType: "image/svg+xml",
            size: 128,
            fileDataUrl: "data:image/svg+xml,<svg><script>alert(1)</script></svg>"
          });
          addStudyGuideMaterial({
            title: "Front Kick Checklist",
            folderId: "study-folder-existing",
            fileName: "front-kick-checklist.pdf",
            mimeType: "application/pdf",
            size: 1024,
            fileDataUrl: "data:application/pdf;base64,Zm9vdHdvcms="
          });
        }}
      >
        Publish unsafe study materials
      </button>
      <p>Harness study materials: {studyGuideMaterials.length}</p>
    </div>
  );
}

function DirectTrainingVideoSafetyHarness() {
  const { addTrainingVideo, trainingVideos } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addTrainingVideo({
            title: "Mismatched HTML Video",
            folderId: "video-folder-existing",
            fileName: "unsafe.html",
            mimeType: "text/html",
            size: 128,
            videoDataUrl: "data:video/mp4;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="
          });
          addTrainingVideo({
            title: "Unsupported SVG Video",
            folderId: "video-folder-existing",
            fileName: "unsafe.svg",
            mimeType: "video/svg+xml",
            size: 128,
            videoDataUrl: "data:video/svg+xml,<svg><script>alert(1)</script></svg>"
          });
          addTrainingVideo({
            title: "Roundhouse Basics",
            folderId: "video-folder-existing",
            fileName: "roundhouse-demo.mp4",
            mimeType: "video/mp4",
            size: 2048,
            videoDataUrl: "data:video/mp4;base64,cm91bmRob3VzZQ=="
          });
        }}
      >
        Publish unsafe training videos
      </button>
      <p>Harness training videos: {trainingVideos.length}</p>
    </div>
  );
}

function ChildUsernameCollisionHarness() {
  const { addChildAccount, childAccounts } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addChildAccount({ name: "Prototype Manager Collision", age: "9", beltSlug: "white", username: "manager123", password: "Dragon123" });
          addChildAccount({ name: "Managed Staff Collision", age: "9", beltSlug: "white", username: "jordan.staff", password: "Dragon123" });
          addChildAccount({ name: "Kai Cho", age: "7", beltSlug: "yellow", username: "kai-cho.child", password: "Dragon123" });
        }}
      >
        Save child username collisions
      </button>
      <p>Harness child accounts: {childAccounts.length}</p>
    </div>
  );
}

function ChildLoginOwnershipHarness({ childId }: { childId: string }) {
  const { loginChildAccount, session } = useAppState();

  return (
    <div>
      <button type="button" onClick={() => loginChildAccount(childId)}>
        Open child side by id
      </button>
      <p>Harness session email: {session?.email ?? "none"}</p>
    </div>
  );
}

function ImmediateChildLoginHandoffHarness() {
  const { addChildAccount, loginChildAccount, session } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const child = addChildAccount({
            name: "Kai Cho",
            age: "7",
            beltSlug: "yellow",
            username: "kai cho",
            password: "Dragon123"
          });
          if (child) loginChildAccount(child.id);
        }}
      >
        Create and open child side
      </button>
      <p>Harness session email: {session?.email ?? "none"}</p>
    </div>
  );
}

function ImmediateChildCredentialLoginHarness() {
  const { addChildAccount, loginChildCredentials, session } = useAppState();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const child = addChildAccount({
            name: "Kai Cho",
            age: "7",
            beltSlug: "yellow",
            username: "kai cho",
            password: "Dragon123"
          });
          if (child) {
            loginChildCredentials({
              username: "Kai Cho",
              password: "Dragon123"
            });
          }
        }}
      >
        Create and sign in child credentials
      </button>
      <p>Harness session email: {session?.email ?? "none"}</p>
    </div>
  );
}

describe("login landing", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetDocumentTheme();
    window.scrollTo = vi.fn();
    stubMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the centered portrait blend image on the login screen", () => {
    const { container } = renderLoggedOutApp("/");

    const portrait = container.querySelector(".login-portrait-stage img");
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(portrait).toHaveAttribute("src", "/Perfect1.png");
    expect(portrait?.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("anchors the portrait bottom slightly under the username field", async () => {
    const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("login-field")) {
        return { bottom: 568, height: 48, left: 24, right: 360, top: 520, width: 336, x: 24, y: 520, toJSON: () => ({}) } as DOMRect;
      }
      if (this.classList.contains("login-portrait-stage")) {
        return { bottom: 581, height: 412, left: 23, right: 353, top: 169, width: 330, x: 23, y: 169, toJSON: () => ({}) } as DOMRect;
      }
      return { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });

    try {
      const { container } = renderLoggedOutApp("/");
      const landing = container.querySelector(".login-landing") as HTMLElement;

      await waitFor(() => {
        expect(landing.style.getPropertyValue("--login-portrait-anchor-y")).toBe("373.52px");
      });
    } finally {
      getBoundingClientRect.mockRestore();
    }
  });

  it("renders logged-out users inside the portrait app shell", () => {
    const { container } = renderLoggedOutApp("/");

    const shell = screen.getByTestId("portrait-app-shell");
    expect(shell).toHaveAttribute("data-orientation-lock", "portrait");
    expect(shell).toHaveAttribute("aria-label", "Cho's Martial Arts portrait app frame");
    expect(within(shell).getByTestId("auth-gate")).toBeInTheDocument();
    expect(container.querySelector(".portrait-app-frame .auth-gate")).toBeInTheDocument();
  });

  it("keeps the front login screen free of the parent login section", () => {
    renderLoggedOutApp("/");

    expect(screen.queryByRole("heading", { name: "Parent Login" })).not.toBeInTheDocument();
    expect(screen.queryByText("Start here if you are helping a child get set up for class.")).not.toBeInTheDocument();
    expect(screen.queryByText("Parent demo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Demo" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
  });

  it("opens a Login failed popup when required login fields are missing", () => {
    renderLoggedOutApp("/");

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    const dialog = screen.getByRole("dialog", { name: "Login failed" });
    expect(within(dialog).getByRole("heading", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Try Again" }));
    expect(screen.queryByRole("dialog", { name: "Login failed" })).not.toBeInTheDocument();
  });

  it("signs the prototype manager credential directly into staff mode on Live Chat without post-login popups", async () => {
    const { container } = renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Manager123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: prototypeManagerLogin.password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(container.querySelector(".authenticated-app-shell")).toHaveClass("is-login-transitioning");
    expect(await screen.findByLabelText("Live chat room page")).toBeInTheDocument();
    expect(screen.queryByLabelText("Profile page header")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Account type" })).not.toBeInTheDocument();
    expect(screen.queryByText("Signed in to Cho's manager prototype.")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "manager123@chos.prototype", remembered: true });
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toContainEqual({ email: "manager123@chos.prototype", role: "staff" });
  });

  it("keeps unknown credentials on the login screen without granting staff access", () => {
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "not-manager" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    const dialog = screen.getByRole("dialog", { name: "Login failed" });
    expect(within(dialog).getByRole("heading", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.accountRoles.v1")).toBeNull();
  });

  it("keeps the prototype manager username on the login screen when the password is wrong", () => {
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Manager123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByRole("dialog", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.accountRoles.v1")).toBeNull();
  });

  it("does not sign in saved staff accounts through the public login", () => {
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "staff-created-login",
        displayName: "Jordan Lee",
        username: "jordan.staff",
        password: "StaffPass123",
        role: "staff",
        status: "active",
        access: ["create"],
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "jordan.staff" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByRole("dialog", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).not.toContainEqual({ email: "jordan.staff", role: "staff" });
  });

  it("rejects the retired prototype student credential at login", () => {
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Student123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: prototypeManagerLogin.password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByRole("dialog", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByLabelText("Student profile page")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.accountRoles.v1")).toBeNull();
  });

  it("rejects the retired prototype parent credential at login", () => {
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Parent123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: prototypeManagerLogin.password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByRole("dialog", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByLabelText("Parent profile page")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.accountRoles.v1")).toBeNull();
  });

  it("keeps the public login limited to credential sign-in", () => {
    renderLoggedOutApp("/");

    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create New Account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in as Guest" })).not.toBeInTheDocument();
  });

  it("signs the gated developer credential into owner mode on Live Chat", async () => {
    vi.stubEnv("VITE_ENABLE_DEVELOPER_ACCOUNT", "true");
    const { container } = renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Dev123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: prototypeDeveloperLogin.password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(container.querySelector(".authenticated-app-shell")).toHaveClass("is-login-transitioning");
    expect(await screen.findByLabelText("Live chat room page")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "dev123@chos.prototype", remembered: true });
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toContainEqual({ email: "dev123@chos.prototype", role: "staff" });
  });

  it("keeps the developer credential disabled unless the dev account flag is enabled", () => {
    vi.stubEnv("VITE_ENABLE_DEVELOPER_ACCOUNT", "");
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Dev123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: prototypeDeveloperLogin.password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByRole("dialog", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.accountRoles.v1")).toBeNull();
  });

  it("keeps the developer username on the login screen when the password is wrong", () => {
    vi.stubEnv("VITE_ENABLE_DEVELOPER_ACCOUNT", "true");
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Dev123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "StaffPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByRole("dialog", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.localStorage.getItem("chos.accountRoles.v1")).toBeNull();
  });

  it("does not sign in stored registered account records through the public login", () => {
    window.localStorage.setItem("chos.accounts.v1", JSON.stringify([
      {
        email: "returning.family@example.com",
        password: "FamilyPass123",
        role: "guardian",
        createdAt: "2026-06-01T09:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "returning.family@example.com", role: "guardian" }]));
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "returning.family@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "FamilyPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByRole("dialog", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByLabelText("Parent profile page")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("does not sign in stored child account records through the public login", () => {
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([
      {
        id: "child-created-login",
        parentEmail: "parent123@chos.prototype",
        name: "Kai Cho",
        username: "kai-cho.child",
        password: "Dragon123",
        age: "7",
        beltSlug: "yellow",
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "kai-cho.child" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "Dragon123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByRole("dialog", { name: "Login failed" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByLabelText("Student profile page")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("clears refreshed guest sessions on startup", () => {
    seedActiveSession({ email: "guest@chos.prototype", remembered: false, createdAt: "2026-05-16T00:00:00.000Z" });
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "guest@chos.prototype", role: "staff" }]));

    renderLoggedOutApp("/");

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in as Guest" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.sessionStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("clears refreshed registered guardian sessions on startup", () => {
    window.localStorage.setItem("chos.accounts.v1", JSON.stringify([
      {
        email: "returning.family@example.com",
        password: "FamilyPass123",
        role: "guardian",
        createdAt: "2026-06-01T09:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "returning.family@example.com", role: "guardian" }]));
    seedActiveSession({ email: "returning.family@example.com", remembered: true, createdAt: "2026-06-01T09:05:00.000Z" });

    renderLoggedOutApp("/");

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByLabelText("Parent profile page")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.sessionStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("clears refreshed child sessions on startup", () => {
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([
      {
        id: "child-kai",
        parentEmail: "parent123@chos.prototype",
        name: "Kai Cho",
        age: "9",
        beltSlug: "white",
        username: "kai-cho.child",
        password: "Dragon123",
        createdAt: "2026-06-01T09:00:00.000Z"
      }
    ]));
    seedActiveSession({ email: "kai-cho.child", remembered: true, createdAt: "2026-06-01T09:05:00.000Z" });

    renderLoggedOutApp("/");

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByLabelText("Student profile page")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.sessionStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("clears refreshed active staff managed sessions on startup", () => {
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-staff-session",
        displayName: "Jordan Lee",
        username: "jordan.staff",
        password: "StaffPass123",
        role: "staff",
        status: "active",
        access: ["reports"],
        createdAt: "2026-06-01T09:00:00.000Z"
      }
    ]));
    seedActiveSession({ email: "jordan.staff", remembered: true, createdAt: "2026-06-01T09:05:00.000Z" });

    renderLoggedOutApp("/");

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.queryByLabelText("Live chat room page")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(window.sessionStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("keeps a refreshed Manager123 session on Live Chat", () => {
    seedActiveSession({ email: "manager123@chos.prototype", remembered: true, createdAt: "2026-05-16T00:00:00.000Z" });
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "manager123@chos.prototype", role: "staff" }]));

    renderLoggedOutApp("/");

    expect(screen.queryByTestId("auth-gate")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Live chat room page")).toBeInTheDocument();
    expect(screen.queryByLabelText("Profile page header")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "manager123@chos.prototype", remembered: true });
  });

  it("keeps the portrait available on the reduced-motion login screen", () => {
    stubMatchMedia(true);
    const { container } = renderLoggedOutApp("/");

    expect(container.querySelector(".auth-logo")).toHaveClass("is-settled");
    expect(container.querySelector(".login-portrait-stage img")).toHaveAttribute("src", "/Perfect1.png");
  });

  it("keeps only the portrait visibility toggle on the login screen", () => {
    renderLoggedOutApp("/");

    expect(screen.getByRole("button", { name: "Hide portrait background" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Choose portrait background" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Perfect1.png portrait background" })).not.toBeInTheDocument();
  });

  it("toggles the portrait blend image on and off from the login screen", () => {
    const { container } = renderLoggedOutApp("/");

    expect(container.querySelector(".login-portrait-stage img")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide portrait background" }));
    expect(container.querySelector(".login-portrait-stage img")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show portrait background" }));
    expect(container.querySelector(".login-portrait-stage img")).toBeInTheDocument();
  });

  it("keeps the portrait toggle above the launch handoff overlay", () => {
    const { container } = renderLoggedOutApp("/");

    expect(screen.getByRole("button", { name: "Hide portrait background" })).toBeInTheDocument();
    expect(container.querySelector(".launch-loader")).toBeInTheDocument();
    expect(container.querySelector(".login-portrait-toggle")).toHaveClass("is-above-launch");
  });
});

describe("app fullscreen behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetDocumentTheme();
    window.scrollTo = vi.fn();
    stubMatchMedia();
    stubUnsupportedScreenOrientation();
  });

  it("requests fullscreen on the first app interaction when supported", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });

    renderLoggedOutApp("/");
    fireEvent.pointerDown(document);

    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
  });

  it("locks supported screens to portrait after the first app interaction", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const lock = stubScreenOrientationLock(vi.fn().mockResolvedValue(undefined));
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });

    renderLoggedOutApp("/");
    fireEvent.pointerDown(document);

    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(lock).toHaveBeenCalledWith("portrait"));
  });

  it("does not request fullscreen again while already fullscreen", () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });

    renderLoggedOutApp("/");
    fireEvent.pointerDown(document);

    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("keeps login usable when portrait orientation locking is rejected", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const lock = stubScreenOrientationLock(vi.fn().mockRejectedValue(new Error("Orientation lock blocked")));
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });

    renderLoggedOutApp("/");
    fireEvent.pointerDown(document);

    await waitFor(() => expect(lock).toHaveBeenCalledWith("portrait"));
    expect(screen.queryByRole("button", { name: "Sign in as Guest" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Manager123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: prototypeManagerLogin.password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByLabelText("Live chat room page")).toBeInTheDocument();
  });
});

describe("post-login operations app", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetDocumentTheme();
    window.scrollTo = vi.fn();
    stubMatchMedia();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("does not create an order when checkout is submitted with an empty cart", async () => {
    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <AppStateProvider>
          <EmptyCheckoutHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Place empty order" }));

    await waitFor(() => {
      expect(screen.getByText("Harness orders: 0")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.orders.v1") ?? "[]")).toEqual([]);
      expect(window.localStorage.getItem("chos.cart.v1")).toBeNull();
    });
  });

  it("keeps checkout order placement idempotent when submit fires twice before rerender", async () => {
    window.localStorage.setItem("chos.orders.v1", JSON.stringify([]));
    window.localStorage.setItem(
      "chos.cart.v1",
      JSON.stringify([
        {
          id: "cart-gloves",
          productSlug: "youth-6oz-boxing-gloves",
          name: "Youth 6oz boxing gloves",
          unitPrice: 39,
          displayPrice: "$39.00",
          quantity: 1
        }
      ])
    );

    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <AppStateProvider>
          <CheckoutDoubleSubmitHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Place order twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness checkout returns: CHOS-2026-0001,none")).toBeInTheDocument();
      expect(screen.getByText("Harness checkout orders: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness checkout cart items: 0")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.orders.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          orderNumber: "CHOS-2026-0001",
          subtotal: 39,
          items: [expect.objectContaining({ productSlug: "youth-6oz-boxing-gloves", quantity: 1 })]
        })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.cart.v1") ?? "[]")).toEqual([]);
    });
  });

  it("ignores zero and negative product quantities when adding to cart", async () => {
    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AppStateProvider>
          <CartQuantityHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add invalid cart quantities" }));

    await waitFor(() => {
      expect(screen.getByText("Harness cart items: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness glove quantity: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness subtotal: 39")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.cart.v1") ?? "[]")).toEqual([
        expect.objectContaining({ productSlug: "youth-6oz-boxing-gloves", quantity: 1 })
      ]);
    });
  });

  it("ignores non-finite cart quantity updates", async () => {
    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AppStateProvider>
          <CartQuantityUpdateHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add valid cart item" }));

    await waitFor(() => {
      expect(screen.getByText("Harness update items: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness update quantity: 2")).toBeInTheDocument();
      expect(screen.getByText("Harness update subtotal: 78")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Apply invalid cart update" }));

    await waitFor(() => {
      expect(screen.getByText("Harness update items: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness update quantity: 2")).toBeInTheDocument();
      expect(screen.getByText("Harness update subtotal: 78")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.cart.v1") ?? "[]")).toEqual([
        expect.objectContaining({ productSlug: "youth-6oz-boxing-gloves", quantity: 2 })
      ]);
    });
  });

  it("ignores invalid starter booking party sizes", async () => {
    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AppStateProvider>
          <BookingPartySizeHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add invalid starter bookings" }));

    await waitFor(() => {
      expect(screen.getByText("Harness booking cart items: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness saved bookings: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness booking subtotal: 59.9")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.bookings.v1") ?? "[]")).toEqual([
        expect.objectContaining({ persons: 2, date: "2026-06-12", time: "4:30 PM" })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.cart.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          productSlug: "starter-program",
          quantity: 1,
          unitPrice: 59.9,
          booking: expect.objectContaining({ persons: 2 })
        })
      ]);
    });
  });

  it("ignores invalid direct booking saves", async () => {
    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AppStateProvider>
          <DirectBookingSaveHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save invalid direct bookings" }));

    await waitFor(() => {
      expect(screen.getByText("Harness direct bookings: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.bookings.v1") ?? "[]")).toEqual([
        expect.objectContaining({ persons: 2, date: "2026-06-12", time: "4:30 PM", timezone: "America/Chicago" })
      ]);
    });
  });

  it("keeps direct starter booking saves idempotent when the same booking fires twice before rerender", async () => {
    window.localStorage.setItem("chos.bookings.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AppStateProvider>
          <DirectBookingDoubleSaveHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save booking twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness direct duplicate bookings: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.bookings.v1") ?? "[]")).toEqual([
        expect.objectContaining({ persons: 2, date: "2026-06-12", time: "4:30 PM", timezone: "America/Chicago" })
      ]);
    });
  });

  it("keeps starter booking cart adds idempotent when the same booking fires twice before rerender", async () => {
    window.localStorage.setItem("chos.bookings.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.cart.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AppStateProvider>
          <BookingDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add starter booking twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate booking cart items: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate saved bookings: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate booking subtotal: 59.9")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.bookings.v1") ?? "[]")).toEqual([
        expect.objectContaining({ persons: 2, date: "2026-06-12", time: "4:30 PM", timezone: "America/Chicago" })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.cart.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          productSlug: "starter-program",
          quantity: 1,
          unitPrice: 59.9,
          booking: expect.objectContaining({ persons: 2, date: "2026-06-12", time: "4:30 PM" })
        })
      ]);
    });
  });

  it("keeps product and starter booking cart adds together when they fire before rerender", async () => {
    window.localStorage.setItem("chos.bookings.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.cart.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AppStateProvider>
          <ProductThenBookingAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add product then starter booking" }));

    await waitFor(() => {
      expect(screen.getByText("Harness mixed cart items: 2")).toBeInTheDocument();
      expect(screen.getByText("Harness mixed saved bookings: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness mixed cart subtotal: 98.9")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.cart.v1") ?? "[]")).toEqual([
        expect.objectContaining({ productSlug: "youth-6oz-boxing-gloves", quantity: 1, unitPrice: 39 }),
        expect.objectContaining({
          productSlug: "starter-program",
          quantity: 1,
          unitPrice: 59.9,
          booking: expect.objectContaining({ persons: 2, date: "2026-06-12", time: "4:30 PM" })
        })
      ]);
    });
  });

  it("ignores invalid direct contact saves", async () => {
    render(
      <MemoryRouter initialEntries={["/contact-us"]}>
        <AppStateProvider>
          <DirectContactSaveHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save invalid direct contacts" }));

    await waitFor(() => {
      expect(screen.getByText("Harness direct contacts: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.contacts.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          id: "contact-valid",
          name: "Ari Nguyen",
          phone: "(262) 555-0101",
          message: "Interested in the starter program."
        })
      ]);
    });
  });

  it("keeps public contact saves idempotent when the same inquiry fires twice before rerender", async () => {
    window.localStorage.setItem("chos.contacts.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/contact-us"]}>
        <AppStateProvider>
          <DirectContactDoubleSaveHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save contact twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate contacts: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.contacts.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          id: "contact-first",
          name: "Ari Nguyen",
          email: "ari@example.com",
          phone: "(262) 555-0101",
          message: "Interested in the starter program."
        })
      ]);
    });
  });

  it("does not send direct messages to inactive student recipients from direct state calls", async () => {
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-active",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-inactive",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        guardianName: "Inactive Parent",
        guardianPhone: "(262) 555-0112",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));
    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <DirectMessageRecipientHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Send inactive direct messages" }));

    await waitFor(() => {
      expect(screen.getByText("Harness direct messages: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toEqual([
        expect.objectContaining({ recipientId: "student-active", recipientName: "Ari Nguyen", body: "Active student should receive this." })
      ]);
    });
  });

  it("does not send direct messages from inactive or missing student senders", async () => {
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-active",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-inactive",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));
    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <DirectMessageSenderHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Send invalid sender direct messages" }));

    await waitFor(() => {
      expect(screen.getByText("Harness sender direct messages: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toEqual([
        expect.objectContaining({ senderId: "student-active", senderName: "Ari Nguyen", body: "Active student should send this." })
      ]);
    });
  });

  it("does not send direct messages to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <DeactivateAndSendDirectMessageHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send direct message" }));

    await waitFor(() => {
      expect(screen.getByText("Harness direct student status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness direct send return: none")).toBeInTheDocument();
      expect(screen.getByText("Harness direct sent count: 0")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "student-ari", status: "Inactive" })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("keeps direct app messages idempotent when the same send fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-active",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <DirectMessageDoubleSendHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Send direct message twice" }));

    expect(await screen.findByText("Harness direct return names: Ari Nguyen,Ari Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Harness direct sent messages: 1")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        senderId: "direct-staff-seed",
        recipientId: "student-active",
        recipientName: "Ari Nguyen",
        body: "See you at class tonight.",
        status: "sent"
      })
    ]);
  });

  it("does not publish unsafe study material files from direct state calls", async () => {
    window.localStorage.setItem("chos.operations.studyGuideFolders.v1", JSON.stringify([
      {
        id: "study-folder-existing",
        name: "White Belt Basics",
        subject: "Foundations",
        createdAt: "2026-06-02T10:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.operations.studyGuideMaterials.v1", JSON.stringify([]));
    render(
      <MemoryRouter initialEntries={["/study-guide"]}>
        <AppStateProvider>
          <DirectStudyMaterialSafetyHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish unsafe study materials" }));

    await waitFor(() => {
      expect(screen.getByText("Harness study materials: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.studyGuideMaterials.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          title: "Front Kick Checklist",
          fileName: "front-kick-checklist.pdf",
          mimeType: "application/pdf",
          fileDataUrl: expect.stringContaining("data:application/pdf")
        })
      ]);
    });
  });

  it("does not publish unsafe training video files from direct state calls", async () => {
    window.localStorage.setItem("chos.operations.videoFolders.v1", JSON.stringify([
      {
        id: "video-folder-existing",
        name: "Forms",
        subject: "Beginner Forms",
        createdAt: "2026-06-02T10:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.operations.videos.v1", JSON.stringify([]));
    render(
      <MemoryRouter initialEntries={["/videos"]}>
        <AppStateProvider>
          <DirectTrainingVideoSafetyHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish unsafe training videos" }));

    await waitFor(() => {
      expect(screen.getByText("Harness training videos: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.videos.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          title: "Roundhouse Basics",
          fileName: "roundhouse-demo.mp4",
          mimeType: "video/mp4",
          videoDataUrl: expect.stringContaining("data:video/mp4")
        })
      ]);
    });
  });

  it.skip("rejects child usernames that collide with prototype or managed logins", async () => {
    seedActiveSession({ email: "parent123@chos.prototype", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "parent123@chos.prototype", role: "guardian" }]));
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-jordan",
        displayName: "Jordan Lee",
        username: "jordan.staff",
        password: "StaffPass123",
        role: "staff",
        status: "active",
        access: ["dashboard", "students"],
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppStateProvider>
          <ChildUsernameCollisionHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save child username collisions" }));

    await waitFor(() => {
      expect(screen.getByText("Harness child accounts: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual([
        expect.objectContaining({ name: "Kai Cho", username: "kai-cho.child", password: "Dragon123" })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([
        { email: "parent123@chos.prototype", role: "guardian" },
        { email: "kai-cho.child", role: "student" }
      ]);
    });
  });

  it.skip("keeps child account creation idempotent when the same child fires twice before rerender", async () => {
    seedActiveSession({ email: "parent123@chos.prototype", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "parent123@chos.prototype", role: "guardian" }]));
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppStateProvider>
          <ChildAccountDoubleCreateHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Create child account twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate child returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate child accounts: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate child roles: 2")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          parentEmail: "parent123@chos.prototype",
          name: "Kai Cho",
          username: "kai-cho",
          password: "Dragon123",
          age: "7",
          beltSlug: "yellow"
        })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([
        { email: "parent123@chos.prototype", role: "guardian" },
        { email: "kai-cho", role: "student" }
      ]);
    });
  });

  it.skip("opens a newly created child account in the same handoff action", async () => {
    seedActiveSession({ email: "parent123@chos.prototype", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "parent123@chos.prototype", role: "guardian" }]));
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppStateProvider>
          <ImmediateChildLoginHandoffHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Create and open child side" }));

    await waitFor(() => {
      expect(screen.getByText("Harness session email: kai-cho")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "kai-cho", remembered: true });
      expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          parentEmail: "parent123@chos.prototype",
          name: "Kai Cho",
          username: "kai-cho"
        })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([
        { email: "parent123@chos.prototype", role: "guardian" },
        { email: "kai-cho", role: "student" }
      ]);
    });
  });

  it.skip("logs into a newly created child account by credentials in the same action", async () => {
    seedActiveSession({ email: "parent123@chos.prototype", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "parent123@chos.prototype", role: "guardian" }]));
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppStateProvider>
          <ImmediateChildCredentialLoginHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Create and sign in child credentials" }));

    await waitFor(() => {
      expect(screen.getByText("Harness session email: kai-cho")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "kai-cho", remembered: true });
      expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          parentEmail: "parent123@chos.prototype",
          name: "Kai Cho",
          username: "kai-cho"
        })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([
        { email: "parent123@chos.prototype", role: "guardian" },
        { email: "kai-cho", role: "student" }
      ]);
    });
  });

  it.skip("does not switch to a child account owned by another parent", async () => {
    seedActiveSession({ email: "parent123@chos.prototype", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" });
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "parent123@chos.prototype", role: "guardian" }]));
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([
      {
        id: "child-other-parent",
        parentEmail: "other.parent@chos.prototype",
        name: "Other Child",
        username: "other-child.child",
        password: "Dragon123",
        age: "8",
        beltSlug: "yellow",
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppStateProvider>
          <ChildLoginOwnershipHarness childId="child-other-parent" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open child side by id" }));

    await waitFor(() => {
      expect(screen.getByText("Harness session email: parent123@chos.prototype")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "parent123@chos.prototype", remembered: true });
      expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([{ email: "parent123@chos.prototype", role: "guardian" }]);
    });
  });

  it("renders authenticated users inside the portrait app shell", () => {
    const { container } = renderLoggedInApp("/");

    const shell = screen.getByTestId("portrait-app-shell");
    expect(shell).toHaveAttribute("data-orientation-lock", "portrait");
    expect(shell).toHaveAttribute("aria-label", "Cho's Martial Arts portrait app frame");
    expect(container.querySelector(".portrait-app-frame .authenticated-app-shell")).toBeInTheDocument();
    expect(screen.getByLabelText("Live chat room page")).toBeInTheDocument();
  });

  it("opens Live Chat first for manager sessions by default", () => {
    renderLoggedInApp("/");

    expect(screen.getByLabelText("Live chat room page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Live Chats" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Profile page header")).not.toBeInTheDocument();
  });

  it.skip("opens the manager Profile page at the explicit profile route", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00-05:00"));
    renderLoggedInApp("/profile");

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    const profileTitleHeader = screen.getByLabelText("Profile page header");
    expect(profileTitleHeader.querySelector(".manager-home-profile-title-frame")).toBeInTheDocument();
    expect(profileTitleHeader.querySelectorAll("svg.manager-home-title-rule-art")).toHaveLength(2);
    expect(profileTitleHeader.querySelector(".manager-home-title-ornament")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manager's Page" })).not.toBeInTheDocument();
    const managerPanelLink = within(profileTitleHeader).getByRole("link", { name: "Manager's Panel" });
    expect(managerPanelLink).toHaveAttribute("href", "/manager");
    expect(managerPanelLink.querySelector("img.manager-home-panel-icon")).toHaveAttribute("src", expect.stringContaining("ManagerPage.webp"));
    expect(within(managerPanelLink).getByText("Manager's Panel")).toBeInTheDocument();
    const liveChatLink = within(profileTitleHeader).getByRole("link", { name: "Live Chat" });
    expect(liveChatLink).toHaveAttribute("href", "/live-chat");
    expect(liveChatLink.querySelector("img.manager-home-live-chat-icon")).toHaveAttribute("src", expect.stringContaining("Messages.webp"));
    expect(within(liveChatLink).getByText("Live Chat")).toBeInTheDocument();
    const homeLogoutButton = within(profileTitleHeader).getByRole("button", { name: "Log Out" });
    expect(homeLogoutButton.querySelector("img.manager-home-logout-icon")).toHaveAttribute("src", expect.stringContaining("ManagerLogoutProfessional.png"));
    expect(within(homeLogoutButton).getByText("Log Out")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Manager's Page" })).not.toBeInTheDocument();
    const homeOverview = screen.getByLabelText("Manager home overview");
    const profileOverview = within(homeOverview).getByLabelText("Manager profile overview");
    const weeklySchedule = within(homeOverview).getByLabelText("Weekly manager schedule");
    expect(profileOverview.compareDocumentPosition(weeklySchedule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(weeklySchedule.compareDocumentPosition(screen.getByLabelText("Messages and event notifications")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(profileOverview).getByRole("img", { name: "Cho's Manager profile portrait" })).toHaveAttribute("src", expect.stringContaining("assets/CheetahProfilePic/Cheetah.png"));
    expect(within(profileOverview).getByRole("heading", { name: "Cho's Manager" })).toBeInTheDocument();
    expect(within(profileOverview).getByText("Head Coach & Manager")).toBeInTheDocument();
    expect(within(profileOverview).getByText("Team: Summer Champions")).toBeInTheDocument();
    expect(within(profileOverview).getByText("Member Since: May 2026")).toBeInTheDocument();
    expect(within(profileOverview).getByText("Team Size: 9 Members")).toBeInTheDocument();
    expect(within(weeklySchedule).getByRole("heading", { name: "May 17 - 23, 2026" })).toBeInTheDocument();
    expect(within(weeklySchedule).getByRole("button", { name: "Select Monday, May 18, 2026" })).toHaveAttribute("aria-pressed", "true");
    expect(within(weeklySchedule).getByText("Monday, May 18, 2026")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Youth Beginners")).toBeInTheDocument();
    fireEvent.click(within(weeklySchedule).getByRole("button", { name: "Next week" }));
    expect(within(weeklySchedule).getByRole("heading", { name: "May 24 - 30, 2026" })).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Color Belt Testing")).toBeInTheDocument();
    const feedPanel = screen.getByLabelText("Messages and event notifications");
    const overviewHandle = screen.getByRole("button", { name: "Collapse manager overview" });
    expect(homeOverview.compareDocumentPosition(overviewHandle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overviewHandle.compareDocumentPosition(feedPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overviewHandle).toHaveAttribute("aria-expanded", "true");
    expect(feedPanel).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Messages & Event Notifications" })).not.toBeInTheDocument();
    expect(screen.queryByText("One clean Home Page feed for every message and event notification.")).not.toBeInTheDocument();
    expect(screen.getByText("5 Messages")).toBeInTheDocument();
    expect(screen.getByText("2 Event Notifications")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search messages and event notifications" })).not.toBeInTheDocument();
    const searchTrigger = screen.getByRole("button", { name: "Open search messages and event notifications" });
    expect(searchTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(searchTrigger);
    const feedSearchBox = screen.getByRole("searchbox", { name: "Search messages and event notifications" });
    expect(feedSearchBox).toHaveAttribute("placeholder", "Search messages and event notifications...");
    expect(screen.getByRole("button", { name: "Close search messages and event notifications" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Messages and event notifications from May 15, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Messages and event notifications from May 14, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Messages and event notifications from May 13, 2026" })).toBeInTheDocument();
    expect(screen.getByText("10:30 AM")).toBeInTheDocument();
    expect(screen.queryByText("Sent May 15, 2026 at 10:30 AM")).not.toBeInTheDocument();
    ["System Admin", "Head Coach", "John Doe", "Merch Store", "Event Team", "Talia Brooks"].forEach((sender) => {
      expect(screen.getAllByText(sender).length).toBeGreaterThan(0);
    });
    const summerEventRow = screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i });
    expect(summerEventRow.closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--event");
    expect(screen.getByRole("button", { name: /Head Coach.*Practice Session Reminder/i }).closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--message");
    expect(screen.getByRole("button", { name: /Talia Brooks.*Thank you, I will be there for training/i }).closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--message");
    expect(screen.getByRole("button", { name: /Event Team.*Upcoming Event: Parent Meeting/i }).closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--event");
    expect(screen.queryByLabelText("Selected feed item detail")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Event Update: Summer Championship details")).not.toBeInTheDocument();
    fireEvent.click(summerEventRow);

    expect(summerEventRow).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Event Update: Summer Championship" })).toBeInTheDocument();
    expect(screen.getAllByText("Sent May 15, 2026 at 10:30 AM").length).toBeGreaterThan(0);
    expect(screen.getByText("Event Details")).toBeInTheDocument();
    expect(screen.getByText("Date: July 25 - July 27, 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager app launcher")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Direct message center")).not.toBeInTheDocument();

    const attendanceRow = screen.getByRole("button", { name: /John Doe.*Attendance Confirmation/i });
    fireEvent.click(attendanceRow);

    expect(attendanceRow).toHaveAttribute("aria-expanded", "true");
    expect(attendanceRow.closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--message", "is-selected");
    expect(screen.getByLabelText("Attendance Confirmation details")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attendance Confirmation" })).toBeInTheDocument();
    expect(screen.getAllByText("Sent May 15, 2026 at 8:45 AM").length).toBeGreaterThan(0);

    fireEvent.click(attendanceRow);

    expect(attendanceRow).toHaveAttribute("aria-expanded", "false");
    expect(attendanceRow.closest(".manager-home-feed-item")).not.toHaveClass("is-selected");
    expect(screen.queryByLabelText("Attendance Confirmation details")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Message Settings" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager app launcher")).not.toBeInTheDocument();
  }, 10000);

  it.skip("opens the staff-only live chat room route", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T18:05:00-05:00"));
    renderLoggedInApp("/live-chat");

    expect(screen.getByLabelText("Live chat room page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Live Chats" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Live Chat Rooms" })).toBeInTheDocument();
    const chatFrame = screen.getByLabelText("Live chat room frame");
    expect(chatFrame).toHaveClass("manager-launcher-body", "live-chat-shell");
    expect(chatFrame).not.toHaveClass("is-sidebar-collapsed");
    const roster = screen.getByLabelText("Live chat members");
    expect(roster).toHaveClass("manager-launcher-grid", "manager-launcher-sidebar", "live-chat-roster");
    expect(roster.querySelector(".manager-launcher-item.live-chat-roster-member")).toBeInTheDocument();
    const rosterToggle = screen.getByRole("button", { name: "Collapse live chat member list" });
    expect(rosterToggle).toHaveClass("manager-launcher-rail-toggle");
    expect(rosterToggle.querySelector(".manager-launcher-rail-toggle-bar")).toBeInTheDocument();
    expect(rosterToggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("live-chat-roster-members")).not.toHaveAttribute("hidden");
    const roomTabs = screen.getByRole("tablist", { name: "Live chat rooms" });
    expect(within(roomTabs).getByRole("tab", { name: "Cho's Room" })).toHaveAttribute("aria-selected", "true");
    expect(within(roomTabs).getByRole("button", { name: "Create Room" })).toBeInTheDocument();
    expect(within(roomTabs).getByRole("tab", { name: /Mentions/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "All Messages" })).not.toBeInTheDocument();
    const chatHeader = screen.getByLabelText("Live chat room header");
    expect(within(chatHeader).getByLabelText("Live chat online count")).toHaveTextContent("18 Online");
    expect(screen.queryByLabelText("Live chat preview")).not.toBeInTheDocument();
    expect(within(chatHeader).queryByText(/^Preview$/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Live chat composer")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter message.")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByText(/Supabase/i)).toBeInTheDocument();

    fireEvent.click(rosterToggle);
    const expandRosterToggle = screen.getByRole("button", { name: "Expand live chat member list" });
    expect(expandRosterToggle).toHaveAttribute("aria-expanded", "false");
    expect(chatFrame).toHaveClass("is-sidebar-collapsed");
    expect(document.getElementById("live-chat-roster-members")).toHaveAttribute("hidden");
    expect(screen.getByLabelText("Live chat room")).toBeInTheDocument();

    fireEvent.click(expandRosterToggle);
    expect(screen.getByRole("button", { name: "Collapse live chat member list" })).toHaveAttribute("aria-expanded", "true");
    expect(chatFrame).not.toHaveClass("is-sidebar-collapsed");
    expect(document.getElementById("live-chat-roster-members")).not.toHaveAttribute("hidden");
  });

  it.skip("creates custom live chat rooms with invited members and a colored room tab", () => {
    renderLoggedInApp("/live-chat");

    const roomTabs = screen.getByRole("tablist", { name: "Live chat rooms" });
    fireEvent.click(within(roomTabs).getByRole("button", { name: "Create Room" }));

    const dialog = screen.getByRole("dialog", { name: "Create chat room" });
    fireEvent.change(within(dialog).getByLabelText("Room name"), { target: { value: "Leadership Team" } });
    fireEvent.click(within(dialog).getByLabelText("Room color Ruby"));
    fireEvent.click(within(dialog).getByLabelText("Invite Talia Brooks"));
    fireEvent.click(within(dialog).getByLabelText("Invite Evan Ramirez"));
    expect(within(dialog).getByLabelText("Live chat invite count")).toHaveTextContent("2 invited");
    expect(within(dialog).getByRole("button", { name: "Create Room" })).toBeDisabled();

    const confirmInvitesButton = within(dialog).getByRole("button", { name: "Confirm 2 Invites" });
    expect(confirmInvitesButton).toBeEnabled();
    fireEvent.click(confirmInvitesButton);
    expect(within(dialog).getByRole("button", { name: "Invites Confirmed" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByText("2 invites confirmed")).toBeInTheDocument();

    const createRoomButton = within(dialog).getByRole("button", { name: "Create Room" });
    expect(createRoomButton).toBeEnabled();
    fireEvent.click(createRoomButton);

    expect(screen.queryByRole("dialog", { name: "Create chat room" })).not.toBeInTheDocument();
    const createdRoomTab = within(roomTabs).getByRole("tab", { name: "Leadership Team" });
    expect(createdRoomTab).toHaveAttribute("aria-selected", "true");
    expect(createdRoomTab).toHaveStyle("--live-chat-room-tab-color: #e4567d");
    expect(screen.getByLabelText("Live chat room invite summary")).toHaveTextContent("Talia Brooks, Evan Ramirez");
    expect(screen.getByText("Leadership Team is ready for 2 invited members.")).toBeInTheDocument();

    fireEvent.click(within(roomTabs).getByRole("tab", { name: "Cho's Room" }));
    expect(within(roomTabs).getByRole("tab", { name: "Cho's Room" })).toHaveAttribute("aria-selected", "true");
  });

  it("submits a local preview test message when Supabase sign-in is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T18:12:00-05:00"));
    renderLoggedInApp("/live-chat");

    const input = screen.getByPlaceholderText("Enter message.");
    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(input).toBeEnabled();
    expect(sendButton).toBeEnabled();

    fireEvent.change(input, { target: { value: "  Test live chat submission.  " } });
    fireEvent.click(sendButton);

    expect(screen.getByText("Test live chat submission.")).toBeInTheDocument();
    expect(screen.getByText("Test message added locally. Supabase sign-in required for live delivery.")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(sendButton).toBeEnabled();
  });

  it("keeps live chat timestamps grouped under the sender name to avoid wasted message row space", () => {
    renderLoggedInApp("/live-chat");

    const firstMessage = screen.getByText("Saturday belt testing schedule is live. Check roster updates before dismissing families.").closest(".live-chat-message");
    expect(firstMessage).not.toBeNull();
    const sender = within(firstMessage as HTMLElement).getByText("[Notice]");
    const timestamp = within(firstMessage as HTMLElement).getByText(/\d{1,2}:\d{2} (AM|PM)/);

    expect(sender.parentElement).toHaveClass("live-chat-message-meta");
    expect(timestamp.parentElement).toHaveClass("live-chat-message-meta");
    expect((firstMessage as HTMLElement).children).toHaveLength(2);
    expect((firstMessage as HTMLElement).children[1]).toHaveClass("live-chat-message-body");
  });

  it("places the live chat composer date in the bottom-right footer opposite the guidelines", () => {
    vi.useFakeTimers();
    const currentComposerDate = new Date("2026-06-12T18:12:00-05:00");
    const expectedComposerTimestamp = `${currentComposerDate.toLocaleDateString("en-CA").replace(/-/g, "/")} ${currentComposerDate.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}`;
    const expectedComposerLabel = `Current composer time ${expectedComposerTimestamp}`;
    vi.setSystemTime(currentComposerDate);
    renderLoggedInApp("/live-chat");

    const inputShell = screen.getByPlaceholderText("Enter message.").closest(".live-chat-input-shell");
    expect(inputShell).not.toBeNull();
    const footerLine = screen.getByText("community guidelines").closest(".live-chat-footer-line");
    expect(footerLine).not.toBeNull();
    const composerDate = within(footerLine as HTMLElement).getByLabelText(expectedComposerLabel);

    expect(within(inputShell as HTMLElement).queryByLabelText(expectedComposerLabel)).not.toBeInTheDocument();
    expect(composerDate).toHaveClass("live-chat-composer-time", "live-chat-composer-time--footer");
    expect(composerDate.querySelector("svg")).not.toBeInTheDocument();
    expect((footerLine as HTMLElement).children[0]).toHaveClass("live-chat-guidelines");
    expect((footerLine as HTMLElement).children[1]).toBe(composerDate);
  });

  it("keeps the live chat feed pinned to the newest message when already at the bottom", async () => {
    renderLoggedInApp("/live-chat");

    const feed = screen.getByLabelText("Live chat messages") as HTMLOListElement;
    Object.defineProperties(feed, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 900 }
    });
    feed.scrollTop = 592;
    fireEvent.scroll(feed);

    fireEvent.change(screen.getByPlaceholderText("Enter message."), { target: { value: "Bottom pinned test message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(feed.scrollTop).toBe(600));
    expect(screen.getByText("Bottom pinned test message")).toBeInTheDocument();
  });

  it("preserves the live chat feed position when the user scrolls away from the newest message", async () => {
    renderLoggedInApp("/live-chat");

    const feed = screen.getByLabelText("Live chat messages") as HTMLOListElement;
    Object.defineProperties(feed, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 900 }
    });
    feed.scrollTop = 180;
    fireEvent.scroll(feed);

    fireEvent.change(screen.getByPlaceholderText("Enter message."), { target: { value: "Manual scroll position test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Manual scroll position test")).toBeInTheDocument());
    expect(feed.scrollTop).toBe(180);
  });

  it.skip("redirects non-staff users away from the live chat room", () => {
    const guardianView = renderLoggedInApp("/live-chat", "guardian");
    expect(screen.queryByLabelText("Live chat room page")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Parent profile page")).toBeInTheDocument();
    guardianView.unmount();

    renderLoggedInApp("/live-chat", "student");
    expect(screen.queryByLabelText("Live chat room page")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Student profile page")).toBeInTheDocument();
  });

  it("opens the manager panel from the manager home icon button", () => {
    renderLoggedInApp("/profile");

    fireEvent.click(screen.getByRole("link", { name: "Manager's Panel" }));

    expect(screen.getByLabelText("Manager app launcher")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MANAGER PANEL" })).toBeInTheDocument();
  });

  it.skip("lets the manager create a staff account that can log in without Create access", async () => {
    const managerView = renderLoggedInApp("/manager");

    fireEvent.click(screen.getByRole("link", { name: "Create" }));

    expect(screen.getByRole("heading", { name: "Create Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Staff" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Staff full name"), { target: { value: "Jordan Lee" } });
    fireEvent.change(screen.getByLabelText("Staff username"), { target: { value: "jordan.staff" } });
    fireEvent.change(screen.getByLabelText("Staff password"), { target: { value: "StaffPass123!" } });
    fireEvent.change(screen.getByLabelText("Confirm staff password"), { target: { value: "StaffPass123!" } });
    fireEvent.change(screen.getByLabelText("Staff email"), { target: { value: "jordan@chos.prototype" } });
    fireEvent.change(screen.getByLabelText("Staff phone"), { target: { value: "(262) 555-0111" } });
    expect(screen.queryByRole("checkbox", { name: "Create account access" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create Staff Account" }));

    expect(screen.getByRole("article", { name: "Jordan Lee staff account" })).not.toHaveTextContent("Create");
    expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        displayName: "Jordan Lee",
        username: "jordan.staff",
        password: "StaffPass123!",
        role: "staff",
        access: expect.not.arrayContaining(["create"])
      })
    ]));

    managerView.unmount();
    clearActiveSession();
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "jordan.staff" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "StaffPass123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByLabelText("Live chat room page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    expect(await screen.findByRole("heading", { name: "Staff Profile" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Staff Panel" }));
    expect(screen.getByLabelText("Staff app launcher")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create" })).not.toBeInTheDocument();
  });

  it.skip("rejects manager-created Supabase account passwords that do not meet the staging policy", async () => {
    renderLoggedInApp("/manager?tool=create");

    fireEvent.change(screen.getByLabelText("Staff full name"), { target: { value: "Taylor Reed" } });
    fireEvent.change(screen.getByLabelText("Staff username"), { target: { value: "taylor.staff" } });
    fireEvent.change(screen.getByLabelText("Staff password"), { target: { value: "StaffPass123" } });
    fireEvent.change(screen.getByLabelText("Confirm staff password"), { target: { value: "StaffPass123" } });
    fireEvent.change(screen.getByLabelText("Staff email"), { target: { value: "taylor@chos.prototype" } });
    fireEvent.change(screen.getByLabelText("Staff phone"), { target: { value: "(262) 555-0113" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Staff Account" }));

    expect(await screen.findByText("Use at least 12 characters with uppercase, lowercase, a number, and a symbol.")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.managedAccounts.v1")).toBeNull();
  });

  it.skip("lets managers deactivate and reactivate custom logins", async () => {
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-jordan",
        displayName: "Jordan Lee",
        username: "jordan.staff",
        password: "StaffPass123",
        role: "staff",
        status: "active",
        email: "jordan@chos.prototype",
        phone: "(262) 555-0111",
        title: "Instructor",
        access: ["dashboard", "students", "reports"],
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));

    const managerView = renderLoggedInApp("/manager?tool=create");
    const accountCard = screen.getByRole("article", { name: "Jordan Lee staff account" });

    expect(accountCard).toHaveTextContent("Active");
    fireEvent.click(within(accountCard).getByRole("button", { name: "Deactivate Jordan Lee account" }));

    expect(await screen.findByText("Jordan Lee account deactivated.")).toBeInTheDocument();
    expect(accountCard).toHaveTextContent("Inactive");
    expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ username: "jordan.staff", status: "inactive" })
    ]));

    managerView.unmount();
    clearActiveSession();
    const inactiveLoginView = renderLoggedOutApp("/");
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "jordan.staff" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "StaffPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Check the username and password.")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();

    inactiveLoginView.unmount();
    const reactivationView = renderLoggedInApp("/manager?tool=create");
    const inactiveAccountCard = screen.getByRole("article", { name: "Jordan Lee staff account" });
    fireEvent.click(within(inactiveAccountCard).getByRole("button", { name: "Reactivate Jordan Lee account" }));

    expect(await screen.findByText("Jordan Lee account reactivated.")).toBeInTheDocument();
    expect(inactiveAccountCard).toHaveTextContent("Active");
    expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ username: "jordan.staff", status: "active" })
    ]));

    reactivationView.unmount();
    clearActiveSession();
    renderLoggedOutApp("/");
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "jordan.staff" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "StaffPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByLabelText("Live chat room page")).toBeInTheDocument();
  });

  it.skip("lets the manager create a student account that can log in", async () => {
    const managerView = renderLoggedInApp("/manager?tool=create");

    fireEvent.click(screen.getByRole("button", { name: "Student" }));
    fireEvent.change(screen.getByLabelText("Student full name"), { target: { value: "Avery Kim" } });
    fireEvent.change(screen.getByLabelText("Student username"), { target: { value: "avery.student" } });
    fireEvent.change(screen.getByLabelText("Student password"), { target: { value: "StudentPass123!" } });
    fireEvent.change(screen.getByLabelText("Confirm student password"), { target: { value: "StudentPass123!" } });
    fireEvent.change(screen.getByLabelText("Student email"), { target: { value: "avery@chos.prototype" } });
    fireEvent.change(screen.getByLabelText("Parent/guardian phone"), { target: { value: "(262) 555-0122" } });
    fireEvent.change(screen.getByLabelText("Program"), { target: { value: "Youth Taekwondo" } });
    fireEvent.change(screen.getByLabelText("Belt rank"), { target: { value: "Yellow" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Student Account" }));

    expect(screen.getByRole("article", { name: "Avery Kim student account" })).toHaveTextContent("Student");
    expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        displayName: "Avery Kim",
        username: "avery.student",
        password: "StudentPass123!",
        role: "student"
      })
    ]));
    expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ firstName: "Avery", lastName: "Kim", email: "avery@chos.prototype", beltRank: "Yellow" })
    ]));

    managerView.unmount();
    clearActiveSession();
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "avery.student" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "StudentPass123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByLabelText("Student profile page")).toBeInTheDocument();
  });

  it.skip("keeps managed student roles authoritative over stale stored staff roles", () => {
    const student = {
      id: "student-stale-role",
      firstName: "Avery",
      lastName: "Kim",
      ...completeStudentSafetyFields,
      phone: "(262) 555-0122",
      email: "avery@chos.prototype",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const account = {
      id: "managed-stale-role",
      displayName: "Avery Kim",
      username: "avery.student",
      password: "StudentPass123",
      role: "student",
      status: "active",
      access: [],
      studentId: student.id,
      createdAt: "2026-06-01T10:00:00.000Z"
    };
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([account]));
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([student]));
    seedActiveSession({ email: account.username, remembered: true, createdAt: "2026-06-02T10:00:00.000Z" });
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: account.username, role: "staff" }]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Student profile page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reports" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manager's Panel" })).not.toBeInTheDocument();
  });

  it("rejects active managed student logins that are not linked to a student record", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-talia",
        firstName: "Talia",
        lastName: "Brooks",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "talia@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-04-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-orphan",
        displayName: "Orphan Student",
        username: "orphan.student",
        password: "StudentPass123",
        role: "student",
        status: "active",
        email: "orphan@example.com",
        phone: "(262) 555-0102",
        title: "Student",
        access: [],
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "orphan.student" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "StudentPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Check the username and password.")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(screen.queryByLabelText("Student profile page")).not.toBeInTheDocument();
  });

  it("rejects active managed student logins linked to inactive student records", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Inactive",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-04-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-ari",
        displayName: "Ari Nguyen",
        username: "ari.student",
        password: "StudentPass123",
        role: "student",
        status: "active",
        email: "ari@example.com",
        phone: "(262) 555-0101",
        title: "Student",
        access: [],
        studentId: "student-ari",
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "ari.student" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "StudentPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Check the username and password.")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
    expect(screen.queryByLabelText("Student profile page")).not.toBeInTheDocument();
  });

  it("keeps retired managed student login creation unavailable", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/manager"]}>
        <AppStateProvider>
          <ManagedStudentAccountCreationHarness studentId="student-cora" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Check managed account creation" }));

    await waitFor(() => {
      expect(screen.getByText("Harness managed accounts: 0")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual([]);
      expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not expose managed account creation from app state", async () => {
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/manager"]}>
        <AppStateProvider>
          <ManagedAccountDoubleCreateHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Check managed account creation" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate managed returns: retired")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate managed accounts: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate managed roles: 0")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual([]);
      expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not expose managed account login from app state", async () => {
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/manager"]}>
        <AppStateProvider>
          <ImmediateManagedAccountLoginHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Check managed account login" }));

    await waitFor(() => {
      expect(screen.getByText("Harness managed login helper: retired")).toBeInTheDocument();
      expect(screen.getByText("Harness session email: none")).toBeInTheDocument();
      expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
      expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual([]);
      expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([]);
    });
  });

  it.skip("hides Create from staff accounts even when older stored access includes Create", () => {
    renderManagedStaffApp("/manager", {
      id: "managed-staff-no-create",
      displayName: "Taylor Staff",
      username: "taylor.staff",
      password: "StaffPass123",
      role: "staff",
      status: "active",
      access: ["dashboard", "students", "create"],
      createdAt: "2026-05-20T10:00:00.000Z"
    });

    expect(screen.getByLabelText("Staff app launcher")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create" })).not.toBeInTheDocument();
  });

  it.skip("falls staff away from direct Create panel links to the first staff tool", () => {
    renderManagedStaffApp("/manager?tool=create", {
      id: "managed-staff-stale-create",
      displayName: "Taylor Staff",
      username: "taylor.staff",
      password: "StaffPass123",
      role: "staff",
      status: "active",
      access: ["create"],
      createdAt: "2026-05-20T10:00:00.000Z"
    });

    expect(screen.getByLabelText("Staff app launcher")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "STAFF PANEL" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create Accounts" })).not.toBeInTheDocument();
  });

  it.skip("opens a rebuilt student Profile page with reference layout for student accounts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00-05:00"));
    renderLoggedInApp("/", "student");

    const page = screen.getByLabelText("Student profile page");
    expect(page.closest(".manager-shell")).toHaveClass("manager-shell--student-reference");
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    const profileTitleHeader = screen.getByLabelText("Student profile page header");
    expect(within(profileTitleHeader).queryByRole("link", { name: "Manager's Panel" })).not.toBeInTheDocument();
    expect(within(profileTitleHeader).queryByRole("link", { name: "Student's Panel" })).not.toBeInTheDocument();
    expect(within(profileTitleHeader).getByRole("button", { name: "Student Panel" })).toBeInTheDocument();
    expect(within(profileTitleHeader).getByRole("button", { name: "Log Out" })).toBeInTheDocument();

    expect(within(page).getByTestId("student-reference-background")).toHaveAttribute("src", expect.stringContaining("assets/student-profile-reference/profile-bg.png"));
    const profileOverview = screen.getByLabelText("Student reference profile card");
    const studentSchedule = screen.getByLabelText("Student reference weekly schedule");
    expect(profileOverview.compareDocumentPosition(studentSchedule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const actionRow = screen.getByLabelText("Student reference action row");
    const bottomPanel = screen.getByLabelText("Student profile bottom panel");
    expect(actionRow.compareDocumentPosition(bottomPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(studentSchedule.compareDocumentPosition(bottomPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(profileOverview).getByRole("img", { name: "Talia Brooks profile portrait" })).toHaveAttribute("src", expect.stringContaining("assets/student-profiles/talia-brooks.webp"));
    expect(within(profileOverview).getByRole("heading", { name: "Talia Brooks" })).toBeInTheDocument();
    expect(within(profileOverview).getByText("Little Dragons Student")).toBeInTheDocument();
    expect(within(profileOverview).getByText("Rank: White Belt")).toBeInTheDocument();
    expect(within(profileOverview).getByText("Member Since: April 2026")).toBeInTheDocument();
    expect(within(studentSchedule).getByRole("heading", { name: "May 17 - 23, 2026" })).toBeInTheDocument();
    expect(within(studentSchedule).getByRole("button", { name: "Select Monday, May 18, 2026" })).toHaveAttribute("aria-pressed", "true");

    const beltTab = within(actionRow).getByRole("tab", { name: "Belt Case" });
    const messagesTab = within(actionRow).getByRole("tab", { name: "Messages" });
    expect(beltTab).toHaveAttribute("aria-selected", "true");
    expect(messagesTab).toHaveAttribute("aria-selected", "false");
    expect(within(actionRow).getByRole("button", { name: "Great Job!" })).toBeInTheDocument();
    expect(within(actionRow).getByRole("button", { name: "Edit Profile" })).toBeInTheDocument();
    const beltCase = within(bottomPanel).getByRole("tabpanel", { name: "Student belt case display" });
    expect(within(beltCase).getByTestId("student-reference-belt-stage")).toHaveAttribute("src", expect.stringContaining("assets/student-profile-reference/belt-case-stage.png"));
    expect(within(beltCase).getByRole("heading", { name: "My Belt Journey" })).toBeInTheDocument();
    expect(within(beltCase).queryByLabelText("Current student rank")).not.toBeInTheDocument();
    expect(within(beltCase).queryByText("Current Rank")).not.toBeInTheDocument();
    expect(within(beltCase).queryByText("You're doing awesome!")).not.toBeInTheDocument();
    expect(within(beltCase).queryByLabelText("Belt journey stats")).not.toBeInTheDocument();
    expect(within(beltCase).queryByText("Classes Attended")).not.toBeInTheDocument();
    expect(within(beltCase).queryByText("Skills Learned")).not.toBeInTheDocument();
    expect(within(beltCase).queryByText("Achievements Earned")).not.toBeInTheDocument();
    expect(within(beltCase).queryByText("Great Job!")).not.toBeInTheDocument();
    expect(within(beltCase).queryByText("Keep it up!")).not.toBeInTheDocument();
    expect(within(beltCase).getByText("Next: Yellow Belt")).toBeInTheDocument();
    expect(within(beltCase).getByRole("progressbar", { name: "Belt journey progress to Yellow Belt" })).toHaveAttribute("aria-valuenow", "50");
    expect(within(beltCase).getByRole("img", { name: "White Belt trophy belt case with 1 earned belt" })).toBeInTheDocument();
    ["white", "yellow", "orange", "green", "blue", "purple", "brown", "red", "dark-brown", "black"].forEach((slug) => {
      expect(within(beltCase).getByTestId(`student-reference-belt-${slug}`)).toBeInTheDocument();
    });
    expect(within(beltCase).getByTestId("student-reference-belt-white")).toHaveAttribute("data-earned", "true");
    expect(within(beltCase).getByTestId("student-reference-belt-yellow")).toHaveAttribute("data-earned", "false");
    expect(within(beltCase).queryByLabelText("Belt case creator controls")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Customize Belt Case" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Belt case customize panel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open search messages and event notifications" })).not.toBeInTheDocument();

    fireEvent.click(messagesTab);
    expect(messagesTab).toHaveAttribute("aria-selected", "true");
    const feedPanel = within(bottomPanel).getByRole("tabpanel", { name: "Messages and event notifications" });
    expect(within(feedPanel).getByText("5 Messages")).toBeInTheDocument();
    expect(within(feedPanel).getByText("2 Event Notifications")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compose" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open search messages and event notifications" }));
    expect(screen.getByRole("searchbox", { name: "Search messages and event notifications" })).toHaveAttribute("placeholder", "Search messages and event notifications...");

    const testingEventRow = screen.getByRole("button", { name: /Event Team.*Upcoming Event: Color Belt Testing/i });
    fireEvent.click(testingEventRow);
    expect(testingEventRow).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Upcoming Event: Color Belt Testing" })).toBeInTheDocument();
    expect(screen.getByText("Date: July 25 - July 27, 2026")).toBeInTheDocument();

    fireEvent.click(within(actionRow).getByRole("button", { name: "Edit Profile" }));
    const dialog = screen.getByRole("dialog", { name: "Student profile settings" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Kai Student" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Profile Settings" }));
    expect(JSON.parse(window.localStorage.getItem(scopedProfileKey("student", "student123@chos.prototype")) ?? "{}")).toMatchObject({ name: "Kai Student" });
    expect(window.localStorage.getItem("chos.profile.v1")).toBeNull();
  });

  it.skip("lets students reply to staff direct messages from their Profile feed", async () => {
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-staff-to-talia",
        threadId: "direct-staff-seed__student-talia-brooks-seed",
        senderId: "direct-staff-seed",
        senderName: "Cho's Manager",
        recipientId: "student-talia-brooks-seed",
        recipientName: "Talia Brooks",
        body: "Hi Talia, your next class notes are ready when you arrive.",
        createdAt: "2026-06-01T18:00:00.000Z",
        status: "sent"
      }
    ]));
    renderLoggedInApp("/", "student");

    const actionRow = screen.getByLabelText("Student reference action row");
    fireEvent.click(within(actionRow).getByRole("tab", { name: "Messages" }));
    const feedPanel = await screen.findByRole("tabpanel", { name: "Messages and event notifications" });
    const directRow = within(feedPanel).getByRole("button", { name: /Cho's Manager.*Hi Talia, your next class notes are ready when you arrive/i });
    fireEvent.click(directRow);

    expect(directRow).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "App message from Cho's Manager" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Write a reply"), { target: { value: "I will review them before class." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(await screen.findByText("Reply sent to Cho's Manager.")).toBeInTheDocument();
    const savedDirectMessages = JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]") as Array<{ senderId: string; recipientId: string; recipientName: string; body: string }>;
    expect(savedDirectMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        senderId: "student-talia-brooks-seed",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "I will review them before class."
      })
    ]));
  });

  it.skip("lets students enable device notifications for unread app messages", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) }
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class NotificationMock {
        static permission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
      }
    });
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-staff-to-talia",
        threadId: "direct-staff-seed__student-talia-brooks-seed",
        senderId: "direct-staff-seed",
        senderName: "Cho's Manager",
        recipientId: "student-talia-brooks-seed",
        recipientName: "Talia Brooks",
        body: "Your private lesson notes are ready.",
        createdAt: "2026-06-02T18:00:00.000Z",
        status: "sent"
      }
    ]));

    renderLoggedInApp("/", "student");

    const actionRow = screen.getByLabelText("Student reference action row");
    fireEvent.click(within(actionRow).getByRole("tab", { name: "Messages" }));
    const feedPanel = await screen.findByRole("tabpanel", { name: "Messages and event notifications" });

    fireEvent.click(within(feedPanel).getByRole("button", { name: "Enable Message Notifications" }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith("New message from Cho's Manager", expect.objectContaining({
        body: "Your private lesson notes are ready.",
        tag: "chos-student-direct-staff-seed__student-talia-brooks-seed",
        data: expect.objectContaining({ url: expect.stringContaining("/") })
      }));
    });
    expect(await screen.findByText("Device notifications enabled for your app messages.")).toBeInTheDocument();

    fireEvent.click(within(feedPanel).getByRole("button", { name: "Send Student Test Notification" }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith("Cho's student test notification", expect.objectContaining({
        body: "Device notifications are ready for messages in your Profile feed.",
        tag: "chos-student-test-notification"
      }));
    });
    expect(await screen.findByText("Student device notification sent.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.homeMessageNotifications.student123-chos.prototype.v1") ?? "{}")).toEqual(expect.objectContaining({
      browserNotificationsEnabled: true,
      browserPermission: "granted",
      lastBrowserNotifiedDirectMessageAt: "2026-06-02T18:00:00.000Z"
    }));
  });

  it.skip("lets students connect and sync a private web push subscription", async () => {
    const pushSubscription = {
      endpoint: "https://push.example.test/subscriptions/student-device",
      expirationTime: null,
      toJSON: () => ({
        endpoint: "https://push.example.test/subscriptions/student-device",
        expirationTime: null,
        keys: {
          p256dh: "student-public-device-key",
          auth: "student-device-auth-secret"
        }
      })
    };
    const subscribe = vi.fn().mockResolvedValue(pushSubscription);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ synced: true }))
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { subscribe } }) }
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class NotificationMock {
        static permission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
      }
    });
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });

    renderLoggedInApp("/", "student");

    const actionRow = screen.getByLabelText("Student reference action row");
    fireEvent.click(within(actionRow).getByRole("tab", { name: "Messages" }));
    const feedPanel = await screen.findByRole("tabpanel", { name: "Messages and event notifications" });

    fireEvent.change(within(feedPanel).getByLabelText("Student Web Push public key"), {
      target: { value: "BEl6PDiRfYyIRLr1YWkN2v6k3cGv2GvZcK2nXrjZ4g6rPQu4xNfQb3-V6X0c0fPKHM8xojN6F0fJgQI3PNe7RDs" }
    });
    fireEvent.click(within(feedPanel).getByRole("button", { name: "Connect Student Device" }));

    expect(await screen.findByText("Student push subscription ready for private server sync.")).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array)
    }));
    expect(JSON.parse(window.localStorage.getItem("chos.homeMessageNotifications.student123-chos.prototype.v1") ?? "{}")).toEqual(expect.objectContaining({
      browserNotificationsEnabled: true,
      browserPermission: "granted",
      pushPublicKey: "BEl6PDiRfYyIRLr1YWkN2v6k3cGv2GvZcK2nXrjZ4g6rPQu4xNfQb3-V6X0c0fPKHM8xojN6F0fJgQI3PNe7RDs",
      pushSubscriptionEndpoint: "https://push.example.test/subscriptions/student-device",
      pushSubscriptionJson: expect.stringContaining("https://push.example.test/subscriptions/student-device"),
      pushSubscribedAt: expect.any(String)
    }));

    fireEvent.change(within(feedPanel).getByLabelText("Student private push server URL"), { target: { value: "https://push.cho.example/api/push/subscriptions" } });
    fireEvent.click(within(feedPanel).getByRole("button", { name: "Sync Student Push Subscription" }));

    expect(await screen.findByText("Student push subscription synced to private server.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://push.cho.example/api/push/subscriptions", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toEqual(expect.objectContaining({
      schemaVersion: "chos-web-push-subscription.v1",
      provider: "web-push",
      deliveryMode: "server-push",
      requestedBy: expect.objectContaining({
        email: "student123@chos.prototype",
        role: "student"
      }),
      notificationUrl: expect.stringContaining("/"),
      subscription: expect.objectContaining({ endpoint: "https://push.example.test/subscriptions/student-device" })
    }));
    expect(JSON.stringify(requestBody)).not.toMatch(/VAPID_PRIVATE|privateKey|TWILIO_AUTH_TOKEN|authToken|password/i);
  });

  it.skip("shows a yellow belt journey for a child-created student account after tutorial handoff", async () => {
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem(
      beltCaseStorageKey("student123@chos.prototype"),
      JSON.stringify({
        backgroundId: "legacy-wall",
        caseId: "onyx-metal",
        lightingId: "champion",
        effectId: "ember-red",
        stickerIds: ["dragon-medal"],
        selectedBeltSlug: "white",
        plaqueText: "Saved Student Case",
        updatedAt: "2026-05-10T00:00:00.000Z"
      })
    );
    renderLoggedInApp("/", "guardian");

    await screen.findByRole("region", { name: "Parent first child tutorial" });
    fireEvent.click(screen.getByRole("button", { name: "Add Child Profile" }));
    const dialog = screen.getByRole("dialog", { name: "Add Child Profile" });
    fireEvent.change(within(dialog).getByLabelText("Child name"), { target: { value: "Kai Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Child age"), { target: { value: "7" } });
    fireEvent.change(within(dialog).getByLabelText("Child username"), { target: { value: "kai-cho.child" } });
    fireEvent.change(within(dialog).getByLabelText("Child password"), { target: { value: "Dragon123" } });
    fireEvent.change(within(dialog).getByLabelText("Current belt"), { target: { value: "yellow" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Child Profile" }));

    const tutorial = screen.getByRole("region", { name: "Parent first child tutorial" });
    fireEvent.click(within(tutorial).getByRole("button", { name: "Open Kai Cho's Student Side" }));

    expect(await screen.findByLabelText("Student profile page")).toBeInTheDocument();
    const beltCase = await screen.findByRole("tabpanel", { name: "Student belt case display" });
    expect(screen.getByText("Rank: Yellow Belt")).toBeInTheDocument();
    expect(within(beltCase).getByRole("img", { name: "Yellow Belt trophy belt case with 2 earned belts" })).toBeInTheDocument();
    expect(within(beltCase).queryByLabelText("Current student rank")).not.toBeInTheDocument();
    expect(within(beltCase).queryByText("Current Rank")).not.toBeInTheDocument();
    expect(within(beltCase).getByTestId("student-reference-belt-white")).toHaveAttribute("data-earned", "true");
    expect(within(beltCase).getByTestId("student-reference-belt-yellow")).toHaveAttribute("data-earned", "true");
    expect(within(beltCase).getByTestId("student-reference-belt-orange")).toHaveAttribute("data-earned", "false");
    expect(within(beltCase).queryByLabelText("Belt case creator controls")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Customize Belt Case" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Belt case customize panel" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(beltCaseStorageKey("kai-cho.child"))).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(beltCaseStorageKey("student123@chos.prototype")) ?? "{}")).toMatchObject({
      backgroundId: "legacy-wall",
      plaqueText: "Saved Student Case"
    });
    expect(screen.getByRole("heading", { name: "Kai Cho" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Talia Brooks" })).not.toBeInTheDocument();
  });

  it.skip("toggles the student bottom panel between belt case and messages without resetting message search", () => {
    renderLoggedInApp("/", "student");

    const bottomPanel = screen.getByLabelText("Student profile bottom panel");
    const actionRow = screen.getByLabelText("Student reference action row");
    const beltTab = within(actionRow).getByRole("tab", { name: "Belt Case" });
    const messagesTab = within(actionRow).getByRole("tab", { name: "Messages" });

    expect(beltTab).toHaveAttribute("aria-selected", "true");
    expect(within(bottomPanel).getByRole("tabpanel", { name: "Student belt case display" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Customize Belt Case" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Belt case customize panel" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Student reference profile card")).toBeInTheDocument();

    fireEvent.click(messagesTab);
    expect(messagesTab).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("region", { name: "Belt case customize panel" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Student reference profile card")).toBeInTheDocument();
    expect(within(bottomPanel).getByText("5 Messages")).toBeInTheDocument();
    expect(within(bottomPanel).getByText("2 Event Notifications")).toBeInTheDocument();
    fireEvent.click(within(bottomPanel).getByRole("button", { name: "Open search messages and event notifications" }));
    const searchBox = within(bottomPanel).getByRole("searchbox", { name: "Search messages and event notifications" });
    fireEvent.change(searchBox, { target: { value: "testing" } });
    expect(within(bottomPanel).getByRole("button", { name: /Event Team.*Upcoming Event: Color Belt Testing/i })).toBeInTheDocument();

    fireEvent.click(beltTab);
    expect(beltTab).toHaveAttribute("aria-selected", "true");
    expect(within(bottomPanel).getByRole("img", { name: "White Belt trophy belt case with 1 earned belt" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Customize Belt Case" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search messages and event notifications" })).not.toBeInTheDocument();

    fireEvent.click(messagesTab);
    expect(within(bottomPanel).getByRole("searchbox", { name: "Search messages and event notifications" })).toHaveValue("testing");
    expect(within(bottomPanel).getByRole("button", { name: /Event Team.*Upcoming Event: Color Belt Testing/i })).toBeInTheDocument();
  });

  it.skip("keeps student profile defaults isolated from saved manager profile settings", () => {
    window.localStorage.setItem("chos.profile.v1", JSON.stringify({
      name: "Master Cho",
      username: "master-cho",
      email: "manager123@chos.prototype",
      phone: "(262) 555-0199",
      updates: true,
      theme: "dark",
      photoDataUrl: "data:image/png;base64,manager-photo"
    }));

    renderLoggedInApp("/", "student");

    const profileOverview = screen.getByLabelText("Student reference profile card");
    expect(within(profileOverview).getByRole("heading", { name: "Talia Brooks" })).toBeInTheDocument();
    expect(within(profileOverview).queryByRole("heading", { name: "Master Cho" })).not.toBeInTheDocument();
    expect(within(profileOverview).getByRole("img", { name: "Talia Brooks profile portrait" })).toHaveAttribute("src", expect.stringContaining("assets/student-profiles/talia-brooks.webp"));
  });

  it.skip("opens a Parent Profile page with child dashboards, tools, messages, notifications, and editable kids profiles", () => {
    renderLoggedInApp("/", "guardian");

    expect(screen.getByLabelText("Parent profile page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Parent Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manager's Panel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Student's Panel" })).not.toBeInTheDocument();

    const childProfiles = screen.getByLabelText("Parent child profiles");
    expect(within(childProfiles).getByRole("button", { name: "Select Mina Cho profile" })).toHaveAttribute("aria-pressed", "true");
    expect(within(childProfiles).getByRole("button", { name: "Select Eli Cho profile" })).toBeInTheDocument();
    fireEvent.click(within(childProfiles).getByRole("group", { name: "Eli Cho profile card" }));
    expect(within(childProfiles).getByRole("button", { name: "Select Eli Cho profile" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByLabelText("Selected child workspace")).getByRole("heading", { name: "Eli Cho" })).toBeInTheDocument();
    const familyTotals = screen.getByLabelText("Parent family totals");
    expect(familyTotals).toHaveTextContent(/2\s*Child Profiles/);
    expect(familyTotals).toHaveTextContent(/4\s*Messages/);
    expect(familyTotals).toHaveTextContent(/4\s*Notifications/);

    const parentTools = screen.getByLabelText("Parent student tools");
    expect(within(parentTools).getAllByRole("button").map((button) => button.textContent)).toEqual(["Dashboard", "Classes", "Study", "Test", "Messages", "Notifications"]);

    fireEvent.click(within(parentTools).getByRole("button", { name: "Classes" }));
    expect(screen.getByLabelText("Parent classes view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Classes" })).toBeInTheDocument();

    fireEvent.click(within(parentTools).getByRole("button", { name: "Messages" }));
    expect(screen.getByLabelText("Parent messages view")).toBeInTheDocument();
    expect(screen.getByText("Practice Session Reminder")).toBeInTheDocument();

    fireEvent.click(within(parentTools).getByRole("button", { name: "Notifications" }));
    expect(screen.getByLabelText("Parent notifications view")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Event: Color Belt Testing")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Child Profile" }));
    let dialog = screen.getByRole("dialog", { name: "Add Child Profile" });
    fireEvent.change(within(dialog).getByLabelText("Child name"), { target: { value: "Kai Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Child age"), { target: { value: "7" } });
    fireEvent.change(within(dialog).getByLabelText("Child username"), { target: { value: "kai-cho.child" } });
    fireEvent.change(within(dialog).getByLabelText("Child password"), { target: { value: "Dragon123" } });
    fireEvent.change(within(dialog).getByLabelText("Current belt"), { target: { value: "yellow" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Child Profile" }));

    expect(screen.queryByRole("dialog", { name: "Add Child Profile" })).not.toBeInTheDocument();
    expect(within(childProfiles).getByRole("button", { name: "Select Kai Cho profile" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ parentEmail: "parent123@chos.prototype", name: "Kai Cho", username: "kai-cho.child", password: "Dragon123", age: "7", beltSlug: "yellow" })
    ]));

    fireEvent.click(within(childProfiles).getByRole("button", { name: "Edit Kai Cho profile" }));
    dialog = screen.getByRole("dialog", { name: "Edit Child Profile" });
    fireEvent.change(within(dialog).getByLabelText("Child name"), { target: { value: "Kai Bennett" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Child Profile" }));

    expect(within(childProfiles).getByRole("button", { name: "Select Kai Bennett profile" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ parentEmail: "parent123@chos.prototype", name: "Kai Bennett", username: "kai-cho.child", password: "Dragon123", age: "7", beltSlug: "yellow" })
    ]));
  });

  it.skip("lets parents enable device notifications for unread family app messages", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) }
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class NotificationMock {
        static permission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
      }
    });
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-staff-to-mina-parent",
        threadId: "direct-staff-seed__parent-child-mina-cho",
        senderId: "direct-staff-seed",
        senderName: "Cho's Manager",
        recipientId: "parent-child-mina-cho",
        recipientName: "Mina Cho Family",
        body: "Mina's testing checklist is ready for review.",
        createdAt: "2026-06-02T19:00:00.000Z",
        status: "sent"
      }
    ]));

    renderLoggedInApp("/", "guardian");

    const parentTools = screen.getByLabelText("Parent student tools");
    fireEvent.click(within(parentTools).getByRole("button", { name: "Messages" }));
    const messagesView = screen.getByLabelText("Parent messages view");

    fireEvent.click(within(messagesView).getByRole("button", { name: "Enable Parent Message Notifications" }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith("New family message from Cho's Manager", expect.objectContaining({
        body: "Mina's testing checklist is ready for review.",
        tag: "chos-parent-direct-staff-seed__parent-child-mina-cho",
        data: expect.objectContaining({ url: expect.stringContaining("/") })
      }));
    });
    expect(await screen.findByText("Device notifications enabled for parent app messages.")).toBeInTheDocument();

    fireEvent.click(within(messagesView).getByRole("button", { name: "Send Parent Test Notification" }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith("Cho's parent test notification", expect.objectContaining({
        body: "Device notifications are ready for messages in your Parent Profile.",
        tag: "chos-parent-test-notification"
      }));
    });
    expect(await screen.findByText("Parent device notification sent.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.homeMessageNotifications.parent123-chos.prototype.v1") ?? "{}")).toEqual(expect.objectContaining({
      browserNotificationsEnabled: true,
      browserPermission: "granted",
      lastBrowserNotifiedDirectMessageAt: "2026-06-02T19:00:00.000Z"
    }));
  });

  it.skip("lets parents connect and sync a private web push subscription", async () => {
    const pushSubscription = {
      endpoint: "https://push.example.test/subscriptions/parent-device",
      expirationTime: null,
      toJSON: () => ({
        endpoint: "https://push.example.test/subscriptions/parent-device",
        expirationTime: null,
        keys: {
          p256dh: "parent-public-device-key",
          auth: "parent-device-auth-secret"
        }
      })
    };
    const subscribe = vi.fn().mockResolvedValue(pushSubscription);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ synced: true }))
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { subscribe } }) }
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class NotificationMock {
        static permission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
      }
    });
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });

    renderLoggedInApp("/", "guardian");

    const parentTools = screen.getByLabelText("Parent student tools");
    fireEvent.click(within(parentTools).getByRole("button", { name: "Messages" }));
    const messagesView = screen.getByLabelText("Parent messages view");

    fireEvent.change(within(messagesView).getByLabelText("Parent Web Push public key"), {
      target: { value: "BEl6PDiRfYyIRLr1YWkN2v6k3cGv2GvZcK2nXrjZ4g6rPQu4xNfQb3-V6X0c0fPKHM8xojN6F0fJgQI3PNe7RDs" }
    });
    fireEvent.click(within(messagesView).getByRole("button", { name: "Connect Parent Device" }));

    expect(await screen.findByText("Parent push subscription ready for private server sync.")).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array)
    }));
    expect(JSON.parse(window.localStorage.getItem("chos.homeMessageNotifications.parent123-chos.prototype.v1") ?? "{}")).toEqual(expect.objectContaining({
      browserNotificationsEnabled: true,
      browserPermission: "granted",
      pushPublicKey: "BEl6PDiRfYyIRLr1YWkN2v6k3cGv2GvZcK2nXrjZ4g6rPQu4xNfQb3-V6X0c0fPKHM8xojN6F0fJgQI3PNe7RDs",
      pushSubscriptionEndpoint: "https://push.example.test/subscriptions/parent-device",
      pushSubscriptionJson: expect.stringContaining("https://push.example.test/subscriptions/parent-device"),
      pushSubscribedAt: expect.any(String)
    }));

    fireEvent.change(within(messagesView).getByLabelText("Parent private push server URL"), { target: { value: "https://push.cho.example/api/push/subscriptions" } });
    fireEvent.click(within(messagesView).getByRole("button", { name: "Sync Parent Push Subscription" }));

    expect(await screen.findByText("Parent push subscription synced to private server.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://push.cho.example/api/push/subscriptions", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toEqual(expect.objectContaining({
      schemaVersion: "chos-web-push-subscription.v1",
      provider: "web-push",
      deliveryMode: "server-push",
      requestedBy: expect.objectContaining({
        email: "parent123@chos.prototype",
        role: "guardian"
      }),
      notificationUrl: expect.stringContaining("/"),
      subscription: expect.objectContaining({ endpoint: "https://push.example.test/subscriptions/parent-device" })
    }));
    expect(JSON.stringify(requestBody)).not.toMatch(/VAPID_PRIVATE|privateKey|TWILIO_AUTH_TOKEN|authToken|password/i);
  });

  it.skip("warns parents when a child username collides with a managed login", async () => {
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-jordan",
        displayName: "Jordan Lee",
        username: "jordan.staff",
        password: "StaffPass123",
        role: "staff",
        status: "active",
        access: ["dashboard", "students"],
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    renderLoggedInApp("/", "guardian");

    fireEvent.click(screen.getByRole("button", { name: "Add Child Profile" }));
    const dialog = screen.getByRole("dialog", { name: "Add Child Profile" });
    fireEvent.change(within(dialog).getByLabelText("Child name"), { target: { value: "Kai Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Child username"), { target: { value: "jordan.staff" } });
    fireEvent.change(within(dialog).getByLabelText("Child password"), { target: { value: "Dragon123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Child Profile" }));

    expect(await screen.findByText("That child username is already used.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ username: "jordan.staff" })
    ]));
  });

  it.skip("shows the next upcoming studio event on the parent dashboard", () => {
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([
      { id: "event-past", title: "Past Belt Testing", date: dateKeyOffset(-1), time: "10:00 AM", details: "Past event.", audience: "students" },
      { id: "event-later", title: "Later Family Night", date: dateKeyOffset(4), time: "6:30 PM", details: "Later event.", audience: "families" },
      { id: "event-next", title: "Future Belt Testing", date: dateKeyOffset(2), time: "10:00 AM", details: "Upcoming event.", audience: "students" }
    ]));

    renderLoggedInApp("/", "guardian");

    const parentDashboard = screen.getByLabelText("Parent dashboard view");
    const nextNotificationCard = within(parentDashboard).getByText("Next Notification").closest("article") as HTMLElement;
    expect(within(nextNotificationCard).getByText("Future Belt Testing")).toBeInTheDocument();
    expect(within(nextNotificationCard).getByText(`${dateKeyOffset(2)} at 10:00 AM`)).toBeInTheDocument();
    expect(within(nextNotificationCard).queryByText("Past Belt Testing")).not.toBeInTheDocument();
    expect(within(nextNotificationCard).queryByText("Later Family Night")).not.toBeInTheDocument();
  });

  it.skip("shows the next upcoming open class on the parent dashboard", () => {
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-past", title: "Past Youth Class", date: dateKeyOffset(-1), time: "5:00 PM", type: "class" },
      { id: "schedule-later", title: "Later Youth Class", date: dateKeyOffset(4), time: "5:00 PM", type: "class" },
      { id: "schedule-next", title: "Future Youth Class", date: dateKeyOffset(2), time: "4:30 PM", type: "class" }
    ]));

    renderLoggedInApp("/", "guardian");

    const parentDashboard = screen.getByLabelText("Parent dashboard view");
    const nextClassCard = within(parentDashboard).getByText("Next Class").closest("article") as HTMLElement;
    expect(within(nextClassCard).getByText("Future Youth Class")).toBeInTheDocument();
    expect(within(nextClassCard).getByText(`${dateKeyOffset(2)} at 4:30 PM`)).toBeInTheDocument();
    expect(within(nextClassCard).queryByText("Past Youth Class")).not.toBeInTheDocument();
    expect(within(nextClassCard).queryByText("Later Youth Class")).not.toBeInTheDocument();
  });

  it.skip("walks first-time parents through the real child profile controls", async () => {
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    renderLoggedInApp("/", "guardian");

    expect(screen.queryByLabelText("Parent student setup guide")).not.toBeInTheDocument();

    let tutorial = await screen.findByRole("region", { name: "Parent first child tutorial" });
    expect(within(tutorial).getByText("Step 1 of 8")).toBeInTheDocument();
    expect(within(tutorial).getByRole("heading", { name: "Tap Add Child" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Child Profile" }));
    const dialog = screen.getByRole("dialog", { name: "Add Child Profile" });
    tutorial = screen.getByRole("region", { name: "Parent first child tutorial" });
    expect(within(tutorial).getByText("Step 2 of 8")).toBeInTheDocument();
    expect(within(tutorial).getByRole("heading", { name: "Type your child's name" })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Child name"), { target: { value: "Kai Cho" } });
    expect(within(screen.getByRole("region", { name: "Parent first child tutorial" })).getByRole("heading", { name: "Add their age" })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Child age"), { target: { value: "7" } });
    expect(within(screen.getByRole("region", { name: "Parent first child tutorial" })).getByRole("heading", { name: "Create their username" })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Child username"), { target: { value: "kai-cho.child" } });
    expect(within(screen.getByRole("region", { name: "Parent first child tutorial" })).getByRole("heading", { name: "Create their password" })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Child password"), { target: { value: "Dragon123" } });
    expect(within(screen.getByRole("region", { name: "Parent first child tutorial" })).getByRole("heading", { name: "Confirm the current belt" })).toBeInTheDocument();

    fireEvent.focus(within(dialog).getByLabelText("Current belt"));
    expect(within(screen.getByRole("region", { name: "Parent first child tutorial" })).getByRole("heading", { name: "Save the profile" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save Child Profile" }));
    expect(screen.queryByRole("dialog", { name: "Add Child Profile" })).not.toBeInTheDocument();
    tutorial = screen.getByRole("region", { name: "Parent first child tutorial" });
    expect(within(tutorial).getByText("Step 8 of 8")).toBeInTheDocument();
    expect(within(tutorial).getByRole("heading", { name: "First child profile created" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Kai Cho profile" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(tutorial).getByRole("button", { name: "Finish" }));
    expect(screen.queryByRole("region", { name: "Parent first child tutorial" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(parentTutorialKey("parent123@chos.prototype"))).toBe("completed");
    expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ parentEmail: "parent123@chos.prototype", name: "Kai Cho", username: "kai-cho.child", password: "Dragon123", age: "7", beltSlug: "white" })
    ]));
  });

  it.skip("lets first-time parents open the new child account from the tutorial handoff", async () => {
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    renderLoggedInApp("/", "guardian");

    await screen.findByRole("region", { name: "Parent first child tutorial" });
    fireEvent.click(screen.getByRole("button", { name: "Add Child Profile" }));
    const dialog = screen.getByRole("dialog", { name: "Add Child Profile" });
    fireEvent.change(within(dialog).getByLabelText("Child name"), { target: { value: "Kai Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Child age"), { target: { value: "7" } });
    fireEvent.change(within(dialog).getByLabelText("Child username"), { target: { value: "kai-cho.child" } });
    fireEvent.change(within(dialog).getByLabelText("Child password"), { target: { value: "Dragon123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Child Profile" }));

    const tutorial = screen.getByRole("region", { name: "Parent first child tutorial" });
    fireEvent.click(within(tutorial).getByRole("button", { name: "Open Kai Cho's Student Side" }));

    expect(await screen.findByLabelText("Student profile page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Student reference profile card")).toBeInTheDocument();
    expect(screen.getByLabelText("Student reference weekly schedule")).toBeInTheDocument();
    expect(screen.getByLabelText("Student reference belt journey")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Practice Tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Student's Panel" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kai Cho" })).toBeInTheDocument();
    expect(screen.getByText("Rank: White Belt")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Talia Brooks" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "kai-cho.child", remembered: true });
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toContainEqual({ email: "kai-cho.child", role: "student" });
    expect(window.localStorage.getItem(parentTutorialKey("parent123@chos.prototype"))).toBe("completed");
  });

  it("does not show the guided setup section or auto-start for parents with child profiles", () => {
    renderLoggedInApp("/", "guardian");

    expect(screen.queryByRole("region", { name: "Parent first child tutorial" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Parent student setup guide")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replay Tutorial" })).not.toBeInTheDocument();
  });

  it.skip("lets first-time parents skip the tutorial and suppresses the next auto-start", async () => {
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    const firstRender = renderLoggedInApp("/", "guardian");

    const tutorial = await screen.findByRole("region", { name: "Parent first child tutorial" });
    fireEvent.click(within(tutorial).getByRole("button", { name: "Skip tutorial" }));
    expect(screen.queryByRole("region", { name: "Parent first child tutorial" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(parentTutorialKey("parent123@chos.prototype"))).toBe("skipped");

    firstRender.unmount();
    renderLoggedInApp("/", "guardian");
    expect(screen.queryByRole("region", { name: "Parent first child tutorial" })).not.toBeInTheDocument();
  });

  it.skip("keeps a one-tap child handoff after a skipped tutorial first-child save", async () => {
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([]));
    window.localStorage.setItem(parentTutorialKey("parent123@chos.prototype"), "skipped");
    renderLoggedInApp("/", "guardian");

    fireEvent.click(screen.getByRole("button", { name: "Add Child Profile" }));
    const dialog = screen.getByRole("dialog", { name: "Add Child Profile" });
    fireEvent.change(within(dialog).getByLabelText("Child name"), { target: { value: "Kai Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Child age"), { target: { value: "7" } });
    fireEvent.change(within(dialog).getByLabelText("Child username"), { target: { value: "kai-cho.child" } });
    fireEvent.change(within(dialog).getByLabelText("Child password"), { target: { value: "Dragon123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Child Profile" }));

    const handoff = await screen.findByRole("region", { name: "Child account handoff" });
    expect(within(handoff).getByText("Kai Cho is ready to use the student side.")).toBeInTheDocument();
    fireEvent.click(within(handoff).getByRole("button", { name: "Open Kai Cho's Student Side" }));

    expect(await screen.findByLabelText("Student profile page")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "kai-cho.child", remembered: true });
  });

  it.skip("filters the Home feed by message and event notification count controls", () => {
    renderLoggedInApp("/profile");

    const messageFilter = screen.getByRole("button", { name: "5 Messages" });
    const eventFilter = screen.getByRole("button", { name: "2 Event Notifications" });

    expect(messageFilter).toHaveAttribute("aria-pressed", "false");
    expect(eventFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Head Coach.*Practice Session Reminder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i })).toBeInTheDocument();

    fireEvent.click(messageFilter);

    expect(messageFilter).toHaveAttribute("aria-pressed", "true");
    expect(eventFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Head Coach.*Practice Session Reminder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /John Doe.*Attendance Confirmation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Talia Brooks.*Thank you, I will be there for training/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /System Admin.*Event Update: Summer Championship/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Event Team.*Upcoming Event: Parent Meeting/i })).not.toBeInTheDocument();

    fireEvent.click(eventFilter);

    expect(messageFilter).toHaveAttribute("aria-pressed", "false");
    expect(eventFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /Head Coach.*Practice Session Reminder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /John Doe.*Attendance Confirmation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Talia Brooks.*Thank you, I will be there for training/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Event Team.*Upcoming Event: Parent Meeting/i })).toBeInTheDocument();

    fireEvent.click(eventFilter);

    expect(messageFilter).toHaveAttribute("aria-pressed", "false");
    expect(eventFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Head Coach.*Practice Session Reminder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i })).toBeInTheDocument();
  });

  it.skip("lets managers compose messages and event notifications from the Home feed header", () => {
    renderLoggedInApp("/profile");

    const feedPanel = screen.getByLabelText("Messages and event notifications");
    const composeButton = within(feedPanel).getByRole("button", { name: "Compose" });

    expect(composeButton.closest(".manager-home-feed-counts")).toBeInTheDocument();

    fireEvent.click(composeButton);

    const dialog = screen.getByRole("dialog", { name: "Compose" });
    expect(within(dialog).getByRole("radio", { name: "Contact Message" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Event Notification" })).toBeInTheDocument();
    expect(dialog.querySelector(".manager-compose-all-users")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Recipients")).toBeInTheDocument();
    expect(within(dialog).getByText("0 selected")).toBeInTheDocument();
    const selectedPanel = within(dialog).getByLabelText("Selected compose recipients");
    expect(within(selectedPanel).getByText("No contacts selected yet.")).toBeInTheDocument();
    const quickActions = within(dialog).getByLabelText("Quick recipient actions");
    expect(within(quickActions).getByText("Quick Audience")).toBeInTheDocument();
    expect(within(quickActions).getByText("Tap an active preset again to clear.")).toBeInTheDocument();
    const allUsersQuickAction = within(quickActions).getByRole("checkbox", { name: "All Users" });
    const allStaffQuickAction = within(quickActions).getByRole("checkbox", { name: "All Staff" });
    const allStudentsQuickAction = within(quickActions).getByRole("checkbox", { name: "All Students" });
    expect(allUsersQuickAction).not.toBeChecked();
    expect(allStaffQuickAction).not.toBeChecked();
    expect(allStudentsQuickAction).not.toBeChecked();
    fireEvent.click(allStaffQuickAction);
    expect(allStaffQuickAction).toBeChecked();
    expect(within(dialog).getByText("1 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("All Staff")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("1 contact")).toBeInTheDocument();
    fireEvent.click(allStaffQuickAction);
    expect(allStaffQuickAction).not.toBeChecked();
    expect(within(dialog).getByText("0 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("No contacts selected yet.")).toBeInTheDocument();
    fireEvent.click(allStudentsQuickAction);
    expect(allStudentsQuickAction).toBeChecked();
    expect(within(dialog).getByText("17 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("All Students")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("17 contacts")).toBeInTheDocument();
    expect(within(selectedPanel).queryByText("All Staff")).not.toBeInTheDocument();
    fireEvent.click(allStudentsQuickAction);
    expect(allStudentsQuickAction).not.toBeChecked();
    expect(within(dialog).getByText("0 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("No contacts selected yet.")).toBeInTheDocument();
    fireEvent.click(allUsersQuickAction);
    expect(allUsersQuickAction).toBeChecked();
    expect(within(selectedPanel).getByText("All Users")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("35 contacts")).toBeInTheDocument();
    fireEvent.click(allUsersQuickAction);
    expect(allUsersQuickAction).not.toBeChecked();
    expect(within(dialog).getByText("0 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("No contacts selected yet.")).toBeInTheDocument();
    const contactsButton = within(dialog).getByRole("button", { name: "Contacts" });
    expect(contactsButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Contacts" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: /Talia Brooks/i })).not.toBeInTheDocument();

    fireEvent.click(contactsButton);

    expect(contactsButton).toHaveAttribute("aria-expanded", "true");
    const contactsDialog = screen.getByRole("dialog", { name: "Contacts" });
    expect(within(contactsDialog).getByText("35 visible · 0 selected")).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("heading", { name: "Staff" })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("heading", { name: "Parents" })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("checkbox", { name: /Instructor Team/i })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("checkbox", { name: /Talia Brooks/i })).not.toBeChecked();
    expect(within(contactsDialog).getByRole("checkbox", { name: /Monica Brooks/i })).not.toBeChecked();
    const studentsContacts = within(contactsDialog).getByRole("group", { name: "Students contacts" });
    const parentsContacts = within(contactsDialog).getByRole("group", { name: "Parents contacts" });
    const collapseStudentsButton = within(studentsContacts).getByRole("button", { name: "Collapse Students" });
    fireEvent.click(collapseStudentsButton);
    expect(within(studentsContacts).getByRole("button", { name: "Expand Students" })).toHaveAttribute("aria-expanded", "false");
    expect(within(studentsContacts).queryByRole("checkbox", { name: /Talia Brooks/i })).not.toBeInTheDocument();
    fireEvent.click(within(studentsContacts).getByRole("button", { name: "Expand Students" }));
    expect(within(studentsContacts).getByRole("button", { name: "Collapse Students" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(studentsContacts).getByRole("button", { name: "Select all Students" }));
    expect(allUsersQuickAction).not.toBeChecked();
    expect(within(dialog).getByText("17 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("All Students")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("17 contacts")).toBeInTheDocument();
    expect(within(selectedPanel).queryByText("Talia Brooks")).not.toBeInTheDocument();
    expect(within(contactsDialog).getByText("35 visible · 17 selected")).toBeInTheDocument();
    expect(within(studentsContacts).getByRole("checkbox", { name: /Talia Brooks/i })).toBeChecked();
    expect(within(parentsContacts).getByRole("checkbox", { name: /Monica Brooks/i })).not.toBeChecked();
    fireEvent.click(within(contactsDialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Contacts" })).not.toBeInTheDocument();
    fireEvent.click(allUsersQuickAction);
    expect(within(selectedPanel).getByText("All Users")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("35 contacts")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Event Notification" }));
    fireEvent.change(within(dialog).getByLabelText("Subject"), { target: { value: "Weather Closure" } });
    fireEvent.change(within(dialog).getByLabelText("Message body"), {
      target: { value: "The studio is closed tonight because of severe weather." }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send Compose" }));

    expect(screen.queryByRole("dialog", { name: "Compose" })).not.toBeInTheDocument();
    expect(screen.getByText("3 Event Notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cho's Manager.*Weather Closure/i })).toBeInTheDocument();
    expect(screen.getByText("Compose sent to all users.")).toBeInTheDocument();
  }, 15000);

  it("excludes inactive students and parents from manager compose audiences", async () => {
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-active",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-0111",
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-inactive",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        guardianName: "Terry Miles",
        guardianPhone: "(262) 555-0112",
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));
    renderLoggedInApp("/profile");

    const feedPanel = screen.getByLabelText("Messages and event notifications");
    fireEvent.click(within(feedPanel).getByRole("button", { name: "Compose" }));

    const dialog = screen.getByRole("dialog", { name: "Compose" });
    const selectedPanel = within(dialog).getByLabelText("Selected compose recipients");
    const quickActions = within(dialog).getByLabelText("Quick recipient actions");
    const allStudentsQuickAction = within(quickActions).getByRole("checkbox", { name: "All Students" });
    const allUsersQuickAction = within(quickActions).getByRole("checkbox", { name: "All Users" });
    fireEvent.click(allStudentsQuickAction);

    expect(within(dialog).getByText("1 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("All Students")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("1 contact")).toBeInTheDocument();

    fireEvent.click(allUsersQuickAction);

    expect(within(selectedPanel).getByText("All Users")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("3 contacts")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Contacts" }));
    const contactsDialog = screen.getByRole("dialog", { name: "Contacts" });
    expect(within(contactsDialog).getByText("3 visible · 3 selected")).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("checkbox", { name: /Ari Nguyen/i })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("checkbox", { name: /Mina Nguyen/i })).toBeInTheDocument();
    expect(within(contactsDialog).queryByRole("checkbox", { name: /Cora Miles/i })).not.toBeInTheDocument();
    expect(within(contactsDialog).queryByRole("checkbox", { name: /Terry Miles/i })).not.toBeInTheDocument();
    fireEvent.click(within(contactsDialog).getByRole("button", { name: "Done" }));

    fireEvent.change(within(dialog).getByLabelText("Subject"), { target: { value: "Schedule Reminder" } });
    fireEvent.change(within(dialog).getByLabelText("Message body"), { target: { value: "Please check this week's training schedule." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send Compose" }));

    await waitFor(() => {
      const savedDirectMessages = JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]") as Array<{ recipientId: string; recipientName: string }>;
      expect(savedDirectMessages).toHaveLength(3);
      expect(savedDirectMessages).toEqual(expect.arrayContaining([
        expect.objectContaining({ recipientId: "direct-staff-instructors", recipientName: "Instructor Team" }),
        expect.objectContaining({ recipientId: "student-active", recipientName: "Ari Nguyen" }),
        expect.objectContaining({ recipientId: "parent-student-active", recipientName: "Mina Nguyen" })
      ]));
      expect(savedDirectMessages.some((message) => message.recipientId === "student-inactive" || message.recipientId === "parent-student-inactive")).toBe(false);
    });
  }, 15000);

  it("logs out from the manager home icon button", () => {
    renderLoggedInApp("/profile");

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
  });

  it("collapses, expands, and drag-adjusts the manager overview from the Home handle", () => {
    stubResizeObserver(360);
    renderLoggedInApp("/profile");

    const homeOverview = screen.getByLabelText("Manager home overview");
    const overviewStage = homeOverview.closest(".manager-home-overview-stage");
    const feedPanel = screen.getByLabelText("Messages and event notifications");
    expect(overviewStage).toHaveAttribute("data-overview-state", "expanded");

    fireEvent.click(screen.getByRole("button", { name: "Collapse manager overview" }));

    expect(overviewStage).toHaveAttribute("data-overview-state", "collapsed");
    const expandHandle = screen.getByRole("button", { name: "Expand manager overview" });
    expect(expandHandle).toHaveAttribute("aria-expanded", "false");
    expect(feedPanel).toBeInTheDocument();

    fireEvent.click(expandHandle);

    const collapseHandle = screen.getByRole("button", { name: "Collapse manager overview" });
    expect(overviewStage).toHaveAttribute("data-overview-state", "expanded");
    expect(collapseHandle).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(collapseHandle, { pointerId: 1, clientY: 300 });
    fireEvent.pointerMove(collapseHandle, { pointerId: 1, clientY: 192 });
    fireEvent.pointerUp(collapseHandle, { pointerId: 1, clientY: 192 });

    expect(overviewStage).toHaveAttribute("data-overview-state", "partial");
    expect(Number(overviewStage?.getAttribute("data-overview-progress"))).toBeLessThan(1);
    expect(feedPanel).toBeInTheDocument();
  });

  it("lets managers update the Home profile picture in real time", async () => {
    renderLoggedInApp("/profile");

    const profileOverview = within(screen.getByLabelText("Manager home overview")).getByLabelText("Manager profile overview");
    const profileImage = within(profileOverview).getByRole("img", { name: "Cho's Manager profile portrait" });
    const photoUpload = within(profileOverview).getByLabelText("Upload manager profile picture") as HTMLInputElement;

    expect(profileImage).toHaveAttribute("src", expect.stringContaining("assets/CheetahProfilePic/Cheetah.png"));
    expect(photoUpload).toHaveAttribute("type", "file");
    expect(photoUpload.closest(".manager-home-profile-frame")).toBeInTheDocument();

    fireEvent.change(photoUpload, {
      target: {
        files: [new File(["manager profile"], "manager-profile.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(profileImage).toHaveAttribute("src", expect.stringContaining("data:image/png;base64,"));
    });

    const savedProfile = JSON.parse(window.localStorage.getItem("chos.profile.v1") ?? "{}") as { photoDataUrl?: string };
    expect(savedProfile.photoDataUrl).toContain("data:image/png;base64,");
  });

  it("opens profile settings from the Home profile card icon", async () => {
    renderLoggedInApp("/profile");

    const profileOverview = within(screen.getByLabelText("Manager home overview")).getByLabelText("Manager profile overview");
    const profileSettingsLink = within(profileOverview).getByRole("link", { name: "Profile Settings" });

    expect(profileSettingsLink).toHaveAttribute("href", "/manager?profile=settings");
    expect(profileSettingsLink.querySelector("img.manager-home-profile-settings-icon")).toHaveAttribute("src", expect.stringContaining("ManagerProfileSettings.png"));

    fireEvent.click(profileSettingsLink);

    expect(await screen.findByRole("dialog", { name: "Manager profile settings" })).toBeInTheDocument();
  });

  it("toggles light and dark mode from the Home profile card without a toast", () => {
    renderLoggedInApp("/profile");

    const profileOverview = within(screen.getByLabelText("Manager home overview")).getByLabelText("Manager profile overview");
    const themeSwitch = within(profileOverview).getByRole("switch", { name: "Switch to light mode" });

    expect(themeSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(themeSwitch);

    const savedProfile = JSON.parse(window.localStorage.getItem("chos.profile.v1") || "{}");
    expect(savedProfile.theme).toBe("light");
    expect(window.localStorage.getItem("chos.theme.v1")).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(within(profileOverview).getByRole("switch", { name: "Switch to dark mode" })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("Light mode enabled.")).not.toBeInTheDocument();
    expect(screen.queryByText("Dark mode enabled.")).not.toBeInTheDocument();
  });

  it("lets managers save a personal visual color theme from Profile Settings", () => {
    renderLoggedInApp("/manager?profile=settings");

    const dialog = screen.getByRole("dialog", { name: "Manager profile settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Editing Tool" }));
    const editor = screen.getByRole("dialog", { name: "Editing Tool color editor" });
    expect(within(editor).getByText("Live preview active")).toBeInTheDocument();
    const miniScreen = within(editor).getByLabelText("Live profile mini screen");
    expect(within(miniScreen).getByText("Cho's Manager")).toBeInTheDocument();
    expect(within(miniScreen).getByText("Head Coach & Manager")).toBeInTheDocument();

    fireEvent.change(within(editor).getByLabelText("Primary accent color"), { target: { value: "#22c55e" } });
    fireEvent.change(within(editor).getByLabelText("Button color"), { target: { value: "#0ea5e9" } });
    fireEvent.change(within(editor).getByLabelText("Button text color"), { target: { value: "#ffffff" } });

    expect(document.documentElement).toHaveAttribute("data-custom-colors", "true");
    expect(document.documentElement.style.getPropertyValue("--user-visual-primary")).toBe("#22c55e");
    expect((within(editor).getByLabelText("Live color preview") as HTMLElement).style.getPropertyValue("--user-visual-primary")).toBe("#22c55e");
    expect(window.localStorage.getItem(visualThemeKey("manager123@chos.prototype"))).toBeNull();

    fireEvent.click(within(editor).getByRole("button", { name: "Save Colors" }));

    const savedTheme = JSON.parse(window.localStorage.getItem(visualThemeKey("manager123@chos.prototype")) ?? "{}");
    expect(savedTheme).toEqual(expect.objectContaining({ primary: "#22c55e", button: "#0ea5e9", buttonText: "#ffffff" }));
    expect(screen.getByText("Personal color theme saved. Changes are live now.")).toBeInTheDocument();
  });

  it("lets managers save Profile as their first page from Profile Settings", () => {
    const managerView = renderLoggedInApp("/manager?profile=settings");

    const dialog = screen.getByRole("dialog", { name: "Manager profile settings" });
    const firstPageSelect = within(dialog).getByLabelText("First page after login");
    expect(firstPageSelect).toHaveValue("live-chat");

    fireEvent.change(firstPageSelect, { target: { value: "profile" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Profile Settings" }));

    expect(JSON.parse(window.localStorage.getItem(scopedProfileKey("manager", "manager123@chos.prototype")) ?? "{}")).toMatchObject({ landingPage: "profile" });

    managerView.unmount();
    renderLoggedInApp("/");

    expect(screen.getByLabelText("Manager home page")).toBeInTheDocument();
    expect(screen.queryByLabelText("Live chat room page")).not.toBeInTheDocument();
  });

  it.skip("exposes the Editing Tool inside student Profile Settings", () => {
    renderLoggedInApp("/", "student");

    const profileOverview = screen.getByLabelText("Student reference profile card");
    fireEvent.click(within(profileOverview).getByRole("button", { name: "Profile Settings" }));

    const dialog = screen.getByRole("dialog", { name: "Student profile settings" });
    expect(within(dialog).getByRole("button", { name: "Editing Tool" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Editing Tool" }));
    const editor = screen.getByRole("dialog", { name: "Editing Tool color editor" });
    const miniScreen = within(editor).getByLabelText("Live profile mini screen");
    expect(within(miniScreen).getByText("Student Profile")).toBeInTheDocument();
    expect(within(miniScreen).getByText(/Student$/)).toBeInTheDocument();
  });

  it.skip("lets students save Student Panel as their first page from Profile Settings", () => {
    const studentView = renderLoggedInApp("/", "student");

    const profileOverview = screen.getByLabelText("Student reference profile card");
    fireEvent.click(within(profileOverview).getByRole("button", { name: "Profile Settings" }));
    const dialog = screen.getByRole("dialog", { name: "Student profile settings" });
    const firstPageSelect = within(dialog).getByLabelText("First page after login");

    fireEvent.change(firstPageSelect, { target: { value: "student-panel" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Profile Settings" }));

    expect(JSON.parse(window.localStorage.getItem(scopedProfileKey("student", "student123@chos.prototype")) ?? "{}")).toMatchObject({ landingPage: "student-panel" });

    studentView.unmount();
    renderLoggedInApp("/", "student");

    expect(screen.getByLabelText("Student dashboard")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Student's Panel" })).toBeInTheDocument();
  });

  it.skip("exposes parent Profile Settings with the Editing Tool", () => {
    renderLoggedInApp("/", "guardian");

    fireEvent.click(screen.getByRole("button", { name: "Profile Settings" }));

    const dialog = screen.getByRole("dialog", { name: "Parent profile settings" });
    expect(within(dialog).getByRole("button", { name: "Editing Tool" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Editing Tool" }));
    const editor = screen.getByRole("dialog", { name: "Editing Tool color editor" });
    const miniScreen = within(editor).getByLabelText("Live profile mini screen");
    expect(within(miniScreen).getAllByText("Family Profile").length).toBeGreaterThan(0);
    expect(within(miniScreen).getByText("Kids Profiles")).toBeInTheDocument();
    fireEvent.change(within(editor).getByLabelText("Background color"), { target: { value: "#102030" } });

    expect(document.documentElement.style.getPropertyValue("--user-visual-background")).toBe("#102030");
    expect((within(editor).getByLabelText("Live color preview") as HTMLElement).style.getPropertyValue("--user-visual-background")).toBe("#102030");
    expect(window.localStorage.getItem(visualThemeKey("parent123@chos.prototype"))).toBeNull();

    fireEvent.click(within(editor).getByRole("button", { name: "Save Colors" }));

    expect(JSON.parse(window.localStorage.getItem(visualThemeKey("parent123@chos.prototype")) ?? "{}")).toEqual(expect.objectContaining({ background: "#102030" }));
  });

  it.skip("lets parents save Messages as their first page from Profile Settings", () => {
    const parentView = renderLoggedInApp("/", "guardian");

    fireEvent.click(screen.getByRole("button", { name: "Profile Settings" }));
    const dialog = screen.getByRole("dialog", { name: "Parent profile settings" });
    const firstPageSelect = within(dialog).getByLabelText("First page after login");

    fireEvent.change(firstPageSelect, { target: { value: "parent-messages" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Profile Settings" }));

    expect(JSON.parse(window.localStorage.getItem(scopedProfileKey("guardian", "parent123@chos.prototype")) ?? "{}")).toMatchObject({ landingPage: "parent-messages" });

    parentView.unmount();
    renderLoggedInApp("/", "guardian");

    expect(screen.getByLabelText("Parent profile page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Messages" })).toHaveAttribute("aria-pressed", "true");
  });

  it.skip("keeps the Home weekly agenda rows compact on busy recurring class days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00-05:00"));
    renderLoggedInApp("/profile");

    const weeklySchedule = within(screen.getByLabelText("Manager home overview")).getByLabelText("Weekly manager schedule");
    fireEvent.click(within(weeklySchedule).getByRole("button", { name: "Select Tuesday, May 19, 2026" }));

    expect(within(weeklySchedule).getByText("Tuesday, May 19, 2026")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Private Intro Lesson")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Youth Foundations")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Family Training")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("12:30 PM")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("5:00 PM")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("6:00 PM")).toBeInTheDocument();
    expect(within(weeklySchedule).queryByText("5:00 PM - 5:45 PM")).not.toBeInTheDocument();
    expect(within(weeklySchedule).queryByText("6:00 PM - 6:50 PM")).not.toBeInTheDocument();
  });

  it.skip("lets managers select multiple home feed items and delete them together", () => {
    renderLoggedInApp("/profile");

    expect(screen.queryByRole("button", { name: "Delete selected" })).not.toBeInTheDocument();

    const attendanceCheckbox = screen.getByRole("checkbox", { name: "Select Attendance Confirmation" });
    const eventCheckbox = screen.getByRole("checkbox", { name: "Select Event Update: Summer Championship" });

    fireEvent.click(attendanceCheckbox);
    fireEvent.click(eventCheckbox);

    expect(attendanceCheckbox).toBeChecked();
    expect(eventCheckbox).toBeChecked();
    expect(screen.queryByLabelText("Attendance Confirmation details")).not.toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(screen.queryByText("Attendance Confirmation")).not.toBeInTheDocument();
    expect(screen.queryByText("Event Update: Summer Championship")).not.toBeInTheDocument();
    expect(screen.getByText("4 Messages")).toBeInTheDocument();
    expect(screen.getByText("1 Event Notification")).toBeInTheDocument();
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete selected" })).not.toBeInTheDocument();
  });

  it("logs out from the manager launcher icon button", () => {
    renderLoggedInApp("/manager");

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
  });

  it.skip("opens the manager landing launcher with the approved icon order", () => {
    renderLoggedInApp("/manager");

    const managerHeader = screen.getByLabelText("Manager panel page header");
    expect(within(managerHeader).getByRole("heading", { name: "MANAGER PANEL" })).toBeInTheDocument();
    expect(within(managerHeader).queryByRole("button", { name: "Profile Settings" })).not.toBeInTheDocument();
    expect(within(managerHeader).queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(managerHeader.querySelectorAll(".manager-home-title-rule")).toHaveLength(2);
    expect(managerHeader.querySelector(".manager-launcher-title-icon")).not.toBeInTheDocument();
    const managerProfileLink = within(managerHeader).getByRole("link", { name: "Profile" });
    expect(managerProfileLink).toHaveAttribute("href", "/profile");
    expect(managerProfileLink.querySelector("img.manager-home-profile-action-photo")).toHaveAttribute("src", expect.stringContaining("assets/CheetahProfilePic/Cheetah.png"));
    expect(within(managerProfileLink).getByText("Profile")).toBeInTheDocument();
    expect(managerHeader.querySelector(".manager-home-top-actions")).toBeInTheDocument();
    const launcherLogoutButton = within(managerHeader).getByRole("button", { name: "Log Out" });
    expect(launcherLogoutButton).toHaveTextContent("Log Out");
    expect(launcherLogoutButton.querySelector("img.manager-home-logout-icon")).toHaveAttribute("src", expect.stringContaining("ManagerLogoutProfessional.png"));
    expect(screen.queryByText("Tools and settings are organized below so you can jump into each manager page quickly.")).not.toBeInTheDocument();
    expect(screen.queryByText("Use the icons to open messages, students, classes, scheduling, events, merchandise, and future reports.")).not.toBeInTheDocument();

    const launcher = screen.getByLabelText("Manager app launcher");
    expect(launcher).toHaveClass("manager-launcher-sidebar");
    expect(launcher).toHaveAttribute("data-orientation", "vertical");
    expect(launcher.parentElement).toHaveClass("manager-launcher-body");
    const launcherLinks = within(launcher).getAllByRole("link");

    const approvedIconOrder = [
      "Dashboard",
      "Create",
      "Messages",
      "Students",
      "Classes",
      "Study Guide",
      "Events",
      "Scheduling",
      "Merchandise",
      "Videos",
      "Reports"
    ];
    expect(launcherLinks.map((link) => link.textContent?.trim())).toEqual(approvedIconOrder);
    expect(launcherLinks.map((link) => link.getAttribute("title"))).toEqual(approvedIconOrder);
    expect(launcherLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/manager?tool=dashboard",
      "/manager?tool=create",
      "/manager?tool=messages",
      "/manager?tool=students",
      "/manager?tool=classes",
      "/manager?tool=studyGuide",
      "/manager?tool=events",
      "/manager?tool=scheduling",
      "/manager?tool=merchandise",
      "/manager?tool=videos",
      "/manager?tool=reports"
    ]);
    expect(within(launcher).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    const launcherImages = launcher.querySelectorAll("img.manager-launcher-image");
    const launcherLabels = launcher.querySelectorAll(".manager-launcher-label");
    expect(launcherImages).toHaveLength(8);
    expect(launcher.querySelector(".manager-launcher-symbol--create")).toBeInTheDocument();
    expect(launcher.querySelector(".manager-launcher-symbol--studyGuide")).toBeInTheDocument();
    expect(launcher.querySelector(".manager-launcher-symbol--videos")).toBeInTheDocument();
    expect(launcherLabels).toHaveLength(11);
    expect(Array.from(launcherLabels).map((label) => label.textContent?.trim())).toEqual(approvedIconOrder);
    launcherImages.forEach((image) => {
      expect(image).toHaveAttribute("src", expect.stringContaining(".webp"));
      expect(image).not.toHaveAttribute("width");
      expect(image).not.toHaveAttribute("height");
      expect(image).toHaveAttribute("draggable", "false");
      expect(image.parentElement).toHaveClass("manager-launcher-graphic");
    });

    const studentsIcon = within(launcher).getByRole("link", { name: "Students" }).querySelector("img.manager-students-emblem");
    expect(studentsIcon).not.toBeNull();
    expect(studentsIcon).toHaveAttribute("src", expect.stringContaining("Students.webp"));
    expect(screen.getByLabelText("Dashboard workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Live studio calendar")).toBeInTheDocument();
    fireEvent.click(within(launcher).getByRole("link", { name: "Students" }));
    expect(screen.getByLabelText("Students workspace")).toBeInTheDocument();
    expect(within(launcher).getByRole("link", { name: "Students" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("20 students listed by belt. Select a name to open student info.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Awakening Dojo" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager quick actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Student Management & Communication" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quick Stats" })).not.toBeInTheDocument();
  });

  it("opens the developer owner launcher with Create and Developer tools", () => {
    renderLoggedInDeveloperApp("/manager");

    const developerHeader = screen.getByLabelText("Developer panel page header");
    expect(within(developerHeader).getByRole("heading", { name: "DEVELOPER PANEL" })).toBeInTheDocument();
    const launcher = screen.getByLabelText("Developer app launcher");
    expect(within(launcher).getByRole("link", { name: "Create" })).toHaveAttribute("href", "/manager?tool=create");
    expect(within(launcher).getByRole("link", { name: "Developer" })).toHaveAttribute("href", "/manager?tool=developer");
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toContainEqual({ email: "dev123@chos.prototype", role: "guardian" });
  });

  it("uses the tiger developer profile image and Developer labels for Dev123", async () => {
    window.localStorage.setItem("chos.profile.v1", JSON.stringify({
      name: "Legacy Manager",
      username: "legacy-manager",
      email: "manager123@chos.prototype",
      phone: "(262) 555-0111",
      updates: true,
      theme: "dark",
      landingPage: "profile",
      photoDataUrl: "data:image/png;base64,legacy-manager-photo"
    }));

    renderLoggedInDeveloperApp("/profile");

    expect(screen.getByLabelText("Developer home page")).toBeInTheDocument();
    const profileTitleHeader = screen.getByLabelText("Profile page header");
    const developerPanelLink = within(profileTitleHeader).getByRole("link", { name: "Developer Panel" });
    expect(developerPanelLink).toHaveAttribute("href", "/manager");
    expect(screen.queryByRole("link", { name: "Manager's Panel" })).not.toBeInTheDocument();

    const homeOverview = screen.getByLabelText("Developer home overview");
    const profileOverview = within(homeOverview).getByLabelText("Developer profile overview");
    expect(within(profileOverview).getByRole("img", { name: "Developer profile portrait" })).toHaveAttribute("src", expect.stringContaining("assets/DeveloperProfilePic/TigerDeveloper.png"));
    expect(within(profileOverview).getByRole("heading", { name: "Developer" })).toBeInTheDocument();
    expect(within(profileOverview).getAllByText("Developer").length).toBeGreaterThanOrEqual(2);
    expect(within(profileOverview).getByLabelText("Upload developer profile picture")).toBeInTheDocument();

    fireEvent.click(within(profileOverview).getByRole("link", { name: "Profile Settings" }));
    expect(await screen.findByRole("dialog", { name: "Developer profile settings" })).toBeInTheDocument();
  });

  it.skip("hides the developer launcher item for the manager owner and staff accounts", () => {
    const managerView = renderLoggedInApp("/manager");
    expect(within(screen.getByLabelText("Manager app launcher")).queryByRole("link", { name: "Developer" })).not.toBeInTheDocument();
    managerView.unmount();

    window.localStorage.clear();
    window.sessionStorage.clear();
    renderManagedStaffApp("/manager", {
      id: "managed-staff-no-dev",
      displayName: "Jordan Lee",
      username: "jordan.staff",
      password: "StaffPass123",
      role: "staff",
      status: "active",
      access: ["dashboard", "reports", "messages"],
      createdAt: "2026-06-01T10:00:00.000Z"
    });

    expect(screen.getByLabelText("Staff app launcher")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Developer" })).not.toBeInTheDocument();
  });

  it("renders safe developer diagnostics without exposing destructive tools", () => {
    renderLoggedInDeveloperApp("/manager?tool=developer");

    expect(screen.getByRole("heading", { name: "Developer Tools" })).toBeInTheDocument();
    const sessionPanel = screen.getByLabelText("Developer session diagnostics");
    expect(within(sessionPanel).getByText("dev123@chos.prototype")).toBeInTheDocument();
    expect(within(sessionPanel).getByText("staff")).toBeInTheDocument();
    expect(within(sessionPanel).getByText("Developer account")).toBeInTheDocument();
    expect(within(sessionPanel).getByText("Owner access")).toBeInTheDocument();

    const environmentPanel = screen.getByLabelText("Developer environment diagnostics");
    expect(within(environmentPanel).getByText("VITE_ENABLE_DEVELOPER_ACCOUNT=true")).toBeInTheDocument();
    expect(within(environmentPanel).getByText(/Supabase auth:/)).toBeInTheDocument();

    const countsPanel = screen.getByLabelText("Developer local data counts");
    expect(within(countsPanel).getByText("Students")).toBeInTheDocument();
    expect(within(countsPanel).getByText("Managed accounts")).toBeInTheDocument();
    expect(within(countsPanel).getByText("Messages")).toBeInTheDocument();

    const routesPanel = screen.getByLabelText("Developer route quick links");
    expect(within(routesPanel).getByRole("link", { name: "Live Chat" })).toHaveAttribute("href", "/live-chat");
    expect(within(routesPanel).getByRole("link", { name: "Create Accounts" })).toHaveAttribute("href", "/manager?tool=create");
    expect(screen.getByRole("button", { name: "Copy Diagnostics JSON" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /seed/i })).not.toBeInTheDocument();
  });

  it.skip("lets managers publish study guide folders while student study routes show student materials", async () => {
    const { unmount } = renderLoggedInApp("/manager?tool=studyGuide");

    const managerLauncher = screen.getByLabelText("Manager app launcher");
    expect(within(managerLauncher).getByRole("link", { name: "Study Guide" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Study Guide workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Manager study guide library")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "White Belt Basics" } });
    fireEvent.change(screen.getByLabelText("Folder subject"), { target: { value: "Foundations" } });
    fireEvent.change(screen.getByLabelText("Folder description"), { target: { value: "Start here for first-rank review." } });
    fireEvent.click(screen.getByRole("button", { name: "Create Folder" }));

    const rootFolder = JSON.parse(window.localStorage.getItem("chos.operations.studyGuideFolders.v1") ?? "[]")[0];
    expect(rootFolder).toEqual(expect.objectContaining({ name: "White Belt Basics", subject: "Foundations" }));

    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Kicks" } });
    fireEvent.change(screen.getByLabelText("Folder subject"), { target: { value: "Front Kick" } });
    fireEvent.change(screen.getByLabelText("Parent folder"), { target: { value: rootFolder.id } });
    fireEvent.click(screen.getByRole("button", { name: "Create Folder" }));

    const folders = JSON.parse(window.localStorage.getItem("chos.operations.studyGuideFolders.v1") ?? "[]");
    const kicksFolder = folders.find((folder: { name: string }) => folder.name === "Kicks");
    expect(kicksFolder).toEqual(expect.objectContaining({ parentId: rootFolder.id, subject: "Front Kick" }));

    fireEvent.change(screen.getByLabelText("Material title"), { target: { value: "Front Kick Checklist" } });
    fireEvent.change(screen.getByLabelText("Material folder"), { target: { value: kicksFolder.id } });
    fireEvent.change(screen.getByLabelText("Material description"), { target: { value: "Read before practicing front kicks at home." } });
    fireEvent.change(screen.getByLabelText("Upload study material file"), {
      target: {
        files: [new File(["front-kick-checklist"], "front-kick-notes.pdf", { type: "application/pdf" })]
      }
    });

    await waitFor(() => expect(screen.getByText("front-kick-notes.pdf ready to publish.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Publish Study Material" }));

    expect(screen.getByText("Front Kick Checklist")).toBeInTheDocument();
    expect(screen.getByText("Read before practicing front kicks at home.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.studyGuideMaterials.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Front Kick Checklist", fileName: "front-kick-notes.pdf", mimeType: "application/pdf", folderId: kicksFolder.id })
    ]));

    unmount();
    renderLoggedInApp("/manager?tool=study", "student");

    expect(screen.getByLabelText("Student dashboard")).toBeInTheDocument();
    const studentLauncher = screen.getByLabelText("Student app launcher");
    expect(within(studentLauncher).getByRole("link", { name: "Study" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Study workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Student study guide materials")).toBeInTheDocument();
    expect(screen.getByText("Front Kick Checklist")).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager study guide library")).not.toBeInTheDocument();
  });

  it.skip("lets managers upload categorized videos while student video routes show student videos", async () => {
    const { unmount } = renderLoggedInApp("/manager?tool=videos");

    const managerLauncher = screen.getByLabelText("Manager app launcher");
    expect(within(managerLauncher).getByRole("link", { name: "Videos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Videos workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Manager video library")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Forms" } });
    fireEvent.change(screen.getByLabelText("Folder subject"), { target: { value: "Beginner Forms" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Folder" }));

    expect(screen.getAllByText("Forms").length).toBeGreaterThan(0);
    expect(screen.getByText("Beginner Forms")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Video title"), { target: { value: "Roundhouse Basics" } });
    fireEvent.change(screen.getByLabelText("Video description"), { target: { value: "Practice chamber, pivot, and clean retraction." } });
    fireEvent.change(screen.getByLabelText("Upload video file"), {
      target: {
        files: [new File(["roundhouse-demo"], "roundhouse-demo.mp4", { type: "video/mp4" })]
      }
    });

    await waitFor(() => expect(screen.getByText("roundhouse-demo.mp4 ready to publish.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Publish Video" }));

    expect(screen.getByText("Roundhouse Basics")).toBeInTheDocument();
    expect(screen.getByText("Practice chamber, pivot, and clean retraction.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.videoFolders.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Forms", subject: "Beginner Forms" })
    ]));
    expect(JSON.parse(window.localStorage.getItem("chos.operations.videos.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Roundhouse Basics", fileName: "roundhouse-demo.mp4", mimeType: "video/mp4" })
    ]));

    unmount();
    renderLoggedInApp("/manager?tool=videos", "student");

    expect(screen.getByLabelText("Student dashboard")).toBeInTheDocument();
    const studentLauncher = screen.getByLabelText("Student app launcher");
    expect(within(studentLauncher).getByRole("link", { name: "Videos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Videos workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Student video library")).toBeInTheDocument();
    expect(screen.getByText("Roundhouse Basics")).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager video library")).not.toBeInTheDocument();
  });

  it("keeps training video folder creation idempotent when the same folder fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.videoFolders.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/manager?tool=videos"]}>
        <AppStateProvider>
          <TrainingVideoFolderDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add video folder twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate video folder returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate video folders: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.videoFolders.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          name: "Forms",
          subject: "Beginner Forms",
          description: "White belt form review videos."
        })
      ]);
    });
  });

  it("keeps study guide folder creation idempotent when the same folder fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.studyGuideFolders.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/manager?tool=studyGuide"]}>
        <AppStateProvider>
          <StudyGuideFolderDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add study folder twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate study folder returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate study folders: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.studyGuideFolders.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          name: "White Belt Basics",
          subject: "Foundations",
          description: "Start here for first-rank review."
        })
      ]);
    });
  });

  it("keeps training video uploads idempotent when the same video fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.videoFolders.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.videos.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/manager?tool=videos"]}>
        <AppStateProvider>
          <TrainingVideoDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add video twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate video returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate videos: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.videos.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          title: "Roundhouse Basics",
          fileName: "roundhouse-demo.mp4",
          mimeType: "video/mp4",
          folderId: expect.any(String)
        })
      ]);
    });
  });

  it("keeps study guide material uploads idempotent when the same material fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.studyGuideFolders.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.studyGuideMaterials.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/manager?tool=studyGuide"]}>
        <AppStateProvider>
          <StudyGuideMaterialDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add study material twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate study material returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate study materials: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.studyGuideMaterials.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          title: "Front Kick Checklist",
          fileName: "front-kick-notes.pdf",
          mimeType: "application/pdf",
          folderId: expect.any(String)
        })
      ]);
    });
  });

  it("collapses and expands the manager launcher sidebar from the glowing rail", () => {
    renderLoggedInApp("/manager");

    const launcherBody = screen.getByLabelText("Manager launcher workspace frame");
    const launcher = screen.getByLabelText("Manager app launcher");
    const collapseRail = screen.getByRole("button", { name: "Collapse manager app launcher" });

    expect(collapseRail).toHaveAttribute("aria-controls", "manager-launcher-sidebar");
    expect(collapseRail).toHaveAttribute("aria-expanded", "true");
    expect(collapseRail.querySelector(".manager-launcher-rail-toggle-bar")).toBeInTheDocument();
    expect(launcherBody).not.toHaveClass("is-sidebar-collapsed");
    expect(launcher).not.toHaveAttribute("hidden");
    expect(within(launcher).getByRole("link", { name: "Dashboard" })).toBeInTheDocument();

    fireEvent.click(collapseRail);

    const expandRail = screen.getByRole("button", { name: "Expand manager app launcher" });
    expect(expandRail).toHaveAttribute("aria-expanded", "false");
    expect(launcherBody).toHaveClass("is-sidebar-collapsed");
    expect(launcher).toHaveAttribute("hidden");
    expect(screen.getByLabelText("Dashboard workspace")).toBeInTheDocument();

    fireEvent.click(expandRail);

    expect(screen.getByRole("button", { name: "Collapse manager app launcher" })).toHaveAttribute("aria-expanded", "true");
    expect(launcherBody).not.toHaveClass("is-sidebar-collapsed");
    expect(launcher).not.toHaveAttribute("hidden");
    expect(within(launcher).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the Manager's Page Messages route focused on message tools", () => {
    renderLoggedInApp("/messages");

    expect(screen.getByRole("heading", { name: "Message Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Messenger Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow-Up Automation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marketing Tool" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Text Log" })).toBeInTheDocument();
    const homeMessengerLink = screen.getByRole("link", { name: "Open Home Page Messages" });
    expect(homeMessengerLink).toHaveAttribute("href", "/profile");
    expect(screen.queryByLabelText("Direct message center")).not.toBeInTheDocument();

    fireEvent.click(homeMessengerLink);

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Messages and event notifications")).toBeInTheDocument();
    expect(screen.queryByLabelText("Direct message center")).not.toBeInTheDocument();
  });

  it("opens the month calendar from the Dashboard icon destination", async () => {
    const { container, unmount } = renderLoggedInApp("/dashboard");

    expect(screen.getByLabelText("Manager workspace")).toHaveClass("manager-full-page-shell");
    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.getByRole("img", { name: "Cho's Martial Arts" })).toBeInTheDocument();
    const dashboardLogoutButton = screen.getByRole("button", { name: "Log Out" });
    expect(dashboardLogoutButton).toHaveTextContent("");
    expect(dashboardLogoutButton.querySelector("img.manager-logout-icon")).toHaveAttribute("src", expect.stringContaining("ManagerLogoutProfessional.png"));
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(container.querySelector(".operations-page-title-copy p")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager app launcher")).not.toBeInTheDocument();
    const liveCalendar = screen.getByLabelText("Live studio calendar");
    const calendarViewControls = within(liveCalendar).getByRole("group", { name: "Calendar view" });
    expect(within(calendarViewControls).getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
    expect(within(liveCalendar).getByRole("grid", { name: /Cho's studio calendar/i })).toHaveClass("manager-calendar-grid--month");
    expect(within(liveCalendar).queryByRole("link", { name: "Manage Schedule" })).not.toBeInTheDocument();

    const scheduleActionButton = within(liveCalendar).getByRole("button", { name: "Open schedule actions" });
    expect(scheduleActionButton.querySelector("svg")).toHaveAttribute("width", "16");
    expect(scheduleActionButton.querySelector("svg")).toHaveAttribute("height", "16");

    fireEvent.click(scheduleActionButton);
    const scheduleActionsDialog = screen.getByRole("dialog", { name: "Add to schedule" });
    expect(within(scheduleActionsDialog).getByRole("link", { name: "Add Event" })).toHaveAttribute("href", "/events?create=event&returnTo=dashboard");
    expect(within(scheduleActionsDialog).getByRole("link", { name: "Add Class" })).toHaveAttribute("href", "/classes?create=class");

    fireEvent.click(within(scheduleActionsDialog).getByRole("link", { name: "Add Event" }));
    expect(await screen.findByRole("dialog", { name: "Add Event" })).toBeInTheDocument();

    unmount();
    renderLoggedInApp("/dashboard");
    const refreshedLiveCalendar = screen.getByLabelText("Live studio calendar");
    fireEvent.click(within(refreshedLiveCalendar).getByRole("button", { name: "Open schedule actions" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Add to schedule" })).getByRole("link", { name: "Add Class" }));
    expect(await screen.findByRole("dialog", { name: "Create Class" })).toBeInTheDocument();
  });

  it("shows every selected Dashboard calendar item below the calendar in time order", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.classes.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-afternoon", title: "Afternoon Leadership Seminar", date: "2026-06-15", time: "2:00 PM", type: "class", notes: "Leadership drills and mat etiquette." },
      { id: "schedule-morning", title: "Morning Board Breaking", date: "2026-06-15", time: "9:00 AM", type: "class", notes: "Board breaking fundamentals." }
    ]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([
      { id: "event-midday", title: "Midday Tournament Check-in", date: "2026-06-15", time: "12:00 PM", details: "Tournament check-in for competitors.", audience: "students" }
    ]));
    renderLoggedInApp("/dashboard");

    const liveCalendar = screen.getByLabelText("Live studio calendar");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: /Select Monday, June 15, 3 calendar items/i }));

    const selectedDateEvents = within(liveCalendar).getByLabelText("Selected date events");
    expect(within(selectedDateEvents).getByRole("heading", { name: "Monday, June 15" })).toBeInTheDocument();
    expect(within(selectedDateEvents).getByText("3 events")).toBeInTheDocument();
    expect(within(selectedDateEvents).getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "9:00 AM, Morning Board Breaking, Class",
      "12:00 PM, Midday Tournament Check-in, students",
      "2:00 PM, Afternoon Leadership Seminar, Class"
    ]);
  });

  it("edits and deletes selected Dashboard calendar events from their cards", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.classes.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([
      { id: "event-orientation", title: "Parent Orientation", date: "2026-06-15", time: "6:00 PM", details: "New family orientation.", audience: "families" },
      { id: "event-picnic", title: "Family Picnic", date: "2026-06-15", time: "7:00 PM", details: "Outdoor family event.", audience: "public" }
    ]));
    renderLoggedInApp("/dashboard");

    const liveCalendar = screen.getByLabelText("Live studio calendar");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: /Select Monday, June 15, 2 calendar items/i }));

    let selectedDateEvents = within(liveCalendar).getByLabelText("Selected date events");
    fireEvent.click(within(selectedDateEvents).getByRole("button", { name: "Edit Parent Orientation" }));

    const editDialog = screen.getByRole("dialog", { name: "Edit Event" });
    fireEvent.change(within(editDialog).getByLabelText("Event title"), { target: { value: "Family Orientation" } });
    fireEvent.change(within(editDialog).getByLabelText("Event time"), { target: { value: "6:30 PM" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save Changes" }));
    expect(screen.queryByRole("dialog", { name: "Edit Event" })).not.toBeInTheDocument();

    selectedDateEvents = within(screen.getByLabelText("Live studio calendar")).getByLabelText("Selected date events");
    expect(within(selectedDateEvents).getByRole("link", { name: "6:30 PM, Family Orientation, families" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.events.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "event-orientation", title: "Family Orientation", time: "6:30 PM" })
    ]));

    fireEvent.click(within(selectedDateEvents).getByRole("button", { name: "Delete Family Picnic" }));

    selectedDateEvents = within(screen.getByLabelText("Live studio calendar")).getByLabelText("Selected date events");
    expect(within(selectedDateEvents).getByText("2 events")).toBeInTheDocument();
    expect(within(selectedDateEvents).getByRole("link", { name: "7:00 PM, Family Picnic, public" })).toBeInTheDocument();

    const deleteDialog = screen.getByRole("dialog", { name: "Delete calendar item?" });
    expect(deleteDialog).toHaveClass("modal-form");
    expect(within(deleteDialog).getByText(/Are you sure you want to delete Family Picnic/i)).toBeInTheDocument();
    expect(within(deleteDialog).queryByText(/This keeps accidental taps/i)).not.toBeInTheDocument();
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete calendar item?" })).not.toBeInTheDocument();
    expect(within(selectedDateEvents).getByRole("link", { name: "7:00 PM, Family Picnic, public" })).toBeInTheDocument();

    fireEvent.click(within(selectedDateEvents).getByRole("button", { name: "Delete Family Picnic" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Delete calendar item?" })).getByRole("button", { name: "Delete Event" }));

    selectedDateEvents = within(screen.getByLabelText("Live studio calendar")).getByLabelText("Selected date events");
    expect(within(selectedDateEvents).getByText("1 event")).toBeInTheDocument();
    expect(within(selectedDateEvents).queryByRole("link", { name: "7:00 PM, Family Picnic, public" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.events.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "event-orientation", title: "Family Orientation", time: "6:30 PM" })
    ]);
  });

  it("returns to the Dashboard calendar and selects a saved event created from the calendar add flow", async () => {
    window.localStorage.setItem("chos.operations.classes.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));
    renderLoggedInApp("/dashboard");

    const liveCalendar = screen.getByLabelText("Live studio calendar");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Open schedule actions" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Add to schedule" })).getByRole("link", { name: "Add Event" }));

    const eventDialog = await screen.findByRole("dialog", { name: "Add Event" });
    fireEvent.change(within(eventDialog).getByLabelText("Event title"), { target: { value: "Calendar Save Check" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event date"), { target: { value: "2026-06-15" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event time"), { target: { value: "7:30 PM" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event details"), { target: { value: "Real-time dashboard calendar verification." } });
    fireEvent.click(within(eventDialog).getByRole("button", { name: "Add Event" }));

    const refreshedCalendar = screen.getByLabelText("Live studio calendar");
    const selectedDateEvents = within(refreshedCalendar).getByLabelText("Selected date events");
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.events.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        title: "Calendar Save Check",
        date: "2026-06-15",
        time: "7:30 PM"
      })
    ]);
    expect(within(refreshedCalendar).getByRole("button", { name: /Select Monday, June 15, 1 calendar item/i })).toHaveAttribute("aria-pressed", "true");
    expect(within(selectedDateEvents).getByRole("heading", { name: "Monday, June 15" })).toBeInTheDocument();
    expect(within(selectedDateEvents).getByRole("link", { name: "7:30 PM, Calendar Save Check, students" })).toBeInTheDocument();
  });

  it("books a Starter Program appointment from the selected Dashboard calendar date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.classes.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));
    renderLoggedInApp("/dashboard");

    const liveCalendar = screen.getByLabelText("Live studio calendar");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: /Select Monday, June 15, no calendar items/i }));
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Starter Program" }));

    const starterDialog = screen.getByRole("dialog", { name: "Starter Program" });
    expect(within(starterDialog).getByText("Monday, June 15")).toBeInTheDocument();
    expect(within(starterDialog).getByLabelText("Appointment Date")).toHaveValue("2026-06-15");
    fireEvent.change(within(starterDialog).getByLabelText("Student's Name"), { target: { value: "Maya Chen" } });
    fireEvent.change(within(starterDialog).getByLabelText("Guardian/Parent Name"), { target: { value: "Olivia Chen" } });
    fireEvent.change(within(starterDialog).getByLabelText("Notification Email or Phone"), { target: { value: "olivia@example.com" } });
    fireEvent.change(within(starterDialog).getByLabelText("Appointment Time"), { target: { value: "4:30 PM" } });
    fireEvent.click(within(starterDialog).getByRole("button", { name: "Book Starter Appointment" }));

    expect(screen.queryByRole("dialog", { name: "Starter Program" })).not.toBeInTheDocument();
    const savedSchedule = JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]");
    expect(savedSchedule).toEqual([
      expect.objectContaining({
        title: "Starter Program - Maya Chen",
        date: "2026-06-15",
        time: "4:30 PM",
        type: "starter-program",
        notes: expect.stringContaining("Guardian/Parent: Olivia Chen")
      })
    ]);
    expect(savedSchedule[0].notes).toContain("Notification contact: olivia@example.com");

    const selectedDateEvents = within(liveCalendar).getByLabelText("Selected date events");
    expect(within(selectedDateEvents).getByText("1 event")).toBeInTheDocument();
    expect(within(selectedDateEvents).getByRole("link", { name: "4:30 PM, Starter Program - Maya Chen, Starter Program" })).toBeInTheDocument();
  });

  it("lets managers switch the Starter Program appointment date before booking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.classes.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));
    renderLoggedInApp("/dashboard");

    const liveCalendar = screen.getByLabelText("Live studio calendar");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: /Select Monday, June 15, no calendar items/i }));
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Starter Program" }));

    const starterDialog = screen.getByRole("dialog", { name: "Starter Program" });
    const appointmentDateInput = within(starterDialog).getByLabelText("Appointment Date");
    expect(appointmentDateInput).toHaveValue("2026-06-15");
    fireEvent.change(appointmentDateInput, { target: { value: "2026-06-18" } });
    expect(within(starterDialog).getByText("Thursday, June 18")).toBeInTheDocument();
    fireEvent.change(within(starterDialog).getByLabelText("Student's Name"), { target: { value: "Noah Park" } });
    fireEvent.change(within(starterDialog).getByLabelText("Appointment Time"), { target: { value: "5:30 PM" } });
    fireEvent.click(within(starterDialog).getByRole("button", { name: "Book Starter Appointment" }));

    const savedSchedule = JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]");
    expect(savedSchedule).toEqual([
      expect.objectContaining({
        title: "Starter Program - Noah Park",
        date: "2026-06-18",
        time: "5:30 PM",
        type: "starter-program"
      })
    ]);
    expect(within(liveCalendar).getByRole("button", { name: /Select Thursday, June 18, 1 calendar item/i })).toHaveAttribute("aria-pressed", "true");
    const selectedDateEvents = within(liveCalendar).getByLabelText("Selected date events");
    expect(within(selectedDateEvents).getByRole("heading", { name: "Thursday, June 18" })).toBeInTheDocument();
    expect(within(selectedDateEvents).getByRole("link", { name: "5:30 PM, Starter Program - Noah Park, Starter Program" })).toBeInTheDocument();
  });

  it("opens the native date picker when managers click the Starter Program appointment date box", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.classes.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));
    const originalShowPicker = HTMLInputElement.prototype.showPicker;
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", { configurable: true, value: showPicker });

    try {
      renderLoggedInApp("/dashboard");

      const liveCalendar = screen.getByLabelText("Live studio calendar");
      fireEvent.click(within(liveCalendar).getByRole("button", { name: "Starter Program" }));

      const starterDialog = screen.getByRole("dialog", { name: "Starter Program" });
      const appointmentDateInput = within(starterDialog).getByLabelText("Appointment Date");
      const appointmentDateBox = within(starterDialog).getByText("Tuesday, June 9").closest("label");
      expect(appointmentDateBox).not.toBeNull();

      fireEvent.click(appointmentDateBox!);

      expect(appointmentDateInput).toHaveFocus();
      expect(showPicker).toHaveBeenCalled();
    } finally {
      if (originalShowPicker) {
        Object.defineProperty(HTMLInputElement.prototype, "showPicker", { configurable: true, value: originalShowPicker });
      } else {
        delete (HTMLInputElement.prototype as Partial<HTMLInputElement>).showPicker;
      }
    }
  });

  it("keeps the Dashboard selected-day calendar panel fixed and marked to fit without visible scrollbars", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.classes.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-morning", title: "Morning Board Breaking", date: "2026-06-09", time: "9:00 AM", type: "class", notes: "Board breaking fundamentals." },
      { id: "schedule-afternoon", title: "Afternoon Leadership Seminar", date: "2026-06-09", time: "2:00 PM", type: "class", notes: "Leadership drills and mat etiquette." },
      { id: "schedule-evening", title: "Evening Sparring Prep", date: "2026-06-09", time: "6:00 PM", type: "class", notes: "Controlled sparring rounds." },
      { id: "schedule-late", title: "Late Open Mat", date: "2026-06-09", time: "7:30 PM", type: "class", notes: "Open mat rounds." }
    ]));
    renderLoggedInApp("/dashboard");

    const selectedDateEvents = within(screen.getByLabelText("Live studio calendar")).getByLabelText("Selected date events");
    const selectedEventList = selectedDateEvents.querySelector(".manager-calendar-selected-list");
    expect(selectedDateEvents).toHaveClass("manager-calendar-selected-panel--fixed");
    expect(selectedEventList).toHaveClass("manager-calendar-selected-list--no-scrollbar");
    expect(selectedEventList).toHaveClass("manager-calendar-selected-list--crowded");
    expect(selectedEventList).toHaveClass("manager-calendar-selected-list--dense");
  });

  it.skip("opens the student launcher for student accounts", () => {
    renderLoggedInApp("/manager", "student");

    expect(screen.getByLabelText("Student dashboard")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Student's Panel" })).toBeInTheDocument();
    expect(screen.getByLabelText("Student app launcher")).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager app launcher")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it.skip("shows a linked student's next upcoming class on the student dashboard", () => {
    const students = [
      {
        id: "student-derek",
        firstName: "Derek",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0219",
        email: "derek@example.com",
        status: "Active",
        beltRank: "Red",
        classesAttended: 83,
        missedClassCount: 0,
        joinedAt: "2025-06-12"
      }
    ];
    const account = {
      id: "managed-derek",
      displayName: "Derek Miles",
      username: "derek.student",
      password: "Dragon123",
      role: "student",
      status: "active",
      access: [],
      studentId: "student-derek",
      createdAt: "2026-05-10T00:00:00.000Z"
    };
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-old-private", title: "Old Private Lesson", date: dateKeyOffset(-1), time: "4:00 PM", type: "private-lesson", studentId: "student-derek" },
      { id: "schedule-general", title: "Youth Foundations", date: dateKeyOffset(1), time: "5:00 PM", type: "class" },
      { id: "schedule-linked", title: "Derek Private Lesson", date: dateKeyOffset(2), time: "4:30 PM", type: "private-lesson", studentId: "student-derek" }
    ]));

    renderManagedStudentApp("/manager?tool=dashboard", account, students);

    const nextClassCard = screen.getByRole("heading", { name: "Next Class" }).closest(".workflow-directory-group") as HTMLElement;
    expect(within(nextClassCard).getByText(dateKeyOffset(2))).toBeInTheDocument();
    expect(within(nextClassCard).getByText("Derek Private Lesson at 4:30 PM")).toBeInTheDocument();
    expect(within(nextClassCard).queryByText("Old Private Lesson at 4:00 PM")).not.toBeInTheDocument();
    expect(within(nextClassCard).queryByText("Youth Foundations at 5:00 PM")).not.toBeInTheDocument();
  });

  it.skip("does not show stale schedule items as a student's next class", () => {
    const students = [
      {
        id: "student-derek",
        firstName: "Derek",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0219",
        email: "derek@example.com",
        status: "Active",
        beltRank: "Red",
        classesAttended: 83,
        missedClassCount: 0,
        joinedAt: "2025-06-12"
      }
    ];
    const account = {
      id: "managed-derek",
      displayName: "Derek Miles",
      username: "derek.student",
      password: "Dragon123",
      role: "student",
      status: "active",
      access: [],
      studentId: "student-derek",
      createdAt: "2026-05-10T00:00:00.000Z"
    };
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-old-private", title: "Old Private Lesson", date: dateKeyOffset(-1), time: "4:00 PM", type: "private-lesson", studentId: "student-derek" },
      { id: "schedule-old-general", title: "Old Youth Class", date: dateKeyOffset(-2), time: "5:00 PM", type: "class" }
    ]));

    renderManagedStudentApp("/manager?tool=dashboard", account, students);

    const nextClassCard = screen.getByRole("heading", { name: "Next Class" }).closest(".workflow-directory-group") as HTMLElement;
    expect(within(nextClassCard).getByText("No date")).toBeInTheDocument();
    expect(within(nextClassCard).getByText("No class is scheduled yet.")).toBeInTheDocument();
    expect(within(nextClassCard).queryByText("Old Private Lesson at 4:00 PM")).not.toBeInTheDocument();
  });

  it.skip("shows the next upcoming studio event on the student dashboard", () => {
    const students = [
      {
        id: "student-derek",
        firstName: "Derek",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0219",
        email: "derek@example.com",
        status: "Active",
        beltRank: "Red",
        classesAttended: 83,
        missedClassCount: 0,
        joinedAt: "2025-06-12"
      }
    ];
    const account = {
      id: "managed-derek",
      displayName: "Derek Miles",
      username: "derek.student",
      password: "Dragon123",
      role: "student",
      status: "active",
      access: [],
      studentId: "student-derek",
      createdAt: "2026-05-10T00:00:00.000Z"
    };
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([
      { id: "event-past", title: "Past Belt Testing", date: dateKeyOffset(-1), time: "10:00 AM", details: "Past event.", audience: "students" },
      { id: "event-later", title: "Later Family Night", date: dateKeyOffset(4), time: "6:30 PM", details: "Later event.", audience: "families" },
      { id: "event-next", title: "Future Belt Testing", date: dateKeyOffset(2), time: "10:00 AM", details: "Upcoming event.", audience: "students" }
    ]));

    renderManagedStudentApp("/manager?tool=dashboard", account, students);

    const nextEventCard = screen.getByRole("heading", { name: "Next Event" }).closest(".workflow-directory-group") as HTMLElement;
    expect(within(nextEventCard).getByText(dateKeyOffset(2))).toBeInTheDocument();
    expect(within(nextEventCard).getByText("Future Belt Testing at 10:00 AM")).toBeInTheDocument();
    expect(within(nextEventCard).queryByText("Past Belt Testing at 10:00 AM")).not.toBeInTheDocument();
    expect(within(nextEventCard).queryByText("Later Family Night at 6:30 PM")).not.toBeInTheDocument();
  });

  it.skip("does not show stale studio events as a student's next event", () => {
    const students = [
      {
        id: "student-derek",
        firstName: "Derek",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0219",
        email: "derek@example.com",
        status: "Active",
        beltRank: "Red",
        classesAttended: 83,
        missedClassCount: 0,
        joinedAt: "2025-06-12"
      }
    ];
    const account = {
      id: "managed-derek",
      displayName: "Derek Miles",
      username: "derek.student",
      password: "Dragon123",
      role: "student",
      status: "active",
      access: [],
      studentId: "student-derek",
      createdAt: "2026-05-10T00:00:00.000Z"
    };
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([
      { id: "event-past", title: "Past Belt Testing", date: dateKeyOffset(-1), time: "10:00 AM", details: "Past event.", audience: "students" },
      { id: "event-older", title: "Old Movie Night", date: dateKeyOffset(-4), time: "6:30 PM", details: "Older event.", audience: "families" }
    ]));

    renderManagedStudentApp("/manager?tool=dashboard", account, students);

    const nextEventCard = screen.getByRole("heading", { name: "Next Event" }).closest(".workflow-directory-group") as HTMLElement;
    expect(within(nextEventCard).getByText("No date")).toBeInTheDocument();
    expect(within(nextEventCard).getByText("No event notification is available yet.")).toBeInTheDocument();
    expect(within(nextEventCard).queryByText("Past Belt Testing at 10:00 AM")).not.toBeInTheDocument();
  });

  it.skip("shows the linked student's real belt progress in the Test tool", () => {
    const students = [
      {
        id: "student-talia",
        firstName: "Talia",
        lastName: "Brooks",
        phone: "(262) 555-0201",
        email: "talia@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-04-06"
      },
      {
        id: "student-derek",
        firstName: "Derek",
        lastName: "Miles",
        phone: "(262) 555-0219",
        email: "derek@example.com",
        status: "Active",
        beltRank: "Red",
        classesAttended: 83,
        missedClassCount: 0,
        joinedAt: "2025-06-12"
      }
    ];
    const account = {
      id: "managed-derek",
      displayName: "Derek Miles",
      username: "derek.student",
      password: "Dragon123",
      role: "student",
      status: "active",
      access: [],
      studentId: "student-derek",
      createdAt: "2026-05-10T00:00:00.000Z"
    };

    renderManagedStudentApp("/manager?tool=test", account, students);

    expect(screen.getByRole("heading", { name: "Test" })).toBeInTheDocument();
    expect(screen.getAllByText("Derek Miles").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Red Belt").length).toBeGreaterThan(0);
    expect(screen.getByText("83 of 78 classes")).toBeInTheDocument();
    expect(screen.getByText("Ready for instructor review")).toBeInTheDocument();
    expect(screen.getByText("Attendance rhythm")).toBeInTheDocument();
    expect(screen.queryByText("Talia Brooks")).not.toBeInTheDocument();
  });

  it.skip("redirects student accounts away from staff-only direct operation routes", () => {
    renderLoggedInApp("/students", "student");

    expect(screen.getByLabelText("Student profile page")).toBeInTheDocument();
    expect(screen.queryByLabelText("Students workspace")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create New Student" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manager's Panel" })).not.toBeInTheDocument();
  });

  it.skip("redirects guardian accounts away from staff-only direct operation routes", () => {
    renderLoggedInApp("/schedule", "guardian");

    expect(screen.getByLabelText("Parent profile page")).toBeInTheDocument();
    expect(screen.queryByLabelText("Schedule workspace")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Schedule Event" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manager's Panel" })).not.toBeInTheDocument();
  });

  it("lets the manager edit their own profile settings", () => {
    renderLoggedInApp("/manager?profile=settings");

    const dialog = screen.getByRole("dialog", { name: "Manager profile settings" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Master Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Username"), { target: { value: "master-cho" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "manager@chos.test" } });
    fireEvent.change(within(dialog).getByLabelText("Phone"), { target: { value: "(262) 555-0199" } });
    fireEvent.change(within(dialog).getByLabelText("New Password"), { target: { value: "dojo-pass-2026" } });
    fireEvent.change(within(dialog).getByLabelText("Confirm Password"), { target: { value: "dojo-pass-2026" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Light" }));
    fireEvent.click(within(dialog).getByLabelText("Receive manager updates and reminders"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Profile Settings" }));

    expect(screen.queryByRole("dialog", { name: "Manager profile settings" })).not.toBeInTheDocument();
    expect(screen.getByText("Manager profile settings saved.")).toBeInTheDocument();
    const savedProfile = JSON.parse(window.localStorage.getItem("chos.profile.v1") || "{}");
    expect(savedProfile).toEqual(expect.objectContaining({
      name: "Master Cho",
      username: "master-cho",
      email: "manager@chos.test",
      phone: "(262) 555-0199",
      updates: false,
      theme: "light",
      passwordUpdatedAt: expect.any(String)
    }));
    expect(savedProfile).not.toHaveProperty("password");
    expect(window.localStorage.getItem("chos.theme.v1")).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("returns managers to the Profile page when closing profile settings", () => {
    renderLoggedInApp("/manager?profile=settings");

    const dialog = screen.getByRole("dialog", { name: "Manager profile settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close manager profile settings" }));

    expect(screen.queryByRole("dialog", { name: "Manager profile settings" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Profile page header")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "MANAGER PANEL" })).not.toBeInTheDocument();
  });

  it.skip("opens an actionable reports command center from the manager launcher", () => {
    renderLoggedInApp("/reports");

    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.getByRole("img", { name: "Cho's Martial Arts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workload Command Center" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Current students report metric")).getByText("17")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Missed-class follow-ups report metric")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Low stock items report metric")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Test invites report metric")).getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send missed-class follow-ups" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite belt test candidates" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convert trial students" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restock low inventory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review paused students" })).toBeInTheDocument();
    expect(screen.getAllByText("Maya Robinson").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Serena Park").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Derek Miles").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Victor Lane").length).toBeGreaterThan(0);
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("lets managers mark public leads and starter bookings reviewed from reports", async () => {
    const starterDate = dateKeyOffset(1);
    window.localStorage.setItem("chos.contacts.v1", JSON.stringify([
      {
        id: "contact-ari",
        name: "Ari Nguyen",
        email: "ari@example.com",
        phone: "(262) 555-0101",
        message: "We want to try the starter program.",
        createdAt: `${dateKeyOffset(0)}T10:00:00.000Z`
      }
    ]));
    window.localStorage.setItem("chos.bookings.v1", JSON.stringify([
      { persons: 2, date: starterDate, time: "5:30 PM", timezone: "America/Chicago" },
      { persons: 1, date: dateKeyOffset(3), time: "10:00 AM", timezone: "America/Chicago" }
    ]));

    renderLoggedInApp("/reports");

    expect(within(screen.getByLabelText("Lead follow-ups report metric")).getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review new leads" }));

    expect(await screen.findByText("3 lead follow-ups marked reviewed.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Lead follow-ups report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Review new leads" })).not.toBeInTheDocument();
    const leadsPanel = screen.getByLabelText("Public lead follow-up candidates");
    expect(within(leadsPanel).getByRole("heading", { name: "Public Lead Follow-Up" })).toBeInTheDocument();
    expect(within(leadsPanel).getByText("No public starter bookings or contact inquiries need follow-up.")).toBeInTheDocument();
    expect(within(leadsPanel).queryByText("Ari Nguyen")).not.toBeInTheDocument();
    expect(within(leadsPanel).queryByText(`Starter booking ${starterDate}`)).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.leadReviews.v1") ?? "[]")).toEqual([
      expect.objectContaining({ leadId: "contact-ari", kind: "contact", label: "Ari Nguyen" }),
      expect.objectContaining({ leadId: expect.stringContaining("booking-"), kind: "booking", label: `Starter booking ${starterDate}` }),
      expect.objectContaining({ leadId: expect.stringContaining("booking-"), kind: "booking" })
    ]);
  });

  it("surfaces unanswered app messages in reports without clearing them", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-30)
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 8,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-60)
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-90)
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-staff",
        threadId: "direct-staff-seed-student-ari",
        senderId: "direct-staff-seed",
        senderName: "Cho's Manager",
        recipientId: "student-ari",
        recipientName: "Ari Nguyen",
        body: "Can you confirm tomorrow?",
        createdAt: "2026-06-01T09:00:00.000Z",
        status: "sent"
      },
      {
        id: "direct-ari-inbound",
        threadId: "direct-staff-seed-student-ari",
        senderId: "student-ari",
        senderName: "Ari Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Yes, I can make tomorrow's class.",
        createdAt: "2026-06-01T09:10:00.000Z",
        status: "sent"
      },
      {
        id: "direct-bree-inbound",
        threadId: "direct-staff-seed-student-bree",
        senderId: "student-bree",
        senderName: "Bree Santos",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Can I reschedule?",
        createdAt: "2026-06-01T09:15:00.000Z",
        status: "sent"
      },
      {
        id: "direct-bree-staff",
        threadId: "direct-staff-seed-student-bree",
        senderId: "direct-staff-seed",
        senderName: "Cho's Manager",
        recipientId: "student-bree",
        recipientName: "Bree Santos",
        body: "Yes, we can move you.",
        createdAt: "2026-06-01T09:20:00.000Z",
        status: "sent"
      },
      {
        id: "direct-parent-inbound",
        threadId: "direct-staff-seed-parent-student-ari",
        senderId: "parent-student-ari",
        senderName: "Mina Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Can you send the belt test time?",
        createdAt: "2026-06-01T10:00:00.000Z",
        status: "sent"
      },
      {
        id: "direct-cora-inbound",
        threadId: "direct-staff-seed-student-cora",
        senderId: "student-cora",
        senderName: "Cora Miles",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Inactive students should not create staff work.",
        createdAt: "2026-06-01T10:30:00.000Z",
        status: "sent"
      }
    ]));

    renderLoggedInApp("/reports");

    expect(within(screen.getByLabelText("App replies report metric")).getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reply to app messages" })).toHaveAttribute("href", "/profile");
    const repliesPanel = screen.getByLabelText("Unanswered app message reply candidates");
    expect(within(repliesPanel).getByRole("heading", { name: "App Message Replies" })).toBeInTheDocument();
    expect(within(repliesPanel).getByText("2 inbound student or parent app messages need staff replies.")).toBeInTheDocument();
    expect(within(repliesPanel).getByText("Mina Nguyen")).toBeInTheDocument();
    expect(within(repliesPanel).getByText("Ari Nguyen")).toBeInTheDocument();
    expect(within(repliesPanel).getByText("Can you send the belt test time?")).toBeInTheDocument();
    expect(within(repliesPanel).queryByText("Bree Santos")).not.toBeInTheDocument();
    expect(within(repliesPanel).queryByText("Cora Miles")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toHaveLength(6);
  });

  it("uses singular app-message reply copy in reports", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-30)
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-inbound",
        threadId: "direct-staff-seed-student-ari",
        senderId: "student-ari",
        senderName: "Ari Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Can I make up class this week?",
        createdAt: "2026-06-01T09:10:00.000Z",
        status: "sent"
      }
    ]));

    renderLoggedInApp("/reports");

    expect(screen.getByText("1 inbound student or parent app message needs staff replies.")).toBeInTheDocument();
  });

  it("lets managers queue first-week new student check-ins directly from reports", async () => {
    const todayKey = dateKeyOffset(0);
    const firstWeekJoinedAt = dateKeyOffset(-7);
    const finalWindowJoinedAt = dateKeyOffset(-14);
    const tooRecentJoinedAt = dateKeyOffset(-4);
    const tooOldJoinedAt = dateKeyOffset(-15);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        phone: "(262) 555-0101",
        email: "ari@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: firstWeekJoinedAt,
        enrollmentDate: firstWeekJoinedAt,
        program: "Youth Foundations"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        phone: "(262) 555-0102",
        email: "bree@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 2,
        missedClassCount: 0,
        joinedAt: finalWindowJoinedAt,
        enrollmentDate: finalWindowJoinedAt,
        program: "Adult Basics"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        phone: "(262) 555-0103",
        email: "cora@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: tooRecentJoinedAt,
        enrollmentDate: tooRecentJoinedAt
      },
      {
        id: "student-dane",
        firstName: "Dane",
        lastName: "Woods",
        phone: "(262) 555-0104",
        email: "dane@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: tooOldJoinedAt,
        enrollmentDate: tooOldJoinedAt
      },
      {
        id: "student-elle",
        firstName: "Elle",
        lastName: "Park",
        phone: "(262) 555-0105",
        email: "elle@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: firstWeekJoinedAt,
        enrollmentDate: firstWeekJoinedAt,
        lastContactedAt: todayKey
      }
    ]));

    renderLoggedInApp("/reports");

    expect(within(screen.getByLabelText("New student check-ins report metric")).getByText("2")).toBeInTheDocument();
    const checkInPanel = screen.getByLabelText("New student check-in candidates");
    expect(within(checkInPanel).getByRole("heading", { name: "New Student Check-Ins" })).toBeInTheDocument();
    expect(within(checkInPanel).getByText("Ari Nguyen")).toBeInTheDocument();
    expect(within(checkInPanel).getByText("Bree Santos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check in with new students" }));

    expect(await screen.findByText("2 new-student check-in texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("New student check-ins report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check in with new students" })).not.toBeInTheDocument();
    expect(within(checkInPanel).getByText("No first-week student check-ins are waiting.")).toBeInTheDocument();

    const logs = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ recipientName: string; body: string; status: string }>;
    const firstWeekLogs = logs.filter((log) => log.body.includes("first week"));
    expect(firstWeekLogs).toEqual([
      expect.objectContaining({ recipientName: "Ari Nguyen", status: "queued", body: expect.stringContaining("first week") }),
      expect.objectContaining({ recipientName: "Bree Santos", status: "queued", body: expect.stringContaining("first week") })
    ]);
    const storedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; lastContactedAt?: string }>;
    expect(storedStudents.find((student) => student.id === "student-ari")).toMatchObject({ lastContactedAt: todayKey });
    expect(storedStudents.find((student) => student.id === "student-bree")).toMatchObject({ lastContactedAt: todayKey });
  });

  it("lets managers queue attendance-gap check-ins directly from reports", async () => {
    const todayKey = dateKeyOffset(0);
    const oldCheckInKey = dateKeyOffset(-24);
    const noCheckInJoinedAt = dateKeyOffset(-28);
    const recentCheckInKey = dateKeyOffset(-10);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        phone: "(262) 555-0101",
        email: "ari@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 6,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-60),
        enrollmentDate: dateKeyOffset(-60),
        lastCheckIn: oldCheckInKey
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        phone: "(262) 555-0102",
        email: "bree@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 0,
        missedClassCount: 0,
        joinedAt: noCheckInJoinedAt,
        enrollmentDate: noCheckInJoinedAt
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        phone: "(262) 555-0103",
        email: "cora@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-60),
        enrollmentDate: dateKeyOffset(-60),
        lastCheckIn: recentCheckInKey
      },
      {
        id: "student-dane",
        firstName: "Dane",
        lastName: "Woods",
        phone: "(262) 555-0104",
        email: "dane@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 3,
        joinedAt: dateKeyOffset(-60),
        enrollmentDate: dateKeyOffset(-60),
        lastCheckIn: oldCheckInKey
      },
      {
        id: "student-elle",
        firstName: "Elle",
        lastName: "Park",
        phone: "(262) 555-0105",
        email: "elle@example.com",
        ...completeStudentSafetyFields,
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-60),
        enrollmentDate: dateKeyOffset(-60),
        lastCheckIn: oldCheckInKey,
        lastContactedAt: todayKey
      }
    ]));

    renderLoggedInApp("/reports");

    expect(within(screen.getByLabelText("Attendance gaps report metric")).getByText("2")).toBeInTheDocument();
    const attendanceGapPanel = screen.getByLabelText("Attendance gap check-in candidates");
    expect(within(attendanceGapPanel).getByRole("heading", { name: "Attendance Gap Check-Ins" })).toBeInTheDocument();
    expect(within(attendanceGapPanel).getByText("Ari Nguyen")).toBeInTheDocument();
    expect(within(attendanceGapPanel).getByText("Bree Santos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check attendance gaps" }));

    expect(await screen.findByText("2 attendance gap check-in texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Attendance gaps report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Check attendance gaps" })).not.toBeInTheDocument();
    expect(within(attendanceGapPanel).getByText("No attendance-gap check-ins are waiting.")).toBeInTheDocument();

    const logs = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ recipientName: string; body: string; status: string }>;
    const attendanceGapLogs = logs.filter((log) => log.body.includes("missed seeing you"));
    expect(attendanceGapLogs).toEqual([
      expect.objectContaining({ recipientName: "Ari Nguyen", status: "queued" }),
      expect.objectContaining({ recipientName: "Bree Santos", status: "queued" })
    ]);
    const storedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; lastContactedAt?: string }>;
    expect(storedStudents.find((student) => student.id === "student-ari")).toMatchObject({ lastContactedAt: todayKey });
    expect(storedStudents.find((student) => student.id === "student-bree")).toMatchObject({ lastContactedAt: todayKey });
    expect(storedStudents.find((student) => student.id === "student-dane")?.lastContactedAt).toBeUndefined();
  });

  it.skip("lets managers queue missed-class follow-ups directly from reports", async () => {
    renderLoggedInApp("/reports");

    fireEvent.click(screen.getByRole("button", { name: "Send missed-class follow-ups" }));

    expect(await screen.findByText("2 missed-class follow-up texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Missed-class follow-ups report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("2")).toBeInTheDocument();
    expect(screen.getByText("No current students are above the missed-class follow-up threshold.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send missed-class follow-ups" })).not.toBeInTheDocument();
  });

  it("lets managers clear stale one-time schedule items directly from reports", async () => {
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-stale-private", title: "Old Private Lesson", date: dateKeyOffset(-2), time: "4:30 PM", type: "private-lesson" },
      { id: "schedule-stale-testing", title: "Old Testing Prep", date: dateKeyOffset(-1), time: "5:30 PM", type: "testing-prep" },
      { id: "schedule-recurring", title: "Recurring Youth Class", date: dateKeyOffset(-3), time: "5:00 PM", type: "class", recurring: true },
      { id: "schedule-future", title: "Future Private Lesson", date: dateKeyOffset(2), time: "4:30 PM", type: "private-lesson" }
    ]));
    renderLoggedInApp("/reports");

    expect(within(screen.getByLabelText("Stale schedule items report metric")).getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear stale schedule items" }));

    expect(await screen.findByText("2 stale one-time schedule items removed.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Stale schedule items report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Clear stale schedule items" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "schedule-recurring", title: "Recurring Youth Class", recurring: true }),
      expect.objectContaining({ id: "schedule-future", title: "Future Private Lesson" })
    ]);
  });

  it("lets managers clear stale queued texts directly from reports", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-cora",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Cora has stale outreach.",
        status: "queued",
        createdAt: "2026-06-02T10:05:00.000Z"
      },
      {
        id: "message-noah",
        kind: "profile-update",
        recipientName: "Noah Woods",
        recipientPhone: "(262) 555-0104",
        body: "Noah is no longer listed.",
        status: "queued",
        createdAt: "2026-06-02T10:10:00.000Z"
      },
      {
        id: "message-cora-sent",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Historical Cora message.",
        status: "sent",
        createdAt: "2026-06-01T10:00:00.000Z",
        sentAt: "2026-06-01T10:05:00.000Z"
      }
    ]));

    renderLoggedInApp("/reports");

    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Stale queued texts report metric")).getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear stale queued texts" }));

    expect(await screen.findByText("2 stale queued texts removed.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Stale queued texts report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Clear stale queued texts" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "message-cora-sent", status: "sent" })
    ]);
  });

  it.skip("lets managers send queued texts directly from reports", async () => {
    renderLoggedInApp("/reports");

    fireEvent.click(screen.getByRole("button", { name: "Send missed-class follow-ups" }));
    expect(await screen.findByText("2 missed-class follow-up texts queued.")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Send queued texts" }));

    expect(await screen.findByText("2 queued texts sent.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Queued messages report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Send queued texts" })).not.toBeInTheDocument();
  });

  it.skip("lets managers queue trial conversion outreach directly from reports", async () => {
    renderLoggedInApp("/reports");

    fireEvent.click(screen.getByRole("button", { name: "Convert trial students" }));

    expect(await screen.findByText("4 trial conversion texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Trial follow-ups report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert trial students" })).not.toBeInTheDocument();
  });

  it.skip("lets managers queue paused-student reactivation outreach directly from reports", async () => {
    renderLoggedInApp("/reports");

    fireEvent.click(screen.getByRole("button", { name: "Review paused students" }));

    expect(await screen.findByText("4 paused-student reactivation texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Paused follow-ups report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review paused students" })).not.toBeInTheDocument();
  });

  it.skip("lets managers queue belt testing invitations directly from reports", async () => {
    renderLoggedInApp("/reports");

    fireEvent.click(screen.getByRole("button", { name: "Invite belt test candidates" }));

    expect(await screen.findByText("3 belt testing invitation texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Test invites report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite belt test candidates" })).not.toBeInTheDocument();
    expect(screen.getByText("No current students are ready for belt testing outreach.")).toBeInTheDocument();
  });

  it("lets managers queue near-testing milestone encouragement directly from reports", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-mina",
        firstName: "Mina",
        lastName: "Cho",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0100",
        email: "mina@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 6,
        missedClassCount: 0,
        lastCheckIn: dateKeyOffset(0),
        joinedAt: "2026-05-01"
      },
      {
        id: "student-talia",
        firstName: "Talia",
        lastName: "Rivera",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "talia@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 13,
        missedClassCount: 0,
        lastCheckIn: dateKeyOffset(0),
        joinedAt: "2026-05-01"
      },
      {
        id: "student-ready",
        firstName: "Nolan",
        lastName: "Brooks",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "nolan@example.com",
        status: "Active",
        beltRank: "Orange",
        classesAttended: 20,
        missedClassCount: 0,
        lastCheckIn: dateKeyOffset(0),
        joinedAt: "2026-05-01"
      }
    ]));
    renderLoggedInApp("/reports");

    expect(screen.getByRole("button", { name: "Send milestone encouragement" })).toBeInTheDocument();
    expect(screen.getByText("Mina Cho")).toBeInTheDocument();
    expect(screen.getByText("Talia Rivera")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send milestone encouragement" }));

    expect(await screen.findByText("2 milestone encouragement texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Milestone nudges report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send milestone encouragement" })).not.toBeInTheDocument();
    expect(screen.getByText("No current students are close enough for milestone encouragement today.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Mina Cho", status: "queued", body: expect.stringMatching(/next belt milestone/i) }),
      expect.objectContaining({ recipientName: "Talia Rivera", status: "queued", body: expect.stringMatching(/next belt milestone/i) })
    ]));
  });

  it("lets managers queue celebration outreach directly from reports", async () => {
    const today = new Date();
    const birthdayDate = `${today.getFullYear() - 12}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const anniversaryDate = new Date(today);
    anniversaryDate.setDate(today.getDate() + 5);
    const joinedAtDate = `${anniversaryDate.getFullYear() - 1}-${String(anniversaryDate.getMonth() + 1).padStart(2, "0")}-${String(anniversaryDate.getDate()).padStart(2, "0")}`;
    const contactedBirthdayDate = new Date(today);
    contactedBirthdayDate.setDate(today.getDate() + 2);
    const contactedBirthdayKey = `${contactedBirthdayDate.getFullYear() - 16}-${String(contactedBirthdayDate.getMonth() + 1).padStart(2, "0")}-${String(contactedBirthdayDate.getDate()).padStart(2, "0")}`;
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        dateOfBirth: birthdayDate,
        phone: "(262) 555-0100",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 2,
        missedClassCount: 0,
        lastCheckIn: dateKeyOffset(0),
        joinedAt: "2026-05-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "cora@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 5,
        missedClassCount: 0,
        lastCheckIn: dateKeyOffset(0),
        joinedAt: joinedAtDate
      },
      {
        id: "student-dane",
        firstName: "Dane",
        lastName: "Woods",
        ...completeStudentSafetyFields,
        dateOfBirth: birthdayDate,
        phone: "(262) 555-0103",
        email: "dane@example.com",
        status: "Active",
        beltRank: "Green",
        classesAttended: 12,
        missedClassCount: 0,
        lastCheckIn: dateKeyOffset(0),
        joinedAt: joinedAtDate
      },
      {
        id: "student-elle",
        firstName: "Elle",
        lastName: "Park",
        ...completeStudentSafetyFields,
        dateOfBirth: contactedBirthdayKey,
        phone: "(262) 555-0102",
        email: "elle@example.com",
        status: "Active",
        beltRank: "Orange",
        classesAttended: 8,
        missedClassCount: 0,
        lastCheckIn: dateKeyOffset(0),
        lastContactedAt: dateKeyOffset(0),
        joinedAt: "2026-05-01"
      }
    ]));
    renderLoggedInApp("/reports");

    expect(screen.getByRole("button", { name: "Send celebration outreach" })).toBeInTheDocument();
    expect(screen.getByText("Ari Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Cora Miles")).toBeInTheDocument();
    expect(screen.getByText("Dane Woods")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send celebration outreach" }));

    expect(await screen.findByText("3 celebration texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Celebrations report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send celebration outreach" })).not.toBeInTheDocument();
    expect(screen.getByText("No current student birthdays or training anniversaries are due this week.")).toBeInTheDocument();
    const savedCelebrationMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ recipientName: string; kind: string; status: string; body: string }>;
    expect(savedCelebrationMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Ari Nguyen", kind: "celebration", status: "queued", body: expect.stringMatching(/birthday/i) }),
      expect.objectContaining({ recipientName: "Cora Miles", kind: "celebration", status: "queued", body: expect.stringMatching(/training anniversary/i) }),
      expect.objectContaining({ recipientName: "Dane Woods", kind: "celebration", status: "queued", body: expect.stringMatching(/birthday/i) })
    ]));
    expect(savedCelebrationMessages.filter((message) => message.recipientName === "Dane Woods")).toHaveLength(1);
  });

  it("lets managers request student profile updates directly from reports", async () => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        phone: "(262) 555-0100",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 2,
        missedClassCount: 0,
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-0100",
        guardianEmail: "",
        emergencyContactName: "",
        emergencyContactRelationship: "Parent",
        emergencyContactPhone: "",
        lastCheckIn: todayKey,
        smsConsentUpdatedAt: "2026-05-21T10:00:00.000Z",
        joinedAt: "2026-05-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        dateOfBirth: "2012-09-01",
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 5,
        missedClassCount: 0,
        guardianName: "Paula Santos",
        guardianPhone: "(262) 555-0101",
        guardianEmail: "",
        emergencyContactName: "Marco Santos",
        emergencyContactRelationship: "Uncle",
        emergencyContactPhone: "(262) 555-0201",
        lastCheckIn: todayKey,
        smsConsentUpdatedAt: "2026-05-21T10:00:00.000Z",
        joinedAt: "2026-05-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Active",
        beltRank: "Orange",
        classesAttended: 8,
        missedClassCount: 0,
        guardianName: "Terry Miles",
        guardianPhone: "(262) 555-0102",
        guardianEmail: "",
        emergencyContactName: "",
        emergencyContactRelationship: "Parent",
        emergencyContactPhone: "",
        lastCheckIn: todayKey,
        lastContactedAt: todayKey,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-finn",
        firstName: "Finn",
        lastName: "Cole",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "finn@example.com",
        status: "Active",
        beltRank: "Green",
        classesAttended: 18,
        missedClassCount: 0,
        lastCheckIn: todayKey,
        profileUpdatedAt: "2025-05-01",
        joinedAt: "2025-05-01"
      }
    ]));
    renderLoggedInApp("/reports");

    expect(screen.getByRole("button", { name: "Request profile updates" })).toBeInTheDocument();
    expect(screen.getByText("Ari Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Bree Santos")).toBeInTheDocument();
    expect(screen.getByText("Finn Cole")).toBeInTheDocument();
    expect(screen.getByText("Annual profile verification due")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Request profile updates" }));

    expect(await screen.findByText("3 profile update texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Profile updates report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request profile updates" })).not.toBeInTheDocument();
    expect(screen.getByText("No current student records need profile-update outreach.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Ari Nguyen", kind: "profile-update", status: "queued", body: expect.stringMatching(/profile information/i) }),
      expect.objectContaining({ recipientName: "Bree Santos", kind: "profile-update", status: "queued", body: expect.stringMatching(/profile information/i) }),
      expect.objectContaining({ recipientName: "Finn Cole", kind: "profile-update", status: "queued", body: expect.stringMatching(/profile information/i) })
    ]));
    const storedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; lastContactedAt?: string }>;
    expect(storedStudents.find((student) => student.id === "student-finn")).toMatchObject({ lastContactedAt: todayKey });
  });

  it("lets managers queue upcoming class reminders directly from reports", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0100",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 2,
        missedClassCount: 0,
        lastCheckIn: todayKey,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 5,
        missedClassCount: 0,
        lastCheckIn: todayKey,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Active",
        beltRank: "Orange",
        classesAttended: 8,
        missedClassCount: 0,
        lastCheckIn: todayKey,
        lastContactedAt: todayKey,
        joinedAt: "2026-05-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-ari", title: "Private Lesson", date: dateKeyOffset(1), time: "4:30 PM", type: "private-lesson", studentId: "student-ari" },
      { id: "schedule-bree", title: "Testing Prep", date: dateKeyOffset(2), time: "5:30 PM", type: "testing-prep", studentId: "student-bree" },
      { id: "schedule-cora", title: "Already Contacted", date: dateKeyOffset(1), time: "6:00 PM", type: "private-lesson", studentId: "student-cora" },
      { id: "schedule-general", title: "Youth Beginners", date: dateKeyOffset(1), time: "5:00 PM", type: "class" }
    ]));
    renderLoggedInApp("/reports");

    expect(screen.getByRole("button", { name: "Send class reminders" })).toBeInTheDocument();
    expect(screen.getByText("Ari Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Bree Santos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send class reminders" }));

    expect(await screen.findByText("2 class reminder texts queued.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Class reminders report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Queued messages report metric")).getByText("2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send class reminders" })).not.toBeInTheDocument();
    expect(screen.getByText("No student-specific classes need reminder outreach in the next two days.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Ari Nguyen", kind: "reminder", status: "queued", body: expect.stringMatching(/Private Lesson/i) }),
      expect.objectContaining({ recipientName: "Bree Santos", kind: "reminder", status: "queued", body: expect.stringMatching(/Testing Prep/i) })
    ]));
  });

  it("lets managers restock low inventory directly from reports", async () => {
    renderLoggedInApp("/reports");

    fireEvent.click(screen.getByRole("button", { name: "Restock low inventory" }));

    expect(await screen.findByText("1 low-stock item restocked to par.")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByLabelText("Low stock items report metric")).getByText("0")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Restock low inventory" })).not.toBeInTheDocument();
  });

  it.skip("lets managers export a maintenance backup from reports", async () => {
    const clickAnchor = vi.fn();
    let backupBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      backupBlob = blob;
      return "blob:operations-backup";
    });
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, "click", { configurable: true, value: clickAnchor });
      }
      return element;
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    window.localStorage.setItem("chos.operations.twilioRelayEndpoint.v1", "https://relay.example.test/api/messages/twilio");
    window.localStorage.setItem("chos.operations.pushServerEndpoint.v1", "https://push.example.test/api/push/subscriptions");
    window.localStorage.setItem("chos.operations.twilioLaunchProfile.v1", JSON.stringify({
      messagingServiceSid: "MG1234567890abcdef",
      smsSender: "+12625550100",
      inboundWebhookUrl: "https://relay.example.test/api/messages/inbound",
      statusCallbackBaseUrl: "https://relay.example.test/api/messages/status",
      relayHealthCheckUrl: "https://relay.example.test/api/messages/health",
      managerAuthMode: "server-session",
      senderType: "10dlc",
      a2pBrandStatus: "approved",
      a2pCampaignStatus: "approved",
      tollFreeVerificationStatus: "not-used",
      complianceNotes: "A2P approved for studio outreach.",
      savedAt: "2026-06-03T10:15:00.000Z"
    }));
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({
      browserNotificationsEnabled: true,
      pushPublicKey: "BO_PUBLIC_WEB_PUSH_KEY",
      pushSubscriptionEndpoint: "https://fcm.googleapis.com/fcm/send/device-1",
      pushSubscriptionJson: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
        keys: {
          p256dh: "raw-device-p256dh",
          auth: "raw-device-auth"
        }
      })
    }));

    try {
      renderLoggedInApp("/reports");

      const backupPanel = screen.getByLabelText("Operations data backup");
      expect(within(backupPanel).getByRole("heading", { name: "Data Health & Backup" })).toBeInTheDocument();
      expect(within(backupPanel).getByText("20 students")).toBeInTheDocument();
      expect(within(backupPanel).getByText("2 merchandise items")).toBeInTheDocument();
      expect(within(backupPanel).getByText("2 child accounts")).toBeInTheDocument();
      expect(within(backupPanel).getByText("Saved account passwords, Twilio credentials, VAPID private keys, and raw PushSubscription key material are not included in the export.")).toBeInTheDocument();

      fireEvent.click(within(backupPanel).getByRole("button", { name: "Export operations backup" }));

      expect(await screen.findByText("Operations backup JSON exported.")).toBeInTheDocument();
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      if (!backupBlob) throw new Error("Expected operations backup export to create a Blob.");
      const backup = JSON.parse(await backupBlob.text());
      expect(backup).toMatchObject({
        schemaVersion: "chos-operations-backup.v1",
        summary: {
          sections: expect.any(Number),
          totalRecords: expect.any(Number)
        },
        data: {
          students: expect.arrayContaining([expect.objectContaining({ firstName: "Talia", lastName: "Brooks" })]),
          merchandiseItems: expect.arrayContaining([expect.objectContaining({ name: "Youth Boxing Gloves" })]),
          childAccounts: expect.arrayContaining([expect.objectContaining({ username: "mina-cho.child" })]),
          messagingSetup: [
            expect.objectContaining({
              id: "production-messaging",
              twilioRelayEndpoint: "https://relay.example.test/api/messages/twilio",
              pushServerEndpoint: "https://push.example.test/api/push/subscriptions",
              webPushPublicKey: "BO_PUBLIC_WEB_PUSH_KEY",
              twilioLaunchProfile: expect.objectContaining({
                messagingServiceSid: "MG1234567890abcdef",
                smsSender: "+12625550100",
                managerAuthMode: "server-session",
                senderType: "10dlc",
                a2pBrandStatus: "approved",
                a2pCampaignStatus: "approved"
              })
            })
          ]
        }
      });
      expect(JSON.stringify(backup.data.messagingSetup)).not.toMatch(/pushSubscriptionJson|pushSubscriptionEndpoint|raw-device-p256dh|raw-device-auth|fcm\.googleapis/i);
      expect(clickAnchor).toHaveBeenCalledTimes(1);
      expect(createdAnchor).toHaveAttribute("download", expect.stringMatching(/^chos-operations-backup-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:operations-backup");
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
    }
  });

  it("lets managers restore a maintenance backup from reports", async () => {
    const backup = buildOperationsBackupSnapshot(
      makeOperationsBackupInput({
        students: [
          {
            id: "student-restored",
            firstName: "Ari",
            lastName: "Nguyen",
            ...completeStudentSafetyFields,
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ],
        scheduledClasses: [
          { id: "schedule-restored", title: "Restored Private Lesson", date: dateKeyOffset(1), time: "4:30 PM", type: "private-lesson", studentId: "student-restored" }
        ],
        merchandiseItems: [
          { id: "merch-restored", name: "Restored Gloves", category: "Gloves", price: 39, stock: 6, description: "Restored item.", imageLabel: "gloves" }
        ],
        checkIns: [
          { id: "checkin-restored", studentId: "student-restored", studentName: "Ari Nguyen", date: dateKeyOffset(0), beltRank: "Yellow" }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );
    renderLoggedInApp("/reports");

    const backupPanel = screen.getByLabelText("Operations data backup");
    const input = within(backupPanel).getByLabelText("Import operations backup") as HTMLInputElement;
    const file = new File([JSON.stringify(backup)], "chos-operations-backup-2026-06-02.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Operations backup restored: 4 records across 4 sections.")).toBeInTheDocument();
    expect(within(backupPanel).getByText("1 students")).toBeInTheDocument();
    expect(within(backupPanel).getByText("1 scheduled classes")).toBeInTheDocument();
    expect(within(backupPanel).getByText("1 merchandise items")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "student-restored", firstName: "Ari", classesAttended: 12 })
    ]);
    expect(JSON.parse(window.localStorage.getItem("chos.operations.merchandise.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "merch-restored", name: "Restored Gloves", stock: 6 })
    ]);
    expect(input.value).toBe("");
  });

  it("restores portable messaging setup from operations backups without replacing current push subscription keys", async () => {
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({
      browserNotificationsEnabled: true,
      pushPublicKey: "BO_OLD_PUBLIC_WEB_PUSH_KEY",
      pushSubscriptionEndpoint: "https://fcm.googleapis.com/fcm/send/current-device",
      pushSubscriptionJson: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/current-device",
        keys: {
          p256dh: "current-device-p256dh",
          auth: "current-device-auth"
        }
      })
    }));
    const backup = buildOperationsBackupSnapshot(
      makeOperationsBackupInput({
        messagingSetup: [
          {
            id: "production-messaging",
            twilioRelayEndpoint: "https://relay.example.test/api/messages/twilio",
            pushServerEndpoint: "https://push.example.test/api/push/subscriptions",
            webPushPublicKey: "BO_RESTORED_PUBLIC_WEB_PUSH_KEY",
            pushSubscriptionEndpoint: "https://fcm.googleapis.com/fcm/send/backup-device",
            pushSubscriptionJson: JSON.stringify({
              endpoint: "https://fcm.googleapis.com/fcm/send/backup-device",
              keys: {
                p256dh: "backup-device-p256dh",
                auth: "backup-device-auth"
              }
            }),
            twilioLaunchProfile: {
              messagingServiceSid: "MG1234567890abcdef",
              smsSender: "+12625550100",
              inboundWebhookUrl: "https://relay.example.test/api/messages/inbound",
              statusCallbackBaseUrl: "https://relay.example.test/api/messages/status",
              relayHealthCheckUrl: "https://relay.example.test/api/messages/health",
              managerAuthMode: "server-session",
              senderType: "10dlc",
              a2pBrandStatus: "approved",
              a2pCampaignStatus: "approved",
              tollFreeVerificationStatus: "not-used",
              complianceNotes: "A2P approved for studio outreach.",
              savedAt: "2026-06-03T10:15:00.000Z"
            }
          }
        ]
      }),
      "2026-06-03T12:00:00.000Z"
    );
    renderLoggedInApp("/reports");

    const backupPanel = screen.getByLabelText("Operations data backup");
    const input = within(backupPanel).getByLabelText("Import operations backup") as HTMLInputElement;
    const file = new File([JSON.stringify(backup)], "chos-operations-backup-messaging-setup.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Operations backup restored: 1 record across 1 section.")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.operations.twilioRelayEndpoint.v1")).toBe("https://relay.example.test/api/messages/twilio");
    expect(window.localStorage.getItem("chos.operations.pushServerEndpoint.v1")).toBe("https://push.example.test/api/push/subscriptions");
    expect(JSON.parse(window.localStorage.getItem("chos.operations.twilioLaunchProfile.v1") ?? "{}")).toEqual(expect.objectContaining({
      messagingServiceSid: "MG1234567890abcdef",
      smsSender: "+12625550100",
      managerAuthMode: "server-session",
      senderType: "10dlc"
    }));
    const notificationSettings = JSON.parse(window.localStorage.getItem("chos.operations.notificationSettings.v1") ?? "{}");
    expect(notificationSettings).toEqual(expect.objectContaining({
      pushPublicKey: "BO_RESTORED_PUBLIC_WEB_PUSH_KEY",
      pushSubscriptionEndpoint: "https://fcm.googleapis.com/fcm/send/current-device",
      pushSubscriptionJson: expect.stringContaining("current-device-p256dh")
    }));
    expect(JSON.stringify(notificationSettings)).not.toMatch(/backup-device-p256dh|backup-device-auth|fcm\.googleapis\.com\/fcm\/send\/backup-device/i);
  });

  it("uses restored student data for same-action outreach after importing a backup", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    const backup = buildOperationsBackupSnapshot(
      makeOperationsBackupInput({
        students: [
          {
            id: "student-restored",
            firstName: "Ari",
            lastName: "Nguyen",
            ...completeStudentSafetyFields,
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 3,
            joinedAt: "2026-01-01"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <RestoreAndSendMissedClassHarness backup={backup} studentId="student-restored" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore and send missed follow-ups" }));

    await waitFor(() => {
      expect(screen.getByText("Harness restored missed status: Active")).toBeInTheDocument();
      expect(screen.getByText("Harness restored missed return count: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness restored missed messages: 1")).toBeInTheDocument();
      const savedMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ recipientName: string; body: string }>;
      expect(savedMessages).toEqual([
        expect.objectContaining({ recipientName: "Ari Nguyen", body: expect.stringMatching(/missed you in class/i) })
      ]);
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-restored", lastContactedAt: dateKeyOffset(0) })]);
    });
  });

  it.skip("clears the current custom staff session when a restored backup removes that login", async () => {
    const staffAccount = {
      id: "managed-restore-operator",
      displayName: "Restore Operator",
      username: "restore.operator",
      password: "StaffPass123",
      role: "staff",
      status: "active",
      access: ["reports"],
      createdAt: "2026-06-01T10:00:00.000Z"
    };
    const backup = buildOperationsBackupSnapshot(makeOperationsBackupInput(), "2026-06-02T12:00:00.000Z");
    renderManagedStaffApp("/reports", staffAccount);

    const backupPanel = screen.getByLabelText("Operations data backup");
    const input = within(backupPanel).getByLabelText("Import operations backup") as HTMLInputElement;
    const file = new File([JSON.stringify(backup)], "chos-operations-backup-without-current-staff.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByTestId("auth-gate")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
  });

  it.skip("preserves registered guardian passwords when restoring redacted backups on the same device", async () => {
    const registeredAccount = {
      email: "returning.family@example.com",
      password: "FamilyPass123",
      createdAt: "2026-06-01T09:00:00.000Z"
    };
    window.localStorage.setItem("chos.accounts.v1", JSON.stringify([registeredAccount]));
    const backup = buildOperationsBackupSnapshot(
      makeOperationsBackupInput({
        accounts: [registeredAccount],
        accountRoles: [{ email: registeredAccount.email, role: "guardian" }]
      }),
      "2026-06-02T12:00:00.000Z"
    );
    expect(JSON.stringify(backup.data)).not.toContain("FamilyPass123");

    const restoreRender = renderLoggedInApp("/reports");

    const backupPanel = screen.getByLabelText("Operations data backup");
    const input = within(backupPanel).getByLabelText("Import operations backup") as HTMLInputElement;
    const file = new File([JSON.stringify(backup)], "chos-operations-backup-family-account.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Operations backup restored: 2 records across 2 sections.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.accounts.v1") ?? "[]")).toEqual([
        expect.objectContaining({ email: registeredAccount.email, password: "FamilyPass123" })
      ]);
    });

    clearActiveSession();
    restoreRender.unmount();
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: registeredAccount.email } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "FamilyPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByLabelText("Parent profile page")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manager's Panel" })).not.toBeInTheDocument();
  });

  it.skip("keeps the current registered guardian session when a restored backup omits legacy role storage", async () => {
    const registeredAccount = {
      email: "returning.family@example.com",
      password: "FamilyPass123",
      createdAt: "2026-06-01T09:00:00.000Z"
    };
    window.localStorage.setItem("chos.accounts.v1", JSON.stringify([registeredAccount]));
    seedActiveSession({ email: registeredAccount.email, remembered: true, createdAt: "2026-06-02T09:00:00.000Z" });
    const backup = buildOperationsBackupSnapshot(
      makeOperationsBackupInput({
        accounts: [registeredAccount]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    render(
      <AppStateProvider>
        <RestoreBackupSessionHarness backup={backup} />
      </AppStateProvider>
    );

    expect(screen.getByText(`Harness session email: ${registeredAccount.email}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore backup harness" }));

    await waitFor(() => {
      expect(screen.getByText(`Harness session email: ${registeredAccount.email}`)).toBeInTheDocument();
    });
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: registeredAccount.email, remembered: true });
  });

  it("rejects incomplete maintenance backups without clearing existing data", async () => {
    const existingContact = {
      id: "contact-existing",
      name: "Existing Lead",
      email: "lead@example.com",
      phone: "(262) 555-0198",
      message: "I want to try a class.",
      createdAt: "2026-06-01T10:00:00.000Z"
    };
    window.localStorage.setItem("chos.contacts.v1", JSON.stringify([existingContact]));
    const backup = buildOperationsBackupSnapshot(makeOperationsBackupInput(), "2026-06-02T12:00:00.000Z");
    const incompleteBackup = JSON.parse(JSON.stringify(backup)) as { data: Partial<OperationsBackupInput> };
    delete incompleteBackup.data.contacts;
    renderLoggedInApp("/reports");

    const backupPanel = screen.getByLabelText("Operations data backup");
    const input = within(backupPanel).getByLabelText("Import operations backup") as HTMLInputElement;
    const file = new File([JSON.stringify(incompleteBackup)], "chos-operations-backup-incomplete.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Backup restore failed: Backup file is missing required operations sections: contacts/i)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.contacts.v1") ?? "[]")).toEqual([existingContact]);
    expect(input.value).toBe("");
  });

  it("rejects redacted custom login backups when saved passwords cannot be preserved", async () => {
    const existingManagedAccount = {
      id: "managed-existing",
      displayName: "Existing Staff",
      username: "existing.staff",
      password: "ExistingPass123",
      role: "staff",
      status: "active",
      access: ["dashboard", "reports"],
      createdAt: "2026-06-01T09:00:00.000Z"
    };
    const existingChildAccount = {
      id: "child-existing",
      parentEmail: "parent123@chos.prototype",
      name: "Existing Child",
      username: "existing.child",
      password: "ChildPass123",
      age: "8",
      beltSlug: "yellow",
      createdAt: "2026-06-01T09:10:00.000Z"
    };
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([existingManagedAccount]));
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([existingChildAccount]));
    const backup = buildOperationsBackupSnapshot(
      makeOperationsBackupInput({
        managedAccounts: [
          {
            id: "managed-restored",
            displayName: "Restored Staff",
            username: "restored.staff",
            password: "RestoredPass123",
            role: "staff",
            status: "active",
            access: ["dashboard", "reports"],
            createdAt: "2026-06-02T10:00:00.000Z"
          }
        ],
        childAccounts: [
          {
            id: "child-restored",
            parentEmail: "parent123@chos.prototype",
            name: "Restored Child",
            username: "restored.child",
            password: "RestoredChildPass123",
            age: "7",
            beltSlug: "white",
            createdAt: "2026-06-02T10:10:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );
    renderLoggedInApp("/reports");

    const backupPanel = screen.getByLabelText("Operations data backup");
    const input = within(backupPanel).getByLabelText("Import operations backup") as HTMLInputElement;
    const file = new File([JSON.stringify(backup)], "chos-operations-backup-redacted-logins.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Backup restore failed: Backup includes custom login accounts whose passwords are not available locally/i)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual([existingManagedAccount]);
    expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual([existingChildAccount]);
    expect(input.value).toBe("");
  });

  it("rejects redacted registered account backups when saved passwords cannot be preserved", async () => {
    const existingRegisteredAccount = {
      email: "existing.family@example.com",
      password: "ExistingFamilyPass123",
      createdAt: "2026-06-01T09:00:00.000Z"
    };
    const existingRoles = [{ email: "manager123@chos.prototype", role: "staff" }];
    window.localStorage.setItem("chos.accounts.v1", JSON.stringify([existingRegisteredAccount]));
    const backup = buildOperationsBackupSnapshot(
      makeOperationsBackupInput({
        accounts: [
          {
            email: "restored.family@example.com",
            password: "RestoredFamilyPass123",
            createdAt: "2026-06-02T10:00:00.000Z"
          }
        ],
        accountRoles: [{ email: "restored.family@example.com", role: "guardian" }]
      }),
      "2026-06-02T12:00:00.000Z"
    );
    expect(JSON.stringify(backup.data)).not.toContain("RestoredFamilyPass123");
    renderLoggedInApp("/reports");

    const backupPanel = screen.getByLabelText("Operations data backup");
    const input = within(backupPanel).getByLabelText("Import operations backup") as HTMLInputElement;
    const file = new File([JSON.stringify(backup)], "chos-operations-backup-redacted-family-login.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Backup restore failed: Backup includes custom login accounts whose passwords are not available locally/i)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.accounts.v1") ?? "[]")).toEqual([existingRegisteredAccount]);
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual(existingRoles);
    expect(input.value).toBe("");
  });

  it("rejects legacy child login backups when student roles require unavailable passwords", async () => {
    const existingChildAccount = {
      id: "child-existing",
      parentEmail: "parent123@chos.prototype",
      name: "Existing Child",
      username: "existing.child",
      password: "ChildPass123",
      age: "8",
      beltSlug: "yellow",
      createdAt: "2026-06-01T09:10:00.000Z"
    };
    window.localStorage.setItem("chos.childAccounts.v1", JSON.stringify([existingChildAccount]));
    const backup = buildOperationsBackupSnapshot(
      makeOperationsBackupInput({
        accountRoles: [{ email: "legacy.child", role: "student" }],
        childAccounts: [
          {
            id: "child-legacy",
            parentEmail: "parent123@chos.prototype",
            name: "Legacy Child",
            username: "legacy.child",
            password: "LegacyChildPass123",
            age: "7",
            beltSlug: "white",
            createdAt: "2026-05-28T10:10:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );
    const legacyBackup = JSON.parse(JSON.stringify(backup)) as { data: { childAccounts: Array<Record<string, unknown>> } };
    legacyBackup.data.childAccounts.forEach((child) => {
      delete child.hasSavedPassword;
    });
    renderLoggedInApp("/reports");

    const backupPanel = screen.getByLabelText("Operations data backup");
    const input = within(backupPanel).getByLabelText("Import operations backup") as HTMLInputElement;
    const file = new File([JSON.stringify(legacyBackup)], "chos-operations-backup-legacy-child-login.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Backup restore failed: Backup includes custom login accounts whose passwords are not available locally/i)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.childAccounts.v1") ?? "[]")).toEqual([existingChildAccount]);
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toEqual([{ email: "manager123@chos.prototype", role: "staff" }]);
    expect(input.value).toBe("");
  });

  it("lets staff add a new student and creates a welcome text log", () => {
    renderLoggedInApp("/students");

    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
    const dialog = screen.getByRole("dialog", { name: "Create New Student" });

    ["Student Information", "Parent/Guardian Information", "Emergency Contact Information", "Enrollment Details"].forEach((heading) => {
      expect(within(dialog).getByRole("heading", { name: heading })).toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Ava Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Date of Birth"), { target: { value: "2016-08-12" } });
    fireEvent.change(within(dialog).getByLabelText("Gender"), { target: { value: "Female" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "ava@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Name"), { target: { value: "Jamie Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0199" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Email Address"), { target: { value: "jamie@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Contact Name"), { target: { value: "Taylor Kim" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Relationship"), { target: { value: "Aunt" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Phone Number"), { target: { value: "(262) 555-0120" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Email Address"), { target: { value: "taylor@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Enrollment Date"), { target: { value: "2026-05-14" } });
    fireEvent.change(within(dialog).getByLabelText("Program"), { target: { value: "Youth Foundations" } });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "Active" } });
    fireEvent.change(within(dialog).getByLabelText("Belt rank"), { target: { value: "White" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

    expect(screen.getByText("Ava Cho")).toBeInTheDocument();
    const whiteGroup = within(screen.getByLabelText("Student directory by belt")).getByRole("group", { name: "White belt students" });
    expect(within(whiteGroup).getByRole("button", { name: "Open Ava Cho student info" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();
    expect(screen.getByText(/Welcome Ava to Cho's/i)).toBeInTheDocument();
    expect(screen.getByText(/facebook.com\/chosmenomoneefalls/i)).toBeInTheDocument();
  });

  it("tells staff inactive student creation did not queue a welcome text", async () => {
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
    const dialog = screen.getByRole("dialog", { name: "Create New Student" });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Cora Miles" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "cora@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0102" } });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "Inactive" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

    expect(await screen.findByText("Cora Miles added.")).toBeInTheDocument();
    expect(screen.queryByText("Cora Miles added with welcome text queued.")).not.toBeInTheDocument();
    expect(screen.getByText("No welcome texts queued yet.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "welcome", recipientName: "Cora Miles" })
    ]));
  });

  it("keeps prototype state usable when localStorage writes fail", () => {
    renderLoggedInApp("/students");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded.", "QuotaExceededError");
    });

    try {
      fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
      const dialog = screen.getByRole("dialog", { name: "Create New Student" });
      fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Nora Kim" } });
      fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "nora@example.com" } });
      fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0177" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

      expect(screen.getByText("Nora Kim")).toBeInTheDocument();
      expect(screen.getByText(/Welcome Nora to Cho's/i)).toBeInTheDocument();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("shows compact belt blocks with an empty default roster", () => {
    renderLoggedInApp("/students");

    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.getByRole("img", { name: "Cho's Martial Arts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Operations navigation")).not.toBeInTheDocument();
    const studentsHeader = screen.getByRole("heading", { name: "Students" }).closest(".operations-page-head");
    expect(studentsHeader).not.toBeNull();
    expect(studentsHeader?.closest(".operations-page")).toHaveClass("operations-page--students");
    const headerCreateButton = within(studentsHeader as HTMLElement).getByRole("button", { name: "Create New Student" });
    expect(headerCreateButton).toHaveClass("student-header-add");
    expect(headerCreateButton.closest(".operations-page-action")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Belt Board" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create New Student" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create New Student" })).not.toBeInTheDocument();

    const directory = screen.getByLabelText("Student directory by belt");
    expect(directory.closest(".student-directory-panel")).toHaveClass("student-directory-panel--compact");
    expect(screen.queryByRole("table", { name: "Student directory" })).not.toBeInTheDocument();
    expect(screen.getByText("No students listed yet. Create a student when you are ready.")).toBeInTheDocument();
    expect(screen.getByLabelText("Welcome text queue")).toHaveClass("student-welcome-rail");
    expect(screen.getByText("No students are in the directory yet.")).toBeInTheDocument();
    expect(screen.queryAllByTestId("student-name-list-button")).toHaveLength(0);
    expect(screen.getByText("No welcome texts queued yet.")).toBeInTheDocument();
  });

  it("filters the student directory by enrollment status without changing the default all-student view", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-active",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0100",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 2,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-trial",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Trial",
        beltRank: "Yellow",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-paused",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Paused",
        beltRank: "Blue",
        classesAttended: 8,
        missedClassCount: 1,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-inactive",
        firstName: "Drew",
        lastName: "Parker",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "drew@example.com",
        status: "Inactive",
        beltRank: "Black",
        classesAttended: 40,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      }
    ]));

    renderLoggedInApp("/students");

    const filters = screen.getByLabelText("Student status filters");
    expect(screen.getByText("4 students listed by belt. Select a name to open student info.")).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Show all students (4)" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(filters).getByRole("button", { name: "Show Paused students (1)" }));

    expect(screen.getByText("1 paused student listed by belt. Clear filter to show everyone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Cora Miles student info" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Ari Nguyen student info" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Bree Santos student info" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Drew Parker student info" })).not.toBeInTheDocument();

    fireEvent.click(within(filters).getByRole("button", { name: "Show all students (4)" }));

    expect(screen.getByText("4 students listed by belt. Select a name to open student info.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Ari Nguyen student info" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Bree Santos student info" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Cora Miles student info" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Drew Parker student info" })).toBeInTheDocument();
  });

  it("searches the student directory by contact details and combines with status filters", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-active",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-0100",
        guardianEmail: "mina@example.com",
        phone: "(262) 555-0100",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 2,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-trial",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        guardianName: "Paula Santos",
        guardianPhone: "(262) 555-0101",
        guardianEmail: "paula@example.com",
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Trial",
        beltRank: "Yellow",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-paused",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        guardianName: "Terry Miles",
        guardianPhone: "(262) 555-0102",
        guardianEmail: "terry@example.com",
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Paused",
        beltRank: "Blue",
        classesAttended: 8,
        missedClassCount: 1,
        joinedAt: "2026-05-01"
      }
    ]));

    renderLoggedInApp("/students");

    const filters = screen.getByLabelText("Student status filters");
    const search = screen.getByRole("searchbox", { name: "Search students" });
    fireEvent.change(search, { target: { value: "paula" } });

    expect(screen.getByText("1 student matches search. Clear search to show everyone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Bree Santos student info" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Ari Nguyen student info" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Cora Miles student info" })).not.toBeInTheDocument();

    fireEvent.click(within(filters).getByRole("button", { name: "Show Paused students (1)" }));

    expect(screen.getByText("No paused students match this search.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Bree Santos student info" })).not.toBeInTheDocument();

    fireEvent.click(within(filters).getByRole("button", { name: "Show all students (3)" }));

    expect(screen.getByRole("button", { name: "Open Bree Santos student info" })).toBeInTheDocument();
  });

  it("queues selected-student outreach directly from the student info modal", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-mina",
        firstName: "Mina",
        lastName: "Cho",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0198",
        email: "mina@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 14,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      }
    ]));

    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Mina Cho student info" }));
    const dialog = screen.getByRole("dialog", { name: "Mina Cho Student Info" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Queue progress encouragement for Mina Cho" }));
    expect(await screen.findByText("Progress encouragement queued for Mina Cho.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Request profile update from Mina Cho" }));
    expect(await screen.findByText("Profile update request queued for Mina Cho.")).toBeInTheDocument();

    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "follow-up",
        recipientName: "Mina Cho",
        recipientPhone: "(262) 555-0198",
        status: "queued",
        body: expect.stringMatching(/next belt milestone/i)
      }),
      expect.objectContaining({
        kind: "profile-update",
        recipientName: "Mina Cho",
        recipientPhone: "(262) 555-0198",
        status: "queued",
        body: expect.stringMatching(/student profile information/i)
      })
    ]));
    expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "student-mina", lastContactedAt: expect.any(String) })
    ]);
  });

  it("retargets queued outreach when an active student profile contact is corrected", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari-queued",
        kind: "profile-update",
        recipientName: "Ari Nguyen",
        recipientPhone: "2625550101",
        body: "Hi Ari, please confirm Ari Nguyen's profile.",
        status: "queued",
        createdAt: "2026-06-01T10:00:00.000Z"
      },
      {
        id: "message-ari-sent",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "2625550101",
        body: "Already sent Ari history.",
        status: "sent",
        createdAt: "2026-05-31T10:00:00.000Z",
        sentAt: "2026-05-31T10:05:00.000Z"
      },
      {
        id: "message-bree-queued",
        kind: "follow-up",
        recipientName: "Bree Nguyen",
        recipientPhone: "2625550101",
        body: "Queued Bree outreach.",
        status: "queued",
        createdAt: "2026-06-01T10:10:00.000Z"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    const dialog = screen.getByRole("dialog", { name: "Ari Nguyen Student Info" });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Aria Park" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0199" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Student Changes" }));

    expect(await screen.findByText("Aria Park updated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "message-ari-queued", recipientName: "Aria Park", recipientPhone: "(262) 555-0199", body: "Hi Aria, please confirm Aria Park's profile.", status: "queued" }),
        expect.objectContaining({ id: "message-ari-sent", recipientName: "Ari Nguyen", recipientPhone: "2625550101", status: "sent" }),
        expect.objectContaining({ id: "message-bree-queued", recipientName: "Bree Nguyen", recipientPhone: "2625550101", status: "queued" })
      ]);
    });
  });

  it("keeps linked student logins in sync when an active student profile is corrected", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-ari",
        displayName: "Ari Nguyen",
        username: "ari.student",
        password: "AriPass123",
        role: "student",
        status: "active",
        email: "ari@example.com",
        phone: "(262) 555-0101",
        title: "Yellow Belt Student",
        access: [],
        studentId: "student-ari",
        createdAt: "2026-05-20T10:00:00.000Z"
      },
      {
        id: "managed-bree",
        displayName: "Bree Nguyen",
        username: "bree.student",
        password: "BreePass123",
        role: "student",
        status: "active",
        email: "bree@example.com",
        phone: "(262) 555-0102",
        title: "White Belt Student",
        access: [],
        studentId: "student-bree",
        createdAt: "2026-05-20T10:05:00.000Z"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    const dialog = screen.getByRole("dialog", { name: "Ari Nguyen Student Info" });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Ari Park" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "ari.park@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0199" } });
    fireEvent.change(within(dialog).getByLabelText("Belt rank"), { target: { value: "Blue" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Student Changes" }));

    expect(await screen.findByText("Ari Park updated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          id: "managed-ari",
          displayName: "Ari Park",
          email: "ari.park@example.com",
          phone: "(262) 555-0199",
          title: "Blue Belt Student",
          studentId: "student-ari"
        }),
        expect.objectContaining({
          id: "managed-bree",
          displayName: "Bree Nguyen",
          email: "bree@example.com",
          phone: "(262) 555-0102",
          title: "White Belt Student",
          studentId: "student-bree"
        })
      ]);
    });
  });

  it("keeps direct-message participant names in sync when an active student profile is corrected", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-0198",
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        guardianName: "Paula Nguyen",
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-recipient",
        threadId: "direct-staff-seed__student-ari",
        senderId: "direct-staff-seed",
        senderName: "Instructor Team",
        recipientId: "student-ari",
        recipientName: "Ari Nguyen",
        body: "Ari practice note.",
        createdAt: "2026-06-01T10:00:00.000Z",
        status: "sent"
      },
      {
        id: "direct-ari-sender",
        threadId: "direct-staff-seed__student-ari",
        senderId: "student-ari",
        senderName: "Ari Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Instructor Team",
        body: "Ari reply.",
        createdAt: "2026-06-01T10:05:00.000Z",
        status: "sent"
      },
      {
        id: "direct-ari-parent",
        threadId: "direct-staff-seed__parent-student-ari",
        senderId: "parent-student-ari",
        senderName: "Mina Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Instructor Team",
        body: "Parent follow-up.",
        createdAt: "2026-06-01T10:10:00.000Z",
        status: "sent"
      },
      {
        id: "direct-bree",
        threadId: "direct-staff-seed__student-bree",
        senderId: "direct-staff-seed",
        senderName: "Instructor Team",
        recipientId: "student-bree",
        recipientName: "Bree Nguyen",
        body: "Bree practice note.",
        createdAt: "2026-06-01T10:15:00.000Z",
        status: "sent"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    const dialog = screen.getByRole("dialog", { name: "Ari Nguyen Student Info" });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Ari Park" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Name"), { target: { value: "Mina Park" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Student Changes" }));

    expect(await screen.findByText("Ari Park updated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "direct-ari-recipient", recipientId: "student-ari", recipientName: "Ari Park" }),
        expect.objectContaining({ id: "direct-ari-sender", senderId: "student-ari", senderName: "Ari Park" }),
        expect.objectContaining({ id: "direct-ari-parent", senderId: "parent-student-ari", senderName: "Mina Park" }),
        expect.objectContaining({ id: "direct-bree", recipientId: "student-bree", recipientName: "Bree Nguyen" })
      ]);
    });
  });

  it("keeps check-in history names in sync when an active student profile is corrected", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        guardianName: "Mina Nguyen",
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        guardianName: "Paula Nguyen",
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.checkins.v1", JSON.stringify([
      {
        id: "checkin-ari",
        studentId: "student-ari",
        studentName: "Ari Nguyen",
        date: "2026-05-28",
        beltRank: "Yellow"
      },
      {
        id: "checkin-bree",
        studentId: "student-bree",
        studentName: "Bree Nguyen",
        date: "2026-05-29",
        beltRank: "White"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    const dialog = screen.getByRole("dialog", { name: "Ari Nguyen Student Info" });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Ari Park" } });
    fireEvent.change(within(dialog).getByLabelText("Belt rank"), { target: { value: "Blue" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Student Changes" }));

    expect(await screen.findByText("Ari Park updated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.checkins.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "checkin-ari", studentId: "student-ari", studentName: "Ari Park", beltRank: "Yellow" }),
        expect.objectContaining({ id: "checkin-bree", studentId: "student-bree", studentName: "Bree Nguyen", beltRank: "White" })
      ]);
    });
  });

  it("does not queue inactive student quick outreach from direct state calls", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/students"]}>
        <AppStateProvider>
          <StudentQuickOutreachHarness studentId="student-cora" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Queue inactive outreach" }));

    expect(await screen.findByText("Harness messages: 0")).toBeInTheDocument();
    expect(screen.getByText("Harness last contacted: none")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; lastContactedAt?: string }>;
    expect(savedStudents).toEqual([expect.objectContaining({ id: "student-cora" })]);
    expect(savedStudents[0].lastContactedAt).toBeUndefined();
  });

  it("keeps bulk outreach idempotent when the same action fires twice before rerender", async () => {
    const todayKey = dateKeyOffset(0);
    const birthdayDate = `${Number(todayKey.slice(0, 4)) - 12}${todayKey.slice(4)}`;
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        dateOfBirth: birthdayDate,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <BulkOutreachDoubleCallHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Send celebration outreach twice" }));

    expect(await screen.findByText("Harness return counts: 1,0")).toBeInTheDocument();
    expect(await screen.findByText("Harness messages: 1")).toBeInTheDocument();
    expect(screen.getByText(`Harness last contacted: ${todayKey}`)).toBeInTheDocument();
    const savedMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ recipientName: string; kind: string; body: string }>;
    expect(savedMessages).toEqual([
      expect.objectContaining({ recipientName: "Ari Nguyen", kind: "celebration", body: expect.stringMatching(/birthday/i) })
    ]);
  });

  it("returns existing quick outreach when duplicate requests are already queued today", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/students"]}>
        <AppStateProvider>
          <StudentProfileUpdateDoubleCallHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Request profile update twice" }));

    expect(await screen.findByText("Harness quick return names: Ari Nguyen,Ari Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Harness quick messages: 1")).toBeInTheDocument();
    expect(screen.getByText(`Harness quick last contacted: ${todayKey}`)).toBeInTheDocument();
    const savedMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ recipientName: string; kind: string; body: string }>;
    expect(savedMessages).toEqual([
      expect.objectContaining({ recipientName: "Ari Nguyen", kind: "profile-update", body: expect.stringMatching(/profile information/i) })
    ]);
  });

  it("does not queue milestone encouragement for a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/students"]}>
        <AppStateProvider>
          <DeactivateAndQueueMilestoneHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and queue milestone" }));

    await waitFor(() => {
      expect(screen.getByText("Harness milestone student status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness milestone return name: none")).toBeInTheDocument();
      expect(screen.getByText("Harness milestone messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness milestone last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send bulk milestone encouragement to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndSendMilestonesHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send milestones" }));

    await waitFor(() => {
      expect(screen.getByText("Harness bulk milestone status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness bulk milestone return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness bulk milestone messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness bulk milestone last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not queue a profile update for a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/students"]}>
        <AppStateProvider>
          <DeactivateAndQueueProfileUpdateHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and request profile update" }));

    await waitFor(() => {
      expect(screen.getByText("Harness profile student status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness profile return name: none")).toBeInTheDocument();
      expect(screen.getByText("Harness profile messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness profile last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send bulk profile updates to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        profileUpdatedAt: "2025-05-01",
        joinedAt: "2025-05-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndSendProfileUpdatesHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send profile updates" }));

    await waitFor(() => {
      expect(screen.getByText("Harness bulk profile status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness bulk profile return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness bulk profile messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness bulk profile last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send class reminders to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-ari", title: "Private Lesson", date: dateKeyOffset(1), time: "4:30 PM", type: "private-lesson", studentId: "student-ari" }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndSendClassRemindersHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send class reminders" }));

    await waitFor(() => {
      expect(screen.getByText("Harness class reminder status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness class reminder return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness class reminder messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness class reminder last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send celebration outreach to a student made inactive in the same action", async () => {
    const todayKey = dateKeyOffset(0);
    const birthdayDate = `${Number(todayKey.slice(0, 4)) - 12}${todayKey.slice(4)}`;
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        dateOfBirth: birthdayDate,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndSendCelebrationsHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send celebrations" }));

    await waitFor(() => {
      expect(screen.getByText("Harness celebration status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness celebration return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness celebration messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness celebration last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send paused-student reactivation outreach to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Paused",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndSendPausedReviewHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and review paused students" }));

    await waitFor(() => {
      expect(screen.getByText("Harness paused status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness paused return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness paused messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness paused last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send new-student check-ins to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 2,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-7)
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndSendNewStudentCheckInsHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send new student check-ins" }));

    await waitFor(() => {
      expect(screen.getByText("Harness new student status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness new student return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness new student messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness new student last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send missed-class follow-ups to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 3,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndSendMissedClassHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send missed-class follow-ups" }));

    await waitFor(() => {
      expect(screen.getByText("Harness missed-class status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness missed-class return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness missed-class messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness missed-class last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send attendance-gap check-ins to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 1,
        joinedAt: dateKeyOffset(-60),
        lastCheckIn: dateKeyOffset(-30)
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndCheckAttendanceGapsHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and check attendance gaps" }));

    await waitFor(() => {
      expect(screen.getByText("Harness attendance-gap status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness attendance-gap return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness attendance-gap messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness attendance-gap last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send trial conversion outreach to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Trial",
        beltRank: "White",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: dateKeyOffset(-3)
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndConvertTrialHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and convert trial students" }));

    await waitFor(() => {
      expect(screen.getByText("Harness trial status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness trial return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness trial messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness trial last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not send belt test invites to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 14,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <DeactivateAndSendBeltInvitesHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and invite belt candidates" }));

    await waitFor(() => {
      expect(screen.getByText("Harness belt status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness belt return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness belt messages: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness belt last contacted: none")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; lastContactedAt?: string }>;
      expect(savedStudents).toEqual([expect.objectContaining({ id: "student-ari", status: "Inactive" })]);
      expect(savedStudents[0].lastContactedAt).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not queue welcome outreach when creating inactive student records", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/students"]}>
        <AppStateProvider>
          <StudentCreationHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Create inactive student" }));

    await waitFor(() => {
      expect(screen.getByText("Harness students: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness messages: 0")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
      expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([
        expect.objectContaining({ firstName: "Cora", lastName: "Miles", status: "Inactive", profileUpdatedAt: todayKey })
      ]);
    });
  });

  it("keeps active student creation idempotent when the same enrollment fires twice before rerender", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/students"]}>
        <AppStateProvider>
          <StudentCreationDoubleCallHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Create student twice" }));

    expect(await screen.findByText("Harness duplicate student returns: Ari Nguyen,Ari Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Harness duplicate students: 1")).toBeInTheDocument();
    expect(screen.getByText("Harness duplicate messages: 1")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([
      expect.objectContaining({ firstName: "Ari", lastName: "Nguyen", email: "ari@example.com", phone: "(262) 555-0101", status: "Active", profileUpdatedAt: todayKey })
    ]);
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ kind: "welcome", recipientName: "Ari Nguyen", recipientPhone: "(262) 555-0101", status: "queued" })
    ]);
  });

  it("tells staff inactive students cannot receive quick outreach from the student modal", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Cora Miles student info" }));
    const dialog = screen.getByRole("dialog", { name: "Cora Miles Student Info" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Queue progress encouragement for Cora Miles" }));

    expect(await screen.findByText("Only current students can receive quick outreach.")).toBeInTheDocument();
    expect(screen.queryByText("Progress encouragement queued for Cora Miles.")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
  });

  it("groups the student directory into belt category blocks", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari-group",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        dateOfBirth: "2015-05-17",
        gender: "Female",
        phone: "(262) 555-0100",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        program: "Youth Taekwondo",
        classesAttended: 2,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-bree-group",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        dateOfBirth: "2014-01-01",
        gender: "Female",
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Trial",
        beltRank: "Yellow",
        program: "Youth Taekwondo",
        classesAttended: 1,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-cora-group",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        dateOfBirth: "",
        gender: "Non-binary",
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Paused",
        beltRank: "Blue",
        program: "Leadership",
        classesAttended: 8,
        missedClassCount: 1,
        joinedAt: "2026-05-01"
      }
    ]));

    renderLoggedInApp("/students");

    const directory = screen.getByLabelText("Student directory by belt");
    const expectedGroups: Array<[string, Array<{ age: string; gender: string; name: string }>]> = [
      [
        "White",
        [
          { name: "Ari Nguyen", gender: "Female", age: "11" }
        ]
      ],
      [
        "Yellow",
        [
          { name: "Bree Santos", gender: "Female", age: "12" }
        ]
      ],
      [
        "Blue",
        [
          { name: "Cora Miles", gender: "Non-binary", age: "Not set" }
        ]
      ]
    ];

    expectedGroups.forEach(([belt, studentRows]) => {
      const group = within(directory).getByRole("group", { name: `${belt} belt students` });

      expect(within(group).getByRole("heading", { name: `${belt} Belt` })).toBeInTheDocument();
      expect(within(group).getByText(`${studentRows.length} student${studentRows.length === 1 ? "" : "s"}`)).toBeInTheDocument();
      expect(group.getAttribute("style")).toContain("--student-belt-color");
      expect(within(group).queryByText("Name")).not.toBeInTheDocument();
      expect(within(group).queryByText("Gender")).not.toBeInTheDocument();
      expect(within(group).queryByText("Age")).not.toBeInTheDocument();
      studentRows.forEach(({ age, gender, name }) => {
        const nameButton = within(group).getByRole("button", { name: `Open ${name} student info` });
        expect(nameButton).toBeInTheDocument();
        expect(nameButton.getAttribute("style")).toContain("--student-belt-color");
        expect(within(nameButton).getByText(name)).toHaveClass("student-name-list-name");
        expect(within(nameButton).getByText(gender)).toHaveClass("student-name-list-cell");
        expect(within(nameButton).getByText(`Age ${age}`)).toHaveClass("student-name-list-cell--age");
        expect(nameButton.querySelector(".student-name-list-belt-rail")).toBeInTheDocument();
        expect(nameButton.querySelector(".student-name-list-training")).toBeInTheDocument();
      });
      expect(within(group).queryByText(/@example\.com/)).not.toBeInTheDocument();
    });
  });

  it("lets managers create a new student from the restored students page", () => {
    renderLoggedInApp("/students");

    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Belt Board" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Student Check-In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
    const dialog = screen.getByRole("dialog", { name: "Create New Student" });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Leo Park" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "leo@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0188" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

    expect(screen.getByText("Leo Park")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Leo Park student info" })).toBeInTheDocument();
  });

  it("lets managers delete a selected student from the restored students page", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-talia-delete",
        firstName: "Talia",
        lastName: "Brooks",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0142",
        email: "talia@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      }
    ]));

    renderLoggedInApp("/students");

    expect(screen.getByText("Talia Brooks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Talia Brooks student info" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Student" }));

    expect(screen.queryByText("Talia Brooks")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Talia Brooks Student Info" })).not.toBeInTheDocument();
  });

  it("preserves sibling communication history when deleting a student who shares a family phone", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "2625550101",
        body: "Ari needs a progress check.",
        status: "queued",
        createdAt: "2026-06-01T10:00:00.000Z"
      },
      {
        id: "message-bree",
        kind: "follow-up",
        recipientName: "Bree Nguyen",
        recipientPhone: "2625550101",
        body: "Bree needs a progress check.",
        status: "queued",
        createdAt: "2026-06-01T10:05:00.000Z"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Student" }));

    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "message-bree", recipientName: "Bree Nguyen", recipientPhone: "2625550101" })
    ]);
    expect(screen.getByRole("button", { name: "Open Bree Nguyen student info" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Ari Nguyen student info" })).not.toBeInTheDocument();
  });

  it("removes deleted student direct message threads while preserving other conversations", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-student",
        threadId: "direct-staff-seed__student-ari",
        senderId: "direct-staff-seed",
        senderName: "Instructor Team",
        recipientId: "student-ari",
        recipientName: "Ari Nguyen",
        body: "Ari practice note.",
        createdAt: "2026-06-01T10:00:00.000Z",
        status: "sent"
      },
      {
        id: "direct-ari-parent",
        threadId: "direct-staff-seed__parent-student-ari",
        senderId: "parent-student-ari",
        senderName: "Ari Parent",
        recipientId: "direct-staff-seed",
        recipientName: "Instructor Team",
        body: "Parent follow-up.",
        createdAt: "2026-06-01T10:05:00.000Z",
        status: "sent"
      },
      {
        id: "direct-bree-student",
        threadId: "direct-staff-seed__student-bree",
        senderId: "direct-staff-seed",
        senderName: "Instructor Team",
        recipientId: "student-bree",
        recipientName: "Bree Nguyen",
        body: "Bree practice note.",
        createdAt: "2026-06-01T10:10:00.000Z",
        status: "sent"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Student" }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "direct-bree-student", recipientId: "student-bree" })
      ]);
    });
    expect(screen.getByRole("button", { name: "Open Bree Nguyen student info" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Ari Nguyen student info" })).not.toBeInTheDocument();
  });

  it.skip("deactivates a deleted student's linked login without affecting other student accounts", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-ari",
        displayName: "Ari Nguyen",
        username: "ari.student",
        password: "AriPass123",
        role: "student",
        status: "active",
        email: "ari@example.com",
        phone: "(262) 555-0101",
        title: "Yellow Belt Student",
        access: [],
        studentId: "student-ari",
        createdAt: "2026-05-20T10:00:00.000Z"
      },
      {
        id: "managed-bree",
        displayName: "Bree Nguyen",
        username: "bree.student",
        password: "BreePass123",
        role: "student",
        status: "active",
        email: "bree@example.com",
        phone: "(262) 555-0102",
        title: "White Belt Student",
        access: [],
        studentId: "student-bree",
        createdAt: "2026-05-20T10:05:00.000Z"
      }
    ]));
    const managerView = renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Student" }));

    const managedAccounts = JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]") as Array<{ id: string; status: string; studentId?: string }>;
    const deletedStudentAccount = managedAccounts.find((account) => account.id === "managed-ari");
    expect(deletedStudentAccount).toEqual(expect.objectContaining({ status: "inactive" }));
    expect(deletedStudentAccount).not.toHaveProperty("studentId");
    expect(managedAccounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "managed-bree", status: "active", studentId: "student-bree" })
    ]));

    managerView.unmount();
    const accountManagementView = renderLoggedInApp("/manager?tool=create");
    const deletedStudentAccountCard = screen.getByRole("article", { name: "Ari Nguyen student account" });
    expect(deletedStudentAccountCard).toHaveTextContent("Inactive");
    fireEvent.click(within(deletedStudentAccountCard).getByRole("button", { name: "Reactivate Ari Nguyen account" }));

    expect(await screen.findByText("Unable to update account status.")).toBeInTheDocument();
    expect(deletedStudentAccountCard).toHaveTextContent("Inactive");

    accountManagementView.unmount();
    clearActiveSession();
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "ari.student" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "AriPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Check the username and password.")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "bree.student" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "BreePass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByLabelText("Student profile page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bree Nguyen" })).toBeInTheDocument();
  });

  it("removes inactive student direct message threads while preserving other conversations", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-student",
        threadId: "direct-staff-seed__student-ari",
        senderId: "direct-staff-seed",
        senderName: "Instructor Team",
        recipientId: "student-ari",
        recipientName: "Ari Nguyen",
        body: "Ari practice note.",
        createdAt: "2026-06-01T10:00:00.000Z",
        status: "sent"
      },
      {
        id: "direct-ari-parent",
        threadId: "direct-staff-seed__parent-student-ari",
        senderId: "parent-student-ari",
        senderName: "Ari Parent",
        recipientId: "direct-staff-seed",
        recipientName: "Instructor Team",
        body: "Parent follow-up.",
        createdAt: "2026-06-01T10:05:00.000Z",
        status: "sent"
      },
      {
        id: "direct-bree-student",
        threadId: "direct-staff-seed__student-bree",
        senderId: "direct-staff-seed",
        senderName: "Instructor Team",
        recipientId: "student-bree",
        recipientName: "Bree Nguyen",
        body: "Bree practice note.",
        createdAt: "2026-06-01T10:10:00.000Z",
        status: "sent"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    const dialog = screen.getByRole("dialog", { name: "Ari Nguyen Student Info" });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "Inactive" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Student Changes" }));

    expect(await screen.findByText("Ari Nguyen updated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "direct-bree-student", recipientId: "student-bree" })
      ]);
    });
  });

  it("cancels inactive student queued outreach with alternate phone formatting", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari-queued",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "2625550101",
        body: "Queued Ari outreach.",
        status: "queued",
        createdAt: "2026-05-20T10:00:00.000Z"
      },
      {
        id: "message-bree-queued",
        kind: "follow-up",
        recipientName: "Bree Nguyen",
        recipientPhone: "2625550101",
        body: "Queued Bree outreach.",
        status: "queued",
        createdAt: "2026-05-20T10:10:00.000Z"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    const dialog = screen.getByRole("dialog", { name: "Ari Nguyen Student Info" });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "Inactive" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Student Changes" }));

    expect(await screen.findByText("Ari Nguyen updated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "message-bree-queued", recipientName: "Bree Nguyen", recipientPhone: "2625550101" })
      ]);
    });
  });

  it.skip("deactivates linked student logins, unlinks schedules, and cancels queued outreach when enrollment status is changed to inactive", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-ari",
        displayName: "Ari Nguyen",
        username: "ari.student",
        password: "AriPass123",
        role: "student",
        status: "active",
        email: "ari@example.com",
        phone: "(262) 555-0101",
        title: "Yellow Belt Student",
        access: [],
        studentId: "student-ari",
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-ari", title: "Ari Private Lesson", date: dateKeyOffset(2), time: "4:30 PM", type: "private-lesson", studentId: "student-ari" },
      { id: "schedule-open", title: "Open Youth Class", date: dateKeyOffset(2), time: "5:30 PM", type: "class" }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari-queued",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        body: "Queued Ari outreach.",
        status: "queued",
        createdAt: "2026-05-20T10:00:00.000Z"
      },
      {
        id: "message-ari-sent",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        body: "Already sent Ari history.",
        status: "sent",
        createdAt: "2026-05-19T10:00:00.000Z",
        sentAt: "2026-05-19T10:05:00.000Z"
      },
      {
        id: "message-bree-queued",
        kind: "follow-up",
        recipientName: "Bree Santos",
        recipientPhone: "(262) 555-0102",
        body: "Queued Bree outreach.",
        status: "queued",
        createdAt: "2026-05-20T10:10:00.000Z"
      }
    ]));
    const studentsView = renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    const dialog = screen.getByRole("dialog", { name: "Ari Nguyen Student Info" });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "Inactive" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Student Changes" }));

    expect(await screen.findByText("Ari Nguyen updated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "managed-ari", status: "inactive", studentId: "student-ari" })
      ]);
    });
    const savedSchedule = JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]") as Array<{ id: string; studentId?: string }>;
    const ariSchedule = savedSchedule.find((item) => item.id === "schedule-ari");
    expect(ariSchedule).toEqual(expect.objectContaining({ id: "schedule-ari" }));
    expect(ariSchedule?.studentId).toBeUndefined();
    expect(savedSchedule).toEqual(expect.arrayContaining([expect.objectContaining({ id: "schedule-open" })]));
    const savedMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ id: string; status: string }>;
    expect(savedMessages).toEqual([
      expect.objectContaining({ id: "message-ari-sent", status: "sent" }),
      expect.objectContaining({ id: "message-bree-queued", status: "queued" })
    ]);
    expect(savedMessages.some((message) => message.id === "message-ari-queued")).toBe(false);

    studentsView.unmount();
    const accountManagementView = renderLoggedInApp("/manager?tool=create");
    const inactiveStudentAccountCard = screen.getByRole("article", { name: "Ari Nguyen student account" });
    expect(inactiveStudentAccountCard).toHaveTextContent("Inactive");
    fireEvent.click(within(inactiveStudentAccountCard).getByRole("button", { name: "Reactivate Ari Nguyen account" }));

    expect(await screen.findByText("Unable to update account status.")).toBeInTheDocument();

    accountManagementView.unmount();
    clearActiveSession();
    renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "ari.student" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "AriPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Check the username and password.")).toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("reactivates linked student logins when enrollment status returns to active", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Inactive",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "managed-ari",
        displayName: "Ari Nguyen",
        username: "ari.student",
        password: "AriPass123",
        role: "student",
        status: "inactive",
        email: "ari@example.com",
        phone: "(262) 555-0101",
        title: "Yellow Belt Student",
        access: [],
        studentId: "student-ari",
        createdAt: "2026-05-20T10:00:00.000Z"
      }
    ]));
    renderLoggedInApp("/students");

    fireEvent.click(screen.getByRole("button", { name: "Open Ari Nguyen student info" }));
    const dialog = screen.getByRole("dialog", { name: "Ari Nguyen Student Info" });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "Active" } });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Ari Park" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "ari.park@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0199" } });
    fireEvent.change(within(dialog).getByLabelText("Belt rank"), { target: { value: "Blue" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Student Changes" }));

    expect(await screen.findByText("Ari Park updated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.managedAccounts.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          id: "managed-ari",
          status: "active",
          displayName: "Ari Park",
          email: "ari.park@example.com",
          phone: "(262) 555-0199",
          title: "Blue Belt Student",
          studentId: "student-ari"
        })
      ]);
    });
  });

  it("uses full-page manager chrome instead of a sidebar on tool pages", () => {
    renderLoggedInApp("/students");

    expect(screen.getByLabelText("Manager workspace")).toHaveClass("manager-full-page-shell");
    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.getByRole("img", { name: "Cho's Martial Arts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle manager sidebar" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
  });

  it("lets staff create schedule items and studio events", () => {
    const { unmount } = renderLoggedInApp("/schedule");

    expect(screen.queryByRole("dialog", { name: "Add Schedule Event" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const scheduleDialog = screen.getByRole("dialog", { name: "Add Schedule Event" });

    fireEvent.change(within(scheduleDialog).getByLabelText("Event title"), { target: { value: "Youth Testing Prep" } });
    fireEvent.change(within(scheduleDialog).getByLabelText("Schedule date"), { target: { value: "2026-05-22" } });
    fireEvent.change(within(scheduleDialog).getByLabelText("Schedule time"), { target: { value: "5:30 PM" } });
    fireEvent.click(within(scheduleDialog).getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Youth Testing Prep")).toBeInTheDocument();
    expect(screen.getByText("2026-05-22 at 5:30 PM")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add Schedule Event" })).not.toBeInTheDocument();

    unmount();
    renderLoggedInApp("/events");

    expect(screen.queryByRole("dialog", { name: "Add Event" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Event" }));
    const eventDialog = screen.getByRole("dialog", { name: "Add Event" });

    fireEvent.change(within(eventDialog).getByLabelText("Event title"), { target: { value: "Black Belt Testing" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event date"), { target: { value: "2026-06-01" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event time"), { target: { value: "6:00 PM" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event details"), { target: { value: "Testing date for eligible students." } });
    fireEvent.click(within(eventDialog).getByRole("button", { name: "Add Event" }));

    expect(screen.getByText("Black Belt Testing")).toBeInTheDocument();
    expect(screen.getByText(/Testing date for eligible students/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add Event" })).not.toBeInTheDocument();
  });

  it("keeps studio event creation idempotent when the same item fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/events"]}>
        <AppStateProvider>
          <StudioEventDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add event twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate event returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate events: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.events.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          title: "Family Board Breaking Night",
          date: "2026-06-20",
          time: "6:00 PM",
          details: "Students can invite family for board breaking demos.",
          audience: "families"
        })
      ]);
    });
  });

  it("lists only current students in the schedule assignment selector", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));

    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const dialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    const studentSelect = within(dialog).getByLabelText("Student");
    expect(within(studentSelect).getByRole("option", { name: "Ari Nguyen" })).toBeInTheDocument();
    expect(within(studentSelect).queryByRole("option", { name: "Cora Miles" })).not.toBeInTheDocument();
  });

  it("does not create schedule items for inactive students from direct state calls", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/schedule"]}>
        <AppStateProvider>
          <ScheduleStudentAssignmentHarness studentId="student-cora" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add inactive schedule" }));

    expect(await screen.findByText("Harness scheduled items: 0")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]")).toEqual([]);
  });

  it("schedules a newly added active student from the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/schedule"]}>
        <AppStateProvider>
          <AddAndScheduleStudentHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add and schedule student" }));

    await waitFor(() => {
      expect(screen.getByText("Harness same-day schedule student: schedule-same-day@example.com")).toBeInTheDocument();
      expect(screen.getByText("Harness same-day schedule items: 1")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; email: string }>;
      const sameDayStudent = savedStudents.find((student) => student.email === "schedule-same-day@example.com");
      expect(sameDayStudent).toEqual(expect.objectContaining({ email: "schedule-same-day@example.com" }));
      expect(JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          title: "Same Day Intro Lesson",
          date: "2026-06-15",
          time: "4:30 PM",
          type: "private-lesson",
          studentId: sameDayStudent?.id,
          notes: "First-day assessment."
        })
      ]);
    });
  });

  it("keeps schedule item creation idempotent when the same item fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/schedule"]}>
        <AppStateProvider>
          <ScheduleDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add schedule twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate schedule returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate scheduled items: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          title: "Youth Testing Prep",
          date: "2026-06-12",
          time: "4:30 PM",
          type: "class",
          recurring: true,
          titleColor: "#c51625",
          notes: "Forms review."
        })
      ]);
    });
  });

  it("lets staff make a schedule item recurring from the existing Scheduling page", () => {
    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const dialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    fireEvent.change(within(dialog).getByLabelText("Event title"), { target: { value: "Friday Demo Class" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule date"), { target: { value: "2026-05-15" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule time"), { target: { value: "6:15 PM" } });
    fireEvent.click(within(dialog).getByLabelText("Recurring"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Repeats weekly")).toBeInTheDocument();
    expect(screen.getByText("Friday Demo Class")).toBeInTheDocument();
    expect(screen.getByText("2026-05-15 at 6:15 PM")).toBeInTheDocument();
  });

  it("shows the next weekly occurrence for recurring schedule items", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00-05:00"));
    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const dialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    fireEvent.change(within(dialog).getByLabelText("Event title"), { target: { value: "Friday Demo Class" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule date"), { target: { value: "2026-05-15" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule time"), { target: { value: "6:15 PM" } });
    fireEvent.click(within(dialog).getByLabelText("Recurring"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Schedule Event" }));

    const scheduleItem = screen.getByText("Friday Demo Class").closest(".workflow-directory-row") as HTMLElement;
    expect(within(scheduleItem).getByText("Repeats weekly")).toBeInTheDocument();
    expect(within(scheduleItem).getByText("Next occurrence: 2026-05-22 at 6:15 PM")).toBeInTheDocument();
  });

  it("marks stale one-time schedule items separately from upcoming work", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-past", title: "Past Private Lesson", date: "2026-05-18", time: "4:30 PM", type: "private-lesson" },
      { id: "schedule-future", title: "Future Private Lesson", date: "2026-05-22", time: "4:30 PM", type: "private-lesson" }
    ]));

    renderLoggedInApp("/schedule");

    const pastScheduleItem = screen.getByText("Past Private Lesson").closest(".workflow-directory-row") as HTMLElement;
    const futureScheduleItem = screen.getByText("Future Private Lesson").closest(".workflow-directory-row") as HTMLElement;
    expect(within(pastScheduleItem).getByText("Past one-time item")).toBeInTheDocument();
    expect(within(futureScheduleItem).getByText("Upcoming one-time item")).toBeInTheDocument();
  });

  it("lets staff remove stale one-time schedule items directly from schedule", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-past", title: "Past Private Lesson", date: "2026-05-18", time: "4:30 PM", type: "private-lesson" },
      { id: "schedule-future", title: "Future Private Lesson", date: "2026-05-22", time: "4:30 PM", type: "private-lesson" }
    ]));

    renderLoggedInApp("/schedule");

    const pastScheduleItem = screen.getByText("Past Private Lesson").closest(".workflow-directory-row") as HTMLElement;
    fireEvent.click(within(pastScheduleItem).getByRole("button", { name: "Remove Past Private Lesson schedule item" }));

    expect(screen.getByText("Past Private Lesson removed from schedule.")).toBeInTheDocument();
    expect(screen.queryByText("Past Private Lesson")).not.toBeInTheDocument();
    expect(screen.getByText("Future Private Lesson")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "schedule-future", title: "Future Private Lesson" })
    ]);
  });

  it("lets staff clear all past one-time schedule items at once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00-05:00"));
    window.localStorage.setItem("chos.operations.schedule.v1", JSON.stringify([
      { id: "schedule-past-private", title: "Past Private Lesson", date: "2026-05-18", time: "4:30 PM", type: "private-lesson" },
      { id: "schedule-past-class", title: "Past One-Time Class", date: "2026-05-17", time: "5:30 PM", type: "class" },
      { id: "schedule-future", title: "Future Private Lesson", date: "2026-05-22", time: "4:30 PM", type: "private-lesson" },
      { id: "schedule-recurring", title: "Past Weekly Class", date: "2026-05-15", time: "6:15 PM", type: "class", recurring: true }
    ]));

    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Clear 2 past one-time schedule items" }));

    expect(screen.getByText("2 past schedule items cleared.")).toBeInTheDocument();
    expect(screen.queryByText("Past Private Lesson")).not.toBeInTheDocument();
    expect(screen.queryByText("Past One-Time Class")).not.toBeInTheDocument();
    expect(screen.getByText("Future Private Lesson")).toBeInTheDocument();
    expect(screen.getByText("Past Weekly Class")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.schedule.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "schedule-future", title: "Future Private Lesson" }),
      expect.objectContaining({ id: "schedule-recurring", title: "Past Weekly Class", recurring: true })
    ]);
  });

  it("lets staff set a custom title color for schedule items", () => {
    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const dialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    fireEvent.change(within(dialog).getByLabelText("Event title"), { target: { value: "Blue Team Class" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule date"), { target: { value: "2026-05-29" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule time"), { target: { value: "7:00 PM" } });
    fireEvent.change(within(dialog).getByLabelText("Title color"), { target: { value: "#7dd3fc" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Blue Team Class")).toHaveStyle({ color: "#7dd3fc" });
  });

  it("lets staff create a custom schedule type and reuse it from the dropdown", () => {
    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const dialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    fireEvent.change(within(dialog).getByLabelText("Event title"), { target: { value: "Demo Team Practice" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule date"), { target: { value: "2026-05-24" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule time"), { target: { value: "4:15 PM" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule type"), { target: { value: "custom" } });
    const customTypeDialog = screen.getByRole("dialog", { name: "Create schedule type" });
    expect(within(customTypeDialog).getByText("Name the new schedule type.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Custom schedule type")).not.toBeInTheDocument();

    fireEvent.change(within(customTypeDialog).getByLabelText("New schedule type name"), { target: { value: "Demo Team" } });
    fireEvent.click(within(customTypeDialog).getByRole("button", { name: "Submit" }));

    const scheduleType = within(dialog).getByLabelText("Schedule type");
    expect(scheduleType).toHaveValue("Demo Team");
    expect(within(scheduleType).getByRole("option", { name: "Demo Team" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Demo Team Practice")).toBeInTheDocument();
    expect(screen.getAllByText("Demo Team").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const secondDialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    const secondScheduleType = within(secondDialog).getByLabelText("Schedule type");
    fireEvent.change(secondScheduleType, { target: { value: "Demo Team" } });
    expect(secondScheduleType).toHaveValue("Demo Team");
  });

  it("lets managers create, edit, and remove recurring classes", () => {
    renderLoggedInApp("/classes");

    expect(screen.getByRole("heading", { name: "Classes" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create Class" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New Class" }));
    const createDialog = screen.getByRole("dialog", { name: "Create Class" });
    fireEvent.change(within(createDialog).getByLabelText("Class name"), { target: { value: "Youth Sparring" } });
    fireEvent.click(within(createDialog).getByLabelText("Monday"));
    fireEvent.click(within(createDialog).getByLabelText("Wednesday"));
    fireEvent.change(within(createDialog).getByLabelText("Start time"), { target: { value: "17:15" } });
    fireEvent.change(within(createDialog).getByLabelText("End time"), { target: { value: "18:00" } });
    fireEvent.change(within(createDialog).getByLabelText("Class notes"), { target: { value: "Pads, footwork, and controlled sparring." } });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create Class" }));

    expect(screen.getByText("Youth Sparring")).toBeInTheDocument();
    expect(screen.getByText("Monday, Wednesday")).toBeInTheDocument();
    expect(screen.getByText("5:15 PM - 6:00 PM")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create Class" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edit Youth Sparring/i }));
    const editDialog = screen.getByRole("dialog", { name: "Edit Youth Sparring" });
    expect(within(editDialog).getByRole("heading", { name: "Edit Youth Sparring" })).toBeInTheDocument();
    fireEvent.change(within(editDialog).getByLabelText("Class name"), { target: { value: "Advanced Sparring" } });
    fireEvent.change(within(editDialog).getByLabelText("End time"), { target: { value: "18:30" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save Class Changes" }));

    expect(screen.getByText("Advanced Sparring")).toBeInTheDocument();
    expect(screen.getByText("5:15 PM - 6:30 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edit Advanced Sparring/i }));
    const deleteDialog = screen.getByRole("dialog", { name: "Edit Advanced Sparring" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Remove Class" }));

    expect(screen.queryByText("Advanced Sparring")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit Advanced Sparring" })).not.toBeInTheDocument();
  });

  it("keeps class creation idempotent when the same item fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.classes.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/classes"]}>
        <AppStateProvider>
          <StudioClassDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add class twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate class returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate classes: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.classes.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          name: "Youth Sparring",
          daysOfWeek: [1, 3],
          startTime: "17:15",
          endTime: "18:00",
          recurring: true,
          titleColor: "#c51625",
          notes: "Pads, footwork, and controlled sparring."
        })
      ]);
    });
  });

  it("keeps recurring classes visible on the existing Classes page", () => {
    renderLoggedInApp("/classes");

    const todayWeekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
    fireEvent.click(screen.getByRole("button", { name: "New Class" }));
    const dialog = screen.getByRole("dialog", { name: "Create Class" });
    fireEvent.change(within(dialog).getByLabelText("Class name"), { target: { value: "Tiny Tigers" } });
    fireEvent.click(within(dialog).getByLabelText(todayWeekday));
    fireEvent.change(within(dialog).getByLabelText("Start time"), { target: { value: "16:00" } });
    fireEvent.change(within(dialog).getByLabelText("End time"), { target: { value: "16:45" } });
    expect(within(dialog).getByLabelText("Recurring")).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Class" }));

    expect(screen.getByText("Tiny Tigers")).toBeInTheDocument();
    expect(screen.getByText(/4:00 PM - 4:45 PM/)).toBeInTheDocument();
  });

  it("lets managers choose class title color and disable class calendar recurrence", () => {
    renderLoggedInApp("/classes");

    const todayWeekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
    fireEvent.click(screen.getByRole("button", { name: "New Class" }));
    const dialog = screen.getByRole("dialog", { name: "Create Class" });
    fireEvent.change(within(dialog).getByLabelText("Class name"), { target: { value: "Drop In Clinic" } });
    fireEvent.click(within(dialog).getByLabelText(todayWeekday));
    fireEvent.change(within(dialog).getByLabelText("Start time"), { target: { value: "15:00" } });
    fireEvent.change(within(dialog).getByLabelText("End time"), { target: { value: "15:45" } });
    fireEvent.change(within(dialog).getByLabelText("Title color"), { target: { value: "#f9a8d4" } });
    fireEvent.click(within(dialog).getByLabelText("Recurring"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Class" }));

    expect(screen.getByText("Drop In Clinic")).toHaveStyle({ color: "#f9a8d4" });
    expect(screen.getByText("Not recurring on calendar")).toBeInTheDocument();
  });

  it.skip("keeps manager workflow pages in compact directory-first layouts", () => {
    const { unmount } = renderLoggedInApp("/classes");

    const classesHeader = screen.getByRole("heading", { name: "Classes" }).closest(".operations-page-head");
    expect(classesHeader?.closest(".operations-page")).toHaveClass("operations-page--workflow");
    expect(within(classesHeader as HTMLElement).getByRole("button", { name: "New Class" }).closest(".operations-page-action")).toBeInTheDocument();
    expect(screen.getByLabelText("Class directory")).toHaveClass("workflow-directory-grid");
    expect(screen.queryByRole("dialog", { name: "Create Class" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create Class" })).not.toBeInTheDocument();
    const classDirectory = screen.getByLabelText("Class directory");
    expect(within(classDirectory).getByText("Class")).toHaveClass("workflow-directory-column-label");
    expect(within(classDirectory).getByText("Days")).toHaveClass("workflow-directory-column-label");
    expect(within(classDirectory).getByText("Time")).toHaveClass("workflow-directory-column-label");
    expect(within(classDirectory).getByRole("button", { name: "Edit Youth Foundations" })).toBeInTheDocument();

    unmount();
    const scheduleRender = renderLoggedInApp("/schedule");
    const scheduleHeader = screen.getByRole("heading", { name: "Schedule" }).closest(".operations-page-head");
    expect(scheduleHeader?.closest(".operations-page")).toHaveClass("operations-page--workflow");
    expect(within(scheduleHeader as HTMLElement).getByRole("button", { name: "Add Schedule Event" }).closest(".operations-page-action")).toBeInTheDocument();
    const scheduleDirectory = screen.getByLabelText("Schedule directory");
    expect(scheduleDirectory).toHaveClass("workflow-directory-grid");
    expect(screen.queryByRole("dialog", { name: "Add Schedule Event" })).not.toBeInTheDocument();
    expect(within(scheduleDirectory).getByRole("group", { name: "Class schedule items" })).toBeInTheDocument();
    expect(within(scheduleDirectory).getByRole("group", { name: "Private lesson schedule items" })).toBeInTheDocument();
    expect(within(scheduleDirectory).getAllByText("Title")[0]).toHaveClass("workflow-directory-column-label");
    expect(within(scheduleDirectory).getAllByText("Date")[0]).toHaveClass("workflow-directory-column-label");
    expect(within(scheduleDirectory).getAllByText("Time")[0]).toHaveClass("workflow-directory-column-label");

    scheduleRender.unmount();
    const eventsRender = renderLoggedInApp("/events");
    const eventsHeader = screen.getByRole("heading", { name: "Events" }).closest(".operations-page-head");
    expect(eventsHeader?.closest(".operations-page")).toHaveClass("operations-page--workflow");
    expect(within(eventsHeader as HTMLElement).getByRole("button", { name: "Add Event" }).closest(".operations-page-action")).toBeInTheDocument();
    const eventDirectory = screen.getByLabelText("Event directory");
    expect(eventDirectory).toHaveClass("workflow-directory-grid");
    expect(screen.queryByRole("dialog", { name: "Add Event" })).not.toBeInTheDocument();
    expect(within(eventDirectory).getByRole("group", { name: "Students events" })).toBeInTheDocument();
    expect(within(eventDirectory).getByRole("group", { name: "Families events" })).toBeInTheDocument();

    eventsRender.unmount();
    renderLoggedInApp("/merchandise");
    const merchandiseHeader = screen.getByRole("heading", { name: "Merchandise" }).closest(".operations-page-head");
    expect(merchandiseHeader?.closest(".operations-page")).toHaveClass("operations-page--workflow");
    expect(within(merchandiseHeader as HTMLElement).getByRole("button", { name: "Add New Merchandise" }).closest(".operations-page-action")).toBeInTheDocument();
    const productDirectory = screen.getByLabelText("Product directory");
    expect(productDirectory).toHaveClass("workflow-directory-grid");
    expect(within(productDirectory).getByRole("group", { name: "Gloves merchandise" })).toBeInTheDocument();
    expect(within(productDirectory).getByRole("group", { name: "Uniforms merchandise" })).toBeInTheDocument();
    expect(within(productDirectory).getByRole("button", { name: "Edit Youth Boxing Gloves" })).toBeInTheDocument();
  });

  it.skip("lets students check in and see rank progress", () => {
    renderLoggedInApp("/check-ins", "student");

    expect(screen.getByRole("heading", { name: "Student Check-In" })).toBeInTheDocument();
    expect(screen.getByText(/Current rank/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check In Today" }));

    expect(screen.getByText(/Checked in today:/i)).toBeInTheDocument();
    expect(screen.getByText(/Classes attended/i)).toBeInTheDocument();
  });

  it("shows next-rank progress on check-in and updates it after attendance is recorded", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 7,
        missedClassCount: 1,
        joinedAt: "2026-01-01"
      }
    ]));

    renderLoggedInApp("/check-ins");

    const progressPanel = screen.getByLabelText("Check-in belt progress");
    expect(within(progressPanel).getByText("7 of 8 classes complete")).toBeInTheDocument();
    expect(within(progressPanel).getByText("Next rank target: Yellow Belt")).toBeInTheDocument();
    expect(within(progressPanel).getByText("1 class to testing review")).toBeInTheDocument();
    expect(within(progressPanel).getByLabelText("88% of 8 classes complete")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check In Today" }));

    expect(await within(progressPanel).findByText("8 of 8 classes complete")).toBeInTheDocument();
    expect(within(progressPanel).getByText("Ready for instructor review")).toBeInTheDocument();
    expect(within(progressPanel).getByLabelText("100% of 8 classes complete")).toBeInTheDocument();
  });

  it.skip("checks in the linked student for managed student accounts", async () => {
    const todayKey = dateKeyOffset(0);
    const students = [
      {
        id: "student-talia",
        firstName: "Talia",
        lastName: "Brooks",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0100",
        email: "talia@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 4,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-derek",
        firstName: "Derek",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "derek@example.com",
        status: "Active",
        beltRank: "Red",
        classesAttended: 83,
        missedClassCount: 1,
        joinedAt: "2026-01-01"
      }
    ];
    const account = {
      id: "managed-derek",
      displayName: "Derek Miles",
      username: "derek.student",
      password: "Dragon123",
      role: "student",
      status: "active",
      access: [],
      studentId: "student-derek",
      createdAt: "2026-05-10T00:00:00.000Z"
    };

    renderManagedStudentApp("/check-ins", account, students);

    expect(screen.getByRole("heading", { name: "Student Check-In" })).toBeInTheDocument();
    expect(screen.getByText("Red Belt")).toBeInTheDocument();
    expect(screen.getByText("Classes attended: 83")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check In Today" }));

    expect(await screen.findByText(/Checked in today:/i)).toBeInTheDocument();
    await waitFor(() => {
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]");
      expect(savedStudents).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "student-derek", classesAttended: 84, lastCheckIn: todayKey }),
        expect.objectContaining({ id: "student-talia", classesAttended: 4 })
      ]));
      expect(savedStudents.find((student: { id: string; lastCheckIn?: string }) => student.id === "student-talia")?.lastCheckIn).toBeUndefined();

      const savedCheckIns = JSON.parse(window.localStorage.getItem("chos.operations.checkins.v1") ?? "[]");
      expect(savedCheckIns).toEqual(expect.arrayContaining([
        expect.objectContaining({ studentId: "student-derek", studentName: "Derek Miles", date: todayKey })
      ]));
      expect(savedCheckIns.some((checkIn: { studentId: string }) => checkIn.studentId === "student-talia")).toBe(false);
    });
  });

  it("tells staff when check-in queues progress outreach", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 7,
        missedClassCount: 1,
        joinedAt: "2026-01-01"
      }
    ]));

    renderLoggedInApp("/check-ins");

    fireEvent.click(screen.getByRole("button", { name: "Check In Today" }));

    expect(await screen.findByText("Ari Nguyen checked in. Progress outreach queued.")).toBeInTheDocument();
  });

  it.skip("does not present older check-in records as today", () => {
    const yesterdayKey = dateKeyOffset(-1);
    window.localStorage.setItem("chos.operations.checkins.v1", JSON.stringify([
      { id: "checkin-yesterday", studentId: "student-talia-brooks-seed", studentName: "Talia Brooks", date: yesterdayKey, beltRank: "White" }
    ]));

    renderLoggedInApp("/check-ins");

    expect(screen.queryByText(/Checked in today:/i)).not.toBeInTheDocument();
    expect(screen.getByText(`Last check-in: ${yesterdayKey}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check In Today" })).toBeEnabled();
  });

  it("lists only current students in the staff check-in selector", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 9,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));

    renderLoggedInApp("/check-ins");

    const studentSelect = screen.getByLabelText("Student");
    expect(within(studentSelect).getByRole("option", { name: "Ari Nguyen" })).toBeInTheDocument();
    expect(within(studentSelect).queryByRole("option", { name: "Cora Miles" })).not.toBeInTheDocument();
    expect(screen.queryByText("Blue Belt")).not.toBeInTheDocument();
  });

  it("shows a clear check-in empty state when no current students are available", () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Blue",
        classesAttended: 24,
        missedClassCount: 2,
        joinedAt: "2026-01-01"
      }
    ]));

    renderLoggedInApp("/check-ins");

    expect(screen.getByText("No current students are available for check-in.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Student")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check In Today" })).not.toBeInTheDocument();
    expect(screen.queryByText("Blue Belt")).not.toBeInTheDocument();
  });

  it("prevents duplicate same-day check-ins from inflating attendance", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 9,
        missedClassCount: 3,
        joinedAt: "2026-01-01"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/check-ins"]}>
        <AppStateProvider>
          <CheckInDoubleCallHarness studentId="student-ari" todayKey={todayKey} />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Double check in" }));

    expect(await screen.findByText("Harness classes: 10")).toBeInTheDocument();
    expect(screen.getByText("Harness today logs: 1")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "student-ari", classesAttended: 10, missedClassCount: 0, lastCheckIn: todayKey })
      ]));
      expect(JSON.parse(window.localStorage.getItem("chos.operations.checkins.v1") ?? "[]").filter((checkIn: { studentId: string; date: string }) => checkIn.studentId === "student-ari" && checkIn.date === todayKey)).toHaveLength(1);
    });
  });

  it("checks in a newly added active student from the same action", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.checkins.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/check-ins"]}>
        <AppStateProvider>
          <AddAndCheckInStudentHarness todayKey={todayKey} />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add and check in student" }));

    expect(await screen.findByText("Harness same-day classes: 1")).toBeInTheDocument();
    expect(screen.getByText("Harness same-day check-ins: 1")).toBeInTheDocument();
    await waitFor(() => {
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; classesAttended: number; lastCheckIn?: string }>;
      const sameDayStudent = savedStudents.find((student) => student.id.startsWith("student-"));
      expect(sameDayStudent).toMatchObject({ classesAttended: 1, lastCheckIn: todayKey });
      expect(JSON.parse(window.localStorage.getItem("chos.operations.checkins.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          studentId: sameDayStudent?.id,
          studentName: "Same Day Student",
          date: todayKey,
          beltRank: "White"
        })
      ]);
    });
  });

  it("does not check in a student made inactive in the same action", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 9,
        missedClassCount: 3,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.checkins.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/check-ins"]}>
        <AppStateProvider>
          <DeactivateAndCheckInStudentHarness studentId="student-ari" todayKey={todayKey} />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and check in student" }));

    await waitFor(() => {
      expect(screen.getByText("Harness inactive status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness inactive classes: 9")).toBeInTheDocument();
      expect(screen.getByText("Harness inactive check-ins: 0")).toBeInTheDocument();
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; status: string; classesAttended: number; lastCheckIn?: string }>;
      expect(savedStudents).toEqual([
        expect.objectContaining({ id: "student-ari", status: "Inactive", classesAttended: 9 })
      ]);
      expect(savedStudents[0].lastCheckIn).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.checkins.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not recreate a deleted student when check-in fires in the same action", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 9,
        missedClassCount: 3,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.checkins.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/check-ins"]}>
        <AppStateProvider>
          <DeleteAndCheckInStudentHarness studentId="student-ari" todayKey={todayKey} />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete and check in student" }));

    await waitFor(() => {
      expect(screen.getByText("Harness deleted student: missing")).toBeInTheDocument();
      expect(screen.getByText("Harness deleted check-ins: 0")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([]);
      expect(JSON.parse(window.localStorage.getItem("chos.operations.checkins.v1") ?? "[]")).toEqual([]);
    });
  });

  it("does not record inactive student check-ins from direct state calls", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Inactive",
        beltRank: "Yellow",
        classesAttended: 9,
        missedClassCount: 3,
        joinedAt: "2026-01-01"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/check-ins"]}>
        <AppStateProvider>
          <CheckInDoubleCallHarness studentId="student-ari" todayKey={todayKey} />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Double check in" }));

    await waitFor(() => {
      const savedStudents = JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]") as Array<{ id: string; classesAttended: number; missedClassCount: number; lastCheckIn?: string }>;
      expect(savedStudents).toEqual([
        expect.objectContaining({ id: "student-ari", classesAttended: 9, missedClassCount: 3 })
      ]);
      expect(savedStudents[0].lastCheckIn).toBeUndefined();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.checkins.v1") ?? "[]").filter((checkIn: { studentId: string; date: string }) => checkIn.studentId === "student-ari" && checkIn.date === todayKey)).toHaveLength(0);
    });
    expect(screen.getByText("Harness classes: 9")).toBeInTheDocument();
    expect(screen.getByText("Harness today logs: 0")).toBeInTheDocument();
  });

  it("queues one progress outreach text when check-in reaches belt review readiness", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 7,
        missedClassCount: 1,
        joinedAt: "2026-01-01"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/check-ins"]}>
        <AppStateProvider>
          <CheckInDoubleCallHarness studentId="student-ari" todayKey={todayKey} />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Double check in" }));

    expect(await screen.findByText("Harness classes: 8")).toBeInTheDocument();
    expect(screen.getByText("Harness today logs: 1")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "student-ari", classesAttended: 8, missedClassCount: 0, lastCheckIn: todayKey, lastContactedAt: todayKey })
      ]));
      const ariMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]").filter(
        (message: { recipientName: string }) => message.recipientName === "Ari Nguyen"
      );
      expect(ariMessages).toEqual([
        expect.objectContaining({
          kind: "follow-up",
          recipientName: "Ari Nguyen",
          recipientPhone: "(262) 555-0101",
          status: "queued",
          body: expect.stringMatching(/belt testing review/i)
        })
      ]);
    });
  });

  it("does not repeat automatic progress outreach after the check-in threshold was already reached", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 8,
        missedClassCount: 1,
        joinedAt: "2026-01-01"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/check-ins"]}>
        <AppStateProvider>
          <CheckInDoubleCallHarness studentId="student-ari" todayKey={todayKey} />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Double check in" }));

    expect(await screen.findByText("Harness classes: 9")).toBeInTheDocument();
    expect(screen.getByText("Harness today logs: 1")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "student-ari", classesAttended: 9, missedClassCount: 0, lastCheckIn: todayKey })
      ]));
      const ariMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]").filter(
        (message: { recipientName: string }) => message.recipientName === "Ari Nguyen"
      );
      expect(ariMessages).toHaveLength(0);
    });
  });

  it.skip("queues missed-class follow-up texts for students who missed three classes", () => {
    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Send Missed-Class Follow-Ups" }));

    expect(screen.getAllByText(/missed you in class/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/missed 3 classes/i).length).toBeGreaterThan(0);
  });

  it("does not queue missed-class follow-up texts without SMS consent evidence", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 3,
        lastContactedAt: dateKeyOffset(-10),
        joinedAt: "2026-01-01",
        smsConsentUpdatedAt: undefined
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Send Missed-Class Follow-Ups" }));

    expect(await screen.findByText("No missed-class follow-ups needed.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
  });

  it.skip("lets staff send every queued text from message settings", async () => {
    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Send Missed-Class Follow-Ups" }));
    expect(await screen.findByText("2 missed-class follow-up texts queued.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send Queued Texts" }));

    expect(await screen.findByText("2 queued texts sent.")).toBeInTheDocument();
    expect(screen.queryByText("queued")).not.toBeInTheDocument();
    expect(screen.getAllByText("sent").length).toBeGreaterThan(1);
  });

  it("shows unread app-message notifications and lets staff mark them seen from message settings", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-inbound",
        threadId: "direct-staff-seed__student-ari",
        senderId: "student-ari",
        senderName: "Ari Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Can I get the testing schedule?",
        createdAt: "2026-06-02T15:00:00.000Z",
        status: "sent"
      }
    ]));
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({ lastSeenDirectMessageAt: "2026-06-01T10:00:00.000Z" }));

    renderLoggedInApp("/messages");

    expect(screen.getByRole("heading", { name: "Notification Center" })).toBeInTheDocument();
    expect(screen.getByText("1 unread app message")).toBeInTheDocument();
    expect(screen.getByText("Can I get the testing schedule?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark app messages seen" }));

    expect(await screen.findByText("App message notifications marked seen.")).toBeInTheDocument();
    expect(screen.getByText("0 unread app messages")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.notificationSettings.v1") ?? "{}")).toEqual(expect.objectContaining({
      lastSeenDirectMessageAt: "2026-06-02T15:00:00.000Z"
    }));
  });

  it.skip("keeps operations notification settings scoped to the active staff account", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-inbound",
        threadId: "direct-staff-seed__student-ari",
        senderId: "student-ari",
        senderName: "Ari Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Can I get the testing schedule?",
        createdAt: "2026-06-02T15:00:00.000Z",
        status: "sent"
      }
    ]));
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({
      browserNotificationsEnabled: true,
      browserPermission: "granted",
      lastSeenDirectMessageAt: "2026-06-03T10:00:00.000Z",
      pushPublicKey: "manager-public-key",
      pushSubscriptionEndpoint: "https://push.example.test/subscriptions/manager-device",
      pushSubscriptionJson: JSON.stringify({
        endpoint: "https://push.example.test/subscriptions/manager-device",
        expirationTime: null
      }),
      pushSubscribedAt: "2026-06-03T10:00:00.000Z"
    }));

    renderManagedStaffApp("/messages", {
      id: "staff-jordan",
      displayName: "Jordan Lee",
      username: "jordan.staff",
      password: "StaffPass123",
      role: "staff",
      status: "active",
      access: ["messages"],
      createdAt: "2026-06-01T10:00:00.000Z"
    });

    expect(screen.getByText("1 unread app message")).toBeInTheDocument();
    expect(screen.getByText("Paste a public VAPID key from the private push server before connecting this device.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark app messages seen" }));

    expect(await screen.findByText("App message notifications marked seen.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.notificationSettings.jordan.staff.v1") ?? "{}")).toEqual(expect.objectContaining({
      lastSeenDirectMessageAt: "2026-06-02T15:00:00.000Z"
    }));
    expect(JSON.parse(window.localStorage.getItem("chos.operations.notificationSettings.v1") ?? "{}")).toEqual(expect.objectContaining({
      lastSeenDirectMessageAt: "2026-06-03T10:00:00.000Z",
      pushSubscriptionEndpoint: "https://push.example.test/subscriptions/manager-device"
    }));
  });

  it("syncs the installed app badge with unread app messages when badging is supported", async () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "setAppBadge", {
      configurable: true,
      value: setAppBadge
    });
    Object.defineProperty(navigator, "clearAppBadge", {
      configurable: true,
      value: clearAppBadge
    });
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-inbound",
        threadId: "direct-staff-seed__student-ari",
        senderId: "student-ari",
        senderName: "Ari Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Can I get the testing schedule?",
        createdAt: "2026-06-02T15:00:00.000Z",
        status: "sent"
      }
    ]));
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({ lastSeenDirectMessageAt: "2026-06-01T10:00:00.000Z" }));

    renderLoggedInApp("/messages");

    await waitFor(() => {
      expect(setAppBadge).toHaveBeenCalledWith(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark app messages seen" }));

    await waitFor(() => {
      expect(clearAppBadge).toHaveBeenCalled();
    });
  });

  it("normalizes service-worker push notification URLs to the app scope", async () => {
    const worker = loadChoServiceWorkerForTest();
    const pushHandler = worker.listeners.get("push");
    if (!pushHandler) throw new Error("Expected Cho service worker to register a push handler.");
    const waitUntilPromises: Promise<unknown>[] = [];

    pushHandler({
      data: {
        json: () => ({
          title: "Belt test posted",
          body: "Open the messages page for the latest update.",
          url: "messages",
          tag: "thread-belt-test",
          threadId: "direct-staff-seed__student-ari"
        })
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise);
      }
    });

    await Promise.all(waitUntilPromises);

    expect(worker.showNotification).toHaveBeenCalledWith("Belt test posted", expect.objectContaining({
      body: "Open the messages page for the latest update.",
      tag: "thread-belt-test",
      data: {
        url: "https://chos.example/chos-martial-arts-prototype/messages",
        threadId: "direct-staff-seed__student-ari"
      }
    }));
  });

  it("keeps service-worker notification clicks inside the app scope", async () => {
    const worker = loadChoServiceWorkerForTest();
    const clickHandler = worker.listeners.get("notificationclick");
    if (!clickHandler) throw new Error("Expected Cho service worker to register a notification click handler.");
    const close = vi.fn();
    const waitUntilPromises: Promise<unknown>[] = [];

    clickHandler({
      notification: {
        close,
        data: {
          url: "https://example.invalid/phishing"
        }
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise);
      }
    });

    await Promise.all(waitUntilPromises);

    expect(close).toHaveBeenCalled();
    expect(worker.clients.openWindow).toHaveBeenCalledWith("https://chos.example/chos-martial-arts-prototype/messages");
  });

  it("sets the service-worker app badge from push unread counts", async () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const worker = loadChoServiceWorkerForTest("https://chos.example/chos-martial-arts-prototype/", { setAppBadge });
    const pushHandler = worker.listeners.get("push");
    if (!pushHandler) throw new Error("Expected Cho service worker to register a push handler.");
    const waitUntilPromises: Promise<unknown>[] = [];

    pushHandler({
      data: {
        json: () => ({
          body: "Ari sent a new message.",
          unreadCount: 4
        })
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise);
      }
    });

    await Promise.all(waitUntilPromises);

    expect(setAppBadge).toHaveBeenCalledWith(4);
    expect(worker.showNotification).toHaveBeenCalledWith("New Cho's message", expect.objectContaining({
      body: "Ari sent a new message."
    }));
  });

  it("clears the service-worker app badge from zero unread push counts", async () => {
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    const worker = loadChoServiceWorkerForTest("https://chos.example/chos-martial-arts-prototype/", { clearAppBadge });
    const pushHandler = worker.listeners.get("push");
    if (!pushHandler) throw new Error("Expected Cho service worker to register a push handler.");
    const waitUntilPromises: Promise<unknown>[] = [];

    pushHandler({
      data: {
        json: () => ({
          body: "Messages are marked seen.",
          unreadCount: 0
        })
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise);
      }
    });

    await Promise.all(waitUntilPromises);

    expect(clearAppBadge).toHaveBeenCalled();
    expect(worker.showNotification).toHaveBeenCalledWith("New Cho's message", expect.objectContaining({
      body: "Messages are marked seen."
    }));
  });

  it("captures and exports a web push subscription for private device notification delivery", async () => {
    const pushSubscription = {
      endpoint: "https://push.example.test/subscriptions/device-1",
      expirationTime: null,
      toJSON: () => ({
        endpoint: "https://push.example.test/subscriptions/device-1",
        expirationTime: null,
        keys: {
          p256dh: "public-device-key",
          auth: "device-auth-secret"
        }
      })
    };
    const subscribe = vi.fn().mockResolvedValue(pushSubscription);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { subscribe } }) }
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class NotificationMock {
        static permission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
      }
    });
    const clickAnchor = vi.fn();
    let pushBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      pushBlob = blob;
      return "blob:push-subscription";
    });
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, "click", { configurable: true, value: clickAnchor });
      }
      return element;
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    try {
      renderLoggedInApp("/messages");

      fireEvent.change(screen.getByLabelText("Web Push public key"), {
        target: { value: "BEl6PDiRfYyIRLr1YWkN2v6k3cGv2GvZcK2nXrjZ4g6rPQu4xNfQb3-V6X0c0fPKHM8xojN6F0fJgQI3PNe7RDs" }
      });
      fireEvent.click(screen.getByRole("button", { name: "Connect This Device" }));

      expect(await screen.findByText("Device push subscription ready for private server sync.")).toBeInTheDocument();
      expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array)
      }));
      expect(JSON.parse(window.localStorage.getItem("chos.operations.notificationSettings.v1") ?? "{}")).toEqual(expect.objectContaining({
        pushPublicKey: "BEl6PDiRfYyIRLr1YWkN2v6k3cGv2GvZcK2nXrjZ4g6rPQu4xNfQb3-V6X0c0fPKHM8xojN6F0fJgQI3PNe7RDs",
        pushSubscriptionEndpoint: "https://push.example.test/subscriptions/device-1",
        pushSubscriptionJson: expect.stringContaining("https://push.example.test/subscriptions/device-1"),
        pushSubscribedAt: expect.any(String)
      }));

      fireEvent.click(screen.getByRole("button", { name: "Export Push Subscription JSON" }));

      expect(await screen.findByText("Device push subscription exported.")).toBeInTheDocument();
      if (!pushBlob) throw new Error("Expected push subscription export to create a Blob.");
      const payload = JSON.parse(await pushBlob.text());
      expect(payload).toEqual(expect.objectContaining({
        schemaVersion: "chos-web-push-subscription.v1",
        provider: "web-push",
        deliveryMode: "server-push",
        requestedBy: expect.objectContaining({ email: "manager123@chos.prototype" }),
        subscription: expect.objectContaining({ endpoint: "https://push.example.test/subscriptions/device-1" })
      }));
      expect(JSON.stringify(payload)).not.toMatch(/VAPID_PRIVATE|privateKey|TWILIO_AUTH_TOKEN|authToken/i);
      expect(createdAnchor).toHaveAttribute("download", expect.stringMatching(/^chos-web-push-subscription-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:push-subscription");
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
    }
  });

  it("posts a web push subscription to a private push server without exposing secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ synced: true }))
    });
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({
      browserNotificationsEnabled: true,
      browserPermission: "granted",
      pushPublicKey: "BEl6PDiRfYyIRLr1YWkN2v6k3cGv2GvZcK2nXrjZ4g6rPQu4xNfQb3-V6X0c0fPKHM8xojN6F0fJgQI3PNe7RDs",
      pushSubscriptionEndpoint: "https://push.example.test/subscriptions/device-1",
      pushSubscriptionJson: JSON.stringify({
        endpoint: "https://push.example.test/subscriptions/device-1",
        expirationTime: null,
        keys: {
          p256dh: "public-device-key",
          auth: "device-auth-secret"
        }
      }),
      pushSubscribedAt: "2026-06-03T10:00:00.000Z"
    }));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Private push server URL"), { target: { value: "https://push.cho.example/api/push/subscriptions" } });
    fireEvent.click(screen.getByRole("button", { name: "Sync Push Subscription" }));

    expect(await screen.findByText("Device push subscription synced to private server.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://push.cho.example/api/push/subscriptions", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toEqual(expect.objectContaining({
      schemaVersion: "chos-web-push-subscription.v1",
      provider: "web-push",
      deliveryMode: "server-push",
      requestedBy: expect.objectContaining({ email: "manager123@chos.prototype" }),
      subscription: expect.objectContaining({ endpoint: "https://push.example.test/subscriptions/device-1" })
    }));
    expect(JSON.stringify(requestBody)).not.toMatch(/VAPID_PRIVATE|privateKey|TWILIO_AUTH_TOKEN|authToken|password/i);
  });

  it("shows a device notification for the newest unread app message when browser alerts are enabled", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) }
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class NotificationMock {
        static permission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
      }
    });
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([
      {
        id: "direct-ari-inbound",
        threadId: "direct-staff-seed__student-ari",
        senderId: "student-ari",
        senderName: "Ari Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Can I get the testing schedule?",
        createdAt: "2026-06-02T15:00:00.000Z",
        status: "sent"
      }
    ]));
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({
      browserNotificationsEnabled: true,
      browserPermission: "granted",
      lastSeenDirectMessageAt: "2026-06-01T10:00:00.000Z",
      lastBrowserNotifiedAt: "2026-06-01T10:00:00.000Z"
    }));

    renderLoggedInApp("/messages");

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith("New message from Ari Nguyen", expect.objectContaining({
        body: "Can I get the testing schedule?",
        tag: "chos-direct-staff-seed__student-ari"
      }));
    });
    expect(JSON.parse(window.localStorage.getItem("chos.operations.notificationSettings.v1") ?? "{}")).toEqual(expect.objectContaining({
      lastBrowserNotifiedAt: "2026-06-02T15:00:00.000Z"
    }));
  });

  it("lets managers send a test device notification from message settings", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) }
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class NotificationMock {
        static permission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
      }
    });
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({
      browserNotificationsEnabled: true,
      browserPermission: "granted"
    }));

    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Send Test Notification" }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith("Cho's test notification", expect.objectContaining({
        body: "Device notifications are ready for app messages.",
        tag: "chos-test-notification",
        data: expect.objectContaining({ url: expect.stringContaining("/messages") })
      }));
    });
    expect(await screen.findByText("Test device notification sent.")).toBeInTheDocument();
  });

  it("shows live Twilio readiness before managers export relay texts", () => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class NotificationMock {
        static permission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
      }
    });
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 6,
        missedClassCount: 0,
        joinedAt: "2026-01-01",
        studentSmsOptOutAt: "2026-06-01T10:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "marketing",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        recipientRole: "student",
        recipientId: "student-ari",
        body: "Family night registration is open.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z",
        deliveryChannel: "sms",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued"
      }
    ]));
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({
      browserNotificationsEnabled: true,
      browserPermission: "granted"
    }));

    renderLoggedInApp("/messages");

    const checklist = screen.getByLabelText("Twilio live readiness checklist");
    expect(within(checklist).getByRole("heading", { name: "Live Twilio Readiness" })).toBeInTheDocument();
    expect(within(checklist).getByText("Server relay required")).toBeInTheDocument();
    expect(within(checklist).getByText("Account SID + auth pair + sender option required")).toBeInTheDocument();
    expect(within(checklist).getByText("1 relay-ready queued text")).toBeInTheDocument();
    expect(within(checklist).getByText("1 SMS opt-out record active")).toBeInTheDocument();
    expect(within(checklist).getByText("Device notifications enabled")).toBeInTheDocument();
    expect(within(checklist).getByText("Push subscription not connected")).toBeInTheDocument();
    expect(within(checklist).getByText("Relay result import ready")).toBeInTheDocument();
    expect(within(checklist).getByText("Status callback import ready")).toBeInTheDocument();
    expect(within(checklist).getByText("Inbound webhook import ready")).toBeInTheDocument();
    expect(within(checklist).getByText("Webhook signature helper ready")).toBeInTheDocument();
    expect(within(checklist).getByText("Private relay must enforce X-Twilio-Signature before webhook persistence")).toBeInTheDocument();
  });

  it("exports a credential-free production messaging integration manifest", async () => {
    const clickAnchor = vi.fn();
    let manifestBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      manifestBlob = blob;
      return "blob:messaging-manifest";
    });
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, "click", { configurable: true, value: clickAnchor });
      }
      return element;
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({
      browserNotificationsEnabled: true,
      browserPermission: "granted",
      pushPublicKey: "BEl6PDiRfYyIRLr1YWkN2v6k3cGv2GvZcK2nXrjZ4g6rPQu4xNfQb3-V6X0c0fPKHM8xojN6F0fJgQI3PNe7RDs",
      pushSubscriptionEndpoint: "https://push.example.test/subscriptions/device-1",
      pushSubscriptionJson: JSON.stringify({
        endpoint: "https://push.example.test/subscriptions/device-1",
        expirationTime: null,
        keys: {
          p256dh: "public-device-key",
          auth: "device-auth-secret"
        }
      }),
      pushSubscribedAt: "2026-06-03T10:00:00.000Z"
    }));

    try {
      renderLoggedInApp("/messages");

      fireEvent.change(screen.getByLabelText("Private Twilio relay URL"), { target: { value: "https://relay.cho.example/api/messages/send" } });
      fireEvent.change(screen.getByLabelText("Private push server URL"), { target: { value: "https://push.cho.example/api/push/subscriptions" } });
      fireEvent.click(screen.getByRole("button", { name: "Export Integration Manifest" }));

      expect(await screen.findByText("Production messaging integration manifest exported.")).toBeInTheDocument();
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      if (!manifestBlob) throw new Error("Expected production integration manifest to create a Blob.");
      const manifest = JSON.parse(await manifestBlob.text());
      expect(manifest).toEqual(expect.objectContaining({
        schemaVersion: "chos-production-messaging-integration.v1",
        requestedBy: expect.objectContaining({ email: "manager123@chos.prototype" }),
        twilio: expect.objectContaining({
          relayEndpoint: "https://relay.cho.example/api/messages/send",
          relayPayloadSchemaVersion: "chos-twilio-relay.v1",
          requiredServerEnv: ["TWILIO_ACCOUNT_SID"],
          authServerEnv: {
            productionRecommended: ["TWILIO_API_KEY", "TWILIO_API_KEY_SECRET"],
            localFallback: ["TWILIO_AUTH_TOKEN"]
          },
          senderServerEnv: {
            recommended: ["TWILIO_MESSAGING_SERVICE_SID"],
            fallback: ["TWILIO_FROM_NUMBER"]
          },
          serverContract: expect.objectContaining({
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
          }),
          webhooks: expect.objectContaining({
            inboundPath: "/api/messages/inbound",
            statusCallbackPathTemplate: "/api/messages/status/{messageId}",
            signatureHeader: "X-Twilio-Signature",
            requireSignatureVerification: true,
            serverContract: expect.objectContaining({
              module: "src/twilioRelayContract.ts",
              signatureValidator: "validateTwilioFormWebhookSignature",
              statusCallbackNormalizer: "normalizeTwilioStatusCallbackForServer",
              inboundSmsNormalizer: "normalizeTwilioInboundSmsWebhookForServer",
              inboundConsentUpdatePlanner: "buildTwilioInboundConsentUpdatePlanForServer"
            })
          })
        }),
        serverAdapterContract: expect.objectContaining({
          module: "src/messagingServerContract.ts",
          healthResponseBuilder: "buildChoMessagingServerHealthResponse",
          requestGateValidator: "validateChoMessagingServerRequestGate",
          relayPlanBuilder: "buildChoMessagingServerRelayPlan",
          pushSubscriptionSyncPlanner: "buildChoMessagingServerPushSubscriptionSyncPlan",
          twilioWebhookPlanner: "buildChoMessagingServerTwilioWebhookPlan"
        }),
        webPush: expect.objectContaining({
          subscriptionSyncEndpoint: "https://push.cho.example/api/push/subscriptions",
          subscriptionSchemaVersion: "chos-web-push-subscription.v1",
          notificationPayloadSchemaVersion: "chos-web-push-notification.v1",
          serverContract: expect.objectContaining({
            module: "src/webPushContract.ts",
            subscriptionValidator: "validateWebPushSubscriptionPayloadForServer",
            notificationPayloadBuilder: "buildChoWebPushNotificationPayload",
            deliveryPlanner: "buildChoWebPushDeliveryPlan",
            providerResponseResultBuilder: "buildChoWebPushResultFromProviderResponse",
            deliveryReconciliationPlanner: "buildChoWebPushDeliveryReconciliationPlan",
            supportedAccountRoles: ["staff"]
          }),
          publicKeyConfigured: true,
          subscriptionEndpoint: "https://push.example.test/subscriptions/device-1",
          notificationUrl: expect.stringContaining("/messages")
        }),
        auth: expect.objectContaining({
          browserCredentialMode: "include",
          managerAuthenticationRequired: true,
          storeSecretsOnServerOnly: true,
          serverContract: expect.objectContaining({
            module: "src/messagingServerContract.ts",
            requestGateValidator: "validateChoMessagingServerRequestGate"
          })
        })
      }));
      expect(JSON.stringify(manifest)).not.toMatch(/staff-pass|private-key-value|twilio-auth-token-value|account-password/i);
      expect(createdAnchor).toHaveAttribute("download", expect.stringMatching(/^chos-production-messaging-integration-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:messaging-manifest");
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
    }
  });

  it("saves a credential-free Twilio launch profile and includes it in the production manifest", async () => {
    const clickAnchor = vi.fn();
    let manifestBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      manifestBlob = blob;
      return "blob:twilio-launch-profile";
    });
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, "click", { configurable: true, value: clickAnchor });
      }
      return element;
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    try {
      renderLoggedInApp("/messages");

      expect(screen.getByRole("heading", { name: "Twilio Account Launch Profile" })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Twilio Messaging Service SID"), { target: { value: "test-messaging-service-sid" } });
      fireEvent.change(screen.getByLabelText("Twilio SMS sender"), { target: { value: "+12625550100" } });
      fireEvent.change(screen.getByLabelText("Inbound webhook URL"), { target: { value: "https://relay.cho.example/api/messages/inbound" } });
      fireEvent.change(screen.getByLabelText("Status callback base URL"), { target: { value: "https://relay.cho.example" } });
      fireEvent.change(screen.getByLabelText("Relay health check URL"), { target: { value: "https://relay.cho.example/api/health/twilio" } });
      fireEvent.change(screen.getByLabelText("Manager auth mode"), { target: { value: "same-site-cookie" } });
      fireEvent.change(screen.getByLabelText("Messaging compliance sender type"), { target: { value: "10dlc" } });
      fireEvent.change(screen.getByLabelText("A2P brand registration status"), { target: { value: "approved" } });
      fireEvent.change(screen.getByLabelText("A2P campaign registration status"), { target: { value: "approved" } });
      fireEvent.change(screen.getByLabelText("Toll-free verification status"), { target: { value: "not-used" } });
      fireEvent.change(screen.getByLabelText("Messaging compliance notes"), { target: { value: "Low-volume mixed campaign approved for family updates and promotions." } });
      fireEvent.click(screen.getByRole("button", { name: "Save Launch Profile" }));

      expect(await screen.findByText("Twilio launch profile saved.")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.twilioLaunchProfile.v1") ?? "{}")).toEqual(expect.objectContaining({
        messagingServiceSid: "test-messaging-service-sid",
        smsSender: "+12625550100",
        inboundWebhookUrl: "https://relay.cho.example/api/messages/inbound",
        statusCallbackBaseUrl: "https://relay.cho.example",
        relayHealthCheckUrl: "https://relay.cho.example/api/health/twilio",
        managerAuthMode: "same-site-cookie",
        senderType: "10dlc",
        a2pBrandStatus: "approved",
        a2pCampaignStatus: "approved",
        tollFreeVerificationStatus: "not-used",
        complianceNotes: "Low-volume mixed campaign approved for family updates and promotions."
      }));

      fireEvent.click(screen.getByRole("button", { name: "Export Integration Manifest" }));

      expect(await screen.findByText("Production messaging integration manifest exported.")).toBeInTheDocument();
      if (!manifestBlob) throw new Error("Expected production integration manifest to create a Blob.");
      const manifest = JSON.parse(await manifestBlob.text());
      expect(manifest.twilio.accountProfile).toEqual(expect.objectContaining({
        messagingServiceSidConfigured: true,
        messagingServiceSid: "test-messaging-service-sid",
        smsSender: "+12625550100",
        inboundWebhookUrl: "https://relay.cho.example/api/messages/inbound",
        statusCallbackBaseUrl: "https://relay.cho.example",
        relayHealthCheckUrl: "https://relay.cho.example/api/health/twilio",
        managerAuthMode: "same-site-cookie"
      }));
      expect(manifest.twilio.complianceProfile).toEqual(expect.objectContaining({
        senderType: "10dlc",
        a2pBrandStatus: "approved",
        a2pCampaignStatus: "approved",
        tollFreeVerificationStatus: "not-used",
        complianceNotes: "Low-volume mixed campaign approved for family updates and promotions.",
        requiresA2p10DlcForUsLongCode: true,
        readyForUsProductionTraffic: true
      }));
      expect(manifest.twilio.serverResponsibilities).toEqual(expect.arrayContaining([
        "Confirm A2P 10DLC brand and campaign approval or verified toll-free/short-code sender status before live US traffic."
      ]));
      expect(JSON.stringify(manifest)).not.toMatch(/twilio-auth-token-value|account-password|staff-pass|private-key-value|ACsecret|SKsecret/i);
      expect(clickAnchor).toHaveBeenCalledTimes(1);
      expect(createdAnchor).toHaveAttribute("download", expect.stringMatching(/^chos-production-messaging-integration-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:twilio-launch-profile");
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
    }
  });

  it("checks the private Twilio relay health endpoint with manager credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "ready",
        checkedAt: "2026-06-03T15:00:00.000Z",
        readinessChecks: {
          managerAuth: true,
          twilioCredentials: true,
          senderConfigured: true,
          complianceReady: true,
          webhookSignatureValidation: true,
          relayCanSend: true
        }
      })
    });
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Relay health check URL"), { target: { value: "https://relay.cho.example/api/health/twilio" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Relay Health" }));

    expect(await screen.findByText("Twilio relay health verified.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://relay.cho.example/api/health/twilio", expect.objectContaining({
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" }
    }));
    expect(screen.getByText("Relay health: ready")).toBeInTheDocument();
    const healthChecks = screen.getByLabelText("Twilio relay health readiness checks");
    expect(within(healthChecks).getByText("Manager auth")).toBeInTheDocument();
    expect(within(healthChecks).getByText("Twilio credentials")).toBeInTheDocument();
    expect(within(healthChecks).getByText("Sender configured")).toBeInTheDocument();
    expect(within(healthChecks).getByText("Compliance ready")).toBeInTheDocument();
    expect(within(healthChecks).getByText("Webhook signatures")).toBeInTheDocument();
    expect(within(healthChecks).getByText("Relay can send")).toBeInTheDocument();
    expect(within(healthChecks).getAllByText("Ready")).toHaveLength(6);
  });

  it("rejects Twilio relay health responses that leak credential-shaped fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "ready",
        readinessChecks: {
          managerAuth: true,
          twilioCredentials: true,
          senderConfigured: true,
          complianceReady: true,
          webhookSignatureValidation: true,
          relayCanSend: true
        },
        TWILIO_AUTH_TOKEN: "twilio-auth-token-value"
      })
    });
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Relay health check URL"), { target: { value: "https://relay.cho.example/api/health/twilio" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Relay Health" }));

    expect(await screen.findByText("Twilio relay health response included secret-like fields.")).toBeInTheDocument();
    expect(screen.getByText("Relay health: unsafe response")).toBeInTheDocument();
    expect(screen.queryByText("Twilio relay health verified.")).not.toBeInTheDocument();
    expect(screen.queryByText("twilio-auth-token-value")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Twilio relay health readiness checks")).not.toBeInTheDocument();
  });

  it("rejects weak Twilio relay health responses without readiness checks", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "ready"
      })
    });
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Relay health check URL"), { target: { value: "https://relay.cho.example/api/health/twilio" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Relay Health" }));

    expect(await screen.findByText("Twilio relay health response needs readiness checks.")).toBeInTheDocument();
    expect(screen.getByText("Relay health: invalid response")).toBeInTheDocument();
    expect(screen.queryByText("Twilio relay health verified.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Twilio relay health readiness checks")).not.toBeInTheDocument();
  });

  it("exports a credential-free text automation manifest for the private schedule runner", async () => {
    const scheduledFor = dateKeyOffset(1);
    const clickAnchor = vi.fn();
    let manifestBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      manifestBlob = blob;
      return "blob:text-automation-manifest";
    });
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, "click", { configurable: true, value: clickAnchor });
      }
      return element;
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    window.localStorage.setItem("chos.operations.scheduledCampaigns.v1", JSON.stringify([
      {
        id: "scheduled-family-sale",
        title: "Family sale",
        body: "Family gear sale starts tomorrow at 5 PM. Reply STOP to opt out.",
        audience: "parents",
        scheduledFor,
        scheduledTime: "17:00",
        status: "scheduled",
        createdAt: "2026-06-02T10:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.operations.automationRuns.v1", JSON.stringify([
      {
        id: "automation-run-manifest",
        ranAt: "2026-06-03T10:00:00.000Z",
        status: "queued",
        totalQueued: 2,
        deliveryProvider: "twilio",
        deliveryChannel: "sms",
        deliveryMode: "prototype",
        relayPayloadSchemaVersion: "chos-twilio-relay.v1",
        breakdown: [
          { key: "eventReminders", label: "Event reminders", queued: 1 },
          { key: "scheduledPromotions", label: "Scheduled promotions", queued: 1 }
        ]
      }
    ]));

    try {
      renderLoggedInApp("/messages");

      fireEvent.change(screen.getByLabelText("Private Twilio relay URL"), { target: { value: "https://relay.cho.example/api/messages/send" } });
      fireEvent.change(screen.getByLabelText("Private push server URL"), { target: { value: "https://push.cho.example/api/push/subscriptions" } });
      fireEvent.click(screen.getByRole("button", { name: "Export Automation Manifest" }));

      expect(await screen.findByText("Text automation manifest exported.")).toBeInTheDocument();
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      if (!manifestBlob) throw new Error("Expected text automation manifest to create a Blob.");
      const manifest = JSON.parse(await manifestBlob.text());
      expect(manifest).toEqual(expect.objectContaining({
        schemaVersion: "chos-text-automation-manifest.v1",
        requestedBy: expect.objectContaining({ email: "manager123@chos.prototype" }),
        automationRun: expect.objectContaining({
          runEndpointPath: "/api/messages/automations/run",
          executionPlanner: "buildTextAutomationExecutionPlan",
          serverContractModule: "src/textAutomationContract.ts",
          serverAdapterContract: expect.objectContaining({
            module: "src/messagingServerContract.ts",
            requestGateValidator: "validateChoMessagingServerRequestGate"
          }),
          recommendedCron: "*/15 * * * *",
          browserCredentialMode: "include",
          managerAuthenticationRequired: true,
          dryRunRecommended: true
        }),
        relay: expect.objectContaining({
          relayEndpoint: "https://relay.cho.example/api/messages/send",
          relayPayloadSchemaVersion: "chos-twilio-relay.v1",
          requiredServerEnv: ["TWILIO_ACCOUNT_SID"],
          authServerEnv: {
            productionRecommended: ["TWILIO_API_KEY", "TWILIO_API_KEY_SECRET"],
            localFallback: ["TWILIO_AUTH_TOKEN"]
          },
          senderServerEnv: {
            recommended: ["TWILIO_MESSAGING_SERVICE_SID"],
            fallback: ["TWILIO_FROM_NUMBER"]
          },
          serverContract: expect.objectContaining({
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
          })
        }),
        webPush: expect.objectContaining({
          subscriptionSyncEndpoint: "https://push.cho.example/api/push/subscriptions",
          subscriptionSchemaVersion: "chos-web-push-subscription.v1",
          notificationPayloadSchemaVersion: "chos-web-push-notification.v1",
          serverContract: expect.objectContaining({
            module: "src/webPushContract.ts",
            subscriptionValidator: "validateWebPushSubscriptionPayloadForServer",
            notificationPayloadBuilder: "buildChoWebPushNotificationPayload",
            deliveryPlanner: "buildChoWebPushDeliveryPlan",
            providerResponseResultBuilder: "buildChoWebPushResultFromProviderResponse",
            deliveryReconciliationPlanner: "buildChoWebPushDeliveryReconciliationPlan",
            supportedAccountRoles: ["staff"]
          }),
          notificationUrl: expect.stringContaining("/messages")
        }),
        scheduledPromotions: [
          expect.objectContaining({
            id: "scheduled-family-sale",
            title: "Family sale",
            audience: "parents",
            scheduledFor,
            scheduledTime: "17:00",
            status: "scheduled"
          })
        ],
        recentAutomationRuns: [
          expect.objectContaining({
            id: "automation-run-manifest",
            status: "queued",
            totalQueued: 2,
            deliveryProvider: "twilio",
            relayPayloadSchemaVersion: "chos-twilio-relay.v1",
            breakdown: expect.arrayContaining([
              expect.objectContaining({ key: "eventReminders", queued: 1 }),
              expect.objectContaining({ key: "scheduledPromotions", queued: 1 })
            ])
          })
        ],
        deliveryGuards: expect.objectContaining({
          enforceSmsOptOutServerSide: true,
          enforceRateLimitsServerSide: true,
          validateTwilioRelayPayloadServerSide: true,
          storeSecretsOnServerOnly: true
        })
      }));
      expect(manifest.automations).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "eventReminders", provider: "twilio" }),
        expect.objectContaining({ key: "scheduledPromotions", provider: "twilio" }),
        expect.objectContaining({ key: "missedClassFollowUps", provider: "twilio" })
      ]));
      expect(JSON.stringify(manifest)).not.toMatch(/staff-pass|private-key-value|twilio-auth-token-value|account-password|p256dh|authSecret/i);
      expect(clickAnchor).toHaveBeenCalledTimes(1);
      expect(createdAnchor).toHaveAttribute("download", expect.stringMatching(/^chos-text-automation-manifest-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:text-automation-manifest");
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
    }
  });

  it("queues automated family event reminder texts from message settings", async () => {
    const todayKey = dateKeyOffset(0);
    const eventDate = dateKeyOffset(3);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        lastContactedAt: dateKeyOffset(-4),
        joinedAt: "2026-01-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        guardianName: "Terry Miles",
        guardianPhone: "(262) 555-1103",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([
      { id: "event-family-night", title: "Family Night", date: eventDate, time: "6:30 PM", details: "Bring uniforms and water.", audience: "families" },
      { id: "event-past", title: "Past Seminar", date: dateKeyOffset(-1), time: "12:00 PM", details: "Past event.", audience: "families" }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Queue Event Reminders" }));

    expect(await screen.findByText("1 event reminder text queued.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        kind: "reminder",
        recipientName: "Mina Nguyen",
        recipientRole: "parent",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued",
        body: expect.stringContaining(`Family Night is scheduled for ${eventDate} at 6:30 PM`)
      })
    ]);
    expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "student-ari", lastContactedAt: todayKey })
    ]));

    fireEvent.click(screen.getByRole("button", { name: "Queue Event Reminders" }));
    expect(await screen.findByText("No event reminders needed.")).toBeInTheDocument();
  });

  it("queues scheduled promotional texts only when the automation date is due", async () => {
    const todayKey = dateKeyOffset(0);
    const tomorrowKey = dateKeyOffset(1);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        lastContactedAt: todayKey,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.campaigns.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.scheduledCampaigns.v1", JSON.stringify([]));

    renderLoggedInApp("/messages");

    expect(screen.getByRole("heading", { name: "Promotion Automation" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Promotion audience"), { target: { value: "parents" } });
    fireEvent.change(screen.getByLabelText("Promotion send date"), { target: { value: tomorrowKey } });
    fireEvent.change(screen.getByLabelText("Promotion send time"), { target: { value: "00:00" } });
    fireEvent.change(screen.getByLabelText("Scheduled promotion message"), { target: { value: "Tomorrow family gear sale starts at 5 PM." } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule Promotion" }));

    expect(await screen.findByText(`Promotion scheduled for ${tomorrowKey} at 12:00 AM.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run Text Automations" }));

    expect(await screen.findByText("No automated texts are due.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);

    fireEvent.change(screen.getByLabelText("Promotion audience"), { target: { value: "parents" } });
    fireEvent.change(screen.getByLabelText("Promotion send date"), { target: { value: todayKey } });
    fireEvent.change(screen.getByLabelText("Promotion send time"), { target: { value: "00:00" } });
    fireEvent.change(screen.getByLabelText("Scheduled promotion message"), { target: { value: "Tonight family gear sale starts at 5 PM." } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule Promotion" }));

    expect(await screen.findByText(`Promotion scheduled for ${todayKey} at 12:00 AM.`)).toBeInTheDocument();
    expect(screen.getByText("2 scheduled promotions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run Text Automations" }));

    expect(await screen.findByText("1 automated text queued.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        kind: "marketing",
        recipientName: "Mina Nguyen",
        recipientRole: "parent",
        body: "Tonight family gear sale starts at 5 PM.",
        status: "queued",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued"
      })
    ]);
    expect(JSON.parse(window.localStorage.getItem("chos.operations.scheduledCampaigns.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ body: "Tomorrow family gear sale starts at 5 PM.", scheduledTime: "00:00", status: "scheduled" }),
      expect.objectContaining({ body: "Tonight family gear sale starts at 5 PM.", scheduledTime: "00:00", status: "queued", queuedAt: expect.any(String) })
    ]));
  });

  it("records a manager-visible audit entry when text automations queue Twilio-ready work", async () => {
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        lastContactedAt: todayKey,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.campaigns.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.scheduledCampaigns.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.automationRuns.v1", JSON.stringify([]));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Promotion audience"), { target: { value: "parents" } });
    fireEvent.change(screen.getByLabelText("Promotion send date"), { target: { value: todayKey } });
    fireEvent.change(screen.getByLabelText("Promotion send time"), { target: { value: "00:00" } });
    fireEvent.change(screen.getByLabelText("Scheduled promotion message"), { target: { value: "Tonight family gear sale starts at 5 PM." } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule Promotion" }));
    expect(await screen.findByText(`Promotion scheduled for ${todayKey} at 12:00 AM.`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run Text Automations" }));

    expect(await screen.findByText("1 automated text queued.")).toBeInTheDocument();
    const auditRuns = JSON.parse(window.localStorage.getItem("chos.operations.automationRuns.v1") ?? "[]");
    expect(auditRuns).toEqual([
      expect.objectContaining({
        status: "queued",
        totalQueued: 1,
        deliveryProvider: "twilio",
        deliveryChannel: "sms",
        deliveryMode: "prototype",
        relayPayloadSchemaVersion: "chos-twilio-relay.v1",
        breakdown: expect.arrayContaining([
          expect.objectContaining({ key: "scheduledPromotions", label: "Scheduled promotions", queued: 1 }),
          expect.objectContaining({ key: "eventReminders", label: "Event reminders", queued: 0 })
        ])
      })
    ]);
    const history = screen.getByLabelText("Text automation run history");
    expect(within(history).getByRole("heading", { name: "Automation Run History" })).toBeInTheDocument();
    expect(within(history).getByText("1 queued")).toBeInTheDocument();
    expect(within(history).getByText("Scheduled promotions: 1")).toBeInTheDocument();
  });

  it("records no-op automation runs so managers can audit empty scheduler checks", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.scheduledCampaigns.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.automationRuns.v1", JSON.stringify([]));

    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Run Text Automations" }));

    expect(await screen.findByText("No automated texts are due.")).toBeInTheDocument();
    const auditRuns = JSON.parse(window.localStorage.getItem("chos.operations.automationRuns.v1") ?? "[]");
    expect(auditRuns).toEqual([
      expect.objectContaining({
        status: "no-due-texts",
        totalQueued: 0,
        deliveryProvider: "twilio",
        deliveryChannel: "sms",
        relayPayloadSchemaVersion: "chos-twilio-relay.v1"
      })
    ]);
    const history = screen.getByLabelText("Text automation run history");
    expect(within(history).getByText("No due texts")).toBeInTheDocument();
    expect(within(history).getByText("0 queued")).toBeInTheDocument();
  });

  it("waits until the scheduled promotion send time before queueing automation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 14, 0, 0));
    const todayKey = dateKeyOffset(0);
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        lastContactedAt: todayKey,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.events.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.campaigns.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.scheduledCampaigns.v1", JSON.stringify([]));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Promotion audience"), { target: { value: "parents" } });
    fireEvent.change(screen.getByLabelText("Promotion send date"), { target: { value: todayKey } });
    fireEvent.change(screen.getByLabelText("Promotion send time"), { target: { value: "15:30" } });
    fireEvent.change(screen.getByLabelText("Scheduled promotion message"), { target: { value: "Later family gear sale starts at 3:30 PM. Reply STOP to opt out." } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule Promotion" }));

    expect(screen.getByText(`Promotion scheduled for ${todayKey} at 3:30 PM.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run Text Automations" }));

    expect(screen.getByText("No automated texts are due.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);

    fireEvent.change(screen.getByLabelText("Promotion send time"), { target: { value: "13:00" } });
    fireEvent.change(screen.getByLabelText("Scheduled promotion message"), { target: { value: "Earlier family gear sale starts at 1 PM. Reply STOP to opt out." } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule Promotion" }));

    expect(screen.getByText(`Promotion scheduled for ${todayKey} at 1:00 PM.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run Text Automations" }));

    expect(screen.getByText("1 automated text queued.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        recipientName: "Mina Nguyen",
        body: "Earlier family gear sale starts at 1 PM. Reply STOP to opt out.",
        status: "queued"
      })
    ]);
    expect(JSON.parse(window.localStorage.getItem("chos.operations.scheduledCampaigns.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ body: "Later family gear sale starts at 3:30 PM. Reply STOP to opt out.", scheduledTime: "15:30", status: "scheduled" }),
      expect.objectContaining({ body: "Earlier family gear sale starts at 1 PM. Reply STOP to opt out.", scheduledTime: "13:00", status: "queued", queuedAt: expect.any(String) })
    ]));
  });

  it("queues Twilio-ready text blasts for staff, parents, and students from the selected audience", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        guardianName: "Leo Santos",
        guardianPhone: "(262) 555-1102",
        status: "Active",
        beltRank: "White",
        classesAttended: 6,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        guardianName: "Terry Miles",
        guardianPhone: "(262) 555-1103",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "staff-kim",
        displayName: "Coach Kim",
        username: "coach.kim",
        password: "staff-pass",
        role: "staff",
        status: "active",
        phone: "(262) 555-2101",
        smsConsentUpdatedAt: "2026-05-21T10:00:00.000Z",
        access: ["messages"],
        createdAt: "2026-05-01T10:00:00.000Z"
      },
      {
        id: "staff-inactive",
        displayName: "Inactive Coach",
        username: "inactive.coach",
        password: "staff-pass",
        role: "staff",
        status: "inactive",
        phone: "(262) 555-2102",
        access: ["messages"],
        createdAt: "2026-05-01T10:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.campaigns.v1", JSON.stringify([]));

    renderLoggedInApp("/messages");

    expect(screen.getByRole("heading", { name: "Twilio Delivery Setup" })).toBeInTheDocument();
    expect(screen.getByText("Server relay required")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "everyone" } });
    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "June family night is open for registration." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Marketing Blast" }));

    expect(await screen.findByText("Text blast queued for 5 contacts.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Ari Nguyen", recipientRole: "student", deliveryChannel: "sms", deliveryProvider: "twilio", deliveryMode: "prototype", deliveryStatus: "queued" }),
      expect.objectContaining({ recipientName: "Mina Nguyen", recipientRole: "parent", deliveryChannel: "sms", deliveryProvider: "twilio", deliveryMode: "prototype", deliveryStatus: "queued" }),
      expect.objectContaining({ recipientName: "Coach Kim", recipientRole: "staff", deliveryChannel: "sms", deliveryProvider: "twilio", deliveryMode: "prototype", deliveryStatus: "queued" })
    ]));

    fireEvent.click(screen.getByRole("button", { name: "Send Queued Texts" }));

    expect(await screen.findByText("5 queued texts sent.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Coach Kim", status: "sent", deliveryStatus: "sent", sentAt: expect.any(String) })
    ]));
  });

  it("previews the selected Twilio audience before queueing a mass text", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        guardianName: "Leo Santos",
        guardianPhone: "(262) 555-1102",
        status: "Active",
        beltRank: "White",
        classesAttended: 6,
        missedClassCount: 0,
        joinedAt: "2026-01-01",
        studentSmsOptOutAt: "2026-06-01T10:00:00.000Z"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        guardianName: "Terry Miles",
        guardianPhone: "(262) 555-1103",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "staff-kim",
        displayName: "Coach Kim",
        username: "coach.kim",
        password: "staff-pass",
        role: "staff",
        status: "active",
        phone: "(262) 555-2101",
        smsConsentUpdatedAt: "2026-05-21T10:00:00.000Z",
        access: ["messages"],
        createdAt: "2026-05-01T10:00:00.000Z"
      }
    ]));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "everyone" } });

    const preview = screen.getByLabelText("Selected text audience delivery preview");
    expect(within(preview).getByText("Delivery preview: 4 contacts ready")).toBeInTheDocument();
    expect(within(preview).getByText("Students 1")).toBeInTheDocument();
    expect(within(preview).getByText("Parents 2")).toBeInTheDocument();
    expect(within(preview).getByText("Staff 1")).toBeInTheDocument();
    expect(within(preview).getByText("Inactive contacts, missing phones, duplicate phones, SMS opt-outs, and missing SMS consent evidence are excluded before queueing.")).toBeInTheDocument();
  });

  it("excludes contacts without SMS consent evidence from mass text previews and queues", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01",
        smsConsentUpdatedAt: "2026-05-20T10:00:00.000Z"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        guardianName: "Leo Santos",
        guardianPhone: "(262) 555-1102",
        status: "Active",
        beltRank: "White",
        classesAttended: 6,
        missedClassCount: 0,
        joinedAt: "2026-01-01",
        smsConsentUpdatedAt: undefined
      }
    ]));
    window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
      {
        id: "staff-kim",
        displayName: "Coach Kim",
        username: "coach.kim",
        password: "staff-pass",
        role: "staff",
        status: "active",
        phone: "(262) 555-2101",
        smsConsentUpdatedAt: "2026-05-21T10:00:00.000Z",
        access: ["messages"],
        createdAt: "2026-05-01T10:00:00.000Z"
      },
      {
        id: "staff-lee",
        displayName: "Coach Lee",
        username: "coach.lee",
        password: "staff-pass",
        role: "staff",
        status: "active",
        phone: "(262) 555-2102",
        access: ["messages"],
        createdAt: "2026-05-01T10:00:00.000Z"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "everyone" } });

    const preview = screen.getByLabelText("Selected text audience delivery preview");
    expect(within(preview).getByText("Delivery preview: 3 contacts ready")).toBeInTheDocument();
    expect(within(preview).getByText("Students 1")).toBeInTheDocument();
    expect(within(preview).getByText("Parents 1")).toBeInTheDocument();
    expect(within(preview).getByText("Staff 1")).toBeInTheDocument();
    expect(within(preview).getByText("Inactive contacts, missing phones, duplicate phones, SMS opt-outs, and missing SMS consent evidence are excluded before queueing.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "June family night registration is open. Reply STOP to opt out." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Marketing Blast" }));

    expect(await screen.findByText("Text blast queued for 3 contacts.")).toBeInTheDocument();
    const queuedMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]");
    expect(queuedMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Ari Nguyen", recipientRole: "student" }),
      expect.objectContaining({ recipientName: "Mina Nguyen", recipientRole: "parent" }),
      expect.objectContaining({ recipientName: "Coach Kim", recipientRole: "staff" })
    ]));
    expect(queuedMessages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Bree Santos" }),
      expect.objectContaining({ recipientName: "Leo Santos" }),
      expect.objectContaining({ recipientName: "Coach Lee" })
    ]));
  });

  it("shows SMS segment preflight for marketing and scheduled promotion messages", async () => {
    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "A".repeat(161) } });

    expect(screen.getByText("SMS preflight: GSM-7 encoding, 161 units, 2 SMS segments.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Scheduled promotion message"), { target: { value: `${"A".repeat(70)}${String.fromCharCode(0x6f22)}` } });

    expect(screen.getByText("SMS preflight: UCS-2 encoding, 71 characters, 2 SMS segments.")).toBeInTheDocument();
  });

  it("shows SMS opt-out language preflight for marketing and scheduled promotion messages", async () => {
    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "June family night registration is open." } });

    expect(screen.getAllByText("Compliance preflight: add opt-out language such as Reply STOP to opt out.").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "June family night registration is open. Reply STOP to opt out." } });
    fireEvent.change(screen.getByLabelText("Scheduled promotion message"), { target: { value: "Family gear sale starts tonight. Reply STOP to opt out." } });

    expect(screen.getAllByText("Compliance preflight: opt-out language detected.").length).toBeGreaterThanOrEqual(2);
  });

  it("exports a Twilio relay payload for deliverable queued texts without exposing credentials", async () => {
    const clickAnchor = vi.fn();
    let relayBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      relayBlob = blob;
      return "blob:twilio-relay";
    });
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, "click", { configurable: true, value: clickAnchor });
      }
      return element;
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    try {
      window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
        {
          id: "student-ari",
          firstName: "Ari",
          lastName: "Nguyen",
          ...completeStudentSafetyFields,
          phone: "(262) 555-0101",
          email: "ari@example.com",
          guardianName: "Mina Nguyen",
          guardianPhone: "(262) 555-1101",
          status: "Active",
          beltRank: "Yellow",
          classesAttended: 12,
          missedClassCount: 0,
          joinedAt: "2026-01-01"
        },
        {
          id: "student-cora",
          firstName: "Cora",
          lastName: "Miles",
          ...completeStudentSafetyFields,
          phone: "(262) 555-0103",
          email: "cora@example.com",
          status: "Inactive",
          beltRank: "Orange",
          classesAttended: 18,
          missedClassCount: 0,
          joinedAt: "2026-01-01"
        }
      ]));
      window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
        {
          id: "staff-kim",
          displayName: "Coach Kim",
          username: "coach.kim",
          password: "staff-pass",
          role: "staff",
          status: "active",
          phone: "1 (262) 555-2101",
          smsConsentUpdatedAt: "2026-05-21T10:00:00.000Z",
          access: ["messages"],
          createdAt: "2026-05-01T10:00:00.000Z"
        }
      ]));
      window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
        {
          id: "message-ari",
          kind: "marketing",
          recipientName: "Ari Nguyen",
          recipientPhone: "(262) 555-0101",
          recipientRole: "student",
          recipientId: "student-ari",
          body: "Family night registration is open. Reply STOP to opt out.",
          status: "queued",
          createdAt: "2026-06-02T10:00:00.000Z",
          deliveryChannel: "sms",
          deliveryProvider: "twilio",
          deliveryMode: "prototype",
          deliveryStatus: "queued"
        },
        {
          id: "message-parent",
          kind: "marketing",
          recipientName: "Mina Nguyen",
          recipientPhone: "(262) 555-1101",
          recipientRole: "parent",
          recipientId: "parent-student-ari",
          body: "Family night registration is open. Reply STOP to opt out.",
          status: "queued",
          createdAt: "2026-06-02T10:05:00.000Z",
          deliveryChannel: "sms",
          deliveryProvider: "twilio",
          deliveryMode: "prototype",
          deliveryStatus: "queued"
        },
        {
          id: "message-staff",
          kind: "marketing",
          recipientName: "Coach Kim",
          recipientPhone: "1 (262) 555-2101",
          recipientRole: "staff",
          recipientId: "staff-kim",
          body: "Family night staffing reminder. Reply STOP to opt out.",
          status: "queued",
          createdAt: "2026-06-02T10:10:00.000Z",
          deliveryChannel: "sms",
          deliveryProvider: "twilio",
          deliveryMode: "prototype",
          deliveryStatus: "queued"
        },
        {
          id: "message-stale",
          kind: "marketing",
          recipientName: "Cora Miles",
          recipientPhone: "(262) 555-0103",
          recipientRole: "student",
          recipientId: "student-cora",
          body: "Inactive students should not be exported.",
          status: "queued",
          createdAt: "2026-06-02T10:15:00.000Z",
          deliveryChannel: "sms",
          deliveryProvider: "twilio",
          deliveryMode: "prototype",
          deliveryStatus: "queued"
        }
      ]));

      renderLoggedInApp("/messages");

      fireEvent.click(screen.getByRole("button", { name: "Export Twilio Relay JSON" }));

      expect(await screen.findByText("3 Twilio relay messages exported.")).toBeInTheDocument();
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      if (!relayBlob) throw new Error("Expected Twilio relay export to create a Blob.");
      const payload = JSON.parse(await relayBlob.text());
      expect(payload).toEqual(expect.objectContaining({
        schemaVersion: "chos-twilio-relay.v1",
        provider: "twilio",
        deliveryMode: "server-relay",
        requestedBy: expect.objectContaining({ email: "manager123@chos.prototype" }),
        messages: [
          expect.objectContaining({ id: "message-ari", to: "+12625550101", recipientRole: "student", body: "Family night registration is open. Reply STOP to opt out.", smsEncoding: "GSM-7", smsUnitCount: 57, smsSegmentCount: 1, optOutLanguageDetected: true, idempotencyKey: "chos-message-ari-12625550101" }),
          expect.objectContaining({ id: "message-parent", to: "+12625551101", recipientRole: "parent" }),
          expect.objectContaining({ id: "message-staff", to: "+12625552101", recipientRole: "staff" })
        ]
      }));
      expect(JSON.stringify(payload)).not.toMatch(/TWILIO_AUTH_TOKEN|authToken|password|staff-pass/i);
      expect(JSON.stringify(payload)).not.toContain("message-stale");
      expect(clickAnchor).toHaveBeenCalledTimes(1);
      expect(createdAnchor).toHaveAttribute("download", expect.stringMatching(/^chos-twilio-relay-queue-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:twilio-relay");
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
    }
  });

  it("applies Twilio relay results to sent, scheduled, and failed delivery logs", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "marketing",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        recipientRole: "student",
        recipientId: "student-ari",
        body: "Family night registration is open. Reply STOP to opt out.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z",
        deliveryChannel: "sms",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued"
      },
      {
        id: "message-parent",
        kind: "marketing",
        recipientName: "Mina Nguyen",
        recipientPhone: "(262) 555-1101",
        recipientRole: "parent",
        recipientId: "parent-student-ari",
        body: "Family night registration is open.",
        status: "queued",
        createdAt: "2026-06-02T10:05:00.000Z",
        deliveryChannel: "sms",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued"
      },
      {
        id: "message-scheduled",
        kind: "marketing",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        recipientRole: "student",
        recipientId: "student-ari",
        body: "Saturday demo team reminder. Reply STOP to opt out.",
        status: "queued",
        createdAt: "2026-06-02T10:10:00.000Z",
        deliveryChannel: "sms",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued"
      }
    ]));
    window.localStorage.setItem("chos.operations.twilioLaunchProfile.v1", JSON.stringify({
      messagingServiceSid: "test-messaging-service-sid",
      smsSender: "+12625550100",
      inboundWebhookUrl: "https://relay.cho.example/api/messages/inbound",
      statusCallbackBaseUrl: "https://relay.cho.example",
      relayHealthCheckUrl: "https://relay.cho.example/api/health/twilio",
      managerAuthMode: "same-site-cookie",
      senderType: "10dlc",
      a2pBrandStatus: "approved",
      a2pCampaignStatus: "approved",
      tollFreeVerificationStatus: "not-used",
      complianceNotes: "Approved sender profile for relay payload validation test."
    }));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Twilio relay results JSON"), {
      target: {
        value: JSON.stringify({
          results: [
            {
              id: "message-ari",
              deliveryStatus: "sent",
              deliveryProviderMessageId: "test-message-sid-1"
            },
            {
              id: "message-parent",
              deliveryStatus: "failed",
              deliveryProviderMessageId: "test-message-sid-2",
              errorCode: "30007",
              errorMessage: "Carrier violation."
            },
            {
              id: "message-scheduled",
              deliveryStatus: "scheduled",
              deliveryProviderMessageId: "test-message-sid-4"
            },
            {
              id: "message-missing",
              deliveryStatus: "sent",
              deliveryProviderMessageId: "test-message-sid-3"
            }
          ]
        })
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Twilio Results" }));

    expect(await screen.findByText("3 Twilio relay results applied.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        id: "message-ari",
        status: "sent",
        sentAt: expect.any(String),
        deliveryMode: "live",
        deliveryStatus: "sent",
        deliveryProviderMessageId: "test-message-sid-1",
        deliveryDetail: "Twilio status: sent."
      }),
      expect.objectContaining({
        id: "message-parent",
        status: "failed",
        deliveryMode: "live",
        deliveryStatus: "failed",
        deliveryProviderMessageId: "test-message-sid-2",
        deliveryDetail: "Twilio status: failed. Error 30007: Carrier violation."
      }),
      expect.objectContaining({
        id: "message-scheduled",
        status: "sent",
        sentAt: expect.any(String),
        deliveryMode: "live",
        deliveryStatus: "scheduled",
        deliveryProviderMessageId: "test-message-sid-4",
        deliveryDetail: "Twilio status: scheduled."
      })
    ]);
  });

  it("applies Twilio status callbacks to existing live delivery logs", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "marketing",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        recipientRole: "student",
        recipientId: "student-ari",
        body: "Family night registration is open.",
        status: "sent",
        sentAt: "2026-06-02T10:05:00.000Z",
        createdAt: "2026-06-02T10:00:00.000Z",
        deliveryChannel: "sms",
        deliveryProvider: "twilio",
        deliveryMode: "live",
        deliveryStatus: "sent",
        deliveryProviderMessageId: "test-message-sid-1"
      }
    ]));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Twilio status callback JSON"), {
      target: {
        value: JSON.stringify({
          messageId: "message-ari",
          MessageSid: "test-message-sid-1",
          MessageStatus: "delivered",
          RawDlrDoneDate: "2606031430"
        })
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Twilio Status" }));

    expect(await screen.findByText("1 Twilio status callback applied.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        id: "message-ari",
        status: "sent",
        sentAt: "2026-06-02T10:05:00.000Z",
        deliveryMode: "live",
        deliveryStatus: "delivered",
        deliveryProviderMessageId: "test-message-sid-1",
        deliveryDetail: "Twilio status: delivered."
      })
    ]);
  });

  it("blocks non-compliant marketing payloads before posting to the private Twilio relay", async () => {
    const fetchMock = vi.fn();
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "marketing",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        recipientRole: "student",
        recipientId: "student-ari",
        body: "Family night registration is open.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z",
        deliveryChannel: "sms",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued"
      }
    ]));
    window.localStorage.setItem("chos.operations.twilioLaunchProfile.v1", JSON.stringify({
      messagingServiceSid: "test-messaging-service-sid",
      smsSender: "+12625550100",
      inboundWebhookUrl: "https://relay.cho.example/api/messages/inbound",
      statusCallbackBaseUrl: "https://relay.cho.example",
      relayHealthCheckUrl: "https://relay.cho.example/api/health/twilio",
      managerAuthMode: "same-site-cookie",
      senderType: "10dlc",
      a2pBrandStatus: "approved",
      a2pCampaignStatus: "approved",
      tollFreeVerificationStatus: "not-used",
      complianceNotes: "Approved sender profile for relay payload validation test."
    }));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Private Twilio relay URL"), { target: { value: "https://relay.cho.example/api/messages/send" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to Twilio Relay" }));

    expect(await screen.findByText("Twilio relay payload needs review before live send.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks live Twilio relay sends until sender compliance is verified", async () => {
    const fetchMock = vi.fn();
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "marketing",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        recipientRole: "student",
        recipientId: "student-ari",
        body: "Family night registration is open. Reply STOP to opt out.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z",
        deliveryChannel: "sms",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued"
      }
    ]));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Private Twilio relay URL"), { target: { value: "https://relay.cho.example/api/messages/send" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to Twilio Relay" }));

    expect(await screen.findByText("Verify sender compliance before live Twilio relay sends.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts deliverable queued texts to a private Twilio relay and applies the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        results: [
          {
            id: "message-ari",
            deliveryStatus: "sent",
            deliveryProviderMessageId: "SMPRIVATE1111111111111111111111111111"
          }
        ]
      }))
    });
    Object.defineProperty(window, "fetch", {
      configurable: true,
      value: fetchMock
    });
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "marketing",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        recipientRole: "student",
        recipientId: "student-ari",
        body: "Family night registration is open. Reply STOP to opt out.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z",
        deliveryChannel: "sms",
        deliveryProvider: "twilio",
        deliveryMode: "prototype",
        deliveryStatus: "queued"
      }
    ]));
    window.localStorage.setItem("chos.operations.twilioLaunchProfile.v1", JSON.stringify({
      messagingServiceSid: "test-messaging-service-sid",
      smsSender: "+12625550100",
      inboundWebhookUrl: "https://relay.cho.example/api/messages/inbound",
      statusCallbackBaseUrl: "https://relay.cho.example",
      relayHealthCheckUrl: "https://relay.cho.example/api/health/twilio",
      managerAuthMode: "same-site-cookie",
      senderType: "10dlc",
      a2pBrandStatus: "approved",
      a2pCampaignStatus: "approved",
      tollFreeVerificationStatus: "not-used",
      complianceNotes: "Approved for live test relay sends."
    }));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Private Twilio relay URL"), { target: { value: "https://relay.cho.example/api/messages/send" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to Twilio Relay" }));

    expect(await screen.findByText("1 Twilio relay result applied.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://relay.cho.example/api/messages/send", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toEqual(expect.objectContaining({
      schemaVersion: "chos-twilio-relay.v1",
      provider: "twilio",
      deliveryMode: "server-relay",
      messages: [
        expect.objectContaining({ id: "message-ari", to: "+12625550101", body: "Family night registration is open. Reply STOP to opt out." })
      ]
    }));
    expect(JSON.stringify(requestBody)).not.toMatch(/TWILIO_AUTH_TOKEN|authToken|password/i);
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        id: "message-ari",
        status: "sent",
        deliveryMode: "live",
        deliveryStatus: "sent",
        deliveryProviderMessageId: "SMPRIVATE1111111111111111111111111111"
      })
    ]);
  });

  it("suppresses opted-out SMS contacts from blasts and Twilio relay exports", async () => {
    const clickAnchor = vi.fn();
    let relayBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      relayBlob = blob;
      return "blob:twilio-optout-relay";
    });
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, "click", { configurable: true, value: clickAnchor });
      }
      return element;
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    try {
      window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
        {
          id: "student-ari",
          firstName: "Ari",
          lastName: "Nguyen",
          ...completeStudentSafetyFields,
          phone: "(262) 555-0101",
          email: "ari@example.com",
          guardianName: "Mina Nguyen",
          guardianPhone: "(262) 555-1101",
          status: "Active",
          beltRank: "Yellow",
          classesAttended: 12,
          missedClassCount: 0,
          joinedAt: "2026-01-01",
          studentSmsOptOutAt: "2026-06-01T10:00:00.000Z"
        },
        {
          id: "student-bree",
          firstName: "Bree",
          lastName: "Santos",
          ...completeStudentSafetyFields,
          phone: "(262) 555-0102",
          email: "bree@example.com",
          guardianName: "Leo Santos",
          guardianPhone: "(262) 555-1102",
          status: "Active",
          beltRank: "White",
          classesAttended: 6,
          missedClassCount: 0,
          joinedAt: "2026-01-01",
          guardianSmsOptOutAt: "2026-06-01T11:00:00.000Z"
        }
      ]));
      window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
        {
          id: "staff-kim",
          displayName: "Coach Kim",
          username: "coach.kim",
          password: "staff-pass",
          role: "staff",
          status: "active",
          phone: "(262) 555-2101",
          smsOptOutAt: "2026-06-01T12:00:00.000Z",
          access: ["messages"],
          createdAt: "2026-05-01T10:00:00.000Z"
        }
      ]));
      window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
        {
          id: "message-ari",
          kind: "marketing",
          recipientName: "Ari Nguyen",
          recipientPhone: "(262) 555-0101",
          recipientRole: "student",
          recipientId: "student-ari",
          body: "Opted-out student should not be sent.",
          status: "queued",
          createdAt: "2026-06-02T10:00:00.000Z"
        },
        {
          id: "message-bree-parent",
          kind: "marketing",
          recipientName: "Leo Santos",
          recipientPhone: "(262) 555-1102",
          recipientRole: "parent",
          recipientId: "parent-student-bree",
          body: "Opted-out guardian should not be sent.",
          status: "queued",
          createdAt: "2026-06-02T10:05:00.000Z"
        },
        {
          id: "message-kim",
          kind: "marketing",
          recipientName: "Coach Kim",
          recipientPhone: "(262) 555-2101",
          recipientRole: "staff",
          recipientId: "staff-kim",
          body: "Opted-out staff should not be sent.",
          status: "queued",
          createdAt: "2026-06-02T10:10:00.000Z"
        },
        {
          id: "message-bree",
          kind: "marketing",
          recipientName: "Bree Santos",
          recipientPhone: "(262) 555-0102",
          recipientRole: "student",
          recipientId: "student-bree",
          body: "Deliverable student should be sent. Reply STOP to opt out.",
          status: "queued",
          createdAt: "2026-06-02T10:15:00.000Z"
        }
      ]));

      renderLoggedInApp("/messages");

      expect(screen.getByText("3 SMS opt-out records active.")).toBeInTheDocument();
      expect(screen.getByText("1 text waiting to be sent.")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "everyone" } });
      fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "June family night registration is open. Reply STOP to opt out." } });
      fireEvent.click(screen.getByRole("button", { name: "Send Marketing Blast" }));

      expect(await screen.findByText("Text blast queued for 2 contacts.")).toBeInTheDocument();
      const marketingMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")
        .filter((message: { body: string }) => message.body === "June family night registration is open. Reply STOP to opt out.");
      expect(marketingMessages).toEqual(expect.arrayContaining([
        expect.objectContaining({ recipientName: "Mina Nguyen", recipientRole: "parent" }),
        expect.objectContaining({ recipientName: "Bree Santos", recipientRole: "student" })
      ]));
      expect(marketingMessages).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ recipientName: "Ari Nguyen" }),
        expect.objectContaining({ recipientName: "Leo Santos" }),
        expect.objectContaining({ recipientName: "Coach Kim" })
      ]));

      fireEvent.click(screen.getByRole("button", { name: "Export Twilio Relay JSON" }));

      expect(await screen.findByText("3 Twilio relay messages exported.")).toBeInTheDocument();
      if (!relayBlob) throw new Error("Expected Twilio relay export to create a Blob.");
      const payload = JSON.parse(await relayBlob.text());
      expect(payload.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "message-bree", to: "+12625550102" })
      ]));
      expect(payload.messages).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "message-ari" }),
        expect.objectContaining({ id: "message-bree-parent" }),
        expect.objectContaining({ id: "message-kim" }),
        expect.objectContaining({ to: "+12625550101" }),
        expect.objectContaining({ to: "+12625551102" }),
        expect.objectContaining({ to: "+12625552101" })
      ]));
      expect(clickAnchor).toHaveBeenCalledTimes(1);
      expect(createdAnchor).toHaveAttribute("download", expect.stringMatching(/^chos-twilio-relay-queue-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:twilio-optout-relay");
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
    }
  });

  it("exports SMS consent evidence for student, parent, and staff contacts without credentials", async () => {
    const clickAnchor = vi.fn();
    let consentBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      consentBlob = blob;
      return "blob:twilio-consent-evidence";
    });
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, "click", { configurable: true, value: clickAnchor });
      }
      return element;
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    try {
      window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
        {
          id: "student-ari",
          firstName: "Ari",
          lastName: "Nguyen",
          ...completeStudentSafetyFields,
          phone: "(262) 555-0101",
          email: "ari@example.com",
          guardianName: "Mina Nguyen",
          guardianPhone: "(262) 555-1101",
          status: "Active",
          beltRank: "Yellow",
          classesAttended: 12,
          missedClassCount: 0,
          joinedAt: "2026-01-01",
          smsConsentUpdatedAt: "2026-06-01T10:00:00.000Z"
        },
        {
          id: "student-bree",
          firstName: "Bree",
          lastName: "Santos",
          ...completeStudentSafetyFields,
          phone: "(262) 555-0102",
          email: "bree@example.com",
          guardianName: "Leo Santos",
          guardianPhone: "(262) 555-1102",
          status: "Active",
          beltRank: "White",
          classesAttended: 6,
          missedClassCount: 0,
          joinedAt: "2026-01-01",
          guardianSmsOptOutAt: "2026-06-02T11:00:00.000Z",
          smsConsentUpdatedAt: "2026-06-02T11:00:00.000Z"
        }
      ]));
      window.localStorage.setItem("chos.managedAccounts.v1", JSON.stringify([
        {
          id: "staff-kim",
          displayName: "Coach Kim",
          username: "coach.kim",
          password: "staff-pass",
          role: "staff",
          status: "active",
          phone: "(262) 555-2101",
          smsConsentUpdatedAt: "2026-06-03T09:00:00.000Z",
          access: ["messages"],
          createdAt: "2026-05-01T10:00:00.000Z"
        }
      ]));

      renderLoggedInApp("/messages");

      fireEvent.click(screen.getByRole("button", { name: "Export Consent Evidence" }));

      expect(await screen.findByText("5 SMS consent records exported.")).toBeInTheDocument();
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      if (!consentBlob) throw new Error("Expected consent evidence export to create a Blob.");
      const payload = JSON.parse(await consentBlob.text());
      expect(payload).toEqual(expect.objectContaining({
        schemaVersion: "chos-sms-consent-evidence.v1",
        provider: "twilio",
        requestedBy: expect.objectContaining({ email: "manager123@chos.prototype" })
      }));
      expect(payload.contacts).toEqual(expect.arrayContaining([
        expect.objectContaining({ contactId: "student-ari", role: "student", phone: "+12625550101", consentStatus: "opt-in", consentUpdatedAt: "2026-06-01T10:00:00.000Z" }),
        expect.objectContaining({ contactId: "parent-student-ari", role: "parent", phone: "+12625551101", consentStatus: "opt-in", consentUpdatedAt: "2026-06-01T10:00:00.000Z" }),
        expect.objectContaining({ contactId: "student-bree", role: "student", phone: "+12625550102", consentStatus: "opt-in", consentUpdatedAt: "2026-06-02T11:00:00.000Z" }),
        expect.objectContaining({ contactId: "parent-student-bree", role: "parent", phone: "+12625551102", consentStatus: "opt-out", consentUpdatedAt: "2026-06-02T11:00:00.000Z" }),
        expect.objectContaining({ contactId: "staff-kim", role: "staff", phone: "+12625552101", consentStatus: "opt-in", consentUpdatedAt: "2026-06-03T09:00:00.000Z" })
      ]));
      expect(JSON.stringify(payload)).not.toMatch(/staff-pass|TWILIO_AUTH_TOKEN|twilio-auth-token-value|private-key-value|account-password/i);
      expect(createdAnchor).toHaveAttribute("download", expect.stringMatching(/^chos-sms-consent-evidence-\d{4}-\d{2}-\d{2}\.json$/));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:twilio-consent-evidence");
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
      }
    }
  });

  it("imports inbound Twilio SMS replies and handles STOP opt-outs", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        guardianName: "Mina Nguyen",
        guardianPhone: "(262) 555-1101",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.directMessages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.notificationSettings.v1", JSON.stringify({ lastSeenDirectMessageAt: "2026-06-01T10:00:00.000Z" }));

    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Twilio inbound webhook JSON"), {
      target: {
        value: JSON.stringify({
          From: "+12625551101",
          Body: "Can Ari join the 6 PM class?",
          MessageSid: "SMINBOUND1111111111111111111111111111"
        })
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Twilio Inbound" }));

    expect(await screen.findByText("1 inbound SMS imported.")).toBeInTheDocument();
    expect(screen.getByText("1 unread app message")).toBeInTheDocument();
    expect(screen.getByText("Can Ari join the 6 PM class?")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        id: "twilio-SMINBOUND1111111111111111111111111111",
        threadId: "direct-staff-seed__parent-student-ari",
        senderId: "parent-student-ari",
        senderName: "Mina Nguyen",
        recipientId: "direct-staff-seed",
        recipientName: "Cho's Manager",
        body: "Can Ari join the 6 PM class?",
        status: "sent"
      })
    ]);

    fireEvent.change(screen.getByLabelText("Twilio inbound webhook JSON"), {
      target: {
        value: JSON.stringify({
          From: "+12625550101",
          Body: "STOP",
          MessageSid: "SMSTOP111111111111111111111111111111"
        })
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Twilio Inbound" }));

    expect(await screen.findByText("1 SMS opt-out update applied.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([
      expect.objectContaining({
        id: "student-ari",
        studentSmsOptOutAt: expect.any(String)
      })
    ]);
    expect(JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]")).toHaveLength(1);
  });

  it("sends only queued texts for current students and removes stale queued recipients", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        body: "Ari needs a quick check-in.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z"
      },
      {
        id: "message-cora",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Cora has stale outreach.",
        status: "queued",
        createdAt: "2026-06-02T10:05:00.000Z"
      },
      {
        id: "message-unknown",
        kind: "profile-update",
        recipientName: "Noah Woods",
        recipientPhone: "(262) 555-0104",
        body: "Noah is no longer in the student list.",
        status: "queued",
        createdAt: "2026-06-02T10:10:00.000Z"
      },
      {
        id: "message-cora-sent",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Historical Cora message.",
        status: "sent",
        createdAt: "2026-06-01T10:00:00.000Z",
        sentAt: "2026-06-01T10:05:00.000Z"
      }
    ]));

    renderLoggedInApp("/messages");

    expect(screen.getByText("1 text waiting to be sent.")).toBeInTheDocument();
    expect(screen.queryByText("3 texts waiting to be sent.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send Queued Texts" }));

    expect(await screen.findByText("1 queued text sent.")).toBeInTheDocument();
    expect(screen.getByText("0 texts waiting to be sent.")).toBeInTheDocument();
    expect(screen.getByText("Ari needs a quick check-in.")).toBeInTheDocument();
    expect(screen.queryByText("Cora has stale outreach.")).not.toBeInTheDocument();
    expect(screen.queryByText("Noah is no longer in the student list.")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "message-ari", status: "sent", sentAt: expect.any(String) }),
      expect.objectContaining({ id: "message-cora-sent", status: "sent" })
    ]);
  });

  it("keeps queued text sending idempotent when send fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 6,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        body: "Ari needs a quick check-in.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z"
      },
      {
        id: "message-bree",
        kind: "profile-update",
        recipientName: "Bree Santos",
        recipientPhone: "(262) 555-0102",
        body: "Bree needs a profile update request.",
        status: "queued",
        createdAt: "2026-06-02T10:05:00.000Z"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <QueuedTextsDoubleSendHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Send queued texts twice" }));

    expect(await screen.findByText("Harness send return counts: 2,0")).toBeInTheDocument();
    expect(screen.getByText("Harness queued statuses: sent,sent")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "message-ari", status: "sent", sentAt: expect.any(String) }),
      expect.objectContaining({ id: "message-bree", status: "sent", sentAt: expect.any(String) })
    ]);
  });

  it("lets staff send one queued text without sending the entire queue", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "bree@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 6,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        body: "Ari needs a quick missed-class follow-up.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z"
      },
      {
        id: "message-bree",
        kind: "profile-update",
        recipientName: "Bree Santos",
        recipientPhone: "(262) 555-0102",
        body: "Bree needs a profile update request.",
        status: "queued",
        createdAt: "2026-06-02T10:05:00.000Z"
      }
    ]));

    renderLoggedInApp("/messages");

    const ariMessage = screen.getByText("Ari needs a quick missed-class follow-up.").closest(".message-preview") as HTMLElement;
    const breeMessage = screen.getByText("Bree needs a profile update request.").closest(".message-preview") as HTMLElement;

    fireEvent.click(within(ariMessage).getByRole("button", { name: "Send text to Ari Nguyen" }));

    expect(await screen.findByText("Queued text to Ari Nguyen sent.")).toBeInTheDocument();
    expect(within(ariMessage).getByText("sent")).toBeInTheDocument();
    expect(within(breeMessage).getByText("queued")).toBeInTheDocument();
    expect(screen.getByText("1 text waiting to be sent.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "message-ari", status: "sent", sentAt: expect.any(String) }),
      expect.objectContaining({ id: "message-bree", status: "queued" })
    ]);
  });

  it("keeps single queued text sending idempotent when one message fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        body: "Ari needs a quick check-in.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <SingleQueuedTextDoubleSendHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Send Ari queued text twice" }));

    expect(await screen.findByText("Harness single send returns: Ari Nguyen,none")).toBeInTheDocument();
    expect(screen.getByText("Harness single statuses: sent")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "message-ari", status: "sent", sentAt: expect.any(String) })
    ]);
  });

  it("removes a stale queued recipient instead of sending it from the single-text action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-cora",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Cora has stale outreach.",
        status: "queued",
        createdAt: "2026-06-02T10:05:00.000Z"
      }
    ]));

    renderLoggedInApp("/messages");

    const coraMessage = screen.getByText("Cora has stale outreach.").closest(".message-preview") as HTMLElement;
    fireEvent.click(within(coraMessage).getByRole("button", { name: "Send text to Cora Miles" }));

    expect(await screen.findByText("That queued text is no longer waiting.")).toBeInTheDocument();
    expect(screen.getByText("0 texts waiting to be sent.")).toBeInTheDocument();
    expect(screen.queryByText("Cora has stale outreach.")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
  });

  it("does not send a queued text to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-ari",
        kind: "follow-up",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        body: "Ari needs a quick check-in.",
        status: "queued",
        createdAt: "2026-06-02T10:00:00.000Z"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <DeactivateAndSendQueuedTextHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send queued text" }));

    await waitFor(() => {
      expect(screen.getByText("Harness queued student status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness queued send return: none")).toBeInTheDocument();
      expect(screen.getByText("Harness queued message statuses: none")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "student-ari", status: "Inactive" })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    });
  });

  it("lets staff clear stale queued texts when no deliverable texts are waiting", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-cora",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Cora has stale outreach.",
        status: "queued",
        createdAt: "2026-06-02T10:05:00.000Z"
      },
      {
        id: "message-noah",
        kind: "profile-update",
        recipientName: "Noah Woods",
        recipientPhone: "(262) 555-0104",
        body: "Noah is no longer listed.",
        status: "queued",
        createdAt: "2026-06-02T10:10:00.000Z"
      },
      {
        id: "message-cora-sent",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Historical Cora message.",
        status: "sent",
        createdAt: "2026-06-01T10:00:00.000Z",
        sentAt: "2026-06-01T10:05:00.000Z"
      }
    ]));

    renderLoggedInApp("/messages");

    expect(screen.getByText("0 texts waiting to be sent.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Queued Texts" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Clear Stale Texts" }));

    expect(await screen.findByText("2 stale queued texts removed.")).toBeInTheDocument();
    expect(screen.queryByText("Cora has stale outreach.")).not.toBeInTheDocument();
    expect(screen.queryByText("Noah is no longer listed.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Stale Texts" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "message-cora-sent", status: "sent" })
    ]);
  });

  it("keeps stale queued text cleanup idempotent when clear fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0103",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([
      {
        id: "message-cora",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Cora has stale outreach.",
        status: "queued",
        createdAt: "2026-06-02T10:05:00.000Z"
      },
      {
        id: "message-noah",
        kind: "profile-update",
        recipientName: "Noah Woods",
        recipientPhone: "(262) 555-0104",
        body: "Noah is no longer listed.",
        status: "queued",
        createdAt: "2026-06-02T10:10:00.000Z"
      },
      {
        id: "message-cora-sent",
        kind: "follow-up",
        recipientName: "Cora Miles",
        recipientPhone: "(262) 555-0103",
        body: "Historical Cora message.",
        status: "sent",
        createdAt: "2026-06-01T10:00:00.000Z",
        sentAt: "2026-06-01T10:05:00.000Z"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <StaleQueuedTextsDoubleClearHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear stale queued texts twice" }));

    expect(await screen.findByText("Harness stale clear returns: 2,0")).toBeInTheDocument();
    expect(screen.getByText("Harness stale messages: 1")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "message-cora-sent", status: "sent" })
    ]);
  });

  it("keeps lead review automation idempotent when review fires twice before rerender", async () => {
    const starterDate = dateKeyOffset(1);
    window.localStorage.setItem("chos.contacts.v1", JSON.stringify([
      {
        id: "contact-ari",
        name: "Ari Nguyen",
        email: "ari@example.com",
        phone: "(262) 555-0101",
        message: "We want to try the starter program.",
        createdAt: `${dateKeyOffset(0)}T10:00:00.000Z`
      }
    ]));
    window.localStorage.setItem("chos.bookings.v1", JSON.stringify([
      { persons: 2, date: starterDate, time: "5:30 PM", timezone: "America/Chicago" }
    ]));
    window.localStorage.setItem("chos.operations.leadReviews.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <LeadReviewDoubleCallHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Review leads twice" }));

    expect(await screen.findByText("Harness lead review returns: 2,0")).toBeInTheDocument();
    expect(screen.getByText("Harness lead reviews: 2")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.leadReviews.v1") ?? "[]")).toEqual([
      expect.objectContaining({ leadId: "contact-ari", kind: "contact", label: "Ari Nguyen" }),
      expect.objectContaining({ leadId: expect.stringContaining("booking-"), kind: "booking", label: `Starter booking ${starterDate}` })
    ]);
  });

  it("reviews a contact lead saved in the same action", async () => {
    window.localStorage.setItem("chos.contacts.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.bookings.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.leadReviews.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <SaveContactAndReviewLeadsHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save contact and review leads" }));

    await waitFor(() => {
      expect(screen.getByText("Harness saved contacts: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness same-action lead return: 1")).toBeInTheDocument();
      expect(screen.getByText("Harness same-action lead reviews: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.leadReviews.v1") ?? "[]")).toEqual([
        expect.objectContaining({ leadId: "contact-ari", kind: "contact", label: "Ari Nguyen" })
      ]);
    });
  });

  it("keeps low-inventory restock idempotent when restock fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.merchandise.v1", JSON.stringify([
      {
        id: "gloves-low",
        name: "Youth Gloves",
        category: "Gloves",
        price: 39,
        stock: 1,
        reorderPoint: 3,
        targetStock: 8,
        description: "Youth gloves for class pickup.",
        imageLabel: "gloves"
      },
      {
        id: "uniform-ok",
        name: "Student Uniform",
        category: "Uniforms",
        price: 59,
        stock: 6,
        reorderPoint: 3,
        targetStock: 8,
        description: "Student uniform for class pickup.",
        imageLabel: "uniform"
      }
    ]));

    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <AppStateProvider>
          <LowInventoryRestockDoubleCallHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Restock inventory twice" }));

    expect(await screen.findByText("Harness restock returns: 1,0")).toBeInTheDocument();
    expect(screen.getByText("Harness inventory stocks: gloves-low:8,uniform-ok:6")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.merchandise.v1") ?? "[]")).toEqual([
      expect.objectContaining({ id: "gloves-low", stock: 8, lastRestockedAt: dateKeyOffset(0) }),
      expect.objectContaining({ id: "uniform-ok", stock: 6 })
    ]);
  });

  it("sends a marketing blast for discounts and monthly specials", () => {
    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "May special: 10% off gloves this month." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Marketing Blast" }));

    expect(screen.getAllByText(/May special: 10% off gloves this month/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Marketing blast/i).length).toBeGreaterThan(0);
  });

  it("queues marketing blasts only for current students with phone numbers", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0100",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 2,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Paused",
        beltRank: "Yellow",
        classesAttended: 8,
        missedClassCount: 0,
        joinedAt: "2026-04-01"
      },
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-03-01"
      },
      {
        id: "student-dane",
        firstName: "Dane",
        lastName: "Woods",
        ...completeStudentSafetyFields,
        phone: "",
        email: "dane@example.com",
        status: "Active",
        beltRank: "Green",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "June family night is open for registration." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Marketing Blast" }));

    expect(await screen.findByText("Marketing blast queued for 2 students.")).toBeInTheDocument();
    const savedMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ recipientName: string; kind: string; body: string }>;
    expect(savedMessages).toHaveLength(2);
    expect(savedMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Ari Nguyen", kind: "marketing", body: "June family night is open for registration." }),
      expect.objectContaining({ recipientName: "Bree Santos", kind: "marketing", body: "June family night is open for registration." })
    ]));
    expect(savedMessages.some((message) => message.recipientName === "Cora Miles")).toBe(false);
    expect(savedMessages.some((message) => message.recipientName === "Dane Woods")).toBe(false);
  });

  it("does not send a marketing blast to a student made inactive in the same action", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.campaigns.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <DeactivateAndSendMarketingBlastHarness studentId="student-ari" />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Deactivate and send marketing blast" }));

    await waitFor(() => {
      expect(screen.getByText("Harness marketing student status: Inactive")).toBeInTheDocument();
      expect(screen.getByText("Harness marketing return count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness marketing campaign count: 0")).toBeInTheDocument();
      expect(screen.getByText("Harness marketing message count: 0")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.students.v1") ?? "[]")).toEqual([
        expect.objectContaining({ id: "student-ari", status: "Inactive" })
      ]);
      expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
      expect(JSON.parse(window.localStorage.getItem("chos.operations.campaigns.v1") ?? "[]")).toEqual([]);
    });
  });

  it("keeps duplicate marketing blasts from creating duplicate campaigns or texts", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0100",
        email: "ari@example.com",
        status: "Active",
        beltRank: "White",
        classesAttended: 2,
        missedClassCount: 0,
        joinedAt: "2026-05-01"
      },
      {
        id: "student-bree",
        firstName: "Bree",
        lastName: "Santos",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0101",
        email: "bree@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 8,
        missedClassCount: 0,
        joinedAt: "2026-04-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.campaigns.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <AppStateProvider>
          <MarketingBlastDoubleCallHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Send marketing blast twice" }));

    expect(await screen.findByText("Harness marketing return counts: 2,0")).toBeInTheDocument();
    expect(screen.getByText("Harness campaigns: 1")).toBeInTheDocument();
    expect(screen.getByText("Harness marketing messages: 2")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.campaigns.v1") ?? "[]")).toHaveLength(1);
    const savedMessages = JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]") as Array<{ recipientName: string; kind: string; campaignId?: string }>;
    expect(savedMessages).toHaveLength(2);
    expect(savedMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientName: "Ari Nguyen", kind: "marketing", campaignId: expect.any(String) }),
      expect.objectContaining({ recipientName: "Bree Santos", kind: "marketing", campaignId: expect.any(String) })
    ]));
  });

  it("does not create empty marketing campaigns when no current students can receive texts", async () => {
    window.localStorage.setItem("chos.operations.students.v1", JSON.stringify([
      {
        id: "student-cora",
        firstName: "Cora",
        lastName: "Miles",
        ...completeStudentSafetyFields,
        phone: "(262) 555-0102",
        email: "cora@example.com",
        status: "Inactive",
        beltRank: "Orange",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-03-01"
      },
      {
        id: "student-dane",
        firstName: "Dane",
        lastName: "Woods",
        ...completeStudentSafetyFields,
        phone: "",
        email: "dane@example.com",
        status: "Active",
        beltRank: "Green",
        classesAttended: 18,
        missedClassCount: 0,
        joinedAt: "2026-02-01"
      }
    ]));
    window.localStorage.setItem("chos.operations.messages.v1", JSON.stringify([]));
    window.localStorage.setItem("chos.operations.campaigns.v1", JSON.stringify([]));
    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "June family night is open for registration." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Marketing Blast" }));

    expect(await screen.findByText("No current student phone numbers are available.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.operations.messages.v1") ?? "[]")).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("chos.operations.campaigns.v1") ?? "[]")).toEqual([]);
  });

  it("expands selected messages inside the single Home feed panel", () => {
    renderLoggedInApp("/profile");

    const attendanceRow = screen.getByRole("button", { name: /John Doe.*Attendance Confirmation/i });
    expect(attendanceRow.closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--message");

    fireEvent.click(attendanceRow);

    expect(attendanceRow).toHaveAttribute("aria-expanded", "true");
    expect(attendanceRow.closest(".manager-home-feed-item")).toHaveClass("is-selected");
    expect(screen.getByLabelText("Attendance Confirmation details")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attendance Confirmation" })).toBeInTheDocument();
    expect(screen.getAllByText("Message").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Write a reply"), { target: { value: "Thanks, confirmed." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(screen.getByText("Reply queued for the selected message.")).toBeInTheDocument();
    expect(screen.getByLabelText("Write a reply")).toHaveValue("");

    fireEvent.click(attendanceRow);

    expect(attendanceRow).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Attendance Confirmation details")).not.toBeInTheDocument();
  });

  it.skip("lets managers reply to inbound app messages from the Home feed", async () => {
    renderLoggedInApp("/profile");

    const feedPanel = screen.getByLabelText("Messages and event notifications");
    const directRow = within(feedPanel).getByRole("button", { name: /Talia Brooks.*Thank you, I will be there for training/i });
    fireEvent.click(directRow);

    expect(directRow).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "App message from Talia Brooks" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Write a reply"), { target: { value: "Thanks Talia, see you then." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(await screen.findByText("Reply sent to Talia Brooks.")).toBeInTheDocument();
    const savedDirectMessages = JSON.parse(window.localStorage.getItem("chos.operations.directMessages.v1") ?? "[]") as Array<{ senderId: string; recipientId: string; recipientName: string; body: string }>;
    expect(savedDirectMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        senderId: "direct-staff-seed",
        recipientId: "student-talia-brooks-seed",
        recipientName: "Talia Brooks",
        body: "Thanks Talia, see you then."
      })
    ]));
  });

  it("marks Home feed messages and event notifications as read when opened", () => {
    renderLoggedInApp("/profile");

    const summerEventRow = screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i });
    const summerEventItem = summerEventRow.closest(".manager-home-feed-item") as HTMLElement;

    expect(summerEventItem).toHaveClass("is-unread");
    expect(within(summerEventItem).getByText("Unread")).toBeInTheDocument();

    fireEvent.click(summerEventRow);

    expect(summerEventRow).toHaveAttribute("aria-expanded", "true");
    expect(summerEventItem).toHaveClass("is-read");
    expect(summerEventItem).not.toHaveClass("is-unread");
    expect(within(summerEventItem).getByText("Read")).toBeInTheDocument();
  });

  it("filters messages and event notifications in the single Home feed panel", () => {
    renderLoggedInApp("/profile");

    fireEvent.click(screen.getByRole("button", { name: "Open search messages and event notifications" }));
    const feedSearch = screen.getByRole("searchbox", { name: "Search messages and event notifications" });
    fireEvent.change(feedSearch, { target: { value: "parent" } });

    const parentEvent = screen.getByRole("button", { name: /Event Team.*Upcoming Event: Parent Meeting/i });
    expect(parentEvent.closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--event");
    expect(screen.queryByRole("button", { name: /John Doe.*Attendance Confirmation/i })).not.toBeInTheDocument();

    fireEvent.change(feedSearch, { target: { value: "zzzz" } });

    expect(screen.getByText("No messages or event notifications match your search.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close search messages and event notifications" }));

    expect(screen.queryByRole("searchbox", { name: "Search messages and event notifications" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /John Doe.*Attendance Confirmation/i })).toBeInTheDocument();
  });

  it("keeps merchandise creation idempotent when the same item fires twice before rerender", async () => {
    window.localStorage.setItem("chos.operations.merchandise.v1", JSON.stringify([]));

    render(
      <MemoryRouter initialEntries={["/merchandise"]}>
        <AppStateProvider>
          <MerchandiseDoubleAddHarness />
        </AppStateProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add merchandise twice" }));

    await waitFor(() => {
      expect(screen.getByText("Harness duplicate merchandise returns: same")).toBeInTheDocument();
      expect(screen.getByText("Harness duplicate merchandise items: 1")).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("chos.operations.merchandise.v1") ?? "[]")).toEqual([
        expect.objectContaining({
          name: "Red Sparring Gloves",
          category: "Gloves",
          price: 49,
          stock: 8,
          reorderPoint: 3,
          targetStock: 14,
          description: "Competition gloves for sparring days.",
          imageLabel: "gloves",
          imageDataUrl: "data:image/png;base64,gloves"
        })
      ]);
    });
  });

  it("lets staff add, edit, upload an image, and delete merchandise", async () => {
    renderLoggedInApp("/merchandise");

    expect(screen.queryByRole("dialog", { name: "Add New Merchandise" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add New Merchandise" }));
    const addDialog = screen.getByRole("dialog", { name: "Add New Merchandise" });

    fireEvent.change(within(addDialog).getByLabelText("Product name"), { target: { value: "Red Sparring Gloves" } });
    fireEvent.change(within(addDialog).getByLabelText("Category"), { target: { value: "Gloves" } });
    fireEvent.change(within(addDialog).getByLabelText("Price"), { target: { value: "49" } });
    fireEvent.change(within(addDialog).getByLabelText("Stock"), { target: { value: "8" } });
    fireEvent.change(within(addDialog).getByLabelText("Reorder point"), { target: { value: "3" } });
    fireEvent.change(within(addDialog).getByLabelText("Target stock"), { target: { value: "14" } });
    fireEvent.change(within(addDialog).getByLabelText("Description"), { target: { value: "Competition gloves for sparring days." } });
    fireEvent.change(within(addDialog).getByLabelText("Product image"), {
      target: { files: [new File(["glove-image"], "gloves.png", { type: "image/png" })] }
    });
    await waitFor(() => expect(within(addDialog).getByAltText("Uploaded merchandise preview")).toHaveAttribute("src", expect.stringContaining("data:image/png")));
    fireEvent.click(within(addDialog).getByRole("button", { name: "Create Merchandise" }));

    expect(screen.getByText("Red Sparring Gloves")).toBeInTheDocument();
    expect(screen.getByText("$49.00")).toBeInTheDocument();
    expect(screen.getByText("8 in stock")).toBeInTheDocument();
    expect(screen.getByAltText("Red Sparring Gloves")).toHaveAttribute("src", expect.stringContaining("data:image/png"));

    fireEvent.click(screen.getByRole("button", { name: "Edit Red Sparring Gloves" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit Red Sparring Gloves" });
    expect(within(editDialog).getByLabelText("Reorder point")).toHaveValue(3);
    expect(within(editDialog).getByLabelText("Target stock")).toHaveValue(14);
    fireEvent.change(within(editDialog).getByLabelText("Stock"), { target: { value: "12" } });
    fireEvent.change(within(editDialog).getByLabelText("Target stock"), { target: { value: "16" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save Merchandise Changes" }));

    expect(screen.getByText("12 in stock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Red Sparring Gloves" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Merchandise" }));

    expect(screen.queryByText("Red Sparring Gloves")).not.toBeInTheDocument();
  });
});
