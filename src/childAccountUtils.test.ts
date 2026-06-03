import { describe, expect, it } from "vitest";
import { childUsernameFromName, normalizeChildUsername } from "./childAccountUtils";

describe("child account username helpers", () => {
  it("derives stable child usernames from names", () => {
    expect(childUsernameFromName("Kai Cho")).toBe("kai-cho.child");
    expect(childUsernameFromName("  Mina   Lee  ")).toBe("mina-lee.child");
    expect(childUsernameFromName("!!!")).toBe("student.child");
  });

  it("normalizes typed child usernames without changing the saved username contract", () => {
    expect(normalizeChildUsername(" Kai Cho.Child ")).toBe("kai-cho.child");
    expect(normalizeChildUsername("Avery_Student!!")).toBe("avery_student");
    expect(normalizeChildUsername("...")).toBe("...");
  });
});
