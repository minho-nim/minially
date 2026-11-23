import {test,expect} from '@playwright/test';
test('같은 기기의 두 창이 오래된 메모를 저장해도 먼저 쓴 내용을 사본으로 보존한다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();const saved=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts',db=await import(path),base={id:'two-window-note',title:'두 창의 메모',body:'처음',folderId:'',tags:[],pinned:false,createdAt:1,updatedAt:1};await db.saveNote(base);await db.saveNote({...base,body:'메인 창 내용',updatedAt:2},1);await db.saveNote({...base,body:'빠른 창 내용',updatedAt:3},1);return db.getAllNotes();});expect(saved.map((note:{body:string})=>note.body).sort()).toEqual(['메인 창 내용','빠른 창 내용'].sort());
});

test('같은 기기의 두 창은 동기화 요청을 동시에 보내지 않는다',async({page,context})=>{
 let active=0,max=0;await context.route('**/api/sync?*',async route=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,120));await route.fulfill({json:{seq:1,records:[]}});active--;});
 await page.addInitScript(()=>localStorage.setItem('minially-sync-v1',JSON.stringify({code:'TESTCODE123456',schemaVersion:3,lastSeq:0,shadow:{}})));await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();const other=await context.newPage();await other.goto('/');await other.getByRole('button',{name:'일정 등록',exact:true}).waitFor();await expect.poll(()=>active).toBe(0);
 const sync=(target:typeof page)=>target.evaluate(async()=>{const path='/src/sync/syncEngine.ts';await(await import(path)).syncEngine.syncNow();});await Promise.all([sync(page),sync(other)]);expect(max).toBe(1);await other.close();
});
