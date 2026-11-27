// 글로 일정 넣기: 붙여넣은 예약 문자·메일·공지·대화 글에서 날짜·시간·반복·장소를 규칙으로 찾는다.
// 이 기기 안에서만 돌고 서버·AI로 보내지 않는다. 결과는 사진과 같은 후보 목록(사람이 고친 뒤 고른 것만 등록).
// 짐작한 것(연도·오전/오후·'2주 뒤 월요일'·시간만 있는 글)은 uncertain/guessed로 표시해 사람이 확인하게 한다.
import type { PhotoEvent, PhotoRepeat } from './photoSchedule';

export const TEXT_LIMIT = 4000;
const MAX_EVENTS = 10;
const DAYS = '일월화수목금토';
const KEYWORDS = ['진료', '검진', '교정', '발치', '치료', '스케일링', '예약', '회의', '미팅', '면접', '수업', '강의', '모임', '약속', '공연', '행사', '상담', '방문', '시술', '접종', '설명회', '세미나', '워크숍', '시험', '결혼식', '돌잔치', '송년회', '신년회', '회식', '발표', '마감', '납부', '출발', '체크인', '배송', '도착', '여행', '출장', '휴가', '교육', '연수', '캠프', '축제', '전시', '콘서트', '생일', '파티', '수술', '입원', '이사', '제출', '신청', '접수', '개강', '방학', '졸업', '입학', '레슨', '운동', '경기', '예매', '등산', '저녁', '점심'];
// 시간을 글자로 쓴 것('두 시 반')을 숫자로. '세 시간'·'한시적'은 시간이 아니다
const GENERIC = ['예약', '방문', '신청', '접수', '저녁', '점심'];
// 약속·계획을 말하는 끝말('주말 잘 보내세요'·'월말이라 바쁘네요' 같은 인사·혼잣말은 일정이 아님)
const PLAN = /가자|하자|보자|만나|모이|까지|예정|있어요|있음|있습니다|갈게|할게|가요|해요|합니다/;
/** 날짜 말이 일정인지: 일정 낱말·시간·약속 말 중 하나가 같은 줄에 있어야 한다 */
const looksPlanned = (line: string) => KEYWORDS.some(k => line.includes(k)) || /\d\s*(?::\d{2}|시(?!간))/.test(line) || (PLAN.test(line) && !/잘\s*보내|좋은|즐거운|행복|감사|수고|건강/.test(line));
const HOUR_WORDS: [string, number][] = [['열한', 11], ['열두', 12], ['다섯', 5], ['여섯', 6], ['일곱', 7], ['여덟', 8], ['아홉', 9], ['한', 1], ['두', 2], ['세', 3], ['네', 4], ['열', 10]];
export function normalizeTimeWords(line: string) {
  let out = line.replace(/정오/g, '12시').replace(/자정/g, '0시');
  for (const [word, n] of HOUR_WORDS) out = out.replace(new RegExp(`(^|[^가-힣])${word}\\s*시(?!간|적|작|장|청|민|대|절|즌)`, 'g'), `$1${n}시`);
  return out;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** 줄임말·영어 날짜를 규칙이 읽는 꼴로: 금욜→금요일, 담주→다음 주, 낼→내일, Dec 12, 2026→2026년 12월 12일 */
export function normalizeDateWords(line: string) {
  const mon = (w: string) => MONTHS.indexOf(w.slice(0, 3).toLowerCase()) + 1;
  return line
    .replace(/([월화수목금토일])욜/g, '$1요일')
    .replace(/담주/g, '다음 주')
    .replace(/(^|[^가-힣])낼(?=\s|$|오전|오후|아침|저녁|밤)/g, '$1내일')
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/gi, (_, m: string, d: string, y?: string) => `${y ? `${y}년 ` : ''}${mon(m)}월 ${d}일`)
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?(?:,?\s*(20\d{2}))?\b/gi, (_, d: string, m: string, y?: string) => `${y ? `${y}년 ` : ''}${mon(m)}월 ${d}일`);
}

