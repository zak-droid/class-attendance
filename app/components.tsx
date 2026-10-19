"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AppTab, AttendanceLog, AttendanceStatus, Course, Student } from "./types";

export const statusLabels: Record<AttendanceStatus, string> = {
  Present: "נוכח",
  Late: "מאחר",
  Absent: "נעדר",
  Excused: "מוצדק",
};

export const statusStyles: Record<AttendanceStatus, string> = {
  Present: "bg-[#DCFCE7] text-[#166534] border-[#16A34A]/20",
  Late: "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/25",
  Absent: "bg-[#FEE2E2] text-[#991B1B] border-[#DC2626]/20",
  Excused: "bg-[#DBEAFE] text-[#1E40AF] border-[#2563EB]/20",
};

const navItems: Array<{ id: AppTab; label: string }> = [
  { id: "today", label: "היום" },
  { id: "students", label: "תלמידים" },
  { id: "history", label: "היסטוריה" },
  { id: "more", label: "עוד" },
];

export function NavIcon({ tab }: { tab?: AppTab } = {}) {
  if (tab === "today") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (tab === "students") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    );
  }
  if (tab === "history") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function Layout({
  tab,
  onTabChange,
  userEmail,
  onSignOut,
  attendanceActive = false,
  title = "ניהול נוכחות",
  children,
}: {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  userEmail: string;
  onSignOut: () => void;
  attendanceActive?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const formattedDate = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div lang="he" dir="rtl" className="min-h-[100svh] bg-[#002B45] text-white">
      <header className="border-b border-white/14 bg-[#002B45] px-5 pt-5 pb-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#B8D8E6]">{formattedDate}</p>
            <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-0.5 text-xs font-medium text-[#B8D8E6]">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-10 rounded-xl border border-white/15 bg-[#005580] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#005580]/80"
          >
            התנתקות
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pt-5 pb-[calc(7.25rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {!attendanceActive && <BottomNav tab={tab} onTabChange={onTabChange} />}
    </div>
  );
}

export function BottomNav({
  tab,
  onTabChange,
}: {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
}) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/14 bg-[#002B45] pb-[calc(0.35rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 px-2">
        {navItems.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl py-2 text-xs font-extrabold transition ${
                active ? "text-[#00A6A6]" : "text-[#B8D8E6] hover:text-white"
              }`}
            >
              <NavIcon tab={item.id} />
              <span className="mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function SummaryCards({ logs }: { logs: AttendanceLog[] }) {
  const counts: Record<AttendanceStatus, number> = {
    Present: 0,
    Late: 0,
    Absent: 0,
    Excused: 0,
  };
  logs.forEach((log) => {
    counts[log.status] = (counts[log.status] ?? 0) + 1;
  });

  return (
    <div className="grid grid-cols-4 gap-2">
      {(["Present", "Late", "Absent", "Excused"] as AttendanceStatus[]).map((status) => (
        <div
          key={status}
          className="rounded-2xl border border-white/14 bg-[#005580] p-3 text-center"
        >
          <p className="text-xs font-bold text-[#B8D8E6]">{statusLabels[status]}</p>
          <p className="mt-1 text-2xl font-extrabold text-white">{counts[status]}</p>
        </div>
      ))}
    </div>
  );
}

export function CourseCard({
  course,
  studentCount,
  startedToday,
  completedToday = false,
  onStart,
  onEdit,
  onToggleActive,
  onViewStudents,
}: {
  course: Course;
  studentCount: number;
  startedToday: boolean;
  completedToday?: boolean;
  onStart: () => void;
  onEdit?: () => void;
  onToggleActive?: () => void;
  onViewStudents?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stateLabel = completedToday
    ? "הושלמה היום"
    : startedToday
    ? "בתהליך"
    : "לא התחילה היום";

  return (
    <article className="rounded-[20px] border border-white/14 bg-[#005580] p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="truncate text-lg font-extrabold">
            {course.name}
          </h3>
          <p className="mt-1 text-xs font-semibold text-[#B8D8E6]">
            {studentCount} {studentCount !== 1 ? "תלמידים" : "תלמיד אחד"}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-extrabold text-[#B8D8E6]">
          {stateLabel}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onStart}
          className="min-h-11 flex-1 rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white hover:bg-[#00B3A4]"
        >
          {completedToday ? "צפייה בסיכום" : startedToday ? "המשך נוכחות" : "התחלת נוכחות"}
        </button>
        {(onEdit || onToggleActive || onViewStudents) && (
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="min-h-11 rounded-xl border border-white/14 bg-[#002B45] px-3 text-xs font-bold text-[#B8D8E6]"
          >
            •••
          </button>
        )}
      </div>
    </article>
  );
}

export function AttendanceStudentRow({
  log,
  student,
  onOpen,
}: {
  log: AttendanceLog;
  student: Student;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/14 bg-[#005580] px-4 py-3 text-right text-white transition hover:bg-[#005580]/90"
    >
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate text-base font-bold">
          {student.name}
        </p>
        {log.notes && (
          <p className="mt-0.5 truncate text-xs font-medium text-[#B8D8E6]">
            הערה: {log.notes}
          </p>
        )}
      </div>
      <StatusBadge status={log.status} />
    </button>
  );
}

export function StudentActionBottomSheet({
  log,
  student,
  onClose,
  onStatusChange,
  onNotesChange,
}: {
  log: AttendanceLog;
  student: Student;
  onClose: () => void;
  onStatusChange: (status: AttendanceStatus) => void;
  onNotesChange: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(log.notes ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border-t border-white/14 bg-[#002B45] p-6 text-white sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/14 pb-3">
          <h3 dir="auto" className="text-lg font-extrabold">
            {student.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#B8D8E6] hover:text-white"
          >
            סגירה
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["Present", "Late", "Absent", "Excused"] as AttendanceStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(status)}
              className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-extrabold ${
                log.status === status
                  ? "border-[#00A6A6] bg-[#00A6A6] text-white"
                  : statusStyles[status]
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-bold text-[#B8D8E6]">
            הערה לתלמיד/ה
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/14 bg-white p-3 text-sm font-semibold text-[#0F172A]"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              onNotesChange(notes);
              onClose();
            }}
            className="mt-3 min-h-11 w-full rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white hover:bg-[#00B3A4]"
          >
            שמירת הערה
          </button>
        </div>
      </div>
    </div>
  );
}

export function FinishAttendanceBar({
  logs,
  onFinish,
}: {
  logs: AttendanceLog[];
  onFinish: () => void;
}) {
  const presentCount = logs.filter((l) => l.status === "Present").length;
  const lateCount = logs.filter((l) => l.status === "Late").length;
  const absentCount = logs.filter((l) => l.status === "Absent").length;
  const excusedCount = logs.filter((l) => l.status === "Excused").length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/14 bg-[#002B45]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <p className="text-xs font-bold text-[#B8D8E6]">
          נוכחים {presentCount} · מאחרים {lateCount} · נעדרים {absentCount} · מוצדקים {excusedCount}
        </p>
        <button
          type="button"
          onClick={onFinish}
          className="min-h-11 rounded-xl bg-[#00A6A6] px-5 text-sm font-extrabold text-white hover:bg-[#00B3A4]"
        >
          סיום נוכחות
        </button>
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/14 bg-white p-6 text-[#0F172A] shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="text-xs font-bold text-[#475569]">
            סגירה
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function BiometricLockScreen({
  email,
  onVerify,
  onFallbackSignOut,
}: {
  email: string;
  onVerify: () => Promise<void>;
  onFallbackSignOut: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    setVerifying(true);
    setError("");
    try {
      await onVerify();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "האימות הביומטרי בוטל או נכשל. נסו שוב."
      );
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    void handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      lang="he"
      dir="rtl"
      className="min-h-[100svh] bg-[#002B45] px-5 py-8 text-right text-white flex items-center justify-center"
    >
      <section className="w-full max-w-md rounded-[24px] border border-white/14 bg-[#005580] p-6 shadow-[0_24px_64px_rgba(0,18,27,0.35)] sm:p-8">
        <div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/14 bg-[#002B45] text-[#00A6A6]"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
          >
            <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
            <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
            <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
            <path d="M2 12a10 10 0 0 1 18-6" />
            <path d="M2 16h.01" />
            <path d="M21.8 16c.2-2 .131-5.354 0-6" />
            <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
            <path d="M8.65 22c.21-.66.45-1.32.57-2" />
            <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-white">כניסה מהירה</h1>
        <p className="mt-1.5 text-sm font-medium text-[#B8D8E6]">
          מחובר/ת כ- <span dir="ltr" className="font-bold text-white">{email}</span>
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3.5 py-2.5 text-xs font-extrabold text-[#991B1B]"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={verifying}
          onClick={() => void handleVerify()}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#00A6A6] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#00B3A4] disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
            <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
            <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
            <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
          </svg>
          <span>{verifying ? "מאמת טביעת אצבע..." : "כניסה באמצעות טביעת אצבע"}</span>
        </button>

        <div className="mt-5 border-t border-white/14 pt-4 text-center">
          <button
            type="button"
            onClick={onFallbackSignOut}
            className="min-h-11 w-full rounded-xl border border-white/14 bg-[#002B45] px-4 py-2.5 text-xs font-bold text-[#B8D8E6] transition hover:text-white"
          >
            אימות באמצעות קישור למייל / החלפת משתמש
          </button>
        </div>
      </section>
    </main>
  );
}
