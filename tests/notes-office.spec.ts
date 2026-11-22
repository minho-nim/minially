import {test,expect,type Page} from '@playwright/test';
import type {AppData} from '../src/types';
async function data(page:Page):Promise<AppData>{return page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return(await import(path)).exportAllData();});}
async function selectBody(page:Page){await page.getByRole('textbox',{name:'메모 본문',exact:true}).evaluate(el=>{el.focus();const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(el);selection!.removeAllRanges();selection!.addRange(range);});}
for(const width of [400,1400])test.describe(`문서형 메모 ${width}`,()=>{
 test.use({viewport:{width,height:900}});
 test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();});
 test('글꼴·크기·위아래 첨자·정렬·실행 취소와 다시 실행',async({page})=>{
  const body=page.getByRole('textbox',{name:'메모 본문',exact:true}),toolbar=page.getByRole('toolbar',{name:'메모 글자 서식'});await body.fill('서식 테스트');await selectBody(page);
  await toolbar.getByLabel('글꼴',{exact:true}).selectOption('Georgia');await toolbar.getByLabel('글자 크기',{exact:true}).selectOption('24');await expect.poll(async()=>(await data(page)).notes![0].richBody?.[0].fontSize).toBe(24);
  await toolbar.getByRole('button',{name:'위첨자',exact:true}).click();await expect.poll(async()=>(await data(page)).notes![0].richBody?.[0].script).toBe('super');await toolbar.getByRole('button',{name:'실행 취소',exact:true}).click();await expect.poll(async()=>(await data(page)).notes![0].richBody?.[0].script).not.toBe('super');await toolbar.getByRole('button',{name:'다시 실행',exact:true}).click();await expect.poll(async()=>(await data(page)).notes![0].richBody?.[0].script).toBe('super');
  await selectBody(page);await toolbar.getByRole('button',{name:'아래첨자',exact:true}).click();await expect.poll(async()=>(await data(page)).notes![0].richBody?.[0].script).toBe('sub');
  await toolbar.getByRole('button',{name:'가운데 정렬',exact:true}).click();await toolbar.getByLabel('줄간격',{exact:true}).selectOption('1.5');await expect.poll(async()=>(await data(page)).notes![0].richDocument?.[0]).toMatchObject({type:'paragraph',align:'center',lineHeight:1.5});
  const before=(await data(page)).notes![0];expect(before.richBody?.[0]).toMatchObject({fontFamily:'Georgia',fontSize:24,script:'sub'});
  await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.locator('[data-note-id]').click();await expect(body.locator('sub')).toHaveCount(1);await expect(body.locator('p').first()).toHaveCSS('text-align','center');expect((await data(page)).notes![0].richDocument).toEqual(before.richDocument);
  for(const [label,align] of [['오른쪽 정렬','right'],['양쪽 정렬','justify'],['왼쪽 정렬','left']]){await selectBody(page);await toolbar.getByRole('button',{name:label,exact:true}).click();await expect.poll(async()=>(await data(page)).notes![0].richDocument?.[0]).toMatchObject({align});}
  await selectBody(page);await toolbar.getByRole('button',{name:'글머리 기호',exact:true}).click();await expect.poll(async()=>(await data(page)).notes![0].richDocument?.[0]).toMatchObject({list:'bullet'});await toolbar.getByRole('button',{name:'번호 목록',exact:true}).click();await expect.poll(async()=>(await data(page)).notes![0].richDocument?.[0]).toMatchObject({list:'number'});
  await selectBody(page);await toolbar.getByLabel('글자색',{exact:true}).evaluate(input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'#c03030');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});await expect.poll(async()=>(await data(page)).notes![0].richBody?.[0].color).toBe('#c03030');
  expect((await page.locator('.note-editor-header').boundingBox())!.height).toBeLessThanOrEqual(36);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 test('표 삽입·셀 편집·행열 추가삭제·되돌리기·재실행·저장과 백업',async({page})=>{
  const body=page.getByRole('textbox',{name:'메모 본문',exact:true}),toolbar=page.getByRole('toolbar',{name:'메모 글자 서식'});await body.focus();await toolbar.getByRole('button',{name:'표',exact:true}).click();await toolbar.getByLabel('표 행 수').fill('2');await toolbar.getByLabel('표 열 수').fill('2');await toolbar.getByRole('button',{name:'표 삽입',exact:true}).click();await expect(body.locator('table')).toHaveCount(1);
  await body.locator('td').first().click();await page.keyboard.insertText('준비물');await body.locator('td').nth(1).click();await page.keyboard.insertText('완료');await expect.poll(async()=>(await data(page)).notes![0].body).toContain('준비물\t완료');
  await toolbar.getByRole('button',{name:'아래에 행 추가',exact:true}).click();await expect(body.locator('tr')).toHaveCount(3);await toolbar.getByRole('button',{name:'오른쪽에 열 추가',exact:true}).click();await expect(body.locator('tr').first().locator('td')).toHaveCount(3);
  await toolbar.getByRole('button',{name:'열 삭제',exact:true}).click();await expect(body.locator('tr').first().locator('td')).toHaveCount(2);await toolbar.getByRole('button',{name:'행 삭제',exact:true}).click();await expect(body.locator('tr')).toHaveCount(2);
  await toolbar.getByRole('button',{name:'실행 취소',exact:true}).click();await expect(body.locator('tr')).toHaveCount(3);await toolbar.getByRole('button',{name:'다시 실행',exact:true}).click();await expect(body.locator('tr')).toHaveCount(2);
  await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');const before=(await data(page)).notes![0];expect(before.richDocument?.some(block=>block.type==='table')).toBe(true);
  await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.locator('[data-note-id]').click();await expect(body.locator('tr')).toHaveCount(2);await expect(body.locator('td').first()).toHaveText('준비물');
  const restored=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts',db=await import(path),backup=await db.exportAllData();await db.importAllData({notes:[]});await db.importAllData(backup);return db.exportAllData();});expect(restored.notes![0].richDocument).toEqual(before.richDocument);
  await page.screenshot({path:`test-results/note-office-${width}.png`,fullPage:true});
 });
});
