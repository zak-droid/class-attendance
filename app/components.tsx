"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AppTab, AttendanceLog, AttendanceStatus, Course, Student } from "./types";

const navItems: { id: AppTab; label: string }[] = [
  { id: "courses", label: "כיתות" },
  { id: "today", label: "היום" },
  { id: "students", label: "תלמידים" },
  { id: "history", label: "היסטוריה" },
];

function NavIcon({ tab, className = "h-4 w-4" }: { tab: AppTab; className?: string }) {
  const icon: Record<AppTab, ReactNode> = {
    courses: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v14H6.5A2.5 2.5 0 0 0 4 19.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v14h4.5a2.5 2.5 0 0 1 2.5 2.5z" /></>,
    today: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 15l2 2 5-5" /></>,
    students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{icon[tab]}</svg>;
}

export const statusStyles: Record<AttendanceStatus, string> = {
  Present: "bg-[#E7F2E9] text-[#276749] border-[#CBE3D0]",
  Late: "bg-[#FFF1D6] text-[#9A6415] border-[#F1D9A6]",
  Absent: "bg-[#FBE7E5] text-[#B5544B] border-[#F0CDCA]",
  Excused: "bg-[#EAF0F4] text-[#4D6470] border-[#D7E1E6]",
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
  children,
}: {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  userEmail: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const title = navItems.find((item) => item.id === tab)?.label ?? "כיתות";
  const dateLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return (
    <div lang="he" dir="rtl" className="min-h-[100svh] bg-[#073B4C] text-right text-[#102A34]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[1180px]">
        <aside className="hidden w-[226px] shrink-0 border-e border-[#073B4C] bg-[#073B4C] px-5 py-7 text-white lg:block">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-sm font-extrabold text-white ring-1 ring-white/20">נכ</span>
            <div>
              <p className="font-extrabold tracking-[-0.02em]">ניהול נוכחות</p>
              <p className="text-xs font-medium text-[#D5E4EA]">סביבת עבודה למורים</p>
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
                  tab === item.id ? "bg-white/15 text-white ring-1 ring-white/15" : "text-[#D5E4EA] hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-current/15"><NavIcon tab={item.id} /></span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-8 border-t border-white/15 pt-4">
            <p dir="ltr" className="truncate text-left text-xs font-bold text-[#D5E4EA]">{userEmail}</p>
            <button type="button" onClick={onSignOut} className="mt-2 min-h-10 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/20">התנתקות</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
          <header className="relative bg-[#073B4C] px-4 pb-3 pt-5 text-white sm:px-6 sm:pb-4 sm:pt-6 lg:px-10 lg:pb-5 lg:pt-9">
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
              <div className="absolute end-4 top-16 z-30 w-64 rounded-2xl border border-white/15 bg-[#073B4C] p-3 shadow-[0_18px_50px_rgba(0,18,27,0.35)] lg:hidden">
                <p dir="ltr" className="truncate text-left text-xs font-semibold text-white/70">{userEmail}</p>
                <button type="button" onClick={onSignOut} className="mt-3 min-h-10 w-full rounded-xl border border-white/25 px-3 text-sm font-extrabold text-white hover:bg-white/10">יציאה</button>
              </div>
            )}
          </header>
          <main className="px-4 pb-4 sm:px-6 sm:pb-8 lg:px-10">{children}</main>
        </div>
      </div>
      <BottomNav tab={tab} onTabChange={onTabChange} />
    </div>
  );
}

