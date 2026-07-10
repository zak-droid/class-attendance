"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AppTab, AttendanceLog, AttendanceStatus, Course, Student } from "./types";

const navItems: { id: AppTab; label: string; short: string }[] = [
  { id: "courses", label: "Courses", short: "CO" },
  { id: "today", label: "Today", short: "TO" },
  { id: "students", label: "Students", short: "ST" },
  { id: "history", label: "History", short: "HI" },
];

export const statusStyles: Record<AttendanceStatus, string> = {
  Present: "bg-[#E0EEE7] text-[#22684D] border-[#C9E0D4]",
  Late: "bg-[#FBEFD8] text-[#8A5B13] border-[#F1DDAF]",
  Absent: "bg-[#F8E2E1] text-[#A13D3D] border-[#EDC8C6]",
  Excused: "bg-[#E8ECEF] text-[#56616D] border-[#D6DDE2]",
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
  const title = navItems.find((item) => item.id === tab)?.label ?? "Courses";
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="app-bg min-h-[100svh] bg-[#EEF2EF] text-[#17211D]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[1180px]">
        <aside className="hidden w-[226px] shrink-0 border-r border-[#DCE4DF] px-5 py-7 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#174A3A] text-sm font-extrabold text-white">CA</span>
            <div>
              <p className="font-extrabold tracking-[-0.02em]">Class Attendance</p>
              <p className="text-xs font-medium text-[#66716B]">Teacher workspace</p>
            </div>
          </div>
          <nav aria-label="Primary navigation" className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold transition ${
                  tab === item.id ? "bg-[#DCEAE4] text-[#174A3A]" : "text-[#66716B] hover:bg-white/70 hover:text-[#17211D]"
                }`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-current/15 text-[10px] tracking-wider">{item.short}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-8 border-t border-[#DCE4DF] pt-4">
            <p className="truncate text-xs font-bold text-[#66716B]">{userEmail}</p>
            <button type="button" onClick={onSignOut} className="mt-2 min-h-10 w-full rounded-xl border border-[#DCE4DF] bg-white px-3 text-sm font-bold text-[#174A3A] hover:bg-[#F7F9F7]">Sign out</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-24 lg:pb-10">
          <header className="px-4 pb-3 pt-6 sm:px-6 lg:px-10 lg:pt-9">
            <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#174A3A]">{title}</p>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h1 className="text-[28px] font-extrabold tracking-[-0.04em] sm:text-[32px]">Class Attendance</h1>
              <div className="flex items-center gap-2 pb-1">
                <time className="text-sm font-semibold text-[#66716B]">{dateLabel}</time>
                <button type="button" onClick={onSignOut} className="min-h-9 rounded-xl border border-[#DCE4DF] bg-white px-3 text-xs font-extrabold text-[#174A3A] lg:hidden">Sign out</button>
              </div>
            </div>
          </header>
          <main className="px-4 pb-8 sm:px-6 lg:px-10">{children}</main>
        </div>
      </div>
      <BottomNav tab={tab} onTabChange={onTabChange} />
    </div>
  );
}

export function BottomNav({ tab, onTabChange }: { tab: AppTab; onTabChange: (tab: AppTab) => void }) {
  return (
    <nav
      aria-label="Primary navigation"
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
          <span className="mb-1 text-[9px] tracking-[0.12em]" aria-hidden="true">{item.short}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${statusStyles[status]}`}>{status}</span>;
}

