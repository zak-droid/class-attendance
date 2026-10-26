const courses = [
  { id: "course-1", name: "מתמטיקה בדיקה", description: null, active: true },
  { id: "course-2", name: "מדעים בדיקה", description: null, active: true },
];
const students = [
  { id: "student-1", name: "יעל כהן", email: null, course_id: "course-1", active: true },
  { id: "student-2", name: "יעל לוי", email: null, course_id: "course-1", active: true },
  { id: "student-3", name: "נועה ברק", email: null, course_id: "course-2", active: true },
];
const attendance_logs = [
  { id: "log-1", student_id: "student-1", course_id: "course-1", date: "2026-10-25", time: "09:00", status: "Present", notes: null, marked_by: "e2e" },
  { id: "log-2", student_id: "student-2", course_id: "course-1", date: "2026-10-25", time: "09:00", status: "Absent", notes: null, marked_by: "e2e" },
];
const tables: Record<string, any[]> = { courses, students, attendance_logs, app_records: [] };
const saved = sessionStorage.getItem('e2e-database');
if (saved) for (const [name, rows] of Object.entries(JSON.parse(saved))) tables[name].splice(0, tables[name].length, ...(rows as any[]));
const persist = () => sessionStorage.setItem('e2e-database', JSON.stringify(tables));
const session = { access_token: "e2e", user: { id: "e2e-user", email: "rotman555@gmail.com" } };
function query(table: string) {
  let action = "select"; let payload: any; let opts: any = {};
  const filters: ((r: any) => boolean)[] = [];
  const orders: [string, boolean][] = [];
  let start = 0, end = 999;
  const q: any = {
    select: () => q,
    order: (key: string, options?: any) => { orders.push([key, options?.ascending !== false]); return q; },
    range: (from: number, to: number) => { start=from; end=to; return q; },
    upsert: (row: any, options?: any) => { action = "upsert"; payload = row; opts=options ?? {}; return q; },
    update: (row: any) => { action = "update"; payload = row; return q; },
    eq: (key: string, value: any) => { filters.push(r => r[key] === value); return q; },
    neq: (key: string, value: any) => { filters.push(r => r[key] !== value); return q; },
    single: async () => { const res = await q.execute(); return { data: res.data?.[0] ?? null, error: res.error ?? (res.data?.length ? null : { message: "No row returned", code: "PGRST116" }) }; },
    execute: async () => { const result = await q.run(); persist(); return result; },
    run: async () => {
      const failKey = table === 'courses' ? 'e2e-fail-course' : `e2e-fail-${table}`;
      if (action !== 'select' && sessionStorage.getItem(failKey)) { sessionStorage.removeItem(failKey); return { data: null, error: { message: 'Simulated database rejection', code: '42501' } }; }
      const rows = tables[table] ?? [];
      if (action === "upsert") {
        const result = [];
        for (const value of Array.isArray(payload) ? payload : [payload]) {
          const keys = (opts.onConflict ?? 'id').split(',');
          const hit = rows.find(r => keys.every((key: string) => r[key] === value[key]));
          if (hit) { if (!opts.ignoreDuplicates) Object.assign(hit, value); result.push({...hit}); }
          else { const row = {id: crypto.randomUUID(), ...value}; rows.push(row); result.push({...row}); }
        }
        return { data: result, error: null };
      }
      const hit = rows.filter(r => filters.every(f => f(r)));
      if (action === "update") { hit.forEach(r => Object.assign(r,payload)); return {data: hit.map(r => ({...r})), error:null}; }
      hit.sort((a,b) => { for (const [key,asc] of orders) { const cmp=String(a[key]).localeCompare(String(b[key])); if(cmp) return asc ? cmp : -cmp; } return 0; });
      return { data: hit.slice(start,end+1).map(r => ({...r})), error:null };
    },
    then: (resolve: any, reject: any) => q.execute().then(resolve, reject),
  };
  return q;
}
export const isSupabaseConfigured = true;
export const supabase: any = {
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  from: (table: string) => query(table),
  rpc: async (name: string, args: any) => {
    if (name === "start_attendance") for (const s of students.filter((x) => x.course_id === args.p_course_id && x.active)) {
      const id = `log-${Date.now()}-${s.id}`;
      if (!attendance_logs.some((l) => l.student_id === s.id && l.course_id === args.p_course_id && l.date === args.p_date)) attendance_logs.push({ id, student_id: s.id, course_id: args.p_course_id, date: args.p_date, time: args.p_time, status: "Present", notes: null, marked_by: "e2e" });
    }
    persist();
    return { data: null, error: null };
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: async () => {},
};

