import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect, type Page } from '@playwright/test';

// Real HTTP caching + service workers, two production bundles, isolated database.
// No Playwright route interception: it would disable the cache being tested.
async function host() {
  const state = { version: 'a', failure: '', requests: [] as string[] };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    state.requests.push(url.pathname + url.search);
    let path = url.pathname.replace(/^\/class-attendance\//, '') || 'index.html';
    if (path.includes('..') || path.startsWith('/')) { res.writeHead(404).end(); return; }
    if ((state.failure === 'manifest' && path === 'version.json') || (state.failure === 'asset' && path.startsWith('assets/') && path.endsWith('.js'))) { res.writeHead(503).end(); return; }
    const version = state.failure === 'shell' && path === 'index.html' ? 'a' : state.version;
    let body: Buffer;
    try { body = await readFile(resolve(`work/update-${version}`, path)); }
    catch {
      try { body = await readFile(resolve('work/update-a', path)); }
      catch { res.writeHead(404).end(); return; }
    }
    const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'application/json';
    res.writeHead(200, { 'content-type': type, 'cache-control': path === 'version.json' || url.search ? 'no-store' : 'public, max-age=86400' });
    res.end(body);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address() as { port: number };
  return { state, url: `http://127.0.0.1:${address.port}/class-attendance/`, close: async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); } };
}
const version = (page: Page) => page.locator('meta[name="app-version"]');
async function open(page: Page, url: string) {
  await page.clock.setFixedTime(new Date('2026-10-26T10:00:00Z'));
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'שיעורי היום', exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'לא עכשיו', exact: true }).count()) await page.getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  await expect(version(page)).toHaveAttribute('content', 'update-a');
}
async function check(page: Page) { await page.evaluate(() => window.dispatchEvent(new Event('focus'))); }
async function updated(page: Page, url: string) {
  await expect(version(page)).toHaveAttribute('content', 'update-b', { timeout: 45000 });
  expect(page.url()).toBe(url);
  await expect(page.getByText('rotman555@gmail.com', { exact: true })).toBeVisible();
}

test('open tab updates automatically; ordinary URL and stored data survive', async ({ page }) => {
  const h = await host();
  try {
    await open(page, h.url);
    await page.evaluate(() => localStorage.setItem('preserve-me', 'saved user data'));
    const database = await page.evaluate(() => sessionStorage.getItem('e2e-database'));
    h.state.version = 'b'; await check(page); await updated(page, h.url);
    expect(await page.evaluate(() => localStorage.getItem('preserve-me'))).toBe('saved user data');
    expect(await page.evaluate(() => sessionStorage.getItem('e2e-database'))).toBe(database);
    const requests = h.state.requests.filter(p => p.includes('__app_shell')).length;
    await check(page); await page.waitForTimeout(2500);
    expect(h.state.requests.filter(p => p.includes('__app_shell')).length).toBe(requests);
  } finally { await h.close(); }
});

test('cached ordinary entrance gets the newest HTML through its worker', async ({ page }) => {
  const h = await host();
  try {
    await open(page, h.url);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.goto('about:blank');
    h.state.version = 'b';
    await page.goto(h.url);
    await updated(page, h.url);
    expect(h.state.requests.some(p => p.includes('__app_shell'))).toBe(true);
  } finally { await h.close(); }
});

test('idle open tab discovers publication on its timer without a focus or refresh', async ({ page }) => {
  const h = await host();
  try {
    await page.clock.install();
    await open(page, h.url);
    // Let the startup check finish before publishing the next version.
    await expect.poll(() => h.state.requests.some(p => p.includes('version.json'))).toBe(true);
    await page.waitForTimeout(500);
    h.state.version = 'b';
    await page.clock.fastForward(61000);
    await updated(page, h.url);
  } finally { await h.close(); }
});

test('lesson, unsaved note, and attendance survive an update published while working', async ({ page }) => {
  const h = await host();
  try {
    await open(page, h.url);
    await page.getByRole('button', { name: 'בחירת כיתה ומפגש', exact: true }).click();
    await page.getByLabel('בחירת כיתה למפגש').selectOption('course-1');
    await page.getByRole('button', { name: 'פתיחת מפגש 2026-10-26', exact: true }).click();
    await page.getByRole('button', { name: 'סימון כל מי שטרם סומן כנוכח', exact: true }).click();
    await page.getByLabel('סימון נוכחות עבור יעל כהן', { exact: true }).selectOption('Late');
    await page.getByRole('button', { name: 'הוספת הערה עבור יעל כהן', exact: true }).click();
    await page.getByLabel('הערה לתלמיד/ה').fill('טיוטה שנשמרת בזמן עדכון');
    h.state.version = 'b'; await check(page);
    await page.waitForTimeout(4500);
    await expect(version(page)).toHaveAttribute('content', 'update-a');
    await expect(page.getByLabel('הערה לתלמיד/ה')).toHaveValue('טיוטה שנשמרת בזמן עדכון');
    await page.getByRole('button', { name: 'שמירת הערה', exact: true }).click();
    await page.getByRole('button', { name: 'סיום נוכחות', exact: true }).click();
    await updated(page, h.url);
    const db = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e-database')!));
    expect(db.attendance_logs.find((l: any) => l.student_id === 'student-1' && l.date === '2026-10-26')).toMatchObject({ status: 'Late', notes: 'טיוטה שנשמרת בזמן עדכון' });
    expect(db.attendance_logs.find((l: any) => l.id === 'log-2')).toMatchObject({ status: 'Absent', date: '2026-10-25' });
  } finally { await h.close(); }
});

test('offline and queued attendance block reload until synchronized', async ({ page, context }) => {
  const h = await host();
  try {
    await open(page, h.url);
    await context.setOffline(true);
    await page.evaluate(() => localStorage.setItem('class_attendance_pending_queue_v1', JSON.stringify([{ id: 'queued', type: 'update_attendance', logId: 'log-1', patch: { status: 'Excused', notes: 'offline change' }, createdAt: new Date().toISOString() }])));
    h.state.version = 'b';
    await page.waitForTimeout(2500);
    await expect(version(page)).toHaveAttribute('content', 'update-a');
    await context.setOffline(false); await check(page);
    await updated(page, h.url);
    const result = await page.evaluate(() => ({ queue: JSON.parse(localStorage.getItem('class_attendance_pending_queue_v1') || '[]'), db: JSON.parse(sessionStorage.getItem('e2e-database')!) }));
    expect(result.queue).toEqual([]);
    expect(result.db.attendance_logs.find((l: any) => l.id === 'log-1')).toMatchObject({ status: 'Excused', notes: 'offline change' });
  } finally { await h.close(); }
});

for (const failure of ['manifest', 'shell', 'asset']) test(`incomplete publication (${failure}) keeps current app usable and retries`, async ({ page }) => {
  const h = await host();
  try {
    await open(page, h.url);
    h.state.version = 'b'; h.state.failure = failure; await check(page);
    await page.waitForTimeout(4500);
    await expect(version(page)).toHaveAttribute('content', 'update-a');
    await expect(page.getByRole('button', { name: 'בחירת כיתה ומפגש', exact: true })).toBeEnabled();
    h.state.failure = ''; await check(page); await updated(page, h.url);
  } finally { await h.close(); }
});

test('automatic update also works when service workers are blocked', async ({ browser }) => {
  const h = await host();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage(); await open(page, h.url);
    h.state.version = 'b'; await check(page); await updated(page, h.url);
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  } finally { await context.close(); await h.close(); }
});
