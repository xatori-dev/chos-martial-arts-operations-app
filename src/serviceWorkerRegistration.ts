type RegisterChoServiceWorkerOptions = {
  baseUrl?: string;
  serviceWorker?: ServiceWorkerContainer;
  reload?: () => void;
};

export async function registerChoServiceWorker({
  baseUrl = import.meta.env.BASE_URL,
  serviceWorker = typeof navigator === "undefined" ? undefined : navigator.serviceWorker,
  reload = () => window.location.reload()
}: RegisterChoServiceWorkerOptions = {}) {
  if (!serviceWorker) return undefined;

  let reloadedForControllerChange = false;
  const pageAlreadyControlled = Boolean(serviceWorker.controller);

  if (pageAlreadyControlled) {
    serviceWorker.addEventListener("controllerchange", () => {
      if (reloadedForControllerChange) return;
      reloadedForControllerChange = true;
      reload();
    });
  }

  try {
    const registration = await serviceWorker.register(`${baseUrl}cho-service-worker.js`, {
      scope: baseUrl,
      updateViaCache: "none"
    });
    await registration.update();
    return registration;
  } catch {
    return undefined;
  }
}
