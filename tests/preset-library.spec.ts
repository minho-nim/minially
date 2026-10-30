import { presetAction, presetMode } from './helpers/preset-actions';
import { test, expect, Page } from '@playwright/test';
import type { AppData } from '../src/types';
const library = (page: Page) => page.getByRole('dialog', { name: '프리셋', exact: true });
const editor = (page: Page) => page.getByRole('dialog', { name: '새 일정', exact: true });
const inline = (page: Page) => editor(page).getByRole('region', { name: '제목 프리셋 선택', exact: true });
async function data(page: Page): Promise<AppData> { return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); }); }
async function seed(page: Page) {
  await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData({ presets: ['준비', '회의', '검토'].map((text, i) => ({ id: 'p'+i, text, type: 'title', isFavorite: i === 1, usageCount: 0, sortOrder: i, createdAt: 1, updatedAt: 1 })), schedules: [{ id: 'existing', title: '기존 일정', date: '2026-10-29', category: '', completed: false }], categories: [] }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => { errors.set(page, []); page.on('pageerror', e => errors.get(page)!.push(e.message)); await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort()); await page.goto('/', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor(); });
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
async function loadLegacyBundle(page: Page) {
 await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';await(await import(path)).savePreset({id:'legacy-bundle',text:'준비 회의 검토',blocks:['준비','회의','검토'].map((text,i)=>({id:'legacy-'+i,text})),type:'title',isFavorite:false,usageCount:0,sortOrder:3,createdAt:1,updatedAt:1});});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'프리셋',exact:true}).click();await expect(library(page).getByRole('button',{name:'블록 묶음 만들기'})).toHaveCount(0);await expect(library(page).getByText('추가 옵션',{exact:true})).toHaveCount(0);
 return (await data(page)).presets.find(p=>p.id==='legacy-bundle')!;
}

test('기존 묶음 프리셋의 새로고침·편집·삭제·백업 보존', async ({ page }) => {
  await seed(page); const before = (await data(page)).schedules, bundle = await loadLegacyBundle(page); expect(bundle.blocks?.map(b => b.text)).toEqual(['준비', '회의', '검토']); expect((await data(page)).schedules).toEqual(before);
  await expect(library(page).getByRole('button', { name: '등록', exact: true })).toHaveCount(0); await expect(library(page).getByRole('button', { name: '일정 설정', exact: true })).toHaveCount(0); await library(page).getByRole('button', { name: '프리셋 닫기' }).click();
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '프리셋', exact: true }).click();
  let row = library(page).locator(`[data-phrase-id="${bundle.id}"]`); await row.getByRole('button', { name: '프리셋 수정', exact: true }).click(); await row.getByLabel('1번째 블록 내용').fill('자료 준비'); await row.getByRole('button', { name: '자료 준비 블록 이동' }).focus(); await page.keyboard.press('ArrowRight'); await row.getByRole('button', { name: '변경사항 저장' }).click();
  const changed = (await data(page)).presets.find(p => p.id === bundle.id)!; expect(changed.blocks?.map(b => b.text)).toEqual(['회의', '자료 준비', '검토']); expect(changed.text).toBe('회의 자료 준비 검토'); expect((await data(page)).schedules).toEqual(before);
  const backup = await data(page); await page.evaluate(async backup => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData(JSON.parse(JSON.stringify(backup))); }, backup); expect(await data(page)).toEqual(backup);
  await presetAction(row,'프리셋 삭제'); await row.getByRole('group', { name: '프리셋 삭제 확인' }).getByRole('button', { name: '삭제', exact: true }).click(); await expect(row).toHaveCount(0); expect((await data(page)).schedules).toEqual(before);
});

