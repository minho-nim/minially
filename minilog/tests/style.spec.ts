import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

const post = '토요일에 다녀온 동네 빵집 후기예요. 진짜 오랜만에 소금빵을 먹었는데 완전 추천이에요 ㅎㅎ '.repeat(4);

test('예전 글로 문체를 분석하고, AI 초안이 그 문체를 쓴다(남은 못 봄)', async ({ page, browser }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '내 문체' }).click();
  await expect(page.getByText('아직 문체를 정리하지 않았어요')).toBeVisible();
  await page.getByLabel('글 1').fill('짧은 글');
  await expect(page.getByRole('button', { name: '문체 분석하기' })).toBeDisabled();
  await page.getByLabel('글 1').fill(post);
  await page.getByRole('button', { name: '글 하나 더' }).click();
  await page.getByLabel('글 2').fill('두 번째 글입니다.');
  await page.getByRole('button', { name: '문체 분석하기' }).click();
  await expect(page.getByText('친근한 존댓말로 짧게 끊어 쓰는 문체예요')).toBeVisible();
  await expect(page.getByLabel('자주 쓰는 표현')).toContainText('완전 추천');
  await page.reload();
  await page.getByRole('button', { name: '내 문체' }).click();
  await expect(page.getByText('친근한 존댓말로 짧게 끊어 쓰는 문체예요')).toBeVisible();
  await expect(page.getByLabel('글 2')).toHaveValue('두 번째 글입니다.');

  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel(/직접 겪은 내용/).fill('토요일 오후에 동네 빵집에 다녀왔어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('가짜 Gemini가 쓴 제목 · 내 문체');

  const d = await browser.newPage();
  await login(d, CODE_D);
  const other = await d.evaluate(async () => (await fetch('/api/style')).json());
  expect(other).toEqual({ samples: [], profile: null, analyzed_at: null, updated_at: null });
  expect(await d.evaluate(async () => (await fetch('/api/style', { method: 'PUT', body: JSON.stringify({ samples: Array(6).fill('a') }) })).status)).toBe(400);
});
