import { describe, expect, it, vi } from "vitest";
import { checkForInstalledAppUpdate } from "./appUpdate";

function memoryStorage(initialVersion?: string) {
  const values = new Map<string, string>();
  if (initialVersion) values.set("chos.app.version.v1", initialVersion);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value))
  };
}

describe("installed app update checks", () => {
  it("stores the first deployed version without forcing a reload", async () => {
    const storage = memoryStorage();
    const reload = vi.fn();

    await expect(checkForInstalledAppUpdate({
      baseUrl: "/chos-martial-arts-operations-app/",
      fetchVersion: vi.fn().mockResolvedValue({ version: "abc123" }),
      storage,
      reload
    })).resolves.toBe(false);

    expect(storage.setItem).toHaveBeenCalledWith("chos.app.version.v1", "abc123");
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when the deployed version changes", async () => {
    const storage = memoryStorage("abc123");
    const reload = vi.fn();

    await expect(checkForInstalledAppUpdate({
      fetchVersion: vi.fn().mockResolvedValue({ version: "def456" }),
      storage,
      reload
    })).resolves.toBe(true);

    expect(storage.setItem).toHaveBeenCalledWith("chos.app.version.v1", "def456");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
