"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./AuthScreen";
import {
  createTodayAttendance,
  fetchAppData,
  saveCourse,
  saveStudent,
  setCourseActive,
  setStudentActive,
  subscribeToSharedData,
  updateAttendanceLog,
} from "./cloud-data";
import { AttendanceStudentRow, CourseCard, FinishAttendanceBar, Layout, Modal, StatusBadge, StudentActionBottomSheet, SummaryCards, statusLabels } from "./components";
import { prepareStudentImport } from "./student-import";
import { supabase } from "./supabase";
import type { AppData, AppTab, AttendanceStatus, Course, Student } from "./types";
import { localDateKey, localTimeKey, makeId } from "./utils";

type ModalState =
  | { type: "course"; course?: Course }
  | { type: "student"; student?: Student }
  | { type: "import" }
  | null;

const fieldClass = "mt-1.5 min-h-12 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-sm font-semibold text-[#0F172A] outline-none transition placeholder:text-[#475569] focus:border-[#00A6A6] focus:ring-2 focus:ring-[#00A6A6]/20";
const secondaryButton = "min-h-12 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-extrabold text-[#002B45] transition hover:bg-[#F4F8FA]";
const primaryButton = "min-h-12 rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white transition hover:bg-[#00B3A4] disabled:cursor-not-allowed disabled:bg-[#64748B]";
const darkOutlineButton = "min-h-12 rounded-xl border border-white/65 bg-transparent px-4 text-sm font-extrabold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45";

