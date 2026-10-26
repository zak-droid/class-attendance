import { readAllRows } from "../app/paginated-read.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { extractTextFromXlsxArrayBuffer } from "../app/gemini-ai.ts";
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
  calculateStudentCertificateEligibility,
  formatWhatsAppSummary,
  generateCourseAttendanceCSV,
  getDefaultCourseTasks,
  isYearlyCourse,
} from "../app/export-utils.ts";

function read(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

function zipStoredFiles(files) {
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, nameBytes);
    localOffset += local.length + nameBytes.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
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
  assert.match(page, /בחרו כיתה כדי להתחיל נוכחות לתאריך זה\./);
  assert.match(page, /כל התלמידים יסומנו כנוכחים כברירת מחדל\./);
  assert.match(page, /טרם דווחה/);
  assert.match(page, /הושלמה היום/);
  assert.match(page, /בתהליך/);
  assert.match(page, /אין מפגשים מתוכננים להיום/);
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
  assert.match(page, /data.completedSessions/);
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

test("student import preserves first and last names from labeled and split columns", () => {
  const labeled = prepareStudentImport(
    "שם פרטי\tשם משפחה\tאימייל\nיעל\tכהן\tyael@example.com",
    "course-a",
    []
  );
  assert.deepEqual(labeled.ready.map(({ name, email }) => ({ name, email })), [
    { name: "יעל כהן", email: "yael@example.com" },
  ]);

  const splitColumns = prepareStudentImport("\tיעל\tכהן\tyael@example.com", "course-a", []);
  assert.deepEqual(splitColumns.ready.map(({ name, email }) => ({ name, email })), [
    { name: "יעל כהן", email: "yael@example.com" },
  ]);
});

test("unlabeled rosters do not mistake occupation text or surname substrings for a full name", () => {
  const preview = prepareStudentImport([
    "tamar@example.com\tתמר\tכהן\t123456789\t0500000000\tרחוב הדוגמה 1\tמנחת קבוצות ומטפלת\tתואר שני\tמנחת קבוצות",
    "bar@example.com\tבר\tברק\t987654321\t0500000001\tרחוב הדוגמה 2\tמורה",
    "keren@example.com\tקרן הוד\tישראלי כהן\t123456780\t0500000002\tרחוב הדוגמה 3",
  ].join("\n"), "course-a", []);
  assert.deepEqual(preview.ready.map(row => row.name), ["תמר כהן", "בר ברק", "קרן הוד ישראלי כהן"]);
  assert.equal(preview.invalid.length, 0);
});

test("student import handles quoted CSV names and a full-name header", () => {
  const preview = prepareStudentImport(
    'שם מלא,אימייל\n"כהן, יעל",yael@example.com',
    "course-a",
    []
  );
  assert.deepEqual(preview.ready.map(({ name, email }) => ({ name, email })), [
    { name: "כהן, יעל", email: "yael@example.com" },
  ]);
});

test("daily attendance exposes its date, historical student filters, and course save failures", () => {
  const page = read("app/page.tsx");
  assert.match(page, /formatLocalDate\(today\)/);
  assert.match(page, /בדיקת נוכחות לפי תאריך/);
  assert.match(page, /כל התאריכים/);
  assert.match(page, /historyStudent === "all" \|\| log\.studentId === historyStudent/);
  assert.match(page, /role="alert" className=.*\n\s*השמירה נכשלה:/s);
  assert.match(page, /שומר\.\.\./);
});

test("XLSX extraction preserves blank columns so names and emails stay in the correct fields", async () => {
  const sharedStrings = ["שם פרטי", "שם משפחה", "אימייל", "יעל", "כהן", "yael@example.com"]
    .map((value) => `<si><t>${value}</t></si>`)
    .join("");
  const cell = (reference, sharedStringIndex) => `<c r="${reference}" t="s"><v>${sharedStringIndex}</v></c>`;
  const sheet = `<worksheet><sheetData><row r="1">${cell("A1", 0)}${cell("C1", 1)}${cell("D1", 2)}</row><row r="2">${cell("A2", 3)}${cell("C2", 4)}${cell("D2", 5)}</row></sheetData></worksheet>`;
  const xlsx = zipStoredFiles({
    "xl/sharedStrings.xml": `<sst>${sharedStrings}</sst>`,
    "xl/worksheets/sheet1.xml": sheet,
  });
  const extracted = await extractTextFromXlsxArrayBuffer(xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength));
  const preview = prepareStudentImport(extracted, "course-a", []);
  assert.deepEqual(preview.ready.map(({ name, email }) => ({ name, email })), [
    { name: "יעל כהן", email: "yael@example.com" },
  ]);
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

test("export utils generate valid Excel CSV with UTF-8 BOM, WhatsApp summary, Rotem 80% attendance stats and certificate eligibility", () => {
  const student = { id: "s1", name: "דני כהן", email: "dani@example.com", courseId: "c1", active: true };
  const course = { id: "c1", name: "הנחיית קבוצות", active: true };

  const logs = [
    { id: "l1", studentId: "s1", courseId: "c1", date: "2026-10-01", time: "10:00", status: "Present" },
    { id: "l2", studentId: "s1", courseId: "c1", date: "2026-10-08", time: "10:00", status: "Late" },
    { id: "l3", studentId: "s1", courseId: "c1", date: "2026-10-15", time: "10:00", status: "Absent", notes: "במילואים" },
    { id: "l4", studentId: "s1", courseId: "c1", date: "2026-10-22", time: "10:00", status: "Excused" },
  ];

  // 1. Student Stats calculation according to Rotem rules:
  // Late = 1.0 (full presence), Excused = regular absence (counted in denominator without credit)
  // (1 present + 1 late) / 4 total sessions = 50%
  const stats = calculateStudentAttendanceStats(student, logs);
  assert.equal(stats.totalSessions, 4);
  assert.equal(stats.presentCount, 1);
  assert.equal(stats.lateCount, 1);
  assert.equal(stats.absentCount, 1);
  assert.equal(stats.excusedCount, 1);
  assert.equal(stats.attendancePercentage, 50);
  assert.equal(stats.isAttendanceEligible, false); // 80% threshold
  assert.equal(stats.eligibilityStatus, "not_eligible");
  assert.equal(stats.recentAbsences.length, 3); // Late + Absent + Excused

  // 2. Certificate eligibility with mandatory obligations
  const yearlyCourse = { id: "c1", name: "הנחיית קבוצות שנתי", active: true };
  const goodLogs = [
    { id: "l1", studentId: "s1", courseId: "c1", date: "2026-10-01", time: "10:00", status: "Present" },
    { id: "l2", studentId: "s1", courseId: "c1", date: "2026-10-08", time: "10:00", status: "Present" },
    { id: "l3", studentId: "s1", courseId: "c1", date: "2026-10-15", time: "10:00", status: "Present" },
    { id: "l4", studentId: "s1", courseId: "c1", date: "2026-10-22", time: "10:00", status: "Late" },
    { id: "l5", studentId: "s1", courseId: "c1", date: "2026-10-29", time: "10:00", status: "Absent" },
  ]; // 4/5 = 80% attendance!

  // Missing practicum on yearly course
  const subsMissingPracticum = [
    { id: "s1_c1_peer", studentId: "s1", courseId: "c1", taskId: "c1_peer", completed: true },
    { id: "s1_c1_journey", studentId: "s1", courseId: "c1", taskId: "c1_journey", completed: true },
  ];
  const certMissing = calculateStudentCertificateEligibility(student, yearlyCourse, goodLogs, subsMissingPracticum);
  assert.equal(certMissing.isAttendanceEligible, true);
  assert.equal(certMissing.allTasksCompleted, false);
  assert.equal(certMissing.isFullyEligibleForCertificate, false);

  // All 3 completed on yearly course
  const subsAllDone = [
    ...subsMissingPracticum,
    { id: "s1_c1_practicum", studentId: "s1", courseId: "c1", taskId: "c1_practicum", completed: true },
  ];
  const certAll = calculateStudentCertificateEligibility(student, yearlyCourse, goodLogs, subsAllDone);
  assert.equal(certAll.isFullyEligibleForCertificate, true);

  // 3. WhatsApp Summary
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

  // 4. Excel CSV Generation
  const csv = generateCourseAttendanceCSV(course, [student], logs, subsAllDone);
  assert.match(csv, /שם התלמיד,אימייל,סטטוס תלמיד/);
  assert.match(csv, /דני כהן,dani@example\.com,פעיל/);
  assert.match(csv, /50%/);
  assert.match(csv, /תרגיל עמיתים/);
  assert.match(csv, /מסע מדברי/);
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

  // Phase 4 Course Obligations Matrix & Live/Retroactive Editing
  assert.match(page, /CourseTasksMatrixView/);
  assert.match(page, /TaskNoteModal/);
  assert.match(page, /מעקב חובות וזכאות לתעודה/);
  assert.match(page, /עריכת נוכחות להיום/);
  assert.match(page, /רשומות לתאריך זה/);
  assert.match(components, /CourseTasksMatrixView/);
  assert.match(components, /TaskNoteModal/);
  assert.match(components, /חובות הקורס לתעודה/);
  assert.match(components, /רף תעודה: 80%/);
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


test("Phase 4.3 Gemini AI Syllabus Monitor and Lesson Logging contracts", () => {
  const page = read("app/page.tsx");
  const components = read("app/components.tsx");
  const offlineStorage = read("app/offline-storage.ts");
  const cloudData = read("app/cloud-data.ts");
  const geminiAi = read("app/gemini-ai.ts");
  const types = read("app/types.ts");

  // Models & Storage
  assert.match(types, /LessonLog/);
  assert.match(types, /AISyllabusAnalysis/);
  assert.match(types, /syllabus\?: string/);
  assert.match(offlineStorage, /getStoredLessons/);
  assert.match(offlineStorage, /upsertLessonLog/);
  assert.match(offlineStorage, /getStoredCourseSyllabus/);
  assert.match(offlineStorage, /saveStoredCourseSyllabus/);
  assert.match(cloudData, /saveLessonLog/);
  assert.match(cloudData, /saveCourseSyllabus/);

  // Gemini AI module
  assert.match(geminiAi, /gemini-1\.5-flash/);
  assert.match(geminiAi, /analyzeCourseSyllabus/);
  assert.match(geminiAi, /performHeuristicAnalysis/);
  assert.match(geminiAi, /testGeminiApiKey/);
  assert.match(geminiAi, /maskApiKey/);

  // Components & UI Contracts
  assert.match(components, /CourseSyllabusModal/);
  assert.match(components, /LessonTopicModal/);
  assert.match(components, /AISyllabusAnalysisModal/);
  assert.match(components, /GeminiSettingsModal/);
  assert.match(components, /מד כיסוי סילבוס כללי/);
  assert.match(components, /המלצה ממוקדת למפגש הבא/);
  assert.match(components, /זיהוי חזרתיות אפשרית בין מפגשים/);
  assert.match(components, /בדיקת סילבוס \(AI\)/);

  // Page Integration
  assert.match(page, /handleOpenSyllabusModal/);
  assert.match(page, /handleOpenLessonTopicModal/);
  assert.match(page, /handleOpenAIAnalysis/);
  assert.match(page, /handleSaveGeminiKey/);
  assert.match(page, /נושא המפגש/);
  assert.match(page, /בינה מלאכותית \(Google Gemini\)/);
  assert.match(page, /AISyllabusAnalysisModal/);
  assert.match(page, /GeminiSettingsModal/);
});


test("all pages are loaded beyond PostgREST default and errors are not swallowed", async () => {
  const rows = Array.from({length:1205}, (_,id)=>({id}));
  let calls=0;
  const result=await readAllRows(async(from,to)=>{calls++;return {data:rows.slice(from,to+1),error:null};});
  assert.equal(result.length,1205); assert.equal(calls,3);
  await assert.rejects(readAllRows(async()=>({data:null,error:new Error('denied')})),/denied/);
});
test("no attendance is unknown and cannot make a student eligible",()=>{
  const student={id:'s',name:'יעל כהן',courseId:'c',active:true};
  const stats=calculateStudentAttendanceStats(student,[]);
  assert.equal(stats.totalSessions,0);
  assert.equal(stats.isAttendanceEligible,false);
  assert.equal(stats.eligibilityLabel,'אין נתוני נוכחות');
  const cert=calculateStudentCertificateEligibility(student,{id:'c',name:'קורס',active:true},[],[]);
  assert.equal(cert.hasAttendanceData,false);
  assert.equal(cert.isFullyEligibleForCertificate,false);
});

test("surname-only second columns are names and ragged spreadsheets do not crash",()=>{
  for(const input of ['שם פרטי,שם משפחה\nיעל,כהן','שם,משפחה\nיעל,כהן','יעל,כהן']) {
    assert.equal(prepareStudentImport(input,'c',[]).ready[0].name,'יעל כהן');
  }
  assert.equal(prepareStudentImport('שם פרטי,שם משפחה\nיעל','c',[]).ready[0].name,'יעל');
  assert.equal(prepareStudentImport('שם פרטי,שם משפחה,אימייל\nיעל,כהן,bad-address','c',[]).invalid.length,1);
});

test("CSV includes custom obligations, feedback, attendance notes and transferred students",()=>{
  const course={id:'c',name:'קורס',active:true};
  const student={id:'s',name:'יעל כהן',courseId:'next-course',active:true};
  const logs=[{id:'l',studentId:'s',courseId:'c',date:'2026-10-05',time:'10:00',status:'Present',notes:'הערת נוכחות'}];
  const tasks=[{id:'custom',courseId:'c',title:'מטלה, נוספת',requiredForCertificate:true}];
  const subs=[{id:'s_custom',studentId:'s',courseId:'c',taskId:'custom',completed:false,notes:'משוב, עם פסיק',completedDate:'2026-10-05'}];
  const csv=generateCourseAttendanceCSV(course,[student],logs,subs,tasks);
  assert.match(csv,/יעל כהן/); assert.match(csv,/100%/); assert.match(csv,/הועבר\/ה לקורס אחר/);
  assert.match(csv,/"מטלה, נוספת"/); assert.match(csv,/הערת נוכחות/); assert.match(csv,/"משוב, עם פסיק"/);
});
