import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

const post = '토요일에 다녀온 동네 빵집 후기예요. 진짜 오랜만에 소금빵을 먹었는데 완전 추천이에요 ㅎㅎ '.repeat(4);
const other = '이번에 방문한 카페를 정리합니다. 메뉴와 가격, 주차 정보를 순서대로 알려 드릴게요. '.repeat(5);

test('내 문체를 분석하고, AI 초안이 기본으로 내 문체를 쓴다(남은 못 봄)', async ({ page, browser }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '문체', exact: true }).click();
  await expect(page.getByText('아직 정리하지 않았어요')).toBeVisible();
  await page.getByLabel('글 1').fill('짧은 글');
  await expect(page.getByRole('button', { name: '문체 분석하기' })).toBeDisabled();
  await page.getByLabel('글 1').fill(post);
  await page.getByRole('button', { name: '글 하나 더' }).click();
  await page.getByLabel('글 2').fill('두 번째 글입니다.');
  await page.getByRole('button', { name: '문체 분석하기' }).click();
  await expect(page.getByText('친근한 존댓말로 짧게 끊어 쓰는 문체예요')).toBeVisible();
  await expect(page.getByLabel('자주 쓰는 표현')).toContainText('완전 추천');
  await page.reload();
  await page.getByRole('button', { name: '문체', exact: true }).click();
  await expect(page.getByText('친근한 존댓말로 짧게 끊어 쓰는 문체예요')).toBeVisible();
  await expect(page.getByLabel('글 2')).toHaveValue('두 번째 글입니다.');

  await page.getByRole('button', { name: '새 원고' }).click();
  await expect(page.getByLabel('어떤 문체로 쓸까요?')).toHaveValue('mine');
  await page.getByLabel(/직접 겪은 내용/).fill('토요일 오후에 동네 빵집에 다녀왔어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('가짜 Gemini가 쓴 제목 · 내 문체');

  const d = await browser.newPage();
  await login(d, CODE_D);
  const list = await d.evaluate(async () => (await (await fetch('/api/styles')).json()).styles);
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ kind: 'mine', samples: [], profile: null });
});

test('참고 블로그 문체를 추가·분석하고 원고에서 고르면 쓰는 방식만 참고한다', async ({ page, browser }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '문체', exact: true }).click();
  await page.getByRole('button', { name: '+ 참고 블로그' }).click();
  await page.getByLabel('이름', { exact: true }).fill('카페 블로거');
  await page.getByLabel('출처 메모(선택)').fill('https://blog.naver.com/cafe');
  await page.getByRole('button', { name: '추가' }).click();
  await expect(page.getByRole('tab', { name: /카페 블로거/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('남의 글을 그대로 게시하면 저작권 문제가 될 수 있어요')).toBeVisible();
  await page.getByLabel('글 1').fill(other);
  await page.getByRole('button', { name: '문체 분석하기' }).click();
  await expect(page.getByText('참고 블로거는 정보를 표로 정리하고 담백하게 써요')).toBeVisible();
  await expect(page.getByLabel('자주 쓰는 표현')).toHaveCount(0); // 참고 문체는 표현 목록을 보여 주지도, AI에 보내지도 않음

  await page.getByRole('button', { name: '새 원고' }).click();
  const id = await page.evaluate(async () => (await (await fetch('/api/styles')).json()).styles.find((s: { kind: string }) => s.kind === 'reference').id as string);
  await page.getByLabel('어떤 문체로 쓸까요?').selectOption(id);
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByLabel(/직접 겪은 내용/).fill('동네 카페에 다녀왔어요. 라떼가 맛있었어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('가짜 Gemini가 쓴 제목 · 참고 문체'); // '남의표현'이 프롬프트에 없음

  // 남은 참고 문체를 못 고치고 못 지움
  const d = await browser.newPage();
  await login(d, CODE_D);
  const statuses = await d.evaluate(async sid => [
    (await fetch(`/api/styles/${sid}`, { method: 'PUT', body: JSON.stringify({ name: '바꿈' }) })).status,
    (await fetch(`/api/styles/${sid}`, { method: 'DELETE' })).status,
    (await fetch(`/api/styles/${sid}/analyze`, { method: 'POST' })).status,
  ], id);
  expect(statuses).toEqual([404, 404, 404]);

  // 참고 문체를 지우면 그 원고는 내 문체로 돌아감
  await page.getByRole('button', { name: '문체', exact: true }).click();
  await page.getByRole('tab', { name: /카페 블로거/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '참고 문체 지우기' }).click();
  await expect(page.getByRole('tab', { name: /카페 블로거/ })).toHaveCount(0);
  const styleIds = await page.evaluate(async () => (await (await fetch('/api/drafts')).json()).drafts.map((x: { style_id: string }) => x.style_id));
  expect(styleIds).not.toContain(id);
});
