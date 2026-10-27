"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ScheduleModal } from "./ScheduleModal";
import { meetingOn } from "./schedule";
import { saveCourseSchedule, saveSharedRecord } from "./shared-records";
import { AuthScreen } from "./AuthScreen";
import {
  clearBiometricRecord,
  dismissBiometricPromptForSession,
  hasBiometricEnabled,
  isBiometricAvailable,
  isBiometricPromptDismissed,
  isBiometricSessionUnlocked,
  lockBiometricSession,
  registerBiometric,
  verifyBiometric,
} from "./biometric";
import {
  createTodayAttendance,
  addStudentAttendance,
  saveCourseSyllabus,
  saveLessonLog,
  fetchAppData,
  saveCourse,
  saveStudent,
  setCourseActive,
  setStudentActive,
  subscribeToSharedData,
  syncPendingQueue,
  updateAttendanceLog,
} from "./cloud-data";
import {
  AISyllabusAnalysisModal,
  AttendanceStudentRow,
  BiometricLockScreen,
  CourseCard,
  CourseSyllabusModal,
  CourseTasksMatrixView,
  InstructorHelpHub,
  FinishAttendanceBar,
  GeminiSettingsModal,
  LessonTopicModal,
  Layout,
  Modal,
  StudentActionBottomSheet,
  StudentQuickCardModal,
  SummaryCards,
  TaskNoteModal,
} from "./components";
import {
  calculateStudentAttendanceStats,
  downloadCSV,
  formatWhatsAppSummary,
  generateCourseAttendanceCSV,
  getDefaultCourseTasks,
  isYearlyCourse,
  openWhatsAppShare,
} from "./export-utils";
import {
  clearStoredGeminiApiKey,
  getPendingQueue,
  getStoredAnalysis,
  getStoredGeminiApiKey,
  getStoredLessons,
  saveStoredGeminiApiKey,
  getStoredCustomTasks,
  getStoredSubmissions,
  isOnline,
} from "./offline-storage";
import { analyzeCourseSyllabus, extractStudentsFromExcelFile } from "./gemini-ai";
import { prepareStudentImport } from "./student-import";
import { supabase } from "./supabase";
import type {
  AISyllabusAnalysis,
  AppData,
  AppTab,
  AttendanceStatus,
  Course,
  CourseTask,
  LessonLog,
  Student,
  StudentTaskSubmission,
} from "./types";
import { formatLocalDate, localDateKey, localTimeKey, makeId } from "./utils";

type ModalState =
  | { type: "course"; course?: Course }
  | { type: "student"; student?: Student; initialCourseId?: string }
  | { type: "import"; initialCourseId?: string }
  | null;

const primaryButton =
  "min-h-12 rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white hover:bg-[#00B3A4]";

