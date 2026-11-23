import React, { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CategoryActions, CategoryManager } from './CategoryManager';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { DiscardPrompt } from '../common/DiscardPrompt';

interface Props extends CategoryActions { open: boolean; onClose: () => void; }
export function CategoryLibraryModal({ open, onClose, ...actions }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const guard = useDiscardGuard(dirty, busy);
  const close = () => {
    if (guard.confirming) { guard.cancel(); return false; }
    return guard.request(onClose);
  };
  useLayoutEffect(() => {
    if (!open) return;
    setDirty(false); setBusy(false); guard.cancel();
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('header button')?.focus());
  }, [open]);
  useScheduleDialog(open, false, root, close, close);
  if (!open) return null;
  return <div ref={root} role="dialog" aria-modal="true" aria-label="카테고리 관리" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="w-full max-w-md max-h-[min(80dvh,var(--modal-height,100dvh))] rounded-2xl border border-app-line bg-white text-app-ink shadow-xl flex flex-col overflow-hidden">
      <header className="px-3 py-2 border-b border-app-line flex items-center justify-between shrink-0">
        <h2 className="text-sm font-bold">카테고리 관리</h2>
        <button type="button" aria-label="카테고리 관리 닫기" className="min-h-9 min-w-9 flex items-center justify-center rounded-lg text-app-muted hover:bg-app-soft" onClick={close}><X className="w-5 h-5" /></button>
      </header>
      {guard.confirming && <DiscardPrompt onContinue={guard.cancel} onDiscard={guard.discard} />}
      <div className="min-h-0 overflow-y-auto overscroll-contain p-3"><CategoryManager {...actions} onDirtyChange={setDirty} onBusyChange={setBusy} /></div>
    </div>
  </div>;
}
