import React, { useState } from 'react';
import { Schedule } from '../../types';
import { formatKoreanDate } from '../../utils/dateHelpers';
import { ArrowRight, Copy, X } from 'lucide-react';

interface ScheduleMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  onMove: (scheduleId: string, newDate: string) => void;
  onCopy: (scheduleId: string, targetDate: string) => void;
}

export const ScheduleMoveModal: React.FC<ScheduleMoveModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onMove,
  onCopy,
}) => {
  const [targetDate, setTargetDate] = useState('');

  React.useEffect(() => {
    if (schedule && isOpen) {
      const [y, m, d] = schedule.date.split('-').map(Number);
      const next = new Date(y, m - 1, d + 1);
      const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      setTargetDate(nextStr);
    }
  }, [schedule, isOpen]);

  if (!isOpen || !schedule) return null;

  const handleMoveAction = () => {
    if (!targetDate) return;
    onMove(schedule.id, targetDate);
    onClose();
  };

  const handleCopyAction = () => {
    if (!targetDate) return;
    onCopy(schedule.id, targetDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#F0E7EB] overflow-hidden pb-safe safe-bottom">
        <div className="w-10 h-1 bg-[#F0E7EB] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#F0E7EB] flex items-center justify-between bg-white">
          <h3 className="text-base font-bold text-[#3E3438]">일정 이동 / 복사</h3>
          <button
            onClick={onClose}
            className="p-1 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div>
            <span className="text-[#85777D] block mb-1">선택된 일정</span>
            <p className="font-semibold text-sm text-[#3E3438] truncate">{schedule.title}</p>
            <p className="text-[11px] text-[#85777D] mt-0.5">
              현재: {formatKoreanDate(schedule.date)} {schedule.startTime && `(${schedule.startTime})`}
            </p>
          </div>

          <div>
            <label className="font-semibold text-[#3E3438] block mb-1.5">대상 날짜 선택</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl focus:outline-none focus:border-[#CF8FA8] text-[#3E3438]"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleMoveAction}
              disabled={!targetDate || targetDate === schedule.date}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>이 날짜로 이동하기</span>
            </button>
            <button
              type="button"
              onClick={handleCopyAction}
              disabled={!targetDate}
              className="w-full py-2.5 px-4 text-xs font-semibold text-[#3E3438] bg-[#F6E8ED] hover:bg-[#F0DCE4] border border-[#F0E7EB] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Copy className="w-3.5 h-3.5 text-[#CF8FA8]" />
              <span>이 날짜로 복사하기 (원본 유지)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
