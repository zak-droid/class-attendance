import type { Student } from "./types";

export interface PreparedStudentRow {
  line: number;
  name: string;
  email?: string;
}

export interface InvalidStudentRow {
  line: number;
  input: string;
  reason: string;
}

export interface StudentImportPreview {
  ready: PreparedStudentRow[];
  duplicates: PreparedStudentRow[];
  invalid: InvalidStudentRow[];
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizedName(value: string) {
  return cleanName(value).normalize("NFKC").toLocaleLowerCase("he-IL");
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

export function prepareStudentImport(text: string, courseId: string, existingStudents: Student[]): StudentImportPreview {
  const existingInCourse = existingStudents.filter((student) => student.courseId === courseId);
  const existingEmails = new Set(existingInCourse.map((student) => student.email ? normalizedEmail(student.email) : "").filter(Boolean));
  const existingNames = new Set(existingInCourse.map((student) => normalizedName(student.name)));
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const ready: PreparedStudentRow[] = [];
  const duplicates: PreparedStudentRow[] = [];
  const invalid: InvalidStudentRow[] = [];

  text.split(/\r?\n/).forEach((input, index) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const values = (input.includes("\t") ? input.split("\t") : input.split(",")).map((value) => value.trim());
    const name = cleanName(values[0] ?? "");
    const email = normalizedEmail(values[1] ?? "");
    const line = index + 1;

    if (!name) {
      invalid.push({ line, input: trimmedInput, reason: "חסר שם תלמיד" });
      return;
    }
    if (values.slice(2).some(Boolean)) {
      invalid.push({ line, input: trimmedInput, reason: "יש יותר משתי עמודות" });
      return;
    }
    if (email && !emailPattern.test(email)) {
      invalid.push({ line, input: trimmedInput, reason: "כתובת האימייל אינה תקינה" });
      return;
    }

    const row: PreparedStudentRow = { line, name, email: email || undefined };
    const nameKey = normalizedName(name);
    const isDuplicate = email
      ? existingEmails.has(email) || seenEmails.has(email)
      : existingNames.has(nameKey) || seenNames.has(nameKey);

    if (isDuplicate) {
      duplicates.push(row);
      return;
    }

    ready.push(row);
    seenNames.add(nameKey);
    if (email) seenEmails.add(email);
  });

  return { ready, duplicates, invalid };
}
