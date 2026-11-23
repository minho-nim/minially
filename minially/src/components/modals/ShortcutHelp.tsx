import React, { useEffect, useRef } from 'react';
import {useScheduleDialog} from '../../hooks/useScheduleDialog';
import { X } from 'lucide-react';
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

export const ShortcutHelp: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const root=useRef<HTMLDivElement>(null);
  useScheduleDialog(open,false,root,onClose,onClose);
  useEffect(()=>{if(!open)return;const frame=requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[open]);
  if (!open) return null;
  return (
    <div onKeyDown={event=>{if(event.key==='?'){event.preventDefault();onClose();}}} ref={root} role="dialog" aria-modal="true" aria-label="단축키" className="app-modal fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={onClose}>
      <div className="w-full max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain bg-white rounded-2xl shadow-xl border border-app-line p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-app-ink">단축키</h3>
          <button type="button" aria-label="닫기" onClick={onClose} className="p-1.5 rounded-lg text-app-muted hover:bg-app-soft cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <dl className="space-y-1.5">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-app-muted">{label}</dt>
              <dd><kbd className="px-2 py-0.5 rounded-md border border-app-line bg-app-canvas text-xs font-semibold text-app-ink whitespace-nowrap">{key}</kbd></dd>
            </div>
          ))}
        </dl>
        <h4 className="mt-4 mb-2 font-bold text-sm">메모 편집</h4>
        <dl className="space-y-1.5">{[['Ctrl + B / I / U','굵게 / 기울임 / 밑줄'],['Ctrl + Z / Y','실행 취소 / 다시 실행'],['Ctrl + S','메모 저장']].map(([key,label])=><div key={key} className="flex justify-between gap-3 text-sm"><dt className="text-app-muted">{label}</dt><dd><kbd className="text-xs whitespace-nowrap">{key}</kbd></dd></div>)}</dl>
        {window.miniallyDesktop&&<><h4 className="mt-4 mb-2 font-bold text-sm">Windows 앱</h4><dl className="space-y-1.5"><div className="flex justify-between gap-3 text-sm"><dt className="text-app-muted">화면 확대·축소 (50~150%)</dt><dd><kbd className="text-xs">Ctrl + 휠</kbd></dd></div><div className="flex justify-between gap-3 text-sm"><dt className="text-app-muted">화면 배율 기본값</dt><dd><kbd className="text-xs">Ctrl + 0</kbd></dd></div><div className="flex justify-between gap-3 text-sm"><dt className="text-app-muted">빠른 메모 열기</dt><dd><kbd className="text-xs">Ctrl + Alt + M</kbd></dd></div><div className="flex justify-between gap-3 text-sm"><dt className="text-app-muted">빠른 메모 완료</dt><dd><kbd className="text-xs">Ctrl + Enter</kbd></dd></div></dl></>}
        <p className="mt-3 text-[11px] text-app-muted">화면 이동 단축키는 입력 중이거나 팝업이 열려 있으면 동작하지 않아요. 메모 편집 단축키는 본문에서 사용하세요.</p>
      </div>
    </div>
  );
};
