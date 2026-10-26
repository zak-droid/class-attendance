export type AttendanceStatus = "Present" | "Late" | "Absent" | "Excused";

export type EligibilityStatus = "eligible" | "at_risk" | "not_eligible";

export interface Course {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  isYearly?: boolean;
  syllabus?: string;
  schedule?: CourseSchedule;
}

export interface ScheduledMeeting {
  id: string;
  date: string;
  number?: string;
  topic: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  status: 'scheduled' | 'cancelled';
  groupId?: string;
  previousDates?: string[];
}

export interface CourseSchedule {
  revision: string;
  meetings: ScheduledMeeting[];
  sourceName?: string;
  sourceText?: string;
  updatedAt: string;
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

export interface CourseTask {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  requiredForCertificate: boolean;
  yearlyOnly?: boolean;
}

export interface StudentTaskSubmission {
  id: string;
  studentId: string;
  courseId: string;
  taskId: string;
  completed: boolean;
  completedDate?: string;
  notes?: string;
  updatedAt?: string;
}

export interface LessonLog {
  id: string;
  courseId: string;
  date: string;
  topic: string;
  summary?: string;
  instructorEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AISyllabusAnalysis {
  coveragePercent: number;
  coveredTopics: string[];
  pendingTopics: string[];
  recommendationForNextLesson: string;
  repetitionWarnings: string[];
  analyzedAt: string;
  usedGeminiAI: boolean;
  rawSummary?: string;
}

export interface AppData {
  courses: Course[];
  students: Student[];
  attendance: AttendanceLog[];
  tasks?: CourseTask[];
  submissions?: StudentTaskSubmission[];
  lessons?: LessonLog[];
  completedSessions?: string[];
}

export type AppTab = "today" | "students" | "history" | "more";
