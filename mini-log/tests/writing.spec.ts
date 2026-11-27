import { expect, test, type Page } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, pngBytes } from './helpers';
import { findIssues } from '../src/bodyIssues';
import { cleanOutline, editHabits, mergeGuideTags, readRewrite, readTitles, titleChecks } from '../functions/_writing';

const files = [
  { name: '빵.png', mimeType: 'image/png', buffer: pngBytes(40, 40, [230, 120, 90]) },
  { name: '커피.png', mimeType: 'image/png', buffer: pngBytes(40, 40, [90, 60, 40]) },
];
const call = (page: Page, path: string, method = 'POST', body?: unknown) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p as string, { method: m as string, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
  return { status: r.status, data: await r.json().catch(() => null) };
}, [path, method, body] as const);

test('글쓰기 규칙: 개요 검사·다시 쓴 글 표시 지키기·제목 점검·가이드 해시태그·고친 버릇·맞춤법', () => {
  // 개요: 빈 소제목은 빼고, 없는 사진 번호(5)는 지운다
  expect(cleanOutline([{ heading: '도입', points: '친구와 <경험>감', photos: [1, 5, 1] }, { heading: ' ', points: 'x' }], 2)).toEqual([{ heading: '도입', points: '친구와 감', photos: [1] }]);
  expect(cleanOutline([], 2)).toBeNull();
  // 다시 쓴 글: [사진 n]·[작성자 확인 필요]를 빼먹으면 받지 않는다
  expect(readRewrite({ text: '짧게 고침 [사진 1]' }, '원래 문장 [사진 1]')).toBe('짧게 고침 [사진 1]');
  expect(readRewrite({ text: '표시 뺌' }, '원래 문장 [사진 1]')).toBeNull();
  expect(readRewrite({ text: '' }, '원래')).toBeNull();
  // 제목: 같은 제목은 하나만, 규칙 점검(길이·핵심어 위치·과장)
  const titles = readTitles({ titles: [{ title: '성수 소금빵 맛집 솔직 후기', reason: '앞' }, { title: '성수 소금빵 맛집 솔직 후기' }, { title: '역대급 충격 빵집' }] }, '성수 소금빵');
  expect(titles.map(t => t.title)).toEqual(['성수 소금빵 맛집 솔직 후기', '역대급 충격 빵집']);
  expect(titles[0].checks).toContain('핵심어가 앞쪽');
  expect(titleChecks('역대급 충격 빵집', '성수')).toEqual(['9자(조금 짧음)', "핵심어 '성수' 없음", '과장 표현 있음']);
  // 협찬 가이드 필수 해시태그는 빠뜨리지 않고 앞에
  expect(mergeGuideTags(['카페'], { keywords: [], hashtags: ['#성수카페', '체험단'], min_photos: null, min_chars: null, links: [], visit_on: null, notes: '' })).toEqual(['성수카페', '체험단', '카페']);
  // 고친 버릇: 두 원고 이상에서 지운 표현, 세 번 넘게 쓴 끝맺음
  const ai = '정말 맛있는 빵이었습니다. 강력하게 추천드립니다. 분위기가 좋았습니다.';
  const habits = editHabits([
    { ai, mine: '빵이 맛있었어요. 분위기 좋았어요. 또 갈래요. 커피도 좋았어요.' },
    { ai, mine: '소금빵 괜찮았어요. 자리 넓었어요. 주차 됐어요.' },
  ]);
  expect(habits.removed).toContain('강력하게 추천드립니다');
  expect(habits.endings).toEqual(['았어요']); // 좋았어요·좋았어요·괜찮았어요(3번), AI는 0번
  expect(editHabits([{ ai, mine: ai }]).removed).toEqual([]);
  // 맞춤법 밑줄
  const body = '내일 또 갈께요. 몇일 뒤에 되요. 예기치 못한 일.';
  const spell = findIssues(body).filter(i => i.kind === 'spell');
  expect(spell.map(i => body.slice(i.start, i.end))).toEqual(['갈께요', '몇일', '되요']);
  expect(spell[0].reason).toContain("'갈게요'");
});

