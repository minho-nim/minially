import {test,expect} from '@playwright/test';
import {CODE_CONFLICT} from '../playwright.sync.config';
const base={id:'conflict-note',title:'업무 메모',body:'처음 내용',folderId:'',tags:[],pinned:false,createdAt:1,updatedAt:1};
test('동시 수정은 원본과 충돌 사본을 원자적으로 보존하고 재요청은 사본을 중복 생성하지 않는다',async({request})=>{
 const headers={authorization:'Bearer '+CODE_CONFLICT},pull=async()=>{const r=await request.get('/api/sync?since=0',{headers});expect(r.ok()).toBe(true);return r.json();};
 const post=async(data:unknown,baseSeq:number,since=baseSeq)=>{const r=await request.post('/api/sync',{headers,data:{since,changes:[{store:'notes',id:base.id,data,baseSeq}]}});expect(r.ok()).toBe(true);return r.json();};
 const first=await post(base,0),revision=first.records.find((r:{id:string})=>r.id===base.id).seq;
 await Promise.all([post({...base,body:'회사 PC 수정',updatedAt:2},revision),post({...base,body:'집 PC 수정',updatedAt:3},revision)]);
 const all=await pull(),notes=all.records.filter((r:{store:string;data:unknown})=>r.store==='notes'&&r.data).map((r:{data:any})=>r.data);expect(notes).toHaveLength(2);expect(notes.map((n:{body:string})=>n.body).sort()).toEqual(['집 PC 수정','회사 PC 수정'].sort());expect(notes.find((n:{id:string})=>n.id!==base.id).conflictOf).toBe(base.id);
 const latest=notes.find((n:{id:string})=>n.id===base.id);await post(latest,revision);const retried=await pull();expect(retried.records.filter((r:{store:string;data:unknown})=>r.store==='notes'&&r.data)).toHaveLength(2);
 await post(null,revision);const removed=await pull();expect(removed.records.find((r:{id:string})=>r.id===base.id).data).toBeNull();expect(removed.records.filter((r:{data:any})=>r.data?.conflictOf===base.id)).toHaveLength(2);
});
