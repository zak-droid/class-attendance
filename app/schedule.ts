import type { ScheduledMeeting } from './types';

export function pdfLineText(parts: {x:number; width:number; text:string}[]): string {
  const groups: {x:number; end:number; text:string; numeric:boolean}[] = [];
  for (const part of [...parts].sort((a,b) => a.x-b.x)) {
    const numeric = /^[\d\s/.:\-–]+$/.test(part.text);
    const previous = groups.at(-1);
    if (numeric && previous?.numeric && part.x - previous.end < 5) {
      previous.text += part.text.trim(); previous.end = part.x + part.width;
    } else groups.push({x:part.x,end:part.x+part.width,text:part.text.trim(),numeric});
  }
  return groups.reverse().map(g => g.text).join(' | ');
}

export function parseScheduleLines(lines: string[]): ScheduledMeeting[] {
  const result: ScheduledMeeting[] = [];
  for (let i=0;i<lines.length;i++) {
    const rows = parseScheduleText(lines[i]);
    if (!rows.length) continue;
    const previous = lines[i-1] ?? '';
    const numbered = /^מפגש\s*\|\s*(\d+(?:[-–]\d+)?)/.exec(previous);
    const inlineNumber = /^(\d+(?:[-–]\d+)?)\s*\|/.exec(lines[i]);
    const number = numbered?.[1] ?? inlineNumber?.[1];
    const next = lines[i+1] ?? '';
    const times = (lines[i] + ' ' + (parseScheduleText(next).length ? '' : next)).match(/\b\d{1,2}:\d{2}\b/g) ?? [];
    const heading = numbered ? previous.replace(/^מפגש\s*\|\s*\d+(?:[-–]\d+)?\s*\|?/, '').trim() : '';
    rows.forEach((m,j) => result.push({...m,
      number: number ? String(parseInt(number,10)+j) : undefined,
      topic: (heading || m.topic.replace(/^\d+(?:[-–]\d+)?\s*\|/, '')).replace(/\s*\|\s*/g,' ').trim(),
      startTime: times[0]?.padStart(5,'0'), endTime: times[1]?.padStart(5,'0'),
    }));
  }
  return result.sort((a,b) => a.date.localeCompare(b.date));
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function scheduleErrors(meetings: ScheduledMeeting[]): string[] {
  const errors: string[] = [];
  const dates = new Set<string>();
  for (const m of meetings) {
    if (!validDate(m.date)) errors.push('יש תאריך חסר או לא תקין.');
    if (dates.has(m.date)) errors.push(`התאריך ${m.date} מופיע יותר מפעם אחת. אפשר לרכז כמה נושאים באותו יום לימודים.`);
    dates.add(m.date);
    if (m.startTime && m.endTime && m.endTime <= m.startTime) errors.push(`שעת הסיום חייבת להיות אחרי שעת ההתחלה (${m.date}).`);
  }
  return [...new Set(errors)];
}

// Explicit calendar dates, never elapsed milliseconds: DST does not shift lessons.
export function weeklyMeetings(start: string, weekday: number, count: number): ScheduledMeeting[] {
  if (!validDate(start) || !Number.isInteger(count) || count < 1 || count > 200) throw new Error('בחרו תאריך התחלה ומספר מפגשים בין 1 ל־200.');
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (weekday - date.getUTCDay() + 7) % 7);
  return Array.from({ length: count }, (_, i) => {
    const meeting: ScheduledMeeting = { id: crypto.randomUUID(), date: date.toISOString().slice(0, 10), number: String(i + 1), topic: '', status: 'scheduled' };
    date.setUTCDate(date.getUTCDate() + 7);
    return meeting;
  });
}

export function parseScheduleText(text: string): ScheduledMeeting[] {
  const result: ScheduledMeeting[] = [];
  // A date range within one month, an Israeli date, or ISO date. Text is retained
  // for review; dates on cancelled/holiday lines never become teaching sessions.
  const pattern = /(?<!\d)(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{4}|\d{2}))(?!\d)/g;
  for (const line of text.replace(/[\u200e\u200f\u202a-\u202e]/g, '').split('\n')) {
    for (const match of line.matchAll(pattern)) {
      const year = match[1] ? +match[1] : +match[7] + (match[7].length === 2 ? 2000 : 0);
      const month = +(match[2] ?? match[6]);
      const first = +(match[3] ?? match[4]);
      const last = match[5] ? +match[5] : first;
      if (last < first || last - first > 30) throw new Error(`טווח תאריכים לא ברור: ${match[0]}`);
      const groupId = last > first ? crypto.randomUUID() : undefined;
      const topic = line.replace(pattern, '').replace(/^[\s|,;\t]+|[\s|,;\t]+$/g, '').trim();
      const times = line.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
      for (let day = first; day <= last; day++) {
        const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        if (!validDate(date)) throw new Error(`תאריך לא תקין: ${match[0]}`);
        result.push({ id: crypto.randomUUID(), date, topic, groupId, status: /יום בחירות|אין (?:לימודים|מפגש)|מבוטל|חופשה/.test(line) ? 'cancelled' : 'scheduled', startTime: times[0]?.padStart(5,'0'), endTime: times[1]?.padStart(5,'0') });
      }
    }
  }
  return result.sort((a,b) => a.date.localeCompare(b.date));
}

// Imports merge by date. They never discard an existing meeting or its identity.
export function mergeMeetings(existing: ScheduledMeeting[], incoming: ScheduledMeeting[]): ScheduledMeeting[] {
  const result = new Map(existing.map(m => [m.date, m]));
  incoming.forEach(m => { const old = result.get(m.date); result.set(m.date, old ? { ...m, ...old } : m); });
  return [...result.values()].sort((a,b) => a.date.localeCompare(b.date));
}

export function meetingOn(meetings: ScheduledMeeting[] | undefined, date: string) {
  return meetings?.find(m => m.date === date && m.status === 'scheduled');
}
