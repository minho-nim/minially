import { useEffect, useRef, useState } from 'react';
import { MAIL_COLORS, type MailBlock, type MailDoc, type MailRun, type MailSize } from '../functions/_mailDoc';

// 메일 서식 편집기: 굵게·기울임·밑줄·취소선·글자 크기·색·목록·인용·링크. 편집한 내용은 정해진 문서 모양(MailDoc)으로만 꺼낸다.
// 화면에 다시 그릴 때도 문서에서 DOM을 직접 만든다(innerHTML 안 씀). 붙여넣기는 글만 받는다.
const SIZE_OF_FONT: Record<string, MailSize> = { 1: 's', 2: 's', 3: 'm', 4: 'l', 5: 'l', 6: 'xl', 7: 'xl' };
const FONT_OF_SIZE: Record<MailSize, string> = { s: '2', m: '3', l: '5', xl: '6' };
const SIZE_LABEL: Record<MailSize, string> = { s: '작게', m: '보통', l: '크게', xl: '아주 크게' };
const COLOR_LABEL = ['검정', '회색', '빨강', '주황', '초록', '파랑', '보라'];

const hex = (v: string) => {
  const m = v.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  return (m ? `#${[m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')}` : v).toUpperCase();
};

type Style = Omit<MailRun, 't'>;
function runsOf(node: Node, style: Style, out: MailRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent ?? '').replace(/ /g, ' ');
    if (t) out.push({ ...style, t });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BR') { out.push({ t: '\n' }); return; }
  const next: Style = { ...style };
  if (tag === 'B' || tag === 'STRONG' || /^(bold|[6-9]00)$/.test(el.style.fontWeight)) next.b = true;
  if (tag === 'I' || tag === 'EM' || el.style.fontStyle === 'italic') next.i = true;
  if (tag === 'U' || el.style.textDecoration.includes('underline')) next.u = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || el.style.textDecoration.includes('line-through')) next.s = true;
  if (tag === 'FONT' && el.getAttribute('size')) { const size = SIZE_OF_FONT[el.getAttribute('size')!]; if (size && size !== 'm') next.size = size; else delete next.size; }
  const color = hex((tag === 'FONT' ? el.getAttribute('color') : '') || el.style.color || '');
  if ((MAIL_COLORS as readonly string[]).includes(color)) { if (color === '#222222') delete next.color; else next.color = color; }
  if (tag === 'A' && /^https:\/\//.test(el.getAttribute('href') ?? '')) next.href = el.getAttribute('href')!;
  for (const c of Array.from(el.childNodes)) runsOf(c, next, out);
}

/** 편집기 DOM → 문서(줄바꿈 <br>은 문단을 나눈다) */
export function domToDoc(root: HTMLElement): MailDoc {
  const doc: MailDoc = [];
  const paragraph = (type: 'p' | 'quote', runs: MailRun[]) => {
    let line: MailRun[] = [];
    for (const r of runs) { if (r.t === '\n') { doc.push({ type, runs: line }); line = []; } else line.push(r); }
    doc.push({ type, runs: line });
  };
  let loose: MailRun[] = [];
  const flush = () => { if (loose.length) { paragraph('p', loose); loose = []; } };
  for (const node of Array.from(root.childNodes)) {
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null;
    if (el && (el.tagName === 'UL' || el.tagName === 'OL')) {
      flush();
      const items = Array.from(el.children).filter(li => li.tagName === 'LI').map(li => { const r: MailRun[] = []; runsOf(li, {}, r); return r.filter(x => x.t !== '\n'); });
      doc.push({ type: el.tagName === 'UL' ? 'ul' : 'ol', items });
    } else if (el && (el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'BLOCKQUOTE')) {
      flush();
      const r: MailRun[] = [];
      runsOf(el, {}, r);
      if (r.length && r[r.length - 1].t === '\n') r.pop(); // 빈 줄의 <div><br></div>
      paragraph(el.tagName === 'BLOCKQUOTE' ? 'quote' : 'p', r);
    } else runsOf(node, {}, loose);
  }
  flush();
  return doc;
}

function runNode(r: MailRun): Node {
  let node: Node = document.createTextNode(r.t);
  const wrap = (tag: string, set?: (el: HTMLElement) => void) => { const el = document.createElement(tag); set?.(el); el.append(node); node = el; };
  if (r.size) wrap('font', el => el.setAttribute('size', FONT_OF_SIZE[r.size!]));
  if (r.color) wrap('font', el => el.setAttribute('color', r.color!));
  if (r.b) wrap('b'); if (r.i) wrap('i'); if (r.u) wrap('u'); if (r.s) wrap('s');
  if (r.href) wrap('a', el => el.setAttribute('href', r.href!));
  return node;
}

