import { useState } from 'react';
import { Modal } from './components';
import type { Course, CourseSchedule, ScheduledMeeting } from './types';
import { mergeMeetings, parseScheduleText, scheduleErrors, weeklyMeetings } from './schedule';
import { formatLocalDate, localDateKey } from './utils';

const input = 'w-full min-h-11 rounded-lg border border-slate-300 bg-white p-2 text-slate-900';
const button = 'min-h-11 rounded-lg bg-[#006F78] px-3 py-2 text-sm font-bold text-white disabled:opacity-50';

export function ScheduleModal({ course, recordedDates, onClose, onSave, onOpenDate }: {
  course: Course; recordedDates: string[]; onClose: () => void;
  onSave: (schedule: CourseSchedule) => Promise<void>;
  onOpenDate: (date: string) => void;
}) {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>(() => structuredClone(course.schedule?.meetings ?? []));
  const [source, setSource] = useState({ sourceName: course.schedule?.sourceName, sourceText: course.schedule?.sourceText });
  const [mode, setMode] = useState<'pdf' | 'manual' | 'weekly'>('pdf');
  const [text, setText] = useState('');
  const [start, setStart] = useState(localDateKey());
  const [weekday, setWeekday] = useState(3);
  const [count, setCount] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const errors = scheduleErrors(meetings);
  const unplanned = [...new Set(recordedDates)].filter(date => !meetings.some(m => m.date === date && m.status === 'scheduled')).sort();
  const patch = (id: string, changes: Partial<ScheduledMeeting>) => {
    setDirty(true);
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...changes, previousDates: changes.date && changes.date !== m.date ? [...new Set([...(m.previousDates ?? []), m.date])] : m.previousDates } : m));
  };
  const add = (incoming: ScheduledMeeting[]) => {
    if (!incoming.length) throw new Error('לא נמצאו תאריכים. לדוגמה: 28/10/2026 פתיחת הקורס');
    const issues = scheduleErrors(incoming);
    if (issues.length) throw new Error(issues.join(' '));
    const added = incoming.filter(m => !meetings.some(old => old.date === m.date)).length;
    setMeetings(prev => mergeMeetings(prev, incoming)); setDirty(true);
    setNotice(`נוספו ${added} תאריכים לתצוגה המקדימה. תאריכים שכבר קיימים נשמרו ללא שינוי. בדקו את התאריכים, הביטולים והנושאים לפני השמירה.`);
    setError('');
  };
  const act = (fn: () => void) => { try { fn(); } catch(e) { setError((e as Error).message); } };
  const close = () => { if (busy) return; if (dirty) setConfirmClose(true); else onClose(); };
  return <Modal title={`לוח מפגשים — ${course.name}`} onClose={close}>
    <div className="space-y-4 text-slate-900">
      <p>כל תאריך הוא יום נוכחות נפרד. מסע של יומיים מופיע בשני תאריכים. שינוי בלוח אינו משנה דיווחי נוכחות שכבר נשמרו.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="דרך הזנת מפגשים">
        {([['pdf','העלאת סילבוס'],['manual','הזנה והדבקת תאריכים'],['weekly','סדרה שבועית']] as const).map(([key,label]) => <button key={key} className={`${button} ${mode === key ? 'ring-2 ring-offset-2 ring-teal-600' : ''}`} aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>)}
      </div>
      <fieldset disabled={busy} className="space-y-3">
      {mode === 'pdf' && <div className="space-y-2">
        <label className="block font-bold">קובץ סילבוס PDF<input aria-label="קובץ סילבוס PDF" className={input} type="file" accept=".pdf,application/pdf" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          setBusy(true); setError('');
          try {
            const { readSchedulePdf } = await import('./schedule-pdf');
            const result = await readSchedulePdf(file);
            add(result.meetings); setSource({sourceName: result.sourceName, sourceText: result.sourceText});
          } catch(err) { setError((err as Error).message); } finally { setBusy(false); e.target.value = ''; }
        }}/></label>
        <p className="text-sm">הקובץ משויך לכיתה זו. התאריכים נחלצים מקומית; טבלת הבדיקה למטה מאפשרת לתקן את הפענוח לפני השמירה.</p>
      </div>}
      {mode === 'manual' && <div className="space-y-2">
        <label className="block">רשימת תאריכים ונושאים<textarea aria-label="רשימת תאריכים ונושאים" className={input} rows={4} value={text} onChange={e => setText(e.target.value)} placeholder={'28/10/2026 פתיחת הקורס\n3–4/12/2026 מסע יומיים'}/></label>
        <button className={button} onClick={() => act(() => add(parseScheduleText(text)))}>הוספת הרשימה לבדיקה</button>
        <button className={`${button} mr-2`} onClick={() => { setMeetings(prev => [...prev, {id:crypto.randomUUID(), date:'', topic:'', status:'scheduled'}]); setDirty(true); }}>הוספת מפגש ידני</button>
      </div>}
      {mode === 'weekly' && <div className="grid gap-3 sm:grid-cols-3">
        <label>החל מתאריך<input aria-label="החל מתאריך" className={input} type="date" value={start} onChange={e => setStart(e.target.value)}/></label>
        <label>יום בשבוע<select aria-label="יום בשבוע" className={input} value={weekday} onChange={e => setWeekday(+e.target.value)}>{['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'].map((d,i) => <option value={i} key={i}>{d}</option>)}</select></label>
        <label>מספר מפגשים<input aria-label="מספר מפגשים" className={input} type="number" min={1} max={200} value={count} onChange={e => setCount(+e.target.value)}/></label>
        <button className={button} onClick={() => act(() => add(weeklyMeetings(start, weekday, count)))}>יצירת סדרה לבדיקה</button>
        <p className="sm:col-span-3 text-sm">לאחר היצירה אפשר לבטל ימי חופשה ולשנות תאריכים. הסדרה מתחילה ביום הנבחר הראשון החל מתאריך ההתחלה.</p>
      </div>}
      </fieldset>
      {busy && <p role="status">מעבד ושומר…</p>}
      {notice && <p role="status" className="rounded-lg bg-teal-50 p-3">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {source.sourceName && <p className="break-words text-sm">מקור: {source.sourceName}</p>}
      <h3 className="font-bold">{meetings.filter(m => m.status === 'scheduled').length} ימי מפגש · {meetings.filter(m => m.status === 'cancelled').length} תאריכים ללא לימודים</h3>
      <fieldset disabled={busy} className="space-y-3">
      {[...meetings].sort((a,b) => a.date.localeCompare(b.date)).map((m,i) => <div key={m.id} data-testid="schedule-row" className={`rounded-xl border p-3 ${m.status === 'cancelled' ? 'bg-slate-100' : 'bg-teal-50/40'}`}>
        {!course.schedule?.meetings.some(old => old.id === m.id) && <button className="mb-2 text-sm text-red-800 underline" onClick={() => { setMeetings(prev => prev.filter(row => row.id !== m.id)); setDirty(true); }}>הסרת טיוטת מפגש</button>}
        <div className="grid grid-cols-2 gap-2">
          <label>תאריך<input aria-label={`תאריך מפגש ${i+1}`} className={input} type="date" value={m.date} onChange={e => patch(m.id, {date:e.target.value})}/></label>
          <label>מצב<select aria-label={`מצב מפגש ${i+1}`} className={input} value={m.status} onChange={e => patch(m.id, {status:e.target.value as ScheduledMeeting['status']})}><option value="scheduled">מתוכנן</option><option value="cancelled">ללא לימודים / מבוטל</option></select></label>
          <p className="col-span-2 text-sm font-bold">{m.date && formatLocalDate(m.date)}{m.groupId ? ' · חלק ממפגש של כמה ימים' : ''}</p>
          <label>מספר מפגש<input aria-label={`מספר מפגש ${i+1}`} className={input} value={m.number ?? ''} onChange={e => patch(m.id,{number:e.target.value})}/></label>
          <label>מקום<input aria-label={`מקום מפגש ${i+1}`} className={input} value={m.location ?? ''} onChange={e => patch(m.id,{location:e.target.value})}/></label>
          <label className="col-span-2">נושא מתוכנן<input aria-label={`נושא מפגש ${i+1}`} className={input} value={m.topic} onChange={e => patch(m.id,{topic:e.target.value})}/></label>
          <label>שעת התחלה<input aria-label={`שעת התחלה ${i+1}`} className={input} type="time" value={m.startTime ?? ''} onChange={e => patch(m.id,{startTime:e.target.value})}/></label>
          <label>שעת סיום<input aria-label={`שעת סיום ${i+1}`} className={input} type="time" value={m.endTime ?? ''} onChange={e => patch(m.id,{endTime:e.target.value})}/></label>
        </div>
        {m.date && <button disabled={dirty} className={`${button} mt-2`} onClick={() => onOpenDate(m.date)}>נוכחות ודיווח ל־{m.date}</button>}
        {(m.previousDates ?? []).filter(d => recordedDates.includes(d)).map(d => <p key={d} className="mt-2 text-sm text-amber-900">קיים דיווח במועד הקודם {d}; הוא נשמר בהיסטוריה.</p>)}
      </div>)}
      </fieldset>
      {dirty && <p className="text-sm">יש לשמור את השינויים לפני פתיחת הנוכחות.</p>}
      {unplanned.length > 0 && <details className="rounded-lg bg-amber-50 p-3"><summary>דיווחים מחוץ ללוח המפגשים ({unplanned.length})</summary><p className="text-sm">הדיווחים הקיימים נשמרו בתאריכים המקוריים. ניתן לבדוק אותם בהיסטוריה.</p>{unplanned.map(d => <button disabled={dirty || busy} key={d} className={`${button} m-1`} onClick={() => onOpenDate(d)}>{d}</button>)}</details>}
      {source.sourceText && <details><summary>הטקסט שחולץ מהסילבוס</summary><pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs" dir="auto">{source.sourceText}</pre></details>}
      {errors.map(e => <p role="alert" key={e} className="text-red-800">{e}</p>)}
      <button disabled={busy || errors.length > 0 || !meetings.length} className={`${button} w-full`} onClick={async () => {
        setBusy(true); setError('');
        try { await onSave({ revision:crypto.randomUUID(), meetings:[...meetings].sort((a,b) => a.date.localeCompare(b.date)), ...source, updatedAt:new Date().toISOString() }); }
        catch(e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>שמירת לוח המפגשים</button>
      {confirmClose && <div role="alert" className="rounded-lg bg-amber-50 p-3">יש שינויים שטרם נשמרו.<div className="mt-2 flex gap-2"><button className={button} onClick={() => setConfirmClose(false)}>המשך עריכה</button><button className={button} onClick={onClose}>סגירה ללא שמירה</button></div></div>}
    </div>
  </Modal>;
}
