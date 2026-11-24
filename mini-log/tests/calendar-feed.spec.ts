import { expect, test } from '@playwright/test';
import { CODE_D } from '../playwright.config';
import { login } from './helpers';
import { buildIcs } from '../functions/_ics';

const kstDay = (n = 0) => new Date(Date.now() + 9 * 3600000 + n * 86400000).toISOString().slice(0, 10);

test('ICS 글자 처리·줄 접기·하루 종일·전날 알림', () => {
  const ics = buildIcs([{ uid: 'a', date: '2026-12-10', title: '[마감] 빵집, 소금빵; 체험단' + '가'.repeat(40) }], new Date('2026-11-24T00:00:00Z'));
  expect(ics).toContain('DTSTART;VALUE=DATE:20261210\r\nDTEND;VALUE=DATE:20261211');
  expect(ics.replace(/\r\n /g, "")).toContain(String.raw`SUMMARY:[마감] 빵집\, 소금빵\; 체험단`);
  expect(ics).toContain('TRIGGER:-PT15H');
  for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
});

test('달력 구독 주소: 만들기 → 마감·방문·게시 예정·다시 연락이 들어감(금액 없음) → 새 주소면 옛 주소 끊김 → 끄기', async ({ page, playwright }) => {
  await login(page, CODE_D);
  await page.evaluate(async ({ deadline, visit, pitchOn, planned }) => {
    const send = (url: string, method: string, body: unknown) => fetch(url, { method, body: JSON.stringify(body) }).then(r => r.json());
    await send('/api/campaigns', 'POST', { kind: 'sponsor', brand: '구독빵집', title: '체험단', amount: 777000, deadline, status: 'in_progress', guide: { keywords: ['빵'], visit_on: visit } });
    await send('/api/campaigns', 'POST', { kind: 'sponsor', brand: '답장없는카페', status: 'proposed', pitch: { on: pitchOn, via: 'mail', reply: 'waiting' } });
    const d = (await send('/api/drafts', 'POST', {})).draft;
    await send(`/api/drafts/${d.id}`, 'PUT', { title: '예정 원고', planned_on: planned });
  }, { deadline: kstDay(5), visit: kstDay(2), pitchOn: kstDay(-3), planned: kstDay(9) });

  await page.goto('/#calendar');
  await page.getByRole('button', { name: '구독 주소 만들기' }).click();
  const url = await page.getByLabel('구독 주소').inputValue();
  expect(url).toMatch(/\/ics\/[0-9a-f]{48}\.ics$/);
  await expect(page.getByRole('link', { name: '달력에 추가' })).toHaveAttribute('href', url.replace(/^https?:/, 'webcal:'));

  const anon = await playwright.request.newContext(); // 달력 앱처럼 쿠키 없이
  const res = await anon.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/calendar');
  const ics = await res.text();
  expect(ics).toContain('SUMMARY:[마감] 구독빵집 · 체험단');
  expect(ics).toContain(`DTSTART;VALUE=DATE:${kstDay(5).replace(/-/g, '')}`);
  expect(ics).toContain('SUMMARY:[방문] 구독빵집 · 체험단');
  expect(ics).toContain('SUMMARY:[게시 예정] 예정 원고');
  expect(ics).toContain('SUMMARY:[다시 연락] 답장없는카페');
  expect(ics).toContain(`DTSTART;VALUE=DATE:${kstDay(4).replace(/-/g, '')}`); // 제안 3일 전 + 7일
  expect(ics).not.toContain('777');

  // 새 주소를 만들면 옛 주소는 끊긴다
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '새 주소 만들기' }).click();
  await expect(page.getByLabel('구독 주소')).not.toHaveValue(url);
  const url2 = await page.getByLabel('구독 주소').inputValue();
  expect((await anon.get(url)).status()).toBe(404);
  expect((await anon.get(url2)).status()).toBe(200);
  expect((await anon.get(url2.replace(/[0-9a-f]{48}/, 'f'.repeat(48)))).status()).toBe(404);
  // 끄기
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '끄기' }).click();
  await expect(page.getByRole('button', { name: '구독 주소 만들기' })).toBeVisible();
  expect((await anon.get(url2)).status()).toBe(404);
  // 로그인 없이 주소 만들기 불가
  expect((await anon.post(new URL('/api/calendar/feed', url).toString())).status()).toBe(401);
  await anon.dispose();
  await page.evaluate(async () => {
    for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
    for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' });
  });
});
