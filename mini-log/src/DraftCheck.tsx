import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import type { Guide } from './GuideFill';

// 원고 점검: 연결된 체험단 가이드(키워드·해시태그·사진·글자 수·링크) + 기본 검색 노출 점검
export interface CheckItem { label: string; ok: boolean; hint?: string }

const bodyChars = (body: string) => body.replace(/\[사진\s*\d+\]/g, '').replace(/\s/g, '').length;
const norm = (s: string) => s.replace(/\s/g, '').toLowerCase();

export function checkDraft(d: { title: string; body: string; hashtags: string[]; photos: number }, guide: Guide | null): CheckItem[] {
  const items: CheckItem[] = [];
  const all = norm(`${d.title}\n${d.body}`);
  const tags = d.hashtags.map(norm);
  const chars = bodyChars(d.body);
  if (guide) {
    for (const k of guide.keywords) items.push({ label: `키워드 '${k}'`, ok: all.includes(norm(k)), hint: '제목이나 본문에 넣어 주세요' });
    for (const h of guide.hashtags) items.push({ label: `해시태그 #${h}`, ok: tags.includes(norm(h)), hint: '해시태그 칸에 넣어 주세요' });
    if (guide.min_photos) items.push({ label: `사진 ${guide.min_photos}장 이상`, ok: d.photos >= guide.min_photos, hint: `지금 ${d.photos}장` });
    if (guide.min_chars) items.push({ label: `${guide.min_chars.toLocaleString('ko-KR')}자 이상(공백 빼고)`, ok: chars >= guide.min_chars, hint: `지금 ${chars.toLocaleString('ko-KR')}자` });
    for (const link of guide.links) items.push({ label: '링크 넣기', ok: d.body.includes(link), hint: link });
    for (const w of guide.avoid ?? []) items.push({ label: `쓰지 말 것 '${w}'`, ok: !all.includes(norm(w)), hint: '가이드에서 쓰지 말라고 한 말이에요' });
  }
  // 가이드가 없어도 보는 기본 점검
  const first = guide?.keywords[0];
  if (first) items.push({ label: '제목에 첫 키워드', ok: norm(d.title).includes(norm(first)), hint: `'${first}'을(를) 제목 앞쪽에` });
  items.push({ label: '제목 길이 15~40자', ok: d.title.trim().length >= 15 && d.title.trim().length <= 40, hint: `지금 ${d.title.trim().length}자` });
  if (!guide?.min_chars) items.push({ label: '본문 1,000자 이상(공백 빼고)', ok: chars >= 1000, hint: `지금 ${chars.toLocaleString('ko-KR')}자` });
  if (!guide?.min_photos) items.push({ label: '사진 5장 이상', ok: d.photos >= 5, hint: `지금 ${d.photos}장` });
  items.push({ label: '해시태그 3개 이상', ok: d.hashtags.length >= 3, hint: `지금 ${d.hashtags.length}개` });
  return items;
}

// AI 글에 흔한 상투 표현(내 말투가 아닌 티가 나는 곳). 두 개 넘게 나오면 알려 준다.
export const CLICHES = ['결론적으로', '다양한', '소중한 시간', '특별한 경험', '완벽한', '에 대해 알아보', '마무리하며', '도움이 되셨', '많은 분들', '한마디로', '그야말로', '매력적인', '잊지 못할', '꼭 한번', '강력 추천'];
const AD_WORDS = /제공받|협찬|광고|원고료|소정의|지원받/;
/** 표시 문구를 찾는 본문 앞부분 길이(글자) */
const AD_FRONT = 300;
export const MONEY_PROMISE = /수익\s*보장|원금\s*보장|무조건\s*(수익|돈)|100%\s*수익|확정\s*수익|손실\s*없/;
const count = (text: string, word: string) => (word ? text.split(word).length - 1 : 0);

/**
 * 작성 품질 점검(앱 기준). 네이버 공식 점수나 노출 보장이 아니라, 읽기 쉽고 빠뜨린 게 없는지 보는 체크리스트다.
 * keyword는 가이드 첫 키워드 → 첫 해시태그 순으로 쓴다.
 */
