import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { naverCalendars, naverEvents, naverCalAccount } from '../../shared/server/naverCaldav';

const BASE = 'http://127.0.0.1:8898/caldav';
const kst = (d: number) => new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10);

test('네이버 CalDAV 읽기: 캘린더 목록·기간 일정, 비밀번호가 틀리면 쉬운 안내, 계정 형식 검사', async () => {
  const env = { NAVER_CALDAV_TEST_BASE: BASE } as never;
  const acc = { id: 'c-test', password: 'app-pass' };
  const cals = await naverCalendars(env, acc);
  expect(cals.map(c => c.name)).toEqual(['내 캘린더', '가족 & 친척']);
  const events = await naverEvents(env, acc, cals, kst(0), kst(10));
  expect(events.map(e => `${e.day} ${e.start ?? '종일'} ${e.title} (${e.calendar})`)).toEqual([
    `${kst(0)} 14:00 네이버 체험단 방문 (내 캘린더)`, `${kst(4)} 10:00 네이버 촬영 & 미팅 (내 캘린더)`, `${kst(5)} 종일 네이버 가족 생일 (가족 & 친척)`,
  ]);
  await expect(naverCalendars(env, { id: 'c-test', password: 'wrong' })).rejects.toThrow(/애플리케이션 비밀번호/);
  // 계정 비밀값 형식: "아이디(@naver.com):비밀번호"만
  expect(naverCalAccount({ NAVER_MAIL_C: 'c-test@naver.com:app-pass' } as never, 'C')).toEqual(acc);
  expect(naverCalAccount({ NAVER_CAL_C: 'c-test:cal-pass', NAVER_MAIL_C: 'x@naver.com:y' } as never, 'C')).toEqual({ id: 'c-test', password: 'cal-pass' });
  for (const bad of ['no-colon', ':pw', 'a b:pw']) expect(naverCalAccount({ NAVER_MAIL_C: bad } as never, 'C')).toBeNull();
  // 시험 주소 말고 다른 곳은 받지 않는다(진짜 네이버 서버 주소로 돌아감)
  expect(naverCalAccount({} as never, 'D')).toBeNull();
});

test('네이버 일정 겹쳐 보기: 켜고, 초록 칩, 보이기 토글, 가족 캘린더 숨기기, 아침 브리핑 오늘 일정, 남은 못 켬', async ({ page, browser, request }) => {
  expect((await request.get('/api/calendar/naver')).status()).toBe(401);
  await login(page, CODE_C);
  const call = (method: string, body?: unknown) => page.evaluate(async ([m, b]) => {
    const r = await fetch('/api/calendar/naver', { method: m as string, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
    return { status: r.status, data: await r.json().catch(() => null) };
  }, [method, body] as const);
  await call('DELETE');
  const off = (await call('GET')).data;
  expect(off).toMatchObject({ available: true, connected: false, account: 'c-***@naver.com', events: [] });
  expect(JSON.stringify(off)).not.toContain('app-pass');
  for (const bad of [{ enabled: 'yes' }, { hidden: 'x' }, { hidden: ['no-slash'] }, { hidden: Array.from({ length: 21 }, (_, i) => `/${i}`) }]) expect((await call('PUT', bad)).status).toBe(400);

  // 화면에서 켜기
  await page.goto('/#calendar');
  const card = page.getByRole('region', { name: /네이버 일정 겹쳐 보기/ });
  await card.getByRole('button', { name: '네이버 일정 켜기' }).click();
  await expect(card).toContainText('켜짐');
  await expect(page.getByLabel('표시')).toContainText('네이버 일정');
  await expect(page.locator('.cal-chip.k-naver', { hasText: '네이버 체험단 방문' })).toBeVisible();
  await expect(page.getByRole('region', { name: /오늘/ }).filter({ hasText: '이 날 게시할 원고 만들기' })).toContainText('네이버 캘린더(내 캘린더) · 14:00~15:00 · 성수동 구름카페');

  // 보이기 토글: 네이버 일정 숨기기 → 다시 보이기(이 기기에 기억)
  const toggle = page.getByRole('button', { name: '네이버 일정' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.cal-chip.k-naver')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: '네이버 일정' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '네이버 일정' }).click();
  await expect(page.locator('.cal-chip.k-naver', { hasText: '네이버 체험단 방문' })).toBeVisible();

  // 가족 캘린더 숨기기(서버에 저장)
  const family = card.getByLabel('가족 & 친척');
  await expect(family).toBeChecked();
  await family.uncheck();
  await expect(card.getByLabel('가족 & 친척')).not.toBeChecked();
  const got = (await call('GET')).data;
  expect(got.events.map((e: { title: string }) => e.title)).not.toContain('네이버 가족 생일');
  expect(got.calendars.find((c: { name: string }) => c.name === '가족 & 친척').hidden).toBe(true);

  // 아침 브리핑에 오늘 일정 한 줄
  const brief = await page.evaluate(async () => (await fetch('/api/brief')).json());
  const ev = brief.items.find((i: { kind: string }) => i.kind === 'event');
  expect(ev).toMatchObject({ title: '오늘 일정 1개', sub: '14:00 네이버 체험단 방문', target: 'calendar' });
  expect(brief.counts.events).toBe(1);

  // D는 네이버 계정이 없어서 카드도 없고 켤 수도 없다
  const other = await browser.newPage();
  await login(other, CODE_D);
  const d = await other.evaluate(async () => {
    const g = await (await fetch('/api/calendar/naver')).json();
    const p = (await fetch('/api/calendar/naver', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) })).status;
    return { g, p };
  });
  expect(d).toMatchObject({ g: { available: false, connected: false }, p: 400 });
  await other.goto('/#calendar');
  await expect(other.getByRole('heading', { name: '캘린더' })).toBeVisible();
  await expect(other.getByRole('region', { name: /네이버 일정 겹쳐 보기/ })).toHaveCount(0);
  await other.close();

  // 끄기
  await card.getByRole('button', { name: '끄기' }).click();
  await expect(card).toContainText('꺼짐');
  await call('DELETE');
});
