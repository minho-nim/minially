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

test('더 내 스타일로: 고쳐서 승인한 원고만 모아 문체를 다듬은 안을 보여 주고, 적용해야 저장한다', async ({ page, browser }) => {
  await login(page, CODE_C);
  // 내 문체를 먼저 분석해 둔다(다른 시험 순서와 상관없이)
  await page.evaluate(async (text) => {
    const { styles } = await (await fetch('/api/styles')).json();
    const mine = styles.find((s: { kind: string }) => s.kind === 'mine');
    await fetch(`/api/styles/${mine.id}`, { method: 'PUT', body: JSON.stringify({ samples: [text] }) });
    await fetch(`/api/styles/${mine.id}/analyze`, { method: 'POST', body: '{}' });
  }, post);
  const ready = async () => (await page.evaluate(async () => (await (await fetch('/api/styles')).json()).refine_ready)) as number;
  const before = await ready();

  // ① AI 초안을 조금 고쳐 승인 → 센다
  await page.getByRole('button', { name: '새 원고' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('');
  await page.getByLabel(/직접 겪은 내용/).fill('토요일 오후에 동네 빵집에 다녀왔어요. 소금빵이 맛있었어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue(/가짜 Gemini가 쓴 제목/);
  const aiBody = await page.getByLabel('본문').inputValue();
  await page.getByLabel('본문').fill(`${aiBody}\n소금빵은 바삭했어요. 다음엔 크루아상도 먹어 볼게요.`);
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '원고 승인' }).click();
  await expect(page.locator('.badge')).toHaveText('승인됨');
  // 화면·API에는 AI 원문(ai_body)을 내보내지 않는다
  const drafts = await page.evaluate(async () => (await (await fetch('/api/drafts')).json()).drafts);
  expect(JSON.stringify(drafts)).not.toContain('ai_body');

  // ② AI 초안을 통째로 새로 써서 승인 → 세지 않는다(문체 비교에 쓸 수 없음)
  await page.getByRole('button', { name: '새 원고' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('');
  await page.getByLabel(/직접 겪은 내용/).fill('일요일에 공원 산책을 했어요. 단풍이 예뻤어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue(/가짜 Gemini가 쓴 제목/);
  await page.getByLabel('본문').fill('완전히 다르게 다시 쓴 산책 이야기. 바람이 차가웠고 커피를 들고 걸었다.');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '원고 승인' }).click();
  await expect(page.locator('.badge')).toHaveText('승인됨');
  expect(await ready()).toBe(Math.min(before + 1, 5));

  // ③ 문체 화면: 제안 → 바뀔 내용 확인 → 그대로 두면 안 바뀜 → 다시 제안 → 적용
  await page.getByRole('button', { name: '문체', exact: true }).click();
  const summaryBefore = await page.locator('.profile-summary').innerText();
  await page.getByRole('button', { name: '더 내 스타일로' }).click();
  const box = page.getByRole('region', { name: '바뀔 내 문체' });
  await expect(box).toContainText(`고친 원고 ${Math.min(before + 1, 5)}개 반영`);
  await expect(box).toContainText('감탄 표현을 줄였어요');
  await expect(box.locator('dt', { hasText: '피하는 표현' })).toBeVisible();
  await box.getByRole('button', { name: '그대로 두기' }).click();
  await expect(page.locator('.profile-summary')).toHaveText(summaryBefore);
  await page.reload();
  await page.getByRole('button', { name: '문체', exact: true }).click();
  await expect(page.locator('.profile-summary')).toHaveText(summaryBefore);
  await page.getByRole('button', { name: '더 내 스타일로' }).click();
  await page.getByRole('region', { name: '바뀔 내 문체' }).getByRole('button', { name: '적용' }).click();
  await expect(page.locator('.profile-summary')).toContainText('더 짧고 담백하게 다듬은 문체예요');
  await expect(page.getByLabel('피하는 표현')).toContainText('정말 강력 추천');

  // ④ 다음 AI 초안에 피하는 표현이 들어가고, 다시 분석해도 피하는 표현은 남는다
  await page.getByRole('button', { name: '문체 분석하기' }).click();
  await expect(page.getByText('친근한 존댓말로 짧게 끊어 쓰는 문체예요')).toBeVisible();
  await expect(page.getByLabel('피하는 표현')).toContainText('정말 강력 추천');
  await page.getByRole('button', { name: '새 원고' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('');
  await page.getByLabel(/직접 겪은 내용/).fill('평일 저녁에 동네 국숫집에 다녀왔어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('가짜 Gemini가 쓴 제목 · 내 문체 · 피하는 표현');

  // ⑤ 다른 사람: C의 고친 원고를 쓰지 못하고, 참고 문체에는 profile을 넣을 수 없다
  const d = await browser.newPage();
  await login(d, CODE_D);
  const res = await d.evaluate(async () => { const r = await fetch('/api/styles/refine', { method: 'POST', body: '{}' }); return { status: r.status, ready: (await (await fetch('/api/styles')).json()).refine_ready }; });
  expect(res).toEqual({ status: 400, ready: 0 });
  const refStatus = await page.evaluate(async () => {
    const created = await (await fetch('/api/styles', { method: 'POST', body: JSON.stringify({ name: '프로필 막기 시험' }) })).json();
    return (await fetch(`/api/styles/${created.style.id}`, { method: 'PUT', body: JSON.stringify({ profile: { summary: 'x' } }) })).status;
  });
  expect(refStatus).toBe(400);
});
