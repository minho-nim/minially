import type { Schedule } from '../types';

// 여러 날 이어진 일정(같은 이름·같은 분류·같은 시작 시간이 날짜가 끊기지 않고 이어짐)을 한 줄로 보이게 자리를 정한다.
// 일정 자체는 날짜마다 따로 저장된 그대로 두고, 달력에서만 이어 그린다.

export interface SpanSlot {
  schedule: Schedule;
  /** 이어진 일정이면 앞날·뒷날과 붙여 그린다 */
  joinsPrev: boolean;
  joinsNext: boolean;
  /** 이름을 보여 줄 칸(이어진 일정의 첫날이거나 그 주의 첫 칸) */
  showTitle: boolean;
  /** 이어진 날 수(1이면 하루짜리) */
  length: number;
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const linkKey = (s: Schedule) => `${s.title.trim()}\u0000${s.category}\u0000${s.startTime ?? ''}`;

/** 일정 id → 이어진 묶음(첫날·마지막 날·날짜별 일정) */
export function buildRuns(schedules: Schedule[]) {
  const byKey = new Map<string, Map<string, Schedule>>();
  for (const s of schedules) {
    if (!s.title.trim()) continue;
    const key = linkKey(s);
    const days = byKey.get(key) ?? new Map<string, Schedule>();
    if (!days.has(s.date)) days.set(s.date, s); // 같은 날 같은 일정이 둘이면 앞의 것만 잇는다
    byKey.set(key, days);
  }
  const runOf = new Map<string, { start: string; end: string; length: number }>();
  for (const days of byKey.values()) {
    const dates = [...days.keys()].sort();
    let i = 0;
    while (i < dates.length) {
      let j = i;
      while (j + 1 < dates.length && dates[j + 1] === addDays(dates[j], 1)) j++;
      const run = { start: dates[i], end: dates[j], length: j - i + 1 };
      for (let k = i; k <= j; k++) runOf.set(days.get(dates[k])!.id, run);
      i = j + 1;
    }
  }
  return runOf;
}

/**
 * 한 주(7칸) 날짜별로 줄 순서를 정한다. 이어진 일정은 그 주 안에서 같은 줄에 놓이고,
 * 빈 줄은 null(자리만 차지)로 채운다. 하루짜리는 남는 줄에 원래 순서대로.
 */
export function layoutWeek(days: string[], byDate: Map<string, Schedule[]>, runOf: Map<string, { start: string; end: string; length: number }>): (SpanSlot | null)[][] {
  const lanes: (SpanSlot | null)[][] = days.map(() => []);
  const taken = (col: number, lane: number) => lanes[col][lane] != null;
  const place = (col: number, lane: number, slot: SpanSlot) => {
    while (lanes[col].length <= lane) lanes[col].push(null);
    lanes[col][lane] = slot;
  };
  // 1) 이어진 일정: 그 주에서 처음 보이는 날 기준으로, 이른 것·긴 것 먼저 자리를 잡는다
  const segments = new Map<string, { first: number; last: number; items: Schedule[]; length: number; start: string; end: string }>();
  days.forEach((date, col) => {
    for (const s of byDate.get(date) ?? []) {
      const run = runOf.get(s.id);
      if (!run || run.length < 2) continue;
      const key = `${linkKey(s)}\u0000${run.start}`;
      const seg = segments.get(key) ?? { first: col, last: col, items: [], length: run.length, start: run.start, end: run.end };
      seg.last = col;
      seg.items[col] = s;
      segments.set(key, seg);
    }
  });
  const ordered = [...segments.values()].sort((a, b) => a.first - b.first || (b.last - b.first) - (a.last - a.first) || a.start.localeCompare(b.start));
  for (const seg of ordered) {
    let lane = 0;
    while (Array.from({ length: seg.last - seg.first + 1 }, (_, i) => seg.first + i).some(col => taken(col, lane))) lane++;
    for (let col = seg.first; col <= seg.last; col++) {
      const s = seg.items[col];
      if (!s) continue;
      place(col, lane, {
        schedule: s, length: seg.length,
        joinsPrev: days[col] !== seg.start,
        joinsNext: days[col] !== seg.end,
        showTitle: col === seg.first,
      });
    }
  }
  // 2) 하루짜리
  days.forEach((date, col) => {
    for (const s of byDate.get(date) ?? []) {
      const run = runOf.get(s.id);
      if (run && run.length >= 2) continue;
      let lane = 0;
      while (taken(col, lane)) lane++;
      place(col, lane, { schedule: s, joinsPrev: false, joinsNext: false, showTitle: true, length: 1 });
    }
  });
  return lanes;
}
