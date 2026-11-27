import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

// 빠른 찾기(Ctrl+K · ⌘K): 화면 이동·새 원고·원고 제목을 글자로 찾아 Enter로 연다(Linear·Raycast의 명령창처럼).
// 찾는 것은 이 화면에 이미 있는 목록뿐이고 서버로 보내지 않는다.
export interface Command { id: string; label: string; hint?: string; group: string; run: () => void }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(v => !v); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('minilog-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('minilog-palette', onOpen); };
  }, []);
  // 창이 열려 있으면 입력칸에 초점이 오기 전이라도 Esc로 닫힌다
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);
  useEffect(() => {
    if (open) { back.current = document.activeElement as HTMLElement | null; setQ(''); setAt(0); requestAnimationFrame(() => input.current?.focus()); }
    else back.current?.focus?.();
  }, [open]);
  const shown = useMemo(() => {
    const k = norm(q);
    const list = k ? commands.filter(c => norm(`${c.label} ${c.hint ?? ''} ${c.group}`).includes(k)) : commands.filter(c => c.group !== '원고');
    return list.slice(0, 30);
  }, [q, commands]);
  if (!open) return null;
  const pick = (c: Command | undefined) => { if (!c) return; setOpen(false); c.run(); };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(shown[at]); }
    else if (e.key === 'Tab') e.preventDefault(); // 창 안에 머문다(목록은 화살표로)
  };
  let lastGroup = '';
  return (
    <div className="palette-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="빠른 찾기">
        <input ref={input} className="palette-input" value={q} placeholder="화면 이름이나 원고 제목(예: 캘린더, 소금빵)" aria-label="빠른 찾기 글자"
          role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={shown[at] ? `pc-${shown[at].id}` : undefined}
          onChange={e => { setQ(e.target.value); setAt(0); }} onKeyDown={onKeyDown} />
        <ul id="palette-list" className="palette-list" role="listbox" aria-label="찾은 것">
          {shown.length === 0 && <li className="palette-empty muted small" role="presentation">찾은 것이 없어요</li>}
          {shown.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : '';
            lastGroup = c.group;
            return [
              head && <li key={`g-${c.group}`} className="palette-group" role="presentation">{head}</li>,
              <li key={c.id} id={`pc-${c.id}`} role="option" aria-selected={i === at} className="palette-item" onMouseMove={() => setAt(i)} onClick={() => pick(c)}>
                <span className="palette-label">{c.label}</span>{c.hint && <span className="muted small">{c.hint}</span>}
              </li>,
            ];
          })}
        </ul>
        <p className="palette-foot muted small">↑↓ 고르기 · Enter 열기 · Esc 닫기</p>
      </div>
    </div>
  );
}

export const openPalette = () => window.dispatchEvent(new Event('minilog-palette'));
