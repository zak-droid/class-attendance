import { useEffect, useRef } from "react";
import { hasPendingNetworkWrites } from "./pending-writes";

type Release = { version: string; assets: string[] };

/** Updates only at an idle, saved home screen; never clears user storage. */
export function useAppUpdates(canReload: () => boolean) {
  const safe = useRef(canReload);
  safe.current = canReload;
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const base = new URL("./", location.href);
    let stopped = false;
    let checking = false;
    let applying = false;
    let pending: Release | null = null;
    let lastActivity = performance.now();
    let lastAttempt = -Infinity;
    const registration = "serviceWorker" in navigator
      ? navigator.serviceWorker.register(new URL("sw.js", base), { scope: base.pathname, updateViaCache: "none" }).catch(() => null)
      : Promise.resolve(null);

    const idle = () => !stopped && navigator.onLine && document.visibilityState === "visible" &&
      performance.now() - lastActivity >= 2000 && !hasPendingNetworkWrites() && safe.current() &&
      !document.activeElement?.matches("input, textarea, select, [contenteditable='true']");
    const freshURL = (name: string) => {
      const url = new URL(name, base);
      url.searchParams.set("__release_check", Date.now().toString());
      return url;
    };
    const fetchFresh = (url: URL) => fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const htmlVersion = (html: string) => new DOMParser().parseFromString(html, "text/html").querySelector('meta[name="app-version"]')?.getAttribute("content");

    const apply = async () => {
      if (!pending || applying || !idle() || performance.now() - lastAttempt < 30000) return;
      // A failed/stale CDN response must never cause an endless reload loop.
      try {
        const previous = JSON.parse(sessionStorage.getItem("app-update-attempt") || "null");
        if (previous?.version === pending.version && Date.now() - previous.time < 60000) return;
      } catch { /* Storage can be disabled. */ }
      applying = true;
      lastAttempt = performance.now();
      const release = pending;
      try {
        const shell = await fetchFresh(freshURL("index.html"));
        if (!shell.ok || htmlVersion(await shell.text()) !== release.version) return;
        // Wait until the complete entry point is published, not just its manifest.
        const available = await Promise.all(release.assets.map(async asset => {
          const response = await fetch(new URL(asset, base), { cache: "reload", signal: AbortSignal.timeout(8000) });
          return response.ok && !response.headers.get("content-type")?.includes("text/html");
        }));
        if (available.some(ok => !ok)) return;
        await registration;
        if (!navigator.serviceWorker?.controller) {
          // Browsers that block workers still get a revalidated ordinary URL.
          const normal = new URL(location.href);
          normal.hash = "";
          const response = await fetch(normal, { cache: "reload", signal: AbortSignal.timeout(8000) });
          if (!response.ok || htmlVersion(await response.text()) !== release.version) return;
        }
        // The teacher may have begun editing while the network requests ran.
        if (!idle()) return;
        try { sessionStorage.setItem("app-update-attempt", JSON.stringify({ version: release.version, time: Date.now() })); } catch { /* Optional loop guard. */ }
        location.reload();
      } catch { /* Retry later; the current version remains usable. */ }
      finally { applying = false; }
    };
    const check = async () => {
      if (stopped || checking || !navigator.onLine || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetchFresh(freshURL("version.json"));
        if (!response.ok) return;
        const release: unknown = await response.json();
        if (!release || typeof release !== "object" || !("version" in release) || !("assets" in release) ||
            typeof release.version !== "string" || !Array.isArray(release.assets) || !release.assets.length ||
            !release.assets.every(asset => typeof asset === "string" && /^assets\/[\w.-]+\.(js|css)$/.test(asset))) return;
        pending = release.version === __APP_VERSION__ ? null : release as Release;
        void apply();
      } catch { /* Offline, publication in progress, or unavailable CDN. */ }
      finally { checking = false; }
    };
    const activity = () => { lastActivity = performance.now(); };
    window.addEventListener("pointerdown", activity, true);
    window.addEventListener("keydown", activity, true);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    const poll = setInterval(check, 60000);
    const settle = setInterval(apply, 2000);
    void check();
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(settle);
      window.removeEventListener("pointerdown", activity, true);
      window.removeEventListener("keydown", activity, true);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
}
