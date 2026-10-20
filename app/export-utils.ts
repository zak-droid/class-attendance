"use client";

import type { AttendanceLog, AttendanceStatus, Course, Student } from "./types";

export interface StudentAttendanceStats {
  student: Student;
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  attendancePercentage: number;
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

export function calculateStudentAttendanceStats(
  student: Student,
  logs: AttendanceLog[]
): StudentAttendanceStats {
  const studentLogs = logs.filter(
    (log) => log.studentId === student.id && (!student.courseId || log.courseId === student.courseId)
  );

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
    }
  }

  const totalSessions = studentLogs.length;
  const attendedCount = presentCount + lateCount;
  const countableSessions = totalSessions - excusedCount;

  let attendancePercentage = 100;
  if (totalSessions === 0) {
    attendancePercentage = 100;
  } else if (countableSessions <= 0) {
    attendancePercentage = attendedCount > 0 ? 100 : 0;
  } else {
    attendancePercentage = Math.round((attendedCount / countableSessions) * 100);
  }

  return {
    student,
    totalSessions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    attendancePercentage,
    recentAbsences,
  };
}

export function formatWhatsAppSummary(
  courseName: string,
  date: string,
  logs: AttendanceLog[]
): string {
  const targetLogs = logs.filter((log) => !date || log.date === date);

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
  const str = String(cell ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCourseAttendanceCSV(
  course: Course,
  allStudents: Student[],
  allLogs: AttendanceLog[]
): string {
  const courseStudents = allStudents.filter((s) => s.courseId === course.id);
  const courseLogs = allLogs.filter((l) => l.courseId === course.id);

  // Extract distinct dates sorted chronologically
  const dates = Array.from(new Set(courseLogs.map((l) => l.date))).sort();

  const headers = [
    "שם התלמיד",
    "אימייל",
    "סטטוס תלמיד",
    "אחוז נוכחות",
    "נוכח",
    "מאחר",
    "נעדר",
    "מוצדק",
    ...dates.map((d) => `מפגש ${d}`),
  ];

  const rows: string[][] = [headers];

  for (const student of courseStudents) {
    const stats = calculateStudentAttendanceStats(student, courseLogs);
    const row: string[] = [
      escapeCsvCell(student.name),
      escapeCsvCell(student.email || ""),
      student.active ? "פעיל" : "לא פעיל",
      `${stats.attendancePercentage}%`,
      String(stats.presentCount),
      String(stats.lateCount),
      String(stats.absentCount),
      String(stats.excusedCount),
    ];

    for (const d of dates) {
      const matchLog = courseLogs.find((l) => l.studentId === student.id && l.date === d);
      if (matchLog) {
        row.push(statusHebrewMap[matchLog.status] || matchLog.status);
      } else {
        row.push("-");
      }
    }

    rows.push(row);
  }

  // UTF-8 BOM prefix (﻿) ensures Hebrew characters render properly in Microsoft Excel
  return "﻿" + rows.map((r) => r.join(",")).join("\n");
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
