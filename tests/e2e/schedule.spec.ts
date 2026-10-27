import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const expectedDates: Record<string,string[]> = JSON.parse(fs.readFileSync(new URL('../fixtures/syllabus-dates.json',import.meta.url),'utf8'));

async function openSchedule(page: Page) {
  await page.getByRole('button',{name:'עוד',exact:true}).click();
  await page.getByRole('button',{name:/ניהול קורסים/}).click();
  await page.locator('article').filter({hasText:'מתמטיקה בדיקה'}).getByRole('button',{name:'לוח מפגשים ונוכחות'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
test.beforeEach(async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  await page.route('https://**/*',r => r.abort());
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'מתמטיקה בדיקה',exact:true})).toBeVisible();
});

test('manual dates, two-day event, holiday and daily attendance remain separate after reload', async ({page}) => {
  await openSchedule(page);
  await page.getByRole('button',{name:'הזנה והדבקת תאריכים',exact:true}).click();
  await page.getByLabel('רשימת תאריכים ונושאים').fill('27/10/2026 יום בחירות\n28/10/2026 שיעור רגיל\n3-4/12/2026 מסע יומיים');
  await page.getByRole('button',{name:'הוספת הרשימה לבדיקה'}).click();
  await expect(page.getByTestId('schedule-row')).toHaveCount(5);
  await expect(page.getByLabel('מצב מפגש 2',{exact:true})).toHaveValue('cancelled');
  await page.getByRole('button',{name:'שמירת לוח המפגשים'}).click();
  await page.getByRole('button',{name:'היום',exact:true}).click();
  await page.getByLabel('בחירת תאריך מפגשים').fill('2026-10-27');
  await expect(page.locator('article')).toHaveCount(0);
  await expect(page.getByText('אין מפגשים מתוכננים לתאריך זה',{exact:true})).toBeVisible();
  await page.getByLabel('בחירת תאריך מפגשים').fill('2026-12-03');
  await page.getByRole('button',{name:'התחלת נוכחות',exact:true}).click();
  await page.getByRole('button',{name:'סימון כל מי שטרם סומן כנוכח',exact:true}).click();
  await page.getByLabel('סימון נוכחות עבור יעל כהן',{exact:true}).selectOption('Late');
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await page.getByLabel('בחירת תאריך מפגשים').fill('2026-12-04');
  await page.getByRole('button',{name:'התחלת נוכחות',exact:true}).click();
  await page.getByRole('button',{name:'סימון כל מי שטרם סומן כנוכח',exact:true}).click();
  await expect(page.getByLabel('סימון נוכחות עבור יעל כהן',{exact:true})).toHaveValue('Present');
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await page.reload();
  await page.getByLabel('בחירת תאריך מפגשים').fill('2026-12-03');
  await page.getByRole('button',{name:'עריכת נוכחות לתאריך זה',exact:true}).click();
  await expect(page.getByLabel('סימון נוכחות עבור יעל כהן',{exact:true})).toHaveValue('Late');
});

