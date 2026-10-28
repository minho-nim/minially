import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Schedule, CategoryItem } from '../../types';
import { formatKoreanDate } from '../../utils/dateHelpers';
import { Search, X, Calendar, Clock } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: Schedule[];
  categories: CategoryItem[];
  onSelectSchedule: (schedule: Schedule) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  schedules,
  categories,
  onSelectSchedule,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  const catMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return schedules
      .filter((s) => {
        const titleMatch = s.title.toLowerCase().includes(q);
        const memoMatch = s.memo ? s.memo.toLowerCase().includes(q) : false;
        const catName = catMap.get(s.category) || '';
        const catMatch = catName.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
        return titleMatch || memoMatch || catMatch;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, query, catMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 pt-12 sm:pt-20 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#F0E7EB] overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-[#F0E7EB] flex items-center gap-2.5 bg-[#FFFAFB]">
          <Search className="w-4 h-4 text-[#CF8FA8] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="일정 제목, 메모, 카테고리 검색..."
            className="w-full bg-transparent text-sm text-[#3E3438] placeholder:text-[#85777D]/70 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#85777D] hover:text-[#3E3438] rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto space-y-1 flex-1 min-h-[140px]">
          {!query.trim() ? (
            <div className="py-12 text-center text-xs text-[#85777D]">
              검색어를 입력하면 전체 일정을 찾아드립니다.
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#85777D]">
              '{query}'와 일치하는 일정이 없습니다.
            </div>
          ) : (
            <>
              <div className="px-3 py-1 text-[11px] font-semibold text-[#85777D] flex items-center justify-between">
                <span>검색 결과</span>
                <span>{results.length}건</span>
              </div>
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectSchedule(item);
                    onClose();
                  }}
                  className="p-3 rounded-xl hover:bg-[#FFFAFB] transition-colors cursor-pointer flex items-center justify-between gap-3 border border-transparent hover:border-[#F0E7EB]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-[#3E3438] truncate">
                        {item.title}
                      </span>
                      {item.completed && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md font-medium">
                          완료
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#85777D]">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-[#CF8FA8]" />
                        {formatKoreanDate(item.date)}
                      </span>
                      {item.startTime && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-[#85777D]" />
                          {item.startTime}
                        </span>
                      )}
                      <span className="bg-[#F6E8ED] text-[#CF8FA8] px-1.5 py-0.2 rounded text-[10px] font-semibold">
                        {catMap.get(item.category) || item.category}
                      </span>
                    </div>
                    {item.memo && (
                      <p className="text-xs text-[#85777D] mt-0.5 truncate">{item.memo}</p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
