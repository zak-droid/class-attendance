import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("production build contains the phone-accessible app", async () => {
  const html = await readFile(new URL("dist/index.html", root), "utf8");
  assert.match(html, /<html lang="he" dir="rtl">/i);
  assert.match(html, /<title>ניהול נוכחות<\/title>/i);
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
  assert.match(components, /new Intl\.DateTimeFormat\("he-IL"/);
  assert.match(schema, /check \(status in \('Present', 'Late', 'Absent', 'Excused'\)\)/i);
  assert.match(cloudData, /rpc\("start_attendance"/);
  assert.match(cloudData, /postgres_changes/);
  assert.match(schema, /unique \(student_id, course_id, date\)/i);
  assert.match(schema, /is_approved_teacher/);
  assert.match(schema, /enable row level security/i);
  assert.match(vite, /base:\s*["']\.\/["']/);
});
