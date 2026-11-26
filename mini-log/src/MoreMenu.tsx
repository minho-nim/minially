import { useEffect, useRef, useState, type ReactNode } from 'react';

// '⋯ 더보기' 메뉴(힉의 법칙: 가끔 쓰는 버튼은 숨기고 메인 버튼 하나만 보이게).
// 안의 버튼을 누르면 메뉴가 닫힌다. 바깥을 누르거나 Esc로도 닫힌다.
export function MoreMenu({ label, children, align = 'right' }: { label: string; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="more-menu" ref={box}>
      <button type="button" className="btn ghost more-toggle" aria-label={label} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(v => !v)}>⋯</button>
      {open && (
        <div className={`more-items ${align}`} role="group" aria-label={label} onClick={e => { if ((e.target as HTMLElement).closest('button')) setOpen(false); }}>
          {children}
        </div>
      )}
    </div>
  );
}