test('제목 아래 그룹 목록에서 묶음 적용·블록 드래그·다른 필드 보존 후 일정 등록', async ({ page }) => {
  await seed(page); const bundle = await loadLegacyBundle(page); await library(page).getByRole('button', { name: '프리셋 닫기' }).click(); await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  await editor(page).getByLabel('일정 제목', { exact: true }).fill('직접 작성'); await editor(page).getByLabel('시작 시간 분', { exact: true }).selectOption('15'); await editor(page).getByRole('button', { name: '+ 상세 옵션 (메모)', exact: true }).click(); await editor(page).getByPlaceholder('상세 내용을 메모하세요').fill('유지할 메모');
  await editor(page).getByRole('button', { name: '프리셋', exact: true }).click(); await expect(inline(page)).toBeVisible(); await expect(editor(page).getByLabel('일정 제목', { exact: true })).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(1);
  await presetMode(editor(page),'replace'); const group = inline(page).locator('[data-inline-preset="'+bundle.id+'"]'); await group.click(); await expect(inline(page)).toBeVisible(); await inline(page).getByRole('button',{name:'프리셋 패널 닫기'}).click(); await expect(inline(page)).toHaveCount(0); await expect.poll(async () => (await data(page)).presets.find(p => p.id === bundle.id)?.usageCount).toBe(1); await expect(editor(page).getByLabel('일정 제목', { exact: true })).toHaveValue('준비 회의 검토');
  const blocks = editor(page).getByRole('list', { name: '제목 블록', exact: true }); await blocks.getByRole('button', { name: '준비 블록 이동' }).dragTo(blocks.getByRole('listitem').filter({ hasText: '회의' })); await expect(editor(page).getByLabel('일정 제목', { exact: true })).toHaveValue('회의 준비 검토');
  await expect(inline(page)).toHaveCount(0); await expect(editor(page)).toBeVisible(); await expect(editor(page).getByLabel('시작 시간 분', { exact: true })).toHaveValue('15'); await expect(editor(page).getByPlaceholder('상세 내용을 메모하세요')).toHaveValue('유지할 메모'); expect((await data(page)).schedules).toHaveLength(1);
  await editor(page).getByRole('button', { name: '등록', exact: true }).click(); await expect(editor(page)).toHaveCount(0); expect((await data(page)).schedules.find(s => s.title === '회의 준비 검토')).toMatchObject({ memo: '유지할 메모', startTime: '09:15', titleBlocks: [{ text: '회의' }, { text: '준비' }, { text: '검토' }] });
});

test('프리셋 저장 실패·중복 안내에서 입력 유지, 일정 생성 없음', async ({ page }) => {
  await seed(page); await page.getByRole('button', { name: '프리셋', exact: true }).click(); await library(page).getByRole('button',{name:'새 프리셋 추가'}).click(); await library(page).getByLabel('새 프리셋', { exact: true }).fill('실패해도 보존');
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; (window as any).restore = () => IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'presets') throw new DOMException('Full', 'QuotaExceededError'); return put.apply(this, args); }; });
  await library(page).getByRole('button', { name: '프리셋 저장' }).click(); await expect(library(page).getByRole('alert')).toContainText('저장하지 못'); await expect(library(page).getByLabel('새 프리셋', { exact: true })).toHaveValue('실패해도 보존'); expect((await data(page)).schedules).toHaveLength(1); await page.evaluate(() => (window as any).restore()); await library(page).getByRole('button', { name: '프리셋 저장' }).dblclick(); await expect.poll(async () => (await data(page)).presets.filter(p => p.text === '실패해도 보존').length).toBe(1);
  await library(page).getByRole('button',{name:'새 프리셋 추가'}).click(); await library(page).getByLabel('새 프리셋', { exact: true }).fill('실패해도 보존'); await library(page).getByRole('button', { name: '프리셋 저장' }).click(); await expect(library(page).getByRole('alert')).toContainText('이미 저장'); expect((await data(page)).schedules).toHaveLength(1);
});

test('카테고리 10색·최대 10개·동시 생성 제한·삭제 후 추가·기존 자료 보존', async ({ page }) => {
  await page.getByRole('button', { name: '설정 및 프리셋', exact: true }).click(); const settings = page.getByRole('dialog', { name: '설정', exact: true }); await settings.getByRole('button', { name: '카테고리', exact: true }).click(); await expect(settings.getByLabel('색상 팔레트').getByRole('button')).toHaveCount(10);
  await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; const db = await import(path); for(let i=0;i<9;i++) await db.saveCategory({ id:'cat'+i, name:'내 분류 '+i, color:'#CF8FA8' }); const result = await Promise.allSettled(['x','y'].map(id => db.saveCategory({ id, name:id, color:'#94BED9' }))); (window as any).categoryResults = result.map(r => r.status); });
  expect((await data(page)).categories).toHaveLength(10); expect(await page.evaluate(() => (window as any).categoryResults)).toContain('rejected'); await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '설정 및 프리셋', exact: true }).click(); await settings.getByRole('button', { name: '카테고리', exact: true }).click(); await settings.getByPlaceholder('카테고리 이름').fill('열한 번째'); await expect(settings.getByRole('button', { name: '추가', exact: true })).toBeDisabled();
  await settings.getByRole('button', { name: '취소', exact: true }).click(); await settings.getByRole('button', { name: '등록 취소', exact: true }).click();
  const row = settings.locator('[data-category-id="cat0"]'); await row.getByRole('button', { name: '수정', exact: true }).click(); await settings.getByPlaceholder('카테고리 이름').fill('열 개 상태에서 수정'); await settings.getByRole('button', { name: '변경사항 저장' }).click(); await row.getByRole('button', { name: '삭제', exact: true }).click(); await row.getByRole('group', { name: '카테고리 삭제 확인' }).getByRole('button', { name: '삭제', exact: true }).click(); await expect(row).toHaveCount(0); await settings.getByPlaceholder('카테고리 이름').fill('삭제 후 새 분류'); await settings.getByRole('button', { name: '추가', exact: true }).click(); await expect(settings.getByText('삭제 후 새 분류', { exact: true })).toBeVisible(); expect((await data(page)).categories).toHaveLength(10);
});

