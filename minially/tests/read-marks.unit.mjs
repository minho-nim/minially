import test from 'node:test';import assert from 'node:assert/strict';
import {readMarks} from '../src/utils/readMarks.ts';
import {parseScheduleText} from '../src/utils/textSchedule.ts';
const T='2026-11-26';
const kinds=parts=>parts.filter(p=>p.kind).map(p=>[p.kind,p.text]);
test('원문에서 날짜·시간·장소·제목으로 읽은 곳을 색 구간으로 나누고, 글자는 하나도 빼거나 바꾸지 않는다',()=>{
 const src='[밝은미소치과] 12월 9일 오후 3시 교정 상담 예약되었습니다. 장소: 본관 2층';
 const [e]=parseScheduleText(src,T);
 const parts=readMarks(src,e);
 assert.equal(parts.map(p=>p.text).join(''),src);
 const got=kinds(parts);
 assert.deepEqual(got.find(k=>k[0]==='date'),['date','12월 9일']);
 assert.deepEqual(got.find(k=>k[0]==='time'),['time','오후 3시']);
 assert.deepEqual(got.find(k=>k[0]==='place'),['place','본관 2층']);
 assert.ok(got.some(k=>k[0]==='title'&&/밝은미소치과|교정|상담/.test(k[1])));
});
test('내일·14:00~15:00·두 시 반 같은 말도 표시하고, "세 시간"은 시간으로 칠하지 않는다',()=>{
 assert.deepEqual(kinds(readMarks('내일 14:00~15:00 팀 회의',{title:'팀 회의'})),[['date','내일'],['time','14:00~15:00'],['title','팀 회의']]);
 assert.deepEqual(kinds(readMarks('금요일 두 시 반에 만나요',{title:'만남'})).slice(0,2),[['date','금요일'],['time','두 시 반']]);
 assert.equal(kinds(readMarks('세 시간 걸려요',{title:''})).length,0);
});
