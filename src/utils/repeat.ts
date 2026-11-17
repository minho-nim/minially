// 반복 선택 판에서 쓰는 값과 저장용 반복 규칙(RecurrenceRule) 사이 변환, 짧은 설명 문구.
import type { RecurrenceFrequency, RecurrenceRule } from '../types';

export type RepeatChoice = Exclude<RecurrenceFrequency, 'weekly'> | 'weekly' | 'biweekly';
export interface RepeatSettings {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  endDate: string;
  count: number | '';
  missingDay: 'last' | 'skip';
}

export const NO_REPEAT: RepeatSettings = { frequency: 'none', interval: 1, weekdays: [], endDate: '', count: '', missingDay: 'last' };
export const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const dayOf = (date: string) => new Date(date + 'T12:00:00').getDay();

export function ruleToRepeat(rule: RecurrenceRule | undefined): RepeatSettings {
  if (!rule) return { ...NO_REPEAT };
  return {
    frequency: rule.frequency, interval: Math.max(1, rule.interval || 1), weekdays: rule.weekdays ? [...rule.weekdays] : [],
    endDate: rule.endDate || '', count: rule.count || '', missingDay: rule.missingDay === 'skip' ? 'skip' : 'last',
  };
}

export function choiceOf(value: RepeatSettings): RepeatChoice {
  return value.frequency === 'weekly' && value.interval === 2 ? 'biweekly' : value.frequency;
}

/** 주기를 바꿀 때: 매주·2주마다는 요일 기본값(그날 요일)을 넣는다. */
export function withChoice(value: RepeatSettings, choice: RepeatChoice, date: string): RepeatSettings {
  const weekly = choice === 'weekly' || choice === 'biweekly';
  return {
    ...value,
    frequency: choice === 'biweekly' ? 'weekly' : choice,
    interval: choice === 'biweekly' ? 2 : 1,
    weekdays: weekly ? (value.weekdays.length ? value.weekdays : [dayOf(date)]) : [],
  };
}

/** 이 날짜로 매월·매년 반복할 때 없는 달이 생기는지(29~31일, 2월 29일) */
export function hasMissingDays(value: RepeatSettings, date: string) {
  if (!date) return false;
  const day = Number(date.slice(8, 10)), month = Number(date.slice(5, 7));
  if (value.frequency === 'monthly') return day > 28;
  if (value.frequency === 'yearly') return month === 2 && day === 29;
  return false;
}

export function repeatError(value: RepeatSettings, date: string) {
  if (value.frequency === 'none') return '';
  if (value.endDate && date && value.endDate < date) return '반복 종료일은 시작 날짜 이후로 선택해 주세요.';
  if (value.count !== '' && (!Number.isInteger(value.count) || value.count < 1 || value.count > 999)) return '반복 횟수는 1~999 사이로 입력해 주세요.';
  if (value.frequency === 'weekly' && !value.weekdays.length) return '반복할 요일을 하나 이상 골라 주세요.';
  return '';
}

/** 저장할 반복 규칙. 반복 없음이면 null. */
export function repeatToRule(value: RepeatSettings, base: { id: string; scheduleId: string; startDate: string }, previous?: RecurrenceRule): RecurrenceRule | null {
  if (value.frequency === 'none') return null;
  const rule: RecurrenceRule = { ...previous, id: base.id, scheduleId: base.scheduleId, frequency: value.frequency, startDate: base.startDate };
  delete rule.interval; delete rule.weekdays; delete rule.endDate; delete rule.count; delete rule.missingDay;
  if (value.interval > 1) rule.interval = value.interval;
  if (value.frequency === 'weekly') rule.weekdays = [...value.weekdays].sort((a, b) => a - b);
  if (value.frequency === 'custom' && previous?.weekdays) rule.weekdays = previous.weekdays;
  if (value.endDate) rule.endDate = value.endDate;
  if (value.count !== '') rule.count = value.count;
  if (hasMissingDays(value, base.startDate) && value.missingDay === 'skip') rule.missingDay = 'skip';
  return rule;
}

/** 단추·목록에 쓰는 짧은 설명: "매주 화·목", "2주마다 월", "매월 31일", "매년 5월 10일 · 10번" */
export function describeRepeat(value: RepeatSettings, date: string): string {
  const days = [...value.weekdays].sort((a, b) => a - b).map(d => WEEKDAY_NAMES[d]).join('·');
  const base = (() => {
    switch (value.frequency) {
      case 'daily': return value.interval > 1 ? `${value.interval}일마다` : '매일';
      case 'weekdays': return '평일';
      case 'weekly': return `${value.interval > 1 ? value.interval + '주마다' : '매주'} ${days}`;
      case 'monthly': return `매월 ${Number(date.slice(8, 10))}일`;
      case 'yearly': return `매년 ${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
      case 'custom': return '사용자 지정';
      default: return '반복 없음';
    }
  })();
  if (value.frequency === 'none') return base;
  const end = value.count !== '' ? ` · ${value.count}번` : value.endDate ? ` · ${Number(value.endDate.slice(5, 7))}월 ${Number(value.endDate.slice(8, 10))}일까지` : '';
  return base + end;
}
