import fs from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

const first = 'אור בדיקה שם משפחה מורכב';
async function prepare(page: Page, teacher = 'rotman555@gmail.com', course = 'course-1') {
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00Z'));
  await page.route('https://**/*', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'שיעורי היום',exact:true})).toBeVisible();
  await page.evaluate(({teacher,course,first}) => {
    const db = JSON.parse(sessionStorage.getItem('e2e-database')!);
    sessionStorage.setItem('e2e-user-email',teacher);
    db.courses.find((c:any)=>c.id==='course-1').name='שנתי 2 — רותם';
    db.courses.find((c:any)=>c.id==='course-2').name='שנתי 3 — דותן';
    db.students = Array.from({length:20},(_,i)=>({id:`day-student-${i}`,name:i===0?first:`תלמיד בדיקה ${String(i).padStart(2,'0')}`,course_id:course,active:true}));
    db.attendance_logs = [{id:'original-history',student_id:'day-student-0',course_id:course,date:'2026-10-20',time:'09:00',status:'Present',notes:'דיווח קודם לשימור'}];
    db.app_records.forEach((r:any)=>r.payload.meetings=[{id:'previous',date:'2026-10-20',topic:'מפגש קודם',status:'scheduled'},{id:'next',date:'2026-10-28',number:'2',topic:'מפגש יומי לבדיקה',status:'scheduled'},{id:'cancelled',date:'2026-11-04',topic:'חופשה',status:'cancelled'}]);
    sessionStorage.setItem('e2e-database',JSON.stringify(db)); localStorage.clear();
  },{teacher,course,first});
  await page.reload();
  await expect(page.getByText(teacher,{exact:true})).toBeVisible();
  if(await page.getByRole('button',{name:'לא עכשיו',exact:true}).count()) await page.getByRole('button',{name:'לא עכשיו',exact:true}).click();
}
async function openMeeting(page: Page, course = 'course-1', date = '2026-10-28') {
  await page.getByRole('button',{name:'בחירת כיתה ומפגש',exact:true}).click();
  await page.getByLabel('בחירת כיתה למפגש').selectOption(course);
  await expect(page.getByRole('button',{name:'פתיחת מפגש 2026-11-04',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:`פתיחת מפגש ${date}`,exact:true}).click();
  await expect(page.getByTestId('attendance-row')).toHaveCount(20);
}
async function capture(page: Page, name: string) {
  await fs.mkdir('outputs/day-audit',{recursive:true});
  await page.screenshot({path:`outputs/day-audit/${name}.png`});
}
for(const [teacher,course] of [['rotman555@gmail.com','course-1'],['dotanhaim@gmail.com','course-2']]) test(`complete teacher day with preserved history: ${teacher}`,async({page},info)=>{
  await prepare(page,teacher,course);
  await capture(page,`04-home-${info.project.name}-${course}`);
  await openMeeting(page,course);
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('e2e-database')!).attendance_logs.length)).toBe(1);
  const rows = page.getByTestId('attendance-row');
  const order = await rows.evaluateAll(els=>els.map(el=>el.getAttribute('data-student-id')));
  const row = rows.filter({hasText:first});
  await row.evaluate(el => el.scrollIntoView({block: 'start'}));
  const before = await row.boundingBox();
  await capture(page,`05-unmarked-${info.project.name}-${course}`);
  await page.getByLabel(`נוכחות חדשה עבור ${first}`,{exact:true}).selectOption('Absent');
  await expect(page.getByLabel(`סימון נוכחות עבור ${first}`,{exact:true})).toHaveValue('Absent');
  expect(await rows.evaluateAll(els=>els.map(el=>el.getAttribute('data-student-id')))).toEqual(order);
  const after = await row.boundingBox();
  expect(Math.abs(before!.height-after!.height)).toBeLessThan(3);
  await page.getByRole('button',{name:'סימון כל מי שטרם סומן כנוכח',exact:true}).click();
  await expect(page.getByLabel(`סימון נוכחות עבור ${first}`,{exact:true})).toHaveValue('Absent');
  await page.getByRole('button',{name:`הוספת הערה עבור ${first}`,exact:true}).click();
  await page.getByLabel('הערה לתלמיד/ה').fill('איחור באישור, תיקון לאחר בירור');
  await page.getByRole('button',{name:'שמירת הערה',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel(`סימון נוכחות עבור ${first}`,{exact:true}).selectOption('Late');
  await expect(page.getByLabel(`סימון נוכחות עבור ${first}`,{exact:true})).toBeEnabled();
  await row.evaluate(el => el.scrollIntoView({block: 'start'}));
  await capture(page,`06-recorded-${info.project.name}-${course}`);
  await page.getByRole('button',{name:/תיעוד שיעור/}).first().click();
  await page.getByPlaceholder('למשל: משוב עמיתים וסגנונות תקשורת').fill('תיעוד יום עבודה');
  await page.getByRole('button',{name:'שמירת שיעור',exact:true}).click();
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await expect(page.getByRole('heading',{name:'מפגשים בתאריך הנבחר',exact:true})).toBeVisible();
  await page.reload();
  await openMeeting(page,course);
  await expect(page.getByLabel(`סימון נוכחות עבור ${first}`,{exact:true})).toHaveValue('Late');
  await page.getByRole('button',{name:`כרטיס תלמיד עבור ${first}`,exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('מפגש 2026-10-20');
  await expect(page.getByRole('dialog')).toContainText('מפגש 2026-10-28');
  await capture(page,`07-student-history-${info.project.name}-${course}`);
  await page.getByRole('button',{name:'כל הנוכחות ותיקון דיווחים',exact:true}).click();
  await expect(page.getByLabel('סינון נוכחות לפי תלמיד')).toHaveValue('day-student-0');
  await expect(page.getByLabel(`סימון נוכחות עבור ${first}`,{exact:true})).toHaveCount(2);
  await page.getByLabel('בחירת תאריך נוכחות').fill('2026-10-28');
  await page.getByLabel(`סימון נוכחות עבור ${first}`,{exact:true}).selectOption('Excused');
  await expect(page.getByLabel(`סימון נוכחות עבור ${first}`,{exact:true})).toBeEnabled();
  await page.reload();
  const db = await page.evaluate(()=>JSON.parse(sessionStorage.getItem('e2e-database')!));
  expect(db.attendance_logs.find((l:any)=>l.id==='original-history')).toMatchObject({status:'Present',notes:'דיווח קודם לשימור'});
  expect(db.attendance_logs.filter((l:any)=>l.date==='2026-10-28')).toHaveLength(20);
  expect(db.attendance_logs.find((l:any)=>l.date==='2026-10-28'&&l.student_id==='day-student-0')).toMatchObject({status:'Excused',notes:'איחור באישור, תיקון לאחר בירור',course_id:course});
  expect(db.app_records.find((r:any)=>r.kind==='lesson').payload.topic).toBe('תיעוד יום עבודה');
});

test('keyboard, focus, narrow screen and footer do not hide row actions',async({page},info)=>{
  await prepare(page);
  await page.getByRole('button',{name:'בחירת כיתה ומפגש',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'סגירה',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByLabel('בחירת כיתה למפגש')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button',{name:'סגירה',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:'בחירת כיתה ומפגש',exact:true})).toBeFocused();
  await openMeeting(page);
  await page.setViewportSize({width:320,height:640});
  const last = page.getByTestId('attendance-row').last();
  await last.getByRole('button',{name:/כרטיס תלמיד עבור/}).scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const box = await last.boundingBox(), footer = await page.getByTestId('attendance-footer').boundingBox();
  expect(box!.y+box!.height).toBeLessThanOrEqual(footer!.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const action of await last.locator('button,select').all()) {
    const bounds=await action.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44); expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  await capture(page,`08-narrow-footer-${info.project.name}`);
  await last.getByRole('button',{name:/כרטיס תלמיד עבור/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('failed first attendance save stays unmarked and can be retried',async({page})=>{
  await prepare(page); await openMeeting(page);
  await page.evaluate(()=>sessionStorage.setItem('e2e-fail-attendance_logs','1'));
  await page.getByLabel(`נוכחות חדשה עבור ${first}`).selectOption('Late');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel(`נוכחות חדשה עבור ${first}`)).toHaveValue('');
  await page.getByLabel(`נוכחות חדשה עבור ${first}`).selectOption('Late');
  await expect(page.getByLabel(`סימון נוכחות עבור ${first}`)).toHaveValue('Late');
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await expect(page.getByText('יש תלמידים שטרם סומנה להם נוכחות. השלימו לפני סיום.',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('e2e-database')!).app_records.filter((r:any)=>r.kind==='session').length)).toBe(0);
});