export function SummaryCards({ logs }: { logs: AttendanceLog[] }) {
  const statuses: AttendanceStatus[] = ["Present", "Late", "Absent", "Excused"];
  return (
    <section aria-label="Attendance summary" className="grid grid-cols-2 gap-2 rounded-[20px] border border-[#DCE4DF] bg-white/80 p-2 shadow-[0_8px_24px_rgba(20,52,41,0.07)] sm:grid-cols-4">
      {statuses.map((status) => (
        <article key={status} className={`rounded-2xl border p-3 text-center ${statusStyles[status]}`}>
          <strong className="block text-2xl font-extrabold tracking-[-0.04em] text-[#17211D]">{logs.filter((log) => log.status === status).length}</strong>
          <span className="mt-1 block text-[11px] font-extrabold">{status}</span>
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
  return (
    <article className={`soft-card flex h-full flex-col rounded-[20px] border bg-white p-4 sm:p-5 ${course.active ? "border-[#DCE4DF]" : "border-[#E1E5E3] opacity-70"}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-extrabold tracking-[-0.025em]">{course.name}</h3>
            {!course.active && <span className="rounded-full bg-[#E8ECEF] px-2 py-1 text-[10px] font-extrabold text-[#56616D]">Inactive</span>}
          </div>
          <p className="text-sm font-medium leading-6 text-[#66716B]">{course.description || "No description yet"}</p>
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#DCEAE4] text-sm font-extrabold text-[#174A3A]">{studentCount}</span>
      </div>
      <div className="mb-4 flex items-center justify-between border-t border-[#E5EBE7] pt-3 text-xs font-bold text-[#66716B]">
        <button type="button" onClick={onViewStudents} className="rounded-lg px-1 py-2 text-[#174A3A] underline-offset-4 hover:underline">{studentCount} active {studentCount === 1 ? "student" : "students"}</button>
        <span className={startedToday ? "text-[#22684D]" : "text-[#66716B]"}>{startedToday ? "Started today" : "Not started"}</span>
      </div>
      <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-2">
        <button type="button" disabled={!course.active} onClick={onStart} className="min-h-12 rounded-2xl bg-[#174A3A] px-3 text-sm font-extrabold text-white transition hover:bg-[#103D2F] disabled:cursor-not-allowed disabled:bg-[#A9B5AF]">
          {startedToday ? "Open today's attendance" : "Start today's attendance"}
        </button>
        <button type="button" onClick={onEdit} aria-label={`Edit ${course.name}`} className="min-h-12 rounded-2xl border border-[#DCE4DF] px-3 text-sm font-bold text-[#174A3A] hover:bg-[#F7F9F7]">Edit</button>
        <button type="button" onClick={onToggleActive} className="min-h-12 rounded-2xl border border-[#DCE4DF] px-3 text-sm font-bold text-[#66716B] hover:bg-[#F7F9F7]">{course.active ? "Pause" : "Activate"}</button>
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

  useEffect(() => setNotes(log.notes ?? ""), [log.notes]);
  return (
    <li className="rounded-2xl border border-[#E5EBE7] bg-[#F7F9F7] p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#DCEAE4] text-xs font-extrabold text-[#174A3A]" aria-hidden="true">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{student.name}</p>
          <p className="mt-1 text-xs font-semibold text-[#66716B]">Marked {log.time}</p>
        </div>
        <StatusBadge status={log.status} />
      </div>
      <fieldset className="mt-3">
        <legend className="sr-only">Status for {student.name}</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={log.status === status}
              onClick={() => onStatusChange(status)}
              className={`min-h-11 min-w-0 rounded-xl border px-1 text-[10px] font-extrabold transition active:scale-[0.97] sm:text-xs ${
                log.status === status ? statusStyles[status] : "border-[#DCE4DF] bg-white text-[#66716B] hover:border-[#A9C3B8]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block text-xs font-extrabold text-[#66716B]">
        Note <span className="font-medium">(optional)</span>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes !== (log.notes ?? "")) onNotesChange(notes);
          }}
          placeholder="Add a quick note"
          className="mt-1.5 min-h-11 w-full rounded-xl border border-[#DCE4DF] bg-white px-3 text-sm font-medium text-[#17211D] outline-none transition placeholder:text-[#94A09A] focus:border-[#174A3A] focus:ring-2 focus:ring-[#174A3A]/15"
        />
      </label>
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
          <button type="button" onClick={onClose} aria-label="Close dialog" className="grid h-11 w-11 place-items-center rounded-full border border-[#DCE4DF] text-lg font-bold text-[#66716B] hover:bg-[#F7F9F7]">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}