export default function Home() {
  const [realToday, setRealToday] = useState(localDateKey);
  const [selectedDay, setToday] = useState<string | null>(null);
  const today = selectedDay ?? realToday;
  useEffect(() => { const timer = setInterval(() => setRealToday(localDateKey()), 30000); return () => clearInterval(timer); }, []);
  const [scheduleCourse, setScheduleCourse] = useState<Course | null>(null);
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
  const [showInactiveStudents, setShowInactiveStudents] = useState(false);
  const [historyDate, setHistoryDate] = useState(today);
  const [historyCourse, setHistoryCourse] = useState("all");
  const [historyStudent, setHistoryStudent] = useState("all");

  const [activeSessionCourseId, setActiveSessionCourseId] = useState<string | null>(null);

  const attendanceWrites = useRef(0);
  const handleQuickStatusChange = (logId: string, status: AttendanceStatus) => {
    setData((prev) => ({
      ...prev,
      attendance: prev.attendance.map((log) =>
        log.id === logId ? { ...log, status } : log
      ),
    }));

    attendanceWrites.current += 1;
    void updateAttendanceLog(logId, { status }).then(() => {
      setPendingSyncCount(getPendingQueue().length);
      void refreshData();
    }).catch(error => { notify(`שמירת הנוכחות נכשלה: ${error.message}`); void refreshData(); }).finally(() => { attendanceWrites.current -= 1; });
  };
  const [sessionReadOnly, setSessionReadOnly] = useState(false); void sessionReadOnly;
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const completedCourseIds = new Set((data.completedSessions ?? []).filter(id => id.endsWith(`_${today}`)).map(id => id.slice(0, -(today.length + 1))).filter(courseId => data.students.filter(s => s.active && s.courseId === courseId).every(s => data.attendance.some(l => l.studentId === s.id && l.courseId === courseId && l.date === today))));
  const [moreView, setMoreView] = useState<"menu" | "courses" | "students" | "tasks" | "help">("menu");
  const [studentAddSheetOpen, setStudentAddSheetOpen] = useState(false);
  const [customTasks, setCustomTasks] = useState<CourseTask[]>(() => getStoredCustomTasks());
  const [submissions, setSubmissions] = useState<StudentTaskSubmission[]>(() => getStoredSubmissions());
  const [selectedTasksCourseId, setSelectedTasksCourseId] = useState<string | null>(null);
  const [taskNoteModalData, setTaskNoteModalData] = useState<{
    student: Student;
    task: CourseTask;
    submission?: StudentTaskSubmission;
  } | null>(null);

  // Student Quick Card modal
  const [quickCardStudent, setQuickCardStudent] = useState<Student | null>(null);

  // Phase 4.3: Lesson Logging & Gemini AI Syllabus Monitor state
  const [lessons, setLessons] = useState<LessonLog[]>(() => getStoredLessons());
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(() => getStoredGeminiApiKey());
  const [syllabusModalCourse, setSyllabusModalCourse] = useState<Course | null>(null);
  const [lessonTopicModalData, setLessonTopicModalData] = useState<{
    course: Course;
    date: string;
    existingLog?: LessonLog;
  } | null>(null);
  const [aiAnalysisModalCourse, setAiAnalysisModalCourse] = useState<Course | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AISyllabusAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [geminiSettingsOpen, setGeminiSettingsOpen] = useState(false);

  // Offline & sync state
  const [isOffline, setIsOffline] = useState(() => !isOnline());
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingQueue().length);

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricUnlocked, setBiometricUnlocked] = useState(() => isBiometricSessionUnlocked());
  const [biometricDismissed, setBiometricDismissed] = useState(() => isBiometricPromptDismissed());

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }, []);

  // Navigation & hardware/gesture Back button support
  const navStateRef = useRef({
    tab,
    activeSessionCourseId,
    moreView,
    selectedAttendanceId,
    studentAddSheetOpen,
    quickCardStudent,
    taskNoteModalData,
    syllabusModalCourse,
    lessonTopicModalData,
    aiAnalysisModalCourse,
    geminiSettingsOpen,
    modal,
  });

  useEffect(() => {
    navStateRef.current = {
      tab,
      activeSessionCourseId,
      moreView,
      selectedAttendanceId,
      studentAddSheetOpen,
      quickCardStudent,
      taskNoteModalData,
      syllabusModalCourse,
      lessonTopicModalData,
      aiAnalysisModalCourse,
      geminiSettingsOpen,
      modal,
    };
  }, [
    tab,
    activeSessionCourseId,
    moreView,
    selectedAttendanceId,
    studentAddSheetOpen,
    quickCardStudent,
    taskNoteModalData,
    syllabusModalCourse,
    lessonTopicModalData,
    aiAnalysisModalCourse,
    geminiSettingsOpen,
    modal,
  ]);

  const safePushHistory = useCallback((layer: string) => {
    try {
      if (typeof window !== "undefined" && window.history?.pushState) {
        window.history.pushState({ appNav: true, layer }, "");
      }
    } catch {
      // Ignore history pushState errors
    }
  }, []);

  const pendingBackAction = useRef<(() => void) | null>(null);
  const safeBackHistory = useCallback((fallback: () => void) => {
    try {
      if (typeof window !== "undefined" && window.history?.state?.appNav) {
        pendingBackAction.current = fallback;
        window.history.back();
        return;
      }
    } catch {
      // Ignore history back errors
    }
    fallback();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => {
      if (pendingBackAction.current) { const action = pendingBackAction.current; pendingBackAction.current = null; action(); return; }
      const state = navStateRef.current;

      // Layer 1: Modals & Bottom Sheets (highest priority)
      if (state.geminiSettingsOpen) {
        setGeminiSettingsOpen(false);
        return;
      }
      if (state.aiAnalysisModalCourse) {
        setAiAnalysisModalCourse(null);
        return;
      }
      if (state.syllabusModalCourse) {
        setSyllabusModalCourse(null);
        return;
      }
      if (state.lessonTopicModalData) {
        setLessonTopicModalData(null);
        return;
      }
      if (state.taskNoteModalData) {
        setTaskNoteModalData(null);
        return;
      }
      if (state.quickCardStudent) {
        setQuickCardStudent(null);
        return;
      }
      if (state.modal) {
        setModal(null);
        return;
      }
      if (state.studentAddSheetOpen) {
        setStudentAddSheetOpen(false);
        return;
      }
      if (state.selectedAttendanceId) {
        setSelectedAttendanceId(null);
        return;
      }

      // Layer 2: Sub-views (Active attendance session, More sub-views)
      if (state.activeSessionCourseId) {
        setActiveSessionCourseId(null);
        return;
      }
      if (state.tab === "more" && state.moreView !== "menu") {
        setMoreView("menu");
        return;
      }

      // Layer 3: Main Navigation Tabs (return to Today home tab)
      if (state.tab !== "today") {
        setTab("today");
        return;
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const handleTabChange = useCallback(
    (nextTab: AppTab) => {
      if (nextTab === 'today' && !activeSessionCourseId) setToday(null);
      if (nextTab === navStateRef.current.tab) return;
      if (nextTab !== "today" && navStateRef.current.tab === "today") {
        safePushHistory(`tab-${nextTab}`);
      } else if (nextTab === "today" && typeof window !== "undefined" && window.history.state?.appNav) {
        safeBackHistory(() => { setMoreView("menu"); setTab("today"); });
        return;
      }
      setTab(nextTab);
    },
    [safePushHistory, safeBackHistory, activeSessionCourseId]
  );

  const handleOpenMoreView = useCallback(
    (view: "courses" | "students" | "tasks" | "help") => {
      safePushHistory(`more-${view}`);
      setMoreView(view);
    },
    [safePushHistory]
  );

  const handleToggleSubmission = useCallback(
    async (studentId: string, taskId: string, completed: boolean) => {
      const student = data.students.find((s) => s.id === studentId);
      const courseId = student?.courseId ?? selectedTasksCourseId ?? "";
      const existing = submissions.find((s) => s.studentId === studentId && s.taskId === taskId);
      const submission: StudentTaskSubmission = {
        id: `${studentId}_${taskId}`,
        studentId,
        courseId,
        taskId,
        completed,
        completedDate: completed
          ? existing?.completedDate || localDateKey()
          : undefined,
        notes: existing?.notes,
      };
      try {
        await saveSharedRecord('submission', submission.id, courseId, submission);
        setSubmissions(prev => [...prev.filter(s => s.id !== submission.id), submission]);
      } catch (error) { notify(error instanceof Error ? error.message : 'השמירה נכשלה'); return; }
      notify(completed ? "המטלה סומנה כהושלמה ✓" : "המטלה סומנה כלא הושלמה");
    },
    [data.students, selectedTasksCourseId, submissions, notify]
  );

  const handleSaveTaskNote = useCallback(
    async (studentId: string, taskId: string, notes: string, completedDate: string) => {
      const student = data.students.find((s) => s.id === studentId);
      const courseId = student?.courseId ?? selectedTasksCourseId ?? "";
      const existing = submissions.find(s => s.studentId === studentId && s.taskId === taskId);
      const submission: StudentTaskSubmission = {
        id: `${studentId}_${taskId}`,
        studentId,
        courseId,
        taskId,
        completed: existing?.completed ?? false,
        completedDate,
        notes,
      };
      await saveSharedRecord('submission', submission.id, courseId, submission);
      setSubmissions(prev => [...prev.filter(s => s.id !== submission.id), submission]);
      setTaskNoteModalData(null);
      notify("הערת המטלה נשמרה ✓");
    },
    [data.students, selectedTasksCourseId, submissions, notify]
  );

  const handleAddCustomTask = useCallback(
    async (courseId: string, title: string) => {
      const newTask: CourseTask = {
        id: `custom_${courseId}_${Date.now()}`,
        courseId,
        title,
        requiredForCertificate: true,
        yearlyOnly: false,
      };
      await saveSharedRecord('task', newTask.id, courseId, newTask);
      setCustomTasks(prev => [...prev, newTask]);
      notify("המטלה נוספה לקורס בהצלחה ✓");
    },
    [notify]
  );

  const exitMoreSubView = useCallback(() => {
    safeBackHistory(() => setMoreView("menu"));
  }, [safeBackHistory]);

  const exitActiveSession = useCallback(() => {
    safeBackHistory(() => setActiveSessionCourseId(null));
  }, [safeBackHistory]);

  const handleOpenQuickCard = useCallback(
    (student: Student) => {
      safePushHistory("quick-card");
      setQuickCardStudent(student);
    },
    [safePushHistory]
  );

  const closeQuickCard = useCallback(() => {
    safeBackHistory(() => setQuickCardStudent(null));
  }, [safeBackHistory]);

  const handleOpenAttendanceModal = useCallback(
    (logId: string) => {
      safePushHistory("attendance-edit");
      setSelectedAttendanceId(logId);
    },
    [safePushHistory]
  );

  const closeAttendanceModal = useCallback(() => {
    safeBackHistory(() => setSelectedAttendanceId(null));
  }, [safeBackHistory]);

  const handleOpenStudentAddSheet = useCallback(() => {
    safePushHistory("add-student");
    setStudentAddSheetOpen(true);
  }, [safePushHistory]);

  const closeStudentAddSheet = useCallback(() => {
    safeBackHistory(() => setStudentAddSheetOpen(false));
  }, [safeBackHistory]);

  const handleOpenModal = useCallback(
    (nextModal: ModalState) => {
      safePushHistory("modal");
      setModal(nextModal);
    },
    [safePushHistory]
  );

  const closeModal = useCallback(() => {
    safeBackHistory(() => setModal(null));
  }, [safeBackHistory]);


  const refreshVersion = useRef(0);
  const refreshData = useCallback(async () => {
    const version = ++refreshVersion.current;
    setDataLoading(true);
    setDataError("");
    try {
      const nextData = await fetchAppData();
      if (version !== refreshVersion.current) return;
      setData(nextData);
      setLessons(nextData.lessons ?? []);
      setCustomTasks(nextData.tasks ?? []);
      setSubmissions(nextData.submissions ?? []);
      setPendingSyncCount(getPendingQueue().length);
    } catch (error) {
      if (version === refreshVersion.current) setDataError(error instanceof Error ? error.message : "שגיאה בטעינת הנתונים");
    } finally {
      if (version === refreshVersion.current) setDataLoading(false);
    }
  }, []);

  const handleToggleCourseActive = async (course: Course) => {
    try {
      await setCourseActive(course.id, !course.active);
      await refreshData();
      notify(course.active ? "הקורס הושבת." : "הקורס הופעל.");
    } catch (error) {
      notify(error instanceof Error ? `עדכון הקורס נכשל: ${error.message}` : "עדכון הקורס נכשל. נסו שוב.");
    }
  };

  const handleToggleStudentActive = async (student: Student) => {
    try {
      await setStudentActive(student.id, !student.active);
      await refreshData();
      notify(student.active ? "התלמיד/ה הושבת/ה." : "התלמיד/ה הופעל/ה.");
    } catch (error) {
      notify(error instanceof Error ? `עדכון התלמיד נכשל: ${error.message}` : "עדכון התלמיד נכשל. נסו שוב.");
    }
  };

  // Sync and connection status listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      notify("החיבור לאינטרנט חזר! מסנכרן פעולות ממתינות...");
      void syncPendingQueue().then((synced) => {
        setPendingSyncCount(getPendingQueue().length);
        if (synced > 0) {
          notify(`סונכרנו בהצלחה ${synced} פעולות לשרת.`);
        }
        void refreshData();
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      notify("עברת למצב לא מקוון. שינויים יישמרו במכשיר ויסונכרנו כשתחזור הקליטה.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [notify, refreshData]);

  const handleManualSync = useCallback(async () => {
    notify("מסנכרן שינויים עם מסד הנתונים...");
    const synced = await syncPendingQueue();
    setPendingSyncCount(getPendingQueue().length);
    if (synced > 0) {
      notify(`סונכרנו ${synced} שינויים בהצלחה.`);
      await refreshData();
    } else {
      await refreshData();
      notify(getPendingQueue().length ? 'יש פעולות שטרם סונכרנו. בדקו חיבור והרשאות ונסו שוב.' : 'כל הנתונים סונכרנו.');
    }
  }, [notify, refreshData]);

  useEffect(() => {
    void isBiometricAvailable().then((available) => {
      setBiometricSupported(available);
    });
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    // Safety timeout: Never stay stuck on loading screen longer than 1.5 seconds
    const timeout = setTimeout(() => {
      if (mounted) {
        setAuthReady(true);
      }
    }, 1500);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const currentSession = data?.session ?? null;
        setSession(currentSession);
        if (currentSession?.user?.email) {
          setBiometricEnabled(hasBiometricEnabled(currentSession.user.email));
          setBiometricUnlocked(isBiometricSessionUnlocked());
        }
      })
      .catch((err) => {
        console.warn("Supabase getSession failed:", err);
      })
      .finally(() => {
        if (mounted) {
          clearTimeout(timeout);
          setAuthReady(true);
        }
      });

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const authRes = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        if (nextSession?.user?.email) {
          setBiometricEnabled(hasBiometricEnabled(nextSession.user.email));
          if (event === "SIGNED_IN" && !hasBiometricEnabled(nextSession.user.email)) {
            setBiometricUnlocked(true);
          } else {
            setBiometricUnlocked(isBiometricSessionUnlocked());
          }
        } else {
          lockBiometricSession();
          setBiometricUnlocked(false);
        }
        setAuthReady(true);
      });
      subscription = authRes.data.subscription;
    } catch {
      setAuthReady(true);
    }

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    void syncPendingQueue().then(() => refreshData());
    const unsubscribe = subscribeToSharedData(() => {
      void refreshData();
    });
    return unsubscribe;
  }, [session, refreshData]);

  const userEmail = session?.user?.email ?? "";

  const handleSignOut = useCallback(() => {
    lockBiometricSession();
    setBiometricUnlocked(false);
    if (supabase) {
      void supabase.auth.signOut();
    }
  }, []);

  const handleEnableBiometric = useCallback(async () => {
    if (!userEmail) return;
    try {
      await registerBiometric(userEmail);
      setBiometricEnabled(true);
      setBiometricUnlocked(true);
      notify("כניסה בטביעת אצבע הופעלה במכשיר זה");
    } catch (error) {
      notify(error instanceof Error ? error.message : "האימות הביומטרי בוטל או נכשל. נסו שוב.");
    }
  }, [userEmail, notify]);

  const handleDisableBiometric = useCallback(() => {
    clearBiometricRecord();
    setBiometricEnabled(false);
    setBiometricUnlocked(true);
    notify("כניסה בטביעת אצבע בוטלה במכשיר זה");
  }, [notify]);

  const handleLockAppNow = useCallback(() => {
    lockBiometricSession();
    setBiometricUnlocked(false);
  }, []);

  const handleDismissBiometricBanner = useCallback(() => {
    dismissBiometricPromptForSession();
    setBiometricDismissed(true);
  }, []);

  const todayLogs = useMemo(
    () => data.attendance.filter((log) => log.date === today),
    [data.attendance, today]
  );

  const openScheduledDate = (courseId: string, date: string) => {
    setScheduleCourse(null); setActiveSessionCourseId(null);
    setHistoryCourse(courseId); setHistoryDate(date); setHistoryStudent("all"); setTab("history");
  };
  const scheduledCourses = data.courses.filter(c => c.active && meetingOn(c.schedule?.meetings, today));
  const upcoming = data.courses.filter(c => c.active).flatMap(c => {
    const next = c.schedule?.meetings.filter(m => m.status === 'scheduled' && m.date > today).sort((a,b) => a.date.localeCompare(b.date))[0];
    return next ? [{course:c, meeting:next}] : [];
  }).sort((a,b) => a.meeting.date.localeCompare(b.meeting.date));

  const startAttendance = useCallback(
    async (courseId: string) => {
      try {
        const course = data.courses.find(c => c.id === courseId);
        if (!meetingOn(course?.schedule?.meetings, today)) { if (course) setScheduleCourse(course); return; }
        await createTodayAttendance(courseId, today, localTimeKey());
        await refreshData();
        setToday(today);
        setTodayFilter("all");
        setSessionReadOnly(false);
        safePushHistory("session");
        setActiveSessionCourseId(courseId);
        notify("כל התלמידים סומנו כנוכחים. סמנו רק חריגים.");
      } catch (error) {
        notify(error instanceof Error ? error.message : "שגיאה בפתיחת נוכחות");
      }
    },
    [today, data.courses, refreshData, notify]
  );

  const missingAttendance = (courseId: string, date: string, studentId = "all") => (
    <div className="space-y-2">{data.students.filter(s => s.active && s.courseId === courseId && (studentId === "all" || s.id === studentId) && !data.attendance.some(l => l.courseId === courseId && l.date === date && l.studentId === s.id)).map(student => (
      <label key={student.id} className="block rounded-xl bg-[#005580] p-3 text-white">
        {student.name} — טרם סומנה נוכחות
        <select aria-label={`נוכחות חדשה עבור ${student.name}`} value="" className="m-2 rounded bg-[#002B45] p-2" onChange={async e => {
          try { await addStudentAttendance(student, date, e.target.value as AttendanceStatus); await refreshData(); }
          catch(error) { notify(error instanceof Error ? error.message : 'השמירה נכשלה'); }
        }}>
          <option value="" disabled>בחירת מצב</option><option value="Present">נוכח</option><option value="Late">מאחר</option><option value="Absent">נעדר</option><option value="Excused">מוצדק</option>
        </select>
      </label>
    ))}</div>
  );

  // WhatsApp Share Handler
  const handleShareWhatsApp = useCallback(
    (courseId?: string) => {
      const targetCourseId = courseId || activeSessionCourseId;
      if (!targetCourseId) return;
      const course = data.courses.find((c) => c.id === targetCourseId);
      if (!course) return;
      const logs = todayLogs.filter((l) => l.courseId === targetCourseId);
      const text = formatWhatsAppSummary(course.name, today, logs);
      openWhatsAppShare(text);
    },
    [activeSessionCourseId, data.courses, todayLogs, today]
  );

  // Excel (CSV) Export Handler

  // Phase 4.3 Handlers: Syllabus & Lesson Logging & Gemini AI
  const handleOpenSyllabusModal = (course: Course) => {
    setSyllabusModalCourse(course);
    safePushHistory("syllabusModal");
  };

  const handleSaveSyllabus = async (courseId: string, syllabusText: string) => {
    await saveCourseSyllabus(courseId, syllabusText);
    setData((prev) => ({
      ...prev,
      courses: prev.courses.map((c) => (c.id === courseId ? { ...c, syllabus: syllabusText } : c)),
    }));
    notify("סילבוס הקורס נשמר בהצלחה.");
  };

  const handleOpenLessonTopicModal = (courseId: string, date: string) => {
    const course = data.courses.find((c) => c.id === courseId);
    if (!course) return;
    const existing = lessons.find((l) => l.courseId === courseId && l.date === date);
    setLessonTopicModalData({ course, date, existingLog: existing });
    safePushHistory("lessonTopicModal");
  };

  const handleSaveLessonTopic = async (courseId: string, date: string, topic: string, summary?: string) => {
    const log: LessonLog = {
      id: `${courseId}_${date}`,
      courseId,
      date,
      topic,
      summary,
      instructorEmail: session?.user?.email ?? undefined,
    };
    await saveLessonLog(log);
    setLessons(prev => [...prev.filter(l => l.id !== log.id), log]);
    notify("תיעוד השיעור נשמר בהצלחה.");
  };

  const handleOpenAIAnalysis = async (course: Course) => {
    setAiAnalysisModalCourse(course);
    safePushHistory("aiAnalysisModal");

    const cached = getStoredAnalysis(course.id);
    setCurrentAnalysis(cached);
    setAnalysisLoading(true);

    try {
      const res = await analyzeCourseSyllabus(course, lessons, geminiApiKey || undefined);
      setCurrentAnalysis(res);
    } catch {
      notify("אירעה שגיאה בבדיקת הסילבוס.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleSaveGeminiKey = (key: string) => {
    saveStoredGeminiApiKey(key);
    setGeminiApiKey(key ? key.trim() : null);
    notify("מפתח Google Gemini נשמר בהצלחה.");
  };

  const handleClearGeminiKey = () => {
    clearStoredGeminiApiKey();
    setGeminiApiKey(null);
    notify("מפתח Gemini הוסר מהמכשיר.");
  };

  const handleExportCourseCSV = useCallback(
    (course: Course) => {
      const csv = generateCourseAttendanceCSV(
        course,
        data.students,
        data.attendance,
        submissions,
        customTasks
      );
      downloadCSV(`attendance_${course.name}_${today}`, csv);
      notify(`דוח Excel (CSV) עבור ${course.name} הורד בהצלחה.`);
    },
    [data.students, data.attendance, submissions, customTasks, today, notify]
  );

  if (!authReady) {
    return (
      <main lang="he" dir="rtl" className="app-bg grid min-h-[100svh] place-items-center text-sm font-bold text-[#B8D8E6]">
        טוען נתונים...
      </main>
    );
  }

  if (!session) return <AuthScreen />;

  if (hasBiometricEnabled(userEmail) && !biometricUnlocked) {
    return (
      <BiometricLockScreen
        email={userEmail}
        onVerify={async () => {
          await verifyBiometric(userEmail);
          setBiometricUnlocked(true);
        }}
        onFallbackSignOut={handleSignOut}
      />
    );
  }

  const activeSessionLogs = activeSessionCourseId
    ? todayLogs.filter((log) => log.courseId === activeSessionCourseId)
    : [];
  const filteredSessionLogs =
    todayFilter === "exceptions"
      ? activeSessionLogs.filter((log) => log.status !== "Present" || Boolean(log.notes))
      : activeSessionLogs;

  const selectedLog = selectedAttendanceId
    ? data.attendance.find((log) => log.id === selectedAttendanceId) ?? null
    : null;
  const selectedStudent = selectedLog
    ? data.students.find((student) => student.id === selectedLog.studentId) ?? null
    : null;

  return (
    <Layout
      tab={tab}
      onTabChange={handleTabChange}
      userEmail={userEmail || "מורה"}
      onSignOut={handleSignOut}
      onOpenHelp={() => {
        setTab("more");
        handleOpenMoreView("help");
      }}
      attendanceActive={Boolean(activeSessionCourseId)}
      isOffline={isOffline}
      pendingSyncCount={pendingSyncCount}
      onSyncNow={handleManualSync}
    >
      {dataLoading && (
        <p className="mb-3 text-xs font-bold text-[#B8D8E6]">טוען נתונים...</p>
      )}
      {dataError && (
        <div className="mb-4 rounded-2xl border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-xs font-bold text-[#991B1B]">
          {dataError}
        </div>
      )}

      {/* TAB: TODAY */}
      {tab === "today" && !activeSessionCourseId && (
        <section className="min-h-[calc(100svh-10rem)] pb-4 text-white">
          {biometricSupported && !biometricEnabled && !biometricDismissed && (
            <div className="mb-5 rounded-[20px] border border-white/14 bg-[#005580] p-4 shadow-[0_14px_34px_rgba(0,18,27,0.18)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-white">כניסה מהירה בטביעת אצבע</h3>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#B8D8E6]">
                    הפעילו זיהוי ביומטרי במכשיר זה כדי להיכנס לאפליקציה מיד ללא המתנה למייל.
                  </p>
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleEnableBiometric()}
                  className="min-h-11 rounded-xl bg-[#00A6A6] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#00B3A4]"
                >
                  הפעלת טביעת אצבע
                </button>
                <button
                  type="button"
                  onClick={handleDismissBiometricBanner}
                  className="min-h-11 rounded-xl border border-white/14 bg-[#002B45] px-3.5 py-2 text-xs font-bold text-[#B8D8E6] transition hover:text-white"
                >
                  לא עכשיו
                </button>
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold">{today === realToday ? "שיעורי היום" : "מפגשים בתאריך הנבחר"}</h2>
              <label className="mt-3 block text-sm">בחירת תאריך מפגשים<input aria-label="בחירת תאריך מפגשים" className="m-2 rounded-lg bg-[#005580] p-2" type="date" value={today} onChange={e => { if (e.target.value) setToday(e.target.value); }}/></label>
              {selectedDay && <button className="underline" onClick={() => setToday(null)}>חזרה לתאריך של היום</button>}
              <p className="mt-1 text-sm font-medium leading-6 text-[#B8D8E6]">
                {formatLocalDate(today)} · בחרו כיתה כדי להתחיל נוכחות לתאריך זה.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setHistoryDate(today);
                setHistoryCourse("all");
                setHistoryStudent("all");
                handleTabChange("history");
              }}
              className="min-h-10 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-white/15"
            >
              בדיקת נוכחות לפי תאריך
            </button>
            <button
              type="button"
              onClick={() => handleOpenModal({ type: "course" })}
              className="min-h-10 rounded-xl bg-[#00A6A6] hover:bg-[#00B3A4] px-3.5 py-2 text-xs font-extrabold text-white transition shadow-sm"
            >
              + כיתה חדשה
            </button>
            <p className="text-xs font-medium leading-5 text-[#B8D8E6]">
              כל התלמידים יסומנו כנוכחים כברירת מחדל.
            </p>
          </div>

          {scheduledCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scheduledCourses.map((course, index) => {
                  const studentCount = data.students.filter(
                    (student) => student.courseId === course.id && student.active
                  ).length;
                  const startedToday = todayLogs.some((log) => log.courseId === course.id);
                  const completed = completedCourseIds.has(course.id);
                  const stateLabel = completed
                    ? (today === realToday ? "הושלמה היום" : "הושלמה לתאריך זה")
                    : startedToday
                    ? "בתהליך"
                    : "טרם דווחה";
                  const actionLabel = completed
                    ? (today === realToday ? "עריכת נוכחות להיום" : "עריכת נוכחות לתאריך זה")
                    : startedToday
                    ? "המשך נוכחות"
                    : "התחלת נוכחות";

                  return (
                    <article
                      key={course.id}
                      className={`rounded-[20px] p-4 sm:p-5 ${
                        index === 0
                          ? "glass-panel"
                          : "border border-white/[0.14] bg-[#005580] shadow-[0_12px_30px_rgba(0,18,27,0.14)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 dir="auto" className="break-words text-lg font-extrabold">
                            {course.name}
                          </h3>
                          <p className="mt-2 text-sm text-[#B8D8E6]">{(() => { const m = meetingOn(course.schedule?.meetings, today)!; return [m.number ? `מפגש ${m.number}` : '', m.topic, m.location, m.startTime ? `${m.startTime}–${m.endTime ?? ''}` : ''].filter(Boolean).join(' · '); })()}</p>
                          <button className="mt-2 text-sm underline" onClick={() => setScheduleCourse(course)}>לוח מפגשים וסילבוס</button>
                          <p className="mt-1 text-xs font-semibold text-[#B8D8E6]">
                            {studentCount} {studentCount === 1 ? "תלמיד אחד" : "תלמידים"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                            completed
                              ? "bg-[#DCFCE7] text-[#166534]"
                              : startedToday
                              ? "bg-[#FEF3C7] text-[#92400E]"
                              : "bg-white/10 text-[#B8D8E6]"
                          }`}
                        >
                          {stateLabel}
                        </span>
                      </div>

                      <div className="mt-5 flex items-center gap-2">
                        {studentCount === 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenModal({
                                type: "import",
                                initialCourseId: course.id,
                              })
                            }
                            className="min-h-12 flex-1 rounded-xl bg-[#00A6A6] hover:bg-[#00B3A4] px-4 text-xs sm:text-sm font-extrabold text-white transition shadow-md"
                          >
                            + הוספת / ייבוא תלמידים לכיתה
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!startedToday) void startAttendance(course.id);
                              else {
                                setToday(today);
                                setTodayFilter("all");
                                setSessionReadOnly(false);
                                safePushHistory("session");
                                setActiveSessionCourseId(course.id);
                              }
                            }}
                            className="min-h-12 flex-1 rounded-xl bg-[#00A6A6] px-4 text-sm font-extrabold text-white transition hover:bg-[#00B3A4]"
                          >
                            {actionLabel}
                          </button>
                        )}
                        {startedToday && (
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(course.id)}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white hover:bg-[#20BD5A] transition"
                            title="שיתוף סיכום לווטסאפ"
                          >
                            💬
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          ) : (
            <EmptyState
              title={today === realToday ? "אין מפגשים מתוכננים להיום" : "אין מפגשים מתוכננים לתאריך זה"}
              body="אפשר לבחור תאריך אחר או לפתוח את לוח המפגשים של הכיתה."
              action="מעבר לעוד"
              onAction={() => setTab("more")}
            />
          )}
          <div className="mt-6 space-y-3">
            <h3 className="font-bold">המפגשים הקרובים</h3>
            {upcoming.map(({course,meeting}) => <div key={course.id} className="rounded-xl border border-white/20 p-3">
              <p className="font-bold">{course.name}</p><p>{formatLocalDate(meeting.date)} · {meeting.topic}</p>
              <div className="mt-2 flex flex-wrap gap-3"><button className="underline" onClick={() => setToday(meeting.date)}>מעבר לתאריך המפגש</button><button className="underline" onClick={() => setScheduleCourse(course)}>לוח מפגשים וסילבוס — {course.name}</button></div>
            </div>)}
            {data.courses.filter(c => c.active && !c.schedule).map(c => <div key={c.id} className="rounded-xl bg-amber-100 p-3 text-amber-950"><p>{c.name} — נדרש להגדיר מועדי מפגשים</p><button className="font-bold underline" onClick={() => setScheduleCourse(c)}>הגדרת לוח מפגשים — {c.name}</button></div>)}
            {data.courses.filter(c => c.active && todayLogs.some(l => l.courseId === c.id) && !meetingOn(c.schedule?.meetings,today)).map(c => <div key={c.id} className="rounded-xl bg-amber-100 p-3 text-amber-950"><p>{c.name} — קיים דיווח בתאריך זה מחוץ ללוח המפגשים</p><button className="font-bold underline" onClick={() => openScheduledDate(c.id,today)}>בדיקת הדיווח — {c.name}</button></div>)}
          </div>
        </section>
      )}

      {/* ACTIVE ATTENDANCE SESSION */}
      {tab === "today" && activeSessionCourseId && (
        <section className="space-y-4 pb-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={exitActiveSession}
              className="text-xs font-extrabold text-[#B8D8E6] hover:text-white"
            >
              → חזרה להיום
            </button>
            <div className="flex rounded-xl bg-[#005580] p-1 border border-white/14">
              <button
                type="button"
                onClick={() => setTodayFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${
                  todayFilter === "all" ? "bg-[#00A6A6] text-white" : "text-[#B8D8E6]"
                }`}
              >
                כל התלמידים
              </button>
              <button
                type="button"
                onClick={() => setTodayFilter("exceptions")}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${
                  todayFilter === "exceptions" ? "bg-[#00A6A6] text-white" : "text-[#B8D8E6]"
                }`}
              >
                חריגים בלבד
              </button>
            </div>
          </div>

          {/* Lesson Topic banner & AI Syllabus button */}
          {(() => {
            const activeCourse = data.courses.find((c) => c.id === activeSessionCourseId);
            const todayLesson = lessons.find(
              (l) => l.courseId === activeSessionCourseId && l.date === today
            );
            return (
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-white/14 bg-[#003859] p-3.5 shadow-md">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#00E5E5] flex items-center gap-1.5">
                    <span>📌</span>
                  <span>נושא המפגש · {formatLocalDate(today)}:</span>
                  </span>
                  <p className="mt-0.5 text-xs sm:text-sm font-extrabold text-white truncate">
                    {todayLesson?.topic || "טרם תועד נושא למפגש זה"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenLessonTopicModal(activeSessionCourseId, today)}
                    className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 transition"
                  >
                    {todayLesson ? "עריכת נושא" : "+ תיעוד שיעור"}
                  </button>
                  {activeCourse && (
                    <button
                      type="button"
                      onClick={() => handleOpenAIAnalysis(activeCourse)}
                      className="rounded-xl bg-[#00A6A6] hover:bg-[#00B3A4] px-3.5 py-1.5 text-xs font-extrabold text-white transition flex items-center gap-1.5 shadow-md shadow-[#00A6A6]/20"
                    >
                      <span>✨</span>
                      <span>בדיקת סילבוס (AI)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          <h2 className="text-lg font-bold">{data.courses.find(c => c.id === activeSessionCourseId)?.name} · {formatLocalDate(today)}</h2>
          <SummaryCards logs={activeSessionLogs} />
          {missingAttendance(activeSessionCourseId, today)}

          <div className="space-y-2.5">
            {filteredSessionLogs.map((log) => {
              const student = data.students.find((s) => s.id === log.studentId);
              if (!student) return null;
              return (
                <AttendanceStudentRow
                  key={log.id}
                  log={log}
                  student={student}
                  onOpen={() => {
                    handleOpenAttendanceModal(log.id);
                  }}
                  onViewCard={() => handleOpenQuickCard(student)}
                  onStatusChange={(status) => handleQuickStatusChange(log.id, status)}
                />
              );
            })}
          </div>

          <FinishAttendanceBar
            logs={activeSessionLogs}
            currentTopic={lessons.find((l) => l.courseId === activeSessionCourseId && l.date === today)?.topic}
            onEditTopic={() => handleOpenLessonTopicModal(activeSessionCourseId, today)}
            onFinish={async () => {
              try {
                if (attendanceWrites.current) { notify('הנוכחות עדיין נשמרת. המתינו רגע לפני סיום.'); return; }
                const missing = data.students.some(s => s.active && s.courseId === activeSessionCourseId && !activeSessionLogs.some(l => l.studentId === s.id));
                if (missing) { notify('יש תלמידים שטרם סומנה להם נוכחות. השלימו לפני סיום.'); return; }
                if (getPendingQueue().length) { notify('יש שינויים שממתינים לסנכרון. סנכרנו לפני סיום המפגש.'); return; }
                await saveSharedRecord('session', `${activeSessionCourseId}_${today}`, activeSessionCourseId, {completed:true,date:today});
                await refreshData();
                exitActiveSession();
                notify('הנוכחות להיום הושלמה ונשמרה בשרת.');
              } catch(error) { notify(error instanceof Error ? error.message : 'שמירת סיום המפגש נכשלה'); }
            }}
            onShareWhatsApp={() => handleShareWhatsApp(activeSessionCourseId)}
          />
        </section>
      )}

      {/* TAB: STUDENTS */}
      {tab === "students" && (
        <section className="space-y-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold text-white">תלמידים</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleOpenModal({
                    type: "import",
                    initialCourseId: studentCourse === "all" ? data.courses[0]?.id : studentCourse,
                  })
                }
                className="min-h-11 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-3 text-xs font-extrabold text-white transition"
              >
                📁 ייבוא מאקסל
              </button>
              <button
                type="button"
                onClick={handleOpenStudentAddSheet}
                className="min-h-11 rounded-xl bg-[#00A6A6] px-4 text-xs font-extrabold text-white hover:bg-[#00B3A4] transition"
              >
                + הוספת תלמיד
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="חיפוש תלמיד/ה..."
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/14 bg-white px-3.5 text-sm font-semibold text-[#0F172A]"
            />
            <select
              value={studentCourse}
              onChange={(e) => setStudentCourse(e.target.value)}
              className="min-h-11 max-w-[130px] sm:max-w-[180px] shrink-0 truncate rounded-xl border border-white/14 bg-[#005580] px-3 text-xs font-bold text-white"
            >
              <option value="all">כל הכיתות</option>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const courseFiltered = data.students.filter(
              (s) => studentCourse === "all" || s.courseId === studentCourse
            );
            const activeCount = courseFiltered.filter((s) => s.active).length;
            const inactiveCount = courseFiltered.length - activeCount;

            const displayed = courseFiltered
              .filter((student) => {
                const matchSearch =
                  !studentSearch ||
                  student.name.toLowerCase().includes(studentSearch.toLowerCase());
                const matchActive = showInactiveStudents ? true : student.active;
                return matchSearch && matchActive;
              })
              .sort((a, b) => {
                if (a.active !== b.active) return a.active ? -1 : 1;
                return a.name.localeCompare(b.name, "he");
              });

            return (
              <>
                <div className="flex items-center justify-between text-xs font-bold text-[#B8D8E6] px-1">
                  <span>
                    מציג {displayed.length} תלמידים פעילים {inactiveCount > 0 && !showInactiveStudents ? "(" + inactiveCount + " לא פעילים מוסתרים)" : ""}
                  </span>
                  {inactiveCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowInactiveStudents((prev) => !prev)}
                      className="text-xs underline hover:text-white transition"
                    >
                      {showInactiveStudents ? "הסתר תלמידים לא פעילים" : "הצג גם " + inactiveCount + " לא פעילים"}
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {displayed.length === 0 ? (
                    <div className="rounded-2xl border border-white/14 bg-[#005580] p-6 text-center text-xs font-bold text-[#B8D8E6]">
                      לא נמצאו תלמידים התואמים את הסינון.
                    </div>
                  ) : (
                    displayed.map((student) => (
                <div
                  key={student.id}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/14 bg-[#005580] px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpenQuickCard(student)}
                      aria-label="כרטיס תלמיד"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-[#B8D8E6] transition hover:bg-[#00A6A6] hover:text-white"
                    >
                      ℹ️
                    </button>
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="break-words font-bold text-white">
                        {student.name}
                      </p>
                      <p className="truncate text-xs text-[#B8D8E6]">
                        {student.active ? "פעיל" : "לא פעיל"}
                      </p>
                    </div>
                  </div>
                  <StudentActions
                    student={student}
                    onEdit={() =>
                      handleOpenModal({
                        type: "student",
                        student,
                        initialCourseId: studentCourse === "all" ? student.courseId : studentCourse,
                      })
                    }
                    onToggleActive={() => void handleToggleStudentActive(student)}
                  />
                </div>
              ))
            )}
          </div>
        </>
      );
    })()}
  </section>
      )}

      {/* TAB: HISTORY */}
      {tab === "history" && (
        <section className="space-y-4 pb-4">
          <h2 className="text-xl font-extrabold text-white">היסטוריה</h2>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/14 bg-[#005580] px-3 text-xs font-bold text-white">
              <span>תאריך:</span>
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                aria-label="בחירת תאריך נוכחות"
                className="min-h-9 min-w-0 bg-transparent text-xs font-bold text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => setHistoryDate("")}
              aria-pressed={!historyDate}
              className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${!historyDate ? "border-[#00A6A6] bg-[#00A6A6] text-white" : "border-white/14 bg-[#005580] text-[#B8D8E6]"}`}
            >
              כל התאריכים
            </button>
            <select
              value={historyCourse}
              onChange={(e) => {
                setHistoryCourse(e.target.value);
                setHistoryStudent("all");
              }}
              aria-label="סינון נוכחות לפי קורס"
              className="min-h-11 flex-1 rounded-xl border border-white/14 bg-[#005580] px-3 text-xs font-bold text-white"
            >
              <option value="all">כל הכיתות</option>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
            <select
              value={historyStudent}
              onChange={(e) => setHistoryStudent(e.target.value)}
              aria-label="סינון נוכחות לפי תלמיד"
              className="min-h-11 flex-1 rounded-xl border border-white/14 bg-[#005580] px-3 text-xs font-bold text-white"
            >
              <option value="all">כל התלמידים</option>
              {data.students
                .filter((student) => historyCourse === "all" || student.courseId === historyCourse || data.attendance.some(l => l.courseId === historyCourse && l.studentId === student.id))
                .sort((a, b) => a.name.localeCompare(b.name, "he"))
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
            </select>
          </div>
          {historyCourse !== 'all' && historyDate && <>
            <p className="text-sm font-bold">{data.courses.find(c => c.id === historyCourse)?.name} · {formatLocalDate(historyDate)}</p>
            {(() => { const c = data.courses.find(c => c.id === historyCourse); const m = meetingOn(c?.schedule?.meetings,historyDate); return <div className="rounded-xl border border-white/20 p-3"><p>{m ? `בתוכנית: ${m.topic || 'מפגש מתוכנן'}${m.number ? ` · מפגש ${m.number}` : ''}` : 'אין מפגש מתוכנן בתאריך זה. דיווח ידני יישמר מחוץ ללוח המפגשים.'}</p>{c && <button className="underline" onClick={() => setScheduleCourse(c)}>לוח מפגשים וסילבוס</button>}</div>; })()}
            {missingAttendance(historyCourse, historyDate, historyStudent)}
          </>}
          {/* History Lesson Topic & AI Syllabus button */}
          {historyCourse !== "all" && historyDate && (() => {
            const hCourse = data.courses.find((c) => c.id === historyCourse);
            const hLesson = lessons.find((l) => l.courseId === historyCourse && l.date === historyDate);
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/14 bg-[#003859] p-3 text-right">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#00E5E5] flex items-center gap-1">
                    <span>📌</span>
                    <span>נושא השיעור לתאריך {historyDate ? formatLocalDate(historyDate) : "כל התאריכים"}:</span>
                  </span>
                  <p className="mt-0.5 text-xs sm:text-sm font-bold text-white truncate">
                    {hLesson?.topic || "טרם תועד נושא למפגש זה"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenLessonTopicModal(historyCourse, historyDate)}
                    className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 transition"
                  >
                    {hLesson ? "עריכת נושא" : "+ תיעוד שיעור"}
                  </button>
                  {hCourse && (
                    <button
                      type="button"
                      onClick={() => handleOpenAIAnalysis(hCourse)}
                      className="rounded-xl bg-[#00A6A6] hover:bg-[#00B3A4] px-3 py-1.5 text-xs font-extrabold text-white transition flex items-center gap-1 shadow-md shadow-[#00A6A6]/20"
                    >
                      <span>✨</span>
                      <span>בדיקת סילבוס (AI)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          <SummaryCards
            logs={data.attendance.filter(
              (log) =>
                (!historyDate || log.date === historyDate) &&
                (historyCourse === "all" || log.courseId === historyCourse) &&
                (historyStudent === "all" || log.studentId === historyStudent)
            )}
          />

          {/* Interactive history logs list allowing retroactive edits */}
          {(() => {
            const historyLogs = data.attendance.filter(
              (log) =>
                (!historyDate || log.date === historyDate) &&
                (historyCourse === "all" || log.courseId === historyCourse) &&
                (historyStudent === "all" || log.studentId === historyStudent)
            );

            if (historyLogs.length === 0) {
              return (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs text-[#B8D8E6]">
                  לא נמצאו רשומות נוכחות לתאריך ולכיתה שנבחרו.
                </div>
              );
            }

            return (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#B8D8E6]">
                    {historyDate ? "רשומות לתאריך זה" : "רשומות מכל התאריכים"} ({historyLogs.length}) · לחצו לעריכה ותיקון
                  </h3>
                </div>
                <div className="space-y-2">
                  {historyLogs.map((log) => {
                    const student = data.students.find((s) => s.id === log.studentId);
                    if (!student) return null;
                    return (
                      <div key={log.id} className="space-y-1">
                        <p className="px-1 text-[11px] font-bold text-[#B8D8E6]">
                          {formatLocalDate(log.date, { day: "numeric", month: "long", year: "numeric" })} · {log.time}
                        </p>
                        <AttendanceStudentRow
                          log={log}
                          student={student}
                          onOpen={() => handleOpenAttendanceModal(log.id)}
                          onViewCard={() => handleOpenQuickCard(student)}
                          onStatusChange={(status) => handleQuickStatusChange(log.id, status)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* TAB: MORE */}
      {tab === "more" && (
        <section className="space-y-6 pb-4">
          {moreView === "menu" ? (
            <>
              <MoreGroup title="אבטחה וכניסה מהירה">
                <div className="p-4 text-right text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-base font-extrabold">כניסה מהירה בטביעת אצבע</strong>
                      <p className="mt-0.5 text-xs font-medium text-[#B8D8E6]">
                        {!biometricSupported
                          ? "לא נתמך במכשיר זה"
                          : biometricEnabled
                          ? "מופעל במכשיר זה"
                          : "לא מופעל"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                        biometricEnabled
                          ? "bg-[#DCFCE7] text-[#166534]"
                          : "border border-white/15 bg-white/[0.08] text-[#B8D8E6]"
                      }`}
                    >
                      {!biometricSupported
                        ? "לא נתמך במכשיר זה"
                        : biometricEnabled
                        ? "מופעל במכשיר זה"
                        : "לא מופעל"}
                    </span>
                  </div>

                  {biometricSupported && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!biometricEnabled ? (
                        <button
                          type="button"
                          onClick={() => void handleEnableBiometric()}
                          className="min-h-11 rounded-xl bg-[#00A6A6] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#00B3A4]"
                        >
                          הפעלת כניסה בטביעת אצבע
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleLockAppNow}
                            className="min-h-11 rounded-xl bg-[#00A6A6] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#00B3A4]"
                          >
                            נעילת אפליקציה כעת
                          </button>
                          <button
                            type="button"
                            onClick={handleDisableBiometric}
                            className="min-h-11 rounded-xl border border-[#DC2626]/40 bg-[#FEE2E2] px-4 py-2 text-xs font-extrabold text-[#991B1B]"
                          >
                            ביטול טביעת אצבע במכשיר זה
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </MoreGroup>

              {/* Gemini AI Syllabus Monitor Group */}
              <MoreGroup title="בינה מלאכותית (Google Gemini)">
                <div className="p-4 text-right text-white space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-base font-extrabold">בקרת סילבוס והמלצות פדגוגיות</strong>
                      <p className="mt-0.5 text-xs font-medium text-[#B8D8E6]">
                        {geminiApiKey
                          ? "מפתח Gemini 1.5 Flash מוגדר ופעיל"
                          : "טרם הוגדר מפתח (המערכת פועלת במצב ניתוח מובנה מקומי)"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                        geminiApiKey
                          ? "bg-[#DCFCE7] text-[#166534]"
                          : "border border-white/15 bg-white/[0.08] text-[#B8D8E6]"
                      }`}
                    >
                      {geminiApiKey ? "מחובר ל-AI ✓" : "מצב מקומי"}
                    </span>
                  </div>
                  <p className="text-xs text-[#B8D8E6] leading-relaxed">
                    חיבור ישיר למודל הבינה המלאכותית של גוגל מאפשר מעקב סילבוס חכם, זיהוי ומניעת חזרתיות בין מנחים והמלצות פדגוגיות ממוקדות למפגש הבא.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setGeminiSettingsOpen(true);
                        safePushHistory("geminiSettings");
                      }}
                      className="min-h-11 rounded-xl bg-[#00A6A6] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#00B3A4]"
                    >
                      {geminiApiKey ? "ניהול מפתח Gemini API" : "הגדרת מפתח Gemini API"}
                    </button>
                  </div>
                </div>
              </MoreGroup>

              {/* Data Export & Reports Group */}
              <MoreGroup title="דוחות וייצוא נתונים">
                <div className="p-4 space-y-3">
                  <p className="text-xs text-[#B8D8E6]">
                    ייצוא דוחות נוכחות מלאים בפורמט Excel (CSV) תואם עברית עבור המזכירות וההנהלה:
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.courses
                      .filter((c) => c.active)
                      .map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => handleExportCourseCSV(course)}
                          className="flex items-center justify-between rounded-xl border border-white/14 bg-[#002B45] p-3 text-right hover:bg-[#005580] transition"
                        >
                          <div className="min-w-0 flex-1">
                            <p dir="auto" className="break-words text-xs font-bold text-white">
                              {course.name}
                            </p>
                            <p className="text-[11px] text-[#00E5E5]">הורדת דוח Excel (CSV)</p>
                          </div>
                          <span className="text-lg mr-2">📊</span>
                        </button>
                      ))}
                  </div>
                </div>
              </MoreGroup>

              <MoreGroup title="תמיכה ופיתוח מנחים">
                <MoreAction
                  title="💡 מרכז עזרה, שו״ת ומשוב מנחים"
                  description="ספריית שו״ת מלאה, דיווח על תקלות ואשף הצעות לשדרוגים ושינויים"
                  onClick={() => handleOpenMoreView("help")}
                />
              </MoreGroup>

              <MoreGroup title="ניהול מערכת">
                <MoreAction
                  title="מעקב חובות וזכאות לתעודה"
                  description="טבלה כיתתית מרכזת עם צ'קבוקסים מהירים: עמיתים, פרקטיקום ומסע"
                  onClick={() => {
                    safePushHistory("more-tasks");
                    setSelectedTasksCourseId(data.courses[0]?.id ?? null);
                    setMoreView("tasks");
                  }}
                />
                <MoreAction
                  title="ניהול קורסים"
                  description="הוספה, עריכה והגדרת כיתות במערכת"
                  onClick={() => handleOpenMoreView("courses")}
                />
                <MoreAction
                  title="ניהול תלמידים"
                  description="הוספה, שיוך לכיתות וייבוא תלמידים"
                  onClick={() => handleOpenMoreView("students")}
                />
                <MoreAction
                  title="ייבוא תלמידים"
                  description="ייבוא מרוכז של תלמידים מרשימה"
                  onClick={() =>
                    handleOpenModal({
                      type: "import",
                      initialCourseId: studentCourse === "all" ? data.courses[0]?.id : studentCourse,
                    })
                  }
                />
                <MoreAction
                  title="סנכרון נתונים ידני"
                  description={`ממתינים לסנכרון: ${pendingSyncCount} פעולות`}
                  onClick={() => void handleManualSync()}
                />
              </MoreGroup>

              <MoreGroup title="מערכת וחשבון">
                <MoreAction
                  title="חשבון משתמש"
                  description={userEmail || "מחובר"}
                  disabled
                />
                <MoreAction
                  title="התנתקות"
                  description="יציאה מהחשבון במכשיר זה"
                  onClick={handleSignOut}
                />
              </MoreGroup>
            </>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                aria-label="חזרה לתפריט"
                onClick={exitMoreSubView}
                className="flex items-center gap-2 text-sm font-extrabold text-[#B8D8E6] hover:text-white"
              >
                <span>→</span>
                <span>חזרה לתפריט ראשי</span>
              </button>

              {moreView === "courses" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-white">ניהול קורסים</h3>
                    <button
                      type="button"
                      onClick={() => handleOpenModal({ type: "course" })}
                      className="min-h-10 rounded-xl bg-[#00A6A6] px-4 text-xs font-extrabold text-white hover:bg-[#00B3A4]"
                    >
                      + הוספת כיתה חדשה
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.courses.map((course) => {
                      const studentCount = data.students.filter(
                        (s) => s.courseId === course.id && s.active
                      ).length;
                      return (
                        <CourseCard
                          key={course.id}
                          course={course}
                          studentCount={studentCount}
                          startedToday={todayLogs.some((l) => l.courseId === course.id)}
                          completedToday={completedCourseIds.has(course.id)}
                          onStart={() => setScheduleCourse(course)}
                          startLabel="לוח מפגשים ונוכחות"
                          onEdit={() => handleOpenModal({ type: "course", course })}
                          onToggleActive={() => void handleToggleCourseActive(course)}
                          onExportCSV={() => handleExportCourseCSV(course)}
                          onViewTasks={() => {
                            safePushHistory("more-tasks");
                            setSelectedTasksCourseId(course.id);
                            setMoreView("tasks");
                          }}
                          onViewAIAnalysis={() => void handleOpenAIAnalysis(course)}
                          onEditSyllabus={() => handleOpenSyllabusModal(course)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {moreView === "students" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-white">רשימת תלמידים</h3>
                    <button
                      type="button"
                      onClick={handleOpenStudentAddSheet}
                      className="min-h-10 rounded-xl bg-[#00A6A6] px-4 text-xs font-extrabold text-white hover:bg-[#00B3A4]"
                    >
                      + הוספת תלמיד
                    </button>
                  </div>
                  <div className="space-y-2">
                    {data.students.map((student) => (
                      <div
                        key={student.id}
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/14 bg-[#005580] px-4 py-3"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenQuickCard(student)}
                            aria-label="כרטיס תלמיד"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-[#B8D8E6] transition hover:bg-[#00A6A6] hover:text-white"
                          >
                            ℹ️
                          </button>
                          <div className="min-w-0 flex-1">
                            <p dir="auto" className="break-words font-bold text-white">
                              {student.name}
                            </p>
                            <p className="break-words text-xs text-[#B8D8E6]">
                              {data.courses.find((c) => c.id === student.courseId)?.name || ""}
                            </p>
                          </div>
                        </div>
                        <StudentActions
                          student={student}
                          onEdit={() => handleOpenModal({ type: "student", student })}
                            onToggleActive={() => void handleToggleStudentActive(student)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {moreView === "tasks" && (
                <div className="space-y-4">
                  {/* Course Selector for tasks */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[#B8D8E6] shrink-0">בחירת קורס:</label>
                    <select
                      value={selectedTasksCourseId || data.courses[0]?.id || ""}
                      onChange={(e) => setSelectedTasksCourseId(e.target.value)}
                      className="min-h-11 flex-1 rounded-xl border border-white/14 bg-[#005580] px-3 text-xs font-bold text-white"
                    >
                      {data.courses
                        .filter((c) => c.active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {isYearlyCourse(c.name, c.description) ? "(שנתי)" : ""}
                          </option>
                        ))}
                    </select>
                  </div>

                  {(() => {
                    const activeCourse =
                      data.courses.find((c) => c.id === selectedTasksCourseId) ||
                      data.courses.find((c) => c.active) ||
                      data.courses[0];

                    if (!activeCourse) {
                      return (
                        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs text-[#B8D8E6]">
                          אין קורסים מוגדרים במערכת.
                        </p>
                      );
                    }

                    return (
                      <CourseTasksMatrixView
                        course={activeCourse}
                        students={data.students}
                        attendanceLogs={data.attendance}
                        submissions={submissions}
                        customTasks={customTasks}
                        onToggleSubmission={(studentId, taskId, completed) =>
                          handleToggleSubmission(studentId, taskId, completed)
                        }
                        onEditSubmissionNote={(studentId, taskId) => {
                          const student = data.students.find((s) => s.id === studentId);
                          const task = [
                            ...getDefaultCourseTasks(activeCourse.id, activeCourse.name),
                            ...customTasks,
                          ].find((t) => t.id === taskId);
                          const sub = submissions.find(
                            (s) => s.studentId === studentId && s.taskId === taskId
                          );
                          if (student && task) {
                            setTaskNoteModalData({ student, task, submission: sub });
                          }
                        }}
                        onAddCustomTask={(title) => handleAddCustomTask(activeCourse.id, title)}
                        onViewStudentCard={handleOpenQuickCard}
                        onBack={exitMoreSubView}
                      />
                    );
                  })()}
                </div>
              )}

              {moreView === "help" && (
                <InstructorHelpHub
                  userEmail={userEmail}
                  courses={data.courses}
                  onNavigate={(destTab, destMoreView) => {
                    setTab(destTab);
                    if (destMoreView) {
                      handleOpenMoreView(destMoreView);
                    } else {
                      setMoreView("menu");
                    }
                  }}
                  onBack={exitMoreSubView}
                />
              )}
            </div>
          )}
        </section>
      )}

      {selectedLog && selectedStudent && (
        <StudentActionBottomSheet
          log={selectedLog}
          student={selectedStudent}
          onClose={closeAttendanceModal}
          onStatusChange={async (status) => {
            await updateAttendanceLog(selectedLog.id, {status});
            setPendingSyncCount(getPendingQueue().length);
            await refreshData();
            closeAttendanceModal();
          }}
          onNotesChange={async (notes) => {
            await updateAttendanceLog(selectedLog.id, {notes});
            setPendingSyncCount(getPendingQueue().length);
            await refreshData();
          }}
        />
      )}

      {/* Student Quick Card Modal */}
      {quickCardStudent && (
        <StudentQuickCardModal
          stats={calculateStudentAttendanceStats(quickCardStudent, data.attendance, data.courses.find(c => c.id === quickCardStudent.courseId))}
          courseName={data.courses.find((c) => c.id === quickCardStudent.courseId)?.name}
          isYearly={isYearlyCourse(
            data.courses.find((c) => c.id === quickCardStudent.courseId)?.name,
            data.courses.find((c) => c.id === quickCardStudent.courseId)?.description
          )}
          tasks={[
            ...getDefaultCourseTasks(
              quickCardStudent.courseId,
              data.courses.find((c) => c.id === quickCardStudent.courseId)?.name
            ),
            ...customTasks.filter((t) => t.courseId === quickCardStudent.courseId),
          ]}
          submissions={submissions.filter((s) => s.studentId === quickCardStudent.id)}
          onToggleTask={(taskId, completed) =>
            handleToggleSubmission(quickCardStudent.id, taskId, completed)
          }
          onClose={closeQuickCard}
        />
      )}

      {taskNoteModalData && (
        <TaskNoteModal
          studentName={taskNoteModalData.student.name}
          taskTitle={taskNoteModalData.task.title}
          initialNote={taskNoteModalData.submission?.notes}
          initialDate={taskNoteModalData.submission?.completedDate}
          onSave={(note, date) =>
            handleSaveTaskNote(
              taskNoteModalData.student.id,
              taskNoteModalData.task.id,
              note,
              date
            )
          }
          onClose={() => setTaskNoteModalData(null)}
        />
      )}

      {studentAddSheetOpen && (
        <AddStudentBottomSheet
          courses={data.courses}
          students={data.students}
          initialCourseId={studentCourse === "all" ? data.courses[0]?.id ?? "" : studentCourse}
          onClose={closeStudentAddSheet}
          onSaved={refreshData}
        />
      )}

      {modal?.type === "course" && (
        <Modal
          title={modal.course ? "עריכת כיתה" : "הוספת כיתה חדשה"}
          onClose={closeModal}
        >
          <CourseForm
            course={modal.course}
            onSave={async (name, description) => {
              const savedCourse = { id: modal.course?.id ?? makeId(), name, description, active: modal.course?.active ?? true };
              await saveCourse(savedCourse);
              await refreshData();
              closeModal();
              if (!modal.course) setScheduleCourse(savedCourse);
            }}
          />
        </Modal>
      )}

      {scheduleCourse && <ScheduleModal course={scheduleCourse}
        recordedDates={[...data.attendance.filter(l => l.courseId === scheduleCourse.id).map(l => l.date), ...lessons.filter(l => l.courseId === scheduleCourse.id).map(l => l.date)]}
        onClose={() => setScheduleCourse(null)}
        onOpenDate={date => openScheduledDate(scheduleCourse.id,date)}
        onSave={async schedule => {
          await saveCourseSchedule(scheduleCourse, schedule);
          await refreshData(); setScheduleCourse(null); notify('לוח המפגשים נשמר לכל המורים.');
        }}/>}

      {modal?.type === "student" && (
        <Modal
          title={modal.student ? "עריכת פרטי תלמיד/ה" : "הוספת תלמיד/ה"}
          onClose={closeModal}
        >
          <StudentForm
            courses={data.courses}
            student={modal.student}
            initialCourseId={modal.initialCourseId ?? data.courses[0]?.id ?? ""}
            onSave={async (name, email, courseId) => {
              await saveStudent({
                id: modal.student?.id ?? makeId(),
                name,
                email,
                courseId,
                active: modal.student?.active ?? true,
              });
              await refreshData();
              closeModal();
            }}
          />
        </Modal>
      )}

      {modal?.type === "import" && (
        <AddStudentBottomSheet
          courses={data.courses}
          students={data.students}
          initialCourseId={modal.initialCourseId ?? (studentCourse === "all" ? data.courses[0]?.id ?? "" : studentCourse)}
          onClose={closeModal}
          onSaved={refreshData}
        />
      )}

      {geminiSettingsOpen && (
        <GeminiSettingsModal
          currentKey={geminiApiKey || undefined}
          onClose={() => setGeminiSettingsOpen(false)}
          onSave={(key) => {
            handleSaveGeminiKey(key);
            setGeminiSettingsOpen(false);
          }}
          onClear={() => {
            handleClearGeminiKey();
            setGeminiSettingsOpen(false);
          }}
        />
      )}

      {syllabusModalCourse && (
        <CourseSyllabusModal
          course={syllabusModalCourse}
          onSchedule={() => { setScheduleCourse(syllabusModalCourse); setSyllabusModalCourse(null); }}
          onClose={() => setSyllabusModalCourse(null)}
          onSave={async (syllabusText) => {
            await handleSaveSyllabus(syllabusModalCourse.id, syllabusText);
            setSyllabusModalCourse(null);
          }}
        />
      )}

      {lessonTopicModalData && (
        <LessonTopicModal
          course={lessonTopicModalData.course}
          date={lessonTopicModalData.date}
          existingLog={lessonTopicModalData.existingLog}
          currentUserEmail={userEmail || undefined}
          onClose={() => setLessonTopicModalData(null)}
          onSave={async (topic, summary) => {
            await handleSaveLessonTopic(
              lessonTopicModalData.course.id,
              lessonTopicModalData.date,
              topic,
              summary
            );
            setLessonTopicModalData(null);
          }}
        />
      )}

      {aiAnalysisModalCourse && (
        <AISyllabusAnalysisModal
          course={aiAnalysisModalCourse}
          lessons={lessons}
          analysis={currentAnalysis}
          loading={analysisLoading}
          hasGeminiKey={Boolean(geminiApiKey)}
          onReanalyze={() => void handleOpenAIAnalysis(aiAnalysisModalCourse)}
          onEditSyllabus={() => {
            const c = aiAnalysisModalCourse;
            setAiAnalysisModalCourse(null);
            handleOpenSyllabusModal(c);
          }}
          onOpenGeminiSettings={() => {
            setAiAnalysisModalCourse(null);
            setGeminiSettingsOpen(true);
            safePushHistory("geminiSettings");
          }}
          onClose={() => setAiAnalysisModalCourse(null)}
        />
      )}

      <div
        className={`pointer-events-none fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-2xl bg-[#0F172A] px-4 py-3 text-center text-sm font-bold text-white shadow-[0_16px_36px_rgba(11,59,73,0.20)] transition lg:bottom-6 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </Layout>
  );
}

function CourseForm({
  course,
  onSave,
}: {
  course?: Course;
  onSave: (name: string, description?: string) => Promise<void>;
}) {
  const [name, setName] = useState(course?.name ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(name.trim(), description.trim() || undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "שמירת הכיתה נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <label className="block text-xs font-bold text-[#475569]">
        שם הכיתה
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#CBD5E1] p-2.5 text-sm font-semibold"
        />
      </label>
      {!course && <p className="text-sm text-slate-600">לאחר שמירת הכיתה תעברו להגדרת לוח המפגשים: העלאת סילבוס, תאריכים ידניים או סדרה שבועית.</p>}
      <label className="block text-xs font-bold text-[#475569]">
        תיאור קצר (רשות)
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#CBD5E1] p-2.5 text-sm font-semibold"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-xs font-bold text-[#991B1B]">
          השמירה נכשלה: {error}
        </p>
      )}
      <button type="submit" disabled={saving || !name.trim()} className={`${primaryButton} w-full disabled:cursor-wait disabled:opacity-60`}>
        {saving ? "שומר..." : "שמירת כיתה"}
      </button>
    </form>
  );
}

function StudentForm({
  courses,
  student,
  initialCourseId,
  onSave,
}: {
  courses: Course[];
  student?: Student;
  initialCourseId: string;
  onSave: (name: string, email: string | undefined, courseId: string) => Promise<void>;
}) {
  const [name, setName] = useState(student?.name ?? "");
  const [email, setEmail] = useState(student?.email ?? "");
  const [courseId, setCourseId] = useState(student?.courseId ?? initialCourseId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !courseId || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(name.trim(), email.trim() || undefined, courseId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "שמירת פרטי התלמיד נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <label className="block text-xs font-bold text-[#475569]">
        כיתה
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#CBD5E1] p-2.5 text-sm font-semibold"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-bold text-[#475569]">
        שם מלא
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#CBD5E1] p-2.5 text-sm font-semibold"
        />
      </label>
      <label className="block text-xs font-bold text-[#475569]">
        אימייל (רשות)
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#CBD5E1] p-2.5 text-left text-sm font-semibold"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-xs font-bold text-[#991B1B]">
          השמירה נכשלה: {error}
        </p>
      )}
      <button type="submit" disabled={saving || !name.trim() || !courseId} className={`${primaryButton} w-full disabled:cursor-wait disabled:opacity-60`}>
        {saving ? "שומר..." : "שמירת פרטים"}
      </button>
    </form>
  );
}

function StudentActions({
  student,
  onEdit,
  onToggleActive,
}: {
  student: Student;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="תפריט אפשרויות"
        onClick={() => setOpen((prev) => !prev)}
        className="min-h-10 rounded-xl bg-[#002B45] px-3 text-xs font-bold text-[#B8D8E6]"
      >
        •••
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-20 w-40 rounded-2xl border border-white/14 bg-[#002B45] p-2 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
            className="block w-full rounded-xl px-3 py-2 text-right text-xs font-bold text-white hover:bg-[#005580]"
          >
            עריכה
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleActive();
              setOpen(false);
            }}
            className="block w-full rounded-xl px-3 py-2 text-right text-xs font-bold text-[#B8D8E6] hover:bg-[#005580]"
          >
            {student.active ? "השבתה" : "הפעלה"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="block w-full rounded-xl px-3 py-2 text-right text-xs font-bold text-[#B8D8E6]"
          >
            סגירה
          </button>
        </div>
      )}
    </div>
  );
}

function AddStudentBottomSheet({
  courses,
  students,
  initialCourseId,
  onClose,
  onSaved,
}: {
  courses: Course[];
  students: Student[];
  initialCourseId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"batch" | "single">("batch");
  const [courseId, setCourseId] = useState(initialCourseId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [batchText, setBatchText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [fileMessage, setFileMessage] = useState<{ type: "ok" | "info" | "error"; text: string } | null>(null);

  const preview = prepareStudentImport(batchText, courseId, students);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileMessage({ type: "info", text: "טוען ומנתח קובץ..." });

    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const txt = String(ev.target?.result || "");
          if (txt.trim()) {
            setBatchText(txt.trim());
            setFileMessage({ type: "ok", text: `נטענו נתונים בהצלחה מקובץ ${file.name}` });
          } else {
            setFileMessage({ type: "error", text: "הקובץ שנבחר ריק." });
          }
        };
        reader.readAsText(file);
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        setFileMessage({ type: "info", text: "מפענח קובץ Excel..." });
        const res = await extractStudentsFromExcelFile(file);
        if (res.success && res.text) {
          setBatchText(res.text);
          setFileMessage({ type: "ok", text: res.message });
        } else {
          setFileMessage({ type: "info", text: res.message });
        }
      }
    } catch (err) {
      setFileMessage({ type: "error", text: `שגיאה בטעינת הקובץ: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      e.target.value = "";
    }
  };

  const handleSaveBatch = async (e: FormEvent) => {
    e.preventDefault();
    if (preview.ready.length === 0 || !courseId || isImporting) return;
    setIsImporting(true);

    try {
      for (const row of preview.ready) {
        await saveStudent({
          id: makeId(),
          name: row.name,
          email: row.email,
          courseId,
          active: true,
        });
      }
      await onSaved();
      onClose();
    } catch (error) {
      setFileMessage({
        type: "error",
        text: error instanceof Error ? `אירעה שגיאה בשמירת התלמידים: ${error.message}` : "אירעה שגיאה בשמירת התלמידים.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveSingle = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !courseId || isImporting) return;
    setIsImporting(true);

    try {
      await saveStudent({
        id: makeId(),
        name: name.trim(),
        email: email.trim() || undefined,
        courseId,
        active: true,
      });
      await onSaved();
      onClose();
    } catch (error) {
      setFileMessage({
        type: "error",
        text: error instanceof Error ? `אירעה שגיאה בשמירת התלמיד: ${error.message}` : "אירעה שגיאה בשמירת התלמיד.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal title="ניהול תלמידים בכיתה" onClose={onClose}>
      <div className="space-y-4">
        {/* Prominent Destination Course Selector */}
        <div className="rounded-xl border border-[#00A6A6]/30 bg-[#00A6A6]/10 p-3">
          <label className="block text-xs font-extrabold text-[#005580]">
            🎯 שיוך לכיתה / קורס יעד:
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#00A6A6]/40 bg-white p-2.5 text-sm font-bold text-[#002B45] shadow-sm focus:border-[#00A6A6] focus:outline-none"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-[11px] font-semibold text-[#005580]">
            כל התלמידים ברשימה ישויכו ישירות לכיתה זו בלחיצת כפתור אחת.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setMode("batch")}
            className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition ${
              mode === "batch"
                ? "bg-[#002B45] text-white shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📁 ייבוא מרוכז / העלאת אקסל
          </button>
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition ${
              mode === "single"
                ? "bg-[#002B45] text-white shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            👤 הוספת תלמיד בודד
          </button>
        </div>

        {mode === "batch" ? (
          <form onSubmit={(e) => void handleSaveBatch(e)} className="space-y-3">
            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="block text-xs font-bold text-[#475569]">
                הדבקה מאקסל או העלאת קובץ:
              </label>
              <label className="cursor-pointer rounded-lg border border-[#00A6A6]/30 bg-[#00A6A6]/10 px-2.5 py-1 text-[11px] font-bold text-[#008080] hover:bg-[#00A6A6]/20 transition flex items-center gap-1">
                <span>📁 העלאת קובץ אקסל / CSV</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  onChange={(e) => void handleFileUpload(e)}
                  className="hidden"
                />
              </label>
            </div>

            {fileMessage && (
              <div
                className={`p-2.5 rounded-xl text-xs font-semibold ${
                  fileMessage.type === "ok"
                    ? "bg-[#10B981]/15 text-[#166534] border border-[#10B981]/30"
                    : fileMessage.type === "error"
                    ? "bg-[#EF4444]/15 text-[#991B1B] border border-[#EF4444]/30"
                    : "bg-[#0284C7]/15 text-[#0369A1] border border-[#0284C7]/30"
                }`}
              >
                {fileMessage.text}
              </div>
            )}

            <textarea
              rows={5}
              dir="auto"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="הדביקו כאן שורות ישירות מאקסל (המערכת מזהה ומסננת אוטומטית שמות תלמידים גם אם הטבלה מכילה ת.ז, טלפונים, ערים וכד')"
              className="mt-1 w-full rounded-xl border border-[#CBD5E1] p-2.5 text-xs font-mono leading-relaxed focus:border-[#00A6A6] focus:outline-none"
            />

            {batchText.trim() && (
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-lg bg-[#DCFCE7] px-2.5 py-1 text-[#166534]">
                  ✓ מוכנים לייבוא: {preview.ready.length}
                </span>
                {preview.duplicates.length > 0 && (
                  <span className="rounded-lg bg-[#FEF3C7] px-2.5 py-1 text-[#92400E]">
                    ⚠ כפילויות שידלגו: {preview.duplicates.length}
                  </span>
                )}
                {preview.invalid.length > 0 && (
                  <span className="rounded-lg bg-[#FEE2E2] px-2.5 py-1 text-[#991B1B]">
                    ✗ לא תקינים: {preview.invalid.length}
                  </span>
                )}
              </div>
            )}

            <p className="text-[11px] text-[#64748B] leading-relaxed">
              💡 <strong>טיפ:</strong> אפשר להעתיק עמודות שלמות מאקסל עם פרטי התלמידים. המערכת מחלצת אוטומטית את שמות התלמידים והאימיילים ומתעלמת משאר העמודות.
            </p>

            <button
              type="submit"
              disabled={preview.ready.length === 0 || isImporting}
              className={`${primaryButton} w-full disabled:opacity-50`}
            >
              {isImporting
                ? "מייבא תלמידים..."
                : preview.ready.length > 0
                ? `ייבוא ${preview.ready.length} תלמידים לכיתה`
                : "אנא הדביקו שמות או העלו קובץ"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleSaveSingle(e)} className="space-y-3">
            <label className="block text-xs font-bold text-[#475569]">
              שם מלא של התלמיד/ה:
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: דניאל כהן"
                className="mt-1 w-full rounded-xl border border-[#CBD5E1] p-2.5 text-sm font-semibold focus:border-[#00A6A6] focus:outline-none"
              />
            </label>
            <label className="block text-xs font-bold text-[#475569]">
              כתובת אימייל (רשות):
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="mt-1 w-full rounded-xl border border-[#CBD5E1] p-2.5 text-left text-sm font-semibold focus:border-[#00A6A6] focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={!name.trim() || isImporting}
              className={`${primaryButton} w-full disabled:opacity-50`}
            >
              {isImporting ? "שומר..." : "שמירת תלמיד חדש"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}

function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <section className="rounded-[20px] border border-dashed border-[#CBD5E1] bg-white/95 px-5 py-10 text-center text-[#0F172A] shadow-[0_14px_34px_rgba(0,24,34,0.12)]">
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[#475569]">{body}</p>
      {action && onAction && (
        <button type="button" onClick={onAction} className={`${primaryButton} mt-5`}>
          {action}
        </button>
      )}
    </section>
  );
}

function MoreGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`more-${title}`}>
      <h2 id={`more-${title}`} className="mb-2 px-1 text-sm font-extrabold text-[#B8D8E6]">{title}</h2>
      <div className="glass-panel divide-y divide-white/10 overflow-hidden rounded-[20px]">{children}</div>
    </section>
  );
}

function MoreAction({
  title,
  description,
  onClick,
  disabled = false,
  badge,
}: {
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-right text-white transition hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-55"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-base font-extrabold">{title}</strong>
          {badge && (
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-[#B8D8E6]">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs font-medium text-[#B8D8E6]">{description}</span>
      </span>
      {!disabled && <span className="text-lg text-[#B8D8E6]" aria-hidden="true">←</span>}
    </button>
  );
}