interface Found { date: string; uncertain: boolean; start: number; end: number; relative: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Date, n: number) => { const t = new Date(d); t.setUTCDate(t.getUTCDate() + n); return t; };
const monOf = (x: number) => (x + 6) % 7; // 월요일 시작 주에서의 순서
function valid(y: number, m: number, d: number) { const t = utc(y, m, d); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; }
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 날짜 글자가 없는 줄의 '3일 뒤'·'2주 뒤 월요일'·'이번 주말'·'월말' 같은 말(일정 낱말이 없어도 뜻이 분명한 것만) */
function plainRelative(line: string, today: Date): Found | null {
  const at = (m: RegExpMatchArray) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  const wk = line.match(/(\d{1,2})\s*주\s*(?:뒤|후)\s*(?:의\s*)?([월화수목금토일])요일/);
  if (wk) { // 2주 뒤 월요일: 2주 뒤가 든 주(월요일 시작)의 그 요일. 말하는 사람마다 달라 확인 필요
    const base = addDays(today, Number(wk[1]) * 7);
    return { date: ymd(addDays(base, monOf(DAYS.indexOf(wk[2])) - monOf(base.getUTCDay()))), uncertain: true, ...at(wk), relative: true };
  }
  const after = line.match(/(\d{1,3})\s*(일|주|개월|달)\s*(?:뒤|후)/);
  if (after) {
    const n = Number(after[1]);
    if (after[2] === '일') return { date: ymd(addDays(today, n)), uncertain: false, ...at(after), relative: true };
    if (after[2] === '주') return { date: ymd(addDays(today, n * 7)), uncertain: false, ...at(after), relative: true };
    const y = today.getUTCFullYear(), m0 = today.getUTCMonth() + n, ty = y + Math.floor(m0 / 12), tm = (m0 % 12) + 1;
    return { date: ymd(utc(ty, tm, Math.min(today.getUTCDate(), lastDay(ty, tm)))), uncertain: false, ...at(after), relative: true };
  }
  const weekend = line.match(/(이번|다음|다다음)?\s*주말/);
  if (weekend) { // 토요일로 잡는다(일요일에 '이번 주말'이면 오늘)
    const dow = today.getUTCDay();
    let delta = dow === 0 ? 0 : 6 - dow;
    if (weekend[1] === '다음') delta += dow === 0 ? 6 : 7;
    if (weekend[1] === '다다음') delta += dow === 0 ? 13 : 14;
    return { date: ymd(addDays(today, delta)), uncertain: false, ...at(weekend), relative: true };
  }
  const end = line.match(/(이번\s*달|이달|다음\s*달)\s*말|월말|연말/);
  if (end) {
    let y = today.getUTCFullYear(), m = today.getUTCMonth() + 1;
    if (end[0] === '연말') m = 12;
    else if (/다음/.test(end[0])) { m += 1; if (m > 12) { m = 1; y += 1; } }
    return { date: ymd(utc(y, m, end[0] === '연말' ? 31 : lastDay(y, m))), uncertain: false, ...at(end), relative: true };
  }
  return null;
}

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
      const ranged = /^\s*[~～]\s*\d{1,2}[./]\d{1,2}/.test(line.slice(end)) || /\d{1,2}[./]\d{1,2}\s*[~～]\s*$/.test(line.slice(0, at));
      if (v.loose && !weekday && !ranged && !/\d\s*(?::\d{2}|시(?!간))/.test(line.slice(end)) && !KEYWORDS.some(k => line.includes(k))) continue; // '평점 3.5'처럼 날짜가 아닌 글은 뺀다
      out.push({ date, uncertain, start: at, end: end + (weekday?.[0].length ?? 0), relative: false });
      rest = rest.slice(0, at) + ' '.repeat(m[0].length) + rest.slice(end);
    }
  };
  take(/(?<!\d)(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?(?!\d)/g, m => ({ y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }));
  // '26.11.30, 26-11-30처럼 두 자리 연도(앞에 ' 가 붙기도 함)
  take(/(?<![\d.\-/])['’‘]?(\d{2})\s*([.\-/])\s*(\d{1,2})\s*\2\s*(\d{1,2})(?![\d.\-/])/g, m => (Number(m[1]) >= 20 && Number(m[1]) <= 39 ? { y: 2000 + Number(m[1]), m: Number(m[3]), d: Number(m[4]) } : null)); // '10.5.2' 같은 버전 번호는 빼려고 20~39년만
  take(/(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, m => ({ m: Number(m[1]), d: Number(m[2]) }));
  take(/(?<![\d.:\-/])(\d{1,2})[./](\d{1,2})(?![\d.:/])/g, m => ({ m: Number(m[1]), d: Number(m[2]), loose: true }));
  // '다음 달 3일'·'이번 달 30일'·'오는 28일'(월이 없는 날짜)
  for (const m of rest.matchAll(/(다음\s*달|담달|이번\s*달|오는)\s*(\d{1,2})\s*일/g)) {
    const n = Number(m[2]), word = m[1].replace(/\s/g, '');
    let y = today.getUTCFullYear(), mon = today.getUTCMonth() + 1;
    if (word === '다음달' || word === '담달' || (word === '오는' && n < today.getUTCDate())) { mon += 1; if (mon > 12) { mon = 1; y += 1; } }
    if (!valid(y, mon, n)) continue;
    out.push({ date: ymd(utc(y, mon, n)), uncertain: false, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, relative: false });
  }
  if (out.length) return out.sort((a, b) => a.start - b.start);
  const plain = looksPlanned(line) ? plainRelative(line, today) : null;
  if (plain) return [plain];
  // 날짜 글자가 없으면 '내일'·'다음 주 화요일' 같은 말(시간이나 일정 낱말이 같은 줄에 있을 때만: '오늘도 감사합니다' 같은 글 막기)
  if (!/\d\s*(?::\d{2}|시(?!간))/.test(line) && !KEYWORDS.some(k => line.includes(k))) return out;
  const rel = line.match(/(오늘|내일|모레|글피)(?=$|[^가-힣]|오전|오후|아침|저녁|밤|에)/);
  if (rel) return [{ date: ymd(addDays(today, { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 }[rel[1] as '오늘'])), uncertain: false, start: rel.index ?? 0, end: (rel.index ?? 0) + rel[0].length, relative: true }];
  const wd = line.match(/(?:(다다음\s*주|다음\s*주|이번\s*주)\s*)?([월화수목금토일])요일/);
  if (wd) {
    const day = DAYS.indexOf(wd[2]), cur = today.getUTCDay();
    const next = wd[1] && wd[1].replace(/\s/g, '') !== '이번주';
    const delta = (next ? 7 - monOf(cur) + monOf(day) : wd[1] ? monOf(day) - monOf(cur) : (day - cur + 7) % 7) + (wd[1]?.startsWith('다다음') ? 7 : 0);
    return [{ date: ymd(addDays(today, delta)), uncertain: !wd[1] && delta === 0, start: wd.index ?? 0, end: (wd.index ?? 0) + wd[0].length, relative: true }];
  }
  return out;
}

const TIME = /(오전|오후|아침|낮|저녁|밤|AM|PM|am|pm)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?!간)(?:\s*(\d{1,2})\s*분|\s*(반))?|(?=\s*(?:AM|PM|am|pm)\b))(?:\s*(AM|PM|am|pm)\b)?/g;
/** 시간 찾기. 오전·오후 없이 '3시'처럼 쓴 1~7시는 오후로 짐작한다(guessed: 사람이 확인) */
function timesIn(text: string): { times: string[]; guessed: boolean } {
  const out: string[] = [];
  let period = '', guessed = false;
  for (const m of text.matchAll(TIME)) {
    const p = m[1] || m[6] || period; // '오후 2시~4시'의 4시도 오후, '7:30 PM'처럼 뒤에 붙은 것도
    let h = Number(m[2]);
    const min = Number(m[3] ?? m[4] ?? (m[5] ? 30 : 0));
    if (p && h >= 1 && h <= 12) { h %= 12; if (/오후|저녁|밤|pm/i.test(p) || (p === '낮' && h < 6)) h += 12; }
    else if (!p && m[3] === undefined && h >= 1 && h <= 7) { h += 12; guessed = true; } // '3시 회의'는 새벽 3시보다 오후 3시가 흔하다
    if (h > 23 || min > 59) continue;
    out.push(`${pad(h)}:${pad(min)}`);
    period = p;
    if (out.length === 2) break;
  }
  return { times: out, guessed };
}

/** 반복: 매일·평일마다·매주 화·목·격주 수요일·화요일마다·매달 5일 */
function repeatIn(line: string): (PhotoRepeat & { day?: number }) | null {
  const days = (s: string) => [...new Set([...s.replace(/요일/g, '')].map(c => DAYS.indexOf(c)).filter(n => n >= 0))].sort((a, b) => monOf(a) - monOf(b));
  const name = (ds: number[]) => ds.map(d => DAYS[d]).join('·');
  if (/평일\s*(?:마다|매일)|주중\s*매일|매주\s*평일/.test(line)) return { frequency: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5], label: '평일마다' };
  if (/매일|날마다/.test(line)) return { frequency: 'daily', interval: 1, label: '매일' };
  const w = line.match(/(매주|격주|주마다)\s*([월화수목금토일](?=요일|\s*[,·/·및와과]|\s|$)(?:\s*요일)?(?:\s*[,·/·및와과]?\s*[월화수목금토일](?=요일|\s*[,·/·]|\s|$)(?:\s*요일)?)*)/) ?? line.match(/()([월화수목금토일](?:\s*[,·/·]\s*[월화수목금토일])*)\s*요일\s*마다/);
  if (w) { const ds = days(w[2]); if (ds.length) return { frequency: 'weekly', interval: w[1] === '격주' ? 2 : 1, weekdays: ds, label: `${w[1] === '격주' ? '격주' : '매주'} ${name(ds)}` }; }
  const mo = line.match(/(?:매달|매월)\s*(\d{1,2})\s*일/);
  if (mo && Number(mo[1]) >= 1 && Number(mo[1]) <= 31) return { frequency: 'monthly', interval: 1, day: Number(mo[1]), label: `매달 ${Number(mo[1])}일` };
  return null;
}
/** 반복의 첫 날: from 이후(포함) 규칙에 맞는 첫 날 */
function firstOccurrence(rep: PhotoRepeat & { day?: number }, from: Date): string {
  if (rep.frequency === 'daily') return ymd(from);
  if (rep.frequency === 'monthly' && rep.day) {
    for (let k = 0; k < 13; k++) {
      const y = from.getUTCFullYear(), m = from.getUTCMonth() + 1 + k, ty = y + Math.floor((m - 1) / 12), tm = ((m - 1) % 12) + 1;
      const d = utc(ty, tm, Math.min(rep.day, lastDay(ty, tm)));
      if (d.getTime() >= from.getTime()) return ymd(d);
    }
  }
  for (let k = 0; k < 7; k++) { const d = addDays(from, k); if (rep.weekdays?.includes(d.getUTCDay())) return ymd(d); }
  return ymd(from);
}

