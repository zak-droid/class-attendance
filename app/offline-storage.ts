"use client";

import type {
  AISyllabusAnalysis,
  AppData,
  AttendanceStatus,
  CourseTask,
  LessonLog,
  StudentTaskSubmission,
} from "./types";

export const CACHE_STORAGE_KEY = "class_attendance_cache_v1";
export const PENDING_QUEUE_KEY = "class_attendance_pending_queue_v1";
export const SUBMISSIONS_STORAGE_KEY = "class_attendance_submissions_v1";
export const CUSTOM_TASKS_STORAGE_KEY = "class_attendance_custom_tasks_v1";
export const LESSONS_STORAGE_KEY = "class_attendance_lessons_v1";
export const SYLLABI_STORAGE_KEY = "class_attendance_syllabi_v1";

export type PendingAction =
  | {
      id: string;
      type: "update_attendance";
      logId: string;
      patch: { status?: AttendanceStatus; notes?: string };
      createdAt: string;
    }
  | {
      id: string;
      type: "create_attendance";
      courseId: string;
      date: string;
      time: string;
      createdAt: string;
    };

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // LocalStorage might be inaccessible (e.g. in restricted iframe)
  }
  return null;
}

export function isOnline(): boolean {
  if (typeof window !== "undefined" && window.navigator && typeof window.navigator.onLine === "boolean") {
    return window.navigator.onLine;
  }
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

export function saveCachedAppData(data: AppData): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to cache app data to localStorage:", err);
  }
}

export function getCachedAppData(): AppData | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

