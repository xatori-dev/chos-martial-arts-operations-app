export type AppVersionInfo = {
  version?: string;
};

type AppUpdateCheckOptions = {
  baseUrl?: string;
  fetchVersion?: (url: string) => Promise<AppVersionInfo | undefined>;
  storage?: Pick<Storage, "getItem" | "setItem">;
  reload?: () => void;
};

type StartAppUpdateChecksOptions = AppUpdateCheckOptions & {
  intervalMs?: number;
  windowRef?: Window;
};

const appVersionStorageKey = "chos.app.version.v1";

export async function fetchDeployedAppVersion(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as AppVersionInfo;
    return payload.version ? payload : undefined;
  } catch {
    return undefined;
  }
}

export async function checkForInstalledAppUpdate({
  baseUrl = import.meta.env.BASE_URL,
  fetchVersion = fetchDeployedAppVersion,
  storage = typeof window === "undefined" ? undefined : window.localStorage,
  reload = () => window.location.reload()
}: AppUpdateCheckOptions = {}) {
  if (!storage) return false;

  const versionInfo = await fetchVersion(`${baseUrl}app-version.json`);
  const deployedVersion = versionInfo?.version?.trim();
  if (!deployedVersion) return false;

  const currentVersion = storage.getItem(appVersionStorageKey);
  storage.setItem(appVersionStorageKey, deployedVersion);

  if (currentVersion && currentVersion !== deployedVersion) {
    reload();
    return true;
  }

  return false;
}

export function startInstalledAppUpdateChecks({
  intervalMs = 5 * 60 * 1000,
  windowRef = typeof window === "undefined" ? undefined : window,
  ...options
}: StartAppUpdateChecksOptions = {}) {
  if (!windowRef) return () => undefined;

  void checkForInstalledAppUpdate(options);
  const intervalId = windowRef.setInterval(() => {
    void checkForInstalledAppUpdate(options);
  }, intervalMs);
  const visibilityHandler = () => {
    if (windowRef.document.visibilityState === "visible") {
      void checkForInstalledAppUpdate(options);
    }
  };
  windowRef.document.addEventListener("visibilitychange", visibilityHandler);

  return () => {
    windowRef.clearInterval(intervalId);
    windowRef.document.removeEventListener("visibilitychange", visibilityHandler);
  };
}
