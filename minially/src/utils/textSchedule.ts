// 글로 일정 넣기: 붙여넣은 예약 문자·메일·공지 글에서 날짜·시간을 규칙으로 찾는다.
// 이 기기 안에서만 돌고 서버·AI로 보내지 않는다. 결과는 사진과 같은 후보 목록(사람이 고친 뒤 고른 것만 등록).
import type { PhotoEvent } from './photoSchedule';

export const TEXT_LIMIT = 4000;
const MAX_EVENTS = 10;
const DAYS = '일월화수목금토';
const KEYWORDS = ['진료', '검진', '예약', '회의', '미팅', '면접', '수업', '강의', '모임', '약속', '공연', '행사', '상담', '방문', '시술', '접종', '설명회', '세미나', '워크숍', '시험', '결혼식', '돌잔치', '송년회', '신년회', '회식', '발표', '마감', '납부', '출발', '체크인', '배송'];

interface Found { date: string; uncertain: boolean; start: number; end: number; relative: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
function valid(y: number, m: number, d: number) { const t = utc(y, m, d); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; }

/** 한 줄에서 날짜 찾기(연도 있는 날짜 → 'N월 N일' → '12/3' 순서, 찾은 자리는 가려서 겹쳐 세지 않음) */
function datesIn(line: string, today: Date): Found[] {
  const out: Found[] = [];
  let rest = line;
  const take = (re: RegExp, make: (m: RegExpExecArray) => { y?: number; m: number; d: number; loose?: boolean } | null) => {
    for (const m of rest.matchAll(re)) {
      const v = make(m as RegExpExecArray);
      if (!v) continue;
      const at = m.index ?? 0, end = at + m[0].length;
      let { y } = v, uncertain = false;
      if (y === undefined) {
        y = today.getUTCFullYear();
        // 두 달 넘게 지난 날짜는 내년으로 짐작(넉 달 넘게 먼 날이 되면 확인 필요)
        if (valid(y, v.m, v.d) && utc(y, v.m, v.d).getTime() < today.getTime() - 60 * 86400000) { y += 1; uncertain = utc(y, v.m, v.d).getTime() > today.getTime() + 120 * 86400000; }
      }
      if (!valid(y, v.m, v.d)) continue;
      const date = ymd(utc(y, v.m, v.d));
      const weekday = line.slice(end).match(/^\s*\(?\s*([월화수목금토일])(?:요일)?\s*\)?/);
      if (weekday && DAYS.indexOf(weekday[1]) !== utc(y, v.m, v.d).getUTCDay()) uncertain = true; // 적힌 요일과 다르면 확인 필요
      if (v.loose && !weekday && !/\d\s*(?::\d{2}|시(?!간))/.test(line.slice(end)) && !KEYWORDS.some(k => line.includes(k))) continue; // '평점 3.5'처럼 날짜가 아닌 글은 뺀다
      out.push({ date, uncertain, start: at, end: end + (weekday?.[0].length ?? 0), relative: false });
      rest = rest.slice(0, at) + ' '.repeat(m[0].length) + rest.slice(end);
    }
  };
  take(/(?<!\d)(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?(?!\d)/g, m => ({ y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }));
  take(/(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, m => ({ m: Number(m[1]), d: Number(m[2]) }));
  take(/(?<![\d.:\-/])(\d{1,2})[./](\d{1,2})(?![\d.:/])/g, m => ({ m: Number(m[1]), d: Number(m[2]), loose: true }));
  if (out.length) return out.sort((a, b) => a.start - b.start);
  // 날짜 글자가 없으면 '내일'·'다음 주 화요일' 같은 말(시간이나 일정 낱말이 같은 줄에 있을 때만: '오늘도 감사합니다' 같은 글 막기)
  if (!/\d\s*(?::\d{2}|시(?!간))/.test(line) && !KEYWORDS.some(k => line.includes(k))) return out;
  const rel = line.match(/(오늘|내일|모레|글피)(?=$|[^가-힣]|오전|오후|아침|저녁|밤|에)/);
  if (rel) {
    const t = new Date(today); t.setUTCDate(t.getUTCDate() + { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 }[rel[1] as '오늘']);
    return [{ date: ymd(t), uncertain: false, start: rel.index ?? 0, end: (rel.index ?? 0) + rel[0].length, relative: true }];
  }
  const wd = line.match(/(?:(다음\s*주|이번\s*주|담주)\s*)?([월화수목금토일])요일/);
  if (wd) {
    const day = DAYS.indexOf(wd[2]), cur = today.getUTCDay(), mon = (x: number) => (x + 6) % 7; // 월요일 시작 주
    const next = wd[1] && wd[1].replace(/\s/g, '') !== '이번주';
    const delta = next ? 7 - mon(cur) + mon(day) : wd[1] ? mon(day) - mon(cur) : (day - cur + 7) % 7;
    const t = new Date(today); t.setUTCDate(t.getUTCDate() + delta);
    return [{ date: ymd(t), uncertain: !wd[1] && delta === 0, start: wd.index ?? 0, end: (wd.index ?? 0) + wd[0].length, relative: true }];
  }
  return out;
}

const TIME = /(오전|오후|아침|낮|저녁|밤|AM|PM|am|pm)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?!간)(?:\s*(\d{1,2})\s*분|\s*(반))?)/g;
function timesIn(text: string): string[] {
  const out: string[] = [];
  let period = '';
  for (const m of text.matchAll(TIME)) {
    const p = m[1] || period; // '오후 2시~4시'의 4시도 오후
    let h = Number(m[2]);
    const min = Number(m[3] ?? m[4] ?? (m[5] ? 30 : 0));
    if (p && h >= 1 && h <= 12) { h %= 12; if (/오후|저녁|밤|pm/i.test(p) || (p === '낮' && h < 6)) h += 12; }
    if (h > 23 || min > 59) continue;
    out.push(`${pad(h)}:${pad(min)}`);
    period = p;
    if (out.length === 2) break;
  }
  return out;
}

const clean = (s: string, max: number) => s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** 제목 후보: 날짜·시간·이름(…님)·전화번호·주소·안내 말투를 지운 줄 */
function titleFrom(line: string) {
  return clean(line
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\d{2,4}-\d{3,4}-\d{4}/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\S+님/g, ' ')
    .replace(/(?:일시|날짜|일자|시간|기간|때)\s*[:：]/g, ' ')
    .replace(TIME, ' ')
    .replace(/[()~～\-:：,，·*•※!.]/g, ' ')
    .replace(/(?:되었습니다|되셨습니다|예정입니다|입니다|있습니다|드립니다|합니다|해요|이에요|예요)\.?/g, ' ')
    .replace(/^\s*(?:에|부터|까지|은|는|이|가)\s+/, ' ')
    .replace(/\s+(?:에|부터|까지)\s*$/, ' '), 40);
}

