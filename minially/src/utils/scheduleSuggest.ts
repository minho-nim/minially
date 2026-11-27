// 사진·글로 일정 넣기: 이미 적어 둔 내 일정을 보고, 찾은 후보의 카테고리를 정하고 예전에 쓰던 제목·시간·장소를 알려 준다.
// 이 기기 안에서만 계산한다(내 일정은 서버·AI로 보내지 않음). 계정마다 그 계정의 카테고리·일정만 본다.
// 비슷하지만 다른 일정(치과 정기검진 ↔ 치과 교정 상담, 피아노 레슨 ↔ 피아노 연주회, 치과 ↔ 아이 치과)은 같은 일정으로 보지 않는다:
// 제목을 바꾸거나 시간·장소를 빌려 오지 않고, 카테고리만 '비슷함'으로 추천한다.
import type { CategoryItem, Schedule } from '../types';
import { noteTopicScore } from './noteSuggestions';

export interface HistoryHint {
  /** 고른 카테고리 id(못 정하면 '') */
  category: string;
  /** 왜 골랐는지(화면에 보여 줌) */
  reason: string;
  /** 예전에 비슷한 일정에 쓴 제목(지금 제목과 다를 때만) */
  pastTitle: string;
  /** 같은 제목을 두 번 이상 썼으면 true → 그 제목으로 바로 맞춘다 */
  habit: boolean;
  /** 'same': 같은 일정으로 봄, 'similar': 낱말은 겹치지만 다른 일정일 수 있음, '': 예전 일정 없음 */
  match: 'same' | 'similar' | '';
  /** 같은 일정의 예전 값(사람이 확인할 수 있게 '예전 기준'으로만 채운다) */
  borrow?: { start?: string; end?: string; location?: string; reminderMinutes?: number | null };
  /** 같은 날 이미 있는 거의 같은 일정 제목(두 번 넣지 않게) */
  duplicate?: string;
  /** 같은 일정을 일정한 간격으로 해 왔으면(매주·격주) 반복 제안 */
  cadence?: { days: 7 | 14; label: string; weekday: number };
}

const STOP = new Set(['일정', '예약', '안내', '확인', '방문', '진행', '예정', '오늘', '내일', '모레', '오전', '오후', '시간', '부탁', '드립니다', '합니다']);
// '과·가·로'처럼 낱말 끝과 헷갈리는 것(치과·미가·종로)은 떼지 않는다
const PARTICLE = /(?:은|는|을|를|에서|으로|에게)$/;
/** 무엇을 하는지 나타내는 말: 양쪽에 있는데 서로 다르면 다른 일정이다(진료·예약·방문은 너무 넓어 뺀다) */
const ACTIONS = ['검진', '교정', '발치', '스케일링', '상담', '수술', '시술', '접종', '치료', '레슨', '수업', '강습', '연주회', '발표회', '공연', '조율', '회의', '회식', '미팅', '면접', '시험', '발표', '교육', '세미나', '워크숍', '여행', '출장', '파티', '생일', '결혼식', '돌잔치', '집들이', '이사', '청소', '수리', '점검', '설치', '계약', '납부', '등원', '하원', '체험', '상견례', '모임', '운동', '등산', '촬영', '면회'];
/** 누구 일인지: 다르면 다른 일정(치과 ↔ 아이 치과), 같으면 그 사람 카테고리에 힘을 싣는다 */
const PEOPLE = ['아이', '아들', '딸', '엄마', '아빠', '남편', '아내', '와이프', '부모님', '어머니', '아버지', '시댁', '처가', '할머니', '할아버지', '동생', '언니', '오빠', '누나', '첫째', '둘째', '막내', '강아지'];

/** 비교용 낱말: 한글·영문·숫자 2글자 이상, 조사 떼고, 흔한 안내 말 빼고 */
export function words(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? [])
    .map(w => (w.length > 2 ? w.replace(PARTICLE, '') : w))
    .filter(w => w.length >= 2 && !STOP.has(w) && !/\d/.test(w)))];
}

/** 두 낱말이 같은 것을 가리키나: 같거나, 한쪽이 다른 쪽의 끝(밝은미소치과 ↔ 치과, 정기검진 ↔ 검진). '회의실'은 '회의'가 아니다 */
const same = (a: string, b: string) => a === b || (a.length >= 2 && b.endsWith(a)) || (b.length >= 2 && a.endsWith(b));
const acts = (ws: string[]) => ws.filter(w => ACTIONS.some(a => same(w, a)));
const people = (text: string) => PEOPLE.filter(p => new RegExp(`(^|[^가-힣])${p}`).test(text)).sort().join(',');
/** 같은 일정인가: 낱말이 겹치고, 하는 일이 서로 다르지 않고, 누구 일인지가 같다 */
function relation(candidate: string, past: string): 'same' | 'similar' | '' {
  const a = words(candidate), b = words(past);
  if (!a.some(w => b.some(t => same(w, t)))) return '';
  const actA = acts(a).filter(w => !acts(b).some(t => same(w, t))), actB = acts(b).filter(w => !acts(a).some(t => same(w, t)));
  if ((actA.length && actB.length) || people(candidate) !== people(past)) return 'similar';
  return 'same';
}
/** 거절 기억 열쇠: 이 제목(낱말)을 이 예전 제목으로 바꾸지 말 것 */
export const rejectKey = (candidate: string, past: string) => `${words(candidate).sort().join(' ')}→${past.trim()}`;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const mostCommon = <T,>(list: T[]) => { const n = new Map<T, number>(); for (const v of list) n.set(v, (n.get(v) ?? 0) + 1); return [...n.entries()].sort((a, b) => b[1] - a[1])[0]; };