test('개요 먼저 → 고친 개요대로 본문, 고른 부분만 다시 쓰기(전/후 보고 적용), 제목 후보, 사진 설명 후보, 판 기록 되돌리기', async ({ page }) => {
  await login(page, CODE_C);
  // 다른 시험(같은 사용자 C)이 함께 돌므로 이 시험이 만든 원고만 지운다
  const before: string[] = await page.evaluate(async () => (await (await fetch('/api/drafts')).json()).drafts.map((d: { id: string }) => d.id));
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.locator('input[type=file]').setInputFiles(files);
  await expect(page.getByRole('img', { name: /^사진 2:/ })).toBeVisible();

  // 사진 설명 후보: 저장되지 않고, '넣기'를 눌러야 메모가 된다
  await page.getByRole('button', { name: 'AI로 사진 설명 후보' }).click();
  await expect(page.getByText('후보: 시험 사진 1: 빵과 커피')).toBeVisible();
  await expect(page.getByLabel('사진 1 메모')).toHaveValue('');
  const saved = page.waitForResponse(r => r.url().includes('/api/photos/') && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: '사진 1 후보 넣기' }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByLabel('사진 1 메모')).toHaveValue('시험 사진 1: 빵과 커피');
  await expect(page.getByText('후보: 시험 사진 2: 빵과 커피')).toBeVisible();

  // 개요 먼저: 없는 사진 번호·빈 소제목은 빠지고, 고친 소제목이 본문 순서가 된다
  await page.getByLabel(/직접 겪은 내용/).fill('토요일에 성수 빵집에 다녀왔어요. 소금빵이 맛있었어요.');
  await page.getByRole('button', { name: '개요 먼저 보기' }).click();
  const plan = page.getByRole('region', { name: '개요' });
  await expect(plan.getByLabel('1번 소제목', { exact: true })).toHaveValue('방문 계기');
  await expect(plan.getByLabel('4번 소제목', { exact: true })).toHaveCount(0); // 빈 소제목은 서버가 뺌
  await expect(plan.getByRole('group', { name: '2번에 넣을 사진' }).getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
  await plan.getByLabel('1번 소제목', { exact: true }).fill('주말 아침 빵집 산책');
  await plan.getByRole('button', { name: '3번 소제목 위로' }).click();
  await expect(plan.getByLabel('2번 소제목', { exact: true })).toHaveValue('총평');
  await plan.getByRole('button', { name: '이 개요로 본문 쓰기' }).click();
  const body = page.getByLabel('본문');
  await expect(body).toHaveValue(/개요 반영: 주말 아침 빵집 산책/);
  await expect(page.getByText('고친 개요대로')).toBeVisible();

  // 고른 부분만 다시 쓰기: 고르면 버튼이 나오고, 전/후를 보고 '적용'해야 바뀐다
  await expect(page.getByText('본문에서 문장이나 문단을 고르면')).toBeVisible();
  await body.click();
  await body.press('Control+Home');
  await body.press('Shift+End'); // 첫 줄 고르기
  await page.getByRole('group', { name: '고른 부분 다시 쓰기' }).getByRole('button', { name: '더 짧게' }).click();
  const compare = page.getByRole('region', { name: '다시 쓴 글 비교' });
  await expect(compare).toContainText('바꾸기 전');
  await expect(compare).toContainText('(짧게) 첫 문단입니다.');
  await expect(body).not.toHaveValue(/\(짧게\)/);
  await compare.getByRole('button', { name: '적용' }).click();
  await expect(body).toHaveValue(/^\(짧게\) 첫 문단입니다\.\n\[사진 1\]/);

  // 제목 후보: 같은 제목은 하나만, 규칙 점검이 붙고, '이걸로'를 누르면 제목이 바뀐다
  await page.getByRole('button', { name: '제목 후보 3개' }).click();
  const list = page.getByLabel('추천 후보 목록');
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list).toContainText('과장 표현 있음');
  await list.getByRole('listitem').first().getByRole('button', { name: '이걸로' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('성수 소금빵 맛집 솔직 후기');

  // 판 기록: AI 초안 넣기 전은 비어 있어 남지 않고, AI 초안·고친 글이 남는다 → AI 초안으로 되돌리면 다시 쓴 부분이 빠진다
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByText('판 기록').click();
  const versions = page.locator('.version-list');
  await expect(versions.getByText('AI 초안', { exact: true })).toBeVisible();
  await expect(versions.getByText('고친 글')).toBeVisible();
  page.once('dialog', d => { void d.accept(); });
  await versions.locator('li').filter({ hasText: 'AI 초안' }).getByRole('button', { name: '이 판으로' }).click();
  await expect(body).toHaveValue(/^첫 문단입니다\./);
  await expect(page.getByLabel('제목')).toHaveValue(/가짜 Gemini가 쓴 제목/);
  // 되돌리기 알림으로 바로 앞 글이 돌아온다
  await page.getByRole('button', { name: '되돌리기', exact: true }).click();
  await expect(body).toHaveValue(/^\(짧게\)/);

  await page.evaluate(async old => { for (const d of (await (await fetch('/api/drafts')).json()).drafts) if (!old.includes(d.id)) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' }); }, before);
});

test('글쓰기 API: 로그인·본인 원고만, 표시를 빼먹은 답 거절, 연결된 협찬 가이드를 초안에, 승인 때 최종 판', async ({ page, browser }) => {
  await login(page, CODE_C);
  const { data } = await call(page, '/api/drafts', 'POST', {});
  const id = data.draft.id as string;
  await call(page, `/api/drafts/${id}`, 'PUT', { experience: '토요일에 성수 빵집에 다녀왔어요. 소금빵이 맛있었어요.', body: '첫 줄 [사진 1] DROP-MARK 이에요' });

  // 표시를 빼먹은 다시 쓰기 답은 받지 않는다 · 모드·길이 검사
  expect((await call(page, `/api/drafts/${id}/rewrite`, 'POST', { part: '첫 줄 [사진 1] DROP-MARK', mode: 'short' })).status).toBe(502);
  expect((await call(page, `/api/drafts/${id}/rewrite`, 'POST', { part: '첫 줄', mode: 'delete' })).status).toBe(400);
  expect((await call(page, `/api/drafts/${id}/rewrite`, 'POST', { part: '가'.repeat(2001), mode: 'short' })).status).toBe(400);
  expect((await call(page, `/api/drafts/${id}/titles`, 'POST', { body: '짧음' })).status).toBe(400);
  expect((await call(page, `/api/drafts/${id}/photo-notes`, 'POST', {})).status).toBe(400); // 사진 없음
  expect((await call(page, `/api/drafts/${id}/generate`, 'POST', { outline: [{ heading: '' }] })).status).toBe(400);

  // 연결된 협찬 가이드: 개요·초안에 자료로 들어가고, 필수 해시태그가 붙는다
  await call(page, '/api/campaigns', 'POST', { kind: 'sponsor', brand: '가이드빵집', title: '체험단', status: 'in_progress', draft_id: id, guide: { keywords: ['성수 빵집'], hashtags: ['#성수빵집', '체험단'], min_chars: 1500 } });
  const outline = await call(page, `/api/drafts/${id}/outline`, 'POST', {});
  expect(outline.data.sections[0].heading).toBe('방문 계기 · 가이드');
  const made = await call(page, `/api/drafts/${id}/generate`, 'POST', {});
  expect(made.status).toBe(200);
  expect(made.data.draft.body).toContain('(가이드 반영)');
  expect(made.data.draft.hashtags.slice(0, 2)).toEqual(['성수빵집', '체험단']);
  expect(made.data.guide).toBe('가이드빵집');

  // 승인하면 최종 판이 남고, 판 기록은 본인만 본다
  await call(page, `/api/drafts/${id}`, 'PUT', { status: 'approved' });
  const v = await call(page, `/api/drafts/${id}/versions`, 'GET');
  expect(v.data.versions.map((x: { kind: string }) => x.kind)).toEqual(['final', 'ai', 'edit']);

  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const otherPage = await other.newPage();
  await login(otherPage, CODE_D);
  for (const path of ['outline', 'rewrite', 'titles', 'photo-notes']) expect((await call(otherPage, `/api/drafts/${id}/${path}`, 'POST', { part: '첫 줄', mode: 'short' })).status).toBe(404);
  expect((await call(otherPage, `/api/drafts/${id}/versions`, 'GET')).status).toBe(404);
  await other.close();
  const anon = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const anonPage = await anon.newPage();
  await anonPage.goto('/');
  expect((await call(anonPage, `/api/drafts/${id}/versions`, 'GET')).status).toBe(401);
  await anon.close();

  await page.evaluate(async draftId => {
    for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) if (c.draft_id === draftId) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
    await fetch(`/api/drafts/${draftId}`, { method: 'DELETE' });
  }, id);
});
