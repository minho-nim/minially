import {test,expect} from '@playwright/test';

test('기본 메모 분류 없이 시작하고 기존 자동 폴더의 원본과 사용한 폴더는 보존한다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
 const initial=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return (await import(path)).getNoteFolders();});expect(initial).toEqual([]);
 const preserved=await page.evaluate(async()=>{
  const path='/src/db/indexedDB.ts',db=await import(path);
  const legacyPath='/src/utils/notes.ts',legacy=(await import(legacyPath)).LEGACY_NOTE_FOLDERS;
  await db.importAllData({noteFolders:legacy,notes:[{id:'used',title:'보존할 메모',body:'본문',folderId:'notes-work',tags:[],pinned:false,createdAt:1,updatedAt:1}]});
  return {visible:await db.getNoteFolders(),raw:await db.exportAllData()};
 });expect(preserved.visible.map((f:{id:string})=>f.id)).toEqual(['notes-work']);expect(preserved.raw.noteFolders).toHaveLength(4);expect(preserved.raw.notes).toHaveLength(1);
 await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();await expect(page.getByRole('combobox',{name:'메모 분류',exact:true})).toHaveValue('');await expect(page.getByRole('combobox',{name:'메모 분류',exact:true}).locator('option')).toHaveCount(2);
 const reset=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts',db=await import(path);await db.resetDatabaseToDefault();return db.exportAllData();});expect(reset.noteFolders).toEqual([]);expect(reset.notes).toEqual([]);
});

for(const width of [320,390,430])test.describe(`작은 화면 메모 ${width}`,()=>{
 test.use({viewport:{width,height:700},hasTouch:true});
 test('서식 전체가 가려지지 않고 터치 서식과 하단 등록 버튼이 작동한다',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).tap();await page.getByRole('button',{name:'새 메모',exact:true}).tap();
  const toolbar=page.getByRole('toolbar',{name:'메모 글자 서식'}),body=page.getByRole('textbox',{name:'메모 본문',exact:true});
  const clipped=await toolbar.evaluate(el=>Array.from(el.querySelectorAll('button,select,input')).filter(control=>{const r=control.getBoundingClientRect(),p=el.getBoundingClientRect();return r.width>0&&(r.left<p.left||r.right>p.right);}).map(control=>control.getAttribute('aria-label')));expect(clipped).toEqual([]);
  await body.fill('터치로 서식 적용');await body.evaluate(el=>{el.focus();const selection=window.getSelection()!,range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);});
  await toolbar.getByRole('button',{name:'밑줄',exact:true}).tap();await expect(body.locator('u')).toHaveText('터치로 서식 적용');await expect(body).toBeFocused();
  const scrollingAllowed=await body.evaluate(el=>el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true})));expect(scrollingAllowed).toBe(true);
  await page.setViewportSize({width,height:430});
  const register=page.getByRole('button',{name:'할 일로 등록',exact:true});await register.scrollIntoViewIfNeeded();await expect(register).toBeInViewport();
  expect(await register.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`/workspace/shared/minially-notes/mobile-fixed-${width}.png`,fullPage:true});
 });
});
