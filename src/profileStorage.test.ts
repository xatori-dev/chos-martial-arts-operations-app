import { beforeEach, describe, expect, it } from "vitest";
import {
  fallbackManagerProfile,
  fallbackStaffProfile,
  fallbackStudentProfile,
  legacyProfileStorageKey,
  profileStorageKey,
  readManagerProfile,
  readStaffProfile,
  readStudentProfile,
  writeManagerProfile,
  writeStaffProfile,
  writeStudentProfile
} from "./profileStorage";
import type { ChildAccount, StudentRecord } from "./types";

describe("profile storage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("keeps scoped profile keys stable across account types", () => {
    expect(profileStorageKey("manager", "Manager123@Chos.Prototype")).toBe("chos.profile.manager.manager123-chos.prototype.v1");
    expect(profileStorageKey("staff", "Taylor.Staff@Chos.Prototype")).toBe("chos.profile.staff.taylor.staff-chos.prototype.v1");
    expect(profileStorageKey("student", "Kai Cho.Child")).toBe("chos.profile.student.kai-cho.child.v1");
  });

  it("preserves manager legacy profile fallback while writing both keys", () => {
    window.localStorage.setItem(legacyProfileStorageKey, JSON.stringify({ ...fallbackManagerProfile("manager123@chos.prototype"), name: "Legacy Manager" }));

    expect(readManagerProfile("manager123@chos.prototype").name).toBe("Legacy Manager");

    writeManagerProfile({ ...fallbackManagerProfile("manager123@chos.prototype"), name: "Scoped Manager" }, "manager123@chos.prototype");

    expect(JSON.parse(window.localStorage.getItem(profileStorageKey("manager", "manager123@chos.prototype")) ?? "{}")).toMatchObject({ name: "Scoped Manager" });
    expect(JSON.parse(window.localStorage.getItem(legacyProfileStorageKey) ?? "{}")).toMatchObject({ name: "Scoped Manager" });
  });

  it("keeps staff profiles scoped while falling back from existing manager-scoped staff profiles", () => {
    window.localStorage.setItem(
      profileStorageKey("manager", "taylor.staff"),
      JSON.stringify({ ...fallbackStaffProfile("taylor.staff"), name: "Existing Staff Profile", email: "taylor.staff" })
    );

    expect(readStaffProfile("taylor.staff").name).toBe("Existing Staff Profile");

    writeStaffProfile({ ...fallbackStaffProfile("taylor.staff"), name: "Taylor Staff Saved" }, "taylor.staff");

    expect(JSON.parse(window.localStorage.getItem(profileStorageKey("staff", "taylor.staff")) ?? "{}")).toMatchObject({ name: "Taylor Staff Saved" });
    expect(JSON.parse(window.localStorage.getItem(profileStorageKey("manager", "taylor.staff")) ?? "{}")).toMatchObject({ name: "Existing Staff Profile" });
  });

  it("keeps student legacy fallback scoped to the active session", () => {
    const student: StudentRecord = {
      id: "student-kai",
      firstName: "Kai",
      lastName: "Cho",
      dateOfBirth: "2018-05-10",
      gender: "Male",
      phone: "(262) 555-0199",
      email: "kai@chos.prototype",
      guardianName: "Mina Cho",
      guardianPhone: "(262) 555-0101",
      guardianEmail: "mina@chos.prototype",
      emergencyContactName: "Mina Cho",
      emergencyContactPhone: "(262) 555-0101",
      beltRank: "Yellow",
      program: "Youth Taekwondo",
      enrollmentDate: "2026-01-10",
      status: "Active",
      notes: "",
      classesAttended: 12,
      missedClassCount: 1,
      joinedAt: "2026-01-10"
    };
    const child: ChildAccount = {
      id: "child-kai",
      parentEmail: "parent123@chos.prototype",
      name: "Kai Cho",
      username: "kai-cho.child",
      password: "Dragon123",
      age: "8",
      beltSlug: "yellow",
      createdAt: "2026-05-28T00:00:00.000Z"
    };

    window.localStorage.setItem(legacyProfileStorageKey, JSON.stringify({ ...fallbackStudentProfile("other.child", student, child), name: "Other Student", email: "other.child" }));
    expect(readStudentProfile("kai-cho.child", student, child).name).toBe("Kai Cho");

    writeStudentProfile({ ...fallbackStudentProfile("kai-cho.child", student, child), name: "Kai Saved" }, "kai-cho.child");
    expect(JSON.parse(window.localStorage.getItem(profileStorageKey("student", "kai-cho.child")) ?? "{}")).toMatchObject({ name: "Kai Saved" });
    expect(window.localStorage.getItem(legacyProfileStorageKey)).toContain("Other Student");
  });
});