/** 장소: '@강남역 2번출구', '(3층 회의실)', '홍대에서' */
function placeIn(line: string): { place: string; raw: string } | null {
  const at = line.match(/@\s*([^,()\n!?.]{1,30})/);
  if (at) return { place: at[1].trim(), raw: at[0] };
  const paren = line.match(/[(（]\s*([^()（）]{1,30}?(?:층|호|실|역|관|센터|홀|점|학교|병원|카페|공원|체육관|강당|빌딩|타워))\s*[)）]/);
  if (paren) return { place: paren[1].trim(), raw: paren[0] };
  const en = line.match(/\bat\s+([A-Z][\w'&-]*(?:\s+[A-Z][\w'&-]*){0,3})/);
  if (en) return { place: en[1], raw: en[0] };
  const where = line.match(/(?:^|\s)([가-힣A-Za-z0-9]{2,15})에서(?=\s|$|[!.,])/);
  if (where && !/^(그|거기|여기|저기|집|회사)$/.test(where[1])) return { place: where[1], raw: where[0] };
  return null;
}

const clean = (s: string, max: number) => s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const DATE_TOKENS = [/(?<!\d)(?:20)?\d{2}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]\s*\d{1,2}\s*일?(?!\d)/g, /\d{1,2}\s*월\s*\d{1,2}\s*일/g, /(?<![\d:])\d{1,2}[./]\d{1,2}(?![\d:])/g, /[(（]\s*[월화수목금토일](?:요일)?\s*[)）]/g];
/** 제목 후보: 날짜·시간·이름(…님)·전화번호·주소·글머리표·반복 말·안내 말투를 지운 줄 */
function titleFrom(line: string) {
  let s = line.replace(/^(?:\s*(?:re|fw|fwd|답장|전달|회신)\s*[:：]\s*)+/i, ' '); // 메일 제목의 Re: Re: RE:·Fwd:
  for (const re of DATE_TOKENS) s = s.replace(re, ' ');
  return clean(s
    .replace(/^[\s■●▶▷◆◇○•·※*\-–]+/, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\d{2,4}-\d{3,4}-\d{4}/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\S+님/g, ' ')
    .replace(/^[가-힣A-Za-z]{1,8}\s*[:：]\s*(?=\S)/, ' ') // 대화 글의 '민지:' 같은 말한 사람
    .replace(/(?:일시|날짜|일자|시간|기간|때)\s*[:：]/g, ' ')
    .replace(TIME, ' ')
    .replace(/(?:매달|매월)\s*\d{1,2}\s*일/g, ' ')
    .replace(/(?:매주|격주|주마다|매일|날마다|평일마다)\s*(?:[월화수목금토일](?=요일|\s*[,·/·]|\s|$)(?:요일)?\s*[,·/·]?\s*)*/g, ' ')
    .replace(/[월화수목금토일](?:\s*[,·/·]\s*[월화수목금토일])*\s*요일\s*마다/g, ' ')
    .replace(/(?:하루\s*)?종일/g, ' ')
    .replace(/[()~～\-:：,，·*•※!?.'’‘]/g, ' ')
    .replace(/(?:되었습니다|되셨습니다|예정입니다|입니다|있습니다|드립니다|합니다|해요|이에요|예요|있어요|있음|잊지\s*마세요|잊지마세요)\.?/g, ' ')
    .replace(/(?:^|\s)(?:우리|그럼|그러면|일단|혹시)(?=\s)/g, ' ')
    .replace(/\s(?:하자|가자|보자)\s*$/, ' ')
    .replace(/^\s*(?:에|부터|까지|은|는|이|가|에서)\s+/, ' ')
    .replace(/\s+(?:에|부터|까지)\s*$/, ' '), 40);
}

/** 붙여넣은 글 → 일정 후보(최대 10개). today는 'YYYY-MM-DD'(한국 날짜). */
export function parseScheduleText(input: string, today: string): PhotoEvent[] {
  const text = String(input ?? '').slice(0, TEXT_LIMIT).replace(/\r/g, '');
  const base = new Date(`${today}T00:00:00Z`);
  if (!text.trim() || Number.isNaN(base.getTime())) return [];
  const lines = text.split('\n').map(l => normalizeDateWords(normalizeTimeWords(l.trim())));
  const sender = [...text.matchAll(/\[([^\]\n]{1,20})\]/g)].map(m => m[1].trim()).find(s => !/web\s*발신|광고|국외|국제|알림|요청|공지|안내|긴급|중요|필독|참고|회신|문의|확인|변경|재송부|공유|협조|예약|네이버|카카오|배송|택배|주문|결제/i.test(s)) ?? ''; // 예약·배송 앱 이름이나 [요청]·[공지] 같은 말머리는 보낸 곳(업체)이 아님
  const loc = text.match(/(?:장\s*소|위\s*치|주\s*소|오시는\s*곳)\s*[:：]\s*([^\n]+)/);
  const labelled = loc ? clean(loc[1].replace(/\d{2,4}-\d{3,4}-\d{4}/g, ''), 80) : '';
  // 인사말 줄은 제목 후보에서 뺀다
  const firstLine = lines.filter(l => !/^(?:안녕|수고|감사|고맙|반갑)/.test(l)).map(titleFrom).find(l => /[가-힣A-Za-z]{2}/.test(l)) ?? '';
  // '계약건명 : …', '행사명: …'처럼 이름을 적은 줄이 있으면 그것을 제목으로
  const named = clean(text.match(/(?:계약\s*건명|건\s*명|제\s*목|행사명|일정명|과정명|교육명|회의명|업체명|매장명|상호|병원명|가게명|지점명|예약처)\s*[:：]\s*([^\n]+)/)?.[1] ?? '', 60);
  // '작업일자 : 날짜'처럼 이름표만 있는 날짜 줄은 그 줄을 제목으로 쓰지 않는다('전시 기간: …' 한 줄뿐이면 날짜를 지운 첫 줄 '전시'가 제목)
  const labelOnly = /^[\s가-힣■●▶▷◆◇○•·※*\-]{0,10}(?:일자|일시|날짜|기간|시간|때|일)\s*[:：]/;
  const out: PhotoEvent[] = [];
  const seen = new Set<string>();
  const push = (e: PhotoEvent) => { const key = `${e.date}|${e.start}|${e.title}`; if (seen.has(key) || out.length >= MAX_EVENTS) return; seen.add(key); out.push(e); };
  lines.forEach((line, i) => {
    const place = placeIn(line);
    const location = labelled || place?.place || '';
    const plain = place ? line.replace(place.raw, ' ') : line; // 장소는 제목에서 뺀다
    // 일정 낱말: 무엇을 하는지(교정·상담)를 앞세우고 '예약·방문·신청' 같은 넓은 말은 그것밖에 없을 때만. 글에 나온 차례로 두 개까지
    const kw = (src: string) => { const all = KEYWORDS.filter(k => src.includes(k)).sort((a, b) => src.indexOf(a) - src.indexOf(b)); const specific = all.filter(k => !GENERIC.includes(k)); return (specific.length ? specific : all).slice(0, 2).join(' '); };
    const keyword = kw(line) || kw(text);
    // 반복 일정: 첫 날은 '12월부터'·'12월 3일부터'가 있으면 그날부터, 없으면 오늘부터
    const rep = looksPlanned(line) ? repeatIn(line) : null;
    if (rep) {
      const fromDate = datesIn(line, base)[0]?.date ?? (line.match(/(\d{1,2})\s*월\s*부터/) ? ymd(utc(base.getUTCFullYear() + (Number(line.match(/(\d{1,2})\s*월\s*부터/)![1]) < base.getUTCMonth() + 1 ? 1 : 0), Number(line.match(/(\d{1,2})\s*월\s*부터/)![1]), 1)) : today);
      const { times, guessed } = timesIn(line);
      const own = titleFrom(plain.replace(/\(?\s*\d{1,2}\s*월(?:\s*\d{1,2}\s*일)?\s*부터\s*\)?/g, ' '));
      const { day: _day, ...repeat } = rep;
      push({ title: clean(/[가-힣A-Za-z]{2}/.test(own) ? own : named || keyword || '반복 일정', 60), date: firstOccurrence(rep, new Date(`${fromDate}T00:00:00Z`)), start: times[0] ?? null, end: times[1] && times[0] && times[1] > times[0] ? times[1] : null, location, memo: '', source: clean(line, 120), uncertain: guessed, repeat, ...(guessed ? { guessed } : {}) });
      return;
    }
    let found = datesIn(line, base);
    // '11.26(목)~11.27(금)'처럼 물결로 이은 두 날짜는 일정 하나(시작 날짜)로, 끝 날짜는 메모에
    let until = '';
    if (found.length === 2 && /^\s*[~～\-]\s*$/.test(line.slice(found[0].end, found[1].start)) && found[1].date > found[0].date) {
      until = found[1].date; // 여러 날 일정: 등록할 때 날마다 같은 일정을 만들어 달력에서 한 줄로 이어 그린다
      found = [{ ...found[0], end: found[1].end }];
    }
    found.forEach((f, k) => {
      // 이 날짜의 몫: 앞 날짜 끝 ~ 다음 날짜 시작(한 줄에 날짜가 여럿이면 시간·제목을 서로 빌려 오지 않게)
      const before = line.slice(k ? found[k - 1].end : 0, f.start), after = line.slice(f.end, found[k + 1]?.start ?? line.length);
      let t = timesIn(after);
      if (!t.times.length && found.length === 1) t = timesIn(before);
      // '일시: 12월 3일' 다음 줄의 시간('시간: 오후 2시'처럼 시간만 있는 줄일 때만, 다른 일정 줄의 시간은 빌리지 않는다)
      const next = lines[i + 1];
      if (!t.times.length && next && !datesIn(next, base).length && !repeatIn(next) && (/^[\s■●▶▷◆◇○•·※*\-]*(?:시간|시각|일시|때)\s*[:：]/.test(next) || !/[가-힣A-Za-z]{2}/.test(titleFrom(next)))) t = timesIn(next);
      const [start = null, endRaw = null] = t.times;
      const end = start && endRaw && endRaw > start ? endRaw : null;
      const cut = (s: string) => (place ? s.replace(place.raw, ' ') : s);
      // 제목: 날짜 앞에 이름이 있으면('현장 실사는 11.26…') 그것을, 없으면 날짜 뒤에서 '진행·가능·부탁' 같은 안내 말 앞까지
      const lead = found.length === 1 ? titleFrom(cut(before)).replace(/(?:은|는|이|가|을|를|은요|에서|의)$/, '').trim() : '';
      const tail = titleFrom(cut(after).split(/\s(?:중\s)?(?:진행|가능|참고|부탁|예정|송부|확인|바랍|드립|하오니|합니다)/)[0]);
      const own = labelOnly.test(line) ? '' : /[가-힣A-Za-z]{2}/.test(lead) ? lead : tail;
      const delivery = /도착\s*예정|배송\s*예정/.test(line);
      // 보낸 곳([밝은미소치과])은 그 줄에 있거나, 이 줄 제목이 일정 낱말뿐일 때만 제목에 쓴다(한 글에 다른 일정이 섞여 있을 때)
      const ownWords = own.split(/\s+/).filter(w => w && !KEYWORDS.some(k => w.includes(k)));
      const useSender = sender && (line.includes(`[${sender}]`) || !ownWords.length);
      const title = clean(labelOnly.test(line) && named ? named : useSender ? `${sender} ${delivery ? '배송 도착' : keyword.split(' ').filter(k => !sender.includes(k)).join(' ')}` : /[가-힣A-Za-z]{2}/.test(own) ? own : named || (place && /보자|만나|모이/.test(line) ? `${place.place} 약속` : '') || firstLine || keyword || '일정', 60);
      // '(야간)'·'(주간)'·'(오전)'·'(종일)' 같은 때 표시는 시간이 없으면 메모로 남긴다
      const shift = start ? '' : (line.match(/[(（]\s*(야간|주간|심야|새벽|오전|오후|종일)\s*[)）]/)?.[1] ?? (/하루\s*종일/.test(line) ? '종일' : ''));
      push({ title, date: f.date, start, end, location, memo: shift ? `${shift} 작업`.replace(/(오전|오후|종일) 작업/, '$1') : '', ...(until ? { until } : {}), source: clean(line, 120), uncertain: f.uncertain || (t.guessed && !!start), ...(t.guessed && start ? { guessed: true } : {}) });
    });
  });
  // 날짜가 하나도 없고 시간만 있으면('오후 3시 미팅') 오늘 일정으로 짐작한다(확인 필요)
  if (!out.length) {
    const i = lines.findIndex(l => timesIn(l).times.length && /[가-힣A-Za-z]{2}/.test(titleFrom(l)));
    if (i >= 0) {
      const { times, guessed } = timesIn(lines[i]);
      const place = placeIn(lines[i]);
      push({ title: clean(titleFrom(place ? lines[i].replace(place.raw, ' ') : lines[i]) || named || '일정', 60), date: today, start: times[0], end: times[1] && times[1] > times[0] ? times[1] : null, location: labelled || place?.place || '', memo: '날짜가 없어 오늘로 넣었어요', source: clean(lines[i], 120), uncertain: true, ...(guessed ? { guessed } : {}) });
    }
  }
  return out.slice(0, MAX_EVENTS);
}
