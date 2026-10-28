import React, { useState } from 'react';
import { ScheduleCategory, CategoryItem } from '../../types';
import { CalendarRange, X, Calendar, Clock } from 'lucide-react';

interface BatchDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  defaultDate?: string;
  onConfirmBatch: (scheduleData: {
    title: string;
    startTime: string;
    endTime: string;
    category: ScheduleCategory;
    memo: string;
  }, dates: string[]) => void;
}

export const BatchDateModal: React.FC<BatchDateModalProps> = ({
  isOpen,
  onClose,
  categories,
  defaultDate,
  onConfirmBatch,
}) => {
  const [title, setTitle] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<ScheduleCategory>('work');
  const [memo, setMemo] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setTitle('');
      setIsAllDay(true);
      setStartTime('09:00');
      setEndTime('10:00');
      setMemo('');
      setCategory(categories[0]?.id || 'work');
      const initial = defaultDate || new Date().toISOString().slice(0, 10);
      setDates([initial]);
      setNewDateInput('');
    }
  }, [isOpen, defaultDate, categories]);

  if (!isOpen) return null;

  const handleAddDate = (dateVal: string) => {
    if (!dateVal || dates.includes(dateVal)) return;
    setDates((prev) => [...prev, dateVal].sort());
    setNewDateInput('');
  };

  const handleRemoveDate = (dateVal: string) => {
    setDates((prev) => prev.filter((d) => d !== dateVal));
  };

  const handleAddQuickRange = (daysCount: number) => {
    const baseStr = dates[0] || defaultDate || new Date().toISOString().slice(0, 10);
    const [y, m, d] = baseStr.split('-').map(Number);
    const newDatesList = [...dates];
    for (let i = 1; i < daysCount; i++) {
      const next = new Date(y, m - 1, d + i);
      const str = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      if (!newDatesList.includes(str)) {
        newDatesList.push(str);
      }
    }
    setDates(newDatesList.sort());
  };

  const handleConfirm = () => {
    if (!title.trim() || dates.length === 0) return;
    onConfirmBatch(
      {
        title: title.trim(),
        startTime: isAllDay ? '' : startTime,
        endTime: isAllDay ? '' : endTime,
        category,
        memo: memo.trim(),
      },
      dates
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#F0E7EB] overflow-hidden flex flex-col max-h-[90vh] pb-safe safe-bottom">
        <div className="w-10 h-1 bg-[#F0E7EB] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#F0E7EB] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-[#CF8FA8]" />
            <h3 className="text-base font-bold text-[#3E3438]">여러 날짜 일괄 등록</h3>
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
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목을 입력하세요"
              autoFocus
              className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl focus:outline-none focus:border-[#CF8FA8] text-[#3E3438]"
            />
          </div>

          {/* Quick Date range buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#3E3438]">
                등록할 날짜 ({dates.length}일)
              </label>
              <div className="flex items-center gap-1.5 text-xs text-[#CF8FA8]">
                <button
                  type="button"
                  onClick={() => handleAddQuickRange(3)}
                  className="hover:underline cursor-pointer"
                >
                  +3일
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleAddQuickRange(5)}
                  className="hover:underline cursor-pointer"
                >
                  +5일
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleAddQuickRange(7)}
                  className="hover:underline cursor-pointer"
                >
                  +7일
                </button>
              </div>
            </div>

            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={newDateInput}
                onChange={(e) => setNewDateInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl focus:outline-none focus:border-[#CF8FA8] text-[#3E3438]"
              />
              <button
                type="button"
                onClick={() => handleAddDate(newDateInput)}
                disabled={!newDateInput}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-xl transition-all cursor-pointer"
              >
                추가
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 p-2 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl max-h-32 overflow-y-auto">
              {dates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white text-[#3E3438] border border-[#F0E7EB] rounded-lg shadow-2xs"
                >
                  <Calendar className="w-3 h-3 text-[#CF8FA8]" />
                  <span>{d}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDate(d)}
                    className="text-[#85777D] hover:text-red-500 cursor-pointer ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-[#3E3438] block mb-1.5">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    category === cat.id
                      ? 'bg-[#F4DCE5] border-[#CF8FA8] text-[#3E3438] font-bold shadow-2xs'
                      : 'bg-white border-[#F0E7EB] text-[#85777D] hover:bg-[#FFFAFB]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#F0E7EB] bg-white flex items-center justify-between shrink-0">
          <span className="text-xs text-[#85777D]">
            총 <span className="font-bold text-[#CF8FA8]">{dates.length}</span>개 일정 등록
          </span>
          <div className="flex items-center gap-2">
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
              disabled={!title.trim() || dates.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              일괄 등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
