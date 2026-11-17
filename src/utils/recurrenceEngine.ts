import type { Schedule, RecurrenceRule, RecurrenceException } from '../types';

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Expand recurring schedules within [startDate, endDate]
 */
export function expandRecurringSchedules(
  baseSchedules: Schedule[],
  rules: RecurrenceRule[],
  exceptions: RecurrenceException[],
  viewStartDate: string,
  viewEndDate: string
): Schedule[] {
  const viewStart = parseDate(viewStartDate);
  const viewEnd = parseDate(viewEndDate);

  const ruleMap = new Map<string, RecurrenceRule>();
  for (const r of rules) {
    ruleMap.set(r.id, r);
    ruleMap.set(r.scheduleId, r);
  }

  const exceptionMap = new Map<string, RecurrenceException>();
  for (const ex of exceptions) {
    exceptionMap.set(`${ex.ruleId}_${ex.originalDate}`, ex);
  }

  const result: Schedule[] = [];

  for (const schedule of baseSchedules) {
    const rule = schedule.recurrenceRuleId
      ? ruleMap.get(schedule.recurrenceRuleId)
      : ruleMap.get(schedule.id);

    if (!rule || rule.frequency === 'none') {
      result.push(schedule);
      continue;
    }

    // This schedule has a recurrence rule
    const ruleStart = parseDate(rule.startDate || schedule.date);
    const ruleEnd = rule.endDate ? parseDate(rule.endDate) : null;

    // Generate instances between min(ruleStart, viewStart) and min(ruleEnd, viewEnd)
    const effectiveStart = viewStart > ruleStart ? viewStart : ruleStart;
    const effectiveEnd = ruleEnd && ruleEnd < viewEnd ? ruleEnd : viewEnd;

    if (effectiveStart > effectiveEnd) {
      continue;
    }

    const cur = new Date(ruleStart);
    let made = 0; // 지금까지 나온 반복 횟수(count 제한용, 건너뛴 날짜도 센다)
    // Iterate from ruleStart up to effectiveEnd
    while (cur <= effectiveEnd) {
      const curStr = formatDate(cur);
      const matches = occursOn(rule, ruleStart, cur);
      if (matches) made++;
      if (rule.count && made > rule.count) break;

      if (matches && cur >= effectiveStart && cur <= effectiveEnd) {
        const exceptionKey = `${rule.id}_${curStr}`;
        const ex = exceptionMap.get(exceptionKey);

        if (!ex || ex.action !== 'cancelled') {
          const instanceId = `${schedule.id}_rec_${curStr}`;
          const modified = ex?.modifiedSchedule || {};

          result.push({
            ...schedule,
            ...modified,
            id: instanceId,
            date: modified.date || curStr,
            recurrenceRuleId: rule.id,
            isRecurringInstance: curStr !== schedule.date,
          });
        }
      }

      // Increment cur by 1 day
      cur.setDate(cur.getDate() + 1);
    }
  }

  return result;
}

const DAY = 24 * 60 * 60 * 1000;
const lastDayOf = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** 이 달에 들어갈 날짜. 그 날짜가 없는 달은 말일(기본) 또는 null(건너뛰기). */
function dayInMonth(rule: RecurrenceRule, y: number, m: number, day: number): number | null {
  const last = lastDayOf(y, m);
  if (day <= last) return day;
  return rule.missingDay === 'skip' ? null : last;
}

/** 이 날짜가 반복에 해당하는지. interval은 주기 간격(2 = 2주마다 등), 기본 1. */
export function occursOn(rule: RecurrenceRule, start: Date, cur: Date): boolean {
  if (cur < start) return false;
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const days = Math.round((Date.UTC(cur.getFullYear(), cur.getMonth(), cur.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / DAY);
  switch (rule.frequency) {
    case 'daily':
      return days % interval === 0;
    case 'weekdays': {
      const day = cur.getDay();
      return day >= 1 && day <= 5;
    }
    case 'weekly': {
      const weekdays = rule.weekdays && rule.weekdays.length > 0 ? rule.weekdays : [start.getDay()];
      if (!weekdays.includes(cur.getDay())) return false;
      // 시작 날짜가 든 주(일요일 시작)부터 몇 주째인지
      const weeks = Math.floor((days + start.getDay()) / 7);
      return weeks % interval === 0;
    }
    case 'monthly': {
      const months = (cur.getFullYear() - start.getFullYear()) * 12 + cur.getMonth() - start.getMonth();
      if (months % interval !== 0) return false;
      return cur.getDate() === dayInMonth(rule, cur.getFullYear(), cur.getMonth(), start.getDate());
    }
    case 'yearly': {
      const years = cur.getFullYear() - start.getFullYear();
      if (years % interval !== 0 || cur.getMonth() !== start.getMonth()) return false;
      return cur.getDate() === dayInMonth(rule, cur.getFullYear(), cur.getMonth(), start.getDate());
    }
    default:
      return false;
  }
}
