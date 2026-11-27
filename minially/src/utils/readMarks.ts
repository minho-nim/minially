// 글로 일정 넣기: 원문에서 무엇을 날짜·시간·장소·제목으로 읽었는지 색으로 보여 주기 위한 구간 찾기.
// 규칙(textSchedule)과 같은 낱말을 다시 찾아 표시만 한다. 값을 바꾸지 않고, 못 찾은 것은 색을 칠하지 않는다.
export type MarkKind = 'date' | 'time' | 'place' | 'title';
export interface ReadPart { text: string; kind?: MarkKind }

const DATE = /\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?|\d{1,2}\s*월\s*\d{1,2}\s*일|\b\d{1,2}\/\d{1,2}\b|(?:이번|다음|담)\s*주\s*(?:[월화수목금토일](?:요일|욜))?|[월화수목금토일](?:요일|욜)|오늘|내일|모레|(?:^|(?<=\s))낼|\d{1,3}\s*(?:일|주|개월|달)\s*(?:뒤|후)|이번\s*주말|주말|월말|매주|격주|매일|매달|매월|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?/gi;
const TIME = /(?:오전|오후|아침|저녁|밤|낮|새벽)\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분|\s*반)?|(?:오전|오후|아침|저녁|밤|낮|새벽)?\s*(?:열한|열두|다섯|여섯|일곱|여덟|아홉|한|두|세|네|열)\s*시(?!간)(?:\s*반)?|\d{1,2}\s*시(?!간)(?:\s*\d{1,2}\s*분|\s*반)?|\d{1,2}:\d{2}(?:\s*[~\-]\s*\d{1,2}:\d{2})?|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|정오|자정/gi;
const ORDER: MarkKind[] = ['date', 'time', 'place', 'title'];

export function readMarks(source: string, ev: { title: string; location?: string }): ReadPart[] {
  const spans: { start: number; end: number; kind: MarkKind }[] = [];
  const add = (start: number, end: number, kind: MarkKind) => { if (end > start) spans.push({ start, end, kind }); };
  for (const m of source.matchAll(DATE)) add(m.index, m.index + m[0].trim().length + (m[0].length - m[0].trimStart().length), 'date');
  for (const m of source.matchAll(TIME)) { const lead = m[0].length - m[0].trimStart().length; add(m.index + lead, m.index + m[0].trimEnd().length, 'time'); }
  const place = ev.location?.trim();
  if (place && place.length >= 2) { const i = source.indexOf(place); if (i >= 0) add(i, i + place.length, 'place'); }
  // 제목: 제목 전체가 있으면 그대로, 없으면 제목의 낱말(2글자 이상)마다
  const title = ev.title.trim();
  const whole = title.length >= 2 ? source.indexOf(title) : -1;
  if (whole >= 0) add(whole, whole + title.length, 'title');
  else for (const w of title.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []) { const i = source.indexOf(w); if (i >= 0) add(i, i + w.length, 'title'); }
  spans.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.start - b.start);
  const kept: typeof spans = [];
  for (const s of spans) if (!kept.some(k => s.start < k.end && k.start < s.end)) kept.push(s);
  kept.sort((a, b) => a.start - b.start);
  const parts: ReadPart[] = [];
  let last = 0;
  for (const s of kept) {
    if (s.start > last) parts.push({ text: source.slice(last, s.start) });
    parts.push({ text: source.slice(s.start, s.end), kind: s.kind });
    last = s.end;
  }
  if (last < source.length) parts.push({ text: source.slice(last) });
  return parts;
}
