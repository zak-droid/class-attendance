"use client";

import { useDialogFocus } from "./use-dialog-focus";

export { InstructorHelpHub } from "./InstructorHelpHub";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import type {
  AISyllabusAnalysis,
  AppTab,
  AttendanceLog,
  AttendanceStatus,
  Course,
  CourseTask,
  LessonLog,
  Student,
  StudentTaskSubmission,
} from "./types";
import { testGeminiApiKey, extractSyllabusFromPdfFile } from "./gemini-ai";
import {
  calculateStudentCertificateEligibility,
  getDefaultCourseTasks,
  isYearlyCourse,
  type StudentAttendanceStats,
} from "./export-utils";

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
  onOpenHelp,
  attendanceActive = false,
  title = "ניהול נוכחות",
  isOffline = false,
  pendingSyncCount = 0,
  onSyncNow,
  children,
}: {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  userEmail: string;
  onSignOut: () => void;
  onOpenHelp?: () => void;
  attendanceActive?: boolean;
  title?: string;
  isOffline?: boolean;
  pendingSyncCount?: number;
  onSyncNow?: () => void;
  children: ReactNode;
}) {
  const formattedDate = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div lang="he" dir="rtl" className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#002B45] text-white">
      <header className="border-b border-white/14 bg-[#002B45] px-4 sm:px-5 pt-4 sm:pt-5 pb-3.5 sm:pb-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-[#B8D8E6]">{formattedDate}</p>
              {isOffline && (
                <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-extrabold text-[#92400E]">
                  מצב לא מקוון
                </span>
              )}
              {!isOffline && pendingSyncCount > 0 && onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  className="rounded-full border border-[#00A6A6]/40 bg-[#00A6A6]/20 px-2.5 py-0.5 text-[11px] font-extrabold text-[#00E5E5] transition hover:bg-[#00A6A6]/30"
                >
                  סנכרון ({pendingSyncCount})
                </button>
              )}
            </div>
            <h1 className="truncate text-xl sm:text-2xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-0.5 truncate text-xs font-medium text-[#B8D8E6]" dir="ltr">{userEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenHelp && (
              <button
                type="button"
                onClick={onOpenHelp}
                title="מרכז עזרה, שו״ת ומשוב מנחים"
                className="shrink-0 flex items-center gap-1.5 min-h-10 rounded-xl border border-[#00A6A6]/40 bg-[#00A6A6]/20 px-3 py-1.5 text-xs font-extrabold text-[#00E5E5] hover:bg-[#00A6A6]/30 transition"
              >
                <span>💡</span>
                <span>עזרה</span>
              </button>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="shrink-0 min-h-10 rounded-xl border border-white/15 bg-[#005580] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#005580]/80"
            >
              התנתקות
            </button>
          </div>
        </div>
      </header>

      <main style={attendanceActive ? {paddingBottom:"calc(var(--attendance-footer-height, 14rem) + 1rem)"} : undefined} className="mx-auto w-full max-w-4xl px-4 sm:px-5 pt-4 sm:pt-5 pb-[calc(7.25rem+env(safe-area-inset-bottom))]">
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
    Present: logs.filter((l) => l.status === "Present").length,
    Late: logs.filter((l) => l.status === "Late").length,
    Absent: logs.filter((l) => l.status === "Absent").length,
    Excused: logs.filter((l) => l.status === "Excused").length,
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {(["Present", "Late", "Absent", "Excused"] as AttendanceStatus[]).map((status) => (
        <div
          key={status}
          className="rounded-2xl border border-white/14 bg-[#005580] p-3 text-right"
        >
          <span className="text-xs font-semibold text-[#B8D8E6]">{statusLabels[status]}</span>
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
  startLabel,
  onStart,
  onEdit,
  onToggleActive,
  onViewStudents,
  onExportCSV,
  onViewTasks,
  onViewAIAnalysis,
  onEditSyllabus,
}: {
  course: Course;
  studentCount: number;
  startedToday: boolean;
  completedToday?: boolean;
  startLabel?: string;
  onStart: () => void;
  onEdit?: () => void;
  onToggleActive?: () => void;
  onViewStudents?: () => void;
  onExportCSV?: () => void;
  onViewTasks?: () => void;
  onViewAIAnalysis?: () => void;
  onEditSyllabus?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stateLabel = !course.active ? "בארכיון" : startLabel ? (course.schedule ? `${course.schedule.meetings.filter(m => m.status === 'scheduled').length} ימי מפגש` : 'ללא לוח מפגשים') : completedToday
    ? "הושלמה היום"
    : startedToday
    ? "בתהליך"
    : "לא התחילה היום";

  return (
    <article className="rounded-[20px] border border-white/14 bg-[#005580] p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="break-words text-lg font-extrabold">
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
          {startLabel ?? (completedToday ? "עריכת נוכחות להיום" : startedToday ? "המשך נוכחות" : "התחלת נוכחות")}
        </button>
        {(onEdit || onToggleActive || onViewStudents || onExportCSV || onViewTasks || onViewAIAnalysis || onEditSyllabus) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="min-h-11 rounded-xl border border-white/14 bg-[#002B45] px-3 text-xs font-bold text-[#B8D8E6]"
            >
              •••
            </button>
            {menuOpen && (
              <div className="absolute left-0 bottom-full mb-1 z-30 min-w-48 rounded-xl border border-white/14 bg-[#002B45] p-1.5 shadow-2xl">
                {onViewAIAnalysis && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onViewAIAnalysis();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-right text-xs font-bold text-[#38BDF8] hover:bg-[#005580]"
                  >
                    ✨ בדיקת סילבוס (AI)
                  </button>
                )}
                {onViewTasks && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onViewTasks();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-right text-xs font-bold text-[#00E5E5] hover:bg-[#005580]"
                  >
                    📋 מעקב חובות וזכאות לתעודה
                  </button>
                )}
                {onEditSyllabus && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEditSyllabus();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-right text-xs font-bold text-white hover:bg-[#005580]"
                  >
                    📚 סילבוס הקורס
                  </button>
                )}
                {onViewStudents && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onViewStudents();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-right text-xs font-bold text-white hover:bg-[#005580]"
                  >
                    צפייה בתלמידים
                  </button>
                )}
                {onExportCSV && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onExportCSV();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-right text-xs font-bold text-[#00E5E5] hover:bg-[#005580]"
                  >
                    📊 ייצוא ל-Excel (CSV)
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-right text-xs font-bold text-white hover:bg-[#005580]"
                  >
                    עריכת כיתה
                  </button>
                )}
                {onToggleActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleActive();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-right text-xs font-bold text-[#F87171] hover:bg-[#005580]"
                  >
                    {course.active ? "העברה לארכיון" : "שחזור כיתה"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function AttendanceStudentRow({ log, student, onOpen, onViewCard, onStatusChange }: {
  log?: AttendanceLog;
  student: Student;
  onOpen: () => void;
  onViewCard?: () => void;
  onStatusChange?: (status: AttendanceStatus) => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <div data-testid="attendance-row" data-student-id={student.id} className="rounded-xl border border-white/20 bg-[#005580] p-2 text-white">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <p dir="auto" className="min-w-0 flex-1 break-words text-right text-base font-bold leading-6">{student.name}</p>
      <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-1 sm:w-72 sm:shrink-0">
      <label className="min-w-0 text-xs font-bold"><span className="sr-only">נוכחות</span>
        <select disabled={saving || !onStatusChange} value={log?.status ?? ''} aria-label={`${log ? 'סימון נוכחות עבור' : 'נוכחות חדשה עבור'} ${student.name}`} className={`min-h-11 w-full min-w-0 rounded-lg border px-1 text-sm font-bold ${log ? statusStyles[log.status] : 'border-slate-400 bg-slate-100 text-slate-900'}`} onChange={async e => {
          const status = e.target.value as AttendanceStatus;
          setSaving(true); setError('');
          try { await onStatusChange?.(status); }
          catch(e) { setError(e instanceof Error ? e.message : 'השמירה נכשלה. נסו שוב.'); }
          finally { setSaving(false); }
        }}>
          <option value="" disabled>טרם סומן</option>
          <option value="Present">נוכח</option><option value="Late">מאחר</option><option value="Absent">נעדר</option><option value="Excused">מוצדק</option>
        </select>
      </label>
      {onViewCard && <button type="button" onClick={onViewCard} aria-label={`כרטיס תלמיד עבור ${student.name}`} title="היסטוריה ופרטי תלמיד" className="min-h-11 min-w-11 rounded-lg border border-white/30 px-1 text-sm font-bold">היסטוריה</button>}
      <button type="button" onClick={onOpen} disabled={!log || saving} aria-label={`הוספת הערה עבור ${student.name}`} title={log?.notes ? 'עריכת הערה' : log ? 'הוספת הערה' : 'בחרו נוכחות כדי להוסיף הערה'} className="min-h-11 min-w-11 rounded-lg border border-white/30 px-1 text-sm font-bold disabled:opacity-60">הערה</button>
      </div>
    </div>
    {saving && <span role="status" className="text-xs">שומר…</span>}
    {log?.notes && <p className="mt-1 break-words text-sm text-[#FDE047]">הערה: {log.notes}</p>}
    {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-900">{error}</p>}
  </div>;
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
  onClose: () => void | Promise<void>;
  onStatusChange: (status: AttendanceStatus) => void | Promise<void>;
  onNotesChange: (notes: string) => void | Promise<void>;
}) {
  const dialogRef = useDialogFocus(onClose);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(log.notes ?? "");

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`נוכחות והערה — ${student.name}`} tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 left-0 right-0 top-0 bottom-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto rounded-t-[28px] border-t border-white/14 bg-[#002B45] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-white max-h-[92svh] overflow-y-auto sm:rounded-3xl sm:border sm:p-6"
      >
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
              disabled={saving}
              onClick={async () => { setSaving(true); setSaveError(""); try { await onStatusChange(status); } catch(error) { setSaveError(error instanceof Error ? error.message : "השמירה נכשלה"); } finally { setSaving(false); } }}
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
          {saveError && <p role="alert">השמירה נכשלה: {saveError}</p>}
          <SaveAction action={async () => { await onNotesChange(notes); await onClose(); }}>שמירת הערה</SaveAction>
        </div>
      </div>
    </div>
  );
}

export function StudentQuickCardModal({
  stats,
  courseName,
  isYearly = false,
  tasks = [],
  submissions = [],
  onToggleTask,
  onClose,
  onViewHistory,
}: {
  stats: StudentAttendanceStats;
  courseName?: string;
  isYearly?: boolean;
  tasks?: CourseTask[];
  submissions?: StudentTaskSubmission[];
  onToggleTask?: (taskId: string, completed: boolean) => void;
  onClose: () => void;
  onViewHistory?: () => void;
}) {
  const dialogRef = useDialogFocus(onClose);
  const {
    student,
    totalSessions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    attendancePercentage,
    history,
  } = stats;

  const rateColor =
    attendancePercentage >= 80
      ? "bg-[#DCFCE7] text-[#166534] border-[#16A34A]/30"
      : attendancePercentage >= 70
      ? "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/30"
      : "bg-[#FEE2E2] text-[#991B1B] border-[#DC2626]/30";

  const courseTasks = tasks.length > 0 ? tasks : getDefaultCourseTasks(student.courseId, courseName);
  const relevantTasks = courseTasks.filter((t) => !t.yearlyOnly || isYearly);

  return (
    <div
      ref={dialogRef} tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`כרטיס תלמיד עבור ${student.name}`}
      onClick={onClose}
      className="fixed inset-0 left-0 right-0 top-0 bottom-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto rounded-t-[28px] border-t border-white/15 bg-[#002B45] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-white shadow-2xl max-h-[92svh] overflow-y-auto sm:rounded-3xl sm:border sm:p-6"
      >
        <div className="flex items-start justify-between border-b border-white/14 pb-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#00A6A6]">
              כרטיס תלמיד/ה
            </span>
            <h2 dir="auto" className="break-words text-xl font-extrabold text-white">
              {student.name}
            </h2>
            {courseName && <p className="break-words text-xs text-[#B8D8E6]">{courseName}</p>}
            {student.email && (
              <p className="truncate text-xs text-[#94A3B8]" dir="ltr">
                {student.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-[#B8D8E6] transition hover:bg-white/20 hover:text-white"
          >
            ✕ סגור
          </button>
        </div>

        {onViewHistory && <button type="button" onClick={onViewHistory} className="mt-4 min-h-12 w-full rounded-xl bg-[#00A6A6] px-3 font-bold text-[#002B45]">כל הנוכחות ותיקון דיווחים</button>}

        {/* Attendance rate highlight with Rotem's 80% threshold */}
        <div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#003859] p-3.5 sm:p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#B8D8E6]">אחוז נוכחות מצטבר בקורס</p>
            <p className="text-[11px] text-slate-400">
              {totalSessions} מפגשים נרשמו עד כה (רף תעודה: 80%)
            </p>
          </div>
          <div className={`shrink-0 rounded-xl border px-3.5 py-1.5 text-center font-extrabold ${rateColor}`}>
            <span className="text-xl">{totalSessions ? `${attendancePercentage}%` : 'אין נתונים'}</span>
          </div>
        </div>

        {/* Certificate Eligibility Banner (Rotem's requirement) */}
        <p className="mt-2 text-xs text-[#B8D8E6]">האחוז מחושב מדיווחים עד היום; מפגשים מבוטלים אינם נספרים. דיווחים עתידיים נשמרים בהיסטוריה.</p>
        <div className="mt-2.5">
          {totalSessions === 0 ? <p className="text-sm">טרם נרשמה נוכחות. לא ניתן לקבוע זכאות.</p> : attendancePercentage >= 80 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#16A34A]/30 bg-[#DCFCE7]/15 p-2.5 text-xs font-bold text-[#86EFAC]">
              <span>✅</span>
              <span>עומד/ת ברף הנוכחות לקבלת תעודה (80% ומעלה)</span>
            </div>
          ) : attendancePercentage >= 70 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#FEF3C7]/15 p-2.5 text-xs font-bold text-[#FDE047]">
              <span>⚠️</span>
              <span>התראת סיכון: {attendancePercentage}% נוכחות (רף המינימום לתעודה הוא 80%)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2]/15 p-2.5 text-xs font-bold text-[#FCA5A5]">
              <span>❌</span>
              <span>מתחת לרף הזכאות לתעודה ({attendancePercentage}% מתוך 80% הנדרשים)</span>
            </div>
          )}
        </div>

        {/* 4-Stat breakdown (Late = full presence 1.0, Excused = absence) */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center sm:gap-2">
          <div className="rounded-xl border border-white/10 bg-[#005580] p-2">
            <p className="text-[10px] font-bold text-[#B8D8E6]">נוכח</p>
            <p className="text-base font-black text-[#86EFAC] sm:text-lg">{presentCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#005580] p-2">
            <p className="text-[10px] font-bold text-[#B8D8E6]">מאחר (מלא)</p>
            <p className="text-base font-black text-[#FDE047] sm:text-lg">{lateCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#005580] p-2">
            <p className="text-[10px] font-bold text-[#B8D8E6]">נעדר</p>
            <p className="text-base font-black text-[#FCA5A5] sm:text-lg">{absentCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#005580] p-2">
            <p className="text-[10px] font-bold text-[#B8D8E6]">מוצדק</p>
            <p className="text-base font-black text-[#93C5FD] sm:text-lg">{excusedCount}</p>
          </div>
        </div>

        {/* Course Obligations & Mandatory Assignments */}
        <div className="mt-3.5 rounded-2xl border border-white/10 bg-[#003859] p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-bold text-[#00E5E5] flex items-center gap-1.5">
              <span>📋</span>
              <span>חובות הקורס לתעודה:</span>
            </p>
            <span className="text-[11px] text-slate-300">
              {relevantTasks.filter((t) => submissions.some((s) => s.studentId === student.id && s.taskId === t.id && s.completed)).length}/{relevantTasks.length} הושלמו
            </span>
          </div>

          <div className="space-y-2">
            {relevantTasks.map((task) => {
              const sub = submissions.find(
                (s) => s.studentId === student.id && s.taskId === task.id
              );
              const isDone = sub?.completed ?? false;

              return (
                <button type="button" aria-pressed={isDone}
                  key={task.id}
                  onClick={() => onToggleTask && onToggleTask(task.id, !isDone)}
                  className={`flex min-h-11 w-full items-center justify-between gap-2.5 rounded-xl border p-2.5 text-right transition cursor-pointer ${
                    isDone
                      ? "border-[#16A34A]/40 bg-[#16A34A]/15 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-base">{isDone ? "✅" : "⬜"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-white">{task.title}</p>
                      {task.yearlyOnly && (
                        <span className="text-[10px] text-[#38BDF8]">קורס שנתי בלבד</span>
                      )}
                      {sub?.notes && (
                        <p className="text-[11px] text-[#B8D8E6] truncate">הערה: {sub.notes}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
                      isDone ? "bg-[#16A34A] text-white" : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {isDone ? "בוצע" : "טרם הוגש"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent absences / logs */}
        <div className="mt-3.5">
          <p className="mb-2 text-xs font-bold text-[#B8D8E6]">כל המפגשים בקורס:</p>
          {history.length === 0 ? (
            <p className="rounded-xl bg-white/5 p-3 text-xs text-[#86EFAC]">
              טרם נרשמה נוכחות לתלמיד/ה בקורס זה
            </p>
          ) : (
            <div className="max-h-36 space-y-1.5 overflow-y-auto">
              {history.map((ab, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs">
                  <span className="shrink-0 font-bold text-slate-200">מפגש {ab.date}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    {ab.notes && (
                      <span className="max-w-28 truncate text-[11px] text-[#B8D8E6] sm:max-w-36">
                        {ab.notes}
                      </span>
                    )}
                    <StatusBadge status={ab.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-12 w-full rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white transition hover:bg-[#00B3A4]"
        >
          סיום צפייה
        </button>
      </div>
    </div>
  );
}

export function CourseTasksMatrixView({
  course,
  students,
  attendanceLogs,
  submissions,
  customTasks = [],
  onToggleSubmission,
  onEditSubmissionNote,
  onAddCustomTask,
  onViewStudentCard,
  onBack,
}: {
  course: Course;
  students: Student[];
  attendanceLogs: AttendanceLog[];
  submissions: StudentTaskSubmission[];
  customTasks?: CourseTask[];
  onToggleSubmission: (studentId: string, taskId: string, completed: boolean) => void;
  onEditSubmissionNote?: (studentId: string, taskId: string) => void;
  onAddCustomTask?: (title: string) => void | Promise<void>;
  onViewStudentCard: (student: Student) => void;
  onBack: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const yearly = isYearlyCourse(course.name, course.description);
  const defaultTasks = getDefaultCourseTasks(course.id, course.name);
  const courseCustom = customTasks.filter((t) => t.courseId === course.id);
  const allTasks = [...defaultTasks, ...courseCustom];
  const activeTasks = allTasks.filter((t) => !t.yearlyOnly || yearly);

  const courseStudents = students
    .filter((s) => s.courseId === course.id)
    .filter((s) => !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Stats calculation
  let eligibleCount = 0;
  let atRiskCount = 0;
  let notEligibleCount = 0;

  for (const s of courseStudents) {
    const cert = calculateStudentCertificateEligibility(
      s,
      course,
      attendanceLogs,
      submissions,
      customTasks
    );
    if (cert.isFullyEligibleForCertificate) eligibleCount += 1;
    else if (cert.attendancePercentage >= 70) atRiskCount += 1;
    else notEligibleCount += 1;
  }

  const [taskSaveError, setTaskSaveError] = useState('');
  const [taskSaving, setTaskSaving] = useState(false);
  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !onAddCustomTask) return;
    if (taskSaving) return;
    setTaskSaving(true); setTaskSaveError('');
    try { await onAddCustomTask(newTaskTitle.trim()); setNewTaskTitle(''); setShowAddForm(false); }
    catch(error) { setTaskSaveError(error instanceof Error ? error.message : 'שמירת המטלה נכשלה'); }
    finally { setTaskSaving(false); }
  };

  return (
    <div className="space-y-4 text-right text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-bold text-[#B8D8E6] hover:text-white mb-1 flex items-center gap-1"
          >
            <span>→</span>
            <span>חזרה לתפריט ניהול</span>
          </button>
          <h2 className="text-xl font-extrabold text-white">מעקב חובות וזכאות לתעודה</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-[#00E5E5]">{course.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                yearly
                  ? "bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {yearly ? "קורס שנתי (חובת פרקטיקום)" : "קורס סמסטריאלי"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((p) => !p)}
          className="rounded-xl border border-[#00A6A6]/40 bg-[#00A6A6]/20 px-3 py-1.5 text-xs font-extrabold text-[#00E5E5] hover:bg-[#00A6A6]/30 transition"
        >
          {showAddForm ? "סגירת הוספה" : "+ הוספת מטלה"}
        </button>
      </div>

      {/* Add Custom Task Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="rounded-2xl border border-white/14 bg-[#003859] p-4 space-y-3">
          {taskSaveError && <p role="alert">{taskSaveError}</p>}
          <p className="text-xs font-extrabold text-[#00E5E5]">הוספת מטלת חובה חדשה לקורס:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="שם המטלה (למשל: הגשת דוח רפלקציה / פרויקט גמר)..."
              className="flex-1 rounded-xl border border-white/14 bg-[#002B45] px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#00A6A6]"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#00A6A6] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#00B3A4] transition"
            >
              הוספה
            </button>
          </div>
        </form>
      )}

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-[#16A34A]/30 bg-[#16A34A]/15 p-3">
          <p className="text-xl font-extrabold text-[#86EFAC]">{eligibleCount}</p>
          <p className="text-[11px] font-bold text-slate-300">זכאים לתעודה</p>
        </div>
        <div className="rounded-2xl border border-[#F59E0B]/30 bg-[#FEF3C7]/15 p-3">
          <p className="text-xl font-extrabold text-[#FDE047]">{atRiskCount}</p>
          <p className="text-[11px] font-bold text-slate-300">בסיכון / חסרות מטלות</p>
        </div>
        <div className="rounded-2xl border border-[#DC2626]/30 bg-[#FEE2E2]/15 p-3">
          <p className="text-xl font-extrabold text-[#FCA5A5]">{notEligibleCount}</p>
          <p className="text-[11px] font-bold text-slate-300">מתחת לרף / ללא נתונים</p>
        </div>
      </div>

      {/* Search Bar */}
      <div>
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="חיפוש תלמיד/ה בכיתה..."
          className="w-full rounded-xl border border-white/14 bg-[#005580] px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#00A6A6]"
        />
      </div>

      {/* Interactive Matrix / Cards View */}
      <div className="space-y-3">
        {courseStudents.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs text-slate-400">
            לא נמצאו תלמידים רשומים בקורס זה.
          </p>
        ) : (
          courseStudents.map((student) => {
            const cert = calculateStudentCertificateEligibility(
              student,
              course,
              attendanceLogs,
              submissions,
              customTasks
            );

            return (
              <div
                key={student.id}
                className="rounded-2xl border border-white/14 bg-[#005580] p-4 space-y-3"
              >
                {/* Student header row */}
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onViewStudentCard(student)}
                      aria-label="כרטיס תלמיד"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-[#B8D8E6] hover:bg-[#00A6A6] hover:text-white transition"
                    >
                      ℹ️
                    </button>
                    <span className="min-w-0 break-words font-extrabold text-sm text-white">{student.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-lg px-2 py-0.5 text-xs font-black ${
                        cert.attendancePercentage >= 80
                          ? "bg-[#DCFCE7] text-[#166534]"
                          : cert.attendancePercentage >= 70
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#FEE2E2] text-[#991B1B]"
                      }`}
                    >
                      {cert.hasAttendanceData ? `${cert.attendancePercentage}% נוכחות` : 'אין נתוני נוכחות'}
                    </span>
                    <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-extrabold ${cert.statusBadgeClass}`}>
                      {cert.isFullyEligibleForCertificate ? "זכאי/ת לתעודה ✓" : "טרם הושלם"}
                    </span>
                  </div>
                </div>

                {/* Checkbox columns for all required tasks */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {activeTasks.map((task) => {
                    const sub = submissions.find(
                      (s) => s.studentId === student.id && s.taskId === task.id
                    );
                    const isDone = sub?.completed ?? false;

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-2 transition ${
                          isDone
                            ? "border-[#16A34A]/40 bg-[#16A34A]/20"
                            : "border-white/10 bg-[#002B45]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleSubmission(student.id, task.id, !isDone)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-right focus:outline-none"
                        >
                          <span className="text-base shrink-0">{isDone ? "✅" : "⬜"}</span>
                          <span className="text-xs font-bold truncate text-white">{task.title}</span>
                        </button>
                        {onEditSubmissionNote && (
                          <button
                            type="button"
                            onClick={() => onEditSubmissionNote(student.id, task.id)}
                            title="הוספת הערה או שינוי תאריך"
                            className="p-1 text-xs text-[#B8D8E6] hover:text-white rounded"
                          >
                            📝
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function TaskNoteModal({
  studentName,
  taskTitle,
  initialNote = "",
  initialDate = "",
  onSave,
  onClose,
}: {
  studentName: string;
  taskTitle: string;
  initialNote?: string;
  initialDate?: string;
  onSave: (note: string, date: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 left-0 right-0 top-0 bottom-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto rounded-t-[28px] border-t border-white/14 bg-[#002B45] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-white max-h-[92svh] overflow-y-auto sm:rounded-3xl sm:border sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-white/14 pb-3">
          <div>
            <h3 className="text-base font-extrabold">{studentName}</h3>
            <p className="text-xs text-[#00E5E5]">{taskTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#B8D8E6] hover:text-white"
          >
            סגירה
          </button>
        </div>

        <div className="mt-4 space-y-3 text-right">
          <label className="block text-xs font-bold text-[#B8D8E6]">
            תאריך ביצוע / הגשה
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-white/14 bg-[#005580] px-3.5 text-xs text-white focus:outline-none focus:border-[#00A6A6]"
            />
          </label>

          <label className="block text-xs font-bold text-[#B8D8E6]">
            הערה / משוב מהמנחה
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="כתוב כאן משוב או הערה לתלמיד/ה..."
              className="mt-1.5 w-full rounded-xl border border-white/14 bg-white p-3 text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#00A6A6]"
            />
          </label>

          <SaveAction action={() => onSave(note, date)}>שמירת פרטי מטלה</SaveAction>
        </div>
      </div>
    </div>
  );
}

export function FinishAttendanceBar({
  logs,
  onFinish,
  onShareWhatsApp,
  remaining = 0,
  meetingLabel,
}: {
  logs: AttendanceLog[];
  remaining?: number;
  meetingLabel?: string;
  onFinish: () => void | Promise<void>;
  onShareWhatsApp?: () => void;
}) {
  const footerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--attendance-footer-height', `${el.getBoundingClientRect().height}px`));
    observer.observe(el);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--attendance-footer-height'); };
  }, []);
  const [finishing, setFinishing] = useState(false);
  const presentCount = logs.filter((l) => l.status === "Present").length;
  const lateCount = logs.filter((l) => l.status === "Late").length;
  const absentCount = logs.filter((l) => l.status === "Absent").length;
  const excusedCount = logs.filter((l) => l.status === "Excused").length;

  return (
    <div ref={footerRef} data-testid="attendance-footer" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/14 bg-[#002B45]/95 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        {meetingLabel && <p className="text-sm font-bold">{meetingLabel}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-bold text-[#B8D8E6] text-center sm:text-right">
          נותרו לסימון {remaining} · נוכחים {presentCount} · מאחרים {lateCount} · נעדרים {absentCount} · מוצדקים {excusedCount}
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onShareWhatsApp && (
            <button
              type="button"
              onClick={onShareWhatsApp}
              className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 text-xs font-extrabold text-[#002B45] transition hover:bg-[#20BD5A]"
              title="שיתוף סיכום נוכחות לווטסאפ"
            >
              <span>💬</span>
              <span>וואטסאפ</span>
            </button>
          )}
          <button
            type="button"
            disabled={finishing}
            onClick={async () => { if (finishing) return; setFinishing(true); try { await onFinish(); } finally { setFinishing(false); } }}
            className="min-h-11 flex-1 sm:flex-initial rounded-xl bg-[#00A6A6] px-5 text-sm font-extrabold text-white transition hover:bg-[#00B3A4]"
          >
            {finishing ? "שומר סיום מפגש..." : "סיום נוכחות"}
          </button>
        </div>
        </div>
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
  const dialogRef = useDialogFocus(onClose);
  return (
    <div
      ref={dialogRef} tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 left-0 right-0 top-0 bottom-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto rounded-t-[28px] border-t border-slate-200 bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[#0F172A] shadow-2xl max-h-[92svh] overflow-y-auto sm:rounded-3xl sm:border sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-xs font-bold text-[#475569] hover:text-[#0F172A]"
          >
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


export function CourseSyllabusModal({
  course,
  onClose,
  onSave,
  onSchedule,
}: {
  course: Course;
  onSchedule?: () => void;
  onClose: () => void;
  onSave: (syllabusText: string) => void | Promise<void>;
}) {
  const [syllabus, setSyllabus] = useState(course.syllabus || "");
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatusMessage(null);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      try {
        const res = await extractSyllabusFromPdfFile(file);
        if (res.success && res.text) {
          setSyllabus(res.text);
          setStatusMessage({ type: "ok", text: res.message || "קובץ ה-PDF פוענח בהצלחה!" });
        } else {
          setStatusMessage({
            type: "error",
            text: res.message || "לא זוהה טקסט בקובץ ה-PDF. ניתן להדביק את ראשי הפרקים ידנית.",
          });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "שגיאה בפענוח קובץ ה-PDF.",
        });
      } finally {
        setUploading(false);
        event.target.value = "";
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result || "");
        if (text.trim()) {
          setSyllabus(text.trim());
          setStatusMessage({ type: "ok", text: "הקובץ נטען בהצלחה!" });
        }
        setUploading(false);
      };
      reader.onerror = () => {
        setStatusMessage({ type: "error", text: "שגיאה בקריאת הקובץ." });
        setUploading(false);
      };
      reader.readAsText(file);
      event.target.value = "";
    }
  };

  const loadExample = () => {
    setStatusMessage(null);
    setSyllabus(`1. פתיחה, חוזה קבוצתי והגדרת מטרות אישיות וקבוצתיות
2. שלבי התפתחות קבוצה ומודל טאקמן
3. מיומנויות הקשבה פעילה ושיקוף בהנחיה
4. דינמיקה קבוצתית וזיהוי תפקידים גלויים וסמויים בקבוצה
5. התמודדות עם התנגדויות, קונפליקטים ומשתתפים מאתגרים
6. משוב עמיתים וסגנונות תקשורת בין-אישית
7. עמידה מול קהל, שפת גוף ונוכחות מנחה
8. שילוב מתודולוגיות חווייתיות, קלפים וסימולציות
9. פרקטיקום: סדנת הנחיית עמיתים בזמן אמת וניתוח אירועים
10. סיכום תהליך, פרידה וטקס סיום והענקת תעודות`);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-white/14 bg-[#002B45] p-5 text-white max-h-[92svh] overflow-y-auto sm:p-6 shadow-2xl text-right"
      >
        <div className="flex items-center justify-between border-b border-white/14 pb-3">
          <div>
            <h3 className="text-lg font-extrabold">סילבוס קורס: {course.name}</h3>
            <p className="text-xs text-[#B8D8E6]">הגדרת ראשי הפרקים עבור מודול בקרת ה-AI</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#B8D8E6] hover:text-white"
          >
            סגירה
          </button>
        </div>

        <div className="mt-4 space-y-3">
      {onSchedule && <button type="button" onClick={onSchedule} className="mb-4 min-h-11 w-full rounded-xl bg-[#006F78] p-3 font-bold text-white">לוח מפגשים — חילוץ תאריכים מהסילבוס</button>}
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-bold text-[#B8D8E6]">
              ראשי פרקים / רשימת נושאים:
            </label>
            <div className="flex items-center gap-2">
              <label
                className={`cursor-pointer rounded-lg border border-white/14 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-[#38BDF8] hover:bg-white/10 transition flex items-center gap-1.5 ${
                  uploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                <span>{uploading ? "⏳ מפענח PDF..." : "📁 העלאת קובץ (PDF/טקסט)"}</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.text,application/pdf,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={loadExample}
                disabled={uploading}
                className="rounded-lg border border-white/14 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-[#00E5E5] hover:bg-white/10 transition disabled:opacity-60"
              >
                טעינת דוגמה
              </button>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs font-semibold ${
                statusMessage.type === "ok"
                  ? "bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30"
                  : "bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          <textarea
            rows={10}
            dir="auto"
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
            placeholder={`הדביקו כאן את נושאי הסילבוס, למשל:\n1. פתיחה וחוזה קבוצתי\n2. שלבי התפתחות קבוצה\n3. משוב עמיתים\n4. עמידה מול קהל\n5. פרקטיקום`}
            className="w-full rounded-xl border border-white/20 bg-[#001D30] p-3.5 text-xs sm:text-sm font-mono text-white placeholder:text-slate-400 focus:border-[#00A6A6] focus:outline-none"
          />

          <p className="text-[11px] text-[#B8D8E6] leading-relaxed">
            💡 <strong>טיפ:</strong> מודול ה-AI מצליב אוטומטית בין שורות הסילבוס לבין נושאי השיעורים שהמנחים רושמים בסיום כל מפגש, ומחשב את אחוז הכיסוי.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/14 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
            >
              ביטול
            </button>
            <SaveAction action={async () => { await onSave(syllabus.trim()); onClose(); }}>שמירת סילבוס</SaveAction>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LessonTopicModal({
  course,
  date,
  existingLog,
  currentUserEmail,
  onClose,
  onSave,
}: {
  course: Course;
  date: string;
  existingLog?: LessonLog;
  currentUserEmail?: string;
  onClose: () => void;
  onSave: (topic: string, summary?: string) => void | Promise<void>;
}) {
  const [topic, setTopic] = useState(existingLog?.topic || "");
  const [summary, setSummary] = useState(existingLog?.summary || "");
  const dialogRef = useDialogFocus(onClose);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="תיעוד נושא השיעור" tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/14 bg-[#002B45] p-5 text-white max-h-[92svh] overflow-y-auto sm:p-6 shadow-2xl text-right"
      >
        <div className="flex items-center justify-between border-b border-white/14 pb-3">
          <div>
            <h3 className="text-lg font-extrabold">תיעוד נושא השיעור</h3>
            <p className="text-xs text-[#B8D8E6]">
              {course.name} • מפגש {date}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#B8D8E6] hover:text-white"
          >
            סגירה
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div>
            <label htmlFor="lesson-topic" className="block text-xs font-bold text-white mb-1.5">
              מה לימדנו במפגש זה? (נושא / ראשי פרקים):
            </label>
            <input
              id="lesson-topic"
              type="text"
              dir="auto"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="למשל: משוב עמיתים וסגנונות תקשורת"
              className="w-full rounded-xl border border-white/20 bg-[#001D30] px-3.5 py-2.5 text-sm font-semibold text-white placeholder:text-slate-400 focus:border-[#00A6A6] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="lesson-summary" className="block text-xs font-bold text-[#B8D8E6] mb-1.5">
              תקציר נוסף / הערות פדגוגיות (אופציונלי):
            </label>
            <textarea
              id="lesson-summary"
              rows={3}
              dir="auto"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="פרטים נוספים, תרגילים שבוצעו או משימות לשבוע הבא..."
              className="w-full rounded-xl border border-white/20 bg-[#001D30] p-3 text-xs sm:text-sm font-medium text-white placeholder:text-slate-400 focus:border-[#00A6A6] focus:outline-none"
            />
          </div>

          {currentUserEmail && (
            <p className="text-[11px] text-slate-400">
              מנחה מתעד: <span dir="ltr" className="text-slate-300 font-mono">{currentUserEmail}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/14 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
            >
              ביטול
            </button>
            <SaveAction action={async () => { await onSave(topic.trim(), summary.trim() || undefined); onClose(); }} disabled={!topic.trim()}>שמירת שיעור</SaveAction>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AISyllabusAnalysisModal({
  course,
  lessons,
  analysis,
  loading,
  hasGeminiKey,
  onReanalyze,
  onEditSyllabus,
  onOpenGeminiSettings,
  onClose,
}: {
  course: Course;
  lessons: LessonLog[];
  analysis: AISyllabusAnalysis | null;
  loading: boolean;
  hasGeminiKey: boolean;
  onReanalyze: () => void;
  onEditSyllabus: () => void;
  onOpenGeminiSettings: () => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "topics">("summary");
  const courseLessons = lessons.filter((l) => l.courseId === course.id);
  const hasSyllabus = Boolean(course.syllabus && course.syllabus.trim());

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-white/14 bg-[#002B45] p-5 text-white max-h-[92svh] overflow-y-auto sm:p-6 shadow-2xl text-right"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/14 pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h3 className="text-lg sm:text-xl font-extrabold truncate">
                בקרת סילבוס מבוססת AI — {course.name}
              </h3>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                  analysis?.usedGeminiAI
                    ? "border-[#16A34A]/30 bg-[#16A34A]/20 text-[#86EFAC]"
                    : "border-[#38BDF8]/30 bg-[#38BDF8]/15 text-[#7DD3FC]"
                }`}
              >
                {analysis?.usedGeminiAI ? "✓ מחובר לגוגל ג'מיני 1.5 Flash" : "ניתוח מובנה מקומי"}
              </span>
              <span className="text-[11px] text-[#B8D8E6]">
                {courseLessons.length} {courseLessons.length === 1 ? "שיעור תועד" : "שיעורים תועדו"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#B8D8E6] hover:text-white"
          >
            סגירה
          </button>
        </div>

        {/* Content */}
        {!hasSyllabus ? (
          <div className="mt-6 text-center py-8 space-y-4 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6">
            <span className="text-3xl">📚</span>
            <h4 className="text-base font-extrabold text-white">טרם הוגדר סילבוס לקורס זה</h4>
            <p className="text-xs text-[#B8D8E6] max-w-sm mx-auto leading-relaxed">
              כדי שה-AI יוכל לבדוק אחוזי כיסוי, למנוע חזרתיות ולהמליץ על המפגש הבא, אנא הזינו את ראשי הפרקים של הקורס.
            </p>
            <button
              type="button"
              onClick={onEditSyllabus}
              className="rounded-xl bg-[#00A6A6] px-5 py-2.5 text-xs font-extrabold text-white hover:bg-[#00B3A4] shadow-md shadow-[#00A6A6]/20 transition"
            >
              הזנת סילבוס עכשיו
            </button>
          </div>
        ) : loading ? (
          <div className="mt-8 text-center py-12 space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#00A6A6] border-r-transparent"></div>
            <p className="text-sm font-extrabold text-white">מנתח סילבוס ומפגשים בעזרת AI...</p>
            <p className="text-xs text-[#B8D8E6]">מצליב נושאים, בודק חזרתיות ומנסח המלצות</p>
          </div>
        ) : analysis ? (
          <div className="mt-4 space-y-4">
            {/* Coverage Card */}
            <div className="rounded-2xl border border-white/14 bg-[#003859] p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#00E5E5]">
                    מד כיסוי סילבוס כללי
                  </span>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {analysis.coveredTopics.length} מתוך {analysis.coveredTopics.length + analysis.pendingTopics.length} נושאי סילבוס כוסו
                  </p>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {analysis.coveragePercent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-3 w-full rounded-full bg-[#001D30] overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    analysis.coveragePercent >= 80
                      ? "bg-gradient-to-r from-[#10B981] to-[#059669]"
                      : analysis.coveragePercent >= 50
                      ? "bg-gradient-to-r from-[#00A6A6] to-[#38BDF8]"
                      : "bg-gradient-to-r from-[#F59E0B] to-[#F97316]"
                  }`}
                  style={{ width: `${Math.max(4, analysis.coveragePercent)}%` }}
                />
              </div>
            </div>

            {/* Recommendation Card */}
            <div className="rounded-2xl border border-[#00A6A6]/30 bg-[#00A6A6]/10 p-4 text-right">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">💡</span>
                <strong className="text-xs font-extrabold text-[#00E5E5] uppercase tracking-wide">
                  המלצה ממוקדת למפגש הבא
                </strong>
              </div>
              <p className="text-xs sm:text-sm font-medium leading-relaxed text-white">
                {analysis.recommendationForNextLesson}
              </p>
            </div>

            {/* Repetition Warnings Card */}
            {analysis.repetitionWarnings && analysis.repetitionWarnings.length > 0 ? (
              <div className="rounded-2xl border border-[#F59E0B]/30 bg-[#FEF3C7]/15 p-4 text-right space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔄</span>
                  <strong className="text-xs font-extrabold text-[#FDE047]">
                    זיהוי חזרתיות אפשרית בין מפגשים:
                  </strong>
                </div>
                {analysis.repetitionWarnings.map((warn, idx) => (
                  <p key={idx} className="text-xs text-slate-100 leading-relaxed bg-[#002B45]/50 p-2.5 rounded-xl border border-white/10">
                    • {warn}
                  </p>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[#16A34A]/25 bg-[#16A34A]/10 p-3 flex items-center gap-2 text-xs text-[#86EFAC] font-medium">
                <span>✓</span>
                <span>לא זוהתה חזרתיות מיותרת — רצף הלמידה נשמר באופן תקין.</span>
              </div>
            )}

            {/* Topics Tabs & List */}
            <div className="rounded-2xl border border-white/10 bg-[#001D30] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("summary")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      activeTab === "summary"
                        ? "bg-[#00A6A6] text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    נושאים שטרם נלמדו ({analysis.pendingTopics.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("topics")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      activeTab === "topics"
                        ? "bg-[#00A6A6] text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    נושאים שכוסו ({analysis.coveredTopics.length})
                  </button>
                </div>
              </div>

              {activeTab === "summary" ? (
                analysis.pendingTopics.length === 0 ? (
                  <p className="text-xs text-[#86EFAC] p-3 text-center">
                    🎉 כל נושאי הסילבוס כוסו בהצלחה!
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {analysis.pendingTopics.map((top, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-white/5 text-xs text-slate-200">
                        <span className="text-[#38BDF8] shrink-0 font-bold">○</span>
                        <span className="truncate">{top}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                analysis.coveredTopics.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center">
                    טרם נרשמו נושאים שכוסו.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {analysis.coveredTopics.map((top, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-[#16A34A]/10 text-xs text-white">
                        <span className="text-[#10B981] shrink-0 font-bold">✓</span>
                        <span className="truncate">{top}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onReanalyze}
                  className="rounded-xl bg-[#00A6A6] hover:bg-[#00B3A4] px-4 py-2 text-xs font-extrabold text-white transition flex items-center gap-1.5"
                >
                  <span>🔄</span>
                  <span>ניתוח מחדש עכשיו</span>
                </button>
                <button
                  type="button"
                  onClick={onEditSyllabus}
                  className="rounded-xl border border-white/14 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 transition"
                >
                  עריכת סילבוס
                </button>
              </div>

              {!hasGeminiKey && (
                <button
                  type="button"
                  onClick={onOpenGeminiSettings}
                  className="rounded-xl border border-[#00E5E5]/40 bg-[#00E5E5]/10 hover:bg-[#00E5E5]/20 px-3 py-2 text-xs font-extrabold text-[#00E5E5] transition"
                >
                  ⚙️ חיבור Gemini API
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GeminiSettingsModal({
  currentKey,
  onClose,
  onSave,
  onClear,
}: {
  currentKey?: string;
  onClose: () => void;
  onSave: (key: string) => void;
  onClear: () => void;
}) {
  const [keyInput, setKeyInput] = useState(currentKey || "");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!keyInput.trim()) {
      setTestResult({ success: false, message: "נא להזין מפתח לבדיקה." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const res = await testGeminiApiKey(keyInput.trim());
    setTestResult(res);
    setTesting(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/14 bg-[#002B45] p-5 text-white max-h-[92svh] overflow-y-auto sm:p-6 shadow-2xl text-right"
      >
        <div className="flex items-center justify-between border-b border-white/14 pb-3">
          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2">
              <span>✨</span>
              <span>הגדרות Google Gemini AI</span>
            </h3>
            <p className="text-xs text-[#B8D8E6]">חיבור ישיר למודל בינה מלאכותית לקורס</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#B8D8E6] hover:text-white"
          >
            סגירה
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-white mb-1.5">
              מפתח Gemini API (מחשבון גוגל של רותם):
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                dir="ltr"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIzaSy..."
                className="w-full rounded-xl border border-white/20 bg-[#001D30] px-3.5 py-2.5 text-xs sm:text-sm font-mono text-white placeholder:text-slate-500 focus:border-[#00A6A6] focus:outline-none pl-14"
              />
              <button
                type="button"
                onClick={() => setShowKey((p) => !p)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#B8D8E6] hover:text-white p-1"
              >
                {showKey ? "הסתר" : "הצג"}
              </button>
            </div>
          </div>

          {testResult && (
            <p
              role="status"
              className={`rounded-xl border p-2.5 text-xs font-extrabold leading-relaxed ${
                testResult.success
                  ? "border-[#16A34A]/30 bg-[#16A34A]/15 text-[#86EFAC]"
                  : "border-[#DC2626]/30 bg-[#FEE2E2]/15 text-[#FCA5A5]"
              }`}
            >
              {testResult.success ? "✓ " : "⚠️ "}
              {testResult.message}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing || !keyInput.trim()}
              onClick={handleTest}
              className="flex-1 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-extrabold text-white transition disabled:opacity-50"
            >
              {testing ? "בודק מפתח מול גוגל..." : "בדיקת תקינות מפתח"}
            </button>
            {currentKey && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setKeyInput("");
                  setTestResult(null);
                }}
                className="rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2]/10 hover:bg-[#FEE2E2]/20 px-3 py-2 text-xs font-bold text-[#FCA5A5] transition"
              >
                מחיקת מפתח
              </button>
            )}
          </div>

          <div className="rounded-xl bg-[#001D30] border border-white/10 p-3 text-[11px] text-[#B8D8E6] leading-relaxed space-y-1">
            <p className="font-bold text-white">איך משיגים מפתח בחינם?</p>
            <p>1. נכנסים לאתר Google AI Studio מחשבון הגוגל.</p>
            <p>2. לוחצים על Get API key ➔ Create API key.</p>
            <p>3. מעתיקים ומדביקים כאן פעם אחת בלבד.</p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/14 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(keyInput.trim());
                onClose();
              }}
              className="rounded-xl bg-[#00A6A6] px-5 py-2.5 text-xs font-extrabold text-white hover:bg-[#00B3A4] shadow-md shadow-[#00A6A6]/20"
            >
              שמירת מפתח
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveAction({ action, children, disabled = false }: { action: () => void | Promise<void>; children: ReactNode; disabled?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return <div>{error && <p role="alert" className="mb-2 rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
    <button type="button" disabled={saving || disabled} className="rounded-xl bg-[#00A6A6] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" onClick={async () => {
      setSaving(true); setError('');
      try { await action(); } catch(e) { setError(e instanceof Error ? e.message : 'השמירה נכשלה. נסו שוב.'); } finally { setSaving(false); }
    }}>{saving ? 'שומר...' : children}</button></div>;
}
