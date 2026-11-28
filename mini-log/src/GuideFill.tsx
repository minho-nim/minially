import { useState } from 'react';
import { api } from '../../shared/client/api';
import { shrinkPhoto } from './shrinkPhoto';

// 체험단 가이드(글·링크·캡처) → AI가 협찬 칸과 지킬 것(키워드·사진 수 등)을 정리
export interface Guide {
  keywords: string[]; hashtags: string[]; min_photos: number | null; min_chars: number | null;
  links: string[]; visit_on: string | null; notes: string;
  /** 쓰면 안 되는 말 */
  avoid?: string[];
}
export interface GuideResult { brand: string; title: string; provided: string; amount: number; deadline: string | null; apply_by?: string | null; guide: Guide | null }

type Source = 'text' | 'url' | 'image';
const SOURCES: [Source, string][] = [['text', '글 붙여넣기'], ['url', '링크'], ['image', '캡처']];

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('캡처를 읽지 못했어요.'));
  reader.readAsDataURL(blob);
});

/** initialUrl: 휴대폰 공유로 받은 공고 주소(있으면 '링크'로 열어 둔다). onFill의 두 번째 값은 링크로 정리했을 때 그 주소. */
export function GuideFill({ onFill, initialUrl = '' }: { onFill: (r: GuideResult, sourceUrl?: string) => void; initialUrl?: string }) {
  const [open, setOpen] = useState(!!initialUrl);
  const [source, setSource] = useState<Source>(initialUrl ? 'url' : 'text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState(initialUrl);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const body = source === 'text' ? { text } : source === 'url' ? { url } : { image: file ? await toDataUrl(await shrinkPhoto(file)) : '' };
      const result = await api<GuideResult>('/api/campaigns/guide', { body });
      onFill(result, source === 'url' ? url.trim() : undefined);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '정리하지 못했어요.');
      if (source === 'url') setSource('text');
    } finally { setBusy(false); }
  }

  if (!open) return <button type="button" className="btn ghost small" onClick={() => setOpen(true)}>✨ 가이드로 채우기</button>;
  const ready = source === 'text' ? text.trim().length > 0 : source === 'url' ? url.trim().length > 0 : !!file;
  return (
    <div className="guide-fill" role="group" aria-label="가이드로 채우기">
      <div className="style-tabs" role="tablist" aria-label="가이드 넣는 방법">
        {SOURCES.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={source === k} onClick={() => setSource(k)}>{label}</button>)}
      </div>
      {source === 'text' && <textarea className="textarea" aria-label="가이드 글" style={{ minHeight: 90 }} value={text} maxLength={20000} placeholder="체험단 안내 글을 통째로 붙여 넣어 주세요" onChange={e => setText(e.target.value)} />}
      {source === 'url' && <input className="input" aria-label="가이드 주소" inputMode="url" value={url} placeholder="https://…" onChange={e => setUrl(e.target.value)} />}
      {source === 'image' && <input className="input" aria-label="가이드 캡처" type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />}
      {error && <p className="error small" role="alert">{error}</p>}
      <div className="ai-row">
        <button type="button" className="btn primary small" disabled={!ready || busy} onClick={run}>{busy ? '정리하는 중…' : '정리하기'}</button>
        <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>닫기</button>
      </div>
    </div>
  );
}

/** 가이드에서 지킬 것을 한눈에 */
export function GuideChips({ guide }: { guide: Guide }) {
  const items: string[] = [
    ...guide.keywords.map(k => `🔑 ${k}`),
    ...guide.hashtags.map(h => `#${h}`),
    ...(guide.avoid ?? []).map(w => `🚫 ${w}`),
    ...(guide.min_photos ? [`📷 사진 ${guide.min_photos}장 이상`] : []),
    ...(guide.min_chars ? [`✍️ ${guide.min_chars.toLocaleString('ko-KR')}자 이상`] : []),
    ...(guide.visit_on ? [`📅 방문 ${guide.visit_on}`] : []),
    ...(guide.links.length ? [`🔗 링크 ${guide.links.length}개`] : []),
  ];
  return (
    <div className="guide-box" aria-label="가이드 지킬 것">
      <ul className="chips">{items.map((t, i) => <li key={i} className="chip">{t}</li>)}</ul>
      {guide.notes && <p className="muted small" style={{ margin: '6px 0 0' }}>{guide.notes}</p>}
    </div>
  );
}
