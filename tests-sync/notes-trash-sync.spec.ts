import {test,expect} from '@playwright/test';
import {CODE_CONFLICT,CODE_B} from '../playwright.sync.config';
import {device,login,put,syncNow} from './helpers';
async function ids(page:any){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open('DayFlowDB');request.onsuccess=()=>resolve(request.result);});const notes=await new Promise<{id:string}[]>(resolve=>{const request=db.transaction('notes').objectStore('notes').getAll();request.onsuccess=()=>resolve(request.result);});db.close();return notes.map(note=>note.id).filter(id=>id.startsWith('empty-trash-')).sort();});}
test('오프라인 휴지통 비우기는 다른 기기에도 반영되고 다른 연결 코드의 같은 ID는 유지한다',async({browser,request})=>{
 const pc=await device(browser),phone=await device(browser,400),other=await device(browser);
 await login(pc,CODE_CONFLICT);await login(phone,CODE_CONFLICT);await login(other,CODE_B);
 const base={title:'휴지통 동기화',body:'본문',folderId:'',tags:[],pinned:false,createdAt:1,updatedAt:2};
 const notes=[{...base,id:'empty-trash-a',deletedAt:2},{...base,id:'empty-trash-b',deletedAt:2},{...base,id:'empty-trash-keep'}];await put(pc,{notes});await syncNow(pc);await pc.reload();await syncNow(phone);await put(other,{notes:notes.map(note=>({...note,deletedAt:undefined,body:'다른 연결 코드의 메모'}))});await syncNow(other);
 expect(await ids(phone)).toHaveLength(3);await pc.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await pc.getByRole('complementary',{name:'메모 분류'}).getByRole('button',{name:/휴지통/}).click();await pc.context().setOffline(true);await pc.getByRole('button',{name:'휴지통 비우기',exact:true}).click();await pc.getByRole('dialog',{name:'메모 휴지통 비우기 확인'}).getByRole('button',{name:'영구 삭제',exact:true}).click();await expect.poll(()=>ids(pc)).toEqual(['empty-trash-keep']);
 await pc.context().setOffline(false);await syncNow(pc);await syncNow(phone);await syncNow(other);expect(await ids(phone)).toEqual(['empty-trash-keep']);expect(await ids(other)).toHaveLength(3);
 const response=await request.get('/api/sync?since=0',{headers:{authorization:'Bearer '+CODE_CONFLICT}});expect(response.ok()).toBe(true);const data=await response.json();for(const id of ['empty-trash-a','empty-trash-b'])expect(data.records.find((record:any)=>record.id===id).data).toBeNull();
 await pc.reload();expect(await ids(pc)).toEqual(['empty-trash-keep']);await Promise.all([pc.context().close(),phone.context().close(),other.context().close()]);
});
