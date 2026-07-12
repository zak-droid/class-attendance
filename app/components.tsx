"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AppTab, AttendanceLog, AttendanceStatus, Course, Student } from "./types";

const navItems: { id: AppTab; label: string }[] = [
  { id: "today", label: "היום" },
  { id: "students", label: "תלמידים" },
  { id: "history", label: "היסטוריה" },
  { id: "more", label: "עוד" },
];

function NavIcon({ tab, className = "h-4 w-4" }: { tab: AppTab; className?: string }) {
  const icon: Record<AppTab, ReactNode> = {
    today: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 15l2 2 5-5" /></>,
    students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    more: <><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{icon[tab]}</svg>;
}

export const statusStyles: Record<AttendanceStatus, string> = {
  Present: "bg-[#DCFCE7] text-[#166534] border-[#16A34A]/20",
  Late: "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/25",
  Absent: "bg-[#FEE2E2] text-[#991B1B] border-[#DC2626]/20",
  Excused: "bg-[#DBEAFE] text-[#1E40AF] border-[#2563EB]/20",
};

export const statusLabels: Record<AttendanceStatus, string> = {
  Present: "נוכח",
  Late: "איחר",
  Absent: "נעדר",
  Excused: "מוצדק",
};

export function Layout({
  tab,
  onTabChange,
  userEmail,
  onSignOut,
  attendanceActive = false,
  children,
}: {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  userEmail: string;
  onSignOut: () => void;
  attendanceActive?: boolean;
  children: ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const title = navItems.find((item) => item.id === tab)?.label ?? "היום";
  const dateLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return (
    <div lang="he" dir="rtl" className="app-shell min-h-[100svh] text-right text-[#0F172A]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[1180px]">
        <aside className="hidden w-[226px] shrink-0 border-e border-white/10 bg-[#002B45]/[0.65] px-5 py-7 text-white backdrop-blur-xl lg:block">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M5 12l4 4L19 6" /><path d="M4 4h16v16H4z" /></svg></span>
            <div>
              <p className="font-extrabold tracking-[-0.02em]">ניהול נוכחות</p>
              <p className="text-xs font-medium text-[#B8D8E6]">סביבת עבודה למורים</p>
            </div>
          </div>
          <nav aria-label="ניווט ראשי" className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-right text-sm font-bold transition ${
                  tab === item.id ? "bg-white/15 text-white ring-1 ring-white/15" : "text-[#B8D8E6] hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-current/15"><NavIcon tab={item.id} /></span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-8 border-t border-white/15 pt-4">
            <p dir="ltr" className="truncate text-left text-xs font-bold text-[#B8D8E6]">{userEmail}</p>
            <button type="button" onClick={onSignOut} className="mt-2 min-h-10 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/20">התנתקות</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
          <header className="relative bg-transparent px-5 pb-4 pt-6 text-white sm:px-6 sm:pb-5 sm:pt-7 lg:px-10 lg:pb-6 lg:pt-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-extrabold tracking-[-0.04em] sm:text-[32px]">{title}</h1>
                {tab === "today" && <time className="mt-1.5 block text-sm font-semibold text-white/75">{dateLabel}</time>}
              </div>
              <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen} aria-label="פתיחת תפריט" className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 text-white hover:bg-white/10 lg:hidden">
                <span className="space-y-1.5" aria-hidden="true"><span className="block h-0.5 w-6 bg-current" /><span className="block h-0.5 w-6 bg-current" /><span className="block h-0.5 w-6 bg-current" /></span>
              </button>
            </div>
            {mobileMenuOpen && (
              <div className="glass-panel absolute end-5 top-16 z-30 w-64 rounded-2xl p-3 lg:hidden">
                <p dir="ltr" className="truncate text-left text-xs font-semibold text-white/70">{userEmail}</p>
                <button type="button" onClick={onSignOut} className="mt-3 min-h-10 w-full rounded-xl border border-white/25 px-3 text-sm font-extrabold text-white hover:bg-white/10">יציאה</button>
              </div>
            )}
          </header>
          <main className="px-5 pb-6 sm:px-6 sm:pb-10 lg:px-10">{children}</main>
        </div>
      </div>
      {!attendanceActive && <BottomNav tab={tab} onTabChange={onTabChange} />}
    </div>
  );
}

export function BottomNav({ tab, onTabChange }: { tab: AppTab; onTabChange: (tab: AppTab) => void }) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="bottom-nav-glass fixed inset-x-4 bottom-3 z-40 grid grid-cols-4 rounded-[26px] px-2 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTabChange(item.id)}
          aria-current={tab === item.id ? "page" : undefined}
          className={`mx-1 flex min-h-[58px] flex-col items-center justify-center text-[11px] font-extrabold transition active:scale-[0.97] ${
            tab === item.id ? "text-white" : "text-[#B8D8E6]"
          }`}
        >
          <span className={`mb-0.5 grid h-9 w-9 place-items-center rounded-full transition ${tab === item.id ? "bg-white/[0.14] text-white ring-1 ring-white/[0.18]" : ""}`}><NavIcon tab={item.id} className="h-[18px] w-[18px]" /></span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${statusStyles[status]}`}>{statusLabels[status]}</span>;
}

export function SummaryCards({ logs }: { logs: AttendanceLog[] }) {
  const statuses: AttendanceStatus[] = ["Present", "Late", "Absent", "Excused"];
  return (
    <section aria-label="סיכום נוכחות" className="summary-panel grid grid-cols-4 overflow-hidden rounded-2xl">
      {statuses.map((status) => (
        <article key={status} className="border-e border-white/10 px-1 py-2.5 text-center first:border-e-0 sm:py-3">
          <strong className="block text-xl font-extrabold tracking-[-0.04em] text-white sm:text-2xl">{logs.filter((log) => log.status === status).length}</strong>
          <span className="mt-0.5 block text-[10px] font-extrabold text-[#B8D8E6] sm:text-xs">{statusLabels[status]}</span>
        </article>
      ))}
    </section>
  );
}

export function CourseCard({
  course,
  studentCount,
  startedToday,
  onStart,
  onEdit,
  onToggleActive,
  onViewStudents,
}: {
  course: Course;
  studentCount: number;
  startedToday: boolean;
  onStart: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onViewStudents: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className={`flex h-full flex-col rounded-[20px] p-4 text-white sm:p-5 ${course.active ? "glass-panel" : "border border-white/10 bg-white/[0.025] opacity-65"}`}>
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 dir="auto" className="text-lg font-extrabold tracking-[-0.025em] sm:text-xl">{course.name}</h3>
            {!course.active && <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-extrabold text-white/75">לא פעיל</span>}
          </div>
          <p dir="auto" className="line-clamp-2 text-sm font-medium leading-5 text-white/75 sm:leading-6">{course.description || "אין עדיין תיאור"}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xs font-extrabold text-white ring-1 ring-white/20 sm:h-12 sm:w-12 sm:text-sm">{studentCount}</span>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={`פעולות נוספות עבור ${course.name}`} className="grid h-10 w-10 place-items-center rounded-xl text-white/75 hover:bg-white/10 hover:text-white">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            {menuOpen && (
              <div className="absolute end-0 top-11 z-20 min-w-28 rounded-xl border border-[#CBD5E1] bg-white p-1.5 shadow-[0_12px_30px_rgba(0,18,27,0.18)]">
                <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#002B45] hover:bg-[#F4F8FA] sm:hidden">עריכה</button>
                <button type="button" onClick={() => { setMenuOpen(false); onToggleActive(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#475569] hover:bg-[#F4F8FA] hover:text-[#002B45]">{course.active ? "השבתה" : "הפעלה"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between border-t border-white/15 pt-2 text-xs font-bold text-white/75 sm:mb-4 sm:pt-3">
        <button type="button" onClick={onViewStudents} className="rounded-lg px-1 py-2 text-white underline-offset-4 hover:underline">{studentCount} {studentCount === 1 ? "תלמיד פעיל" : "תלמידים פעילים"}</button>
        <span className={startedToday ? "text-[#DCFCE7]" : "text-[#B8D8E6]"}>{startedToday ? "התחילה היום" : "לא התחילה"}</span>
      </div>
      <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button type="button" disabled={!course.active} onClick={onStart} className="min-h-11 whitespace-nowrap rounded-xl bg-white px-3 text-sm font-extrabold text-[#002B45] transition hover:bg-[#F4F8FA] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60 sm:min-h-12">
          {startedToday ? "פתיחת נוכחות" : "התחלת נוכחות"}
        </button>
        <button type="button" onClick={onEdit} aria-label={`עריכת ${course.name}`} className="hidden min-h-12 rounded-xl border border-white/30 px-3 text-sm font-bold text-white hover:bg-white/10 sm:block">עריכה</button>
      </div>
    </article>
  );
}

export function AttendanceRow({
  log,
  student,
  onStatusChange,
  onNotesChange,
}: {
  log: AttendanceLog;
  student: Student;
  onStatusChange: (status: AttendanceStatus) => void;
  onNotesChange: (notes: string) => void;
}) {
  const statuses: AttendanceStatus[] = ["Present", "Late", "Absent", "Excused"];
  const initials = student.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const [notes, setNotes] = useState(log.notes ?? "");
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => setNotes(log.notes ?? ""), [log.notes]);
  return (
    <li className="rounded-2xl border border-[#CBD5E1] bg-white p-2.5 shadow-[0_6px_18px_rgba(0,38,52,0.06)] sm:p-3">
      <div className="flex items-center gap-2 sm:gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F4F8FA] text-xs font-extrabold text-[#002B45]" aria-hidden="true">{initials}</span>
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-sm font-extrabold">{student.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#475569] sm:text-xs">סומן בשעה {log.time}</p>
        </div>
        <StatusBadge status={log.status} />
      </div>
      <fieldset className="mt-1.5 sm:mt-2">
        <legend className="sr-only">סטטוס עבור {student.name}</legend>
        <div className="grid grid-cols-4 gap-1">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={log.status === status}
              onClick={() => onStatusChange(status)}
              className={`min-h-10 min-w-0 rounded-xl border px-1 text-[10px] font-extrabold transition active:scale-[0.97] sm:text-xs ${
                log.status === status ? statusStyles[status] : "border-[#CBD5E1] bg-[#FFFFFF] text-[#475569] hover:border-[#CBD5E1]"
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </fieldset>
      {noteOpen ? (
        <label className="mt-2 block text-xs font-extrabold text-[#475569]">
          הערה <span className="font-medium">(אופציונלי)</span>
          <input
            autoFocus
            dir="auto"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => {
              if (notes !== (log.notes ?? "")) onNotesChange(notes);
            }}
            placeholder="הוספת הערה קצרה"
            className="mt-1.5 min-h-10 w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-sm font-medium text-[#0F172A] outline-none transition placeholder:text-[#475569] focus:border-[#002B45] focus:ring-2 focus:ring-[#002B45]/15"
          />
        </label>
      ) : (
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3 sm:mt-2">
          {notes && <p dir="auto" className="min-w-0 flex-1 truncate text-xs font-medium text-[#475569]">{notes}</p>}
          <button type="button" onClick={() => setNoteOpen(true)} className="min-h-8 shrink-0 rounded-lg px-1.5 text-[11px] font-extrabold text-[#002B45] hover:bg-[#FFFFFF] sm:min-h-9 sm:px-2 sm:text-xs">{notes ? "עריכת הערה" : "הוספת הערה"}</button>
        </div>
      )}
    </li>
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
  const initials = student.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex min-h-[62px] w-full items-center gap-3 border-b border-[#E2E8F0] bg-white px-3 py-2.5 text-right last:border-b-0 active:bg-[#F4F8FA]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E2E8F0] text-xs font-extrabold text-[#002B45]" aria-hidden="true">{initials}</span>
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-base font-semibold text-[#0F172A]">{student.name}</span>
          <span className="mt-0.5 flex items-center gap-2 text-xs font-medium text-[#475569]">
            <span>{log.time}</span>
            {log.notes && <span aria-label="יש הערה">● הערה</span>}
          </span>
        </span>
        <StatusBadge status={log.status} />
      </button>
    </li>
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
  const statuses: AttendanceStatus[] = ["Present", "Late", "Absent", "Excused"];
  return (
    <div className="fixed inset-0 z-[70] grid items-end bg-[#002B45]/75 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`עדכון נוכחות עבור ${student.name}`} className="w-full rounded-t-[24px] bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgba(0,18,27,0.32)]">
        <span className="mx-auto mb-4 block h-1 w-12 rounded-full bg-[#E2E8F0]" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div><h2 dir="auto" className="text-xl font-bold text-[#0F172A]">{student.name}</h2><p className="text-sm text-[#475569]">עדכון הסטטוס נשמר מיד</p></div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="grid h-11 w-11 place-items-center rounded-full border border-[#E2E8F0] text-xl text-[#475569]">×</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {statuses.map((status) => <button key={status} type="button" onClick={() => { onStatusChange(status); onClose(); }} className={`min-h-12 rounded-xl border px-3 text-sm font-extrabold ${statusStyles[status]} ${log.status === status ? "ring-2 ring-[#002B45] ring-offset-2" : ""}`}>{statusLabels[status]}</button>)}
        </div>
        <label className="mt-5 block text-sm font-semibold text-[#475569]">הערה
          <textarea dir="auto" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="הוספה או עריכת הערה" className="mt-2 min-h-20 w-full rounded-xl border border-[#E2E8F0] bg-[#F4F8FA] p-3 text-sm text-[#0F172A] outline-none focus:border-[#00A6A6]" />
        </label>
        <button type="button" onClick={() => { onNotesChange(notes.trim()); onClose(); }} className="mt-3 min-h-12 w-full rounded-xl bg-[#002B45] text-sm font-extrabold text-white">שמירת הערה</button>
      </section>
    </div>
  );
}

export function FinishAttendanceBar({ logs, onFinish }: { logs: AttendanceLog[]; onFinish: () => void }) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-[22px] border border-white/[0.12] bg-[#002B45]/[0.82] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_38px_rgba(0,18,27,0.32)] backdrop-blur-xl">
      <p className="mb-2 text-center text-xs font-semibold text-[#B8D8E6]">נוכחים {logs.filter((log) => log.status === "Present").length} · מאחרים {logs.filter((log) => log.status === "Late").length} · נעדרים {logs.filter((log) => log.status === "Absent").length} · מוצדקים {logs.filter((log) => log.status === "Excused").length}</p>
      <button type="button" onClick={onFinish} className="min-h-12 w-full rounded-xl bg-[#00A6A6] text-base font-extrabold text-white active:bg-[#00B3A4]">סיום נוכחות</button>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-[#002B45]/75 p-0 backdrop-blur-[3px] sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[92svh] w-full overflow-y-auto rounded-t-[26px] bg-white p-5 pt-3 shadow-[0_24px_70px_rgba(0,18,27,0.4)] sm:max-w-lg sm:rounded-[26px] sm:p-6">
        <span className="mx-auto mb-3 block h-1 w-12 rounded-full bg-[#CBD5E1] sm:hidden" aria-hidden="true" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-xl font-extrabold tracking-[-0.025em]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="סגירת החלון" className="grid h-11 w-11 place-items-center rounded-full border border-[#CBD5E1] text-lg font-bold text-[#475569] hover:bg-[#FFFFFF]">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}
