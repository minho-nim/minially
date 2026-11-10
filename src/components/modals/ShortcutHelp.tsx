import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

export const ShortcutHelp: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="단축키" className="app-modal fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-app-line p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-app-ink">단축키</h3>
          <button ref={ref} type="button" aria-label="닫기" onClick={onClose} className="p-1.5 rounded-lg text-app-muted hover:bg-app-soft cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <dl className="space-y-1.5">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-app-muted">{label}</dt>
              <dd><kbd className="px-2 py-0.5 rounded-md border border-app-line bg-app-canvas text-xs font-semibold text-app-ink whitespace-nowrap">{key}</kbd></dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-app-muted">글자를 입력하는 중이거나 창이 열려 있을 때는 동작하지 않아요.</p>
      </div>
    </div>
  );
};
