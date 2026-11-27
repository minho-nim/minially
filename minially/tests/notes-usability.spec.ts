import {test,expect} from '@playwright/test';
for(const width of [400,1400])test.describe(`메모 사용 흐름 ${width}`,()=>{
 test.use({viewport:{width,height:900},hasTouch:true});
 test('검색 중 새 메모를 만들어도 목록에 보이고 날짜 없이 등록되지 않는다',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();
  await page.getByRole('searchbox',{name:'메모 검색',exact:true}).fill('없는 검색어');await page.getByRole('button',{name:'새 메모',exact:true}).click();
  const body=page.getByRole('textbox',{name:'메모 본문',exact:true});await body.fill('이 메모를 할 일로 보내기');
  await page.getByLabel('등록 날짜',{exact:true}).fill('');await expect(page.getByRole('button',{name:'일정으로 등록',exact:true})).toBeDisabled();
  if(width<768)await page.getByRole('button',{name:'메모 목록으로',exact:true}).click();await expect(page.getByRole('searchbox',{name:'메모 검색',exact:true})).toHaveValue('');await expect(page.locator('[data-note-id]')).toHaveCount(1);
 });
 test('메모 검색 단축키·검색 지우기·할 일 등록 후 바로 열기',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();await page.getByRole('textbox',{name:'메모 본문',exact:true}).fill('연결을 확인하기');
  await page.getByRole('button',{name:'할 일로 등록',exact:true}).click();await page.getByRole('dialog',{name:'메모에서 할 일 등록',exact:true}).getByRole('button',{name:'등록',exact:true}).click();await page.getByRole('button',{name:'등록한 할 일 보기',exact:true}).click();await expect(page.locator('[data-task-id]')).toContainText('연결을 확인하기');
  await page.getByRole('button',{name:'원본 메모',exact:true}).click();await page.getByRole('textbox',{name:'메모 본문',exact:true}).focus();await page.keyboard.press('Control+f');
  const search=page.getByRole('searchbox',{name:'메모 검색',exact:true});await expect(search).toBeVisible();await expect(search).toBeFocused();await expect(page.getByRole('dialog',{name:'일정 검색',exact:true})).toHaveCount(0);
  await search.fill('없는 검색어');await page.getByRole('button',{name:'메모 검색 지우기',exact:true}).tap();await expect(search).toHaveValue('');await expect(page.locator('[data-note-id]')).toHaveCount(1);
  await search.blur();await page.keyboard.press('n');await expect(page.getByRole('textbox',{name:'메모 제목',exact:true})).toBeFocused();await expect(page.getByRole('dialog',{name:'새 일정',exact:true})).toHaveCount(0);
 });
});


test('메모 저장이 실패하면 새 메모로 이동하지 않고 재시도 후 원문을 보존한다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();
 await page.getByRole('article',{name:'메모 편집기'}).getByRole('textbox',{name:'메모 본문',exact:true}).waitFor();
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).restoreNotePut=()=>{IDBObjectStore.prototype.put=original;};IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='notes')throw new Error('메모 저장 시험 실패');return original.apply(this,args);};});
 const editor=page.getByRole('article',{name:'메모 편집기'}),body=editor.getByRole('textbox',{name:'메모 본문',exact:true});await body.fill('잃어버리면 안 되는 메모');await expect(editor.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장 실패');await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await expect(body).toHaveText('잃어버리면 안 되는 메모');await expect(editor.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장 실패');await editor.getByRole('button',{name:'새 메모 작성',exact:true}).click();await expect(body).toHaveText('잃어버리면 안 되는 메모');await expect(editor.getByRole('alert')).toContainText('메모 저장 시험 실패');
 await page.evaluate(()=>(window as any).restoreNotePut());await editor.getByRole('button',{name:'다시 저장',exact:true}).click();await expect(editor.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');await editor.getByRole('button',{name:'새 메모 작성',exact:true}).click();await expect(body).toHaveText('');
 const saved=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return (await import(path)).getAllNotes();});expect(saved).toHaveLength(2);expect(saved.some((note:{body:string})=>note.body==='잃어버리면 안 되는 메모')).toBe(true);
});

test('저장 실패 중 다른 메모를 선택해도 작성 내용이 사라지지 않는다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();const body=page.getByRole('textbox',{name:'메모 본문',exact:true});await body.fill('첫 번째 메모');await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');await page.getByRole('button',{name:'새 메모 작성',exact:true}).click();await expect(page.locator('[data-note-id]')).toHaveCount(2);await expect(body).toHaveText('');await body.fill('두 번째 메모');await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).restoreNotePut=()=>{IDBObjectStore.prototype.put=original;};IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='notes')throw new Error('메모 저장 시험 실패');return original.apply(this,args);};});await body.fill('두 번째 메모의 아직 저장하지 못한 생각');await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장 실패');
 await page.locator('[data-note-id]').filter({hasText:'첫 번째 메모'}).click();await expect(body).toHaveText('두 번째 메모의 아직 저장하지 못한 생각');await page.evaluate(()=>(window as any).restoreNotePut());await page.getByRole('button',{name:'다시 저장',exact:true}).click();await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');await page.locator('[data-note-id]').filter({hasText:'첫 번째 메모'}).click();await expect(body).toHaveText('첫 번째 메모');
});


test('모바일 검색에서 저장 실패한 메모로 돌아가 재시도할 수 있다',async({page})=>{
 await page.setViewportSize({width:400,height:900});await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();const body=page.getByRole('textbox',{name:'메모 본문',exact:true});await body.fill('작성해 둔 메모');await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).restoreNotePut=()=>{IDBObjectStore.prototype.put=original;};IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='notes')throw new Error('메모 저장 시험 실패');return original.apply(this,args);};});await body.fill('지켜야 할 변경 사항');await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장 실패');await body.focus();await page.keyboard.press('Control+f');await expect(page.getByRole('searchbox',{name:'메모 검색',exact:true})).toBeVisible();await page.locator('[data-note-id]').click();await expect(body).toBeVisible();await expect(body).toHaveText('지켜야 할 변경 사항');await page.evaluate(()=>(window as any).restoreNotePut());await page.getByRole('button',{name:'다시 저장',exact:true}).click();await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');
});
