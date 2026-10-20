import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { prepareStudentImport } from "../app/student-import.ts";
import {
  BIOMETRIC_STORAGE_KEY,
  BIOMETRIC_UNLOCKED_SESSION_KEY,
  base64UrlToUint8Array,
  clearBiometricRecord,
  dismissBiometricPromptForSession,
  getBiometricRecord,
  hasBiometricEnabled,
  isBiometricAvailable,
  isBiometricPromptDismissed,
  isBiometricSessionUnlocked,
  lockBiometricSession,
  markBiometricSessionUnlocked,
  registerBiometric,
  uint8ArrayToBase64Url,
  verifyBiometric,
} from "../app/biometric.ts";
import {
  CACHE_STORAGE_KEY,
  PENDING_QUEUE_KEY,
  applyPendingActionsToData,
  clearPendingQueue,
  getCachedAppData,
  getPendingQueue,
  isOnline,
  queuePendingAction,
  removePendingAction,
  saveCachedAppData,
} from "../app/offline-storage.ts";
import {
  calculateStudentAttendanceStats,
  formatWhatsAppSummary,
  generateCourseAttendanceCSV,
} from "../app/export-utils.ts";

function read(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

test("production build contains the phone-accessible app", () => {
  const html = read("dist/index.html");
  const globalCss = read("app/globals.css");

  assert.match(html, /<html lang="he" dir="rtl">/i);
  assert.match(html, /<title>\s*(נוכחות כיתתית|ניהול נוכחות)\s*<\/title>/i);
  assert.match(html, /<meta name="theme-color" content="#002b45"/i);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Heebo:wght@400;500;600;700;800&display=swap/i);
  assert.match(globalCss, /font-family:\s*Heebo,\s*"Noto Sans Hebrew",\s*"Segoe UI",\s*Arial,\s*sans-serif/);
  assert.match(globalCss, /--background:\s*#002b45/);
  assert.match(globalCss, /rgba\(0,\s*18,\s*27,\s*0\.16\)/);
  assert.match(html, /assets\/index-/);
});

test("teacher-first auth-gated flow, synced Today production copy, and schema structure", () => {
  const page = read("app/page.tsx");
  const auth = read("app/AuthScreen.tsx");
  const schema = read("supabase/schema.sql");
  const cloudData = read("app/cloud-data.ts");
  const components = read("app/components.tsx");
  const vite = read("vite.config.ts");
  const supabaseFile = read("app/supabase.ts");

  assert.match(auth, /rotman555@gmail\.com/);
  assert.match(auth, /tsachiachrak@gmail\.com/);
  assert.match(auth, /dotanhaim@gmail\.com/);
  assert.match(auth, /signInWithOtp/);
  assert.match(auth, /shouldCreateUser:\s*true/);
  assert.match(page, /AuthScreen/);
  assert.doesNotMatch(supabaseFile, /service_role/i);

  // Task A: Synced Today-screen Hebrew labels
  assert.doesNotMatch(page, /בחרו כיתה\. כל התלמידים יסומנו כנוכחים כברירת מחדל\./);
  assert.match(page, /בחרו כיתה כדי להתחיל נוכחות להיום\./);
  assert.match(page, /כל התלמידים יסומנו כנוכחים כברירת מחדל\./);
  assert.match(page, /לא התחילה היום/);
  assert.match(page, /הושלמה היום/);
  assert.match(page, /בתהליך/);
  assert.match(page, /הוסיפו כיתה כדי להתחיל לנהל נוכחות\./);
  assert.match(page, /מעבר לעוד/);

  assert.match(components, /grid grid-cols-4/);
  assert.match(components, /bg-\[#002B45\]/);
  assert.match(components, /new Intl\.DateTimeFormat\("he-IL"/);
  assert.match(components, /function NavIcon/);
  assert.match(components, /function StudentActionBottomSheet/);
  assert.match(components, /function AttendanceStudentRow/);
  assert.match(components, /function FinishAttendanceBar/);
  assert.match(components, /pb-\[calc\(7\.25rem\+env\(safe-area-inset-bottom\)\)\]/);

  assert.match(page, /function StudentActions/);
  assert.match(page, /useState<AppTab>\("today"\)/);
  assert.match(page, /moreView === "menu"/);
  assert.match(page, /title="ניהול קורסים"/);
  assert.match(page, /title="ייבוא תלמידים"/);
  assert.match(page, /function AddStudentBottomSheet/);
  assert.match(page, /log\.status !== "Present"/);
  assert.match(page, /Boolean\(log\.notes\)/);
  assert.match(page, /setCompletedCourseIds/);
  assert.match(page, /setSessionReadOnly/);
  assert.match(page, /setTab\("more"\)/);
  assert.match(page, /dir="auto"/);

  assert.match(schema, /check \(status in \('Present', 'Late', 'Absent', 'Excused'\)\)/i);
  assert.match(cloudData, /rpc\("start_attendance"/);
  assert.match(cloudData, /postgres_changes/);
  assert.match(schema, /unique \(student_id, course_id, date\)/i);
  assert.match(schema, /is_approved_teacher/);
  assert.match(schema, /enable row level security/i);
  assert.match(vite, /base:\s*["']\.\/["']/);
});

test("biometric quick sign-in source contract and Hebrew UI strings", () => {
  const biometricSource = read("app/biometric.ts");
  const page = read("app/page.tsx");
  const components = read("app/components.tsx");
  const auth = read("app/AuthScreen.tsx");

  // 1. WebAuthn platform authenticator configuration
  assert.match(biometricSource, /isUserVerifyingPlatformAuthenticatorAvailable/);
  assert.match(biometricSource, /class_attendance_biometric_v1/);
  assert.match(biometricSource, /class_attendance_biometric_unlocked_v1/);
  assert.match(biometricSource, /authenticatorAttachment:\s*"platform"/);
  assert.match(biometricSource, /userVerification:\s*"required"/);
  assert.match(biometricSource, /residentKey:\s*"preferred"/);
  assert.match(biometricSource, /האימות הביומטרי בוטל או נכשל\. נסו שוב\./);

  // 2. Biometric Lock Gate Screen
  assert.match(components, /כניסה מהירה/);
  assert.match(components, /מחובר\/ת כ-/);
  assert.match(components, /כניסה באמצעות טביעת אצבע/);
  assert.match(components, /אימות באמצעות קישור למייל \/ החלפת משתמש/);

  // 3. Returning Teacher Hint on AuthScreen
  assert.match(auth, /getBiometricRecord/);
  assert.match(auth, /זיהוי בטביעת אצבע מוגדר במכשיר זה/);

  // 4. Today Enrollment Banner & More Tab Security Section
  assert.match(page, /כניסה מהירה בטביעת אצבע/);
  assert.match(page, /הפעילו זיהוי ביומטרי במכשיר זה כדי להיכנס לאפליקציה מיד ללא המתנה למייל\./);
  assert.match(page, /הפעלת טביעת אצבע/);
  assert.match(page, /לא עכשיו/);
  assert.match(page, /כניסה בטביעת אצבע הופעלה במכשיר זה/);
  assert.match(page, /אבטחה וכניסה מהירה/);
  assert.match(page, /מופעל במכשיר זה/);
  assert.match(page, /לא מופעל/);
  assert.match(page, /לא נתמך במכשיר זה/);
  assert.match(page, /הפעלת כניסה בטביעת אצבע/);
  assert.match(page, /נעילת אפליקציה כעת/);
  assert.match(page, /ביטול טביעת אצבע במכשיר זה/);
});

test("biometric WebAuthn helper behavioral lifecycle (register, verify, session lock/unlock)", async () => {
  const localStore = new Map();
  const sessionStore = new Map();
  const mockRawId = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]).buffer;

  let lastCreateOptions = null;
  let lastGetOptions = null;
  let shouldFailGet = false;

  const prevWindow = globalThis.window;
  globalThis.window = {
    location: { hostname: "zak-droid.github.io" },
    localStorage: {
      getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
      setItem: (k, v) => localStore.set(k, String(v)),
      removeItem: (k) => localStore.delete(k),
    },
    sessionStorage: {
      getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
      setItem: (k, v) => sessionStore.set(k, String(v)),
      removeItem: (k) => sessionStore.delete(k),
    },
    PublicKeyCredential: {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
    },
    navigator: {
      credentials: {
        create: async (options) => {
          lastCreateOptions = options;
          return { rawId: mockRawId };
        },
        get: async (options) => {
          lastGetOptions = options;
          if (shouldFailGet) {
            const err = new Error("NotAllowedError");
            err.name = "NotAllowedError";
            throw err;
          }
          return { id: "assertion-ok" };
        },
      },
    },
  };

  try {
    assert.equal(await isBiometricAvailable(), true);
    assert.equal(hasBiometricEnabled("tsachiachrak@gmail.com"), false);
    assert.equal(isBiometricSessionUnlocked(), false);

    // Register biometric
    const record = await registerBiometric("TsachiAchrak@gmail.com");
    assert.equal(record.email, "tsachiachrak@gmail.com");
    assert.equal(record.credentialIdBase64Url, uint8ArrayToBase64Url(new Uint8Array(mockRawId)));
    assert.equal(
      lastCreateOptions.publicKey.authenticatorSelection.authenticatorAttachment,
      "platform"
    );
    assert.equal(
      lastCreateOptions.publicKey.authenticatorSelection.userVerification,
      "required"
    );
    assert.equal(hasBiometricEnabled("tsachiachrak@gmail.com"), true);
    assert.equal(hasBiometricEnabled("other@gmail.com"), false);
    assert.equal(isBiometricSessionUnlocked(), true);

    // Lock session and verify biometric
    lockBiometricSession();
    assert.equal(isBiometricSessionUnlocked(), false);

    const verified = await verifyBiometric("tsachiachrak@gmail.com");
    assert.equal(verified, true);
    assert.equal(isBiometricSessionUnlocked(), true);
    assert.equal(lastGetOptions.publicKey.userVerification, "required");
    assert.deepEqual(
      new Uint8Array(lastGetOptions.publicKey.allowCredentials[0].id),
      base64UrlToUint8Array(record.credentialIdBase64Url)
    );

    // Graceful cancellation error in Hebrew
    lockBiometricSession();
    shouldFailGet = true;
    await assert.rejects(
      () => verifyBiometric("tsachiachrak@gmail.com"),
      /האימות הביומטרי בוטל או נכשל\. נסו שוב\./
    );
    assert.equal(isBiometricSessionUnlocked(), false);

    // Session dismissal & clear record
    assert.equal(isBiometricPromptDismissed(), false);
    dismissBiometricPromptForSession();
    assert.equal(isBiometricPromptDismissed(), true);

    markBiometricSessionUnlocked();
    clearBiometricRecord();
    assert.equal(getBiometricRecord(), null);
    assert.equal(isBiometricSessionUnlocked(), false);
    assert.equal(localStore.has(BIOMETRIC_STORAGE_KEY), false);
    assert.equal(sessionStore.has(BIOMETRIC_UNLOCKED_SESSION_KEY), false);
  } finally {
    globalThis.window = prevWindow;
  }
});

test("bulk student import parses rows, validates emails, and skips course duplicates", () => {
  const existingStudents = [
    { id: "1", name: "ישראל ישראלי", courseId: "course-a", active: true },
    { id: "2", name: "Existing Student", email: "existing@example.com", courseId: "course-a", active: true },
    { id: "3", name: "משה כהן", courseId: "course-b", active: true },
  ];
  const input = [
    "ישראל ישראלי",
    "נועם כהן, noam@example.com",
    "דניאל לוי\tdaniel@example.com",
    "משה כהן",
    "ישראל ישראלי",
    "Existing Student, EXISTING@example.com",
    "ישראלי דניאל, not-an-email",
    "",
  ].join("\n");

  const preview = prepareStudentImport(input, "course-a", existingStudents);

  assert.deepEqual(
    preview.ready.map(({ name, email }) => ({ name, email })),
    [
      { name: "נועם כהן", email: "noam@example.com" },
      { name: "דניאל לוי", email: "daniel@example.com" },
      { name: "משה כהן", email: undefined },
    ]
  );
  assert.equal(preview.duplicates.length, 3);
  assert.equal(preview.invalid.length, 1);
  assert.match(preview.invalid[0].reason, /כתובת ה?אימייל (לא|אינה) תקינה/);
});

test("offline storage cache, pending queue lifecycle, and optimistic data projection", () => {
  const localStore = new Map();
  const prevWindow = globalThis.window;
  const prevNavDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const mockNavigator = { onLine: false };

  globalThis.window = {
    localStorage: {
      getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
      setItem: (k, v) => localStore.set(k, String(v)),
      removeItem: (k) => localStore.delete(k),
    },
    navigator: mockNavigator,
  };

  try {
    Object.defineProperty(globalThis, "navigator", {
      value: mockNavigator,
      configurable: true,
      writable: true,
    });
  } catch {}

  try {
    assert.equal(isOnline(), false);

    const sampleData = {
      courses: [{ id: "c1", name: "קורס א", active: true }],
      students: [{ id: "s1", name: "תלמיד 1", courseId: "c1", active: true }],
      attendance: [
        {
          id: "log1",
          studentId: "s1",
          courseId: "c1",
          date: "2026-10-20",
          time: "10:00",
          status: "Present",
        },
      ],
    };

    // Cache saving and retrieval
    saveCachedAppData(sampleData);
    const cached = getCachedAppData();
    assert.deepEqual(cached, sampleData);

    // Queue pending attendance update
    assert.equal(getPendingQueue().length, 0);
    const queuedAction = queuePendingAction({
      type: "update_attendance",
      logId: "log1",
      patch: { status: "Absent", notes: "חולה" },
    });
    assert.equal(getPendingQueue().length, 1);

    // Apply pending projection onto cached data
    const projectedData = applyPendingActionsToData(cached);
    assert.equal(projectedData.attendance[0].status, "Absent");
    assert.equal(projectedData.attendance[0].notes, "חולה");

    // Remove from queue and clear
    removePendingAction(queuedAction.id);
    assert.equal(getPendingQueue().length, 0);

    clearPendingQueue();
    assert.equal(localStore.has(PENDING_QUEUE_KEY), false);
  } finally {
    globalThis.window = prevWindow;
    try {
      if (prevNavDescriptor) {
        Object.defineProperty(globalThis, "navigator", prevNavDescriptor);
      } else {
        delete globalThis.navigator;
      }
    } catch {}
  }
});

test("export utils generate valid Excel CSV with UTF-8 BOM, WhatsApp summary, and accurate attendance stats", () => {
  const student = { id: "s1", name: "דני כהן", email: "dani@example.com", courseId: "c1", active: true };
  const course = { id: "c1", name: "הנחיית קבוצות", active: true };

  const logs = [
    { id: "l1", studentId: "s1", courseId: "c1", date: "2026-10-01", time: "10:00", status: "Present" },
    { id: "l2", studentId: "s1", courseId: "c1", date: "2026-10-08", time: "10:00", status: "Late" },
    { id: "l3", studentId: "s1", courseId: "c1", date: "2026-10-15", time: "10:00", status: "Absent", notes: "במילואים" },
    { id: "l4", studentId: "s1", courseId: "c1", date: "2026-10-22", time: "10:00", status: "Excused" },
  ];

  // 1. Student Stats calculation
  const stats = calculateStudentAttendanceStats(student, logs);
  assert.equal(stats.totalSessions, 4);
  assert.equal(stats.presentCount, 1);
  assert.equal(stats.lateCount, 1);
  assert.equal(stats.absentCount, 1);
  assert.equal(stats.excusedCount, 1);
  // (1 present + 1 late) / (4 total - 1 excused) = 2/3 = 67%
  assert.equal(stats.attendancePercentage, 67);
  assert.equal(stats.recentAbsences.length, 2); // Absent + Late

  // 2. WhatsApp Summary
  const todayLogs = [
    { id: "l1", studentId: "s1", courseId: "c1", date: "2026-10-20", time: "10:00", status: "Present" },
    { id: "l2", studentId: "s2", courseId: "c1", date: "2026-10-20", time: "10:00", status: "Late" },
    { id: "l3", studentId: "s3", courseId: "c1", date: "2026-10-20", time: "10:00", status: "Absent", notes: "במילואים" },
  ];
  const waMessage = formatWhatsAppSummary(course.name, "2026-10-20", todayLogs);
  assert.match(waMessage, /שלום לכולם/);
  assert.match(waMessage, /הנחיית קבוצות/);
  assert.match(waMessage, /נוכחים: 1/);
  assert.match(waMessage, /מאחרים: 1/);
  assert.match(waMessage, /נעדרים: 1/);

  // 3. Excel CSV Generation
  const csv = generateCourseAttendanceCSV(course, [student], logs);
  assert.match(csv, /שם התלמיד,אימייל,סטטוס תלמיד/);
  assert.match(csv, /דני כהן,dani@example\.com,פעיל/);
  assert.match(csv, /67%/);
  assert.match(csv, /מפגש 2026-10-01/);
});

test("teacher enhancements UI contracts in components and page", () => {
  const page = read("app/page.tsx");
  const components = read("app/components.tsx");
  const cloudData = read("app/cloud-data.ts");

  // Offline integration
  assert.match(cloudData, /saveCachedAppData/);
  assert.match(cloudData, /getCachedAppData/);
  assert.match(cloudData, /syncPendingQueue/);
  assert.match(page, /isOffline/);
  assert.match(page, /pendingSyncCount/);
  assert.match(components, /מצב לא מקוון/);

  // WhatsApp Summary
  assert.match(page, /handleShareWhatsApp/);
  assert.match(components, /onShareWhatsApp/);
  assert.match(components, /וואטסאפ/);

  // Student Quick Card
  assert.match(page, /quickCardStudent/);
  assert.match(components, /StudentQuickCardModal/);
  assert.match(components, /כרטיס תלמיד\/ה/);
  assert.match(components, /אחוז נוכחות מצטבר בקורס/);

  // Excel CSV Export
  assert.match(page, /handleExportCourseCSV/);
  assert.match(page, /דוחות וייצוא נתונים/);
  assert.match(components, /ייצוא ל-Excel/);
});

test("mobile hardware and gesture back button navigation lifecycle contract", () => {
  const page = read("app/page.tsx");
  const components = read("app/components.tsx");

  // Popstate history listener and safe push/back helpers
  assert.match(page, /addEventListener\("popstate"/);
  assert.match(page, /safePushHistory/);
  assert.match(page, /safeBackHistory/);
  assert.match(page, /closeQuickCard/);
  assert.match(page, /closeAttendanceModal/);
  assert.match(page, /closeStudentAddSheet/);
  assert.match(page, /closeModal/);
  assert.match(page, /exitActiveSession/);
  assert.match(page, /exitMoreSubView/);
  assert.match(page, /handleTabChange/);

  // Backdrop click dismiss support
  assert.match(components, /onClick=\{onClose\}/);
});
