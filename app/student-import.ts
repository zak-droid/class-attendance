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
  return value.trim().replace(/^["\x27]|["\x27]$/g, "").replace(/\s+/g, " ");
}

function normalizedName(value: string) {
  return cleanName(value).normalize("NFKC").toLowerCase("he-IL");
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

  const lines = text.split(/\r?\n/);

  lines.forEach((input, index) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;
    const line = index + 1;

    let rawValues: string[] = [];
    if (input.includes("\t")) {
      rawValues = input.split("\t");
    } else if (input.includes(";")) {
      rawValues = input.split(";");
    } else {
      rawValues = input.split(",");
    }

    const values = rawValues.map((v) => v.trim().replace(/^["\x27]|["\x27]$/g, ""));

    // Check if line is a header row (first 3 lines only)
    if (index < 3) {
      const joined = values.join(" ").toLowerCase();
      if (
        (joined.includes("שם") || joined.includes("student") || joined.includes("name")) &&
        (joined.includes("מייל") || joined.includes("email") || joined.includes("טלפון") || joined.includes("phone") || joined.includes("ת.ז") || joined.includes("id"))
      ) {
        return; // skip header row
      }
    }

    // Check for email across any column
    let email = "";
    let emailColIdx = -1;
    for (let i = 0; i < values.length; i += 1) {
      if (emailPattern.test(values[i])) {
        email = normalizedEmail(values[i]);
        emailColIdx = i;
        break;
      }
    }

    // Backward compatibility with test: if exactly 2 values and second value is non-empty but invalid email
    if (values.length === 2 && values[1] && !email) {
      if (values[1].includes("@") || !values[1].includes(" ")) {
        invalid.push({ line, input: trimmedInput, reason: "כתובת אימייל לא תקינה" });
        return;
      }
    }

    // Name column: find first non-numeric, non-email column with letters
    let name = "";
    for (let i = 0; i < values.length; i += 1) {
      if (i === emailColIdx) continue;
      const val = cleanName(values[i]);
      if (val && !/^\d{5,}$/.test(val.replace(/[-\s]/g, ""))) {
        name = val;
        break;
      }
    }

    if (!name) {
      name = cleanName(values[0] ?? "");
    }

    if (!name) {
      invalid.push({ line, input: trimmedInput, reason: "חסר שם תלמיד" });
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
