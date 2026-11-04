import test from 'node:test';
import assert from 'node:assert/strict';
import { taskFromSchedule, calendarTaskId, hasCalendarTask, calendarSchedulesForDate } from '../src/utils/calendarTasks.ts';
import { resolveCategoryColor, CATEGORY_PALETTE } from '../src/utils/categories.ts';

test('category saves an explicitly selected color for both new and existing records', () => {
  assert.equal(resolveCategoryColor('#123abc', undefined, []), '#123abc');
  assert.equal(resolveCategoryColor('#AABBCC', '#CF8FA8', []), '#AABBCC');
});
test('invalid or missing category colors preserve the previous color or use a default', () => {
  assert.equal(resolveCategoryColor('invalid', '#CF8FA8', []), '#CF8FA8');
  assert.equal(resolveCategoryColor('', undefined, []), CATEGORY_PALETTE[0].color);
});
test('calendar task keeps the source schedule and copies date, memo, importance and link', () => {
  const schedule = { id: 'schedule-1', date: '2026-11-04', title: '오늘 약속', category: '', completed: true, isImportant: true, memo: '준비물' };
  const before = structuredClone(schedule);
  const task = taskFromSchedule(schedule);
  assert.equal(task.title, schedule.title);
  assert.equal(task.dueDate, schedule.date);
  assert.equal(task.memo, schedule.memo);
  assert.equal(task.priority, 'high');
  assert.equal(task.status, 'todo');
  assert.equal(task.linkedScheduleId, schedule.id);
  assert.deepEqual(schedule, before);
});
test('calendar task identity is stable per occurrence and separates dates', () => {
  const schedule = { id: 'repeat-1', date: '2026-11-04', title: '반복', category: '', completed: false };
  assert.equal(taskFromSchedule(schedule).id, calendarTaskId(schedule));
  assert.equal(taskFromSchedule(schedule).id, taskFromSchedule(schedule).id);
  assert.notEqual(calendarTaskId(schedule), calendarTaskId({ ...schedule, date: '2026-11-05' }));
  assert.equal(taskFromSchedule(schedule).priority, 'medium');
});

test('existing completed tasks are recognized without changing completion or memo', () => {
  const schedule = { id: 'schedule-1', date: '2026-11-04', title: '원래 제목', category: '', completed: false };
  const task = { ...taskFromSchedule(schedule), title: '수정한 제목', status: 'done', memo: '사용자가 편집한 메모' };
  const before = structuredClone(task);
  assert.equal(hasCalendarTask([task], schedule), true);
  assert.deepEqual(task, before);
});

test('legacy linked tasks prevent duplicates only for the same occurrence date', () => {
  const schedule = { id: 'repeat-1', date: '2026-11-04' };
  const task = { id: 'legacy-task', linkedScheduleId: schedule.id, dueDate: schedule.date };
  assert.equal(hasCalendarTask([task], schedule), true);
  assert.equal(hasCalendarTask([task], { ...schedule, date: '2026-11-05' }), false);
});

test('today occurrences are computed independently of the calendar selected year', () => {
  const schedule = { id: 'repeat', date: '2026-11-01', title: '반복', category: '', completed: false };
  const rule = { id: 'rule', scheduleId: 'repeat', startDate: schedule.date, frequency: 'daily' };
  const result = calendarSchedulesForDate([schedule], [rule], [], '2026-11-04');
  assert.deepEqual(result.map(item => item.date), ['2026-11-04']);
  assert.equal(result[0].id, 'repeat_rec_2026-11-04');
});

test('today list honors cancelled occurrences and future occurrences moved to today', () => {
  const schedule = { id: 'repeat', date: '2026-11-01', title: '반복', category: '', completed: false };
  const rule = { id: 'rule', scheduleId: 'repeat', startDate: schedule.date, frequency: 'daily' };
  const exceptions = [
    { id: 'cancel', ruleId: 'rule', originalDate: '2026-11-04', action: 'cancelled' },
    { id: 'move', ruleId: 'rule', originalDate: '2026-11-07', action: 'modified', modifiedSchedule: { date: '2026-11-04', title: '옮긴 일정' } },
  ];
  const result = calendarSchedulesForDate([schedule], [rule], exceptions, '2026-11-04');
  assert.deepEqual(result.map(item => [item.id, item.title]), [['repeat_rec_2026-11-07', '옮긴 일정']]);
});
