import { test, expect } from '@playwright/test';
import { planSeriesChange } from '../src/utils/seriesEdit';
import { expandRecurringSchedules } from '../src/utils/recurrenceEngine';
import type { RecurrenceException, RecurrenceRule, Schedule } from '../src/types';

// 반복 일정 '이후 모두 / 전체' 수정·삭제 계산 시험(브라우저 없이)
const base: Schedule = { id: 's', title: '영어 학원', date: '2026-11-03', category: 'a', completed: false, recurrenceRuleId: 'r' };
const rule: RecurrenceRule = { id: 'r', scheduleId: 's', frequency: 'weekly', weekdays: [2, 4], startDate: '2026-11-03' };
const occ = (date: string): Schedule => ({ ...base, id: `s_rec_${date}`, date });
const ex: RecurrenceException[] = [
  { id: 'e1', ruleId: 'r', originalDate: '2026-11-05', action: 'cancelled' },
  { id: 'e2', ruleId: 'r', originalDate: '2026-11-19', action: 'modified', modifiedSchedule: { title: '보강' } },
];
const view = (schedules: Schedule[], rules: RecurrenceRule[], exceptions: RecurrenceException[]) =>
  expandRecurringSchedules(schedules, rules, exceptions, '2026-11-01', '2026-11-30').map(s => `${s.date} ${s.title}`);

test('전체 삭제: 일정·반복·예외 모두 지움', () => {
  const c = planSeriesChange({ occurrence: occ('2026-11-12'), base, rule, exceptions: ex, scope: 'all' });
  expect(c.schedules).toEqual({ before: [base], after: [] });
  expect(c.rules).toEqual({ before: [rule], after: [] });
  expect(c.exceptions.before.map(e => e.id)).toEqual(['e1', 'e2']);
});

test('이후 모두 삭제: 전날까지로 줄이고 이후 예외는 지움', () => {
  const c = planSeriesChange({ occurrence: occ('2026-11-12'), base, rule, exceptions: ex, scope: 'following' });
  expect(c.rules.after).toEqual([{ ...rule, endDate: '2026-11-11' }]);
  expect(c.exceptions.before.map(e => e.id)).toEqual(['e2']);
  expect(view([base], c.rules.after, [ex[0]])).toEqual(['2026-11-03 영어 학원', '2026-11-10 영어 학원']);
});

test('첫 회차에서 이후 모두는 전체와 같다', () => {
  const c = planSeriesChange({ occurrence: occ('2026-11-03'), base, rule, exceptions: ex, scope: 'following' });
  expect(c.rules.after).toEqual([]);
});

test('이후 모두 수정: 앞은 그대로, 그날부터 새 제목으로 이어지고 이후 예외도 옮겨진다', () => {
  const c = planSeriesChange({ occurrence: occ('2026-11-12'), base, rule, exceptions: ex, scope: 'following', edited: { ...occ('2026-11-12'), title: '영어 회화' }, newId: 'n' });
  const schedules = [base, ...c.schedules.after], exceptions = [ex[0], ...c.exceptions.after];
  expect(view(schedules, c.rules.after, exceptions)).toEqual([
    '2026-11-03 영어 학원', '2026-11-10 영어 학원',
    '2026-11-12 영어 회화', '2026-11-17 영어 회화', '2026-11-19 보강', '2026-11-24 영어 회화', '2026-11-26 영어 회화',
  ]);
});

test('이후 모두 수정: 횟수 제한은 남은 만큼만', () => {
  const counted = { ...rule, count: 5 };
  const c = planSeriesChange({ occurrence: occ('2026-11-12'), base, rule: counted, exceptions: [], scope: 'following', edited: { ...occ('2026-11-12'), title: '새' }, newId: 'n' });
  expect(c.rules.after[1].count).toBe(2); // 3·5·10일에 3번 나옴 → 남은 2번
  expect(view([base, ...c.schedules.after], c.rules.after, []).length).toBe(5);
});

test('전체 수정: 제목·반복 바꾸기, 시작일은 유지', () => {
  const c = planSeriesChange({ occurrence: occ('2026-11-12'), base, rule, exceptions: ex, scope: 'all', edited: { ...occ('2026-11-12'), title: '영어' }, newRule: { id: 'x', scheduleId: 'x', frequency: 'weekly', weekdays: [2], startDate: '2026-11-12' } });
  expect(c.schedules.after[0]).toMatchObject({ id: 's', title: '영어', date: '2026-11-03' });
  expect(c.rules.after[0]).toMatchObject({ id: 'r', scheduleId: 's', startDate: '2026-11-03', weekdays: [2] });
});

test('전체 수정에서 반복 없애기: 일정 하나만 남는다', () => {
  const c = planSeriesChange({ occurrence: occ('2026-11-12'), base, rule, exceptions: ex, scope: 'all', edited: occ('2026-11-12'), newRule: null });
  expect(c.schedules.after[0].recurrenceRuleId).toBeUndefined();
  expect(c.rules.after).toEqual([]);
});
