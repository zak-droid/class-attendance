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
const hasLettersPattern = /[\u0590-\u05FFa-zA-Z]{2,}/;
const phoneOrIdPattern = /^[\d\-\s\+\(\)\.\/]{5,}$/;

function parseDelimitedRow(input: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalizedHeader(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/[\s_.'\"׳״:()\-]/g, "");
}

function isHeaderRow(values: string[]): boolean {
  const headers = values.map(normalizedHeader);
  const hasName = headers.some((h) => /^(שם|שםמלא|שםתלמיד|שםהתלמיד|שםפרטי|firstname|fullname|studentname)$/.test(h));
  const hasSurname = headers.some((h) => /^(שםמשפחה|משפחה|lastname|surname|familyname)$/.test(h));
  const hasContactOrId = headers.some((h) => /^(מייל|אימייל|דואראלקטרוני|email|טלפון|נייד|phone|תז|תעודתזהות|id|מספרזהות)$/.test(h));
  return (hasName || hasSurname) && (hasContactOrId || hasSurname || headers.length > 1);
}

function cleanName(value: string = ""): string {
  return value.trim().replace(/^["\x27]|["\x27]$/g, "").replace(/\s+/g, " ");
}

function normalizedName(value: string): string {
  return cleanName(value).normalize("NFKC").toLowerCase();
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function prepareStudentImport(
  text: string,
  courseId: string,
  existingStudents: Student[]
): StudentImportPreview {
  const existingInCourse = existingStudents.filter((student) => student.courseId === courseId);
  const existingEmails = new Set(
    existingInCourse
      .map((student) => (student.email ? normalizedEmail(student.email) : ""))
      .filter(Boolean)
  );
  const existingNames = new Set(existingInCourse.map((student) => normalizedName(student.name)));
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const ready: PreparedStudentRow[] = [];
  const duplicates: PreparedStudentRow[] = [];
  const invalid: InvalidStudentRow[] = [];

  const lines = text.split(/\r?\n/);
  let nameColumns: { fullName: number; firstName: number; lastName: number } | null = null;
  let emailColumn = -1;

  lines.forEach((input, index) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;
    const line = index + 1;

    const delimiter = input.includes("\t") ? "\t" : input.includes(";") ? ";" : ",";
    const rawValues = parseDelimitedRow(input, delimiter);

    const values = rawValues.map((v) => v.trim().replace(/^["\x27]|["\x27]$/g, ""));

    // Recognize headers even when the file starts with a title or blank row.
    if (index < 5 && isHeaderRow(values)) {
      const headers = values.map(normalizedHeader);
      const findColumn = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
      nameColumns = {
        fullName: findColumn(/^(שםמלא|שםתלמיד|שםהתלמיד|fullname|studentname|שם)$/),
        firstName: findColumn(/^(שםפרטי|firstname|givenname)$/),
        lastName: findColumn(/^(שםמשפחה|משפחה|lastname|surname|familyname)$/),
      };
      emailColumn = findColumn(/^(מייל|אימייל|דואראלקטרוני|email)$/);

      return;
    }

    if (nameColumns && nameColumns.fullName < 0 && nameColumns.firstName < 0 && nameColumns.lastName < 0) {
      nameColumns = null;
    }

    let email = "";
    let emailColIdx = emailColumn;
    if (emailColumn >= 0 && values[emailColumn] && emailPattern.test(values[emailColumn])) {
      email = normalizedEmail(values[emailColumn]);
    } else {
      emailColIdx = -1;
      for (let i = 0; i < values.length; i += 1) {
        if (emailPattern.test(values[i])) {
          email = normalizedEmail(values[i]);
          emailColIdx = i;
          break;
        }
      }
    }

    // A surname column is not an email column. Validate only an explicitly
    // labeled email or an unmistakable email-looking value in an unlabeled row.
    const invalidEmail = emailColumn >= 0 && values[emailColumn] && !emailPattern.test(values[emailColumn]);
    const malformedUnlabeled = !nameColumns && values.length === 2 && !email &&
      (values[1]?.includes("@") || /^[a-z]+-[a-z-]+$/i.test(values[1] ?? ""));
    if (invalidEmail || malformedUnlabeled) {
      invalid.push({ line, input: trimmedInput, reason: "כתובת אימייל לא תקינה" });
      return;
    }

    let name = "";
    if (nameColumns) {
      const { fullName, firstName, lastName } = nameColumns;
      if (firstName >= 0 || lastName >= 0) {
        name = [firstName >= 0 ? values[firstName] : lastName >= 0 && fullName >= 0 ? values[fullName] : "", lastName >= 0 ? values[lastName] : ""]
          .map(cleanName)
          .filter(Boolean)
          .join(" ");
      }
      if (!name && fullName >= 0) name = cleanName(values[fullName] ?? "");
    }

    if (!name) {
      const nameCells = values
        .map((value, i) => ({ value: cleanName(value), index: i }))
        .filter(({ value, index }) => index !== emailColIdx && value && hasLettersPattern.test(value) && !phoneOrIdPattern.test(value) && !value.includes("@"));
      // In an unlabeled roster the first two text fields are the name parts.
      // Later fields can contain addresses or occupations that happen to
      // include another cell's text; they are never evidence of a full name.
      name = nameCells.slice(0, 2).map(({ value }) => value).join(" ");
    }

    if (!name) {
      name = cleanName(values[0] ?? "");
    }

    if (!name || /^\d+$/.test(name)) {
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
