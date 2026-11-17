import { test, expect } from '@playwright/test';
import { expandRecurringSchedules } from '../src/utils/recurrenceEngine';
import type { RecurrenceRule, Schedule } from '../src/types';

// 반복 계산만 따로 확인하는 시험(브라우저 없이)
const base = (date: string): Schedule => ({ id: 's1', title: '반복', date, category: '', completed: false });
const dates = (rule: Partial<RecurrenceRule>, start: string, from: string, to: string) =>
  expandRecurringSchedules([base(start)], [{ id: 'r1', scheduleId: 's1', frequency: 'none', startDate: start, ...rule } as RecurrenceRule], [], from, to).map(s => s.date);

test('매주 여러 요일(화·목)', () => {
  expect(dates({ frequency: 'weekly', weekdays: [2, 4] }, '2026-11-03', '2026-11-01', '2026-11-14')).toEqual(['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12']);
});

test('2주마다(월·수)', () => {
  expect(dates({ frequency: 'weekly', interval: 2, weekdays: [1, 3] }, '2026-11-02', '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-04', '2026-11-16', '2026-11-18', '2026-11-30']);
});

test('횟수로 끝내기(매일 3번)', () => {
  expect(dates({ frequency: 'daily', count: 3 }, '2026-11-10', '2026-11-01', '2026-11-30')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
});

test('횟수는 보는 범위와 상관없이 시작일부터 센다', () => {
  expect(dates({ frequency: 'daily', count: 3 }, '2026-11-10', '2026-11-12', '2026-11-30')).toEqual(['2026-11-12']);
});

test('매월 31일: 기본은 없는 달에 말일', () => {
  expect(dates({ frequency: 'monthly' }, '2026-01-31', '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
});

test('매월 31일: 건너뛰기를 고르면 없는 달은 빠진다', () => {
  expect(dates({ frequency: 'monthly', missingDay: 'skip' }, '2026-01-31', '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
});

test('매년 2월 29일: 평년에는 2월 28일, 건너뛰기면 빠짐', () => {
  expect(dates({ frequency: 'yearly' }, '2028-02-29', '2028-01-01', '2032-12-31')).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
  expect(dates({ frequency: 'yearly', missingDay: 'skip' }, '2028-02-29', '2028-01-01', '2032-12-31')).toEqual(['2028-02-29', '2032-02-29']);
});

test('매년 생일', () => {
  expect(dates({ frequency: 'yearly' }, '2026-05-10', '2026-01-01', '2028-12-31')).toEqual(['2026-05-10', '2027-05-10', '2028-05-10']);
});

test('종료일까지만', () => {
  expect(dates({ frequency: 'weekly', endDate: '2026-11-17' }, '2026-11-03', '2026-11-01', '2026-11-30')).toEqual(['2026-11-03', '2026-11-10', '2026-11-17']);
});
