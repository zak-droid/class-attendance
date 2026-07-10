import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { AppData, AttendanceLog, Course, Student } from "./types";

function client() {
  if (!supabase) throw new Error("The shared database is not configured yet.");
  return supabase;
}

export async function fetchAppData(): Promise<AppData> {
  const db = client();
  const [coursesResult, studentsResult, attendanceResult] = await Promise.all([
    db.from("courses").select("id,name,description,active").order("name"),
    db.from("students").select("id,name,email,course_id,active").order("name"),
    db.from("attendance_logs").select("id,student_id,course_id,date,time,status,notes,marked_by").order("date", { ascending: false }),
  ]);

  const error = coursesResult.error ?? studentsResult.error ?? attendanceResult.error;
  if (error) throw error;

  return {
    courses: (coursesResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      active: row.active,
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
  };
}

export async function saveCourse(course: Course): Promise<void> {
  const { error } = await client().from("courses").upsert({
    id: course.id,
    name: course.name,
    description: course.description || null,
    active: course.active,
  });
  if (error) throw error;
}

export async function saveStudent(student: Student): Promise<void> {
  const { error } = await client().from("students").upsert({
    id: student.id,
    name: student.name,
    email: student.email || null,
    course_id: student.courseId,
    active: student.active,
  });
  if (error) throw error;
}

export async function setCourseActive(courseId: string, active: boolean): Promise<void> {
  const { error } = await client().from("courses").update({ active }).eq("id", courseId);
  if (error) throw error;
}

export async function setStudentActive(studentId: string, active: boolean): Promise<void> {
  const { error } = await client().from("students").update({ active }).eq("id", studentId);
  if (error) throw error;
}

export async function updateAttendanceLog(logId: string, updates: Partial<Pick<AttendanceLog, "status" | "notes">>): Promise<void> {
  const { error } = await client().from("attendance_logs").update(updates).eq("id", logId);
  if (error) throw error;
}

export async function createTodayAttendance(courseId: string, date: string, time: string): Promise<number> {
  const { data, error } = await client().rpc("start_attendance", {
    p_course_id: courseId,
    p_date: date,
    p_time: time,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export function subscribeToSharedData(onChange: () => void): () => void {
  const db = client();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const refreshSoon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 150);
  };
  const channel: RealtimeChannel = db
    .channel("class-attendance-shared-data")
    .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, refreshSoon)
    .on("postgres_changes", { event: "*", schema: "public", table: "students" }, refreshSoon)
    .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, refreshSoon)
    .subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    void db.removeChannel(channel);
  };
}