/** 붙여넣은 글 → 일정 후보(최대 10개). today는 'YYYY-MM-DD'(한국 날짜). */
export function parseScheduleText(input: string, today: string): PhotoEvent[] {
  const text = String(input ?? '').slice(0, TEXT_LIMIT).replace(/\r/g, '');
  const base = new Date(`${today}T00:00:00Z`);
  if (!text.trim() || Number.isNaN(base.getTime())) return [];
  const lines = text.split('\n').map(l => l.trim());
  const sender = [...text.matchAll(/\[([^\]\n]{1,20})\]/g)].map(m => m[1].trim()).find(s => !/web\s*발신|광고|국외|국제|알림/i.test(s)) ?? '';
  const loc = text.match(/(?:장\s*소|위\s*치|주\s*소|오시는\s*곳)\s*[:：]\s*([^\n]+)/);
  const location = loc ? clean(loc[1].replace(/\d{2,4}-\d{3,4}-\d{4}/g, ''), 80) : '';
  const firstLine = lines.map(titleFrom).find(l => /[가-힣A-Za-z]{2}/.test(l)) ?? '';
  const out: PhotoEvent[] = [];
  const seen = new Set<string>();
  lines.forEach((line, i) => {
    const found = datesIn(line, base);
    found.forEach((f, k) => {
      // 이 날짜의 몫: 앞 날짜 끝 ~ 다음 날짜 시작(한 줄에 날짜가 여럿이면 시간·제목을 서로 빌려 오지 않게)
      const before = line.slice(k ? found[k - 1].end : 0, f.start), after = line.slice(f.end, found[k + 1]?.start ?? line.length);
      let times = timesIn(after);
      if (!times.length && found.length === 1) times = timesIn(before);
      if (!times.length && lines[i + 1] && !datesIn(lines[i + 1], base).length) times = timesIn(lines[i + 1]); // '일시: 12월 3일' 다음 줄의 시간
      const [start = null, endRaw = null] = times;
      const end = start && endRaw && endRaw > start ? endRaw : null;
      const keyword = KEYWORDS.find(k => line.includes(k)) ?? KEYWORDS.find(k => text.includes(k)) ?? '';
      const own = titleFrom(found.length === 1 ? `${before} ${after}` : after);
      const title = clean(sender ? `${sender} ${keyword && !sender.includes(keyword) ? keyword : ''}` : /[가-힣A-Za-z]{2}/.test(own) ? own : firstLine || keyword || '일정', 60);
      const key = `${f.date}|${start}|${title}`;
      if (seen.has(key) || out.length >= MAX_EVENTS) return;
      seen.add(key);
      out.push({ title, date: f.date, start, end, location, memo: '', source: clean(line, 120), uncertain: f.uncertain });
    });
  });
  return out.slice(0, MAX_EVENTS);
}
