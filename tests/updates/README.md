# Automatic release updates

`npm run test:updates` builds two production-mode versions with the isolated
Supabase adapter and serves them over real HTTP, under `/class-attendance/`.
It exercises Chromium desktop and Pixel 7 emulation. HTTP cache and service
workers are enabled; request routing is deliberately not mocked.

Coverage:

- Open tab switches releases automatically, retaining the normal URL and storage.
- Timer discovers a release without clicking, focusing, or refreshing.
- Cached ordinary entrance loads fresh HTML using the service worker.
- Active attendance and unsaved notes defer the update; finishing preserves
  corrections, notes, and earlier attendance.
- Offline queued changes synchronize before the update.
- Missing manifest, mismatched HTML, and unavailable assets keep the old app
  working; retry succeeds when publication completes.
- Browsers blocking service workers use revalidation of the ordinary URL.

The update hook checks on startup, focus, visibility, online, and every minute.
It applies only on the idle authenticated Today home screen, with no open
meeting/editor, biometric request, pending attendance write, or offline queue.
It checks HTML version and entry assets before reloading, and rechecks the safe
state after network operations. Private data/auth storage is never cleared.
The worker only intercepts app-shell navigation and does not cache database
requests. Deployment retains old hashed chunks for teachers still finishing
their work. Query parameters used internally for network freshness do not alter
the address bar or the shared application URL.

The feature cannot retrofit already-running JavaScript from before this release.
Those tabs acquire it on their next ordinary visit after the host publishes it.
An offline/suspended browser cannot fetch a new release until it is online and
active again. Desktop/mobile emulation does not substitute for every physical
phone/browser; the data adapter here is isolated, not the production database.
