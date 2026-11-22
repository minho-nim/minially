import {test,expect,type Page} from '@playwright/test';
import type {AppData} from '../src/types';
async function data(page:Page):Promise<AppData>{return page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return(await import(path)).exportAllData();});}
for(const width of [400,1400])test.describe(`메모장 ${width}px`,()=>{
 test.use({viewport:{width,height:900}});
 test('독립 메모 자동 저장·분류·기존 할 일과 일정 연결·복원',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
  await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';await(await import(path)).saveNoteFolder({id:'notes-travel',name:'여행',keywords:['여행','숙소','준비물']});});await page.reload();
  await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();
  const workspace=page.getByRole('region',{name:'메모장'});
  await page.getByRole('button',{name:'새 메모',exact:true}).click();await page.getByRole('textbox',{name:'메모 본문',exact:true}).fill('여행 준비물 챙기고 숙소 확인하기');await page.getByRole('button',{name:'#여행',exact:true}).click();
  const editor=page.getByRole('article',{name:'메모 편집기'});await expect(editor).toBeVisible();await expect(editor.getByLabel('메모 분류',{exact:true})).toHaveValue('notes-travel');
  await editor.getByRole('textbox',{name:'메모 제목',exact:true}).fill('여행 준비');await editor.getByRole('textbox',{name:'메모 본문',exact:true}).fill('여행 준비물\n여권과 숙소 예약을 확인하기');await expect(editor.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');
  await editor.getByRole('button',{name:'메모 고정',exact:true}).click();await expect(editor.getByRole('button',{name:'메모 고정 해제',exact:true})).toBeVisible();
  await editor.getByRole('button',{name:'할 일로 등록',exact:true}).click();await expect(editor.getByRole('button',{name:'할 일 등록됨',exact:true})).toBeDisabled();
  let saved=await data(page);expect(saved.notes).toHaveLength(1);expect(saved.tasks).toHaveLength(1);expect(saved.tasks[0]).toMatchObject({title:'여행 준비',memo:'여행 준비물\n여권과 숙소 예약을 확인하기',sourceNoteId:saved.notes![0].id});
  await editor.getByRole('button',{name:'일정으로 등록',exact:true}).click();const schedule=page.getByRole('dialog',{name:'새 일정',exact:true});await expect(schedule.getByRole('textbox',{name:'일정 제목',exact:true})).toHaveValue('여행 준비');await schedule.getByRole('button',{name:'등록',exact:true}).click();await expect(schedule).toHaveCount(0);
  saved=await data(page);expect(saved.schedules).toHaveLength(1);expect(saved.schedules[0]).toMatchObject({title:'여행 준비',memo:saved.notes![0].body,sourceNoteId:saved.notes![0].id});expect(saved.notes).toHaveLength(1);
  await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).click();await expect(page.locator('[data-task-id]')).toContainText('여행 준비');await page.getByRole('button',{name:'원본 메모',exact:true}).click();await expect(editor.getByRole('textbox',{name:'메모 제목',exact:true})).toHaveValue('여행 준비');
  await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.locator('[data-note-id]').click();await expect(editor.getByRole('textbox',{name:'메모 본문',exact:true})).toHaveText(saved.notes![0].body,{useInnerText:true});
  await editor.getByRole('button',{name:'메모 휴지통으로',exact:true}).click();await expect(editor.getByRole('textbox',{name:'메모 본문',exact:true})).toHaveAttribute('aria-readonly','true');await editor.getByRole('button',{name:'메모 복원',exact:true}).click();await expect.poll(async()=>!!(await data(page)).notes![0].deletedAt).toBe(false);
  if(width<768)await editor.getByRole('button',{name:'메모 목록으로',exact:true}).click();
  expect(await workspace.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/notes-${width}.png`,fullPage:true});expect(errors).toEqual([]);
 });
 test('사용자 분류 키워드 추천·검색·백업 호환성·잘못된 복원 보호',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();
  await page.getByRole('button',{name:'분류 추가',exact:true}).click();await page.getByRole('textbox',{name:'분류 이름',exact:true}).fill('독서 기록');await page.getByRole('textbox',{name:'추천 키워드',exact:true}).fill('독후감, 책읽기');await page.getByRole('button',{name:'분류 저장',exact:true}).click();
  await page.getByRole('button',{name:'새 메모',exact:true}).click();await page.getByRole('textbox',{name:'메모 본문',exact:true}).fill('오늘 책읽기 끝나고 독후감 쓰기');await page.getByRole('button',{name:'#독서 기록',exact:true}).click();await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');
  const before=await data(page);expect(before.notes).toHaveLength(1);expect(before.noteFolders?.find(folder=>folder.id===before.notes![0].folderId)?.name).toBe('독서 기록');
  const result=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts',db=await import(path),backup=await db.exportAllData();await db.importAllData({tasks:[]});const compatible=await db.exportAllData();let rejected=false;try{await db.importAllData({notes:[{id:'bad',body:7}]});}catch{rejected=true;}await db.importAllData({notes:[],noteFolders:[]});await db.importAllData(backup);return {compatible,rejected,restored:await db.exportAllData()};});
  expect(result.compatible.notes).toEqual(before.notes);expect(result.rejected).toBe(true);expect(result.restored.notes).toEqual(before.notes);expect(result.restored.noteFolders).toEqual(before.noteFolders);
  await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('searchbox',{name:'메모 검색',exact:true}).fill('없는 검색어');await expect(page.locator('[data-note-id]')).toHaveCount(0);await page.getByRole('searchbox',{name:'메모 검색',exact:true}).fill('독후감');await expect(page.locator('[data-note-id]')).toHaveCount(1);
 });
});

test('이전 DB를 올려도 일정과 할 일이 유지된다',async({page})=>{
 await page.goto('/icon.svg');await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('DayFlowDB',1);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('schedules',{keyPath:'id'}).put({id:'old-s',title:'기존 일정',date:'2026-11-21',category:'',completed:false});db.createObjectStore('tasks',{keyPath:'id'}).put({id:'old-t',title:'기존 할 일',status:'todo',priority:'medium'});};request.onerror=()=>reject(request.error);request.onsuccess=()=>{request.result.close();resolve();};}));
 await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();const saved=await data(page);expect(saved.schedules.find(schedule=>schedule.id==='old-s')?.title).toBe('기존 일정');expect(saved.tasks.find(task=>task.id==='old-t')?.title).toBe('기존 할 일');expect(saved.notes).toEqual([]);expect(saved.noteFolders).toEqual([]);
});

test('메모와 분류가 동기화 요청에 포함되고 다른 기기 메모를 받는다',async({page})=>{
 const outgoing:string[]=[];const remote={id:'remote-note',title:'다른 PC 메모',body:'동기화된 본문',folderId:'',tags:[],pinned:false,createdAt:1,updatedAt:1};
 await page.addInitScript(()=>localStorage.setItem('minially-sync-v1',JSON.stringify({code:'TESTCODE0000000',lastSeq:0,shadow:{}})));
 await page.route('**/api/sync?*',async route=>{const payload=route.request().method()==='POST'?route.request().postDataJSON():null;if(payload)outgoing.push(...payload.changes.map((change:{store:string})=>change.store));await route.fulfill({json:{seq:1,records:[...(payload?.changes||[]),{store:'notes',id:remote.id,data:remote}]}});});
 await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await expect(page.locator('[data-note-id="remote-note"]')).toBeVisible();
 await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';await(await import(path)).saveNoteFolder({id:'my-sync-folder',name:'직접 만든 폴더',keywords:[]});});
 await page.getByRole('button',{name:'새 메모',exact:true}).click();await page.getByRole('textbox',{name:'메모 본문',exact:true}).fill('내 기기의 메모');await expect.poll(()=>outgoing).toContain('notes');expect(outgoing).toContain('noteFolders');
 const saved=await data(page);expect(saved.notes?.map(note=>note.body)).toEqual(expect.arrayContaining(['동기화된 본문','내 기기의 메모']));
});

test('동시에 할 일로 등록해도 중복되지 않고 완료 상태를 보존한다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
 const result=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts',db=await import(path),note={id:'atomic-note',title:'동시 등록',body:'본문',folderId:'',tags:[],pinned:false,createdAt:1,updatedAt:1};await Promise.all([db.saveNoteTask(note,'2026-11-21'),db.saveNoteTask(note,'2026-11-21')]);const first=await db.getAllTasks();await db.saveTask({...first[0],status:'done',memo:'수정한 할 일 메모'});await db.saveNoteTask(note,'2026-11-21');return db.getAllTasks();});
 expect(result).toHaveLength(1);expect(result[0]).toMatchObject({status:'done',memo:'수정한 할 일 메모'});
});

test('이전 창이 DB를 열어 두면 업데이트 안내를 보이고 닫힌 뒤 데이터를 보존해 열린다',async({page})=>{
 await page.goto('/icon.svg');await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('DayFlowDB',1);request.onupgradeneeded=()=>request.result.createObjectStore('schedules',{keyPath:'id'}).put({id:'kept',title:'보존할 일정',date:'2026-11-22',category:'',completed:false});request.onsuccess=()=>{(window as any).heldDB=request.result;resolve();};request.onerror=()=>reject(request.error);}));
 const updating=await page.context().newPage();await updating.goto('/');await expect(updating.getByRole('alert')).toContainText('열려 있는 다른 미니어리 창');await page.evaluate(()=>(window as any).heldDB.close());await expect(updating.getByRole('button',{name:'일정 등록',exact:true})).toBeVisible();expect((await data(updating)).schedules.some(schedule=>schedule.id==='kept')).toBe(true);await updating.close();
});
