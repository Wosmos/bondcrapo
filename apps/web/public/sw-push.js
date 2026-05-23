/*
 * Web Push handlers for BondCheck wallet win notifications.
 *
 * Works on its own (registered at scope "/" when the site has no other service worker) and as a
 * module of the site's main service worker via `importScripts("/sw-push.js")`.
 * Payload: { title, body, url, tag } as built by the wallet-notify job. Only same-origin paths
 * are ever opened.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "BondCheck";
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" ? data.tag : "bondcheck-wins",
      renotify: true,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === target.origin && "focus" in w) {
          w.navigate(target.href);
          return w.focus();
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

// Standalone only: take control at once so the first subscription works without a reload. The
// shell's service worker sets BONDCHECK_SHELL_SW before importScripts and keeps its own lifecycle.
if (!self.BONDCHECK_SHELL_SW) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
}
