import React, { useState } from 'react';
import { Schedule } from '../../types';
import { formatKoreanDate } from '../../utils/dateHelpers';
import { X, Copy, Calendar, CheckSquare, Square } from 'lucide-react';

interface DateCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDate: string;
  sourceSchedules: Schedule[];
  onConfirmCopy: (selectedScheduleIds: string[], targetDates: string[]) => void;
}

export const DateCopyModal: React.FC<DateCopyModalProps> = ({
  isOpen,
  onClose,
  sourceDate,
  sourceSchedules,
  onConfirmCopy,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [newTargetInput, setNewTargetInput] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      setSelectedIds(sourceSchedules.map((s) => s.id));
      const [y, m, d] = sourceDate.split('-').map(Number);
      const nextDate = new Date(y, m - 1, d + 1);
      const nextStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      setTargetDates([nextStr]);
      setNewTargetInput('');
    }
  }, [isOpen, sourceDate, sourceSchedules]);

  if (!isOpen) return null;

  const toggleSchedule = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sourceSchedules.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sourceSchedules.map((s) => s.id));
    }
  };

  const handleAddTargetDate = (dateVal: string) => {
    if (!dateVal || targetDates.includes(dateVal)) return;
    setTargetDates((prev) => [...prev, dateVal].sort());
    setNewTargetInput('');
  };

  const handleRemoveTargetDate = (dateVal: string) => {
    setTargetDates((prev) => prev.filter((d) => d !== dateVal));
  };

  const totalCopiesCount = selectedIds.length * targetDates.length;

  const handleConfirm = () => {
    if (selectedIds.length === 0 || targetDates.length === 0) return;
    onConfirmCopy(selectedIds, targetDates);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#F0E7EB] overflow-hidden flex flex-col max-h-[90vh] pb-safe safe-bottom">
        <div className="w-10 h-1 bg-[#F0E7EB] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#F0E7EB] flex items-center justify-between bg-white shrink-0">
          <div>
            <h3 className="text-base font-bold text-[#3E3438]">일정 복사</h3>
            <p className="text-xs text-[#85777D] mt-0.5">
              기준: <span className="font-semibold text-[#3E3438]">{formatKoreanDate(sourceDate)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Step 1: Select schedules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#3E3438]">
                복사할 일정 ({selectedIds.length}/{sourceSchedules.length})
              </label>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-[#CF8FA8] hover:underline cursor-pointer"
              >
                {selectedIds.length === sourceSchedules.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            {sourceSchedules.length === 0 ? (
              <p className="text-xs text-[#85777D] p-4 text-center bg-[#FFFAFB] rounded-xl border border-[#F0E7EB]">
                등록된 일정이 없습니다.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto divide-y divide-[#F0E7EB] border border-[#F0E7EB] rounded-xl">
                {sourceSchedules.map((schedule) => {
                  const isChecked = selectedIds.includes(schedule.id);
                  return (
                    <div
                      key={schedule.id}
                      onClick={() => toggleSchedule(schedule.id)}
                      className="flex items-center gap-2.5 p-2.5 cursor-pointer hover:bg-[#FFFAFB] transition-colors"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[#CF8FA8] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-[#85777D]/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#3E3438] truncate">{schedule.title}</p>
                        <p className="text-[11px] text-[#85777D]">
                          {schedule.startTime || '종일'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Select target dates */}
          <div>
            <label className="text-xs font-semibold text-[#3E3438] block mb-1.5">
              대상 날짜 추가
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={newTargetInput}
                onChange={(e) => setNewTargetInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl focus:outline-none focus:border-[#CF8FA8] text-[#3E3438]"
              />
              <button
                type="button"
                onClick={() => handleAddTargetDate(newTargetInput)}
                disabled={!newTargetInput}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-xl transition-all cursor-pointer"
              >
                추가
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 p-2 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl min-h-[38px]">
              {targetDates.map((dateVal) => (
                <span
                  key={dateVal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white text-[#3E3438] border border-[#F0E7EB] rounded-lg shadow-2xs"
                >
                  <Calendar className="w-3 h-3 text-[#CF8FA8]" />
                  <span>{dateVal}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTargetDate(dateVal)}
                    className="text-[#85777D] hover:text-red-500 cursor-pointer ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="p-2.5 bg-[#F6E8ED] border border-[#F0E7EB] rounded-xl flex items-center justify-between text-xs text-[#3E3438]">
            <span className="text-[#85777D]">총 복사 일정</span>
            <span className="font-bold text-[#CF8FA8]">{totalCopiesCount}건</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#F0E7EB] bg-white flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#85777D] hover:bg-[#F6E8ED] rounded-xl transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={totalCopiesCount === 0}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>복사하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
