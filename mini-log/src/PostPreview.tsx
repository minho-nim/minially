import { useState } from 'react';
import { hashtagLine } from './publishKit';

// 올리기 미리보기: 블로그에 올라간 모습처럼 보여 주고, 제목·문단·사진·해시태그를 눌러 바로 복사한다.
// 글쓰기 화면에서 위에서부터 '눌러 복사 → 붙여 넣기'를 반복하면 사진 위치까지 그대로 옮겨진다.
interface PreviewPhoto { id: string; name: string }
type Part = { kind: 'text'; text: string } | { kind: 'photo'; n: number };

/** 본문을 [사진 n] 표시 기준으로 문단 덩어리와 사진 자리로 나눈다. */
export function splitBody(body: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of body.matchAll(/\[사진\s*(\d+)\]/g)) {
    const text = body.slice(last, m.index).trim();
    if (text) parts.push({ kind: 'text', text });
    parts.push({ kind: 'photo', n: Number(m[1]) });
    last = (m.index ?? 0) + m[0].length;
  }
  const rest = body.slice(last).trim();
  if (rest) parts.push({ kind: 'text', text: rest });
  return parts;
}

/** 사진을 PNG로 바꿔 클립보드에 넣는다(브라우저 클립보드는 PNG만 받음). */
async function copyImage(id: string) {
  const png = (async () => {
    const response = await fetch(`/api/photos/${id}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('사진을 받지 못했어요.');
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('사진을 바꾸지 못했어요.'))), 'image/png'));
  })();
  // Safari는 클릭 직후에 ClipboardItem을 만들어야 해서 Promise를 그대로 넘긴다
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

/** 숫자 뒤 '을/를': 끝자리 읽는 소리에 받침이 있으면 을(1·3·6·7·8·0), 없으면 를(2·4·5·9). */
export const eulReul = (n: number) => ('2459'.includes(String(n).slice(-1)) ? '를' : '을');

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
);

export function PostPreview({ title, body, hashtags, photos, onMessage }: {
  title: string; body: string; hashtags: string[]; photos: PreviewPhoto[];
  onMessage: (message: { kind: 'error' | 'info'; text: string }) => void;
}) {
  const [done, setDone] = useState<string | null>(null);
  const parts = splitBody(body);

  async function run(key: string, label: string, action: () => Promise<void>) {
    try {
      await action();
      setDone(key);
      window.setTimeout(() => setDone(d => (d === key ? null : d)), 1600);
      onMessage({ kind: 'info', text: `${label} 복사했어요. 글쓰기 화면에 붙여 넣으세요.` });
    } catch (error) {
      onMessage({ kind: 'error', text: error instanceof Error && error.message.includes('사진') ? error.message : `${label} 복사하지 못했어요. 직접 선택해 복사해 주세요.` });
    }
  }
  const text = (key: string, label: string, value: string) => run(key, label, () => navigator.clipboard.writeText(value));

  const block = (key: string, label: string, onCopy: () => void, children: React.ReactNode, className = '') => (
    <button type="button" className={`pv-block ${className}${done === key ? ' copied' : ''}`} onClick={onCopy}>
      {/* 이름표(aria-label) 대신 숨은 글자로: 편집 칸 '제목'·'본문' 라벨과 겹치지 않게 */}
      <span className="sr-only">{label} 복사: </span>
      {children}
      <span className="pv-icon">{done === key ? <CheckIcon /> : <CopyIcon />}</span>
    </button>
  );

  return (
    <div className="post-preview" aria-label="올릴 글 미리보기">
      <p className="pv-help muted small">누르면 바로 복사돼요. 위에서부터 하나씩 눌러 글쓰기 화면에 붙여 넣으면 사진 위치까지 그대로예요.</p>
      {title.trim() ? block('title', '제목', () => { void text('title', '제목을', title.trim()); }, <h3 className="pv-title">{title.trim()}</h3>) : <p className="pv-empty muted">제목이 없어요</p>}
      <div className="pv-body">
        {parts.length === 0 && <p className="pv-empty muted">본문이 없어요</p>}
        {parts.map((part, i) => {
          if (part.kind === 'text') {
            const n = parts.slice(0, i + 1).filter(p => p.kind === 'text').length;
            return <div key={`t${i}`}>{block(`t${i}`, `문단 ${n}`, () => { void text(`t${i}`, `문단 ${n}${eulReul(n)}`, part.text); }, <p className="pv-text">{part.text}</p>)}</div>;
          }
          const photo = photos[part.n - 1];
          if (!photo) return <p key={`p${i}`} className="pv-missing small">📷 사진 {part.n} — 올린 사진이 없어요</p>;
          return <div key={`p${i}`}>{block(`p${i}`, `사진 ${part.n}`, () => { void run(`p${i}`, `사진 ${part.n}${eulReul(part.n)}`, () => copyImage(photo.id)); }, <img src={`/api/photos/${photo.id}`} alt={`사진 ${part.n}`} loading="lazy" />, 'pv-photo')}</div>;
        })}
      </div>
      {hashtags.length > 0 && block('tags', '해시태그', () => { void text('tags', '해시태그를', hashtagLine(hashtags)); }, <p className="pv-tags">{hashtagLine(hashtags)}</p>)}
    </div>
  );
}
