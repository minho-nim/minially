import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

test('토몽이에게 묻기: 질문 버튼·직접 묻기, 대화 기억, 열어 둔 원고 참고·원고에 넣기, 지우기, 본인 것만', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page, CODE_C);
  await page.evaluate(async () => { await fetch('/api/chat', { method: 'DELETE' }); });
  await page.getByRole('button', { name: '토몽이에게 묻기' }).click();
  const panel = page.getByRole('dialog', { name: '토몽이에게 묻기' });
  await expect(panel).toContainText('아래 질문을 누르거나 직접 물어보세요');
  await expect(panel.getByText('내 블로그 숫자·일정을 알고 대답해요')).toBeVisible();

  // 질문 버튼 → 답(자연스러운 한국어 규칙 포함)
  await panel.getByRole('button', { name: '이번 주에 뭐 쓰지?' }).click();
  await expect(panel.locator('.chat-msg.model').last()).toContainText('토몽이 답: 이번 주에 뭐 쓰지? (규칙)');
  // 직접 묻기(Enter) → 앞 대화를 기억
  await panel.getByLabel('토몽이에게 물어볼 내용').fill('카페 글은 어때?');
  await panel.getByLabel('토몽이에게 물어볼 내용').press('Enter');
  await expect(panel.locator('.chat-msg.model').last()).toContainText('토몽이 답: 카페 글은 어때? (대화 기억·규칙)');
  await panel.locator('.chat-msg.model').last().getByRole('button', { name: '복사' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('토몽이 답: 카페 글은 어때? (대화 기억·규칙)');
  await panel.getByRole('button', { name: '채팅 닫기' }).click();

  // 원고를 열면 원고를 알고 답하고, 원고 끝에 넣을 수 있다
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('채팅 시험 원고');
  await page.getByLabel('본문').fill('첫 문단이에요.');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '토몽이에게 묻기' }).click();
  await expect(panel.getByText('열어 둔 원고: 채팅 시험 원고')).toBeVisible();
  await panel.getByRole('button', { name: '제목 5개 뽑아줘' }).click();
  const answer = panel.locator('.chat-msg.model').last();
  await expect(answer).toContainText('원고 참고');
  await answer.getByRole('button', { name: '원고 끝에 넣기' }).click();
  await expect(page.getByLabel('본문')).toHaveValue(/^첫 문단이에요\.\n\n토몽이 답: 제목 5개 뽑아줘 \(원고 참고·대화 기억·규칙\)$/);
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // 새로고침해도 대화가 남고, 다른 사용자는 못 본다
  await page.reload();
  await page.getByRole('button', { name: '토몽이에게 묻기' }).click();
  await expect(panel.locator('.chat-msg')).toHaveCount(6);
  const d = await (await browser.newContext()).newPage();
  await login(d, CODE_D);
  expect(await d.evaluate(async () => (await (await fetch('/api/chat')).json()).messages.length)).toBe(0);
  // 너무 긴 질문 400, 빈 질문 400
  const bad = await page.evaluate(async () => [(await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ message: 'ㄱ'.repeat(2001) }) })).status, (await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ message: '  ' }) })).status]);
  expect(bad).toEqual([400, 400]);

  // 지우기
  page.once('dialog', dlg => dlg.accept());
  await panel.getByRole('button', { name: '지우기' }).click();
  await expect(panel.locator('.chat-msg')).toHaveCount(0);
  await panel.getByRole('button', { name: '채팅 닫기' }).click();
  page.once('dialog', dlg => dlg.accept());
  await page.getByRole('button', { name: '삭제', exact: true }).click();
});

test('채팅 API는 로그인 없이 쓸 수 없다', async ({ request }) => {
  expect((await request.get('/api/chat')).status()).toBe(401);
  expect((await request.post('/api/chat', { data: { message: 'x' } })).status()).toBe(401);
});
