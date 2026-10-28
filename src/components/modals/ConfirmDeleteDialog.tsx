import React, { useEffect, useRef, useState } from 'react';
import { Schedule } from '../../types';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
export function ConfirmDeleteDialog({ target, busy, onClose, onDelete, noun = '일정' }: { target: Pick<Schedule, 'id' | 'title'> | null; noun?: string; busy: boolean; onClose: () => void; onDelete: () => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null), cancelRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const close = () => { if (busy) return false; onClose(); };
  useScheduleDialog(Boolean(target), false, ref, close, close);
  useEffect(() => { setError(''); if (target) cancelRef.current?.focus(); }, [target]);
  if (!target) return null;
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={noun + ' 삭제 확인'} className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(45,35,40,0.25)]">
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 border border-[#F0E7EB] shadow-xl">
      <h3 className="text-base font-bold">{noun === '일정' ? '이 일정을 삭제할까요?' : '이 할 일을 삭제할까요?'}</h3><p className="text-sm break-words mt-2">{target.title}</p><p className="text-xs text-[#85777D] mt-2">삭제 후 실행 취소할 수 있습니다.</p>
      {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4"><button type="button" ref={cancelRef} disabled={busy} onClick={close} className="px-3 rounded-xl">취소</button><button type="button" disabled={busy} onClick={async () => { try { await onDelete(); } catch { setError('삭제하지 못했습니다. 다시 시도해 주세요.'); } }} className="px-3 rounded-xl bg-[#F6E8ED] text-[#9D5772]">{busy ? '삭제 중…' : '삭제'}</button></div>
    </div>
  </div>;
}
