import {test,expect} from '@playwright/test';
import {CODE_NOTES} from '../playwright.sync.config';
import {device,login,syncNow,put} from './helpers';

// 메모 사진은 실제 서버로 다른 기기에 동기화되고, 다른 기기에서 바뀐 메모는 바뀌기 전 내용이 그 기기의 수정 기록에 남는다.
const PHOTO='99999999-8888-7777-6666-555555555555';
// 4x4 빨간 JPEG(작은 실제 이미지)
const JPEG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwn/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

test('메모 사진이 다른 기기로 동기화되고, 받은 변경은 수정 기록에 남는다',async({browser})=>{
 const pc=await device(browser),phone=await device(browser,400);await login(pc,CODE_NOTES);await login(phone,CODE_NOTES);
 const note={id:'photo-sync-note',title:'사진 동기화',body:'사진 앞\n[사진]',richDocument:[{type:'paragraph',runs:[{text:'사진 앞'}]},{type:'image',photoId:PHOTO}],folderId:'',tags:[],pinned:false,createdAt:1,updatedAt:5};
 await put(pc,{notes:[note],notePhotos:[{id:PHOTO,noteId:note.id,dataUrl:JPEG,width:4,height:4,createdAt:5,updatedAt:5}]});await syncNow(pc);
 await syncNow(phone);await phone.reload();
 await phone.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await phone.locator('[data-note-id="photo-sync-note"]').click();
 await expect.poll(()=>phone.locator('figure.note-photo img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(4);
 // PC에서 고친 내용을 폰이 받으면, 폰의 수정 기록에 받기 전 내용이 남는다
 await put(pc,{notes:[{...note,body:'PC에서 고친 본문',richDocument:[{type:'paragraph',runs:[{text:'PC에서 고친 본문'}]}],updatedAt:9}]});await syncNow(pc);await syncNow(phone);
 await expect(phone.getByRole('textbox',{name:'메모 본문',exact:true})).toHaveText('PC에서 고친 본문');
 const versions=await phone.evaluate(async()=>{const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('DayFlowDB');q.onsuccess=()=>r(q.result);});const all=await new Promise<{noteId:string;reason:string;savedAt:number;note:{body:string}}[]>(r=>{const q=db.transaction('noteVersions').objectStore('noteVersions').getAll();q.onsuccess=()=>r(q.result);});db.close();return all.filter(v=>v.noteId==='photo-sync-note').sort((a,b)=>b.savedAt-a.savedAt).map(v=>`${v.reason}:${v.note.body}`);});
 expect(versions[0]).toBe('sync:사진 앞\n[사진]');
 await pc.context().close();await phone.context().close();
});