export function getStoredSubmissions(): StudentTaskSubmission[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StudentTaskSubmission[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredSubmissions(submissions: StudentTaskSubmission[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(submissions));
  } catch (err) {
    console.warn("Failed to save task submissions:", err);
  }
}

export function upsertTaskSubmission(submission: StudentTaskSubmission): StudentTaskSubmission[] {
  const current = getStoredSubmissions();
  const key = `${submission.studentId}_${submission.taskId}`;
  const idx = current.findIndex(
    (s) => s.id === key || (s.studentId === submission.studentId && s.taskId === submission.taskId)
  );

  const updated: StudentTaskSubmission = {
    ...submission,
    id: key,
    updatedAt: new Date().toISOString(),
  };

  let nextList: StudentTaskSubmission[];
  if (idx >= 0) {
    nextList = [...current];
    nextList[idx] = updated;
  } else {
    nextList = [...current, updated];
  }

  saveStoredSubmissions(nextList);
  return nextList;
}

export function getStoredCustomTasks(): CourseTask[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(CUSTOM_TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CourseTask[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredCustomTasks(tasks: CourseTask[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(CUSTOM_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.warn("Failed to save custom tasks:", err);
  }
}

export function upsertCustomTask(task: CourseTask): CourseTask[] {
  const current = getStoredCustomTasks();
  const idx = current.findIndex((t) => t.id === task.id);

  let nextList: CourseTask[];
  if (idx >= 0) {
    nextList = [...current];
    nextList[idx] = task;
  } else {
    nextList = [...current, task];
  }

  saveStoredCustomTasks(nextList);
  return nextList;
}

// -------------------------------------------------------------
// Lesson Logging & Course Syllabus Persistence
// -------------------------------------------------------------

export function getStoredLessons(): LessonLog[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LESSONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LessonLog[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredLessons(lessons: LessonLog[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(LESSONS_STORAGE_KEY, JSON.stringify(lessons));
  } catch (err) {
    console.warn("Failed to save lesson logs:", err);
  }
}

export function upsertLessonLog(lesson: LessonLog): LessonLog[] {
  const current = getStoredLessons();
  const key = lesson.id || `${lesson.courseId}_${lesson.date}`;
  const idx = current.findIndex(
    (l) => l.id === key || (l.courseId === lesson.courseId && l.date === lesson.date)
  );

  const updated: LessonLog = {
    ...lesson,
    id: key,
    updatedAt: new Date().toISOString(),
  };

  let nextList: LessonLog[];
  if (idx >= 0) {
    nextList = [...current];
    nextList[idx] = updated;
  } else {
    nextList = [...current, updated];
  }

  saveStoredLessons(nextList);
  return nextList;
}

export function deleteLessonLog(id: string): LessonLog[] {
  const current = getStoredLessons();
  const nextList = current.filter((l) => l.id !== id);
  saveStoredLessons(nextList);
  return nextList;
}

export function getStoredCourseSyllabus(courseId: string): string {
  const storage = getStorage();
  if (!storage) return "";
  try {
    const raw = storage.getItem(`${SYLLABI_STORAGE_KEY}_${courseId}`);
    return raw || "";
  } catch {
    return "";
  }
}

export function saveStoredCourseSyllabus(courseId: string, syllabus: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(`${SYLLABI_STORAGE_KEY}_${courseId}`, syllabus);
  } catch (err) {
    console.warn("Failed to save syllabus:", err);
  }
}

// -------------------------------------------------------------
// Offline Queue
// -------------------------------------------------------------

export function getPendingQueue(): PendingAction[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingAction[]) : [];
  } catch {
    return [];
  }
}

function savePendingQueue(queue: PendingAction[]): void {
  const storage = getStorage();
  if (!storage) throw new Error("האחסון המקומי אינו זמין. לא ניתן לשמור ללא חיבור.");
  storage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
}

export function queuePendingAction(
  action:
    | {
        type: "update_attendance";
        logId: string;
        patch: { status?: AttendanceStatus; notes?: string };
        id?: string;
        createdAt?: string;
      }
    | {
        type: "create_attendance";
        courseId: string;
        date: string;
        time: string;
        id?: string;
        createdAt?: string;
      }
): PendingAction {
  const fullAction: PendingAction = {
    ...action,
    id: action.id || `pending_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: action.createdAt || new Date().toISOString(),
  } as PendingAction;

  const currentQueue = getPendingQueue();
  const existingIdx = currentQueue.findIndex(
    (item) => item.type === "update_attendance" && fullAction.type === "update_attendance" && item.logId === fullAction.logId
  );

  if (existingIdx >= 0 && fullAction.type === "update_attendance") {
    const existing = currentQueue[existingIdx];
    if (existing.type === "update_attendance") {
      currentQueue[existingIdx] = {
        ...existing,
        createdAt: fullAction.createdAt,
        patch: { ...existing.patch, ...fullAction.patch },
      };
    }
  } else {
    currentQueue.push(fullAction);
  }

  savePendingQueue(currentQueue);
  return fullAction;
}

export function removePendingAction(id: string): void {
  const currentQueue = getPendingQueue();
  const nextQueue = currentQueue.filter((item) => item.id !== id);
  savePendingQueue(nextQueue);
}

export function clearPendingQueue(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(PENDING_QUEUE_KEY);
}

export function applyPendingActionsToData(data: AppData): AppData {
  const queue = getPendingQueue();
  const submissions = getStoredSubmissions();
  const customTasks = getStoredCustomTasks();
  const lessons = getStoredLessons();

  const clonedAttendance = data.attendance.map((log) => ({ ...log }));

  // Project queued sessions before their edits, so a teacher can work offline.
  for (const action of queue) {
    if (action.type !== "create_attendance") continue;
    for (const student of data.students.filter(s => s.active && s.courseId === action.courseId)) {
      if (!clonedAttendance.some(l => l.studentId === student.id && l.courseId === action.courseId && l.date === action.date)) {
        clonedAttendance.push({id: `offline|${student.id}|${action.courseId}|${action.date}`, studentId: student.id, courseId: action.courseId, date: action.date, time: action.time, status: "Present"});
      }
    }
  }
  for (const action of queue) {
    if (action.type === "update_attendance") {
      const parts = action.logId.split("|");
      const target = clonedAttendance.find(log => log.id === action.logId || (parts[0] === "offline" && log.studentId === parts[1] && log.courseId === parts[2] && log.date === parts[3]));
      if (target) {
        if (action.patch.status !== undefined) target.status = action.patch.status;
        if (action.patch.notes !== undefined) target.notes = action.patch.notes;
      }
    }
  }

  return {
    ...data,
    attendance: clonedAttendance,
    tasks: data.tasks ?? customTasks,
    submissions: data.submissions ?? submissions,
    lessons: data.lessons ?? lessons,
  };
}

export const GEMINI_API_KEY_STORAGE_KEY = "class_attendance_gemini_api_key_v1";
export const ANALYSIS_STORAGE_KEY = "class_attendance_syllabus_analysis_v1";

export function getStoredGeminiApiKey(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    return raw ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function saveStoredGeminiApiKey(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const trimmed = key.trim();
    if (trimmed) {
      storage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
    } else {
      storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to save Gemini API key:", err);
  }
}

export function clearStoredGeminiApiKey(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function hasStoredGeminiApiKey(): boolean {
  return Boolean(getStoredGeminiApiKey());
}

export function getStoredAnalysis(courseId: string): AISyllabusAnalysis | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${ANALYSIS_STORAGE_KEY}_${courseId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AISyllabusAnalysis;
  } catch {
    return null;
  }
}

export function saveStoredAnalysis(courseId: string, analysis: AISyllabusAnalysis): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(`${ANALYSIS_STORAGE_KEY}_${courseId}`, JSON.stringify(analysis));
  } catch {
    // Ignore
  }
}
