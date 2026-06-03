import { readStoredAppTheme, type AppThemeMode } from "./theme";
import type { ChildAccount, StudentRecord } from "./types";

export type ProfileSettings = {
  name: string;
  username: string;
  email: string;
  phone: string;
  updates: boolean;
  theme: AppThemeMode;
  photoDataUrl?: string;
  passwordUpdatedAt?: string;
};

export const legacyProfileStorageKey = "chos.profile.v1";

export function profileStorageKey(scope: "manager" | "staff" | "student", sessionEmail?: string) {
  const keyEmail = (sessionEmail ?? `${scope}@chos.prototype`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.profile.${scope}.${keyEmail || "account"}.v1`;
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
  const username = email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "") || "chos-manager";
  return {
    name: "Cho's Manager",
    username,
    email,
    phone: "(262) 555-0100",
    updates: true,
    theme: readStoredAppTheme()
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
    theme: readStoredAppTheme()
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
    theme: readStoredAppTheme()
  };
}

export function readManagerProfile(sessionEmail?: string): ProfileSettings {
  const fallback = fallbackManagerProfile(sessionEmail);
  return readProfileStorage(profileStorageKey("manager", sessionEmail), fallback) ?? readProfileStorage(legacyProfileStorageKey, fallback) ?? fallback;
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
