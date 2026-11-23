import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/sync.ts';
import {normalizeCode,sha256Hex} from '../functions/_lib.ts';
import {recommendNoteFolders} from '../src/utils/notes.ts';

const code='TESTCODE0000000';
const note={id:'note-1',title:'내 메모',body:'본문',folderId:'',tags:[],pinned:false,createdAt:1,updatedAt:1};
function fakeDB(){const writes=[];return {writes,prepare(sql){return {sql,bind(){return this;},async first(){return null;},async all(){return {results:[]};},async run(){return {};}};},async batch(statements){writes.push(...statements.map(statement=>statement.sql));return [];}};}
async function send(change,authorized=true){const db=fakeDB();const response=await onRequest({request:new Request('https://example.test/api/sync',{method:'POST',headers:{'content-type':'application/json',...(authorized?{authorization:'Bearer '+code}:{})},body:JSON.stringify({changes:[change]})}),env:{DB:db,SYNC_CODE_HASHES:await sha256Hex(normalizeCode(code))}});return {response,db};}
test('분류 근거가 없으면 강제로 분류하지 않고 키워드가 있는 분류만 추천한다',()=>{
 const folders=[{id:'work',name:'업무',keywords:['보고서','회의']},{id:'travel',name:'여행',keywords:['숙소']}];
 assert.deepEqual(recommendNoteFolders('아무 생각이나 적기',folders),[]);
 assert.deepEqual(recommendNoteFolders('숙소를 예약하고 여행 준비하기',folders).map(folder=>folder.id),['travel']);
});
test('로그인하지 않은 요청은 메모를 기록하지 못한다',async()=>{
 const {response,db}=await send({store:'notes',id:note.id,data:note},false);assert.equal(response.status,401);assert.equal(db.writes.some(sql=>sql.startsWith('INSERT INTO sync_records')),false);
});
test('정상 메모와 분류는 기존 로그인 공간 안에서 동기화한다',async()=>{
 for(const change of [{store:'notes',id:note.id,data:note},{store:'noteFolders',id:'folder-1',data:{id:'folder-1',name:'분류',keywords:['키워드']}}]){const {response,db}=await send(change);assert.equal(response.status,200);assert.ok(db.writes.some(sql=>sql.startsWith('INSERT INTO sync_records')));}
});
test('잘못된 내용·ID 불일치·용량 초과는 서버에서 저장 전에 거부한다',async()=>{
 for(const data of [{...note,body:7},{...note,id:'other'},{...note,body:'가'.repeat(50000)}]){const {response,db}=await send({store:'notes',id:note.id,data});assert.equal(response.status,400);assert.equal(db.writes.some(sql=>sql.startsWith('INSERT INTO sync_records')),false);}
});

test('폴더 기본 카테고리의 잘못된 형식은 서버에서 거부한다',async()=>{
 const {response,db}=await send({store:'noteFolders',id:'folder-1',data:{id:'folder-1',name:'폴더',keywords:[],defaultCategoryId:7}});assert.equal(response.status,400);assert.equal(db.writes.some(sql=>sql.startsWith('INSERT INTO sync_records')),false);
});

test('서식과 일반 본문이 일치해야 하며 임의의 HTML 속성을 저장하지 않는다',async()=>{
 for(const richBody of [[{text:'다른 내용',underline:true}],[{text:note.body,underline:'true'}],[{text:note.body,onclick:'alert(1)'}]]){const {response}=await send({store:'notes',id:note.id,data:{...note,richBody}});assert.equal(response.status,400);}
 const {response}=await send({store:'notes',id:note.id,data:{...note,richBody:[{text:note.body,underline:true,strike:true}]}});assert.equal(response.status,200);
});

test('표 문서와 일반 본문이 일치해야 하며 실행 속성과 비정상 표를 거부한다',async()=>{
 const valid={type:'table',rows:[[{runs:[{text:note.body,fontSize:24,script:'super'}]}]]};
 const {response}=await send({store:'notes',id:note.id,data:{...note,richDocument:[valid]}});assert.equal(response.status,200);
 for(const document of [[{...valid,onclick:'alert(1)'}],[{type:'paragraph',runs:[{text:note.body,color:'url(evil)'}]}],[{type:'table',rows:[]}],[{type:'table',rows:[[{runs:[{text:'불일치'}]}]]}],[{type:'paragraph',runs:[{text:note.body,fontSize:1000}]}]]){const {response}=await send({store:'notes',id:note.id,data:{...note,richDocument:document}});assert.equal(response.status,400);}
});

test('자동 폴더만 숨기고 쓰거나 설정한 폴더와 사용자가 만든 폴더는 유지한다',async()=>{
 const {LEGACY_NOTE_FOLDERS,visibleNoteFolders,validateNoteFolder}=await import('../src/utils/notes.ts');
 const seed=LEGACY_NOTE_FOLDERS[0];assert.deepEqual(visibleNoteFolders(LEGACY_NOTE_FOLDERS,[]),[]);
 for(const folder of [{...seed,name:'내 이름'},{...seed,keywords:['내 키워드']},{...seed,defaultCategoryId:'category'},{...seed,isUserManaged:true},{id:'custom',name:'업무',keywords:[]}])assert.deepEqual(visibleNoteFolders([folder],[]),[folder]);
 for(const deletedAt of [undefined,1])assert.deepEqual(visibleNoteFolders([seed],[{...note,folderId:seed.id,deletedAt}]),[seed]);
 assert.throws(()=>validateNoteFolder({...seed,isUserManaged:'yes'}));
});

test('직접 분류한 메모의 서로 다른 어휘 둘 이상이 겹치면 폴더를 추천한다',()=>{
 const folders=[{id:'a',name:'A',keywords:[]},{id:'b',name:'B',keywords:[]}];
 const notes=[{...note,folderId:'a',body:'항공권 여권 숙소 예약'},{...note,id:'n2',folderId:'b',body:'보고서 회의 예약'}];
 assert.deepEqual(recommendNoteFolders('여권 항공권 준비',folders,notes).map(folder=>folder.id),['a']);
 assert.deepEqual(recommendNoteFolders('예약 준비',folders,notes),[]);
 assert.deepEqual(recommendNoteFolders('여권 준비',folders,notes),[]);
 assert.deepEqual(recommendNoteFolders('여권 항공권 준비',folders,notes.map(n=>({...n,deletedAt:1}))),[]);
});
test('사용자가 직접 지정한 한 글자 키워드도 추천에 쓴다',()=>{
 assert.deepEqual(recommendNoteFolders('책 읽기', [{id:'read',name:'독서',keywords:['책']}]).map(folder=>folder.id),['read']);
});

test('메모 기본값과 메모별 서식은 서버에서도 검증하고 지원 글꼴을 보존한다',async()=>{
 const style={fontFamily:'궁서',fontSize:18,lineHeight:1.8,color:'#7030a0',highlight:'#fff2a8'};
 for(const change of [{store:'appSettings',id:'global_settings',data:{id:'global_settings',noteDefaults:style}},{store:'notes',id:note.id,data:{...note,defaultStyle:style,richBody:[{text:note.body,fontFamily:'바탕'}]}}])assert.equal((await send(change)).response.status,200);
 for(const change of [{store:'appSettings',id:'global_settings',data:{id:'global_settings',noteDefaults:{...style,color:'url(evil)'}}},{store:'notes',id:note.id,data:{...note,defaultStyle:{...style,fontSize:1000}}}]){const {response,db}=await send(change);assert.equal(response.status,400);assert.equal(db.writes.some(sql=>sql.startsWith('INSERT INTO sync_records')),false);}
});
