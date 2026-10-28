import { Schedule, RecurrenceRule, RecurrenceException } from '../types';

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
    // Iterate from ruleStart up to effectiveEnd
    while (cur <= effectiveEnd) {
      const curStr = formatDate(cur);

      let matches = false;
      switch (rule.frequency) {
        case 'daily':
          matches = true;
          break;
        case 'weekdays': {
          const day = cur.getDay();
          matches = day >= 1 && day <= 5;
          break;
        }
        case 'weekly': {
          if (rule.weekdays && rule.weekdays.length > 0) {
            matches = rule.weekdays.includes(cur.getDay());
          } else {
            matches = cur.getDay() === ruleStart.getDay();
          }
          break;
        }
        case 'monthly':
          matches = cur.getDate() === ruleStart.getDate();
          break;
        default:
          matches = false;
      }

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
            date: curStr,
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
