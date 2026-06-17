const fallbackMessagePath = "messages";
const logoAssetPath = "682e95109aa21_chos-logo.png";
const appShellCacheName = "chos-operations-shell-v2";
const appShellPaths = ["", "manifest.webmanifest", logoAssetPath, "icons/icon-192.png", "icons/icon-512.png"];

function scopedUrl(path) {
  const scope = self.registration?.scope || self.location?.origin || "/";
  return new URL(path, scope).toString();
}

function safeScopedUrl(value, fallbackPath) {
  const fallbackUrl = scopedUrl(fallbackPath);
  try {
    const scope = self.registration?.scope || fallbackUrl;
    const candidate = new URL(value || fallbackPath, scope).toString();
    return candidate.startsWith(scope) ? candidate : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

function safeNotificationUrl(value) {
  return safeScopedUrl(value, fallbackMessagePath);
}

function offlineFallbackResponse() {
  return new Response("Cho's Martial Arts is offline.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(appShellCacheName)
      .then((cache) => cache.addAll(appShellPaths.map((path) => scopedUrl(path))))
      .then(() => self.skipWaiting())
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(cacheNames.filter((cacheName) => cacheName !== appShellCacheName).map((cacheName) => caches.delete(cacheName))))
      .then(() => self.clients.claim())
      .catch(() => undefined)
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const scope = self.registration?.scope || self.location?.origin || "/";
  const requestUrl = new URL(event.request.url);
  if (!requestUrl.toString().startsWith(scope)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          event.waitUntil(caches.open(appShellCacheName).then((cache) => cache.put(scopedUrl(""), responseClone)).catch(() => undefined));
          return response;
        })
        .catch(() => caches.match(scopedUrl("")).then((cachedResponse) => cachedResponse || offlineFallbackResponse()))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        if (response.ok && requestUrl.origin === self.location.origin) {
          const responseClone = response.clone();
          event.waitUntil(caches.open(appShellCacheName).then((cache) => cache.put(event.request, responseClone)).catch(() => undefined));
        }
        return response;
      }).catch(() => Response.error());
    })
  );
});

function unreadCountFromPayload(payload) {
  const value = payload.unreadCount ?? payload.badgeCount;
  if (value === undefined || value === null || value === "") return undefined;
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return undefined;
  return Math.floor(count);
}

async function syncAppBadgeFromPayload(payload) {
  const count = unreadCountFromPayload(payload);
  if (count === undefined) return;
  const badgeNavigator = self.navigator;
  try {
    if (count > 0 && typeof badgeNavigator?.setAppBadge === "function") {
      await badgeNavigator.setAppBadge(count);
      return;
    }
    if (count === 0 && typeof badgeNavigator?.clearAppBadge === "function") {
      await badgeNavigator.clearAppBadge();
    }
  } catch {
    // App badging is optional; unsupported installed-app contexts should still show notifications.
  }
}

self.addEventListener("push", (event) => {
  const fallbackNotification = {
    title: "New Cho's message",
    body: "Open Cho's Martial Arts to view the latest message.",
    url: safeNotificationUrl(fallbackMessagePath),
    tag: "chos-message"
  };
  let payload = fallbackNotification;
  if (event.data) {
    try {
      payload = { ...fallbackNotification, ...event.data.json() };
    } catch {
      try {
        payload = { ...fallbackNotification, body: event.data.text() };
      } catch {
        payload = fallbackNotification;
      }
    }
  }
  const targetUrl = safeNotificationUrl(payload.url);
  event.waitUntil(
    Promise.all([
      syncAppBadgeFromPayload(payload),
      self.registration.showNotification(payload.title || fallbackNotification.title, {
        body: payload.body || fallbackNotification.body,
        icon: payload.icon ? safeScopedUrl(payload.icon, logoAssetPath) : scopedUrl(logoAssetPath),
        badge: payload.badge ? safeScopedUrl(payload.badge, logoAssetPath) : scopedUrl(logoAssetPath),
        tag: payload.tag || fallbackNotification.tag,
        data: {
          url: targetUrl,
          threadId: payload.threadId
        }
      })
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windowClients) {
        if ("navigate" in client) {
          await client.navigate(targetUrl);
        }
        return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })()
  );
});
