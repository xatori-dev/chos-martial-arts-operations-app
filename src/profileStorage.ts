import { readStoredAppTheme, type AppThemeMode } from "./theme";
import type { ChildAccount, StudentRecord } from "./types";
import { isPrototypeDeveloperEmail, prototypeDeveloperLogin } from "./utils";

export const landingPagePreferences = [
  "profile",
  "live-chat",
  "manager-panel",
  "dashboard",
  "messages",
  "students",
  "classes",
  "schedule",
  "check-ins",
  "events",
  "merchandise",
  "reports",
  "videos",
  "study-guide",
  "student-panel",
  "parent-dashboard",
  "parent-classes",
  "parent-study",
  "parent-test",
  "parent-messages",
  "parent-notifications"
] as const;

export type LandingPagePreference = typeof landingPagePreferences[number];

export type ProfileSettings = {
  name: string;
  username: string;
  email: string;
  phone: string;
  updates: boolean;
  theme: AppThemeMode;
  landingPage: LandingPagePreference;
  photoDataUrl?: string;
  passwordUpdatedAt?: string;
};

export const legacyProfileStorageKey = "chos.profile.v1";

export type ProfileStorageScope = "manager" | "staff" | "student" | "guardian";

export function profileStorageKey(scope: ProfileStorageScope, sessionEmail?: string) {
  const keyEmail = (sessionEmail ?? `${scope}@chos.prototype`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.profile.${scope}.${keyEmail || "account"}.v1`;
}

function normalizeLandingPage(value: unknown, fallback: LandingPagePreference) {
  return typeof value === "string" && landingPagePreferences.includes(value as LandingPagePreference)
    ? value as LandingPagePreference
    : fallback;
}

export function normalizeStoredProfile(saved: string | null, fallback: ProfileSettings) {
  if (!saved) return undefined;
  const parsed = JSON.parse(saved) as Partial<ProfileSettings>;
  const photoDataUrl = typeof parsed.photoDataUrl === "string" && parsed.photoDataUrl.startsWith("data:image/") ? parsed.photoDataUrl : undefined;
  return {
    name: parsed.name?.trim() || fallback.name,
    username: parsed.username?.trim() || fallback.username,
    email: parsed.email?.trim() || fallback.email,
    phone: parsed.phone?.trim() || fallback.phone,
    updates: parsed.updates ?? fallback.updates,
    theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : fallback.theme,
    landingPage: normalizeLandingPage(parsed.landingPage, fallback.landingPage),
    photoDataUrl,
    passwordUpdatedAt: parsed.passwordUpdatedAt
  };
}

export function readProfileStorage(key: string, fallback: ProfileSettings) {
  if (typeof window === "undefined") return undefined;
  try {
    return normalizeStoredProfile(window.localStorage.getItem(key), fallback);
  } catch {
    return undefined;
  }
}

export function storedProfileBelongsToSession(profile: ProfileSettings | undefined, sessionEmail?: string) {
  return Boolean(profile && sessionEmail && profile.email.trim().toLowerCase() === sessionEmail.trim().toLowerCase());
}

export function writeProfileStorage(key: string, profile: ProfileSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(profile));
  } catch {
    // Profile changes still update local React state when storage is blocked.
  }
}

export function fallbackManagerProfile(sessionEmail?: string): ProfileSettings {
  const email = sessionEmail ?? "team@chos.prototype";
  if (isPrototypeDeveloperEmail(email)) {
    return {
      name: "Developer",
      username: prototypeDeveloperLogin.username,
      email,
      phone: "(262) 555-0100",
      updates: true,
      theme: readStoredAppTheme(),
      landingPage: "live-chat"
    };
  }

  const username = email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "") || "chos-manager";
  return {
    name: "Cho's Manager",
    username,
    email,
    phone: "(262) 555-0100",
    updates: true,
    theme: readStoredAppTheme(),
    landingPage: "live-chat"
  };
}

export function fallbackStaffProfile(sessionEmail?: string): ProfileSettings {
  const email = sessionEmail ?? "staff@chos.prototype";
  const username = email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "") || "chos-staff";
  return {
    name: "Cho's Staff",
    username,
    email,
    phone: "(262) 555-0100",
    updates: true,
    theme: readStoredAppTheme(),
    landingPage: "live-chat"
  };
}

function studentFullName(student: Pick<StudentRecord, "firstName" | "lastName">) {
  return `${student.firstName} ${student.lastName}`.trim();
}

export function fallbackStudentProfile(sessionEmail?: string, student?: StudentRecord, child?: ChildAccount): ProfileSettings {
  const email = sessionEmail ?? student?.email ?? child?.username ?? "student@chos.prototype";
  const studentName = student ? studentFullName(student) : child?.name.trim() ?? "";
  const fallbackName = studentName || "Cho's Student";
  const usernameSource = fallbackName === "Cho's Student" ? email.split("@")[0] : fallbackName;
  const username = usernameSource.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "chos-student";

  return {
    name: fallbackName,
    username,
    email,
    phone: student?.phone ?? "(262) 555-0100",
    updates: true,
    theme: readStoredAppTheme(),
    landingPage: "profile"
  };
}

export function fallbackGuardianProfile(sessionEmail?: string): ProfileSettings {
  const email = sessionEmail ?? "parent@chos.prototype";
  const username = email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "") || "chos-parent";
  return {
    name: "Family Profile",
    username,
    email,
    phone: "(262) 555-0100",
    updates: true,
    theme: readStoredAppTheme(),
    landingPage: "profile"
  };
}

export function readManagerProfile(sessionEmail?: string): ProfileSettings {
  const fallback = fallbackManagerProfile(sessionEmail);
  const scopedProfile = readProfileStorage(profileStorageKey("manager", sessionEmail), fallback);
  if (scopedProfile) return scopedProfile;
  if (isPrototypeDeveloperEmail(sessionEmail)) return fallback;
  return readProfileStorage(legacyProfileStorageKey, fallback) ?? fallback;
}

export function writeManagerProfile(profile: ProfileSettings, sessionEmail?: string) {
  writeProfileStorage(profileStorageKey("manager", sessionEmail ?? profile.email), profile);
  writeProfileStorage(legacyProfileStorageKey, profile);
}

export function readStaffProfile(sessionEmail?: string): ProfileSettings {
  const fallback = fallbackStaffProfile(sessionEmail);
  const scopedProfile = readProfileStorage(profileStorageKey("staff", sessionEmail), fallback);
  if (scopedProfile) return scopedProfile;
  return readProfileStorage(profileStorageKey("manager", sessionEmail), fallback) ?? fallback;
}

export function writeStaffProfile(profile: ProfileSettings, sessionEmail?: string) {
  writeProfileStorage(profileStorageKey("staff", sessionEmail ?? profile.email), profile);
}

export function readStudentProfile(sessionEmail?: string, student?: StudentRecord, child?: ChildAccount): ProfileSettings {
  const fallback = fallbackStudentProfile(sessionEmail, student, child);
  const scopedProfile = readProfileStorage(profileStorageKey("student", sessionEmail), fallback);
  if (scopedProfile) return scopedProfile;
  const legacyProfile = readProfileStorage(legacyProfileStorageKey, fallback);
  return legacyProfile && storedProfileBelongsToSession(legacyProfile, sessionEmail) ? legacyProfile : fallback;
}

export function writeStudentProfile(profile: ProfileSettings, sessionEmail?: string) {
  writeProfileStorage(profileStorageKey("student", sessionEmail ?? profile.email), profile);
}

export function readGuardianProfile(sessionEmail?: string): ProfileSettings {
  const fallback = fallbackGuardianProfile(sessionEmail);
  return readProfileStorage(profileStorageKey("guardian", sessionEmail), fallback) ?? fallback;
}

export function writeGuardianProfile(profile: ProfileSettings, sessionEmail?: string) {
  writeProfileStorage(profileStorageKey("guardian", sessionEmail ?? profile.email), profile);
}
