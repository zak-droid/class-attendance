import { readAllRows } from './paginated-read';
import { scheduleErrors } from './schedule';
import { supabase } from './supabase';
import { getStoredLessons, getStoredCustomTasks, getStoredSubmissions, getStoredCourseSyllabus, isOnline } from './offline-storage';
import type { Course, CourseSchedule, CourseTask, LessonLog, StudentTaskSubmission } from './types';

export type SharedKind = 'lesson' | 'task' | 'submission' | 'syllabus' | 'session' | 'legacy_backup' | 'schedule';
export interface SharedRecord { kind: SharedKind; id: string; course_id: string; payload: Record<string, unknown> }
const migrationKey = 'attendance_shared_migration_v1';
let migration: Promise<void> | undefined;

export async function saveSharedRecord(kind: SharedKind, id: string, courseId: string, payload: object): Promise<void> {
  if (!supabase || !isOnline()) throw new Error('נדרש חיבור לאינטרנט לשמירה משותפת. התוכן נשאר בטופס; נסו שוב כשיחזור החיבור.');
  const { error } = await supabase.from('app_records').upsert({ kind, id, course_id: courseId, payload }, { onConflict: 'kind,id' }).select('id').abortSignal(AbortSignal.timeout(15000)).single();
  if (error) throw new Error(error.message);
}

// Every device imports its legacy work once. Existing shared records win; all
// originals are also archived on the server, so a conflicting local version is
// recoverable instead of being silently overwritten or deleted.
async function importLegacy(courses: Course[]): Promise<void> {
  if (localStorage.getItem(migrationKey)) return;
  const records: SharedRecord[] = [];
  const add = (kind: SharedKind, id: string, courseId: string, payload: object) => {
    if (courses.some(c => c.id === courseId)) records.push({kind, id, course_id: courseId, payload: payload as Record<string, unknown>});
  };
  getStoredLessons().forEach(l => add('lesson', `${l.courseId}_${l.date}`, l.courseId, l));
  getStoredCustomTasks().forEach(t => add('task', t.id, t.courseId, t));
  getStoredSubmissions().forEach(s => add('submission', `${s.studentId}_${s.taskId}`, s.courseId, s));
  courses.forEach(c => { const syllabus = getStoredCourseSyllabus(c.id); if (syllabus) add('syllabus', c.id, c.id, {syllabus}); });
  if (records.length) {
    let device = localStorage.getItem(`${migrationKey}_device`);
    if (!device) { device = crypto.randomUUID(); localStorage.setItem(`${migrationKey}_device`, device); }
    const backups = records.map(r => ({ ...r, kind: 'legacy_backup', id: `${device}_${r.kind}_${r.id}`, payload: { originalKind: r.kind, originalId: r.id, value: r.payload } }));
    const {error} = await supabase!.from('app_records').upsert([...backups, ...records], {onConflict:'kind,id', ignoreDuplicates:true});
    if (error) throw new Error(`העברת המידע המקומי לשרת נכשלה: ${error.message}`);
  }
  localStorage.setItem(migrationKey, new Date().toISOString());
}

export async function fetchSharedRecords(courses: Course[]) {
  if (!migration) migration = importLegacy(courses).catch(error => { migration = undefined; throw error; });
  await migration;
  const rows = await readAllRows<SharedRecord>((from,to) => supabase!.from('app_records').select('kind,id,course_id,payload').neq('kind','legacy_backup').order('kind').order('id').range(from,to));
  return {
    courses: courses.map(c => ({...c, syllabus: (rows.find(r => r.kind === 'syllabus' && r.id === c.id)?.payload.syllabus as string) ?? '', schedule: rows.find(r => r.kind === 'schedule' && r.id === c.id)?.payload as unknown as CourseSchedule | undefined})),
    lessons: rows.filter(r => r.kind === 'lesson').map(r => r.payload as unknown as LessonLog),
    tasks: rows.filter(r => r.kind === 'task').map(r => r.payload as unknown as CourseTask),
    submissions: rows.filter(r => r.kind === 'submission').map(r => r.payload as unknown as StudentTaskSubmission),
    completedSessions: rows.filter(r => r.kind === 'session' && r.payload.completed === true).map(r => r.id),
  };
}

export async function saveCourseSchedule(course: Course, draft: CourseSchedule): Promise<void> {
  const issues = scheduleErrors(draft.meetings);
  if (issues.length) throw new Error(issues.join(' '));
  if (!supabase || !isOnline()) throw new Error('נדרש חיבור לשמירת לוח המפגשים. הטיוטה נשמרת במסך.');
  const row = { kind: 'schedule', id: course.id, course_id: course.id, payload: draft };
  // Compare-and-swap prevents another teacher's edits being silently overwritten.
  const query = course.schedule
    ? supabase.from('app_records').update(row).eq('kind', 'schedule').eq('id', course.id).eq('payload->>revision', course.schedule.revision)
    : supabase.from('app_records').insert(row);
  const { error } = await query.select('id').abortSignal(AbortSignal.timeout(15000)).single();
  if (error) throw new Error(`לא נשמר הלוח. ייתכן שמורה אחר עדכן אותו; סגרו ופתחו מחדש כדי לטעון את הגרסה העדכנית. ${error.message}`);
}
