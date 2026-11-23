import test from 'node:test';import assert from 'node:assert/strict';
import {scheduleReminderWindow} from '../src/utils/scheduleReminders.ts';
const base={id:'event',title:'회의',date:'2026-11-23',startTime:'09:00',category:'',completed:false};
test('개별 알림은 공통 설정을 바꾸지 않고 우선하며 끄기·종일·완료를 무시한다',()=>{
 const enabled={enabled:true,minutesBefore:10},disabled={enabled:false,minutesBefore:10},start=new Date(2026,10,23,9).getTime();
 assert.equal(scheduleReminderWindow(base,enabled).at,start-10*60_000);assert.equal(scheduleReminderWindow(base,disabled),null);
 assert.equal(scheduleReminderWindow({...base,reminderMinutes:30},disabled).at,start-30*60_000);assert.equal(scheduleReminderWindow({...base,reminderMinutes:0},enabled).at,start);
 for(const patch of [{reminderMinutes:null},{startTime:''},{completed:true},{reminderMinutes:-1},{reminderMinutes:NaN},{reminderMinutes:1500},{date:'2026-02-30'},{startTime:'25:00'}])assert.equal(scheduleReminderWindow({...base,...patch},enabled),null);
 assert.deepEqual(enabled,{enabled:true,minutesBefore:10});
});
test('자정을 넘는 사전 알림도 실제 일정 날짜를 기준으로 계산한다',()=>{const result=scheduleReminderWindow({...base,date:'2026-11-24',startTime:'00:10',reminderMinutes:30},undefined);assert.equal(result.at,new Date(2026,10,23,23,40).getTime());});