export function BottomNav({ tab, onTabChange }: { tab: AppTab; onTabChange: (tab: AppTab) => void }) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#D5E4EA] bg-white px-2 pb-[calc(7px+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(0,28,39,0.13)] lg:hidden"
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTabChange(item.id)}
          aria-current={tab === item.id ? "page" : undefined}
          className={`mx-1 flex min-h-[58px] flex-col items-center justify-center text-[11px] font-extrabold transition active:scale-[0.97] ${
            tab === item.id ? "text-[#073B4C]" : "text-[#5B7180]"
          }`}
        >
          <span className={`mb-0.5 grid h-9 w-9 place-items-center rounded-full ${tab === item.id ? "bg-[#073B4C] text-white shadow-[0_6px_16px_rgba(7,59,76,0.28)]" : ""}`}><NavIcon tab={item.id} className="h-[18px] w-[18px]" /></span>
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
    <section aria-label="סיכום נוכחות" className="grid grid-cols-4 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] shadow-[0_12px_32px_rgba(0,24,34,0.2)]">
      {statuses.map((status) => (
        <article key={status} className="border-e border-white/10 px-1 py-2.5 text-center first:border-e-0 sm:py-3">
          <strong className={`block text-xl font-extrabold tracking-[-0.04em] sm:text-2xl ${status === "Present" ? "text-[#E7F2E9]" : status === "Late" ? "text-[#FFF1D6]" : status === "Absent" ? "text-[#FBE7E5]" : "text-[#D7E1E6]"}`}>{logs.filter((log) => log.status === status).length}</strong>
          <span className={`mt-0.5 block text-[10px] font-extrabold sm:text-xs ${status === "Present" ? "text-[#E7F2E9]" : status === "Late" ? "text-[#FFF1D6]" : status === "Absent" ? "text-[#FBE7E5]" : "text-[#D7E1E6]"}`}>{statusLabels[status]}</span>
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
    <article className={`flex h-full flex-col rounded-[20px] border p-4 text-white shadow-[0_16px_36px_rgba(0,24,34,0.25)] sm:p-5 ${course.active ? "border-white/20 bg-[#176B87]" : "border-white/15 bg-[#073B4C] opacity-70"}`}>
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
              <div className="absolute end-0 top-11 z-20 min-w-28 rounded-xl border border-[#D5E4EA] bg-[#FFFFFF] p-1.5 shadow-[0_12px_30px_rgba(19,69,84,0.12)]">
                <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#073B4C] hover:bg-[#FFFFFF] sm:hidden">עריכה</button>
                <button type="button" onClick={() => { setMenuOpen(false); onToggleActive(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#5B7180] hover:bg-[#FFFFFF] hover:text-[#073B4C]">{course.active ? "השבתה" : "הפעלה"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between border-t border-white/15 pt-2 text-xs font-bold text-white/75 sm:mb-4 sm:pt-3">
        <button type="button" onClick={onViewStudents} className="rounded-lg px-1 py-2 text-white underline-offset-4 hover:underline">{studentCount} {studentCount === 1 ? "תלמיד פעיל" : "תלמידים פעילים"}</button>
        <span className={startedToday ? "text-[#E7F2E9]" : "text-white/65"}>{startedToday ? "התחילה היום" : "לא התחילה"}</span>
      </div>
      <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button type="button" disabled={!course.active} onClick={onStart} className="min-h-11 whitespace-nowrap rounded-xl bg-white px-3 text-sm font-extrabold text-[#073B4C] transition hover:bg-[#FFFFFF] disabled:cursor-not-allowed disabled:bg-white/35 disabled:text-white/70 sm:min-h-12 sm:rounded-2xl">
          {startedToday ? "פתיחת נוכחות" : "התחלת נוכחות"}
        </button>
        <button type="button" onClick={onEdit} aria-label={`עריכת ${course.name}`} className="hidden min-h-12 rounded-2xl border border-white/30 px-3 text-sm font-bold text-white hover:bg-white/10 sm:block">עריכה</button>
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
    <li className="rounded-2xl border border-[#D5E4EA] bg-white p-2.5 shadow-[0_6px_18px_rgba(0,38,52,0.06)] sm:p-3">
      <div className="flex items-center gap-2 sm:gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EAF0F4] text-xs font-extrabold text-[#073B4C]" aria-hidden="true">{initials}</span>
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-sm font-extrabold">{student.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#5B7180] sm:text-xs">סומן בשעה {log.time}</p>
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
                log.status === status ? statusStyles[status] : "border-[#D5E4EA] bg-[#FFFFFF] text-[#5B7180] hover:border-[#D5E4EA]"
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </fieldset>
      {noteOpen ? (
        <label className="mt-2 block text-xs font-extrabold text-[#5B7180]">
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
            className="mt-1.5 min-h-10 w-full rounded-xl border border-[#D5E4EA] bg-[#FFFFFF] px-3 text-sm font-medium text-[#102A34] outline-none transition placeholder:text-[#5B7180] focus:border-[#073B4C] focus:ring-2 focus:ring-[#073B4C]/15"
          />
        </label>
      ) : (
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3 sm:mt-2">
          {notes && <p dir="auto" className="min-w-0 flex-1 truncate text-xs font-medium text-[#5B7180]">{notes}</p>}
          <button type="button" onClick={() => setNoteOpen(true)} className="min-h-8 shrink-0 rounded-lg px-1.5 text-[11px] font-extrabold text-[#073B4C] hover:bg-[#FFFFFF] sm:min-h-9 sm:px-2 sm:text-xs">{notes ? "עריכת הערה" : "הוספת הערה"}</button>
        </div>
      )}
    </li>
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
    <div className="fixed inset-0 z-50 grid items-end bg-[#073B4C]/70 p-0 backdrop-blur-[3px] sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[92svh] w-full overflow-y-auto rounded-t-[26px] bg-white p-5 pt-3 shadow-[0_24px_70px_rgba(0,18,27,0.4)] sm:max-w-lg sm:rounded-[26px] sm:p-6">
        <span className="mx-auto mb-3 block h-1 w-12 rounded-full bg-[#D5E4EA] sm:hidden" aria-hidden="true" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-xl font-extrabold tracking-[-0.025em]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="סגירת החלון" className="grid h-11 w-11 place-items-center rounded-full border border-[#D5E4EA] text-lg font-bold text-[#5B7180] hover:bg-[#FFFFFF]">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}
