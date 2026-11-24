import { useEffect, useRef, useState, type PointerEvent } from 'react';

// 썸네일 만들기: 원고 사진 위에 글자를 얹어 블로그 대표 이미지(1:1·4:3)를 브라우저에서 만든다(AI·서버 저장 없음).
// 글자는 끌어서 옮기고, 여러 개 넣을 수 있다. 시작용 틀 2개(아래 띠 / 가운데 큰 글씨).
export interface Layer { id: string; text: string; x: number; y: number; size: number; color: string; bg: 'none' | 'band' | 'box'; font: 'sans' | 'hand'; bold: boolean }
export interface ThumbState { photoId: string | null; ratio: '1:1' | '4:3'; dim: number; layers: Layer[] }

const COLORS = ['#FFFFFF', '#2B2233', '#E37D12', '#F2493E', '#FFE07A', '#7C8CE0'];
const W = 1080;
const height = (ratio: ThumbState['ratio']) => (ratio === '1:1' ? 1080 : 810);
const uid = () => Math.random().toString(36).slice(2, 9);
const FONT = { sans: '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif', hand: '"Nanum Pen Script", "Gaegu", cursive' };

export const TEMPLATES: { name: string; make: (title: string) => Pick<ThumbState, 'dim' | 'layers'> }[] = [
  { name: '아래 띠', make: title => ({ dim: 0, layers: [{ id: uid(), text: title, x: 0.5, y: 0.86, size: 64, color: '#FFFFFF', bg: 'band', font: 'sans', bold: true }] }) },
  { name: '가운데 큰 글씨', make: title => ({ dim: 0.35, layers: [
    { id: uid(), text: title, x: 0.5, y: 0.5, size: 92, color: '#FFFFFF', bg: 'none', font: 'sans', bold: true },
    { id: uid(), text: '솔직 후기', x: 0.5, y: 0.66, size: 56, color: '#FFE07A', bg: 'none', font: 'hand', bold: false },
  ] }) },
];

type Box = { id: string; x: number; y: number; w: number; h: number };

