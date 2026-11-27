import { test, expect } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CODE_A, CODE_B } from '../playwright.sync.config';
import { device, login, put, category, schedule } from './helpers';

// 시험용 흰 PNG(브라우저가 열 수 있는 진짜 이미지, 외부 파일 없이 만든다)
function png(width: number, height: number) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 255)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = png(40, 30);
const IMAGE = `data:image/png;base64,${PNG.toString('base64')}`;

test('사진으로 일정 넣기 API: 로그인·연결·사진 형식을 서버에서 검사한다', async ({ request }) => {
  expect((await request.post('/api/photo-schedule', { data: { image: IMAGE } })).status()).toBe(401);
  const noKey = await request.post('/api/photo-schedule', { headers: { authorization: `Bearer ${CODE_B}` }, data: { image: IMAGE } });
  expect(noKey.status()).toBe(409); // 미니허브 사용자로 연결되지 않은 코드
  expect((await noKey.json()).code).toBe('no_key');
  const bad = await request.post('/api/photo-schedule', { headers: { authorization: `Bearer ${CODE_A}` }, data: { image: 'data:text/html;base64,PGI+' } });
  expect(bad.status()).toBe(400);
  const ok = await request.post('/api/photo-schedule', { headers: { authorization: `Bearer ${CODE_A}` }, data: { image: IMAGE, today: '2026-11-26' } });
  expect(ok.status()).toBe(200);
  const { events } = await ok.json();
  expect(events.map((e: { title: string }) => e.title)).toEqual(['치과 진료', '송년회(오늘 2026-11-26)']); // 날짜 없음·13월은 서버가 뺌
  expect(events[1]).toMatchObject({ start: '19:00', end: null, uncertain: true });
});

test('새 일정 → 사진으로: 찾은 일정을 고치고 고른 것만 한 번에 등록한다(겹침·확인 필요 표시)', async ({ browser }) => {
  const pc = await device(browser, 400);
  await login(pc, CODE_A);
  await put(pc, { categories: [category], schedules: [schedule('dental-clash', '기존 회의', { date: '2026-12-02', startTime: '15:30', endTime: '16:30' })] });
  await pc.reload();
  await pc.getByRole('button', { name: '일정 등록', exact: true }).click();
  await pc.getByRole('dialog', { name: '새 일정' }).getByRole('button', { name: '사진으로 일정 넣기' }).click();
  const sheet = pc.getByRole('dialog', { name: '사진으로 일정 넣기' });
  await sheet.getByLabel('일정이 적힌 사진').setInputFiles({ name: 'sms.png', mimeType: 'image/png', buffer: PNG });
  await expect(sheet.getByRole('heading', { name: '찾은 일정 2개' })).toBeVisible();
  const rows = sheet.locator('[data-photo-event]');
  await expect(rows.nth(0)).toContainText('같은 시간에 ‘기존 회의 15:30’이 있어요');
  await expect(rows.nth(1)).toContainText('확인 필요');
  await expect(rows.nth(1).getByRole('checkbox')).not.toBeChecked(); // 짐작한 날짜는 처음엔 꺼 둔다
  await rows.nth(0).getByLabel('일정 제목').fill('치과 정기 검진');
  await rows.nth(0).getByLabel('카테고리').selectOption('rose');
  await sheet.getByRole('button', { name: '1개 등록' }).click();
  await expect(sheet).toHaveCount(0);
  const saved = await pc.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(r => { const q = indexedDB.open('DayFlowDB'); q.onsuccess = () => r(q.result); });
    const all = await new Promise<{ title: string; date: string; startTime?: string; endTime?: string; category: string }[]>(r => { const q = db.transaction('schedules').objectStore('schedules').getAll(); q.onsuccess = () => r(q.result); });
    db.close(); return all.filter(s => s.date === '2026-12-02' || s.date === '2026-12-18');
  });
  expect(saved.map(s => s.title).sort()).toEqual(['기존 회의', '치과 정기 검진']);
  expect(saved.find(s => s.title === '치과 정기 검진')).toMatchObject({ startTime: '15:00', endTime: '16:00', category: 'rose' });
  await pc.context().close();
});

test('글로 넣기 AI 다시 읽기 API: 글 길이를 서버에서 검사하고, 글은 <글> 안의 자료로 보낸다', async ({ request }) => {
  const auth = { authorization: `Bearer ${CODE_A}` };
  expect((await request.post('/api/photo-schedule', { data: { text: '12월 20일 돌잔치' } })).status()).toBe(401);
  expect((await request.post('/api/photo-schedule', { headers: auth, data: { text: '   ' } })).status()).toBe(400);
  expect((await request.post('/api/photo-schedule', { headers: auth, data: { text: '가'.repeat(4001) } })).status()).toBe(400);
  expect((await request.post('/api/photo-schedule', { headers: auth, data: { text: 123 } })).status()).toBe(400);
  const ok = await request.post('/api/photo-schedule', { headers: auth, data: { text: '토요일 낮 12시 조카 돌잔치', today: '2026-11-26' } });
  expect(ok.status()).toBe(200);
  const { events } = await ok.json();
  expect(events).toEqual([expect.objectContaining({ title: '돌잔치', date: '2026-12-20', start: '12:00', source: '토요일 낮 12시 조카 돌잔치' })]);
});

test('구글이 2.5 모델을 이 키에 열어 주지 않으면(404) 권장 대체 모델(3.5 Flash-Lite)로 다시 불러 읽는다', async ({ request }) => {
  const auth = { authorization: `Bearer ${CODE_A}` };
  const res = await request.post('/api/photo-schedule', { headers: auth, data: { text: '토요일 낮 12시 조카 돌잔치 OLD-MODEL-GONE', today: '2026-11-26' } });
  expect(res.status()).toBe(200);
  expect((await res.json()).events.length).toBeGreaterThan(0);
  // 사용 기록: 2.5는 '모델 바뀜'으로, 대체 모델은 성공으로 남는다(미니허브 오류 칸에서 원인을 알 수 있게)
  const dir = '.wrangler/test-state/v3/d1/miniflare-D1DatabaseObject';
  const file = readdirSync(dir).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  const db = new DatabaseSync(`${dir}/${file}`);
  const rows = db.prepare("SELECT model, status, error_code FROM ai_usage WHERE task = 'text_schedule' ORDER BY created_at DESC LIMIT 2").all() as { model: string; status: string; error_code: string | null }[];
  db.close();
  expect(rows).toEqual([{ model: 'gemini-3.5-flash-lite', status: 'ok', error_code: null }, { model: 'gemini-2.5-flash-lite', status: 'error', error_code: 'model_gone' }]);
});
