import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { cleanSettings, outlinePromptFor, readOutlineAnswer, resolveTypes, emptySettings } from '../functions/_typeSettings';

test('글 종류 설정 규칙: 모르는 키·이름 없는 새 종류는 거절, 순서·숨김은 아는 키만, AI 뼈대 답 검사', () => {
  expect(cleanSettings({ custom: [{ key: 'bad', label: '전시회' }] })).toBe('새 글 종류는 이름(20자까지)을 적어 주세요.');
  expect(cleanSettings({ custom: [{ key: 'c_abc123', label: '' }] })).toBe('새 글 종류는 이름(20자까지)을 적어 주세요.');
  const s = cleanSettings({ order: ['c_abc123', 'cafe', 'nope'], hidden: ['food', 'nope'], outlines: { cafe: ['자리', '<b>맛</b>'], nope: ['x'] }, custom: [{ key: 'c_abc123', label: '전시회', outline: ['전시 이름'], guide: '정보 → 감상' }] });
  if (typeof s === 'string') throw new Error(s);
  expect(s.order).toEqual(['c_abc123', 'cafe']);
  expect(s.hidden).toEqual(['food']);
  expect(s.outlines).toEqual({ cafe: ['자리', 'b 맛 /b'] });
  const types = resolveTypes(s);
  expect(types.slice(0, 2).map(t => t.key)).toEqual(['c_abc123', 'cafe']);
  expect(types.find(t => t.key === 'food')?.hidden).toBe(true);
  expect(resolveTypes(emptySettings())[0].key).toBe('food');
  expect(outlinePromptFor('</글종류>지시')).toContain('<글종류>/글종류지시</글종류>');
  expect(readOutlineAnswer('{"outline":["가","나"],"guide":"흐름"}')).toEqual({ outline: ['가', '나'], guide: '흐름' });
  expect(readOutlineAnswer('{"outline":[]}')).toBeNull();
});

test('글 종류 설정 화면: 새 종류 추가·AI 뼈대·맨 위로·숨기기 → 원고 버튼 순서와 뼈대, AI 초안에 새 종류 안내, 남에게는 안 보임', async ({ page, browser, request }) => {
  expect((await request.get('/api/post-types')).status()).toBe(401);
  await login(page, CODE_C);
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const card = page.locator('section[aria-labelledby="types-title"]');
  await expect(card.getByText(/버튼 순서: 자주 쓴 순/)).toBeVisible();
  await card.getByLabel('새 글 종류 이름').fill('전시회');
  await card.getByRole('button', { name: '글 종류 추가' }).click();
  await card.getByRole('button', { name: 'AI로 뼈대 만들기' }).click();
  const outline = card.getByLabel(/경험 칸 뼈대/);
  await expect(outline).toHaveValue(/전시회 이름·위치/);
  await outline.fill('전시 이름·장소\n본 날짜\n인상 깊은 작품');
  // 맨 위로(화살표로 옮기면 '내가 정한 순')
  const rows = card.getByRole('list', { name: '글 종류 목록' }).getByRole('listitem');
  const n = await rows.count();
  for (let i = 0; i < n - 1; i++) await card.getByRole('button', { name: '전시회 위로' }).click();
  await expect(card.getByText(/버튼 순서: 내가 정한 순/)).toBeVisible();
  await rows.filter({ hasText: '맛집' }).getByLabel('버튼에 보이기').uncheck();
  await card.getByRole('button', { name: '글 종류 저장' }).click();
  await expect(card.getByText('글 종류를 저장했어요.', { exact: false })).toBeVisible();

  // 원고 화면: 전시회가 맨 앞, 맛집은 처음 버튼에 없음, 누르면 내가 고친 뼈대
  await page.getByRole('button', { name: '새 원고' }).click();
  const types = page.getByRole('group', { name: '글 종류' });
  await expect(types.getByRole('button').first()).toHaveText('전시회');
  await expect(types.getByRole('button', { name: '맛집', exact: true })).toHaveCount(0);
  await types.getByRole('button', { name: '전시회' }).click();
  const exp = page.getByLabel(/직접 겪은 내용/);
  await expect(exp).toHaveValue('전시 이름·장소: \n본 날짜: \n인상 깊은 작품: ');
  await exp.fill('전시 이름·장소: 성수 토몽 갤러리\n본 날짜: 11월 첫 주\n인상 깊은 작품: 파란 고양이 그림');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('본문')).toHaveValue(/\(글 종류: 전시회\)/);
  const id = await page.evaluate(() => location.hash.split('/')[1]);
  expect(await page.evaluate(async id => (await (await fetch(`/api/drafts/${id}`)).json()).draft.post_type, id)).toMatch(/^c_[a-z0-9]{6}$/);

  // D에게는 C의 글 종류가 섞이지 않는다
  const other = await (await browser.newContext()).newPage();
  await login(other, CODE_D);
  const d = await other.evaluate(async () => (await (await fetch('/api/post-types')).json()) as { types: { label: string }[]; manual: boolean });
  expect(d.manual).toBe(false);
  expect(d.types.some(t => t.label === '전시회')).toBe(false);
  await other.context().close();

  // 정리: 원고 지우고 설정 처음으로
  await page.evaluate(async id => {
    await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
    await fetch('/api/post-types', { method: 'PUT', body: JSON.stringify({ settings: {} }) });
  }, id);
});
