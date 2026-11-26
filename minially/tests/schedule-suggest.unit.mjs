import test from 'node:test';import assert from 'node:assert/strict';
import {historyHint,words} from '../src/utils/scheduleSuggest.ts';
const cats=[{id:'health',name:'병원',color:'#000'},{id:'work',name:'업무',color:'#111'},{id:'meet',name:'약속',color:'#222'}];
const s=(id,title,date,category)=>({id,title,date,category,completed:false});
test('낱말: 조사·흔한 안내 말·숫자는 빼고 2글자 이상만',()=>{
 assert.deepEqual(words('치과는 오후 3시 진료 예약 2026'),['치과','진료']);
});
test('예전 일정과 같은 낱말이면 그 일정의 카테고리를 고르고 이유를 알려 준다(밝은미소치과 ↔ 치과)',()=>{
 const h=historyHint({title:'밝은미소치과 진료'},[s('a','치과 정기 검진','2026-10-01','health'),s('b','팀 회의','2026-10-02','work')],cats);
 assert.equal(h.category,'health');assert.match(h.reason,/치과 정기 검진/);
 assert.equal(h.pastTitle,'치과 정기 검진');assert.equal(h.habit,false); // 한 번만 쓴 제목은 바꾸지 않고 제안만
});
test('같은 제목을 두 번 이상 썼으면 습관으로 보고 그 제목으로 맞춘다',()=>{
 const list=[s('a','케이블공사 현장','2026-09-01','work'),s('b','케이블공사 현장','2026-10-01','work'),s('c','점심 약속','2026-10-03','meet')];
 const h=historyHint({title:'ATDT센터 케이블공사(투자) 단가계약'},list,cats);
 assert.deepEqual([h.category,h.pastTitle,h.habit],['work','케이블공사 현장',true]);
});
test('비슷한 일정이 없으면 카테고리 이름·주제 낱말로, 비기면 고르지 않는다',()=>{
 assert.equal(historyHint({title:'친구랑 저녁 약속'},[],cats).category,'meet');
 assert.equal(historyHint({title:'현장 실사'},[],cats).category,'');
 // 두 카테고리가 같은 점수면 고르지 않음
 assert.equal(historyHint({title:'정리'},[s('a','정리 업무','2026-10-01','work'),s('b','정리 약속','2026-10-01','meet')],cats).category,'');
 // 없는 카테고리를 가리키는 예전 일정은 무시
 assert.equal(historyHint({title:'가나다라'},[s('a','가나다라','2026-10-01','gone')],cats).category,'');
});
