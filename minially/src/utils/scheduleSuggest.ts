// 사진·글로 일정 넣기: 이미 적어 둔 내 일정을 보고, 찾은 후보의 카테고리를 정하고 예전에 쓰던 제목을 알려 준다.
// 이 기기 안에서만 계산한다(내 일정은 서버·AI로 보내지 않음).
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
}

const STOP = new Set(['일정', '예약', '안내', '확인', '방문', '진행', '예정', '오늘', '내일', '모레', '오전', '오후', '시간', '부탁', '드립니다', '합니다']);
// '과·가·로'처럼 낱말 끝과 헷갈리는 것(치과·미가·종로)은 떼지 않는다
const PARTICLE = /(?:은|는|을|를|에서|으로|에게)$/;

/** 비교용 낱말: 한글·영문·숫자 2글자 이상, 조사 떼고, 흔한 안내 말 빼고 */
export function words(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? [])
    .map(w => (w.length > 2 ? w.replace(PARTICLE, '') : w))
    .filter(w => w.length >= 2 && !STOP.has(w) && !/\d/.test(w)))];
}

/** 두 낱말이 같은 것을 가리키나: 같거나, 2글자 이상이 한쪽에 들어 있음(밝은미소치과 ↔ 치과) */
const same = (a: string, b: string) => a === b || (a.length >= 2 && b.includes(a)) || (b.length >= 2 && a.includes(b));

export function historyHint(candidate: { title: string; source?: string; location?: string }, schedules: Schedule[], categories: CategoryItem[]): HistoryHint {
  const mine = words(`${candidate.title} ${candidate.location ?? ''}`);
  const valid = new Set(categories.map(c => c.id));
  const votes = new Map<string, number>();
  const titles = new Map<string, { score: number; count: number; last: string }>();
  // 최근 일정부터 600개만 본다(오래된 습관보다 요즘 쓰는 방식)
  const recent = [...schedules].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 600);
  for (const s of recent) {
    const theirs = words(s.title);
    const score = mine.filter(w => theirs.some(t => same(w, t))).length;
    if (!score) continue;
    if (s.category && valid.has(s.category)) votes.set(s.category, (votes.get(s.category) ?? 0) + score);
    const t = titles.get(s.title) ?? { score: 0, count: 0, last: '' };
    titles.set(s.title, { score: Math.max(t.score, score), count: t.count + 1, last: t.last > s.date ? t.last : s.date });
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const best = [...titles.entries()].sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))[0];
  const pastTitle = best && best[0].trim() !== candidate.title.trim() ? best[0] : '';
  const habit = Boolean(pastTitle && best[1].count >= 2);
  if (ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) {
    const name = categories.find(c => c.id === ranked[0][0])?.name ?? '';
    return { category: ranked[0][0], reason: best ? `예전 ‘${best[0]}’과 같은 ${name}` : name, pastTitle, habit };
  }
  // 비슷한 일정이 없으면 카테고리 이름·주제 낱말로(같은 점수면 고르지 않음)
  const text = `${candidate.title} ${candidate.source ?? ''} ${candidate.location ?? ''}`;
  const byName = categories.map(c => ({ id: c.id, name: c.name, score: (c.name.length >= 2 && text.includes(c.name) ? 10 : 0) + noteTopicScore(text, c.name) })).filter(c => c.score > 0).sort((a, b) => b.score - a.score);
  if (byName.length && (byName.length === 1 || byName[0].score > byName[1].score)) return { category: byName[0].id, reason: `‘${byName[0].name}’ 낱말과 맞음`, pastTitle, habit };
  return { category: '', reason: '', pastTitle, habit };
}
