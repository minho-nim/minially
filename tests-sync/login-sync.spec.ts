import { test, expect } from '@playwright/test';
import { CODE_A } from '../playwright.sync.config';
import { device, login, put, titles, syncNow, category, schedule } from './helpers';

test('코드 로그인: 틀린 코드 거절, 로그인 후 자동 로그인, 로그아웃하면 기기 데이터 지움', async ({ browser }) => {
  const pc = await device(browser);
  const loginDialog = pc.getByRole('dialog', { name: '연결 코드 입력' });
  await expect(loginDialog).toBeVisible();
  await expect(pc.getByRole('button', { name: '일정 등록' })).toHaveCount(0);

  await loginDialog.getByLabel('연결 코드').fill('WRONG-CODE-0000-0000');
  await loginDialog.getByRole('button', { name: '로그인' }).click();
  await expect(loginDialog.getByText('코드가 맞지 않습니다.')).toBeVisible();

  await login(pc, CODE_A.toLowerCase());
  await put(pc, { categories: [category], schedules: [schedule('s1', '로그인 후 일정')] });
  await syncNow(pc);
  await pc.reload();
  await expect(pc.getByRole('button', { name: '일정 등록' })).toBeVisible();
  await expect(loginDialog).toHaveCount(0);

  await pc.getByRole('button', { name: '설정 및 프리셋' }).click();
  await pc.getByRole('button', { name: '백업/복원' }).click();
  await pc.getByRole('button', { name: '로그아웃' }).click();
  await expect(loginDialog).toBeVisible({ timeout: 10000 });
  expect(await titles(pc)).toEqual([]);

  await login(pc, CODE_A);
  await expect.poll(() => titles(pc)).toEqual(['로그인 후 일정']);
});

test('PC·폰 동기화: 추가·삭제·오프라인 수정이 다른 기기에 반영', async ({ browser }) => {
  const pc = await device(browser);
  await login(pc, CODE_A);
  await put(pc, { categories: [category], schedules: [schedule('pc', 'PC 일정')] });
  await syncNow(pc);

  const phone = await device(browser, 400);
  await login(phone, CODE_A);
  await expect.poll(() => titles(phone)).toContain('PC 일정');

  await put(phone, { schedules: [schedule('phone', '폰 일정')] });
  await syncNow(phone);
  await syncNow(pc);
  await expect.poll(() => titles(pc)).toContain('폰 일정');
  await expect(pc.getByText('폰 일정').first()).toBeVisible();

  await pc.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(r => { const q = indexedDB.open('DayFlowDB'); q.onsuccess = () => r(q.result); });
    await new Promise(r => { const tx = db.transaction('schedules', 'readwrite'); tx.objectStore('schedules').delete('pc'); tx.oncomplete = r; });
    db.close();
  });
  await syncNow(pc);
  await syncNow(phone);
  await expect.poll(() => titles(phone)).not.toContain('PC 일정');

  await phone.context().setOffline(true);
  await put(phone, { schedules: [schedule('phone', '오프라인 수정')] });
  await syncNow(phone);
  await phone.context().setOffline(false);
  await phone.evaluate(() => window.dispatchEvent(new Event('online')));
  await phone.waitForTimeout(1500);
  await syncNow(pc);
  await expect.poll(() => titles(pc)).toContain('오프라인 수정');
});
