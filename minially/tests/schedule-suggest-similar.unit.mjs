// 비슷하지만 다른 일정: 같은 낱말이 있어도 하는 일·사람이 다르면 제목·시간을 바꾸지 않는다. 같은 일정이면 예전 시간·장소·알림을 채운다.
import test from 'node:test'; import assert from 'node:assert/strict';
import { historyHint, rejectKey } from '../src/utils/scheduleSuggest.ts';
const cats = [{ id: 'hos', name: '병원' }, { id: 'kid', name: '아이' }, { id: 'work', name: '회사' }, { id: 'hobby', name: '취미' }];
const s = (title, date, category, extra = {}) => ({ id: `${title}${date}`, title, date, category, completed: false, ...extra });
const past = [
  s('치과 정기검진', '2026-09-10', 'hos', { startTime: '10:30', endTime: '11:00', memo: '장소: 밝은미소치과 2층', reminderMinutes: 60 }), s('치과 정기검진', '2026-06-10', 'hos', { startTime: '10:30', endTime: '11:00' }),
  s('아이 치과', '2026-10-02', 'kid'),
  s('피아노 레슨', '2026-11-03', 'hobby', { startTime: '16:00', endTime: '17:00' }), s('피아노 레슨', '2026-11-10', 'hobby', { startTime: '16:00', endTime: '17:00' }), s('피아노 레슨', '2026-11-17', 'hobby', { startTime: '16:00', endTime: '17:00' }),
  s('팀 회의', '2026-11-20', 'work'), s('팀 회의', '2026-11-13', 'work'),
];
const h = t => historyHint({ title: t }, past, cats);

test('하는 일이 다르면(교정·발치·연주회·조율) 제목을 바꾸지 않고, 카테고리만 비슷함으로 추천', () => {
  for (const [t, cat] of [['밝은미소치과 교정 상담', 'hos'], ['치과 사랑니 발치', 'hos'], ['피아노 연주회', 'hobby'], ['피아노 조율 방문', 'hobby']]) {
    const r = h(t);
    assert.deepEqual([r.category, r.match, r.habit, r.pastTitle, r.borrow], [cat, 'similar', false, '', undefined], t);
    assert.match(r.reason, /다른 일정일 수 있어요/);
  }
});
test('사람이 다르면 다른 일정: 아이 치과 검진은 아이 카테고리, 어른 치과 제목으로 바꾸지 않는다', () => {
  const r = h('아이 치과 검진');
  assert.equal(r.category, 'kid');
  assert.notEqual(r.pastTitle, '치과 정기검진');
});
test('낱말 끝이 같을 때만 같은 말: 회의실은 회의가 아니다', () => {
  const r = h('회의실 예약 확인');
  assert.equal(r.match, '');
  assert.equal(r.pastTitle, '');
});
test('같은 일정이면 예전 제목으로 맞추고 시작·끝·장소·알림을 채우고, 일정한 간격이면 반복을 제안', () => {
  const r = h('밝은미소치과 정기검진');
  assert.deepEqual([r.match, r.habit, r.pastTitle, r.category], ['same', true, '치과 정기검진', 'hos']);
  assert.deepEqual(r.borrow, { start: '10:30', end: '11:00', location: '밝은미소치과 2층', reminderMinutes: 60 });
  assert.deepEqual(h('피아노 레슨').cadence, { days: 7, label: '매주', weekday: 2 });
  assert.equal(h('치과 정기검진').cadence, undefined); // 두 번뿐이고 간격도 3달
});
test('사람이 원래대로 되돌린 제목 바꾸기는 다음부터 자동으로 하지 않는다', () => {
  const key = rejectKey('밝은미소치과 정기검진', '치과 정기검진');
  const r = historyHint({ title: '밝은미소치과 정기검진' }, past, cats, { rejected: [key] });
  assert.deepEqual([r.habit, r.pastTitle], [false, '치과 정기검진']); // 바꾸지 않고 버튼으로만
});
test('같은 날 거의 같은 일정이 이미 있으면 알려 준다(비슷하기만 하면 아님)', () => {
  assert.equal(historyHint({ title: '팀 회의', date: '2026-11-20' }, past, cats).duplicate, '팀 회의');
  assert.equal(historyHint({ title: '피아노 연주회', date: '2026-11-17' }, past, cats).duplicate, undefined);
});
