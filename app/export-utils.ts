"use client";

import type {
  AttendanceLog,
  AttendanceStatus,
  Course,
  CourseTask,
  EligibilityStatus,
  Student,
  StudentTaskSubmission,
} from "./types";

export interface StudentAttendanceStats {
  student: Student;
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  attendancePercentage: number;
  isAttendanceEligible: boolean;
  eligibilityStatus: EligibilityStatus;
  eligibilityLabel: string;
  history: AttendanceLog[];
  recentAbsences: Array<{
    date: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
}

export const statusHebrewMap: Record<AttendanceStatus, string> = {
  Present: "נוכח",
  Late: "מאחר",
  Absent: "נעדר",
  Excused: "מוצדק",
};

export function isYearlyCourse(courseName?: string, description?: string): boolean {
  const combined = `${courseName ?? ""} ${description ?? ""}`.toLowerCase();
  return combined.includes("שנתי") || combined.includes("yearly") || combined.includes("annual");
}

export function getDefaultCourseTasks(courseId: string, courseName?: string): CourseTask[] {
  return [
    {
      id: `${courseId}_peer`,
      courseId,
      title: "הגשת תרגיל עמיתים",
      description: "הגשת תרגיל עמיתים כנדרש בסילבוס",
      requiredForCertificate: true,
      yearlyOnly: false,
    },
    {
      id: `${courseId}_practicum`,
      courseId,
      title: "הגשת פרקטיקום",
      description: "הגשת דוח פרקטיקום — בקורס השנתי בלבד",
      requiredForCertificate: true,
      yearlyOnly: true,
    },
    {
      id: `${courseId}_journey`,
      courseId,
      title: "השתתפות במסע מדברי / יומיים",
      description: "נוכחות והשתתפות במסע המדברי / סדנת יומיים",
      requiredForCertificate: true,
      yearlyOnly: false,
    },
  ];
}

/**
 * Calculates student cumulative attendance based on Rotem's specifications:
 * - 80% threshold for certificate eligibility
 * - "Late" (מאחר) counts as full presence (1.0)
 * - "Excused" (מוצדק) counts as a regular absence (counted in denominator without attendance credit)
 */
export function calculateStudentAttendanceStats(
  student: Student,
  logs: AttendanceLog[],
  course?: Course,
  asOf = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Jerusalem'}).format(new Date())
): StudentAttendanceStats {
  const history = logs.filter(
    (log) => log.studentId === student.id && (!student.courseId || log.courseId === student.courseId)
  );
  const cancelled = new Set(course?.schedule?.meetings.filter(m => m.status === 'cancelled').map(m => m.date) ?? []);
  const studentLogs = history.filter(log => log.date <= asOf && !cancelled.has(log.date));

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  const recentAbsences: Array<{ date: string; status: AttendanceStatus; notes?: string }> = [];

  for (const log of studentLogs) {
    if (log.status === "Present") {
      presentCount += 1;
    } else if (log.status === "Late") {
      lateCount += 1;
      recentAbsences.push({ date: log.date, status: log.status, notes: log.notes });
    } else if (log.status === "Absent") {
      absentCount += 1;
      recentAbsences.push({ date: log.date, status: log.status, notes: log.notes });
    } else if (log.status === "Excused") {
      excusedCount += 1;
      recentAbsences.push({ date: log.date, status: log.status, notes: log.notes });
    }
  }

  const totalSessions = studentLogs.length;
  // Late counts as full presence (1.0)
  const attendedCount = presentCount + lateCount;

  // Excused counts as a regular absence (it stays in the total sessions denominator)
  let attendancePercentage = 100;
  if (totalSessions === 0) {
    attendancePercentage = 0;
  } else {
    attendancePercentage = Math.round((attendedCount / totalSessions) * 100);
  }

  const isAttendanceEligible = totalSessions > 0 && attendancePercentage >= 80;
  let eligibilityStatus: EligibilityStatus = "eligible";
  let eligibilityLabel = "עומד/ת ברף (80%+)";

  if (totalSessions === 0) {
    eligibilityStatus = "at_risk";
    eligibilityLabel = "אין נתוני נוכחות";
  } else if (attendancePercentage >= 80) {
    eligibilityStatus = "eligible";
    eligibilityLabel = "עומד/ת ברף (80%+)";
  } else if (attendancePercentage >= 70) {
    eligibilityStatus = "at_risk";
    eligibilityLabel = "בסיכון לזכאות (70%-79%)";
  } else {
    eligibilityStatus = "not_eligible";
    eligibilityLabel = "מתחת לרף הזכאות (<70%)";
  }

  return {
    student,
    totalSessions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    attendancePercentage,
    isAttendanceEligible,
    eligibilityStatus,
    eligibilityLabel,
    history: [...history].sort((a,b) => b.date.localeCompare(a.date)),
    recentAbsences,
  };
}

export interface StudentCertificateEligibility {
  hasAttendanceData: boolean;
  studentId: string;
  attendancePercentage: number;
  isAttendanceEligible: boolean;
  eligibilityStatus: EligibilityStatus;
  requiredTasks: CourseTask[];
  completedTaskIds: string[];
  missingTasks: CourseTask[];
  allTasksCompleted: boolean;
  isFullyEligibleForCertificate: boolean;
  statusLabel: string;
  statusBadgeClass: string;
}

export function calculateStudentCertificateEligibility(
  student: Student,
  course: Course,
  logs: AttendanceLog[],
  submissions: StudentTaskSubmission[] = [],
  customTasks: CourseTask[] = []
): StudentCertificateEligibility {
  const stats = calculateStudentAttendanceStats(student, logs, course);
  const yearly = isYearlyCourse(course.name, course.description);

  // Combine default tasks with any custom course tasks
  const defaults = getDefaultCourseTasks(course.id, course.name);
  const allCourseTasks = [
    ...defaults,
    ...customTasks.filter((t) => t.courseId === course.id),
  ];

  // Filter required tasks: practicum is only required if yearly
  const requiredTasks = allCourseTasks.filter((task) => {
    if (!task.requiredForCertificate) return false;
    if (task.yearlyOnly && !yearly) return false;
    return true;
  });

  const studentSubmissions = submissions.filter(
    (s) => s.studentId === student.id && s.courseId === course.id && s.completed
  );
  const completedTaskIds = studentSubmissions.map((s) => s.taskId);

  const missingTasks = requiredTasks.filter(
    (task) => !completedTaskIds.includes(task.id)
  );

  const allTasksCompleted = missingTasks.length === 0;
  const isFullyEligibleForCertificate = stats.isAttendanceEligible && allTasksCompleted;

  let statusLabel = "זכאי/ת לתעודה ✨";
  let statusBadgeClass = "bg-[#DCFCE7] text-[#166534] border-[#16A34A]/30";

  if (stats.totalSessions === 0) {
    statusLabel = "אין נתוני נוכחות — הזכאות טרם נקבעה";
    statusBadgeClass = "bg-slate-100 text-slate-700";
  } else if (isFullyEligibleForCertificate) {
    statusLabel = "זכאי/ת לתעודה ✨";
    statusBadgeClass = "bg-[#DCFCE7] text-[#166534] border-[#16A34A]/30";
  } else if (stats.isAttendanceEligible && !allTasksCompleted) {
    statusLabel = `זכאי/ת לפי נוכחות (חסרות ${missingTasks.length} חובות)`;
    statusBadgeClass = "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/30";
  } else if (stats.eligibilityStatus === "at_risk") {
    statusLabel = "בסיכון לזכאות (נוכחות 70%-79%)";
    statusBadgeClass = "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/30";
  } else {
    statusLabel = "לא זכאי/ת לתעודה (מתחת ל-80%)";
    statusBadgeClass = "bg-[#FEE2E2] text-[#991B1B] border-[#DC2626]/30";
  }

  return {
    hasAttendanceData: stats.totalSessions > 0,
    studentId: student.id,
    attendancePercentage: stats.attendancePercentage,
    isAttendanceEligible: stats.isAttendanceEligible,
    eligibilityStatus: stats.eligibilityStatus,
    requiredTasks,
    completedTaskIds,
    missingTasks,
    allTasksCompleted,
    isFullyEligibleForCertificate,
    statusLabel,
    statusBadgeClass,
  };
}

export function formatWhatsAppSummary(
  courseName: string,
  date: string,
  logs: AttendanceLog[]
): string {
  const targetLogs = logs.some((l) => l.date === date) ? logs.filter((log) => log.date === date) : logs;

  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const log of targetLogs) {
    if (log.status === "Present") present += 1;
    else if (log.status === "Late") late += 1;
    else if (log.status === "Absent") absent += 1;
    else if (log.status === "Excused") excused += 1;
  }

