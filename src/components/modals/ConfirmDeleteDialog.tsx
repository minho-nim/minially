import React, { useEffect, useRef, useState } from 'react';
import { Schedule } from '../../types';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import type { SeriesScope } from '../../utils/seriesEdit';

export const SCOPES: [SeriesScope, string][] = [['this', '이 일정만'], ['following', '이후 모든 일정'], ['all', '모든 반복 일정']];
export function ConfirmDeleteDialog({ target, busy, onClose, onDelete, noun = '일정', repeating = false }: { target: Pick<Schedule, 'id' | 'title'> | null; noun?: string; busy: boolean; onClose: () => void; onDelete: (scope?: SeriesScope) => Promise<void>; repeating?: boolean }) {
  const ref = useRef<HTMLDivElement>(null), cancelRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const close = () => { if (busy) return false; onClose(); };
  useScheduleDialog(Boolean(target), false, ref, close, close);
  useEffect(() => { setError(''); if (target) cancelRef.current?.focus(); }, [target]);
  const run = async (scope?: SeriesScope) => { try { await onDelete(scope); } catch { setError('삭제하지 못했습니다. 다시 시도해 주세요.'); } };
  if (!target) return null;
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={noun + ' 삭제 확인'} className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]">
    <div className="w-full max-w-sm rounded-2xl bg-white p-4 border border-app-line shadow-xl">
      <h3 className="text-base font-bold">{noun === '일정' ? '이 일정을 삭제할까요?' : '이 할 일을 삭제할까요?'}</h3><p className="text-sm break-words mt-2">{target.title}</p><p className="text-xs text-app-muted mt-2">삭제 후 실행 취소할 수 있습니다.</p>
      {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
      {repeating ? <div role="group" aria-label="반복 일정 삭제 범위" className="grid gap-2 mt-4">
        {SCOPES.map(([scope, label]) => <button key={scope} type="button" disabled={busy} onClick={() => run(scope)} className="min-h-10 px-3 rounded-xl bg-app-soft text-app-accent text-sm text-left">{label} 삭제</button>)}
        <button type="button" ref={cancelRef} disabled={busy} onClick={close} className="min-h-10 px-3 rounded-xl">취소</button>
      </div> : <div className="flex justify-end gap-2 mt-4"><button type="button" ref={cancelRef} disabled={busy} onClick={close} className="px-3 rounded-xl">취소</button><button type="button" disabled={busy} onClick={() => run()} className="px-3 rounded-xl bg-app-soft text-app-accent">{busy ? '삭제 중…' : '삭제'}</button></div>}
    </div>
  </div>;
}
