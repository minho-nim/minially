import React from 'react';
export function DiscardPrompt({ onContinue, onDiscard, actionLabel = '등록 취소', title = '등록을 취소할까요?' }: { onContinue: () => void; onDiscard: () => void; actionLabel?: string; title?: string }) {
  return <section role="alert" aria-label={actionLabel + ' 확인'} className="m-3 p-3 bg-app-canvas border border-app-outline rounded-xl shrink-0">
    <p className="text-sm font-semibold">{title}</p>
    <p className="text-xs text-app-muted mt-1">입력한 내용은 저장되지 않습니다.</p>
    <div className="flex flex-wrap justify-end gap-2 mt-2">
      <button type="button" autoFocus onClick={onContinue} className="min-h-11 px-3 text-sm rounded-lg border border-app-line">계속 작성</button>
      <button type="button" onClick={onDiscard} className="min-h-11 px-3 text-sm rounded-lg bg-app-soft text-app-accent">{actionLabel}</button>
    </div>
  </section>;
}