  return `שלום לכולם 🌿
סיכום נוכחות - ${courseName}
תאריך: ${date}

• נוכחים: ${present}
• מאחרים: ${late}
• נעדרים: ${absent}${
    excused > 0 ? `
• היעדרות מוצדקת: ${excused}` : ""
  }

תודה על ההשתתפות והמשך שבוע מצוין! ✨`;
}

export function openWhatsAppShare(text: string): void {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}

function escapeCsvCell(cell: string | number): string {
  const raw = String(cell ?? "");
  const str = typeof cell === "string" && /^[=+@-]/.test(raw) ? `'${raw}` : raw;
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCourseAttendanceCSV(
  course: Course,
  allStudents: Student[],
  allLogs: AttendanceLog[],
  submissions: StudentTaskSubmission[] = [],
  customTasks: CourseTask[] = []
): string {
  const courseLogs = allLogs.filter((l) => l.courseId === course.id);
  const historicalIds = new Set(courseLogs.map(l => l.studentId));
  const courseStudents = allStudents.filter(s => s.courseId === course.id || historicalIds.has(s.id));
  const yearly = isYearlyCourse(course.name, course.description);

  const extraTasks = customTasks.filter(t => t.courseId === course.id && (!t.yearlyOnly || yearly));
  const reportTasks = [...getDefaultCourseTasks(course.id,course.name).filter(t => !t.yearlyOnly || yearly), ...extraTasks];
  // Extract distinct dates sorted chronologically
  const dates = Array.from(new Set(courseLogs.map((l) => l.date))).sort();

  const headers = [
    "שם התלמיד",
    "אימייל",
    "סטטוס תלמיד",
    "אחוז נוכחות",
    "סטטוס זכאות לתעודה",
    "תרגיל עמיתים",
    ...(yearly ? ["פרקטיקום (שנתי)"] : []),
    "מסע מדברי / יומיים",
    ...extraTasks.map(t => t.title),
    "נוכח",
    "מאחר",
    "נעדר",
    "מוצדק",
    ...dates.flatMap(d => [`מפגש ${d}`, `הערה ${d}`]),
    ...reportTasks.flatMap(t => [`תאריך — ${t.title}`, `משוב — ${t.title}`]),
  ];

  const rows: string[][] = [headers.map(escapeCsvCell)];

  const peerTaskId = `${course.id}_peer`;
  const practicumTaskId = `${course.id}_practicum`;
  const journeyTaskId = `${course.id}_journey`;

  for (const student of courseStudents) {
    const courseStudent = {...student, courseId:course.id};
    const stats = calculateStudentAttendanceStats(courseStudent, courseLogs, course);
    const cert = calculateStudentCertificateEligibility(
      courseStudent,
      course,
      courseLogs,
      submissions,
      customTasks
    );

    const hasPeer = submissions.some(
      (s) => s.studentId === student.id && s.taskId === peerTaskId && s.completed
    );
    const hasPracticum = submissions.some(
      (s) => s.studentId === student.id && s.taskId === practicumTaskId && s.completed
    );
    const hasJourney = submissions.some(
      (s) => s.studentId === student.id && s.taskId === journeyTaskId && s.completed
    );

    const row: string[] = [
      escapeCsvCell(student.name),
      escapeCsvCell(student.email || ""),
      student.courseId !== course.id ? "הועבר/ה לקורס אחר" : student.active ? "פעיל" : "לא פעיל",
      stats.totalSessions ? `${stats.attendancePercentage}%` : "אין נתונים",
      escapeCsvCell(cert.statusLabel),
      hasPeer ? "בוצע" : "לא בוצע",
      ...(yearly ? [hasPracticum ? "בוצע" : "לא בוצע"] : []),
      hasJourney ? "בוצע" : "לא בוצע",
      ...extraTasks.map(t => submissions.some(s => s.studentId===student.id && s.taskId===t.id && s.completed) ? "בוצע" : "לא בוצע"),
      String(stats.presentCount),
      String(stats.lateCount),
      String(stats.absentCount),
      String(stats.excusedCount),
    ];

    for (const d of dates) {
      const matchLog = courseLogs.find((l) => l.studentId === student.id && l.date === d);
      if (matchLog) {
        row.push(statusHebrewMap[matchLog.status] || matchLog.status, escapeCsvCell(matchLog.notes || ""));
      } else {
        row.push("-", "");
      }
    }

    for (const task of reportTasks) {
      const submission = submissions.find(s => s.studentId === student.id && s.taskId === task.id);
      row.push(escapeCsvCell(submission?.completedDate || ""), escapeCsvCell(submission?.notes || ""));
    }
    rows.push(row);
  }

  // UTF-8 BOM prefix (﻿) ensures Hebrew characters render properly in Microsoft Excel
  return "\uFEFF" + rows.map((r) => r.join(",")).join("\n");
}

export function downloadCSV(filename: string, csvContent: string): void {
  if (typeof window !== "undefined") {
    const safeFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", safeFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
