import { expect, test, type Page } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';

const MOCK = 'http://127.0.0.1:8898';
const kst = (days: number) => new Date(Date.now() + 9 * 3600000 + days * 86400000).toISOString().slice(0, 10);
const call = (page: Page, path: string, method = 'GET', body?: unknown) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p as string, { method: m as string, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
  return { status: r.status, data: await r.json().catch(() => null) };
}, [path, method, body] as const);
const keys = { p256dh: 'BOr2V9nQ5n9V7zVqU0Q7S3xK1lYw2Z0k8vU2c3Jt9Yb6xq1u4F5n7m8k9j0h1g2f3d4s5a6q7w8e9r0t1y2u3i4o5p', auth: 'aGVsbG8tYXV0aC0xMjM0' };

test('아침 브리핑: 마감·신청 마감·오늘 올릴 원고를 급한 순으로, 첫 화면 카드에서 바로 열기', async ({ page, request }) => {
  expect((await request.get('/api/brief')).status()).toBe(401);
  expect((await request.post('/api/brief/cron')).status()).toBe(401);
  await login(page, CODE_C);
  const made: string[] = [];
  for (const c of [
    { brand: '브리핑빵집', status: 'in_progress', deadline: kst(1), amount: 70000 },
    { brand: '브리핑카페', status: 'interested', apply_by: kst(2) },
    { brand: '먼마감상점', status: 'in_progress', deadline: kst(20) }, // 3일 넘게 남으면 할 일에 안 넣는다
  ]) made.push((await call(page, '/api/campaigns', 'POST', c)).data.campaign.id);
  const draft = (await call(page, '/api/drafts', 'POST', {})).data.draft.id;
  await call(page, `/api/drafts/${draft}`, 'PUT', { title: '오늘 올릴 브리핑 글', planned_on: kst(0) });

  const brief = (await call(page, '/api/brief')).data;
  const mine = brief.items.filter((i: { title: string }) => /브리핑|먼마감/.test(i.title));
  expect(mine.map((i: { title: string; sub: string }) => `${i.title}/${i.sub}`)).toEqual(['브리핑빵집 게시 마감/D-1', '브리핑카페 체험단 신청/신청 마감 D-2', "'오늘 올릴 브리핑 글' 올리기/오늘 게시 예정"]);
  expect(brief.counts.receivable).toBeGreaterThanOrEqual(70000);

  // 첫 화면 카드: 숫자 요약과 '열기'
  await page.reload();
  const card = page.getByRole('region', { name: /좋은 하루예요/ });
  await expect(card).toContainText('오늘 할 일');
  await expect(card.getByLabel('숫자 요약')).toContainText('받을 금액');
  await card.getByRole('button', { name: '열기: 브리핑빵집 게시 마감' }).click();
  await expect(page.getByRole('heading', { name: '협찬·수익' })).toBeVisible();

  for (const id of made) await call(page, `/api/campaigns/${id}`, 'DELETE');
  await call(page, `/api/drafts/${draft}`, 'DELETE');
});

test('아침 알림: 브라우저 회사 푸시 주소만 받고, 하루 한 번 빈 알림(VAPID 서명)을 보내고, 끝난 구독은 지운다', async ({ page, request }) => {
  await login(page, CODE_C);
  const info = (await call(page, '/api/push')).data;
  expect(info.public_key).toMatch(/^[A-Za-z0-9_-]{80,}$/);
  // 아무 주소나 받지 않는다(서버가 그 주소로 요청을 보내므로)
  for (const endpoint of ['https://evil.example/push', 'http://fcm.googleapis.com/x', 'javascript:alert(1)']) expect((await call(page, '/api/push', 'POST', { endpoint, keys })).status).toBe(400);
  expect((await call(page, '/api/push', 'POST', { endpoint: `${MOCK}/push/c-phone`, keys: { p256dh: '<script>', auth: 'x' } })).status).toBe(400);
  expect((await call(page, '/api/push', 'POST', { endpoint: `${MOCK}/push/c-phone`, keys })).status).toBe(201);
  expect((await call(page, '/api/push', 'POST', { endpoint: `${MOCK}/push/gone-c-old`, keys })).status).toBe(201);

  // 할 일이 있어야 보낸다
  const c = (await call(page, '/api/campaigns', 'POST', { brand: '알림빵집', status: 'in_progress', deadline: kst(0) })).data.campaign.id;
  expect((await request.post('/api/brief/cron', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);
  const first = await (await request.post('/api/brief/cron', { headers: { authorization: 'Bearer test-cron' } })).json();
  expect(first.result.C).toMatchObject({ sent: 1, gone: 1, failed: 0 });
  const log = (await (await request.get(`${MOCK}/push-log`)).json()) as { id: string; authorization: string; ttl: string; length: number }[];
  const phone = log.filter(l => l.id === 'c-phone');
  expect(phone).toHaveLength(1);
  expect(phone[0].authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
  expect(phone[0]).toMatchObject({ ttl: '3600', length: 0 }); // 알림에 내용은 싣지 않는다
  // 같은 날 다시 불러도 보내지 않고, 끝난 구독(410)은 지워졌다
  const again = await (await request.post('/api/brief/cron', { headers: { authorization: 'Bearer test-cron' } })).json();
  expect(again.result.C).toMatchObject({ sent: 0, gone: 0 });
  expect((await call(page, '/api/push')).data.devices).toBe(1);

  // 설정 화면: 알림 칸이 보인다
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: '아침 알림' })).toBeVisible();

  await call(page, '/api/push', 'DELETE', { endpoint: `${MOCK}/push/c-phone` });
  expect((await call(page, '/api/push')).data.devices).toBe(0);
  await call(page, `/api/campaigns/${c}`, 'DELETE');
});
