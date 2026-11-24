import { test, expect } from '@playwright/test';

// 백업 복원: 기본은 합치기(지금 데이터 유지·없는 것 더하기·더 최신만 바꾸기), 복원 전 자동 백업, '전부 바꾸기' 선택 가능
const note = (id: string, title: string, updatedAt: number, extra = {}) => ({ id, title, body: '본문', folderId: '', tags: [], pinned: false, createdAt: 1, updatedAt, ...extra });

async function openBackup(page: import('@playwright/test').Page) {
  await page.locator('header').getByRole('button', { name: '설정 및 프리셋' }).click();
  await page.getByRole('button', { name: '백업/복원', exact: true }).click();
}
const notes = (page: import('@playwright/test').Page) => page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await (await import(path)).getAllNotes()).map((n: { id: string; title: string }) => `${n.id}:${n.title}`).sort(); });

test('백업 합치기: 지금 메모는 지우지 않고, 없는 메모는 더하고, 더 최신인 것만 바꾸며, 복원 전에 자동 백업한다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async ([a, b, c]) => { const path = '/src/db/indexedDB.ts', db = await import(path); await db.saveNote(a); await db.saveNote(b); await db.saveNote(c); }, [note('keep', '지금만 있는 메모', 5), note('newer-here', '여기가 최신', 9), note('older-here', '여기가 예전', 2)]);
  const backup = { notes: [note('newer-here', '백업은 예전', 3), note('older-here', '백업이 최신', 8), note('only-backup', '백업에만 있는 메모', 4)] };
  await openBackup(page);
  const downloads: string[] = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));
  page.once('dialog', dialog => { expect(dialog.message()).toContain('합칠까요'); void dialog.accept(); });
  await page.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  const settings = page.getByRole('dialog', { name: '설정', exact: true });
  await expect(settings.getByRole('status')).toHaveText('백업을 복원했습니다.');
  await expect(settings).toContainText('새로 더함 1개 · 더 최신으로 바꿈 1개 · 그대로 둠 1개');
  expect(await notes(page)).toEqual(['keep:지금만 있는 메모', 'newer-here:여기가 최신', 'older-here:백업이 최신', 'only-backup:백업에만 있는 메모']);
  await expect.poll(() => downloads.length).toBe(1);
  expect(downloads[0]).toMatch(/^Minially_Backup_\d{4}-\d{2}-\d{2}_before-restore\.json$/);
});

test('전부 바꾸기를 고르면 예전처럼 백업 내용으로 바꾼다, 잘못된 파일은 아무것도 바꾸지 않는다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async (a) => { const path = '/src/db/indexedDB.ts'; await (await import(path)).saveNote(a); }, note('keep', '지금 메모', 5));
  await openBackup(page);
  // 잘못된 파일(같은 ID 두 번) → 실패, 그대로
  page.once('dialog', dialog => void dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ notes: [note('x', 'a', 1), note('x', 'b', 2)] })) });
  const settings = page.getByRole('dialog', { name: '설정', exact: true });
  await expect(settings.getByRole('status')).toHaveText('백업을 복원하지 못했습니다. 파일 형식과 저장 공간을 확인해 주세요.');
  expect(await notes(page)).toEqual(['keep:지금 메모']);
  // 전부 바꾸기
  await settings.getByLabel(/전부 바꾸기/).check();
  page.once('dialog', dialog => { expect(dialog.message()).toContain('전부 바꿀까요'); void dialog.accept(); });
  await page.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ notes: [note('only-backup', '백업 메모', 1)] })) });
  await expect(settings.getByRole('status')).toHaveText('백업을 복원했습니다.');
  await expect(settings).toContainText('전부 바꿨어요');
  expect(await notes(page)).toEqual(['only-backup:백업 메모']);
});
