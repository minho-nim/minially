import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, useMonthView } from './helpers';
import { expandIcs } from '../../shared/server/googleIcs';

const ICS = 'http://127.0.0.1:8898/ics/basic.ics';
const kst = (d: number) => new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10);

test('반복 일정 펼치기: 매주 요일·격주·매일·매달을 기간 안 날짜마다', () => {
  const base = { title: 't', start: null, end: null, location: '', memo: '', source: '', uncertain: false, uid: 'u' };
  const weekly = expandIcs([{ ...base, date: '2026-12-01', repeat: { frequency: 'weekly', interval: 1, weekdays: [2, 4], label: '' } }], '2026-12-01', '2026-12-14');
  expect(weekly.map(e => e.day)).toEqual(['2026-12-01', '2026-12-03', '2026-12-08', '2026-12-10']);
  const biweekly = expandIcs([{ ...base, date: '2026-12-01', repeat: { frequency: 'weekly', interval: 2, label: '' } }], '2026-12-01', '2026-12-31');
  expect(biweekly.map(e => e.day)).toEqual(['2026-12-01', '2026-12-15', '2026-12-29']);
  expect(expandIcs([{ ...base, date: '2026-11-20', repeat: { frequency: 'monthly', interval: 1, label: '' } }], '2026-12-01', '2027-02-01').map(e => e.day)).toEqual(['2026-12-20', '2027-01-20']);
  expect(expandIcs([{ ...base, date: '2026-12-30', repeat: { frequency: 'daily', interval: 2, label: '' } }], '2026-12-29', '2027-01-04').map(e => e.day)).toEqual(['2026-12-30', '2027-01-01', '2027-01-03']);
});

test('구글 캘린더 겹쳐 보기: 비공개 주소만 받고, 계정에 저장해 달력에 회색으로, 남은 못 보고, 끊을 수 있다', async ({ page, browser, request }) => {
  expect((await request.get('/api/calendar/google')).status()).toBe(401);
  await login(page, CODE_C);
  await useMonthView(page);
  const put = (url: string) => page.evaluate(async u => (await fetch('/api/calendar/google', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: u }) })).status, url);
  for (const bad of ['https://evil.example/basic.ics', 'http://127.0.0.1:8899/ics/basic.ics', 'https://calendar.google.com/calendar/u/0/r']) expect(await put(bad)).toBe(400);

  // 화면에서 연결
  await page.goto('/#calendar');
  const card = page.getByRole('region', { name: /구글 일정 겹쳐 보기/ });
  await card.getByLabel(/iCal 형식의 비공개 주소/).fill(ICS);
  await card.getByRole('button', { name: '연결' }).click();
  await expect(card).toContainText('연결됨');
  await expect(page.getByLabel('표시')).toContainText('구글 일정');
  const data = await page.evaluate(async () => (await fetch('/api/calendar/google')).json());
  expect(JSON.stringify(data)).not.toContain('8898/ics'); // 저장한 주소는 다시 돌려주지 않는다
  const dental = data.events.find((e: { title: string }) => e.title === '구글 치과 예약');
  expect(dental).toMatchObject({ day: kst(3), start: '15:00', end: '16:00', location: '밝은미소치과' });
  expect(data.events.filter((e: { title: string }) => e.title === '구글 아침 수영').length).toBeGreaterThan(4); // 매주 월·수가 날마다 펼쳐짐
  expect(data.events.some((e: { title: string }) => e.title === '지난 구글 일정')).toBe(true); // 지난 한 달도 보인다
  // 그 날을 누르면 구글 일정이 읽기 전용으로(원고 열기 없음)
  await page.getByRole('gridcell', { name: new RegExp(`^${Number(kst(3).slice(5, 7))}월 ${Number(kst(3).slice(8))}일,`) }).click();
  const day = page.getByRole('region', { name: /월 \d+일/ }).filter({ hasText: '구글 치과 예약' });
  await expect(day).toContainText('구글 캘린더 · 15:00~16:00 · 밝은미소치과');

  // 다른 사용자는 C의 구글 일정을 못 본다
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const d = await other.newPage();
  await login(d, CODE_D);
  await useMonthView(d);
  expect(await d.evaluate(async () => (await (await fetch('/api/calendar/google')).json()).connected)).toBe(false);
  await other.close();

  await card.getByRole('button', { name: '연결 끊기' }).click();
  await expect(card.getByLabel(/iCal 형식의 비공개 주소/)).toBeVisible();
});
