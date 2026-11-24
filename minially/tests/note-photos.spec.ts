import { test, expect } from '@playwright/test';
import { deflateSync } from 'node:zlib';

// 메모에 사진 넣기: 버튼·붙여넣기로 넣으면 줄여 저장(240KB 이하)하고, 다시 열어도 보이며, 본문 글에는 [사진], 영구 삭제하면 사진도 지운다.
function png(width: number, height: number) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const b = Buffer.concat([Buffer.from(t), d]); const s = Buffer.alloc(4); s.writeUInt32BE(crc(b)); return Buffer.concat([l, b, s]); };
  const h = Buffer.alloc(13); h.writeUInt32BE(width, 0); h.writeUInt32BE(height, 4); h[8] = 8; h[9] = 2;
  const rows = Buffer.concat(Array.from({ length: height }, (_, y) => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, (_, x) => [x % 256, y % 256, (x * y) % 256]).flat())])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', h), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

test('검사: 사진 블록·사진 기록 형식', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const r = await page.evaluate(async () => {
    const doc = await import('/src/utils/noteRichDocument.ts' as string), photos = await import('/src/utils/notePhotos.ts' as string);
    const id = '11111111-2222-3333-4444-555555555555';
    const ok = (f: () => void) => { try { f(); return true; } catch { return false; } };
    return {
      block: doc.validNoteBlocks([{ type: 'image', photoId: id }]), badBlock: doc.validNoteBlocks([{ type: 'image', photoId: 'x' }]), extra: doc.validNoteBlocks([{ type: 'image', photoId: id, src: 'http://x' }]),
      text: doc.flattenNoteBlocks([{ type: 'paragraph', runs: [{ text: '앞' }] }, { type: 'image', photoId: id }]).map((r: { text: string }) => r.text).join(''),
      photo: ok(() => photos.validateNotePhoto({ id, noteId: 'n', dataUrl: 'data:image/jpeg;base64,AAAA', width: 10, height: 10, createdAt: 1, updatedAt: 1 })),
      script: ok(() => photos.validateNotePhoto({ id, noteId: 'n', dataUrl: 'data:text/html;base64,AAAA', width: 10, height: 10, createdAt: 1, updatedAt: 1 })),
      big: ok(() => photos.validateNotePhoto({ id, noteId: 'n', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(300 * 1024), width: 10, height: 10, createdAt: 1, updatedAt: 1 })),
    };
  });
  expect(r).toEqual({ block: true, badBlock: false, extra: false, text: '앞\n[사진]', photo: true, script: false, big: false });
});

test('메모에 사진 넣기·다시 열어도 보임·백업에 포함·영구 삭제 시 사진도 삭제', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; await (await import(path)).saveNote({ id: 'p1', title: '사진 메모', body: '첫 줄', folderId: '', tags: [], pinned: false, createdAt: 1, updatedAt: 2 }); });
  await page.reload();
  await page.getByRole('button', { name: '메모', exact: true }).filter({ visible: true }).click();
  await page.locator('[data-note-id="p1"]').click();
  const editor = page.getByRole('textbox', { name: '메모 본문' });
  await editor.click();
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: png(2400, 1600) });
  await expect(editor.locator('figure.note-photo img')).toHaveCount(1);
  await expect(page.getByRole('status', { name: '메모 저장 상태' })).toHaveText('저장됨');
  const saved = await page.evaluate(async () => { const path = '/src/db/indexedDB.ts', db = await import(path); const note = (await db.getAllNotes()).find((n: { id: string }) => n.id === 'p1'); const data = await db.exportAllData(); return { body: note.body, blocks: note.richDocument.map((b: { type: string }) => b.type), photos: data.notePhotos.map((p: { noteId: string; width: number; height: number; dataUrl: string }) => ({ noteId: p.noteId, w: p.width, h: p.height, size: p.dataUrl.length, jpeg: p.dataUrl.startsWith('data:image/jpeg;base64,') })) }; });
  expect(saved.body).toBe('첫 줄\n[사진]\n');
  expect(saved.blocks).toEqual(['paragraph', 'image', 'paragraph']);
  expect(saved.photos).toHaveLength(1);
  expect(saved.photos[0]).toMatchObject({ noteId: 'p1', w: 1280, h: 853, jpeg: true });
  expect(saved.photos[0].size).toBeLessThanOrEqual(240 * 1024);
  // 다시 열어도 사진이 보인다
  await page.reload();
  await page.getByRole('button', { name: '메모', exact: true }).filter({ visible: true }).click();
  await page.locator('[data-note-id="p1"]').click();
  await expect.poll(() => page.locator('figure.note-photo img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1280);
  // 휴지통 → 영구 삭제하면 사진도 지운다
  await page.getByRole('button', { name: '메모 휴지통으로' }).click();
  await expect(page.getByRole('status', { name: '메모 저장 상태' })).toHaveText('저장됨');
  const left = await page.evaluate(async () => { const path = '/src/db/indexedDB.ts', db = await import(path); const note = (await db.getAllNotes()).find((n: { id: string }) => n.id === 'p1'); await db.emptyNoteTrash([{ id: 'p1', updatedAt: note.updatedAt }]); return (await db.exportAllData()).notePhotos.length; });
  expect(left).toBe(0);
});
