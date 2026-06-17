import { describe, expect, it, vi } from "vitest";
import { registerChoServiceWorker } from "./serviceWorkerRegistration";

describe("service worker registration", () => {
  it("registers the Cho service worker with update checks that bypass stale script cache", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update });
    const serviceWorker = {
      controller: undefined,
      addEventListener: vi.fn(),
      register
    } as unknown as ServiceWorkerContainer;

    const registration = await registerChoServiceWorker({
      baseUrl: "/chos-martial-arts-operations-app/",
      serviceWorker
    });

    expect(registration).toBeDefined();
    expect(register).toHaveBeenCalledWith("/chos-martial-arts-operations-app/cho-service-worker.js", {
      scope: "/chos-martial-arts-operations-app/",
      updateViaCache: "none"
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("reloads an already-controlled installed app once when a new worker takes control", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const reload = vi.fn();
    const serviceWorker = {
      controller: {},
      addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => listeners.set(type, listener)),
      register: vi.fn().mockResolvedValue({ update })
    } as unknown as ServiceWorkerContainer;

    await registerChoServiceWorker({
      baseUrl: "/",
      serviceWorker,
      reload
    });

    const listener = listeners.get("controllerchange");
    if (typeof listener !== "function") throw new Error("Expected controllerchange listener.");
    listener(new Event("controllerchange"));
    listener(new Event("controllerchange"));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
