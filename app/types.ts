export type AttendanceStatus = "Present" | "Late" | "Absent" | "Excused";

export interface Course {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  courseId: string;
  active: boolean;
}

export interface AttendanceLog {
  id: string;
  studentId: string;
  courseId: string;
  date: string;
  time: string;
  status: AttendanceStatus;
  notes?: string;
  markedBy?: string;
}

export interface AppData {
  courses: Course[];
  students: Student[];
  attendance: AttendanceLog[];
}

export type AppTab = "courses" | "today" | "students" | "history";
