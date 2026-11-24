import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';

test('두 기기에서 같은 원고를 고치면 나중 기기는 덮어쓰지 않고 사본 원고로 남긴다', async ({ browser }) => {
  const pc = await (await browser.newContext()).newPage();
  const phone = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await login(pc, CODE_C); await login(phone, CODE_C);
  const id = await pc.evaluate(async () => (await (await fetch('/api/drafts', { method: 'POST', body: JSON.stringify({ title: '동시 수정 원고' }) })).json()).draft.id);
  for (const p of [pc, phone]) { await p.goto(`/#draft/${id}`); await p.reload(); await expect(p.getByLabel('제목')).toHaveValue('동시 수정 원고'); }

  // PC가 먼저 고쳐 저장
  await pc.getByLabel('본문').fill('PC에서 쓴 본문');
  await expect(pc.getByText('저장됨')).toBeVisible();
  // 같은 기기에서 이어서 고치는 건 충돌이 아니다
  await pc.getByLabel('본문').fill('PC에서 쓴 본문 이어서');
  await expect(pc.getByText('저장됨')).toBeVisible();

  // 휴대폰은 예전 원고를 보고 있다가 고침 → 사본으로
  await phone.getByLabel('본문').fill('휴대폰에서 쓴 본문');
  await expect(phone.getByRole('alert')).toContainText('다른 기기에서 먼저 고친 원고예요');
  await expect(phone.getByLabel('본문')).toHaveValue('PC에서 쓴 본문 이어서'); // 최신 내용으로
  await expect(phone.getByRole('button', { name: /동시 수정 원고 · 다른 기기 수정 사본/ })).toBeVisible();

  const drafts = await pc.evaluate(async () => (await (await fetch('/api/drafts')).json()).drafts as { id: string; title: string; body: string }[]);
  expect(drafts.find(d => d.id === id)!.body).toBe('PC에서 쓴 본문 이어서');
  const copy = drafts.find(d => d.title === '동시 수정 원고 · 다른 기기 수정 사본')!;
  expect(copy.body).toBe('휴대폰에서 쓴 본문');

  // 휴대폰에서 이어서 고치면 이제 정상 저장
  await phone.getByLabel('본문').fill('휴대폰에서 다시 고침');
  await expect(phone.getByText('저장됨')).toBeVisible();
  expect((await phone.evaluate(async i => (await (await fetch(`/api/drafts/${i}`)).json()).draft.body, id))).toBe('휴대폰에서 다시 고침');
  await pc.evaluate(async ([a, b]) => { await fetch(`/api/drafts/${a}`, { method: 'DELETE' }); await fetch(`/api/drafts/${b}`, { method: 'DELETE' }); }, [id, copy.id]);
});
