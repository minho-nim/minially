import React, { useEffect } from 'react';
import { UndoNotice } from '../../utils/undoManager';
import { RotateCcw, X, Check } from 'lucide-react';

interface UndoToastProps {
  notice: UndoNotice | null;
  onUndo: (notice: UndoNotice) => void;
  onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ notice, onUndo, onDismiss }) => {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#3E3438] text-white px-4 py-2.5 rounded-2xl shadow-lg border border-stone-600/40 text-xs sm:text-sm max-w-[92vw] sm:max-w-md animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="w-4 h-4 rounded-full bg-[#CF8FA8] text-white flex items-center justify-center shrink-0">
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </div>
      <span className="truncate font-medium">{notice.message}</span>
      <div className="flex items-center gap-1 ml-auto shrink-0">
        <button
          onClick={() => onUndo(notice)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white/20 hover:bg-white/30 active:scale-95 text-[#F4DCE5] hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>실행 취소</span>
        </button>
        <button
          onClick={onDismiss}
          className="p-1 text-stone-400 hover:text-white rounded-md transition-colors cursor-pointer"
          aria-label="닫기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
