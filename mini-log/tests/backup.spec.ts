import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

test('mini-log 백업: 받기 → 다른 사용자 계정에 합치기(새로 더함) → 다시 합치기는 그대로 → 최신만 바꿈', async ({ page, browser }) => {
  await login(page, CODE_C);
  // C의 데이터
  const ids = await page.evaluate(async () => {
    const s = (u: string, m: string, b: unknown) => fetch(u, { method: m, body: JSON.stringify(b) }).then(r => r.json());
    const d = (await s('/api/drafts', 'POST', { title: '백업 시험 원고', hashtags: ['백업'] })).draft;
    await s(`/api/drafts/${d.id}`, 'PUT', { body: '백업할 본문' });
    const c = (await s('/api/campaigns', 'POST', { kind: 'sponsor', brand: '백업카페', amount: 30000, status: 'in_progress' })).campaign;
    await s('/api/proposal', 'PUT', { blog_name: '백업 블로그' });
    return { draft: d.id as string, campaign: c.id as string };
  });
  await page.getByRole('button', { name: '설정', exact: true }).click(); // 계정·백업은 설정 화면으로 옮김
  const downloads: string[] = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 받기' }).click();
  const file = await (await dl).path();
  const fs = await import('node:fs/promises');
  const backup = JSON.parse(await fs.readFile(file!, 'utf8'));
  expect(backup.app).toBe('mini-log');
  expect(backup.drafts.find((d: { id: string }) => d.id === ids.draft).body).toBe('백업할 본문');
  expect(backup.proposal.form.blog_name).toBe('백업 블로그');
  expect(JSON.stringify(backup)).not.toContain('token');

  // 같은 계정에 다시 합치면 바뀌는 것 없음(지금이 더 최신이거나 같음)
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('group', { name: '백업 불러오기 확인' }).getByRole('button', { name: '합치기' }).click();
  await expect(page.getByRole('status')).toContainText('바뀐 것 없음');
  await expect.poll(() => downloads.some(n => /^minilog-backup-\d{4}-\d{2}-\d{2}-before-restore\.json$/.test(n))).toBe(true);

  // 백업 쪽이 더 최신이면 바꾼다
  const newer = JSON.parse(JSON.stringify(backup));
  const nd = newer.drafts.find((d: { id: string }) => d.id === ids.draft); nd.body = '백업에서 고친 본문'; nd.updated_at = Date.now() + 60000;
  const res = await page.evaluate(async b => (await (await fetch('/api/backup', { method: 'POST', body: JSON.stringify(b) })).json()).result, newer);
  expect(res.drafts.updated).toBe(1);
  expect(await page.evaluate(async id => (await (await fetch(`/api/drafts/${id}`)).json()).draft.body, ids.draft)).toBe('백업에서 고친 본문');

  // 다른 사용자(D)에게 C의 백업을 넣으면 같은 id는 건너뛴다(남의 원고를 가져가지 못함)
  const d = await (await browser.newContext()).newPage();
  await login(d, CODE_D);
  const dres = await d.evaluate(async b => (await (await fetch('/api/backup', { method: 'POST', body: JSON.stringify(b) })).json()).result, { ...backup, campaigns: [], styles: [], blogs: [], posts: [], watch: [], proposal: null }); // 다른 시험에 영향이 없게 원고만
  expect(dres.drafts.added).toBe(0);
  expect(dres.drafts.skipped).toBeGreaterThan(0);
  expect(await d.evaluate(async id => (await fetch(`/api/drafts/${id}`)).status, ids.draft)).toBe(404);
  // 잘못된 파일
  expect(await page.evaluate(async () => (await fetch('/api/backup', { method: 'POST', body: JSON.stringify({ app: 'other' }) })).status)).toBe(400);

  await page.evaluate(async i => { await fetch(`/api/drafts/${i.draft}`, { method: 'DELETE' }); await fetch(`/api/campaigns/${i.campaign}`, { method: 'DELETE' }); }, ids);
});

test('백업 API는 로그인 없이 쓸 수 없다', async ({ request }) => {
  expect((await request.get('/api/backup')).status()).toBe(401);
});
