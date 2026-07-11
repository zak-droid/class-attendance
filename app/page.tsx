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
import { supabase } from "./supabase";
import type { AppData, AppTab, AttendanceStatus, Course, Student } from "./types";
import { localDateKey, localTimeKey, makeId } from "./utils";

type ModalState =
  | { type: "course"; course?: Course }
  | { type: "student"; student?: Student }
  | null;

const fieldClass = "mt-1.5 min-h-12 w-full rounded-2xl border border-[#DCE4DF] bg-white px-3.5 text-sm font-semibold text-[#17211D] outline-none transition placeholder:text-[#94A09A] focus:border-[#174A3A] focus:ring-2 focus:ring-[#174A3A]/15";
const secondaryButton = "min-h-12 rounded-2xl border border-[#DCE4DF] bg-white px-4 text-sm font-extrabold text-[#174A3A] transition hover:bg-[#F7F9F7]";
const primaryButton = "min-h-12 rounded-2xl bg-[#174A3A] px-4 text-sm font-extrabold text-white transition hover:bg-[#103D2F] disabled:cursor-not-allowed disabled:bg-[#A9B5AF]";

export default function Home() {
  const today = localDateKey();
  const [data, setData] = useState<AppData>({ courses: [], students: [], attendance: [] });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [tab, setTab] = useState<AppTab>("courses");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [todayCourse, setTodayCourse] = useState("all");
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
  const visibleTodayLogs = useMemo(
    () => todayLogs.filter((log) => todayCourse === "all" || log.courseId === todayCourse),
    [todayCourse, todayLogs],
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

  if (!authReady) {
    return <main lang="he" dir="rtl" className="app-bg grid min-h-[100svh] place-items-center bg-[#EEF2EF] text-sm font-bold text-[#174A3A]">פותחים את ניהול הנוכחות…</main>;
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
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${dataError ? "bg-[#F8E2E1] text-[#A13D3D]" : "bg-[#DCEAE4] text-[#174A3A]"}`} role={dataError ? "alert" : "status"}>
          {dataError || "מסנכרנים את נתוני הנוכחות…"}
        </div>
      )}
      {tab === "courses" && (
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.025em]">הכיתות שלכם</h2>
              <p className="mt-1 text-sm font-medium text-[#66716B]">התחילו נוכחות בלחיצה אחת. כל התלמידים מתחילים כנוכחים.</p>
            </div>
            <button type="button" className={primaryButton} onClick={() => setModal({ type: "course" })}>+ הוספת כיתה</button>
          </div>
          {data.courses.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.025em]">הנוכחות של היום</h2>
              <p className="mt-1 text-sm font-medium text-[#66716B]">לחצו על סטטוס כדי לעדכן. השינויים נשמרים אוטומטית.</p>
            </div>
            <label className="text-xs font-extrabold text-[#66716B]">
              כיתה
              <select value={todayCourse} onChange={(event) => setTodayCourse(event.target.value)} className={`${fieldClass} mt-1 min-w-48`}>
                <option value="all">כל הכיתות</option>
                {data.courses.map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}
              </select>
            </label>
          </div>
          <SummaryCards logs={visibleTodayLogs} />
          {visibleTodayLogs.length ? (
            <div className="mt-4 space-y-4">
              {data.courses
                .filter((course) => visibleTodayLogs.some((log) => log.courseId === course.id))
                .map((course) => {
                  const courseLogs = visibleTodayLogs.filter((log) => log.courseId === course.id);
                  return (
                    <section key={course.id} className="soft-card rounded-[20px] border border-[#DCE4DF] bg-white p-4 sm:p-5" aria-labelledby={`today-${course.id}`}>
                      <div className="mb-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#66716B]">כיתה</p>
                          <h3 id={`today-${course.id}`} className="mt-1 text-lg font-extrabold">{course.name}</h3>
                        </div>
                        <p className="text-xs font-bold text-[#66716B]">{courseLogs.length} {courseLogs.length === 1 ? "תלמיד" : "תלמידים"}</p>
                      </div>
                      <ul className="grid gap-2.5 xl:grid-cols-2">
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
            <div className="mt-4"><EmptyState title="לא התחילה נוכחות היום" body="בחרו כיתה והתחילו נוכחות להיום. תלמידים פעילים יסומנו כנוכחים כברירת מחדל." action="בחירת כיתה" onAction={() => setTab("courses")} /></div>
          )}
        </section>
      )}

      {tab === "students" && (
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.025em]">תלמידים</h2>
              <p className="mt-1 text-sm font-medium text-[#66716B]">ניהול רשימות התלמידים בלי למחוק נוכחות מהעבר.</p>
            </div>
            <button type="button" className={primaryButton} disabled={!data.courses.length} onClick={() => setModal({ type: "student" })}>+ הוספת תלמיד</button>
          </div>
          <div className="mb-4 grid gap-3 rounded-[20px] border border-[#DCE4DF] bg-white p-3 sm:grid-cols-[1fr_220px] sm:p-4">
            <label className="text-xs font-extrabold text-[#66716B]">חיפוש
              <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="שם או אימייל" className={fieldClass} />
            </label>
            <label className="text-xs font-extrabold text-[#66716B]">כיתה
              <select value={studentCourse} onChange={(event) => setStudentCourse(event.target.value)} className={fieldClass}>
                <option value="all">כל הכיתות</option>
                {data.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
          </div>
          {filteredStudents.length ? (
            <div className="overflow-hidden rounded-[20px] border border-[#DCE4DF] bg-white shadow-[0_8px_24px_rgba(20,52,41,0.06)]">
              <ul className="divide-y divide-[#E5EBE7]">
                {filteredStudents.map((student) => (
                  <li key={student.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#DCEAE4] text-xs font-extrabold text-[#174A3A]" aria-hidden="true">{student.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold">{student.name}</p>
                        {!student.active && <span className="rounded-full bg-[#E8ECEF] px-2 py-1 text-[10px] font-extrabold text-[#56616D]">לא פעיל</span>}
                      </div>
                      <p className="truncate text-xs font-medium text-[#66716B]">{student.email || "אין אימייל"} · {coursesById.get(student.courseId)?.name ?? "כיתה לא ידועה"}</p>
                    </div>
                    <div className="ms-auto flex gap-2">
                      <button type="button" className={secondaryButton} onClick={() => setModal({ type: "student", student })}>עריכה</button>
                      <button type="button" className={secondaryButton} onClick={() => toggleStudent(student.id)}>{student.active ? "השבתה" : "הפעלה"}</button>
                    </div>
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
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.025em]">היסטוריית נוכחות</h2>
              <p className="mt-1 text-sm font-medium text-[#66716B]">בדקו יום מסוים או ייצאו את הרשומות המסוננות.</p>
            </div>
            <button type="button" className={primaryButton} disabled={!historyLogs.length} onClick={exportCsv}>ייצוא CSV</button>
          </div>
          <div className="mb-4 grid gap-3 rounded-[20px] border border-[#DCE4DF] bg-white p-3 sm:grid-cols-2 sm:p-4">
            <label className="text-xs font-extrabold text-[#66716B]">תאריך
              <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="text-xs font-extrabold text-[#66716B]">כיתה
              <select value={historyCourse} onChange={(event) => setHistoryCourse(event.target.value)} className={fieldClass}>
                <option value="all">כל הכיתות</option>
                {data.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
          </div>
          <SummaryCards logs={historyLogs} />
          {historyLogs.length ? (
            <div className="mt-4 overflow-hidden rounded-[20px] border border-[#DCE4DF] bg-white shadow-[0_8px_24px_rgba(20,52,41,0.06)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-right text-sm">
                  <thead className="bg-[#F7F9F7] text-xs uppercase tracking-[0.08em] text-[#66716B]">
                    <tr><th className="p-4">תלמיד</th><th className="p-4">כיתה</th><th className="p-4">שעה</th><th className="p-4">סטטוס</th><th className="p-4">הערות</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EBE7]">
                    {historyLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="p-4 font-extrabold">{studentsById.get(log.studentId)?.name ?? "תלמיד לא ידוע"}</td>
                        <td className="p-4 font-medium text-[#66716B]">{coursesById.get(log.courseId)?.name ?? "כיתה לא ידועה"}</td>
                        <td className="p-4 font-medium text-[#66716B]">{log.time}</td>
                        <td className="p-4"><StatusBadge status={log.status} /></td>
                        <td className="max-w-[280px] truncate p-4 font-medium text-[#66716B]">{log.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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

      <div className={`pointer-events-none fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-2xl bg-[#17211D] px-4 py-3 text-center text-sm font-bold text-white shadow-2xl transition lg:bottom-6 ${toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} role="status" aria-live="polite">{toast}</div>
    </Layout>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <section className="rounded-[20px] border border-dashed border-[#BFCBC4] bg-white/60 px-5 py-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#DCEAE4] text-sm font-extrabold text-[#174A3A]">נכ</div>
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[#66716B]">{body}</p>
      {action && onAction && <button type="button" onClick={onAction} className={`${primaryButton} mt-5`}>{action}</button>}
    </section>
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
        <label className="block text-xs font-extrabold text-[#66716B]">שם הכיתה
          <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="למשל: מתמטיקה י׳1" className={fieldClass} />
        </label>
        <label className="block text-xs font-extrabold text-[#66716B]">תיאור <span className="font-medium">(אופציונלי)</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="מה לומדים בכיתה הזו?" className={`${fieldClass} min-h-24 py-3`} />
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
        <label className="block text-xs font-extrabold text-[#66716B]">שם התלמיד
          <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="שם מלא" className={fieldClass} />
        </label>
        <label className="block text-xs font-extrabold text-[#66716B]">אימייל <span className="font-medium">(אופציונלי)</span>
          <input type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="student@example.edu" className={`${fieldClass} text-left`} />
        </label>
        <label className="block text-xs font-extrabold text-[#66716B]">כיתה
          <select required value={courseId} onChange={(event) => setCourseId(event.target.value)} className={fieldClass}>
            {availableCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
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