export function qualityCheck(d: { title: string; body: string; hashtags: string[]; photos: number; postType?: string; sponsored?: boolean }, guide: Guide | null): CheckItem[] {
  const items: CheckItem[] = [];
  const keyword = guide?.keywords[0] ?? d.hashtags[0] ?? '';
  const flat = norm(d.body);
  if (keyword && d.body.trim()) {
    const n = count(flat, norm(keyword));
    items.push({ label: `핵심어 '${keyword}' 본문 2~8번`, ok: n >= 2 && n <= 8, hint: n > 8 ? `${n}번: 너무 많이 반복해요` : `지금 ${n}번` });
  }
  const paragraphs = d.body.split(/\n\s*\n|\n/).map(p => p.trim()).filter(p => p && !/^\[사진/.test(p));
  const long = paragraphs.filter(p => p.replace(/\s/g, '').length > 300).length;
  if (paragraphs.length) items.push({ label: '긴 문단 없음(300자 넘는 문단)', ok: long === 0, hint: `${long}개: 휴대폰에서 읽기 힘들어요. 두세 줄로 나눠 주세요` });
  if (bodyChars(d.body) >= 1500) {
    const heads = d.body.split('\n').map(l => l.trim()).filter(l => l.length >= 2 && l.length <= 25 && !/[.!?~요다]$/.test(l) && !/^\[사진/.test(l) && !/^#/.test(l)).length;
    items.push({ label: '소제목 2개 이상(긴 글)', ok: heads >= 2, hint: '■ 메뉴, ■ 분위기처럼 짧은 줄로 나눠 주세요' });
  }
  if (d.photos > 0 && /\[사진\s*\d+\]/.test(d.body)) {
    const used = [...d.body.matchAll(/\[사진\s*(\d+)\]/g)].map(m => Number(m[1]));
    const missing = Array.from({ length: d.photos }, (_, i) => i + 1).filter(n => !used.includes(n));
    const twice = [...new Set(used.filter((n, i) => used.indexOf(n) !== i))];
    const over = [...new Set(used.filter(n => n > d.photos))];
    items.push({ label: '사진 자리 빠짐·겹침 없음', ok: !missing.length && !twice.length && !over.length,
      hint: [missing.length && `빠짐: 사진 ${missing.join(', ')}`, twice.length && `두 번: 사진 ${twice.join(', ')}`, over.length && `없는 사진: ${over.join(', ')}`].filter(Boolean).join(' · ') });
  }
  const sentences = d.body.split(/(?<=[.!?~])\s+|\n/).map(s => s.trim().replace(/[.!?~\s]+$/, '')).filter(s => s.length > 5);
  let run = 1, worst = 1, ending = '';
  for (let i = 1; i < sentences.length; i++) {
    const a = sentences[i - 1].slice(-3), b = sentences[i].slice(-3);
    run = a === b ? run + 1 : 1;
    if (run > worst) { worst = run; ending = b; }
  }
  if (sentences.length >= 5) items.push({ label: '같은 끝맺음 4번 연속 없음', ok: worst < 4, hint: `'~${ending}'로 ${worst}번 연속: 말끝을 섞어 주세요` });
  const cliches = CLICHES.filter(w => d.body.includes(w));
  if (d.body.trim()) items.push({ label: 'AI 티 나는 상투 표현 2개 이하', ok: cliches.length <= 2, hint: cliches.join(', ') });
  // 후기 글은 칭찬만 있으면 광고처럼 읽힌다: 아쉬운 점 한 줄
  if (['food', 'cafe', 'product', 'beauty', 'fashion', 'sponsored'].includes(d.postType ?? '') && bodyChars(d.body) >= 200)
    items.push({ label: '아쉬운 점 한 줄(후기 글)', ok: /아쉬|단점|불편|별로|흠이라면/.test(d.body), hint: '예) 웨이팅이 길었어요, 주차가 불편했어요' });
  // 공정위 추천·보증 심사지침: 경제적 대가 표시는 제목이나 게시물 첫 부분에(뒤에만 있으면 알려 준다)
  if (d.postType === 'sponsored' || guide || d.sponsored) {
    const front = AD_WORDS.test(d.title) || AD_WORDS.test(d.body.slice(0, AD_FRONT));
    items.push({ label: '광고·협찬 표시 문구', ok: front, hint: AD_WORDS.test(d.body) ? '뒤쪽에만 있어요. 제목이나 본문 첫 부분으로 옮겨 주세요(공정위 지침)' : '제목이나 본문 첫 부분에 넣어 주세요. 예) 업체로부터 제품을 제공받아 솔직하게 작성했어요' });
  }
  if (MONEY_PROMISE.test(d.body)) items.push({ label: '수익·원금 보장 표현 없음', ok: false, hint: '금융 글에 보장 표현은 쓰면 안 돼요' });
  const unsure = count(d.body, '[작성자 확인 필요]');
  if (unsure) items.push({ label: "'[작성자 확인 필요]' 모두 고치기", ok: false, hint: `${unsure}곳 남음` });
  return items;
}

/**
 * 사실 확인: 본문에 나온 가격·날짜·시간·대기 시간 중 경험 칸과 사진 메모에 없는 것을 찾는다.
 * AI가 지어냈을 수 있는 숫자라 사람이 맞는지 봐야 한다(틀렸다는 뜻은 아님).
 */
export function factCheck(body: string, sources: string): string[] {
  const src = sources.replace(/[\s,]/g, '');
  const patterns = [/\d[\d,]*\s*(?:만\s*)?원/g, /\d{1,2}\s*월\s*\d{1,2}\s*일/g, /\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/g, /\d+\s*분\s*(?:대기|기다|웨이팅|걸)/g, /\d{4}\s*년/g];
  const found = new Set<string>();
  for (const re of patterns) for (const m of body.matchAll(re)) {
    const raw = m[0].trim();
    const key = raw.replace(/[\s,]/g, '').replace(/(대기|기다|웨이팅|걸)$/, '');
    if (!src.includes(key)) found.add(raw.replace(/\s*(대기|기다|웨이팅|걸)$/, ''));
  }
  return [...found].slice(0, 12);
}

/**
 * AI 요약(네이버 AI 브리핑·AI 검색 답변)에 인용되기 쉬운 글 모양을 본다. 미니로그 기준이며 네이버 공식 기준이 아니다.
 * 본문이 300자(공백 빼고) 넘을 때만 보고, 해당하는 글에만 항목을 더한다.
 */
export function briefingCheck(d: { body: string; postType?: string }, keyword: string): CheckItem[] {
  if (bodyChars(d.body) < 300) return [];
  const text = d.body.replace(/\[사진\s*\d+\]/g, '').trim();
  const items: CheckItem[] = [];
  if (keyword) items.push({ label: `첫 40자에 핵심어 '${keyword}'`, ok: norm(text.replace(/\s+/g, ' ').slice(0, 40)).includes(norm(keyword)), hint: '첫 문장에 무엇·어디·결론을 먼저 적어 주세요' });
  const longOnes = text.split(/(?<=[.!?~])\s+|\n/).map(s => s.trim()).filter(s => s.length > 60).length;
  items.push({ label: '긴 문장(60자 넘음) 3개 이하', ok: longOnes <= 3, hint: `${longOnes}개: 두 문장으로 나누면 읽기 쉬워요` });
  if (/\d[\d,]*\s*(?:만\s*)?원|영업\s*시간|운영\s*시간/.test(text))
    items.push({ label: '가격·영업시간에 기준일', ok: /기준|\d{4}\s*[.년]\s*\d{1,2}/.test(text), hint: '예) 2026년 11월 기준. 바뀔 수 있는 정보예요' });
  if (['food', 'cafe', 'travel', 'info', 'product'].includes(d.postType ?? '') && bodyChars(d.body) >= 800) {
    const rows = text.split('\n').filter(l => /^\s*([-•·▶✔]|\d+[.)])\s*\S/.test(l) || /^[^:：\n]{1,12}[:：]\s*\S/.test(l.trim())).length;
    items.push({ label: "정리 줄 3개 이상('항목: 값'·목록)", ok: rows >= 3, hint: '위치·가격·영업시간을 "가격: 4,500원"처럼 줄로 정리하면 요약에 잘 잡혀요' });
  }
  if (d.postType === 'info') items.push({ label: '정보 글 출처 표시', ok: /출처|참고\s*[:：]|https?:\/\//.test(text), hint: '예) 출처: 국세청 안내(2026.11)' });
  return items;
}

/** 재탕 경고: 낱말(2글자 이상)이 70% 넘게 겹치는 다른 원고 제목. 같은 글을 또 쓰면 블로그 품질이 떨어진다 */
export function similarTitle(title: string, others: string[]): string | null {
  const words = (t: string) => new Set((t.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? []));
  const mine = words(title);
  if (mine.size < 2) return null;
  for (const other of others) {
    const theirs = words(other);
    if (theirs.size < 2) continue;
    const shared = [...mine].filter(w => theirs.has(w)).length;
    if (shared / Math.min(mine.size, theirs.size) >= 0.7) return other;
  }
  return null;
}

/** 통과 비율을 도넛으로 */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 22, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  const color = pct === 1 ? 'var(--ok, #2E8B57)' : pct >= 0.6 ? 'var(--app-accent, #E4A11B)' : '#D0574B';
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`${total}개 중 ${done}개 통과`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--app-soft, #eee)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 28 28)" />
      <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">{done}/{total}</text>
    </svg>
  );
}

/** 점검 항목을 고칠 칸으로 이동(해시태그·사진·제목·본문) */
function goFix(label: string) {
  const id = /해시태그/.test(label) ? 'tags' : /사진/.test(label) && !/자리/.test(label) ? 's1' : /제목/.test(label) && !/비슷한/.test(label) ? 'title' : 'body';
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
}

export function DraftCheck({ draftId, title, body, hashtags, photos, postType, sources, otherTitles = [] }: { draftId: string; title: string; body: string; hashtags: string[]; photos: number; postType?: string; sources?: string; otherTitles?: string[] }) {
  const [guide, setGuide] = useState<{ brand: string; guide: Guide } | null>(null);
  // 가이드가 없어도 협찬에 연결된 원고면 광고 표시 문구를 본다
  const [sponsored, setSponsored] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let alive = true;
    api<{ campaigns: { brand: string; draft_id: string | null; guide: Guide | null }[] }>('/api/campaigns')
      .then(d => { const c = d.campaigns.find(x => x.draft_id === draftId && x.guide); if (alive) { setGuide(c?.guide ? { brand: c.brand, guide: c.guide } : null); setSponsored(d.campaigns.some(x => x.draft_id === draftId)); } })
      .catch(() => { /* 점검은 가이드 없이도 된다 */ });
    return () => { alive = false; };
  }, [draftId]);
  const basic = checkDraft({ title, body, hashtags, photos }, guide?.guide ?? null);
  const quality = qualityCheck({ title, body, hashtags, photos, postType, sponsored }, guide?.guide ?? null);
  const twin = title.trim() ? similarTitle(title, otherTitles) : null;
  const briefing = briefingCheck({ body, postType }, guide?.guide.keywords[0] ?? hashtags[0] ?? '');
  const items = [...basic, ...quality, ...briefing, ...(title.trim() && otherTitles.length ? [{ label: '비슷한 제목의 다른 원고 없음(재탕 방지)', ok: !twin, hint: twin ? `‘${twin}’과 많이 겹쳐요. 다른 관점이나 새 정보로 바꿔 주세요` : '' }] : [])];
  const facts = sources !== undefined && body.trim() ? factCheck(body, sources) : [];
  const done = items.filter(i => i.ok).length;
  const shown = showAll ? items : items.filter(i => !i.ok);
  return (
    <section className="card step" aria-labelledby="d-check">
      <div className="check-head">
        <Ring done={done} total={items.length} />
        <div style={{ minWidth: 0 }}>
          <h2 id="d-check" className="step-title" style={{ margin: 0 }}>원고 점검</h2>
          <p className="check-left" style={{ margin: 0 }}>{items.length - done ? <>남은 할 일 <b>{items.length - done}개</b> / {items.length}개</> : <>다 지켰어요 · {items.length}개</>}</p>
          <p className="muted small" style={{ margin: 0 }}>{guide ? `${guide.brand} 가이드 기준` : '기본 점검(협찬에 원고를 연결하면 가이드도 봐요)'}</p>
        </div>
        <button type="button" className="btn ghost small" style={{ marginLeft: 'auto' }} onClick={() => setShowAll(v => !v)}>{showAll ? '못 지킨 것만' : '전체 보기'}</button>
      </div>
      {shown.length === 0
        ? <p className="small" style={{ margin: 0 }}>✓ 다 지켰어요.</p>
        : (
          <ul className="check-list">
            {shown.map((i, n) => (
              <li key={n} className={i.ok ? 'ok' : 'no'}>
                <span className="check-box" aria-hidden="true">{i.ok ? '✓' : ''}</span>
                <span className="check-main"><span id={`ck-${n}`}>{i.label}</span>{!i.ok && i.hint && <span className="muted small check-hint">{i.hint}</span>}</span>
                {!i.ok && <button type="button" className="btn ghost small check-go" onClick={() => goFix(i.label)} aria-describedby={`ck-${n}`}>고치기</button>}
              </li>
            ))}
          </ul>
        )}
      {facts.length > 0 && (
        <div className="fact-check" aria-label="사실 확인">
          <p className="small" style={{ margin: '8px 0 4px', fontWeight: 700 }}>사실 확인 {facts.length}곳</p>
          <p className="muted small" style={{ margin: '0 0 6px' }}>경험 칸·사진 메모에 없는 숫자예요. AI가 지어냈을 수 있으니 맞는지 봐 주세요.</p>
          <ul className="fact-list">{facts.map(f => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      <p className="muted small" style={{ margin: '6px 0 0' }}>미니로그가 정한 작성 품질 기준이에요. 네이버 검색 점수나 상위 노출을 뜻하지 않아요.</p>
    </section>
  );
}
