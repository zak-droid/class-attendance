import fs from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  await page.route('https://**/*', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'מתמטיקה בדיקה' })).toBeVisible();
});
test('renders the actual application with isolated courses', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'מתמטיקה בדיקה' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('today.png'), fullPage: true });
});

async function openCourseEdit(page: Page) {
  await page.getByRole('button', { name: 'עוד', exact: true }).click();
  await page.getByRole('button', { name: /ניהול קורסים/ }).click();
  await page.locator('article').filter({ hasText: 'מתמטיקה בדיקה' }).getByRole('button', { name: '•••', exact: true }).click();
  await page.getByRole('button', { name: 'עריכת כיתה', exact: true }).click();
}
test('rename a course and retain the new name after reload', async ({ page }) => {
  await openCourseEdit(page);
  await page.getByLabel('שם הכיתה', { exact: true }).fill('מתמטיקה מתקדמת');
  await page.getByRole('button', { name: 'שמירת כיתה' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'מתמטיקה מתקדמת' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'מתמטיקה מתקדמת' })).toBeVisible();
});
test('course save failure is visible and can be retried', async ({ page }) => {
  await openCourseEdit(page);
  await page.getByLabel('שם הכיתה', { exact: true }).fill('תיקון שם');
  await page.evaluate(() => sessionStorage.setItem('e2e-fail-course', '1'));
  await page.getByRole('button', { name: 'שמירת כיתה' }).click();
  await expect(page.getByRole('alert')).toContainText('השמירה נכשלה');
  await page.getByRole('button', { name: 'שמירת כיתה' }).click();
  await expect(page.getByRole('heading', { name: 'תיקון שם' })).toBeVisible();
});
test('import an actual CSV file with first and family names', async ({ page }) => {
  await page.getByRole('button', { name: 'עוד', exact: true }).click();
  await page.getByRole('button', { name: /^ייבוא תלמידים/ }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('course-1');
  await page.locator('input[type=file]').setInputFiles({ name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from('שם פרטי,שם משפחה,אימייל\nתמר,ישראלי,tamar@example.com\nתמר,כהן,tamar2@example.com') });
  await page.getByRole('button', { name: 'ייבוא 2 תלמידים לכיתה' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'היום', exact: true }).click();
  await page.locator('article').filter({ hasText: 'מתמטיקה בדיקה' }).getByRole('button', { name: 'התחלת נוכחות' }).click();
  await expect(page.getByRole('button', { name: 'תמר ישראלי', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'תמר כהן', exact: true })).toBeVisible();
});
test('unlabeled roster keeps names when later columns contain overlapping occupation text', async ({ page }) => {
  await page.getByRole('button', { name: 'עוד', exact: true }).click();
  await page.getByRole('button', { name: /^ייבוא תלמידים/ }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('course-1');
  await page.locator('input[type=file]').setInputFiles({
    name: 'roster.tsv', mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('tamar@example.com\tתמר\tישראלי\t123456789\t0500000000\tרחוב הדוגמה\tמנחת קבוצות ומטפלת\tתואר שני\tמנחת קבוצות'),
  });
  await page.getByRole('button', { name: 'ייבוא 1 תלמידים לכיתה' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.locator('article').filter({ hasText: 'מתמטיקה בדיקה' }).getByRole('button', { name: 'התחלת נוכחות' }).click();
  await expect(page.getByRole('button', { name: 'תמר ישראלי', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'מנחת קבוצות ומטפלת', exact: true })).toHaveCount(0);
});

test('daily attendance, notes, finish and historical correction keep dates separate', async ({ page }) => {
  await page.locator('article').filter({ hasText: 'מתמטיקה בדיקה' }).getByRole('button', { name: 'התחלת נוכחות' }).click();
  const status = page.getByLabel('סימון נוכחות עבור יעל כהן', { exact: true });
  await status.selectOption('Late');
  await expect(status).toHaveValue('Late');
  await page.getByRole('button', { name: 'הוספת הערה עבור יעל כהן', exact: true }).click();
  await page.getByLabel('הערה לתלמיד/ה').fill('הגיעה באיחור של עשר דקות');
  await page.getByRole('button', { name: 'שמירת הערה' }).click();
  await expect(page.getByText('📝 הגיעה באיחור של עשר דקות')).toBeVisible();
  await page.getByRole('button', { name: 'סיום נוכחות', exact: true }).click();
  await page.getByRole('button', { name: 'היסטוריה', exact: true }).click();
  await page.getByLabel('בחירת תאריך נוכחות').fill('2026-10-25');
  await expect(status).toHaveValue('Present');
  await status.selectOption('Excused');
  await expect(status).toHaveValue('Excused');
  await page.reload();
  await page.getByRole('button', { name: 'היסטוריה', exact: true }).click();
  await page.getByLabel('בחירת תאריך נוכחות').fill('2026-10-25');
  await expect(status).toHaveValue('Excused');
  await page.getByRole('button', { name: 'כל התאריכים', exact: true }).click();
  await page.getByLabel('סינון נוכחות לפי תלמיד').selectOption('student-1');
  await expect(status).toHaveCount(2);
  await expect(status.nth(0)).toHaveValue('Late');
  await expect(status.nth(1)).toHaveValue('Excused');
  await expect(page.getByLabel('סימון נוכחות עבור יעל לוי', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('student-history.png'), fullPage: true });
});

async function startMath(page: Page) {
  await page.locator('article').filter({hasText:'מתמטיקה בדיקה'}).getByRole('button',{name:'התחלת נוכחות',exact:true}).click();
  await expect(page.getByLabel('סימון נוכחות עבור יעל כהן',{exact:true})).toBeVisible();
}
async function courseMenu(page: Page, item: RegExp) {
  await page.getByRole('button',{name:'עוד',exact:true}).click();
  await page.getByRole('button',{name:/ניהול קורסים/}).click();
  await page.locator('article').filter({hasText:'מתמטיקה בדיקה'}).getByRole('button',{name:'•••',exact:true}).click();
  await page.getByRole('button',{name:item}).click();
}
test('completion is durable after reload and missing students reopen the session', async ({page}) => {
  await startMath(page);
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await page.reload();
  const card=page.locator('article').filter({hasText:'מתמטיקה בדיקה'});
  await expect(card).toContainText('הושלמה היום');
  // A new enrolment arriving from another teacher while this course is underway.
  await page.evaluate(() => { const db=JSON.parse(sessionStorage.getItem('e2e-database')!); db.students.push({id:'new-student',name:'נועה חדשה',course_id:'course-1',active:true}); sessionStorage.setItem('e2e-database',JSON.stringify(db)); });
  await page.reload();
  await expect(card).not.toContainText('הושלמה היום');
  await card.getByRole('button',{name:/עריכת נוכחות להיום|המשך נוכחות/}).click();
  await expect(page.getByLabel('נוכחות חדשה עבור נועה חדשה')).toBeVisible();
  await page.getByLabel('נוכחות חדשה עבור נועה חדשה').selectOption('Late');
  await expect(page.getByLabel('סימון נוכחות עבור נועה חדשה')).toHaveValue('Late');
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await page.reload();
  await expect(card).toContainText('הושלמה היום');
});
test('create attendance for an unrecorded past lesson and retain its topic', async ({page}) => {
  await page.getByRole('button',{name:'היסטוריה',exact:true}).click();
  await page.getByLabel('סינון נוכחות לפי קורס').selectOption('course-1');
  await page.getByLabel('בחירת תאריך נוכחות').fill('2026-10-12');
  await page.getByLabel('נוכחות חדשה עבור יעל כהן').selectOption('Absent');
  await expect(page.getByLabel('סימון נוכחות עבור יעל כהן')).toHaveValue('Absent');
  await page.getByRole('button',{name:/תיעוד שיעור/}).click();
  await page.getByPlaceholder('למשל: משוב עמיתים וסגנונות תקשורת').fill('מפגש היסטורי לבדיקה');
  await page.getByRole('button',{name:'שמירת שיעור',exact:true}).click();
  await expect(page.getByText('מפגש היסטורי לבדיקה',{exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'היסטוריה',exact:true}).click();
  await page.getByLabel('סינון נוכחות לפי קורס').selectOption('course-1');
  await page.getByLabel('בחירת תאריך נוכחות').fill('2026-10-12');
  await expect(page.getByText('מפגש היסטורי לבדיקה',{exact:true})).toBeVisible();
  await expect(page.getByLabel('סימון נוכחות עבור יעל כהן')).toHaveValue('Absent');
});
test('lesson save failure retains the draft and shared data survives a clean browser cache', async ({page}) => {
  await startMath(page);
  await page.getByRole('button',{name:/תיעוד שיעור/}).first().click();
  const input=page.getByPlaceholder('למשל: משוב עמיתים וסגנונות תקשורת');
  await input.fill('נושא משותף למורים');
  await page.evaluate(() => sessionStorage.setItem('e2e-fail-app_records','1'));
  await page.getByRole('button',{name:'שמירת שיעור',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Simulated database rejection');
  await expect(input).toHaveValue('נושא משותף למורים');
  await page.getByRole('button',{name:'שמירת שיעור',exact:true}).click();
  await expect(input).toHaveCount(0);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('article').filter({hasText:'מתמטיקה בדיקה'}).getByRole('button',{name:/עריכת נוכחות להיום|המשך נוכחות/}).click();
  await expect(page.getByText('נושא משותף למורים',{exact:true}).first()).toBeVisible();
});
test('task feedback does not complete an outstanding obligation; syllabus and tasks survive cache clearing', async ({page}) => {
  await courseMenu(page,/סילבוס הקורס/);
  await page.getByPlaceholder(/הדביקו כאן את נושאי הסילבוס/).fill('1. מבוא\n2. סיכום');
  await page.getByRole('button',{name:'שמירת סילבוס',exact:true}).click();
  await page.locator('article').filter({hasText:'מתמטיקה בדיקה'}).getByRole('button',{name:'•••',exact:true}).click();
  await page.getByRole('button',{name:/מעקב חובות וזכאות/}).click();
  await page.getByRole('button',{name:'+ הוספת מטלה',exact:true}).click();
  await page.getByPlaceholder(/שם המטלה/).fill('מטלת רפלקציה');
  await page.getByRole('button',{name:'הוספה',exact:true}).click();
  await expect(page.getByRole('button',{name:'⬜ מטלת רפלקציה'})).toHaveCount(2);
  await page.getByTitle('הוספת הערה או שינוי תאריך').first().click();
  await page.getByLabel('הערה / משוב מהמנחה').fill('טיוטה בלבד — טרם הוגשה');
  await page.getByRole('button',{name:'שמירת פרטי מטלה',exact:true}).click();
  await expect(page.getByLabel('הערה / משוב מהמנחה')).toHaveCount(0);
  const records=await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e-database')!).app_records);
  expect(records.find((r:any)=>r.kind==='submission').payload.completed).toBe(false);
  expect(records.find((r:any)=>r.kind==='syllabus').payload.syllabus).toContain('מבוא');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await courseMenu(page,/מעקב חובות וזכאות/);
  await expect(page.getByRole('button',{name:'⬜ מטלת רפלקציה'})).toHaveCount(2);
});
test('offline new session and edits synchronize when connection returns', async ({page,context}) => {
  await context.setOffline(true);
  await startMath(page);
  const status=page.getByLabel('סימון נוכחות עבור יעל כהן',{exact:true});
  await status.selectOption('Absent');
  await expect(status).toHaveValue('Absent');
  await context.setOffline(false);
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('class_attendance_pending_queue_v1')||'[]').length)).toBe(0);
  await page.reload();
  await page.locator('article').filter({hasText:'מתמטיקה בדיקה'}).getByRole('button',{name:/עריכת נוכחות להיום|המשך נוכחות/}).click();
  await expect(status).toHaveValue('Absent');
});
test('attendance note rejection keeps editor open for retry',async({page})=>{
  await startMath(page);
  await page.getByRole('button',{name:'הוספת הערה עבור יעל כהן',exact:true}).click();
  await page.getByLabel('הערה לתלמיד/ה').fill('בדיקת כשל בשמירה');
  await page.evaluate(()=>sessionStorage.setItem('e2e-fail-attendance_logs','1'));
  await page.getByRole('button',{name:'שמירת הערה',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('השמירה נכשלה');
  await expect(page.getByLabel('הערה לתלמיד/ה')).toHaveValue('בדיקת כשל בשמירה');
  await page.getByRole('button',{name:'שמירת הערה',exact:true}).click();
  await expect(page.getByLabel('הערה לתלמיד/ה')).toHaveCount(0);
  await expect(page.getByText('📝 בדיקת כשל בשמירה')).toBeVisible();
});

test('XLSX upload preserves full names across empty columns',async({page})=>{
  await page.getByRole('button',{name:'עוד',exact:true}).click();
  await page.getByRole('button',{name:/^ייבוא תלמידים/}).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('course-1');
  await page.locator('input[type=file]').setInputFiles('tests/e2e/fixtures/students.xlsx');
  await page.getByRole('button',{name:'ייבוא 1 תלמידים לכיתה'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'היום',exact:true}).click();
  await startMath(page);
  await expect(page.getByRole('button',{name:'תמר ישראלי',exact:true})).toBeVisible();
});
test('downloaded course report contains full names, dates and Hebrew statuses',async({page})=>{
  await startMath(page);
  await page.getByLabel('סימון נוכחות עבור יעל כהן').selectOption('Late');
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await page.getByRole('button',{name:'עוד',exact:true}).click();
  await page.getByRole('button',{name:/ניהול קורסים/}).click();
  await page.locator('article').filter({hasText:'מתמטיקה בדיקה'}).getByRole('button',{name:'•••',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:/ייצוא ל-Excel/}).click();
  const download=await downloadPromise;
  const csv=await fs.readFile((await download.path())!, 'utf8');
  expect(csv).toContain('יעל כהן'); expect(csv).toContain('2026-10-26'); expect(csv).toContain('מאחר');
});

test('finishing a session shows progress while the server is saving',async({page})=>{
  await startMath(page);
  await page.evaluate(()=>sessionStorage.setItem('e2e-slow-finish','1'));
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await expect(page.getByRole('button',{name:'שומר סיום מפגש...',exact:true})).toBeDisabled();
  await expect(page.locator('article').filter({hasText:'מתמטיקה בדיקה'})).toContainText('הושלמה היום');
});

test('Today navigation returns home in one click from a management subview; archive restores without losing history',async({page})=>{
  await courseMenu(page,/העברה לארכיון/);
  const card=page.locator('article').filter({hasText:'מתמטיקה בדיקה'});
  await expect(card).toContainText('בארכיון');
  await page.getByRole('button',{name:'היום',exact:true}).click();
  await expect(page.getByRole('heading',{name:'שיעורי היום',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'מתמטיקה בדיקה',exact:true})).toHaveCount(0);
  await courseMenu(page,/שחזור כיתה/);
  await expect(card).not.toContainText('בארכיון');
  await page.getByRole('button',{name:'היום',exact:true}).click();
  await expect(page.getByRole('heading',{name:'מתמטיקה בדיקה',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'היסטוריה',exact:true}).click();
  await page.getByLabel('בחירת תאריך נוכחות').fill('2026-10-25');
  await expect(page.getByLabel('סימון נוכחות עבור יעל כהן')).toHaveValue('Present');
});
