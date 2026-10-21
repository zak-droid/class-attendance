import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { AppData, AttendanceLog, AttendanceStatus, Course, LessonLog, Student } from "./types";
import {
  applyPendingActionsToData,
  getCachedAppData,
  getPendingQueue,
  getStoredCourseSyllabus,
  getStoredLessons,
  isOnline,
  queuePendingAction,
  removePendingAction,
  saveCachedAppData,
  saveStoredCourseSyllabus,
  upsertLessonLog,
} from "./offline-storage";

function client() {
  if (!supabase) throw new Error("The shared database is not configured yet.");
  return supabase;
}

export async function fetchAppData(): Promise<AppData> {
  // Offline-first fast fallback
  if (!isOnline()) {
    const cached = getCachedAppData();
    if (cached) {
      return applyPendingActionsToData(cached);
    }
  }

  try {
    const db = client();
    const [coursesResult, studentsResult, attendanceResult] = await Promise.all([
      db.from("courses").select("id,name,description,active").order("name"),
      db.from("students").select("id,name,email,course_id,active").order("name"),
      db.from("attendance_logs").select("id,student_id,course_id,date,time,status,notes,marked_by").order("date", { ascending: false }),
    ]);

    const error = coursesResult.error ?? studentsResult.error ?? attendanceResult.error;
    if (error) throw error;

    const freshData: AppData = {
      courses: (coursesResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        active: row.active,
        syllabus: getStoredCourseSyllabus(row.id),
      })),
      students: (studentsResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email ?? undefined,
        courseId: row.course_id,
        active: row.active,
      })),
      attendance: (attendanceResult.data ?? []).map((row) => ({
        id: row.id,
        studentId: row.student_id,
        courseId: row.course_id,
        date: row.date,
        time: row.time,
        status: row.status,
        notes: row.notes ?? undefined,
        markedBy: row.marked_by ?? undefined,
      })) as AttendanceLog[],
      lessons: getStoredLessons(),
    };

    saveCachedAppData(freshData);
    return applyPendingActionsToData(freshData);
  } catch (error) {
    // If network failure occurs, fall back to locally cached data
    const cached = getCachedAppData();
    if (cached) {
      console.warn("Using offline cached data due to network error:", error);
      return applyPendingActionsToData(cached);
    }
    throw error;
  }
}

export async function saveCourse(course: Course): Promise<void> {
  if (course.syllabus !== undefined) {
    saveStoredCourseSyllabus(course.id, course.syllabus);
  }

  const { error } = await client().from("courses").upsert({
    id: course.id,
    name: course.name,
    description: course.description ?? null,
    active: course.active,
  });
  if (error) throw error;
}

export async function saveCourseSyllabus(courseId: string, syllabus: string): Promise<void> {
  saveStoredCourseSyllabus(courseId, syllabus);
  // Optionally update in supabase if column exists
  try {
    if (supabase) {
      await supabase.from("courses").update({ description: syllabus }).eq("id", courseId);
    }
  } catch {
    // Silently continue if supabase update fails; local storage guarantees persistence
  }
}

export async function saveLessonLog(lesson: LessonLog): Promise<LessonLog[]> {
  const updated = upsertLessonLog(lesson);
  // Optionally sync to supabase if table exists
  try {
    if (supabase && isOnline()) {
      await supabase.from("lesson_logs").upsert({
        id: lesson.id,
        course_id: lesson.courseId,
        date: lesson.date,
        topic: lesson.topic,
        summary: lesson.summary ?? null,
        instructor_email: lesson.instructorEmail ?? null,
      });
    }
  } catch {
    // Silently continue if supabase table not ready
  }
  return updated;
}

export async function setCourseActive(courseId: string, active: boolean): Promise<void> {
  const { error } = await client().from("courses").update({ active }).eq("id", courseId);
  if (error) throw error;
}

export async function saveStudent(student: Student): Promise<void> {
  const { error } = await client().from("students").upsert({
    id: student.id,
    name: student.name,
    email: student.email ?? null,
    course_id: student.courseId,
    active: student.active,
  });
  if (error) throw error;
}

export async function setStudentActive(studentId: string, active: boolean): Promise<void> {
  const { error } = await client().from("students").update({ active }).eq("id", studentId);
  if (error) throw error;
}

export async function createTodayAttendance(courseId: string, date: string, time: string): Promise<void> {
  if (!isOnline()) {
    queuePendingAction({
      type: "create_attendance",
      courseId,
      date,
      time,
    });
    return;
  }

  try {
    const { error } = await client().rpc("start_attendance", {
      p_course_id: courseId,
      p_date: date,
      p_time: time,
    });
    if (error) throw error;
  } catch (err) {
    queuePendingAction({
      type: "create_attendance",
      courseId,
      date,
      time,
    });
  }
}

export async function updateAttendanceLog(
  id: string,
  patch: { status?: AttendanceStatus; notes?: string }
): Promise<void> {
  if (!isOnline()) {
    queuePendingAction({
      type: "update_attendance",
      logId: id,
      patch,
    });
    return;
  }

  try {
    const payload: Record<string, unknown> = {};
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.notes !== undefined) payload.notes = patch.notes || null;
    const { error } = await client().from("attendance_logs").update(payload).eq("id", id);
    if (error) throw error;
  } catch (err) {
    queuePendingAction({
      type: "update_attendance",
      logId: id,
      patch,
    });
  }
}

export async function syncPendingQueue(): Promise<number> {
  const queue = getPendingQueue();
  if (queue.length === 0 || !isOnline()) return 0;

  let syncedCount = 0;
  const db = client();

  for (const action of queue) {
    try {
      if (action.type === "update_attendance") {
        const payload: Record<string, unknown> = {};
        if (action.patch.status !== undefined) payload.status = action.patch.status;
        if (action.patch.notes !== undefined) payload.notes = action.patch.notes || null;
        const { error } = await db.from("attendance_logs").update(payload).eq("id", action.logId);
        if (!error) {
          removePendingAction(action.id);
          syncedCount += 1;
        }
      } else if (action.type === "create_attendance") {
        const { error } = await db.rpc("start_attendance", {
          p_course_id: action.courseId,
          p_date: action.date,
          p_time: action.time,
        });
        if (!error) {
          removePendingAction(action.id);
          syncedCount += 1;
        }
      }
    } catch {
      // Keep in queue for next sync retry
    }
  }

  return syncedCount;
}

export function subscribeToSharedData(onRemoteChange: () => void): () => void {
  const db = supabase;
  if (!db) return () => {};
  const channel: RealtimeChannel = db
    .channel("attendance-app-changes")
    .on("postgres_changes", { event: "*", schema: "public" }, () => {
      onRemoteChange();
    })
    .subscribe();

  return () => {
    void db.removeChannel(channel);
  };
}
