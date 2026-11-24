// 대한민국 공휴일(관공서의 공휴일에 관한 규정 기준)과 연휴.
// 양력 공휴일은 규칙으로, 음력 공휴일(설날·부처님오신날·추석)은 해마다 표로 둔다.
// 대체공휴일은 규칙으로 계산한다.
// shortcut: 음력 표·선거일은 2024~2030년만 있다. 2030년이 가까워지면 표를 늘리고, 임시공휴일은 정부 발표 때 EXTRA에 더한다.

export interface Holiday { date: string; name: string; substitute?: boolean }

/** 음력 공휴일 양력 날짜: [설날 당일, 부처님오신날, 추석 당일] */
const LUNAR: Record<number, [string, string, string]> = {
  2024: ['02-10', '05-15', '09-17'],
  2025: ['01-29', '05-05', '10-06'],
  2026: ['02-17', '05-24', '09-25'],
  2027: ['02-06', '05-13', '09-15'],
  2028: ['01-26', '05-02', '10-03'],
  2029: ['02-13', '05-20', '09-22'],
  2030: ['02-03', '05-09', '09-12'],
};
/** 선거일·임시공휴일(정부가 정한 날만) */
const EXTRA: Record<string, string> = {
  '2024-04-10': '국회의원 선거일',
  '2024-10-01': '국군의 날(임시)',
  '2025-01-27': '임시공휴일',
  '2025-06-03': '대통령 선거일',
  '2026-06-03': '지방선거일',
  '2028-04-12': '국회의원 선거일',
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

const cache = new Map<number, Map<string, Holiday[]>>();

/** 그 해 공휴일(날짜 → 이름 목록). 같은 날 두 공휴일이 겹치면 둘 다 들어간다. */
export function holidaysOfYear(year: number): Map<string, Holiday[]> {
  const hit = cache.get(year);
  if (hit) return hit;
  const map = new Map<string, Holiday[]>();
  const add = (date: string, name: string, substitute = false) => {
    if (!date.startsWith(String(year))) return;
    map.set(date, [...(map.get(date) ?? []), { date, name, ...(substitute ? { substitute } : {}) }]);
  };
  // 대체공휴일이 붙는 날(토·일 또는 다른 공휴일과 겹치면 다음 평일)
  const substituteOnWeekend: [string, string][] = [['03-01', '삼일절'], ['05-05', '어린이날'], ['08-15', '광복절'], ['10-03', '개천절'], ['10-09', '한글날'], ['12-25', '성탄절']];
  if (year >= 2026) substituteOnWeekend.push(['07-17', '제헌절']); // 2026년부터 다시 공휴일
  const plain: [string, string][] = [['01-01', '신정'], ['06-06', '현충일']];
  for (const [md, name] of plain) add(`${year}-${md}`, name);
  for (const [md, name] of substituteOnWeekend) add(`${year}-${md}`, name);
  const lunar = LUNAR[year];
  const lunarBlocks: string[][] = [];
  if (lunar) {
    const [seol, buddha, chuseok] = lunar.map(md => `${year}-${md}`);
    const seolDays = [addDays(seol, -1), seol, addDays(seol, 1)];
    const chuseokDays = [addDays(chuseok, -1), chuseok, addDays(chuseok, 1)];
    seolDays.forEach(d => add(d, '설날'));
    chuseokDays.forEach(d => add(d, '추석'));
    add(buddha, '부처님오신날');
    substituteOnWeekend.push([buddha.slice(5), '부처님오신날']);
    lunarBlocks.push(seolDays, chuseokDays);
  }
  for (const [date, name] of Object.entries(EXTRA)) add(date, name);

  const isOff = (date: string) => map.has(date) || weekday(date) === 0 || weekday(date) === 6;
  const nextWorkday = (date: string) => { let d = addDays(date, 1); while (isOff(d)) d = addDays(d, 1); return d; };
  // 설·추석: 연휴 중 일요일이나 다른 공휴일과 겹치면 연휴 다음 첫 평일
  for (const days of lunarBlocks) {
    const name = map.get(days[1])?.find(h => h.name === '설날' || h.name === '추석')?.name ?? '';
    const overlaps = days.filter(d => weekday(d) === 0 || (map.get(d)?.length ?? 0) > 1).length;
    let last = days[2];
    for (let i = 0; i < overlaps; i++) { const sub = nextWorkday(last); add(sub, `대체공휴일(${name})`, true); last = sub; }
  }
  // 나머지: 토·일이거나 다른 공휴일과 겹치면 다음 첫 평일. 같은 날 두 공휴일이 겹쳐도 대체는 하루, 설·추석과 겹친 건 위에서 셌다.
  const lunarDays = new Set(lunarBlocks.flat());
  const done = new Set<string>();
  for (const [md, name] of substituteOnWeekend) {
    const date = `${year}-${md}`;
    if (done.has(date) || lunarDays.has(date)) continue;
    done.add(date);
    if (weekday(date) === 0 || weekday(date) === 6 || (map.get(date)?.length ?? 0) > 1) add(nextWorkday(date), `대체공휴일(${name})`, true);
  }
  cache.set(year, map);
  return map;
}

export function holidaysOn(date: string): Holiday[] {
  return holidaysOfYear(Number(date.slice(0, 4))).get(date) ?? [];
}

/** 쉬는 날(토·일·공휴일)이 3일 이상 이어지면 연휴. 날짜 → { 첫날, 길이 } */
export function longWeekends(from: string, to: string): Map<string, { start: string; days: number }> {
  const off = (d: string) => holidaysOn(d).length > 0 || weekday(d) === 0 || weekday(d) === 6;
  const result = new Map<string, { start: string; days: number }>();
  let d = addDays(from, -10);
  const end = addDays(to, 10);
  while (d <= end) {
    if (!off(d)) { d = addDays(d, 1); continue; }
    const run: string[] = [];
    while (off(d)) { run.push(d); d = addDays(d, 1); }
    if (run.length >= 3 && run.some(x => holidaysOn(x).length)) for (const x of run) result.set(x, { start: run[0], days: run.length });
  }
  return result;
}