test('weekly creation, manual editing, cancellation, failed save and duplicate import', async ({page}) => {
  await openSchedule(page);
  await page.getByRole('button',{name:'סדרה שבועית',exact:true}).click();
  await page.getByLabel('החל מתאריך').fill('2026-10-27');
  await page.getByLabel('יום בשבוע').selectOption('3');
  await page.getByLabel('מספר מפגשים',{exact:true}).fill('3');
  await page.getByRole('button',{name:'יצירת סדרה לבדיקה'}).click();
  await expect(page.getByLabel('תאריך מפגש 2',{exact:true})).toHaveValue('2026-10-28');
  await page.getByLabel('תאריך מפגש 3',{exact:true}).fill('2026-11-05');
  await page.getByLabel('מצב מפגש 4',{exact:true}).selectOption('cancelled');
  await page.evaluate(() => sessionStorage.setItem('e2e-fail-app_records','1'));
  await page.getByRole('button',{name:'שמירת לוח המפגשים'}).click();
  await expect(page.getByRole('alert')).toContainText('לא נשמר הלוח');
  await expect(page.getByLabel('תאריך מפגש 3',{exact:true})).toHaveValue('2026-11-05');
  await page.getByRole('button',{name:'שמירת לוח המפגשים'}).click();
  await page.reload();
  await openSchedule(page);
  await expect(page.getByTestId('schedule-row')).toHaveCount(4);
  await page.getByRole('button',{name:'הזנה והדבקת תאריכים',exact:true}).click();
  await page.getByLabel('רשימת תאריכים ונושאים').fill('28/10/2026 כפילות');
  await page.getByRole('button',{name:'הוספת הרשימה לבדיקה'}).click();
  await expect(page.getByTestId('schedule-row')).toHaveCount(4);
  await page.getByRole('button',{name:'הוספת מפגש ידני'}).click();
  await expect(page.getByRole('button',{name:'שמירת לוח המפגשים'})).toBeDisabled();
  await page.getByLabel('תאריך מפגש 1',{exact:true}).fill('2026-11-20');
  await page.getByRole('button',{name:'שמירת לוח המפגשים'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('moving an attended meeting keeps original attendance and flags the old date', async ({page}) => {
  await page.locator('article').filter({hasText:'מתמטיקה בדיקה'}).getByRole('button',{name:'התחלת נוכחות'}).click();
  await page.getByRole('button',{name:'סימון כל מי שטרם סומן כנוכח',exact:true}).click();
  await page.getByRole('button',{name:'סיום נוכחות',exact:true}).click();
  await openSchedule(page);
  await page.getByLabel('תאריך מפגש 1',{exact:true}).fill('2026-10-29');
  await expect(page.getByText(/קיים דיווח במועד הקודם 2026-10-26/)).toBeVisible();
  await page.getByRole('button',{name:'שמירת לוח המפגשים'}).click();
  await page.getByRole('button',{name:'היום',exact:true}).click();
  await expect(page.getByRole('button',{name:'בדיקת הדיווח — מתמטיקה בדיקה'})).toBeVisible();
  await page.getByRole('button',{name:'בדיקת הדיווח — מתמטיקה בדיקה'}).click();
  await expect(page.getByLabel('סימון נוכחות עבור יעל כהן',{exact:true})).toHaveValue('Present');
  await expect(page.getByRole('heading',{name:/מתמטיקה בדיקה · יום שני, 26 באוקטובר 2026/})).toBeVisible();
});

test('course creation opens schedule setup and an unscheduled course never appears as a lesson', async ({page}) => {
  await page.getByRole('button',{name:'+ כיתה חדשה',exact:true}).click();
  await page.getByLabel('שם הכיתה',{exact:true}).fill('קורס חדש ללא תאריכים');
  await page.getByRole('button',{name:'שמירת כיתה',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('לוח מפגשים — קורס חדש ללא תאריכים');
  await page.getByRole('dialog').getByRole('button',{name:'סגירה',exact:true}).click();
  await expect(page.getByText('קורס חדש ללא תאריכים — נדרש להגדיר מועדי מפגשים')).toBeVisible();
  await expect(page.locator('article').filter({hasText:'קורס חדש ללא תאריכים'})).toHaveCount(0);
});

test('concurrent edits cannot overwrite another teacher and the draft stays visible', async ({page}) => {
  await openSchedule(page);
  await page.getByLabel('נושא מפגש 1',{exact:true}).fill('טיוטה מקומית');
  await page.evaluate(() => sessionStorage.setItem('e2e-concurrent-schedule','1'));
  await page.getByRole('button',{name:'שמירת לוח המפגשים'}).click();
  await expect(page.getByRole('alert')).toContainText('ייתכן שמורה אחר עדכן');
  await expect(page.getByLabel('נושא מפגש 1',{exact:true})).toHaveValue('טיוטה מקומית');
  const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('e2e-database')!).app_records.find((r:any)=>r.kind==='schedule'&&r.id==='course-1').payload);
  expect(stored.revision).toBe('other-teacher'); expect(stored.meetings[0].topic).toBe('מפגש בדיקה');
});

// The user's original files stay private. Local acceptance checks exercise the
// exact browser PDF parser on all four originals; CI uses the portable PDF below.
test('PDF upload works without external AI and splits two-day ranges', async ({page}) => {
  const stream='BT /F1 12 Tf 60 750 Td (28/10/2026 First lesson) Tj 0 -25 Td (3-4/12/2026 Trip) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n'; const offsets=[0];
  objects.forEach((obj,i) => { offsets.push(Buffer.byteLength(pdf)); pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`; });
  const start=Buffer.byteLength(pdf); pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  await openSchedule(page);
  await page.getByLabel('קובץ סילבוס PDF',{exact:true}).setInputFiles({name:'schedule.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});
  await expect(page.getByTestId('schedule-row')).toHaveCount(4);
  await expect(page.getByLabel('תאריך מפגש 4',{exact:true})).toHaveValue('2026-12-04');
  await page.getByRole('button',{name:'שמירת לוח המפגשים'}).click();
  await page.reload(); await openSchedule(page);
  await expect(page.getByTestId('schedule-row')).toHaveCount(4);
});

const directory = process.env.SYLLABUS_TEST_DIR ?? 'C:/Users/Lisa Bennett/Documents/Class Attendance/סילבוסים';
const originals = fs.existsSync(directory) ? fs.readdirSync(directory).filter(f => f.endsWith('.pdf')) : [];
for (const name of originals) test(`original syllabus: ${name}`, async ({page}) => {
  await openSchedule(page);
  await page.getByLabel('קובץ סילבוס PDF',{exact:true}).setInputFiles(path.join(directory,name));
  const half = name.includes('חצי');
  const natal = name.includes("נט''ל");
  const expected = half ? 16 : natal ? 15 : 28;
  await expect(page.getByTestId('schedule-row')).toHaveCount(expected+1,{timeout:20000});
  const dates=await page.getByTestId('schedule-row').locator('input[type=date]').evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value));
  const key = half ? 'half' : natal ? 'natal' : name.includes("ב'") ? 'annualB' : 'annualA';
  expect(dates.filter(d => d !== '2026-10-26' && !(half && d === '2026-10-27'))).toEqual(expectedDates[key]);
  if(half) {
    await expect(page.getByLabel('מצב מפגש 3',{exact:true})).toHaveValue('cancelled');
    expect(dates).toContain('2026-12-22'); expect(dates).toContain('2026-12-23');
  } else if(natal) { expect(dates).toContain('2026-12-03'); expect(dates).toContain('2026-12-04'); }
  else if(name.includes("ב'")) { expect(dates).toContain('2027-04-13'); expect(dates).toContain('2027-01-12'); }
  else { expect(dates).toContain('2027-04-14'); expect(dates).toContain('2027-01-05'); }
  await page.getByRole('button',{name:'שמירת לוח המפגשים'}).click();
  await page.reload(); await openSchedule(page);
  await expect(page.getByTestId('schedule-row')).toHaveCount(expected+1);
});
