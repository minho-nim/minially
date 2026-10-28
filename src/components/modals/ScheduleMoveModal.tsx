import { DatePicker } from '../common/DatePicker';
import React, { useState, useRef } from 'react';
import { Schedule } from '../../types';
import { formatKoreanDate } from '../../utils/dateHelpers';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { DiscardPrompt } from '../common/DiscardPrompt';
import { ArrowRight, Copy, X } from 'lucide-react';

interface ScheduleMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  onMove: (scheduleId: string, newDate: string) => Promise<void> | void;
  onCopy: (scheduleId: string, targetDate: string) => Promise<void> | void;
}

export const ScheduleMoveModal: React.FC<ScheduleMoveModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onMove,
  onCopy,
}) => {
  const [targetDate, setTargetDate] = useState('');
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null), baseline = useRef(''), busy = useRef(false);
  const guard = useDiscardGuard(targetDate !== baseline.current, pending);
  const close = () => { if (guard.confirming) { guard.cancel(); return false; } return guard.request(onClose); };
  useScheduleDialog(isOpen, false, modalRef, close, close);

  React.useEffect(() => {
    if (schedule && isOpen) {
      const [y, m, d] = schedule.date.split('-').map(Number);
      const next = new Date(y, m - 1, d + 1);
      const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      setTargetDate(nextStr); baseline.current = nextStr; setError('');
    }
  }, [schedule, isOpen]);

  if (!isOpen || !schedule) return null;

  const submit = async (action: 'move' | 'copy') => {
    if (!targetDate || busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await (action === 'move' ? onMove(schedule.id, targetDate) : onCopy(schedule.id, targetDate)); onClose(); }
    catch { setError('일정을 저장하지 못했습니다. 선택한 날짜는 유지됩니다. 다시 시도해 주세요.'); }
    finally { busy.current = false; setPending(false); }
  };

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label="일정 이동 / 복사" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[rgba(45,35,40,0.25)]">
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#F0E7EB] overflow-y-auto max-h-[var(--modal-height,100dvh)] pb-safe safe-bottom">
        <div className="w-10 h-1 bg-[#F0E7EB] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#F0E7EB] flex items-center justify-between bg-white">
          <h3 className="text-base font-bold text-[#3E3438]">일정 이동 / 복사</h3>
          <button
            onClick={close} aria-label="이동·복사 닫기"
            className="p-1 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {guard.confirming && <DiscardPrompt onContinue={guard.cancel} onDiscard={guard.discard} />}
        {error && <p role="alert" className="px-5 pt-3 text-xs text-red-600">{error}</p>}
        {/* Content */}
        <fieldset disabled={pending} className="p-5 space-y-4 text-xs">
          <div>
            <span className="text-[#85777D] block mb-1">선택된 일정</span>
            <p className="font-semibold text-sm text-[#3E3438] truncate">{schedule.title}</p>
            <p className="text-[11px] text-[#85777D] mt-0.5">
              현재: {formatKoreanDate(schedule.date)} {schedule.startTime && `(${schedule.startTime})`}
            </p>
          </div>

          <div>
            <label className="font-semibold text-[#3E3438] block mb-1.5">대상 날짜 선택</label>
            <DatePicker label="대상 날짜" value={targetDate} onChange={setTargetDate} />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void submit('move')}
              disabled={!targetDate || targetDate === schedule.date}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>{pending ? '저장 중…' : '이동'}</span>
            </button>
            <p className="text-[#85777D] text-center">복사하면 원본 일정이 유지됩니다.</p>
            <button
              type="button"
              onClick={() => void submit('copy')}
              disabled={!targetDate}
              className="w-full py-2.5 px-4 text-xs font-semibold text-[#3E3438] bg-[#F6E8ED] hover:bg-[#F0DCE4] border border-[#F0E7EB] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Copy className="w-3.5 h-3.5 text-[#CF8FA8]" />
              <span>복사</span>
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  );
};