/** 문서 → 편집기 DOM(직접 만듦) */
export function fillEditor(root: HTMLElement, doc: MailDoc) {
  root.replaceChildren();
  for (const b of doc as MailBlock[]) {
    if (b.type === 'ul' || b.type === 'ol') {
      const list = document.createElement(b.type);
      for (const item of b.items ?? []) { const li = document.createElement('li'); li.append(...item.map(runNode)); list.append(li); }
      root.append(list);
    } else {
      const el = document.createElement(b.type === 'quote' ? 'blockquote' : 'div');
      if (b.runs?.length) el.append(...b.runs.map(runNode)); else el.append(document.createElement('br'));
      root.append(el);
    }
  }
}

export function MailEditor({ doc, onChange, label, disabled }: { doc: MailDoc; onChange: (doc: MailDoc) => void; label: string; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('https://');
  const [, setTick] = useState(0);
  const loaded = useRef('');
  useEffect(() => {
    const key = JSON.stringify(doc);
    if (ref.current && key !== loaded.current && key !== JSON.stringify(domToDoc(ref.current))) { fillEditor(ref.current, doc); loaded.current = key; }
  }, [doc]);
  const emit = () => { if (ref.current) { const next = domToDoc(ref.current); loaded.current = JSON.stringify(next); onChange(next); } setTick(t => t + 1); };
  const run = (name: string, value?: string) => {
    ref.current?.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(name, false, value);
    emit();
  };
  const on = (name: string) => { try { return document.queryCommandState(name); } catch { return false; } };
  return (
    <div className="mail-editor">
      <div className="mail-tools" role="toolbar" aria-label={`${label} 서식`}>
        {([['bold', '굵게', 'B'], ['italic', '기울임', 'I'], ['underline', '밑줄', 'U'], ['strikeThrough', '취소선', 'S']] as const).map(([cmd, name, mark]) => (
          <button key={cmd} type="button" className={`tool tool-${cmd}`} aria-label={name} title={name} aria-pressed={on(cmd)} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => run(cmd)}>{mark}</button>
        ))}
        <label className="sr-only" htmlFor={`size-${label}`}>글자 크기</label>
        <select id={`size-${label}`} className="tool-select" disabled={disabled} defaultValue="" onChange={e => { if (e.target.value) run('fontSize', FONT_OF_SIZE[e.target.value as MailSize]); e.target.value = ''; }}>
          <option value="" disabled>크기</option>
          {(Object.keys(SIZE_LABEL) as MailSize[]).map(s => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}
        </select>
        <label className="sr-only" htmlFor={`color-${label}`}>글자 색</label>
        <select id={`color-${label}`} className="tool-select" disabled={disabled} defaultValue="" onChange={e => { if (e.target.value) run('foreColor', e.target.value); e.target.value = ''; }}>
          <option value="" disabled>색</option>
          {MAIL_COLORS.map((c, i) => <option key={c} value={c}>{COLOR_LABEL[i]}</option>)}
        </select>
        <button type="button" className="tool" aria-label="점 목록" title="점 목록" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => run('insertUnorderedList')}>•</button>
        <button type="button" className="tool" aria-label="번호 목록" title="번호 목록" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => run('insertOrderedList')}>1.</button>
        <button type="button" className="tool" aria-label="인용" title="인용" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => run('formatBlock', 'blockquote')}>❝</button>
        <button type="button" className="tool" aria-label="링크" title="링크" aria-expanded={linkOpen} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => setLinkOpen(v => !v)}>링크</button>
        <button type="button" className="tool" aria-label="서식 지우기" title="서식 지우기" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => run('removeFormat')}>지우기</button>
      </div>
      {linkOpen && (
        <div className="publish-row">
          <label className="sr-only" htmlFor={`link-${label}`}>링크 주소</label>
          <input id={`link-${label}`} className="input" value={link} onChange={e => setLink(e.target.value)} placeholder="https://" />
          <button type="button" className="btn small" onMouseDown={e => e.preventDefault()} disabled={!/^https:\/\/\S+\.\S+/.test(link)} onClick={() => { run('createLink', link.trim()); setLinkOpen(false); }}>고른 글에 링크</button>
        </div>
      )}
      <div ref={ref} className="mail-compose" role="textbox" aria-multiline="true" aria-label={label} contentEditable={!disabled} suppressContentEditableWarning
        onInput={emit} onKeyUp={() => setTick(t => t + 1)} onMouseUp={() => setTick(t => t + 1)}
        onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); emit(); }} />
    </div>
  );
}
