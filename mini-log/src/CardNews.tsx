import { useEffect, useRef, useState } from 'react';
import { cardSlides } from './publishKit';

// 카드뉴스 7장(4:5, 1080×1350): 원고에서 장마다 글을 뽑아 두고 고쳐 쓴 뒤 JPG로 받는다. 브라우저에서만 그린다(서버 저장·AI 비용 없음).
const W = 1080, H = 1350;
const THEMES = [{ name: '밝게', bg: '#FFF7EE', fg: '#2B2420', accent: '#E86A4A' }, { name: '어둡게', bg: '#2B2420', fg: '#FFF7EE', accent: '#F2B66D' }] as const;

/** 띄어쓰기 단위로 줄을 나누고, 한 낱말이 너무 길면 글자 단위로 자른다 */
export function wrap(measure: (t: string) => number, text: string, max: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/).filter(Boolean)) {
      if (measure(line + word) <= max) { line += word; continue; }
      if (line.trim()) out.push(line.trimEnd());
      line = /^\s+$/.test(word) ? '' : word;
      while (measure(line) > max && line.length > 1) { // 긴 낱말은 글자 단위로
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > max) cut--;
        out.push(line.slice(0, cut)); line = line.slice(cut);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

export function drawCard(ctx: CanvasRenderingContext2D, text: string, index: number, total: number, theme: (typeof THEMES)[number], photo: HTMLImageElement | null) {
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);
  const cover = index === 0;
  if (cover && photo) { // 표지: 사진을 꽉 채우고 아래를 어둡게
    const s = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    ctx.drawImage(photo, (W - photo.naturalWidth * s) / 2, (H - photo.naturalHeight * s) / 2, photo.naturalWidth * s, photo.naturalHeight * s);
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const fg = cover && photo ? '#FFFFFF' : theme.fg;
  ctx.fillStyle = theme.accent; ctx.font = '700 40px "Pretendard", "Apple SD Gothic Neo", sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(`${index + 1} / ${total}`, 90, 90);
  ctx.fillStyle = fg;
  // 첫 줄(제목)은 크게, 나머지는 작게 — 각자 자기 글자 크기로 줄을 나눈다
  const [head, ...rest] = (text || ' ').split('\n');
  const big = `800 ${cover ? 104 : 84}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
  const small = '500 60px "Pretendard", "Apple SD Gothic Neo", sans-serif';
  ctx.font = big;
  const heads = wrap(t => ctx.measureText(t).width, head, W - 180).slice(0, cover || !rest.join('').trim() ? 6 : 3);
  ctx.font = small;
  const bodies = cover ? [] : wrap(t => ctx.measureText(t).width, rest.join('\n'), W - 180).filter((l, i, a) => l || (i > 0 && i < a.length - 1)).slice(0, 9);
  const hl = cover ? 130 : 108, bl = 86, gap = bodies.length ? 30 : 0;
  const height = heads.length * hl + gap + bodies.length * bl;
  let y = cover ? H - 160 - height : (H - height) / 2;
  ctx.font = big; for (const l of heads) { ctx.fillText(l, 90, y); y += hl; }
  y += gap;
  ctx.font = small; for (const l of bodies) { ctx.fillText(l, 90, y); y += bl; }
}

export function CardNews({ title, body, photoId, onMessage }: { title: string; body: string; photoId: string | null; onMessage: (m: { kind: 'error' | 'info'; text: string }) => void }) {
  const [slides, setSlides] = useState(() => cardSlides(title, body));
  const [theme, setTheme] = useState(0);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    if (!photoId) { setPhoto(null); return; }
    const el = new Image(); el.onload = () => setPhoto(el); el.onerror = () => setPhoto(null); el.src = `/api/photos/${photoId}`;
  }, [photoId]);
  useEffect(() => {
    const draw = () => slides.forEach((t, i) => { const c = canvases.current[i]?.getContext('2d'); if (c) drawCard(c, t, i, slides.length, THEMES[theme], photo); });
    draw(); void document.fonts?.ready.then(draw);
  }, [slides, theme, photo]);

  async function download() {
    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, '');
    for (const [i, c] of canvases.current.entries()) {
      if (!c) continue;
      const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.92));
      if (!blob) continue;
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `minilog_card_${day}_${String(i + 1).padStart(2, '0')}.jpg`;
      document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    onMessage({ kind: 'info', text: `카드 ${slides.length}장을 받았어요. 인스타에 올릴 때 번호 순서대로 고르세요.` });
  }

  return (
    <div className="card-news">
      <div className="publish-row" style={{ alignItems: 'center' }}>
        <span className="small muted" style={{ flex: '1 1 200px' }}>장마다 글을 고칠 수 있어요(첫 줄은 크게, 둘째 줄부터 작게).</span>
        <div role="group" aria-label="카드 색" style={{ display: 'flex', gap: 4 }}>
          {THEMES.map((t, i) => <button key={t.name} type="button" className={`btn small${theme === i ? ' primary' : ''}`} aria-pressed={theme === i} onClick={() => setTheme(i)}>{t.name}</button>)}
        </div>
        <button type="button" className="btn small" onClick={() => setSlides(cardSlides(title, body))}>원고에서 다시 뽑기</button>
        <button type="button" className="btn primary small" onClick={() => { void download(); }}>카드 {slides.length}장 받기</button>
      </div>
      <ol className="card-slides">
        {slides.map((t, i) => (
          <li key={i}>
            <canvas ref={el => { canvases.current[i] = el; }} width={W} height={H} className="card-canvas" role="img" aria-label={`카드 ${i + 1}: ${t.replace(/\n/g, ' ')}`} />
            <label className="sr-only" htmlFor={`card-${i}`}>카드 {i + 1} 글</label>
            <textarea id={`card-${i}`} className="textarea" rows={3} maxLength={120} value={t} onChange={e => setSlides(s => s.map((x, k) => (k === i ? e.target.value : x)))} />
          </li>
        ))}
      </ol>
    </div>
  );
}
