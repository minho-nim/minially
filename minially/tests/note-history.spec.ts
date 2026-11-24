import { test, expect } from '@playwright/test';

// 메모 수정 기록: 고치기 전 내용이 남고(10분 안 연속 수정은 한 번), 골라서 되돌리면 지금 내용도 기록에 남는다. 영구 삭제하면 기록도 지운다.
const base = { body: '처음 본문', folderId: '', tags: [], pinned: false, createdAt: 1 };

test('수정 기록 남기기·묶기·30개 제한·영구 삭제 시 함께 지우기(저장소)', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const r = await page.evaluate(async (base) => {
    const path = '/src/db/indexedDB.ts', db = await import(path);
    await db.saveNote({ ...base, id: 'h1', title: 'v1', updatedAt: 10 });
    await db.saveNote({ ...base, id: 'h1', title: 'v2', updatedAt: 11 }); // v1 기록
    await db.saveNote({ ...base, id: 'h1', title: 'v3', updatedAt: 12 }); // 10분 안 → 묶음(기록 안 함)
    await db.saveNote({ ...base, id: 'h1', title: 'v3', pinned: true, updatedAt: 13 }); // 내용 같으면 기록 안 함
    const afterEdits = (await db.getNoteVersions('h1')).map((v: { note: { title: string }; reason: string }) => `${v.reason}:${v.note.title}`);
    // 다른 이유(되돌리기 전)는 묶지 않는다
    await db.snapshotNoteBeforeRestore('h1');
    const afterSnap = (await db.getNoteVersions('h1')).map((v: { note: { title: string }; reason: string }) => `${v.reason}:${v.note.title}`);
    // 30개 제한: 서로 다른 이유로 40번 기록
    for (let i = 0; i < 40; i++) { await db.saveNote({ ...base, id: 'h2', title: `t${i}`, updatedAt: 100 + i }); await db.snapshotNoteBeforeRestore('h2'); }
    const many = (await db.getNoteVersions('h2')).length;
    // 영구 삭제 → 기록도 삭제
    await db.saveNote({ ...base, id: 'h1', title: 'v3', updatedAt: 20, deletedAt: 20 });
    await db.emptyNoteTrash([{ id: 'h1', updatedAt: 20 }]);
    return { afterEdits, afterSnap, many, gone: (await db.getNoteVersions('h1')).length };
  }, base);
  expect(r.afterEdits).toEqual(['edit:v1']);
  expect(r.afterSnap).toEqual(['restore:v3', 'edit:v1']);
  expect(r.many).toBe(30);
  expect(r.gone).toBe(0);
});

test('편집기에서 수정 기록을 보고 이전 버전으로 되돌리면 지금 내용도 기록에 남는다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async (base) => {
    const path = '/src/db/indexedDB.ts', db = await import(path);
    await db.saveNote({ ...base, id: 'h3', title: '회의 메모', body: '예전 본문: 오후 2시', updatedAt: 10 });
    await db.saveNote({ ...base, id: 'h3', title: '회의 메모', body: '지금 본문: 오후 3시', updatedAt: 11 });
  }, base);
  await page.reload();
  await page.getByRole('button', { name: '메모', exact: true }).filter({ visible: true }).click();
  await page.locator('[data-note-id="h3"]').click();
  await expect(page.locator('[contenteditable="true"]').first()).toContainText('지금 본문: 오후 3시');
  await page.getByRole('button', { name: '메모 수정 기록' }).click();
  const dialog = page.getByRole('dialog', { name: '메모 수정 기록' });
  await expect(dialog.getByRole('list', { name: '버전 목록' }).getByRole('button')).toHaveCount(1);
  await expect(dialog.getByLabel('선택한 버전 내용')).toContainText('예전 본문: 오후 2시');
  await dialog.getByRole('button', { name: '이 버전으로 되돌리기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('선택한 버전으로 되돌렸어요.')).toBeVisible();
  await expect(page.locator('[contenteditable="true"]').first()).toContainText('예전 본문: 오후 2시');
  await expect(page.getByRole('status', { name: '메모 저장 상태' })).toHaveText('저장됨');
  const saved = await page.evaluate(async () => { const path = '/src/db/indexedDB.ts', db = await import(path); return { body: (await db.getAllNotes()).find((n: { id: string }) => n.id === 'h3').body, versions: (await db.getNoteVersions('h3')).map((v: { reason: string; note: { body: string } }) => `${v.reason}:${v.note.body}`) }; });
  expect(saved.body).toBe('예전 본문: 오후 2시');
  expect(saved.versions[0]).toBe('restore:지금 본문: 오후 3시'); // 되돌리기 전 내용
  // 다시 열면 되돌리기 전 버전으로 돌아갈 수 있다
  await page.getByRole('button', { name: '메모 수정 기록' }).click();
  await expect(dialog.getByLabel('선택한 버전 내용')).toContainText('지금 본문: 오후 3시');
  await dialog.getByRole('button', { name: '수정 기록 닫기' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
