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
  Present: "bg-[#E0EEE7] text-[#22684D] border-[#C9E0D4]",
  Late: "bg-[#FBEFD8] text-[#8A5B13] border-[#F1DDAF]",
  Absent: "bg-[#F8E2E1] text-[#A13D3D] border-[#EDC8C6]",
  Excused: "bg-[#E8ECEF] text-[#56616D] border-[#D6DDE2]",
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
  const title = navItems.find((item) => item.id === tab)?.label ?? "כיתות";
  const dateLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const mobileDateLabel = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
  }).format(new Date());

  return (
    <div lang="he" dir="rtl" className="app-bg min-h-[100svh] bg-[#EEF2EF] text-right text-[#17211D]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[1180px]">
        <aside className="hidden w-[226px] shrink-0 border-e border-[#DCE4DF] px-5 py-7 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#174A3A] text-sm font-extrabold text-white">נכ</span>
            <div>
              <p className="font-extrabold tracking-[-0.02em]">ניהול נוכחות</p>
              <p className="text-xs font-medium text-[#66716B]">סביבת עבודה למורים</p>
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
                  tab === item.id ? "bg-[#DCEAE4] text-[#174A3A]" : "text-[#66716B] hover:bg-white/70 hover:text-[#17211D]"
                }`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-current/15"><NavIcon tab={item.id} /></span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-8 border-t border-[#DCE4DF] pt-4">
            <p dir="ltr" className="truncate text-left text-xs font-bold text-[#66716B]">{userEmail}</p>
            <button type="button" onClick={onSignOut} className="mt-2 min-h-10 w-full rounded-xl border border-[#DCE4DF] bg-white px-3 text-sm font-bold text-[#174A3A] hover:bg-[#F7F9F7]">התנתקות</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-10">
          <header className="px-4 pb-1 pt-2 sm:px-6 sm:pb-2 sm:pt-5 lg:px-10 lg:pb-3 lg:pt-9">
            <p className="mb-1 hidden text-xs font-extrabold uppercase tracking-[0.16em] text-[#174A3A] lg:block">{title}</p>
            <div className="flex items-center justify-between gap-2 lg:items-end">
              <h1 className="text-2xl font-extrabold tracking-[-0.04em] sm:text-[28px] lg:text-[32px]">{title}</h1>
              <div className="flex items-center gap-2 lg:pb-1">
                <time className="text-xs font-semibold text-[#66716B] lg:hidden">{mobileDateLabel}</time>
                <time className="hidden text-sm font-semibold text-[#66716B] lg:inline">{dateLabel}</time>
                <button type="button" onClick={onSignOut} className="min-h-8 rounded-lg px-2 text-[11px] font-bold text-[#66716B] hover:bg-white/70 hover:text-[#174A3A] lg:hidden">יציאה</button>
              </div>
            </div>
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
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#D2DCD6] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_28px_rgba(20,52,41,0.07)] backdrop-blur-xl lg:hidden"
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTabChange(item.id)}
          aria-current={tab === item.id ? "page" : undefined}
          className={`mx-1 flex min-h-14 flex-col items-center justify-center rounded-2xl text-[11px] font-extrabold transition active:scale-[0.97] ${
            tab === item.id ? "bg-[#DCEAE4] text-[#174A3A]" : "text-[#66716B]"
          }`}
        >
          <NavIcon tab={item.id} className="mb-1 h-4 w-4" />
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
    <section aria-label="סיכום נוכחות" className="grid grid-cols-4 gap-1.5 rounded-[16px] border border-[#DCE4DF] bg-white/80 p-1.5 shadow-[0_8px_24px_rgba(20,52,41,0.07)] sm:gap-2 sm:rounded-[20px] sm:p-2">
      {statuses.map((status) => (
        <article key={status} className={`rounded-xl border px-1 py-1.5 text-center sm:rounded-2xl sm:p-3 ${statusStyles[status]}`}>
          <strong className="block text-lg font-extrabold tracking-[-0.04em] text-[#17211D] sm:text-2xl">{logs.filter((log) => log.status === status).length}</strong>
          <span className="mt-0.5 block text-[10px] font-extrabold sm:mt-1 sm:text-[11px]">{statusLabels[status]}</span>
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
    <article className={`soft-card flex h-full flex-col rounded-[18px] border bg-white p-3 sm:rounded-[20px] sm:p-5 ${course.active ? "border-[#DCE4DF]" : "border-[#E1E5E3] opacity-70"}`}>
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 dir="auto" className="text-lg font-extrabold tracking-[-0.025em] sm:text-xl">{course.name}</h3>
            {!course.active && <span className="rounded-full bg-[#E8ECEF] px-2 py-1 text-[10px] font-extrabold text-[#56616D]">לא פעיל</span>}
          </div>
          <p dir="auto" className="line-clamp-2 text-sm font-medium leading-5 text-[#66716B] sm:leading-6">{course.description || "אין עדיין תיאור"}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#DCEAE4] text-xs font-extrabold text-[#174A3A] sm:h-12 sm:w-12 sm:text-sm">{studentCount}</span>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={`פעולות נוספות עבור ${course.name}`} className="grid h-10 w-10 place-items-center rounded-xl text-[#66716B] hover:bg-[#F7F9F7] hover:text-[#174A3A]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            {menuOpen && (
              <div className="absolute end-0 top-11 z-20 min-w-28 rounded-xl border border-[#DCE4DF] bg-white p-1.5 shadow-lg">
                <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#174A3A] hover:bg-[#F7F9F7] sm:hidden">עריכה</button>
                <button type="button" onClick={() => { setMenuOpen(false); onToggleActive(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#66716B] hover:bg-[#F7F9F7] hover:text-[#174A3A]">{course.active ? "השבתה" : "הפעלה"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between border-t border-[#E5EBE7] pt-2 text-xs font-bold text-[#66716B] sm:mb-4 sm:pt-3">
        <button type="button" onClick={onViewStudents} className="rounded-lg px-1 py-2 text-[#174A3A] underline-offset-4 hover:underline">{studentCount} {studentCount === 1 ? "תלמיד פעיל" : "תלמידים פעילים"}</button>
        <span className={startedToday ? "text-[#22684D]" : "text-[#66716B]"}>{startedToday ? "התחילה היום" : "לא התחילה"}</span>
      </div>
      <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button type="button" disabled={!course.active} onClick={onStart} className="min-h-11 whitespace-nowrap rounded-xl bg-[#174A3A] px-3 text-sm font-extrabold text-white transition hover:bg-[#103D2F] disabled:cursor-not-allowed disabled:bg-[#A9B5AF] sm:min-h-12 sm:rounded-2xl">
          {startedToday ? "פתיחת נוכחות" : "התחלת נוכחות"}
        </button>
        <button type="button" onClick={onEdit} aria-label={`עריכת ${course.name}`} className="hidden min-h-12 rounded-2xl border border-[#DCE4DF] px-3 text-sm font-bold text-[#174A3A] hover:bg-[#F7F9F7] sm:block">עריכה</button>
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
    <li className="rounded-2xl border border-[#E5EBE7] bg-[#F7F9F7] p-2.5 sm:p-3">
      <div className="flex items-center gap-2 sm:gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#DCEAE4] text-xs font-extrabold text-[#174A3A]" aria-hidden="true">{initials}</span>
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-sm font-extrabold">{student.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#66716B] sm:text-xs">סומן בשעה {log.time}</p>
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
                log.status === status ? statusStyles[status] : "border-[#DCE4DF] bg-white text-[#66716B] hover:border-[#A9C3B8]"
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </fieldset>
      {noteOpen ? (
        <label className="mt-2 block text-xs font-extrabold text-[#66716B]">
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
            className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DCE4DF] bg-white px-3 text-sm font-medium text-[#17211D] outline-none transition placeholder:text-[#94A09A] focus:border-[#174A3A] focus:ring-2 focus:ring-[#174A3A]/15"
          />
        </label>
      ) : (
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3 sm:mt-2">
          {notes && <p dir="auto" className="min-w-0 flex-1 truncate text-xs font-medium text-[#66716B]">{notes}</p>}
          <button type="button" onClick={() => setNoteOpen(true)} className="min-h-8 shrink-0 rounded-lg px-1.5 text-[11px] font-extrabold text-[#174A3A] hover:bg-white sm:min-h-9 sm:px-2 sm:text-xs">{notes ? "עריכת הערה" : "הוספת הערה"}</button>
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
    <div className="fixed inset-0 z-50 grid items-end bg-[#0F211A]/45 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[92svh] w-full overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[24px] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-xl font-extrabold tracking-[-0.025em]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="סגירת החלון" className="grid h-11 w-11 place-items-center rounded-full border border-[#DCE4DF] text-lg font-bold text-[#66716B] hover:bg-[#F7F9F7]">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}
