import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { prepareStudentImport } from "../app/student-import.ts";

const root = new URL("../", import.meta.url);

test("production build contains the phone-accessible app", async () => {
  const [html, globalCss] = await Promise.all([
    readFile(new URL("dist/index.html", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(html, /<html lang="he" dir="rtl">/i);
  assert.match(html, /<title>ניהול נוכחות<\/title>/i);
  assert.match(html, /<meta name="theme-color" content="#073b4c"/i);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Heebo:wght@400;500;600;700;800&display=swap/i);
  assert.match(globalCss, /font-family:\s*Heebo,\s*"Noto Sans Hebrew",\s*"Segoe UI",\s*Arial,\s*sans-serif/);
  assert.match(globalCss, /--background:\s*#073b4c/);
  assert.match(globalCss, /rgba\(19, 69, 84, 0\.1\)/);
  assert.match(html, /assets\/index-/);
});

test("shared data uses secure sign-in, duplicate prevention, and realtime sync", async () => {
  const [page, auth, components, cloudData, schema, vite] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/AuthScreen.tsx", root), "utf8"),
    readFile(new URL("app/components.tsx", root), "utf8"),
    readFile(new URL("app/cloud-data.ts", root), "utf8"),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
    readFile(new URL("vite.config.ts", root), "utf8"),
  ]);

  assert.match(page, /AuthScreen/);
  assert.doesNotMatch(page, /localStorage/);
  assert.match(auth, /signInWithOtp/);
  assert.match(auth, /https:\/\/zak-droid\.github\.io\/class-attendance\//);
  assert.match(components, /Present:\s*"נוכח"/);
  assert.match(components, /Late:\s*"איחר"/);
  assert.match(components, /Absent:\s*"נעדר"/);
  assert.match(components, /Excused:\s*"מוצדק"/);
  assert.match(components, /Present:\s*"bg-\[#E7F2E9\] text-\[#276749\] border-\[#CBE3D0\]"/);
  assert.match(components, /bg-white/);
  assert.match(page, /bg-\[#0F4C5C\]/);
  assert.match(page, /border-\[#D5E4EA\] bg-\[#FFFFFF\]/);
  assert.match(components, /new Intl\.DateTimeFormat\("he-IL"/);
  assert.match(components, /<h1[^>]*>\{title\}<\/h1>/);
  assert.match(components, /function NavIcon/);
  assert.doesNotMatch(components, /short:\s*"(?:כי|הי|תל|הס)"/);
  assert.match(components, /"פתיחת נוכחות"\s*:\s*"התחלת נוכחות"/);
  assert.doesNotMatch(components, /פתיחת הנוכחות של היום|התחלת נוכחות להיום/);
  assert.match(components, /const \[menuOpen, setMenuOpen\] = useState\(false\)/);
  assert.match(components, /const \[noteOpen, setNoteOpen\] = useState\(false\)/);
  assert.match(components, /הוספת הערה/);
  assert.match(components, /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(components, /grid grid-cols-4/);
  assert.match(components, /bg-\[#073B4C\]/);
  assert.match(page, /function StudentActions/);
  assert.match(page, /onEdit\(\);.*?>עריכה/s);
  assert.match(page, /student\.active \? "השבתה" : "הפעלה"/);
  assert.doesNotMatch(page, /שעה \{log\.time\}/);
  assert.match(page, /md:hidden/);
  assert.match(page, /hidden[^"']*md:block/);
  assert.match(page, /useState<AppTab>\("today"\)/);
  assert.match(page, /מה מתחילים עכשיו\?/);
  assert.match(page, /חריגים בלבד/);
  assert.match(page, /log\.status !== "Present"/);
  assert.match(page, /dir="auto"/);
  assert.doesNotMatch(page, />נכ<\/div>/);
  assert.match(schema, /check \(status in \('Present', 'Late', 'Absent', 'Excused'\)\)/i);
  assert.match(cloudData, /rpc\("start_attendance"/);
  assert.match(cloudData, /postgres_changes/);
  assert.match(schema, /unique \(student_id, course_id, date\)/i);
  assert.match(schema, /is_approved_teacher/);
  assert.match(schema, /enable row level security/i);
  assert.match(vite, /base:\s*["']\.\/["']/);
});

test("bulk student import parses rows, validates emails, and skips course duplicates", () => {
  const existingStudents = [
    { id: "1", name: "יעל כהן", courseId: "course-a", active: true },
    { id: "2", name: "Existing Student", email: "existing@example.com", courseId: "course-a", active: true },
    { id: "3", name: "מיה כהן", courseId: "course-b", active: true },
  ];
  const input = [
    "מיה כהן",
    "נועם לוי, noam@example.com",
    "דניאל פרץ\tdaniel@example.com",
    "מיה   כהן",
    "יעל כהן",
    "תלמיד אחר, EXISTING@example.com",
    "שורה שגויה, not-an-email",
    "",
  ].join("\n");

  const preview = prepareStudentImport(input, "course-a", existingStudents);

  assert.deepEqual(preview.ready.map(({ name, email }) => ({ name, email })), [
    { name: "מיה כהן", email: undefined },
    { name: "נועם לוי", email: "noam@example.com" },
    { name: "דניאל פרץ", email: "daniel@example.com" },
  ]);
  assert.equal(preview.duplicates.length, 3);
  assert.equal(preview.invalid.length, 1);
  assert.equal(preview.invalid[0].reason, "כתובת האימייל אינה תקינה");
});
