import { test, expect } from '@playwright/test';
import { CODE_A, CODE_B } from '../playwright.sync.config';
import { device, login, put, syncNow, today } from './helpers';

test('일정 공유: 고른 카테고리만 보기 전용으로 보이고, 코드를 바꾸면 이전 코드는 막힘', async ({ browser, request }) => {
  const a = await device(browser);
  await login(a, CODE_A);
  await put(a, {
    categories: [{ id: 'cw', name: '업무', color: '#A4ADD0', sortOrder: 10, isUserManaged: true }, { id: 'cd', name: '약속', color: '#94BED9', sortOrder: 11, isUserManaged: true }],
    schedules: [
      { id: 'w1', title: '비밀회의', date: today(), category: 'cw', completed: false },
      { id: 'd1', title: '영화약속', date: today(), category: 'cd', completed: false, startTime: '19:00', endTime: '21:00', memo: '팝콘' },
    ],
    tasks: [{ id: 't1', title: '꽃 사기', dueDate: today(), status: 'todo', priority: 'medium' }],
  });
  await a.reload();
  await a.getByRole('button', { name: '설정 및 프리셋' }).click();
  await a.getByRole('button', { name: '공유', exact: true }).click();
  await a.getByRole('button', { name: '공유 코드 만들기' }).click();
  const shareCode = (await a.getByLabel('내 공유 코드').innerText()).trim();
  await a.getByPlaceholder('예: 민호').fill('민호');
  await a.getByPlaceholder('예: 민호').blur();
  await a.locator('label', { hasText: '약속' }).click();
  await a.getByText('할 일도 공유하기').click();
  await a.keyboard.press('Escape');
  await syncNow(a);

  // 서버가 거른 결과
  const shared = await (await request.get('/api/shared', { headers: { authorization: `Bearer ${shareCode}` } })).json();
  expect(shared.schedules.map((s: { title: string }) => s.title)).toEqual(['영화약속']);
  expect(shared.tasks).toHaveLength(1);
  expect(shared.name).toBe('민호');
  // 공유 코드로는 내 데이터에 접근 불가
  expect((await request.get('/api/sync', { headers: { authorization: `Bearer ${shareCode}` } })).status()).toBe(401);

  const b = await device(browser);
  await login(b, CODE_B);
  await b.getByRole('button', { name: '설정 및 프리셋' }).click();
  await b.getByRole('button', { name: '공유', exact: true }).click();
  await b.getByLabel('받은 공유 코드').fill(shareCode);
  await b.getByRole('button', { name: '추가', exact: true }).click();
  await expect(b.getByText("'민호'의 일정을 추가했어요.")).toBeVisible();
  await b.keyboard.press('Escape');

  await expect(b.getByText('영화약속').first()).toBeVisible();
  await expect(b.getByText('비밀회의')).toHaveCount(0);
  await b.getByText('영화약속').first().click();
  const detail = b.getByRole('dialog', { name: '공유 받은 일정' });
  await expect(detail).toContainText('민호의 일정');
  await expect(detail).toContainText('19:00 ~ 21:00');
  await expect(detail).toContainText('팝콘');
  await b.keyboard.press('Escape');
  await b.keyboard.press('2');
  await expect(b.getByText('민호 · 꽃 사기')).toBeVisible();

  await a.getByRole('button', { name: '설정 및 프리셋' }).click();
  await a.getByRole('button', { name: '공유', exact: true }).click();
  await a.getByRole('button', { name: '코드 새로 만들기' }).click();
  await expect(a.getByLabel('내 공유 코드')).not.toHaveText(shareCode);
  expect((await request.get('/api/shared', { headers: { authorization: `Bearer ${shareCode}` } })).status()).toBe(401);
});