test('과거 자동 예시 중 미사용만 목록 제외, 사용·수정·직접 생성 데이터와 백업 유지', async ({ page }) => {
  await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData({ categories: [{ id:'work', name:'업무', color:'#D98DAA', isDefault:true }, { id:'personal', name:'개인', color:'#B08898', isDefault:true }, { id:'study', name:'공부/자기계발', color:'#8899B0', isDefault:false }, { id:'health', name:'수정한 건강', color:'#88B098', isDefault:false }, { id:'mine', name:'업무', color:'#D98DAA' }], schedules: [{ id:'old', title:'기존 일정 유지', date:'2026-10-29', category:'personal', completed:false }] }); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '일정 등록', exact: true }).click(); await editor(page).getByRole('button', { name: '카테고리 선택', exact: true }).click(); const panel = page.locator('[data-schedule-panel]'); await expect(panel.getByRole('button', { name:'공부/자기계발', exact:true })).toHaveCount(0); await expect(panel.getByRole('button', { name:'업무', exact:true })).toHaveCount(1); await expect(panel.getByRole('button', { name:'개인', exact:true })).toBeVisible(); await expect(panel.getByRole('button', { name:'수정한 건강', exact:true })).toBeVisible(); const raw = await data(page); expect(raw.categories).toHaveLength(5); expect(raw.schedules[0]).toMatchObject({ id:'old', category:'personal', title:'기존 일정 유지' });
});

test.describe('모바일 제목 블록', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('모바일 묶음 적용과 제목 블록 터치 드래그, 저장 전 일정 미생성', async ({ page, context }) => {
    await seed(page); const bundle = await loadLegacyBundle(page); await library(page).getByRole('button', { name: '프리셋 닫기' }).tap(); await page.getByRole('button', { name: '일정 등록', exact: true }).tap(); await editor(page).getByRole('button', { name: '프리셋', exact: true }).tap();
    await inline(page).locator('[data-inline-preset="'+bundle.id+'"]').tap(); await inline(page).getByRole('button',{name:'프리셋 패널 닫기'}).tap(); await expect(inline(page)).toHaveCount(0);
    const blocks = editor(page).getByRole('list', { name: '제목 블록', exact: true }), source = blocks.getByRole('button', { name: '회의 블록 이동' }), target = blocks.getByRole('listitem').filter({ hasText: '준비' }); await source.scrollIntoViewIfNeeded(); const a = (await source.boundingBox())!, b = (await target.boundingBox())!, cdp = await context.newCDPSession(page);
    const from = { x: a.x+a.width/2, y: a.y+a.height/2 }, to = { x:b.x+b.width/2, y:b.y+b.height/2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] }); for(let i=1;i<=12;i++) { await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12}] }); await page.waitForTimeout(17); } await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd',touchPoints:[] });
    await expect(editor(page).getByLabel('일정 제목', { exact: true })).toHaveValue('회의 준비 검토'); expect((await data(page)).schedules).toHaveLength(1); await page.setViewportSize({width:390,height:400}); await expect(editor(page).getByRole('button', {name:'등록',exact:true})).toBeInViewport(); await page.screenshot({path:'test-results/inline-title-mobile.png'}); await editor(page).getByRole('button',{name:'등록',exact:true}).tap(); await expect(editor(page)).toHaveCount(0); expect((await data(page)).schedules.find(s=>s.title==='회의 준비 검토')?.titleBlocks?.map(b=>b.text)).toEqual(['회의','준비','검토']);
  });
});
