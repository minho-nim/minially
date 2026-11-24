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

export function DraftCheck({ draftId, title, body, hashtags, photos }: { draftId: string; title: string; body: string; hashtags: string[]; photos: number }) {
  const [guide, setGuide] = useState<{ brand: string; guide: Guide } | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let alive = true;
    api<{ campaigns: { brand: string; draft_id: string | null; guide: Guide | null }[] }>('/api/campaigns')
      .then(d => { const c = d.campaigns.find(x => x.draft_id === draftId && x.guide); if (alive) setGuide(c?.guide ? { brand: c.brand, guide: c.guide } : null); })
      .catch(() => { /* 점검은 가이드 없이도 된다 */ });
    return () => { alive = false; };
  }, [draftId]);
  const items = checkDraft({ title, body, hashtags, photos }, guide?.guide ?? null);
  const done = items.filter(i => i.ok).length;
  const shown = showAll ? items : items.filter(i => !i.ok);
  return (
    <section className="card step" aria-labelledby="d-check">
      <div className="check-head">
        <Ring done={done} total={items.length} />
        <div style={{ minWidth: 0 }}>
          <h2 id="d-check" className="step-title" style={{ margin: 0 }}>원고 점검</h2>
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
                <span aria-hidden="true">{i.ok ? '✓' : '!'}</span>
                <span>{i.label}</span>
                {!i.ok && i.hint && <span className="muted small check-hint">{i.hint}</span>}
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