export function historyHint(candidate: { title: string; source?: string; location?: string; date?: string; start?: string | null }, schedules: Schedule[], categories: CategoryItem[], opts: { rejected?: string[] } = {}): HistoryHint {
  const mine = words(`${candidate.title} ${candidate.location ?? ''}`);
  const who = people(candidate.title);
  const valid = new Set(categories.map(c => c.id));
  const votes = new Map<string, number>();
  const titles = new Map<string, { score: number; count: number; last: string; rel: 'same' | 'similar' }>();
  // 최근 일정부터 600개만 본다(오래된 습관보다 요즘 쓰는 방식)
  const recent = [...schedules].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 600);
  for (const s of recent) {
    const theirs = words(s.title);
    const score = mine.filter(w => theirs.some(t => same(w, t))).length;
    if (!score) continue;
    const rel = relation(candidate.title, s.title) || 'similar';
    // 같은 일정이면 세 배, 같은 사람(아이·엄마) 일정이면 두 배, 사람이 다르면 반
    const weight = (rel === 'same' ? 3 : 1) * (who ? (people(s.title) === who ? 2 : 0.5) : 1);
    if (s.category && valid.has(s.category)) votes.set(s.category, (votes.get(s.category) ?? 0) + score * weight);
    const t = titles.get(s.title) ?? { score: 0, count: 0, last: '', rel };
    titles.set(s.title, { score: Math.max(t.score, score * (rel === 'same' ? 2 : 1)), count: t.count + 1, last: t.last > s.date ? t.last : s.date, rel });
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const best = [...titles.entries()].sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))[0];
  const rel: HistoryHint['match'] = best ? best[1].rel : '';
  const rejected = best ? (opts.rejected ?? []).includes(rejectKey(candidate.title, best[0])) : false;
  // 제목은 같은 일정일 때만 바꾸거나 권한다(비슷하기만 하면 그대로)
  const pastTitle = best && rel === 'same' && best[0].trim() !== candidate.title.trim() ? best[0] : '';
  const habit = Boolean(pastTitle && best[1].count >= 2 && !rejected);
  const extra = rel === 'same' && best ? sameExtras(best[0], recent, candidate) : {};
  const duplicate = candidate.date ? schedules.find(s => s.date === candidate.date && relation(candidate.title, s.title) === 'same' && (!candidate.start || !s.startTime || s.startTime === candidate.start))?.title : undefined;
  const base = { pastTitle, habit, match: rel, ...extra, ...(duplicate ? { duplicate } : {}) };
  if (ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) {
    const name = categories.find(c => c.id === ranked[0][0])?.name ?? '';
    const reason = !best ? name : rel === 'same' ? `예전 ‘${best[0]}’과 같은 ${name}` : `비슷한 예전 ‘${best[0]}’의 ${name}(다른 일정일 수 있어요)`;
    return { category: ranked[0][0], reason, ...base };
  }
  // 비슷한 일정이 없으면 카테고리 이름·주제 낱말로(같은 점수면 고르지 않음)
  const text = `${candidate.title} ${candidate.source ?? ''} ${candidate.location ?? ''}`;
  const byName = categories.map(c => ({ id: c.id, name: c.name, score: (c.name.length >= 2 && text.includes(c.name) ? 10 : 0) + noteTopicScore(text, c.name) })).filter(c => c.score > 0).sort((a, b) => b.score - a.score);
  if (byName.length && (byName.length === 1 || byName[0].score > byName[1].score)) return { category: byName[0].id, reason: `‘${byName[0].name}’ 낱말과 맞음`, ...base };
  return { category: '', reason: '', ...base };
}

/** 같은 일정(같은 제목)의 예전 값: 자주 쓴 시작 시각·걸린 시간·장소·알림, 매주·격주 간격 */
function sameExtras(title: string, recent: Schedule[], candidate: { start?: string | null }): Pick<HistoryHint, 'borrow' | 'cadence'> {
  const list = recent.filter(s => s.title === title);
  const out: Pick<HistoryHint, 'borrow' | 'cadence'> = {};
  const borrow: NonNullable<HistoryHint['borrow']> = {};
  const starts = list.map(s => s.startTime).filter((t): t is string => !!t);
  const common = mostCommon(starts);
  if (common && (common[1] >= 2 || starts.length === 1)) borrow.start = common[0];
  const lengths = list.filter(s => s.startTime && s.endTime && s.endTime > s.startTime).map(s => toMin(s.endTime!) - toMin(s.startTime!));
  const len = mostCommon(lengths);
  const from = candidate.start ?? borrow.start;
  if (len && from) borrow.end = toTime(toMin(from) + len[0]);
  const place = list.map(s => s.memo?.match(/(?:^|\n)장소:\s*([^\n]+)/)?.[1]?.trim()).find(Boolean);
  if (place) borrow.location = place;
  const remind = list.find(s => s.reminderMinutes !== undefined);
  if (remind) borrow.reminderMinutes = remind.reminderMinutes ?? null;
  if (Object.keys(borrow).length) out.borrow = borrow;
  // 예전 날짜 간격이 모두 7일(또는 14일)이고 세 번 이상이면 반복 제안
  const days = [...new Set(list.map(s => s.date))].sort();
  if (days.length >= 3) {
    const gaps = days.slice(1).map((d, i) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${days[i]}T00:00:00Z`)) / 86400000)).slice(-4);
    const g = gaps[0];
    if ((g === 7 || g === 14) && gaps.every(x => x === g)) out.cadence = { days: g, label: g === 7 ? '매주' : '격주', weekday: new Date(`${days[days.length - 1]}T00:00:00Z`).getUTCDay() };
  }
  return out;
}
