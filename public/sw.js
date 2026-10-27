// Only the application shell is intercepted. Authentication, data, and downloads
// keep their existing network/storage behavior. No private data is cached here.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== "GET" || event.request.mode !== "navigate" ||
      url.origin !== scope.origin || ![scope.pathname, `${scope.pathname}index.html`].includes(url.pathname)) return;
  event.respondWith((async () => {
    try {
      const fresh = new URL("index.html", scope);
      fresh.searchParams.set("__app_shell", Date.now().toString());
      const response = await fetch(fresh, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (response.ok && response.headers.get("content-type")?.includes("text/html")) return response;
    } catch { /* An unavailable update must not break the existing application. */ }
    return fetch(event.request);
  })());
});
