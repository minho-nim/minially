import { expect, type Browser, type Page } from '@playwright/test';

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function device(browser: Browser, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on('dialog', d => d.accept());
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/');
  return page;
}

export async function login(page: Page, code: string) {
  const dialog = page.getByRole('dialog', { name: '연결 코드 입력' });
  await dialog.getByLabel('연결 코드').fill(code);
  await dialog.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('button', { name: '일정 등록' })).toBeVisible({ timeout: 15000 });
}

/** IndexedDB에 직접 넣기(화면 조작 없이 데이터 준비) */
export async function put(page: Page, stores: Record<string, unknown[]>) {
  await page.evaluate(async stores => {
    const db = await new Promise<IDBDatabase>(r => { const q = indexedDB.open('DayFlowDB'); q.onsuccess = () => r(q.result); });
    await new Promise(r => { const tx = db.transaction(Object.keys(stores), 'readwrite'); for (const [s, items] of Object.entries(stores)) for (const it of items) tx.objectStore(s).put(it); tx.oncomplete = r; });
    db.close();
  }, stores);
}

export async function titles(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(r => { const q = indexedDB.open('DayFlowDB'); q.onsuccess = () => r(q.result); });
    const all = await new Promise<{ title: string }[]>(r => { const q = db.transaction('schedules').objectStore('schedules').getAll(); q.onsuccess = () => r(q.result); });
    db.close();
    return all.map(s => s.title).sort();
  });
}

/** 화면으로 돌아온 것처럼 해서 바로 동기화 */
export async function syncNow(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1500);
}

export const category = { id: 'rose', name: '로즈', color: '#CF8FA8', sortOrder: 0, isUserManaged: true };
export const schedule = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, title, date: today(), category: 'rose', completed: false, sortOrder: 0, ...extra });