export default function Home() {
  const today = localDateKey();
  const [data, setData] = useState<AppData>({ courses: [], students: [], attendance: [] });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [tab, setTab] = useState<AppTab>("today");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [todayFilter, setTodayFilter] = useState<"all" | "exceptions">("all");
  const [studentCourse, setStudentCourse] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [historyDate, setHistoryDate] = useState(today);
  const [historyCourse, setHistoryCourse] = useState("all");
  const [activeSessionCourseId, setActiveSessionCourseId] = useState<string | null>(null);
  const [sessionReadOnly, setSessionReadOnly] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [completedCourseIds, setCompletedCourseIds] = useState<Set<string>>(() => new Set());

  const refreshData = useCallback(async () => {
    setDataLoading(true);
    try {
      setData(await fetchAppData());
      setDataError("");
    } catch (error) {
      console.error(error);
      setDataError("לא הצלחנו לטעון את הנתונים המשותפים. בדקו את החיבור ונסו שוב.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    void supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshData();
    return subscribeToSharedData(() => void refreshData());
  }, [refreshData, session]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }, []);

  const coursesById = useMemo(() => new Map(data.courses.map((course) => [course.id, course])), [data.courses]);
  const studentsById = useMemo(() => new Map(data.students.map((student) => [student.id, student])), [data.students]);
  const todayLogs = useMemo(() => data.attendance.filter((log) => log.date === today), [data.attendance, today]);
  const activeSessionCourse = activeSessionCourseId ? coursesById.get(activeSessionCourseId) : undefined;
  const activeSessionLogs = activeSessionCourseId ? todayLogs.filter((log) => log.courseId === activeSessionCourseId) : [];
  const selectedAttendance = selectedAttendanceId ? data.attendance.find((log) => log.id === selectedAttendanceId) : undefined;
  const selectedAttendanceStudent = selectedAttendance ? studentsById.get(selectedAttendance.studentId) : undefined;

  const startAttendance = async (courseId: string) => {
    const eligible = data.students.filter((student) => student.courseId === courseId && student.active).length;
    if (eligible === 0) {
      notify("אין עדיין תלמידים פעילים בכיתה הזו");
      return;
    }
    try {
      const created = await createTodayAttendance(courseId, today, localTimeKey());
      await refreshData();
      notify(created === 0
        ? "כבר קיימת נוכחות להיום עבור הכיתה הזו"
        : `נוצרה נוכחות עבור ${created} ${created === 1 ? "תלמיד" : "תלמידים"}`);
      setTab("today");
      setSessionReadOnly(false);
      setActiveSessionCourseId(courseId);
    } catch (error) {
      console.error(error);
      notify("לא הצלחנו להתחיל את הנוכחות. נסו שוב.");
    }
  };

  const updateAttendance = async (logId: string, updates: { status?: AttendanceStatus; notes?: string }) => {
    setData((current) => ({
      ...current,
      attendance: current.attendance.map((log) => log.id === logId ? { ...log, ...updates } : log),
    }));
    try {
      await updateAttendanceLog(logId, updates);
    } catch (error) {
      console.error(error);
      notify("השינוי לא נשמר. נסו שוב.");
      await refreshData();
    }
  };

  const toggleCourse = async (courseId: string) => {
    const course = data.courses.find((item) => item.id === courseId);
    if (!course) return;
    try {
      await setCourseActive(courseId, !course.active);
      await refreshData();
    } catch (error) {
      console.error(error);
      notify("לא הצלחנו לעדכן את הכיתה.");
    }
  };

  const toggleStudent = async (studentId: string) => {
    const student = data.students.find((item) => item.id === studentId);
    if (!student) return;
    try {
      await setStudentActive(studentId, !student.active);
      await refreshData();
    } catch (error) {
      console.error(error);
      notify("לא הצלחנו לעדכן את התלמיד.");
    }
  };

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return data.students.filter((student) => {
      const matchesCourse = studentCourse === "all" || student.courseId === studentCourse;
      const matchesSearch = !query || student.name.toLowerCase().includes(query) || (student.email ?? "").toLowerCase().includes(query);
      return matchesCourse && matchesSearch;
    });
  }, [data.students, studentCourse, studentSearch]);

  const historyLogs = useMemo(() => data.attendance.filter((log) => {
    return log.date === historyDate && (historyCourse === "all" || log.courseId === historyCourse);
  }), [data.attendance, historyCourse, historyDate]);

  const exportCsv = () => {
    if (!historyLogs.length) return;
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ["תאריך", "שעה", "כיתה", "תלמיד", "אימייל", "סטטוס", "הערות"],
      ...historyLogs.map((log) => {
        const course = coursesById.get(log.courseId);
        const student = studentsById.get(log.studentId);
        return [log.date, log.time, course?.name ?? "כיתה לא ידועה", student?.name ?? "תלמיד לא ידוע", student?.email ?? "", statusLabels[log.status], log.notes ?? ""];
      }),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => escape(String(value))).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `נוכחות-${historyDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify(`יוצאו ${historyLogs.length} ${historyLogs.length === 1 ? "רשומת נוכחות" : "רשומות נוכחות"}`);
  };

  const importStudents = async (courseId: string, text: string) => {
    const latestData = await fetchAppData();
    const preview = prepareStudentImport(text, courseId, latestData.students);
    try {
      for (let index = 0; index < preview.ready.length; index += 20) {
        await Promise.all(preview.ready.slice(index, index + 20).map((row) => saveStudent({
          id: makeId(),
          name: row.name,
          email: row.email,
          courseId,
          active: true,
        })));
      }
    } catch (error) {
      await refreshData();
      throw error;
    }
    await refreshData();
    notify(`נוספו ${preview.ready.length} תלמידים. ${preview.duplicates.length} תלמידים כבר היו קיימים.`);
    setModal(null);
  };

  if (!authReady) {
    return <main lang="he" dir="rtl" className="app-bg grid min-h-[100svh] place-items-center text-sm font-bold text-white">פותחים את ניהול הנוכחות…</main>;
  }

  if (!session) return <AuthScreen />;

  return (
    <Layout
      tab={tab}
      onTabChange={setTab}
      userEmail={session.user.email ?? "מורה"}
      onSignOut={() => { if (supabase) void supabase.auth.signOut(); }}
      attendanceActive={Boolean(activeSessionCourseId && !sessionReadOnly)}
    >
      {(dataLoading || dataError) && (
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${dataError ? "bg-[#FEE2E2] text-[#991B1B]" : "border border-white/15 bg-[#005580] text-white"}`} role={dataError ? "alert" : "status"}>
          {dataError || "מסנכרנים את נתוני הנוכחות…"}
        </div>
      )}
      {tab === "more" && (
        <section className="min-h-[calc(100svh-10rem)] pb-4 text-white">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
            <div>
              <h2 className="sr-only">הכיתות שלכם</h2>
              <p className="mt-1 text-sm font-medium text-white/65">התחילו נוכחות בלחיצה אחת. כל התלמידים מתחילים כנוכחים.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={darkOutlineButton} onClick={() => setModal({ type: "course" })}>+ הוספת כיתה</button>
              <button type="button" className={darkOutlineButton} disabled={!data.courses.length} onClick={() => setModal({ type: "student" })}>+ הוספת תלמיד</button>
              <button type="button" className="min-h-12 rounded-xl px-3 text-sm font-extrabold text-[#B8D8E6] hover:bg-white/10 disabled:opacity-45" disabled={!data.courses.length} onClick={() => setModal({ type: "import" })}>ייבוא תלמידים</button>
            </div>
          </div>
          {data.courses.length ? (
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.courses.map((course) => {
                const studentCount = data.students.filter((student) => student.courseId === course.id && student.active).length;
                const startedToday = todayLogs.some((log) => log.courseId === course.id);
                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    studentCount={studentCount}
                    startedToday={startedToday}
                    onStart={() => startAttendance(course.id)}
                    onEdit={() => setModal({ type: "course", course })}
                    onToggleActive={() => toggleCourse(course.id)}
                    onViewStudents={() => { setStudentCourse(course.id); setTab("students"); }}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState title="אין עדיין כיתות" body="הוסיפו את הכיתה הראשונה, ולאחר מכן הוסיפו אליה תלמידים." action="הוספת כיתה" onAction={() => setModal({ type: "course" })} />
          )}
        </section>
      )}

      {tab === "today" && activeSessionCourseId && activeSessionCourse && (
        <section className={`min-h-[calc(100svh-10rem)] text-white ${sessionReadOnly ? "pb-6" : "pb-28"}`}>
          <button type="button" onClick={() => { setActiveSessionCourseId(null); setSessionReadOnly(false); }} className="mb-3 min-h-10 rounded-xl border border-white/20 px-3 text-sm font-bold text-[#B8D8E6]">חזרה להיום</button>
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-xs font-semibold text-[#B8D8E6]">{sessionReadOnly ? "סיכום נוכחות" : "נוכחות בתהליך"}</p><h2 dir="auto" className="mt-1 text-2xl font-bold">{activeSessionCourse.name}</h2></div>
            <span className="rounded-full border border-white/15 bg-[#005580] px-3 py-1.5 text-xs font-bold">{sessionReadOnly ? "הושלמה" : "בתהליך"}</span>
          </div>
          <div className="mt-4"><SummaryCards logs={activeSessionLogs} /></div>
          {!sessionReadOnly && <p className="mt-3 rounded-xl border border-white/15 bg-[#005580] px-3 py-2.5 text-sm font-semibold text-white">כל התלמידים סומנו כנוכחים. סמנו רק חריגים.</p>}
          <div className="mt-4 inline-flex rounded-xl border border-white/15 bg-[#005580] p-1" role="group" aria-label="סינון רשימת הנוכחות">
            <button type="button" onClick={() => setTodayFilter("all")} className={`min-h-10 rounded-lg px-3 text-xs font-extrabold ${todayFilter === "all" ? "bg-white text-[#002B45]" : "text-[#B8D8E6]"}`}>כל התלמידים</button>
            <button type="button" onClick={() => setTodayFilter("exceptions")} className={`min-h-10 rounded-lg px-3 text-xs font-extrabold ${todayFilter === "exceptions" ? "bg-white text-[#002B45]" : "text-[#B8D8E6]"}`}>חריגים בלבד</button>
          </div>
          <ul className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_16px_40px_rgba(0,18,27,0.25)]">
            {activeSessionLogs.filter((log) => todayFilter === "all" || log.status !== "Present" || Boolean(log.notes)).map((log) => {
              const student = studentsById.get(log.studentId);
              return student ? <AttendanceStudentRow key={log.id} log={log} student={student} onOpen={() => setSelectedAttendanceId(log.id)} /> : null;
            })}
          </ul>
          {todayFilter === "exceptions" && !activeSessionLogs.some((log) => log.status !== "Present" || Boolean(log.notes)) && <p className="mt-4 rounded-2xl border border-white/15 bg-[#005580] p-5 text-center text-sm font-semibold text-[#B8D8E6]">אין חריגים. כל התלמידים מסומנים כנוכחים.</p>}
          {!sessionReadOnly && <FinishAttendanceBar logs={activeSessionLogs} onFinish={() => { setCompletedCourseIds((current) => new Set(current).add(activeSessionCourseId)); setActiveSessionCourseId(null); notify("הנוכחות הושלמה"); }} />}
        </section>
      )}

      {tab === "today" && !activeSessionCourseId && (
        <section className="min-h-[calc(100svh-10rem)] pb-4 text-white">
          <div className="mb-4">
            <h2 className="text-xl font-extrabold">מה מתחילים עכשיו?</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-[#B8D8E6]">בחרו כיתה. כל התלמידים יסומנו כנוכחים כברירת מחדל.</p>
          </div>
          {data.courses.some((course) => course.active) ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.courses.filter((course) => course.active).map((course) => {
                const studentCount = data.students.filter((student) => student.courseId === course.id && student.active).length;
                const startedToday = todayLogs.some((log) => log.courseId === course.id);
                const completed = completedCourseIds.has(course.id);
                const stateLabel = completed ? "הושלמה" : startedToday ? "בתהליך" : "לא התחילה";
                const actionLabel = completed ? "צפייה בסיכום" : startedToday ? "המשך נוכחות" : "התחלת נוכחות";
                return (
                  <article key={course.id} className="rounded-2xl border border-white/15 bg-[#005580] p-4 shadow-[0_14px_34px_rgba(0,18,27,0.24)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 dir="auto" className="truncate text-lg font-extrabold">{course.name}</h3>
                        <p className="mt-1 text-xs font-semibold text-[#B8D8E6]">{studentCount} {studentCount === 1 ? "תלמיד פעיל" : "תלמידים פעילים"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${completed ? "bg-[#DCFCE7] text-[#166534]" : startedToday ? "bg-[#FEF3C7] text-[#92400E]" : "bg-white/10 text-[#B8D8E6]"}`}>{stateLabel}</span>
                    </div>
                    <button
                      type="button"
                      disabled={studentCount === 0}
                      onClick={() => {
                        if (!startedToday) void startAttendance(course.id);
                        else { setTodayFilter("all"); setSessionReadOnly(completed); setActiveSessionCourseId(course.id); }
                      }}
                      className="mt-4 min-h-12 w-full rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white transition hover:bg-[#00B3A4] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/50"
                    >
                      {studentCount === 0 ? "אין תלמידים פעילים" : actionLabel}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="אין כיתות פעילות" body="הוסיפו כיתה או הפעילו כיתה קיימת באזור הניהול." action="מעבר לניהול" onAction={() => setTab("more")} />
          )}
        </section>
      )}

      {tab === "students" && (
        <section className="min-h-[calc(100svh-10rem)] pb-4 text-white">
          <div className="mb-3 sm:mb-5">
            <div>
              <h2 className="sr-only">תלמידים</h2>
              <p className="mt-1 text-sm font-medium text-white/65">ניהול רשימות התלמידים בלי למחוק נוכחות מהעבר.</p>
            </div>
          </div>
          <div className="dark-filter mb-4 grid gap-3 rounded-[18px] border border-white/20 bg-white/[0.05] p-3 sm:grid-cols-[1fr_220px] sm:p-4">
      …109 tokens truncated…ue)} className={fieldClass}>
                <option value="all">כל הכיתות</option>
                {data.courses.map((course) => <option dir="auto" key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
          </div>
          {filteredStudents.length ? (
            <div className="overflow-hidden rounded-[20px] border border-[#CBD5E1] bg-white text-[#0F172A] shadow-[0_16px_36px_rgba(0,24,34,0.16)]">
              <ul className="divide-y divide-[#CBD5E1]">
                {filteredStudents.map((student) => (
                  <li key={student.id} className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#CBD5E1] text-xs font-extrabold text-[#002B45] sm:h-11 sm:w-11" aria-hidden="true">{student.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p dir="auto" className="min-w-0 truncate font-extrabold">{student.name}</p>
                        {!student.active && <span className="rounded-full bg-[#F4F8FA] px-2 py-1 text-[10px] font-extrabold text-[#475569]">לא פעיל</span>}
                      </div>
                      <p dir="auto" className="mt-0.5 truncate text-xs font-semibold text-[#475569]">{coursesById.get(student.courseId)?.name ?? "כיתה לא ידועה"}</p>
                      <p dir="auto" className="truncate text-[11px] font-medium text-[#475569]">{student.email || "אין אימייל"}</p>
                    </div>
                    <StudentActions student={student} onEdit={() => setModal({ type: "student", student })} onToggle={() => toggleStudent(student.id)} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title={data.students.length ? "אין תלמידים תואמים" : "אין עדיין תלמידים"} body={data.students.length ? "נסו חיפוש אחר או סינון לפי כיתה." : "הוסיפו תלמידים לכיתה לפני התחלת הנוכחות."} action={data.students.length ? undefined : "הוספת תלמיד"} onAction={data.students.length ? undefined : () => setModal({ type: "student" })} />
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="min-h-[calc(100svh-10rem)] pb-4 text-white">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
            <div>
              <h2 className="sr-only">היסטוריית נוכחות</h2>
              <p className="mt-1 text-sm font-medium text-white/65">בדקו יום מסוים או ייצאו את הרשומות המסוננות.</p>
            </div>
            <button type="button" className={darkOutlineButton} disabled={!historyLogs.length} onClick={exportCsv}>ייצוא CSV</button>
          </div>
          <div className="dark-filter mb-4 grid gap-3 rounded-[18px] border border-white/20 bg-white/[0.05] p-3 sm:grid-cols-2 sm:p-4">
            <label className="text-xs font-extrabold text-[#475569]">תאריך
              <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="text-xs font-extrabold text-[#475569]">כיתה
              <select value={historyCourse} onChange={(event) => setHistoryCourse(event.target.value)} className={fieldClass}>
                <option value="all">כל הכיתות</option>
                {data.courses.map((course) => <option dir="auto" key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
          </div>
          <SummaryCards logs={historyLogs} />
          {historyLogs.length ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {historyLogs.map((log) => (
                  <article key={log.id} className="rounded-2xl border border-[#CBD5E1] bg-white p-3 text-[#0F172A] shadow-[0_10px_24px_rgba(0,18,27,0.16)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 dir="auto" className="truncate text-sm font-extrabold">{studentsById.get(log.studentId)?.name ?? "תלמיד לא ידוע"}</h3>
                        <p dir="auto" className="mt-0.5 truncate text-xs font-semibold text-[#475569]">{coursesById.get(log.courseId)?.name ?? "כיתה לא ידועה"}</p>
                      </div>
                      <StatusBadge status={log.status} />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[#475569]">{log.time}</p>
                    {log.notes && <p dir="auto" className="mt-1.5 text-sm font-medium leading-5 text-[#475569]">{log.notes}</p>}
                  </article>
                ))}
              </div>
          ) : (
            <div className="mt-4"><EmptyState title="אין רשומות בתצוגה הזו" body="נסו תאריך או כיתה אחרים, או התחילו נוכחות להיום." action="מעבר להיום" onAction={() => setTab("today")} /></div>
          )}
        </section>
      )}

      {modal?.type === "course" && (
        <CourseForm
          course={modal.course}
          onClose={() => setModal(null)}
          onSave={async (course) => {
            try {
              await saveCourse(course);
              await refreshData();
              notify(modal.course ? "הכיתה עודכנה" : "הכיתה נוספה");
              setModal(null);
            } catch (error) {
              console.error(error);
              notify("לא הצלחנו לשמור את הכיתה.");
            }
          }}
        />
      )}
      {modal?.type === "student" && (
        <StudentForm
          student={modal.student}
          courses={data.courses}
          onClose={() => setModal(null)}
          onSave={async (student) => {
            try {
              await saveStudent(student);
              await refreshData();
              notify(modal.student ? "התלמיד עודכן" : "התלמיד נוסף");
              setModal(null);
            } catch (error) {
              console.error(error);
              notify("לא הצלחנו לשמור את התלמיד.");
            }
          }}
        />
      )}
      {modal?.type === "import" && (
        <StudentImportForm
          courses={data.courses}
          students={data.students}
          onClose={() => setModal(null)}
          onImport={importStudents}
        />
      )}
      {selectedAttendance && selectedAttendanceStudent && (
        <StudentActionBottomSheet
          log={selectedAttendance}
          student={selectedAttendanceStudent}
          onClose={() => setSelectedAttendanceId(null)}
          onStatusChange={(status) => void updateAttendance(selectedAttendance.id, { status })}
          onNotesChange={(notes) => void updateAttendance(selectedAttendance.id, { notes })}
        />
      )}

      <div className={`pointer-events-none fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-2xl bg-[#0F172A] px-4 py-3 text-center text-sm font-bold text-white shadow-[0_16px_36px_rgba(11,59,73,0.20)] transition lg:bottom-6 ${toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} role="status" aria-live="polite">{toast}</div>
    </Layout>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <section className="rounded-[20px] border border-dashed border-[#CBD5E1] bg-white/95 px-5 py-10 text-center text-[#0F172A] shadow-[0_14px_34px_rgba(0,24,34,0.12)]">
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[#475569]">{body}</p>
      {action && onAction && <button type="button" onClick={onAction} className={`${primaryButton} mt-5`}>{action}</button>}
    </section>
  );
}

function StudentActions({ student, onEdit, onToggle }: { student: Student; onEdit: () => void; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative sm:hidden">
        <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={`פעולות נוספות עבור ${student.name}`} className="grid h-10 w-10 place-items-center rounded-xl text-[#475569] hover:bg-[#FFFFFF] hover:text-[#002B45]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        </button>
        {open && (
          <div className="absolute end-0 top-11 z-20 min-w-28 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] p-1.5 shadow-[0_12px_30px_rgba(19,69,84,0.12)]">
            <button type="button" onClick={() => { setOpen(false); onEdit(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#002B45] hover:bg-[#FFFFFF]">עריכה</button>
            <button type="button" onClick={() => { setOpen(false); onToggle(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#475569] hover:bg-[#FFFFFF]">{student.active ? "השבתה" : "הפעלה"}</button>
          </div>
        )}
      </div>
      <div className="hidden gap-2 sm:flex">
        <button type="button" className={secondaryButton} onClick={onEdit}>עריכה</button>
        <button type="button" className={secondaryButton} onClick={onToggle}>{student.active ? "השבתה" : "הפעלה"}</button>
      </div>
    </>
  );
}

function StudentImportForm({
  courses,
  students,
  onClose,
  onImport,
}: {
  courses: Course[];
  students: Student[];
  onClose: () => void;
  onImport: (courseId: string, text: string) => Promise<void>;
}) {
  const [courseId, setCourseId] = useState(courses.find((course) => course.active)?.id ?? courses[0]?.id ?? "");
  const [text, setText] = useState("");
  const [step, setStep] = useState<"input" | "preview">("input");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const preview = useMemo(() => prepareStudentImport(text, courseId, students), [courseId, students, text]);

  const confirmImport = async () => {
    if (!courseId || preview.ready.length === 0) return;
    setImporting(true);
    setError("");
    try {
      await onImport(courseId, text);
    } catch (importError) {
      console.error(importError);
      setError("לא הצלחנו לייבא את התלמידים. בדקו את החיבור ונסו שוב.");
      setImporting(false);
    }
  };

  return (
    <Modal title="ייבוא תלמידים" onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-xs font-extrabold text-[#475569]">כיתה
          <select required value={courseId} onChange={(event) => { setCourseId(event.target.value); setStep("input"); }} className={fieldClass}>
            {courses.map((course) => <option dir="auto" key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </label>

        {step === "input" ? (
          <>
            <div className="rounded-2xl bg-[#FFFFFF] p-3 text-sm font-medium leading-6 text-[#475569]">
              <p>הדביקו רשימת תלמידים. כל שורה היא תלמיד. אפשר להדביק רק שם, או שם ואימייל מופרדים בפסיק או בטאב.</p>
              <pre dir="auto" className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-[#FFFFFF] p-3 text-xs leading-5 text-[#475569]">{"מיה כהן\nנועם לוי, noam@example.com\nדניאל פרץ\tdaniel@example.com"}</pre>
            </div>
            <label className="block text-xs font-extrabold text-[#475569]">רשימת תלמידים
              <textarea
                autoFocus
                dir="auto"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="הדביקו כאן שמות או עמודות מ-Google Sheets / Excel"
                className={`${fieldClass} min-h-44 resize-y py-3 leading-6`}
              />
            </label>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" className={secondaryButton} onClick={onClose}>ביטול</button>
              <button type="button" className={primaryButton} disabled={!courseId || !text.trim()} onClick={() => { setError(""); setStep("preview"); }}>בדיקת הרשימה</button>
            </div>
          </>
        ) : (
          <>
            <section aria-label="סיכום הייבוא" className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#DCFCE7] p-2.5 text-center text-[#166534]"><strong className="block text-xl font-extrabold">{preview.ready.length}</strong><span className="text-[10px] font-bold">מוכנים לייבוא</span></div>
              <div className="rounded-xl bg-[#FEF3C7] p-2.5 text-center text-[#92400E]"><strong className="block text-xl font-extrabold">{preview.duplicates.length}</strong><span className="text-[10px] font-bold">כפולים יידלגו</span></div>
              <div className="rounded-xl bg-[#FEE2E2] p-2.5 text-center text-[#991B1B]"><strong className="block text-xl font-extrabold">{preview.invalid.length}</strong><span className="text-[10px] font-bold">שורות לא תקינות</span></div>
            </section>

            {preview.ready.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold text-[#475569]">תלמידים מוכנים לייבוא</h3>
                <ul className="mt-2 max-h-40 divide-y divide-[#CBD5E1] overflow-y-auto rounded-2xl border border-[#CBD5E1] bg-[#FFFFFF]">
                  {preview.ready.map((row) => (
                    <li key={`${row.line}-${row.name}`} className="px-3 py-2">
                      <p dir="auto" className="truncate text-sm font-bold">{row.name}</p>
                      {row.email && <p dir="auto" className="truncate text-xs font-medium text-[#475569]">{row.email}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {preview.invalid.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold text-[#991B1B]">שורות שדורשות תיקון</h3>
                <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
                  {preview.invalid.map((row) => (
                    <li key={`${row.line}-${row.input}`} className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-xs text-[#991B1B]">
                      <span className="font-extrabold">שורה {row.line}: {row.reason}</span>
                      <span dir="auto" className="mt-0.5 block truncate font-medium">{row.input}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {error && <p role="alert" className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-sm font-bold text-[#991B1B]">{error}</p>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" className={secondaryButton} disabled={importing} onClick={() => setStep("input")}>חזרה לעריכה</button>
              <button type="button" className={primaryButton} disabled={importing || preview.ready.length === 0} onClick={() => void confirmImport()}>{importing ? "מייבאים…" : `ייבוא ${preview.ready.length} תלמידים`}</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function CourseForm({ course, onClose, onSave }: { course?: Course; onClose: () => void; onSave: (course: Course) => void }) {
  const [name, setName] = useState(course?.name ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({ id: course?.id ?? makeId(), name: name.trim(), description: description.trim(), active: course?.active ?? true });
  };
  return (
    <Modal title={course ? "עריכת כיתה" : "הוספת כיתה"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-extrabold text-[#475569]">שם הכיתה
          <input autoFocus required dir="auto" value={name} onChange={(event) => setName(event.target.value)} placeholder="למשל: מתמטיקה י׳1" className={fieldClass} />
        </label>
        <label className="block text-xs font-extrabold text-[#475569]">תיאור <span className="font-medium">(אופציונלי)</span>
          <textarea dir="auto" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="מה לומדים בכיתה הזו?" className={`${fieldClass} min-h-24 py-3`} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={secondaryButton} onClick={onClose}>ביטול</button>
          <button type="submit" className={primaryButton}>{course ? "שמירת שינויים" : "הוספת כיתה"}</button>
        </div>
      </form>
    </Modal>
  );
}

function StudentForm({ student, courses, onClose, onSave }: { student?: Student; courses: Course[]; onClose: () => void; onSave: (student: Student) => void }) {
  const availableCourses = courses.filter((course) => course.active || course.id === student?.courseId);
  const [name, setName] = useState(student?.name ?? "");
  const [email, setEmail] = useState(student?.email ?? "");
  const [courseId, setCourseId] = useState(student?.courseId ?? availableCourses[0]?.id ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !courseId) return;
    onSave({ id: student?.id ?? makeId(), name: name.trim(), email: email.trim(), courseId, active: student?.active ?? true });
  };
  return (
    <Modal title={student ? "עריכת תלמיד" : "הוספת תלמיד"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-extrabold text-[#475569]">שם התלמיד
          <input autoFocus required dir="auto" value={name} onChange={(event) => setName(event.target.value)} placeholder="שם מלא" className={fieldClass} />
        </label>
        <label className="block text-xs font-extrabold text-[#475569]">אימייל <span className="font-medium">(אופציונלי)</span>
          <input type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="student@example.edu" className={`${fieldClass} text-left`} />
        </label>
        <label className="block text-xs font-extrabold text-[#475569]">כיתה
          <select required value={courseId} onChange={(event) => setCourseId(event.target.value)} className={fieldClass}>
            {availableCourses.map((course) => <option dir="auto" key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={secondaryButton} onClick={onClose}>ביטול</button>
          <button type="submit" className={primaryButton}>{student ? "שמירת שינויים" : "הוספת תלמיד"}</button>
        </div>
      </form>
    </Modal>
  );
}

