// 반복 일정의 "이후 모두 / 전체" 수정·삭제를 저장할 변경 목록으로 만든다(되돌리기 기록과 함께 저장).
// "이 일정만"은 기존 방식(그날 예외 기록, recordOccurrenceHistory)을 그대로 쓴다.
import type { RecurrenceException, RecurrenceRule, Schedule } from '../types';
import { expandRecurringSchedules, formatDate, parseDate } from './recurrenceEngine';

export type SeriesScope = 'this' | 'following' | 'all';
export interface SeriesChange {
  schedules: { before: Schedule[]; after: Schedule[] };
  rules: { before: RecurrenceRule[]; after: RecurrenceRule[] };
  exceptions: { before: RecurrenceException[]; after: RecurrenceException[] };
}

export const OCCURRENCE_ID = /_rec_(\d{4}-\d{2}-\d{2})$/;
export const isOccurrence = (s: Pick<Schedule, 'id' | 'recurrenceRuleId'> | null | undefined) => Boolean(s?.recurrenceRuleId && OCCURRENCE_ID.test(s.id));
export const occurrenceDate = (s: Pick<Schedule, 'id'>) => s.id.match(OCCURRENCE_ID)?.[1] ?? '';
export const baseIdOf = (s: Pick<Schedule, 'id'>) => s.id.replace(OCCURRENCE_ID, '');

const dayBefore = (date: string) => { const d = parseDate(date); d.setDate(d.getDate() - 1); return formatDate(d); };

/** 일정 칸 값만(날짜·반복 연결·완료는 시리즈 쪽 값을 유지) */
function fieldsOf(edited: Schedule): Partial<Schedule> {
  const { id, date, recurrenceRuleId, isRecurringInstance, completed, ...fields } = edited;
  void id; void date; void recurrenceRuleId; void isRecurringInstance; void completed;
  return fields;
}

function withFields(base: Schedule, edited: Schedule): Schedule {
  const next: Schedule = { ...base, ...fieldsOf(edited) };
  if (!edited.titleBlocks) delete next.titleBlocks;
  return next;
}

/**
 * edited가 없으면 삭제, 있으면 수정. newRule: undefined = 반복 그대로, null = 반복 없애기, 규칙 = 반복 바꾸기(id·startDate는 여기서 정함).
 */
export function planSeriesChange(args: {
  occurrence: Schedule; base: Schedule; rule: RecurrenceRule; exceptions: RecurrenceException[];
  scope: Exclude<SeriesScope, 'this'>; edited?: Schedule | null; newRule?: RecurrenceRule | null; newId?: string;
}): SeriesChange {
  const { occurrence, base, rule, edited, newRule } = args;
  const occDate = occurrenceDate(occurrence);
  const own = args.exceptions.filter(ex => ex.ruleId === rule.id);
  const scope = args.scope === 'following' && occDate <= rule.startDate ? 'all' : args.scope;

  if (scope === 'all') {
    if (!edited) return { schedules: { before: [base], after: [] }, rules: { before: [rule], after: [] }, exceptions: { before: own, after: [] } };
    const nextBase = withFields(base, edited);
    if (newRule === null) {
      delete nextBase.recurrenceRuleId;
      return { schedules: { before: [base], after: [nextBase] }, rules: { before: [rule], after: [] }, exceptions: { before: own, after: [] } };
    }
    const nextRule = newRule ? { ...newRule, id: rule.id, scheduleId: base.id, startDate: rule.startDate } : rule;
    return { schedules: { before: [base], after: [nextBase] }, rules: { before: [rule], after: [nextRule] }, exceptions: { before: [], after: [] } };
  }

  // 이후 모두: 기존 반복은 전날까지로 줄이고, 그날부터는 새 반복(수정) 또는 없음(삭제)
  const prev = dayBefore(occDate);
  const ended: RecurrenceRule = { ...rule, endDate: rule.endDate && rule.endDate < prev ? rule.endDate : prev };
  const later = own.filter(ex => ex.originalDate >= occDate);
  if (!edited) return { schedules: { before: [], after: [] }, rules: { before: [rule], after: [ended] }, exceptions: { before: later, after: [] } };

  const newId = args.newId || crypto.randomUUID();
  const start = edited.date || occDate;
  const nextBase: Schedule = { ...withFields(base, edited), id: newId, date: start, completed: false };
  delete nextBase.recurrenceRuleId; delete nextBase.isRecurringInstance;
  if (newRule === null) return { schedules: { before: [], after: [nextBase] }, rules: { before: [rule], after: [ended] }, exceptions: { before: later, after: [] } };

  let nextRule: RecurrenceRule;
  if (newRule) nextRule = { ...newRule, id: newId + '-repeat', scheduleId: newId, startDate: start };
  else {
    nextRule = { ...rule, id: newId + '-repeat', scheduleId: newId, startDate: start };
    if (rule.count) {
      // 횟수 제한은 앞 시리즈에서 이미 나온 만큼 뺀다
      const used = expandRecurringSchedules([base], [{ ...rule, endDate: prev }], [], rule.startDate, prev).length;
      if (rule.count - used > 0) nextRule.count = rule.count - used; else delete nextRule.count;
    }
  }
  nextBase.recurrenceRuleId = nextRule.id;
  const moved = later.map(ex => ({ ...ex, ruleId: nextRule.id }));
  return { schedules: { before: [], after: [nextBase] }, rules: { before: [rule], after: [ended, nextRule] }, exceptions: { before: later, after: moved } };
}