/** 그리기(미리보기·내보내기 공용). 글자마다 차지한 자리를 돌려준다(끌기용). */
export function drawThumb(ctx: CanvasRenderingContext2D, img: CanvasImageSource | null, imgW: number, imgH: number, s: ThumbState, selected?: string | null): Box[] {
  const H = height(s.ratio);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#E8E2DD'; ctx.fillRect(0, 0, W, H);
  if (img && imgW && imgH) {
    const scale = Math.max(W / imgW, H / imgH); // 꽉 채우고 가운데 맞춤
    const dw = imgW * scale, dh = imgH * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  if (s.dim > 0) { ctx.fillStyle = `rgba(0,0,0,${s.dim})`; ctx.fillRect(0, 0, W, H); }
  const boxes: Box[] = [];
  for (const l of s.layers) {
    const lines = (l.text || ' ').split('\n');
    ctx.font = `${l.bold ? 800 : 500} ${l.size}px ${FONT[l.font]}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lineH = l.size * 1.25;
    const w = Math.max(...lines.map(t => ctx.measureText(t).width));
    const h = lineH * lines.length;
    const cx = l.x * W, cy = l.y * H, pad = l.size * 0.35;
    if (l.bg === 'band') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, cy - h / 2 - pad, W, h + pad * 2); }
    if (l.bg === 'box') {
      ctx.fillStyle = l.color === '#FFFFFF' || l.color === '#FFE07A' ? 'rgba(43,34,51,0.85)' : 'rgba(255,255,255,0.9)';
      const r = Math.min(24, pad);
      ctx.beginPath(); ctx.roundRect(cx - w / 2 - pad, cy - h / 2 - pad * 0.7, w + pad * 2, h + pad * 1.4, r); ctx.fill();
    }
    if (l.bg === 'none') { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = l.size * 0.25; }
    ctx.fillStyle = l.color;
    lines.forEach((t, i) => ctx.fillText(t, cx, cy - h / 2 + lineH * (i + 0.5)));
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    const box = { id: l.id, x: cx - w / 2 - pad, y: cy - h / 2 - pad, w: w + pad * 2, h: h + pad * 2 };
    boxes.push(box);
    if (selected === l.id) { ctx.setLineDash([12, 8]); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.strokeRect(box.x, box.y, box.w, box.h); ctx.setLineDash([]); }
  }
  return boxes;
}

export function ThumbnailMaker({ photos, title, onMessage }: { photos: { id: string; name: string }[]; title: string; onMessage: (m: { kind: 'error' | 'info'; text: string }) => void }) {
  const [state, setState] = useState<ThumbState>(() => ({ photoId: photos[0]?.id ?? null, ratio: '1:1', ...TEMPLATES[0].make(title.trim() || '제목을 적어 주세요') }));
  const [selected, setSelected] = useState<string | null>(state.layers[0]?.id ?? null);
  const [img, setImg] = useState<{ el: HTMLImageElement; w: number; h: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const boxes = useRef<Box[]>([]);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const H = height(state.ratio);

  useEffect(() => {
    if (!state.photoId) { setImg(null); return; }
    const el = new Image();
    el.onload = () => setImg({ el, w: el.naturalWidth, h: el.naturalHeight });
    el.onerror = () => onMessage({ kind: 'error', text: '사진을 불러오지 못했어요.' });
    el.src = `/api/photos/${state.photoId}`;
  }, [state.photoId, onMessage]);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const redraw = () => { boxes.current = drawThumb(ctx, img?.el ?? null, img?.w ?? 0, img?.h ?? 0, state, selected); };
    redraw();
    void document.fonts?.ready.then(redraw); // 손글씨 글꼴이 늦게 오면 다시
  }, [state, img, selected, H]);

  const set = (patch: Partial<ThumbState>) => setState(s => ({ ...s, ...patch }));
  const layer = state.layers.find(l => l.id === selected) ?? null;
  const setLayer = (patch: Partial<Layer>) => setState(s => ({ ...s, layers: s.layers.map(l => (l.id === selected ? { ...l, ...patch } : l)) }));

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  function down(e: PointerEvent<HTMLCanvasElement>) {
    const p = point(e);
    const hit = [...boxes.current].reverse().find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    setSelected(hit?.id ?? null);
    if (!hit) return;
    const l = state.layers.find(x => x.id === hit.id)!;
    drag.current = { id: hit.id, dx: p.x - l.x * W, dy: p.y - l.y * H };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const p = point(e), d = drag.current;
    const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v));
    setState(s => ({ ...s, layers: s.layers.map(l => (l.id === d.id ? { ...l, x: clamp((p.x - d.dx) / W), y: clamp((p.y - d.dy) / H) } : l)) }));
  }
  const up = () => { drag.current = null; };

  function addText() {
    const l: Layer = { id: uid(), text: '글자', x: 0.5, y: 0.2, size: 60, color: '#FFFFFF', bg: 'box', font: 'sans', bold: true };
    setState(s => ({ ...s, layers: [...s.layers, l] }));
    setSelected(l.id);
  }
  function applyTemplate(i: number) {
    const t = TEMPLATES[i].make(title.trim() || '제목을 적어 주세요');
    set(t);
    setSelected(t.layers[0]?.id ?? null);
  }
  async function exportJpg() {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    drawThumb(out.getContext('2d')!, img?.el ?? null, img?.w ?? 0, img?.h ?? 0, state, null);
    const blob = await new Promise<Blob | null>(r => out.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) { onMessage({ kind: 'error', text: '그림을 만들지 못했어요.' }); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `minilog_thumbnail_${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, '')}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onMessage({ kind: 'info', text: '썸네일을 받았어요. 블로그 글의 첫 사진(대표 이미지)으로 올리세요.' });
  }

  return (
    <div className="thumb-maker">
      <div className="thumb-stage">
        <canvas ref={canvas} width={W} height={H} role="img" aria-label={`썸네일 미리보기: ${state.layers.map(l => l.text).join(' / ')}`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ aspectRatio: `${W} / ${H}`, touchAction: 'none' }} />
      </div>
      <div className="thumb-tools">
        <div className="ai-row" role="group" aria-label="시작 틀">
          {TEMPLATES.map((t, i) => <button key={t.name} type="button" className="btn small" onClick={() => applyTemplate(i)}>틀: {t.name}</button>)}
          <button type="button" className="btn small" onClick={addText}>+ 글자</button>
        </div>
        {photos.length > 1 && (
          <div className="thumb-photos" role="group" aria-label="사진 고르기">
            {photos.slice(0, 20).map((p, i) => (
              <button key={p.id} type="button" aria-pressed={state.photoId === p.id} aria-label={`사진 ${i + 1}`} onClick={() => set({ photoId: p.id })}>
                <img src={`/api/photos/${p.id}`} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <div className="ai-row">
          <div className="style-tabs" role="group" aria-label="비율">
            {(['1:1', '4:3'] as const).map(r => <button key={r} type="button" aria-pressed={state.ratio === r} onClick={() => set({ ratio: r })}>{r}</button>)}
          </div>
          <label className="small thumb-range">사진 어둡게<input type="range" min={0} max={0.7} step={0.05} value={state.dim} onChange={e => set({ dim: Number(e.target.value) })} /></label>
        </div>
        {layer ? (
          <div className="thumb-layer" role="group" aria-label="고른 글자">
            <textarea className="textarea" aria-label="글자 내용" rows={2} value={layer.text} maxLength={60} onChange={e => setLayer({ text: e.target.value })} />
            <label className="small thumb-range">크기<input type="range" min={28} max={160} value={layer.size} onChange={e => setLayer({ size: Number(e.target.value) })} /></label>
            <div className="thumb-colors" role="group" aria-label="글자 색">
              {COLORS.map(c => <button key={c} type="button" aria-label={`색 ${c}`} aria-pressed={layer.color === c} style={{ background: c }} onClick={() => setLayer({ color: c })} />)}
            </div>
            <div className="ai-row">
              <div className="style-tabs" role="group" aria-label="글자 바탕">
                {([['none', '그림자'], ['box', '상자'], ['band', '띠']] as const).map(([k, v]) => <button key={k} type="button" aria-pressed={layer.bg === k} onClick={() => setLayer({ bg: k })}>{v}</button>)}
              </div>
              <div className="style-tabs" role="group" aria-label="글꼴">
                <button type="button" aria-pressed={layer.font === 'sans'} onClick={() => setLayer({ font: 'sans' })}>기본</button>
                <button type="button" aria-pressed={layer.font === 'hand'} onClick={() => setLayer({ font: 'hand' })}>손글씨</button>
                <button type="button" aria-pressed={layer.bold} onClick={() => setLayer({ bold: !layer.bold })}>굵게</button>
              </div>
              <button type="button" className="btn ghost small" onClick={() => { setState(s => ({ ...s, layers: s.layers.filter(l => l.id !== selected) })); setSelected(null); }}>글자 지우기</button>
            </div>
          </div>
        ) : <p className="muted small" style={{ margin: 0 }}>미리보기에서 글자를 누르면 고치고, 끌어서 옮길 수 있어요.</p>}
        <button type="button" className="btn primary" onClick={() => { void exportJpg(); }}>썸네일 받기(JPG)</button>
      </div>
    </div>
  );
}
