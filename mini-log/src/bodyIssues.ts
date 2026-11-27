import { CLICHES, MONEY_PROMISE } from './DraftCheck';

// 원고 본문 안에서 '어디가' 문제인지 위치를 찾는다(원고 점검 목록과 같은 기준). 화면에서 물결 밑줄과 '다음 문제'로 쓴다.
export type IssueKind = 'unsure' | 'money' | 'spell' | 'fact' | 'cliche' | 'long' | 'para';
export interface Issue { start: number; end: number; kind: IssueKind; reason: string }

const ORDER: IssueKind[] = ['unsure', 'money', 'spell', 'fact', 'cliche', 'long', 'para']; // 겹치면 앞쪽(더 급한 것)을 남긴다
// 흔히 틀리는 맞춤법·띄어쓰기(규칙만, AI 없이). [틀린 모양, 바른 모양]. 다른 낱말 안에 들어가 오해하기 쉬운 것은 넣지 않았다
export const SPELLING: [RegExp, string][] = [
  [/되요/g, '돼요'], [/됬/g, '됐'], [/되서/g, '돼서'], [/뵈요/g, '봬요'], [/몇일/g, '며칠'], [/왠만/g, '웬만'], [/웬지/g, '왠지'], [/금새/g, '금세'],
  [/(할|갈|볼|줄|올|드릴|해줄|알려줄)께요/g, '$1게요'], [/어떻해/g, '어떡해'], [/오랫만/g, '오랜만'], [/희안하/g, '희한하'], [/역활/g, '역할'],
  [/일일히/g, '일일이'], [/깨끗히/g, '깨끗이'], [/곰곰히/g, '곰곰이'], [/틈틈히/g, '틈틈이'], [/설겆이/g, '설거지'], [/어의없/g, '어이없'],
  [/않되/g, '안 되'], [/않돼/g, '안 돼'], [/구지 /g, '굳이 '], [/예기(?!치)/g, '얘기'], [/할려고/g, '하려고'], [/햇갈/g, '헷갈'], [/짜집기/g, '짜깁기'],
];

const FACT = [/\d[\d,]*\s*(?:만\s*)?원/g, /\d{1,2}\s*월\s*\d{1,2}\s*일/g, /\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/g, /\d+\s*분\s*(?:대기|기다|웨이팅|걸)/g, /\d{4}\s*년/g];

export function findIssues(body: string, sources?: string): Issue[] {
  const found: Issue[] = [];
  const add = (start: number, end: number, kind: IssueKind, reason: string) => { if (end > start) found.push({ start, end, kind, reason }); };
  for (const m of body.matchAll(/\[작성자 확인 필요\]/g)) add(m.index, m.index + m[0].length, 'unsure', '직접 겪은 내용으로 채워 주세요');
  const money = new RegExp(MONEY_PROMISE.source, 'g');
  for (const m of body.matchAll(money)) add(m.index, m.index + m[0].length, 'money', '수익·원금 보장 표현은 쓰면 안 돼요');
  for (const [re, right] of SPELLING) for (const m of body.matchAll(re)) {
    const word = m[0].trimEnd();
    add(m.index, m.index + word.length, 'spell', `'${word}' → '${m[0].replace(new RegExp(re.source), right).trimEnd()}'(맞춤법)`);
  }
  if (sources !== undefined) {
    const src = sources.replace(/[\s,]/g, '');
    for (const re of FACT) for (const m of body.matchAll(re)) {
      const key = m[0].trim().replace(/[\s,]/g, '').replace(/(대기|기다|웨이팅|걸)$/, '');
      if (!src.includes(key)) add(m.index, m.index + m[0].trimEnd().length, 'fact', '경험 칸·사진 메모에 없는 숫자예요. 맞는지 봐 주세요');
    }
  }
  for (const w of CLICHES) { let i = body.indexOf(w); while (i >= 0) { add(i, i + w.length, 'cliche', 'AI 티 나는 상투 표현이에요'); i = body.indexOf(w, i + w.length); } }
  // 문장: 마침표·물음표·느낌표·물결 뒤 띄어쓰기나 줄바꿈에서 나눈다(원고 점검과 같은 기준, 60자 넘으면 긴 문장)
  for (const m of body.matchAll(/[^\n.!?~]+[.!?~]*/g)) {
    const s = m[0].trim();
    if (s.length > 60 && !/^\[사진/.test(s)) { const at = m.index + m[0].indexOf(s); add(at, at + s.length, 'long', `${s.length}자: 두 문장으로 나누면 읽기 쉬워요`); }
  }
  for (const m of body.matchAll(/[^\n]+/g)) if (m[0].replace(/\s/g, '').length > 300) add(m.index, m.index + m[0].length, 'para', '300자 넘는 문단이에요. 두세 줄로 나눠 주세요');
  // 겹치는 곳: 급한 것부터 자리를 차지하고, 이미 차지한 곳과 겹치면 뺀다(긴 문장 안의 상투 표현은 상투 표현만 보이게 긴 문장을 남기지 않음)
  found.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.start - b.start);
  const kept: Issue[] = [];
  for (const f of found) if (!kept.some(k => f.start < k.end && k.start < f.end)) kept.push(f);
  return kept.sort((a, b) => a.start - b.start).slice(0, 200);
}
