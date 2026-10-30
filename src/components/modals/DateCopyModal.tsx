import { DatePicker } from '../common/DatePicker';
import React, { useState, useRef } from 'react';
import { Schedule } from '../../types';
import { formatKoreanDate } from '../../utils/dateHelpers';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { DiscardPrompt } from '../common/DiscardPrompt';
import { X, Copy, Calendar, CheckSquare, Square } from 'lucide-react';

interface DateCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDate: string;
  sourceSchedules: Schedule[];
  onConfirmCopy: (selectedScheduleIds: string[], targetDates: string[]) => Promise<void> | void;
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
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null), baseline = useRef(''), busy = useRef(false);
  const snapshot = () => JSON.stringify([[...selectedIds].sort(), [...targetDates].sort()]);
  const guard = useDiscardGuard(snapshot() !== baseline.current || !!newTargetInput, pending);
  const close = () => { if (guard.confirming) { guard.cancel(); return false; } return guard.request(onClose); };
  useScheduleDialog(isOpen, false, modalRef, close, close);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedIds(sourceSchedules.map((s) => s.id));
      const [y, m, d] = sourceDate.split('-').map(Number);
      const nextDate = new Date(y, m - 1, d + 1);
      const nextStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      setTargetDates([nextStr]);
      setNewTargetInput(''); setError('');
      baseline.current = JSON.stringify([sourceSchedules.map(s => s.id).sort(), [nextStr]]);
    }
  }, [isOpen, sourceDate]);

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

  const handleConfirm = async () => {
    if (selectedIds.length === 0 || targetDates.length === 0 || busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await onConfirmCopy(selectedIds, targetDates); onClose(); } catch { setError('복사하지 못했습니다. 선택한 일정과 날짜는 유지됩니다. 다시 시도해 주세요.'); } finally { busy.current = false; setPending(false); }
  };

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label="일정 복사" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[rgba(45,35,40,0.25)]">
      <div className="w-full sm:max-w-md bg-white rounded-2xl shadow-xl border border-[#F0E7EB] overflow-hidden flex flex-col max-h-[min(90dvh,var(--modal-height,100dvh))] pb-safe safe-bottom">
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
            aria-label="복사 닫기"
            onClick={close}
            className="p-1 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {guard.confirming && <DiscardPrompt onContinue={guard.cancel} onDiscard={guard.discard} />}
        {error && <p role="alert" className="px-5 pt-3 text-xs text-red-600">{error}</p>}
        {/* Body */}
        <fieldset disabled={pending} className="p-5 space-y-4 overflow-y-auto min-h-0">
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
            <div className="flex items-start gap-2 mb-2">
              <DatePicker label="복사할 날짜 추가" value={newTargetInput} onChange={setNewTargetInput} />
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
                    aria-label={dateVal + ' 선택 해제'}
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
        </fieldset>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#F0E7EB] bg-white flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 text-xs font-medium text-[#85777D] hover:bg-[#F6E8ED] rounded-xl transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={totalCopiesCount === 0 || pending}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{pending ? '복사 중…' : '복사'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
