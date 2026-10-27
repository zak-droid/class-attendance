import { useState } from 'react';
import type { Course } from './types';
import { Modal } from './components';
import { formatLocalDate, localDateKey } from './utils';

export function MeetingPicker({ courses, onOpen, onEdit, onClose }: { courses: Course[]; onOpen: (courseId: string, date: string) => void; onEdit: (course: Course) => void; onClose: () => void }) {
  const [courseId, setCourseId] = useState('');
  const course = courses.find(c => c.id === courseId);
  const today = localDateKey();
  const meetings = [...(course?.schedule?.meetings ?? [])].sort((a,b) => a.date.localeCompare(b.date));
  return <Modal title="בחירת כיתה ומפגש" onClose={onClose}>
    <div className="space-y-4">
      <label className="block font-bold">כיתה<select aria-label="בחירת כיתה למפגש" value={courseId} onChange={e => setCourseId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-400 bg-white px-3 text-base text-slate-900"><option value="">בחרו כיתה</option>{courses.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <p className="text-sm">בחרו תאריך כדי לדווח או לתקן נוכחות. פתיחת מפגש אינה מסמנת תלמידים.</p>
      {course && <>
        {!meetings.length && <p>לא הוגדרו מפגשים לכיתה זו.</p>}
        {[{title:'המפגשים הקרובים', rows:meetings.filter(m => m.date >= today)}, {title:'מפגשים קודמים', rows:meetings.filter(m => m.date < today).reverse()}].map(group => group.rows.length > 0 && <section key={group.title} className="space-y-2"><h3 className="font-bold">{group.title}</h3>{group.rows.map(m => <button type="button" key={m.id} disabled={m.status === 'cancelled'} aria-label={`פתיחת מפגש ${m.date}`} onClick={() => onOpen(course.id,m.date)} className="block min-h-16 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-right text-slate-900 hover:bg-teal-50 disabled:bg-slate-100 disabled:text-slate-500"><span className="block font-bold">{formatLocalDate(m.date)}{m.number ? ` · מפגש ${m.number}` : ''}</span><span className="block text-sm">{m.topic}</span><span className="mt-1 block text-sm font-bold">{m.status === 'cancelled' ? 'ללא לימודים / מבוטל' : 'פתיחת נוכחות ותיעוד'}</span></button>)}</section>)}
        <button type="button" className="min-h-11 rounded-lg border border-slate-400 px-3 font-bold" onClick={() => onEdit(course)}>עריכת לוח המפגשים והסילבוס</button>
      </>}
    </div>
  </Modal>;
}
