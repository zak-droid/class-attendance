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
import { AttendanceRow, CourseCard, Layout, Modal, StatusBadge, SummaryCards, statusLabels } from "./components";
import { prepareStudentImport } from "./student-import";
import { supabase } from "./supabase";
import type { AppData, AppTab, AttendanceStatus, Course, Student } from "./types";
import { localDateKey, localTimeKey, makeId } from "./utils";

type ModalState =
  | { type: "course"; course?: Course }
  | { type: "student"; student?: Student }
  | { type: "import" }
  | null;

const fieldClass = "mt-1.5 min-h-12 w-full rounded-xl border border-[#BFCFD6] bg-white px-3.5 text-sm font-semibold text-[#102A34] outline-none transition placeholder:text-[#8A9DA5] focus:border-[#1680A2] focus:ring-2 focus:ring-[#1680A2]/20";
const secondaryButton = "min-h-12 rounded-2xl border border-[#D5E4EA] bg-[#FFFFFF] px-4 text-sm font-extrabold text-[#0F4C5C] transition hover:bg-[#F4FAFC]";
const primaryButton = "min-h-12 rounded-2xl bg-[#0F4C5C] px-4 text-sm font-extrabold text-white transition hover:bg-[#0B3B49] disabled:cursor-not-allowed disabled:bg-[#9FB6BF]";
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
  const [todayCourse, setTodayCourse] = useState("all");
  const [todayFilter, setTodayFilter] = useState<"all" | "exceptions">("all");
  const [studentCourse, setStudentCourse] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [historyDate, setHistoryDate] = useState(today);
  const [historyCourse, setHistoryCourse] = useState("all");

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
  const courseTodayLogs = useMemo(
    () => todayLogs.filter((log) => todayCourse === "all" || log.courseId === todayCourse),
    [todayCourse, todayLogs],
  );
  const visibleTodayLogs = useMemo(
    () => courseTodayLogs.filter((log) => todayFilter === "all" || log.status !== "Present"),
    [courseTodayLogs, todayFilter],
  );

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
      setTodayCourse(courseId);
      setTab("today");
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
    return <main lang="he" dir="rtl" className="app-bg grid min-h-[100svh] place-items-center bg-[#EAF3F6] text-sm font-bold text-[#0F4C5C]">פותחים את ניהול הנוכחות…</main>;
  }

  if (!session) return <AuthScreen />;

  return (
    <Layout
      tab={tab}
      onTabChange={setTab}
      userEmail={session.user.email ?? "מורה"}
      onSignOut={() => { if (supabase) void supabase.auth.signOut(); }}
    >
      {(dataLoading || dataError) && (
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${dataError ? "bg-[#FBE7E5] text-[#B5544B]" : "bg-[#DDEFF2] text-[#0F4C5C]"}`} role={dataError ? "alert" : "status"}>
          {dataError || "מסנכרנים את נתוני הנוכחות…"}
        </div>
      )}
      {tab === "courses" && (
        <section className="min-h-[calc(100svh-10rem)] pb-4 text-white">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
            <div>
              <h2 className="sr-only">הכיתות שלכם</h2>
              <p className="mt-1 text-sm font-medium text-white/65">התחילו נוכחות בלחיצה אחת. כל התלמידים מתחילים כנוכחים.</p>
            </div>
            <button type="button" className={darkOutlineButton} onClick={() => setModal({ type: "course" })}>+ הוספת כיתה</button>
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

      {tab === "today" && (
        <section className="min-h-[calc(100svh-10rem)] pb-4 text-white">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 sm:mb-4 sm:gap-3">
            <div>
              <h2 className="sr-only">הנוכחות של היום</h2>
              <p className="mt-0.5 text-xs font-medium text-white/65 sm:mt-1 sm:text-sm">לחצו על סטטוס כדי לעדכן. השינויים נשמרים אוטומטית.</p>
            </div>
            {todayLogs.length > 0 && (
              <label className="w-full text-xs font-extrabold text-white/70 sm:w-auto">
                כיתה
                <select value={todayCourse} onChange={(event) => setTodayCourse(event.target.value)} className={`${fieldClass} mt-1 w-full sm:min-w-48`}>
                  <option value="all">כל הכיתות</option>
                  {data.courses.map((course) => <option dir="auto" value={course.id} key={course.id}>{course.name}</option>)}
                </select>
              </label>
            )}
          </div>
          {todayLogs.length === 0 ? (
            <section className="rounded-[20px] border border-white/15 bg-white/[0.06] p-4 shadow-[0_18px_46px_rgba(0,18,27,0.24)] sm:p-5">
              <h3 className="text-lg font-extrabold">מה מתחילים עכשיו?</h3>
              <p className="mt-1 text-sm font-medium leading-6 text-white/70">בחרו כיתה כדי להתחיל נוכחות. כל התלמידים יסומנו כנוכחים כברירת מחדל.</p>
              {data.courses.some((course) => course.active) ? (
                <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/15 sm:mt-4">
                  {data.courses.filter((course) => course.active).map((course) => {
                    const studentCount = data.students.filter((student) => student.courseId === course.id && student.active).length;
                    const startedToday = todayLogs.some((log) => log.courseId === course.id);
                    return (
                      <article key={course.id} className="flex flex-wrap items-center gap-2.5 p-2.5 sm:flex-nowrap sm:gap-3 sm:p-3">
                        <div className="min-w-0 flex-1">
                          <h4 dir="auto" className="truncate text-sm font-extrabold">{course.name}</h4>
                          <p className="mt-1 text-xs font-semibold text-white/60">{studentCount} {studentCount === 1 ? "תלמיד פעיל" : "תלמידים פעילים"} · {startedToday ? "התחילה היום" : "לא התחילה"}</p>
                        </div>
                        <button type="button" disabled={studentCount === 0} onClick={() => startedToday ? setTodayCourse(course.id) : void startAttendance(course.id)} className="min-h-11 w-full whitespace-nowrap rounded-xl bg-white px-4 text-sm font-extrabold text-[#073B4C] disabled:opacity-40 sm:w-auto">{startedToday ? "פתיחת נוכחות" : "התחלת נוכחות"}</button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-[#F4FAFC] p-4 text-sm font-semibold text-[#5B7180]">
                  אין כרגע כיתות פעילות.
                  <button type="button" onClick={() => setTab("courses")} className="mt-3 block min-h-10 rounded-xl px-3 font-extrabold text-[#0F4C5C] hover:bg-[#FFFFFF]">מעבר לכיתות</button>
                </div>
              )}
            </section>
          ) : (
            <>
              <div className="mb-2 inline-flex rounded-xl border border-white/20 bg-white/[0.06] p-1 sm:mb-3" role="group" aria-label="סינון רשימת הנוכחות">
                <button type="button" aria-pressed={todayFilter === "all"} onClick={() => setTodayFilter("all")} className={`min-h-9 rounded-lg px-3 text-xs font-extrabold ${todayFilter === "all" ? "bg-white text-[#073B4C]" : "text-white/70 hover:bg-white/10"}`}>הכל</button>
                <button type="button" aria-pressed={todayFilter === "exceptions"} onClick={() => setTodayFilter("exceptions")} className={`min-h-9 rounded-lg px-3 text-xs font-extrabold ${todayFilter === "exceptions" ? "bg-white text-[#073B4C]" : "text-white/70 hover:bg-white/10"}`}>חריגים בלבד</button>
              </div>
              <SummaryCards logs={courseTodayLogs} />
              {visibleTodayLogs.length ? (
                <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
                  {data.courses
                    .filter((course) => visibleTodayLogs.some((log) => log.courseId === course.id))
                    .map((course) => {
                      const courseLogs = visibleTodayLogs.filter((log) => log.courseId === course.id);
                      return (
                        <section key={course.id} className="rounded-[20px] border border-[#D5E4EA] bg-[#F9FCFD] p-3 text-[#102A34] shadow-[0_18px_42px_rgba(0,24,34,0.16)] sm:p-4" aria-labelledby={`today-${course.id}`}>
                          <div className="mb-2 flex items-end justify-between gap-3 sm:mb-3">
                            <div>
                              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#5B7180]">כיתה</p>
                              <h3 dir="auto" id={`today-${course.id}`} className="mt-1 text-lg font-extrabold">{course.name}</h3>
                            </div>
                            <p className="text-xs font-bold text-[#5B7180]">{courseLogs.length} {courseLogs.length === 1 ? "תלמיד" : "תלמידים"}</p>
                          </div>
                          <ul className="grid gap-2 xl:grid-cols-2">
                            {courseLogs.map((log) => {
                              const student = studentsById.get(log.studentId);
                              return student ? (
                                <AttendanceRow
                                  key={log.id}
                                  log={log}
                                  student={student}
                                  onStatusChange={(status) => updateAttendance(log.id, { status })}
                                  onNotesChange={(notes) => updateAttendance(log.id, { notes })}
                                />
                              ) : null;
                            })}
                          </ul>
                        </section>
                      );
                    })}
                </div>
              ) : (
                <section className="mt-4 rounded-[20px] border border-dashed border-[#C7DFE6] bg-[#FFFFFF]/75 px-5 py-8 text-center">
                  <h3 className="text-base font-extrabold">{todayFilter === "exceptions" ? "אין חריגים בתצוגה הזו" : "אין רשומות לכיתה הזו"}</h3>
                  <p className="mt-1 text-sm font-medium text-white/65">{todayFilter === "exceptions" ? "כל התלמידים המסוננים מסומנים כנוכחים." : "בחרו כיתה אחרת כדי להציג את הנוכחות שלה."}</p>
                </section>
              )}
            </>
          )}
        </section>
      )}

      {tab === "students" && (
        <section className="min-h-[calc(100svh-10rem)] pb-4 text-white">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
            <div>
              <h2 className="sr-only">תלמידים</h2>
              <p className="mt-1 text-sm font-medium text-white/65">ניהול רשימות התלמידים בלי למחוק נוכחות מהעבר.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={darkOutlineButton} disabled={!data.courses.length} onClick={() => setModal({ type: "student" })}>+ הוספת תלמיד</button>
              <button type="button" className="min-h-12 rounded-xl px-3 text-sm font-extrabold text-white/70 hover:bg-white/10 disabled:opacity-45" disabled={!data.courses.length} onClick={() => setModal({ type: "import" })}>ייבוא רשימה</button>
            </div>
          </div>
          <div className="dark-filter mb-4 grid gap-3 rounded-[18px] border border-white/20 bg-white/[0.05] p-3 sm:grid-cols-[1fr_220px] sm:p-4">
            <label className="text-xs font-extrabold text-[#5B7180]">חיפוש
              <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="שם או אימייל" className={fieldClass} />
            </label>
            <label className="text-xs font-extrabold text-[#5B7180]">כיתה
              <select value={studentCourse} onChange={(event) => setStudentCourse(event.target.value)} className={fieldClass}>
                <option value="all">כל הכיתות</option>
                {data.courses.map((course) => <option dir="auto" key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
          </div>
          {filteredStudents.length ? (
            <div className="overflow-hidden rounded-[20px] border border-[#D5E4EA] bg-white text-[#102A34] shadow-[0_16px_36px_rgba(0,24,34,0.16)]">
              <ul className="divide-y divide-[#DCE9EE]">
                {filteredStudents.map((student) => (
                  <li key={student.id} className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#DDEFF2] text-xs font-extrabold text-[#0F4C5C] sm:h-11 sm:w-11" aria-hidden="true">{student.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p dir="auto" className="min-w-0 truncate font-extrabold">{student.name}</p>
                        {!student.active && <span className="rounded-full bg-[#EAF0F4] px-2 py-1 text-[10px] font-extrabold text-[#4D6470]">לא פעיל</span>}
                      </div>
                      <p dir="auto" className="mt-0.5 truncate text-xs font-semibold text-[#5B7180]">{coursesById.get(student.courseId)?.name ?? "כיתה לא ידועה"}</p>
                      <p dir="auto" className="truncate text-[11px] font-medium text-[#718692]">{student.email || "אין אימייל"}</p>
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
            <label className="text-xs font-extrabold text-[#5B7180]">תאריך
              <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="text-xs font-extrabold text-[#5B7180]">כיתה
              <select value={historyCourse} onChange={(event) => setHistoryCourse(event.target.value)} className={fieldClass}>
                <option value="all">כל הכיתות</option>
                {data.courses.map((course) => <option dir="auto" key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
          </div>
          <SummaryCards logs={historyLogs} />
          {historyLogs.length ? (
            <>
              <div className="mt-3 grid gap-2 md:hidden">
                {historyLogs.map((log) => (
                  <article key={log.id} className="rounded-2xl border border-[#D5E4EA] bg-white p-3 text-[#102A34] shadow-[0_10px_24px_rgba(0,24,34,0.14)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 dir="auto" className="truncate text-sm font-extrabold">{studentsById.get(log.studentId)?.name ?? "תלמיד לא ידוע"}</h3>
                        <p dir="auto" className="mt-0.5 truncate text-xs font-semibold text-[#5B7180]">{coursesById.get(log.courseId)?.name ?? "כיתה לא ידועה"}</p>
                      </div>
                      <StatusBadge status={log.status} />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[#5B7180]">{log.time}</p>
                    {log.notes && <p dir="auto" className="mt-1.5 text-sm font-medium leading-5 text-[#5B7180]">{log.notes}</p>}
                  </article>
                ))}
              </div>
              <div className="mt-4 hidden overflow-hidden rounded-[20px] border border-[#D5E4EA] bg-white text-[#102A34] shadow-[0_16px_36px_rgba(0,24,34,0.16)] md:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-right text-sm">
                    <thead className="bg-[#F4FAFC] text-xs uppercase tracking-[0.08em] text-[#5B7180]">
                      <tr><th className="p-4">תלמיד</th><th className="p-4">כיתה</th><th className="p-4">שעה</th><th className="p-4">סטטוס</th><th className="p-4">הערות</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE9EE]">
                      {historyLogs.map((log) => (
                        <tr key={log.id}>
                          <td dir="auto" className="p-4 font-extrabold">{studentsById.get(log.studentId)?.name ?? "תלמיד לא ידוע"}</td>
                          <td dir="auto" className="p-4 font-medium text-[#5B7180]">{coursesById.get(log.courseId)?.name ?? "כיתה לא ידועה"}</td>
                          <td className="p-4 font-medium text-[#5B7180]">{log.time}</td>
                          <td className="p-4"><StatusBadge status={log.status} /></td>
                          <td dir="auto" className="max-w-[280px] truncate p-4 font-medium text-[#5B7180]">{log.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4"><EmptyState title="אין רשומות בתצוגה הזו" body="נסו תאריך או כיתה אחרים, או התחילו נוכחות להיום." action="מעבר לכיתות" onAction={() => setTab("courses")} /></div>
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

      <div className={`pointer-events-none fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-2xl bg-[#102A34] px-4 py-3 text-center text-sm font-bold text-white shadow-[0_16px_36px_rgba(11,59,73,0.20)] transition lg:bottom-6 ${toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} role="status" aria-live="polite">{toast}</div>
    </Layout>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <section className="rounded-[20px] border border-dashed border-[#C7DFE6] bg-white/95 px-5 py-10 text-center text-[#102A34] shadow-[0_14px_34px_rgba(0,24,34,0.12)]">
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[#5B7180]">{body}</p>
      {action && onAction && <button type="button" onClick={onAction} className={`${primaryButton} mt-5`}>{action}</button>}
    </section>
  );
}

function StudentActions({ student, onEdit, onToggle }: { student: Student; onEdit: () => void; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative sm:hidden">
        <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={`פעולות נוספות עבור ${student.name}`} className="grid h-10 w-10 place-items-center rounded-xl text-[#5B7180] hover:bg-[#F4FAFC] hover:text-[#0F4C5C]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        </button>
        {open && (
          <div className="absolute end-0 top-11 z-20 min-w-28 rounded-xl border border-[#D5E4EA] bg-[#FFFFFF] p-1.5 shadow-[0_12px_30px_rgba(19,69,84,0.12)]">
            <button type="button" onClick={() => { setOpen(false); onEdit(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#0F4C5C] hover:bg-[#F4FAFC]">עריכה</button>
            <button type="button" onClick={() => { setOpen(false); onToggle(); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold text-[#5B7180] hover:bg-[#F4FAFC]">{student.active ? "השבתה" : "הפעלה"}</button>
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
        <label className="block text-xs font-extrabold text-[#5B7180]">כיתה
          <select required value={courseId} onChange={(event) => { setCourseId(event.target.value); setStep("input"); }} className={fieldClass}>
            {courses.map((course) => <option dir="auto" key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </label>

        {step === "input" ? (
          <>
            <div className="rounded-2xl bg-[#F4FAFC] p-3 text-sm font-medium leading-6 text-[#5B7180]">
              <p>הדביקו רשימת תלמידים. כל שורה היא תלמיד. אפשר להדביק רק שם, או שם ואימייל מופרדים בפסיק או בטאב.</p>
              <pre dir="auto" className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-[#FFFFFF] p-3 text-xs leading-5 text-[#4D6470]">{"מיה כהן\nנועם לוי, noam@example.com\nדניאל פרץ\tdaniel@example.com"}</pre>
            </div>
            <label className="block text-xs font-extrabold text-[#5B7180]">רשימת תלמידים
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
              <div className="rounded-xl bg-[#E7F2E9] p-2.5 text-center text-[#276749]"><strong className="block text-xl font-extrabold">{preview.ready.length}</strong><span className="text-[10px] font-bold">מוכנים לייבוא</span></div>
              <div className="rounded-xl bg-[#FFF1D6] p-2.5 text-center text-[#9A6415]"><strong className="block text-xl font-extrabold">{preview.duplicates.length}</strong><span className="text-[10px] font-bold">כפולים יידלגו</span></div>
              <div className="rounded-xl bg-[#FBE7E5] p-2.5 text-center text-[#B5544B]"><strong className="block text-xl font-extrabold">{preview.invalid.length}</strong><span className="text-[10px] font-bold">שורות לא תקינות</span></div>
            </section>

            {preview.ready.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold text-[#5B7180]">תלמידים מוכנים לייבוא</h3>
                <ul className="mt-2 max-h-40 divide-y divide-[#DCE9EE] overflow-y-auto rounded-2xl border border-[#DCE9EE] bg-[#FFFFFF]">
                  {preview.ready.map((row) => (
                    <li key={`${row.line}-${row.name}`} className="px-3 py-2">
                      <p dir="auto" className="truncate text-sm font-bold">{row.name}</p>
                      {row.email && <p dir="auto" className="truncate text-xs font-medium text-[#5B7180]">{row.email}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {preview.invalid.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold text-[#B5544B]">שורות שדורשות תיקון</h3>
                <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
                  {preview.invalid.map((row) => (
                    <li key={`${row.line}-${row.input}`} className="rounded-xl bg-[#FBE7E5] px-3 py-2 text-xs text-[#B5544B]">
                      <span className="font-extrabold">שורה {row.line}: {row.reason}</span>
                      <span dir="auto" className="mt-0.5 block truncate font-medium">{row.input}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {error && <p role="alert" className="rounded-xl bg-[#FBE7E5] px-3 py-2 text-sm font-bold text-[#B5544B]">{error}</p>}
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
        <label className="block text-xs font-extrabold text-[#5B7180]">שם הכיתה
          <input autoFocus required dir="auto" value={name} onChange={(event) => setName(event.target.value)} placeholder="למשל: מתמטיקה י׳1" className={fieldClass} />
        </label>
        <label className="block text-xs font-extrabold text-[#5B7180]">תיאור <span className="font-medium">(אופציונלי)</span>
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
        <label className="block text-xs font-extrabold text-[#5B7180]">שם התלמיד
          <input autoFocus required dir="auto" value={name} onChange={(event) => setName(event.target.value)} placeholder="שם מלא" className={fieldClass} />
        </label>
        <label className="block text-xs font-extrabold text-[#5B7180]">אימייל <span className="font-medium">(אופציונלי)</span>
          <input type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="student@example.edu" className={`${fieldClass} text-left`} />
        </label>
        <label className="block text-xs font-extrabold text-[#5B7180]">כיתה
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
