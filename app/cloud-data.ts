import { readAllRows } from './paginated-read';
import type { RealtimeChannel } from "@supabase/supabase-js";
import { fetchSharedRecords, saveSharedRecord } from "./shared-records";
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
    const [courses, students, attendance] = await Promise.all([
      readAllRows<any>((from,to) => db.from("courses").select("id,name,description,active").order("id").range(from,to)),
      readAllRows<any>((from,to) => db.from("students").select("id,name,email,course_id,active").order("id").range(from,to)),
      readAllRows<any>((from,to) => db.from("attendance_logs").select("id,student_id,course_id,date,time,status,notes,marked_by").order("date", { ascending: false }).order("id").range(from,to)),
    ]);


    const freshData: AppData = {
      courses: courses.sort((a,b) => a.name.localeCompare(b.name, "he")).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        active: row.active,
        syllabus: getStoredCourseSyllabus(row.id),
      })),
      students: students.sort((a,b) => a.name.localeCompare(b.name, "he")).map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email ?? undefined,
        courseId: row.course_id,
        active: row.active,
      })),
      attendance: attendance.map((row) => ({
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

    Object.assign(freshData, await fetchSharedRecords(freshData.courses));
    saveCachedAppData(freshData);
    return applyPendingActionsToData(freshData);
  } catch (error) {
    // If network failure occurs, fall back to locally cached data
    const cached = getCachedAppData();
    if (cached && !isOnline()) {
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

  const { error } = await client()
    .from("courses")
    .upsert({
      id: course.id,
      name: course.name,
      description: course.description ?? null,
      active: course.active,
    })
    .select("id")
    .single();
  if (error) throw error;
}

export async function saveCourseSyllabus(courseId: string, syllabus: string): Promise<void> {
  await saveSharedRecord('syllabus', courseId, courseId, {syllabus});
}
export async function saveLessonLog(lesson: LessonLog): Promise<void> {
  await saveSharedRecord('lesson', `${lesson.courseId}_${lesson.date}`, lesson.courseId, lesson);
}
export async function addStudentAttendance(student: Student, date: string, status: AttendanceStatus): Promise<void> {
  if (!isOnline()) throw new Error('נדרש חיבור להוספת תלמיד למפגש.');
  const {error} = await client().from('attendance_logs').upsert({student_id:student.id, course_id:student.courseId, date, time:new Date().toTimeString().slice(0,5), status}, {onConflict:'student_id,course_id,date',ignoreDuplicates:true});
  if(error) throw new Error(error.message);
}

export async function setCourseActive(courseId: string, active: boolean): Promise<void> {
  const { error } = await client()
    .from("courses")
    .update({ active })
    .eq("id", courseId)
    .select("id")
    .single();
  if (error) throw error;
}

export async function saveStudent(student: Student): Promise<void> {
  const { error } = await client()
    .from("students")
    .upsert({
      id: student.id,
      name: student.name,
      email: student.email ?? null,
      course_id: student.courseId,
      active: student.active,
    })
    .select("id")
    .single();
  if (error) throw error;
}

export async function setStudentActive(studentId: string, active: boolean): Promise<void> {
  const { error } = await client()
    .from("students")
    .update({ active })
    .eq("id", studentId)
    .select("id")
    .single();
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
    if (isOnline() && !(err instanceof TypeError) && (err as {code?: string})?.code) throw err;
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
  if (!isOnline() || id.startsWith("offline|")) {
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
    const { error } = await client().from("attendance_logs").update(payload).eq("id", id).select("id").single();
    if (error) throw error;
  } catch (err) {
    if (isOnline() && !(err instanceof TypeError) && (err as {code?: string})?.code) throw err;
    queuePendingAction({
      type: "update_attendance",
      logId: id,
      patch,
    });
  }
}

let syncInFlight: Promise<number> | undefined;
export function syncPendingQueue(): Promise<number> {
  if (!syncInFlight) syncInFlight = drainPendingQueue().finally(() => { syncInFlight = undefined; });
  return syncInFlight;
}
async function drainPendingQueue(): Promise<number> {
  const queue = getPendingQueue().sort((a,b) => Number(b.type === "create_attendance") - Number(a.type === "create_attendance"));
  if (queue.length === 0 || !isOnline()) return 0;

  let syncedCount = 0;
  const db = client();

  for (const action of queue) {
    try {
      if (action.type === "update_attendance") {
        const payload: Record<string, unknown> = {};
        if (action.patch.status !== undefined) payload.status = action.patch.status;
        if (action.patch.notes !== undefined) payload.notes = action.patch.notes || null;
        let query = db.from("attendance_logs").update(payload);
        const parts = action.logId.split("|");
        query = parts[0] === "offline"
          ? query.eq("student_id", parts[1]).eq("course_id", parts[2]).eq("date", parts[3])
          : query.eq("id", action.logId);
        const { error } = await query.select("id").single();
        if (!error) {
          if (JSON.stringify(getPendingQueue().find(a => a.id === action.id)) === JSON.stringify(action)) removePendingAction(action.id);
          syncedCount += 1;
        } else break;
      } else if (action.type === "create_attendance") {
        const { error } = await db.rpc("start_attendance", {
          p_course_id: action.courseId,
          p_date: action.date,
          p_time: action.time,
        });
        if (!error) {
          if (JSON.stringify(getPendingQueue().find(a => a.id === action.id)) === JSON.stringify(action)) removePendingAction(action.id);
          syncedCount += 1;
        } else break;
      }
    } catch {
      // Keep in queue for next sync retry; do not replay dependent edits yet.
      break;
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
