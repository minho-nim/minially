import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Schedule, CategoryItem } from '../../types';
import { formatKoreanDate } from '../../utils/dateHelpers';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { DatePicker } from '../common/DatePicker';
import { Search, X, Calendar, CalendarRange, Clock, Star } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  sessionKey?: number;
  onClose: () => void;
  schedules: Schedule[];
  categories: CategoryItem[];
  onSelectSchedule: (schedule: Schedule) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen, sessionKey = 0,
  onClose,
  schedules,
  categories,
  onSelectSchedule,
}) => {
  const [query, setQuery] = useState('');
  const [from,setFrom]=useState(''),[to,setTo]=useState('');
  const hasRange=Boolean(from||to);
  const invalidRange=Boolean(from&&to&&from>to);
  const inputRef = useRef<HTMLInputElement>(null), modalRef = useRef<HTMLDivElement>(null);
  useScheduleDialog(isOpen, false, modalRef, onClose, onClose);
  useEffect(() => {setQuery('');setFrom('');setTo('');}, [sessionKey]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const catMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if ((!q&&!hasRange)||invalidRange) return [];
    return schedules
      .filter((s) => {
        if ((from&&s.date<from)||(to&&s.date>to)) return false;
        if(!q)return true;
        const titleMatch = s.title.toLowerCase().includes(q);
        const memoMatch = s.memo ? s.memo.toLowerCase().includes(q) : false;
        const catName = catMap.get(s.category) || '';
        const catMatch = catName.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
        return titleMatch || memoMatch || catMatch;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, query, catMap, from, to, hasRange, invalidRange]);

  if (!isOpen) return null;

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label="일정 검색" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(52,40,35,0.30)]">
      <div style={{minHeight:'min(240px, calc(var(--modal-height, 100dvh) - 32px))'}} className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-app-line overflow-hidden flex flex-col max-h-[min(80dvh,var(--modal-height,100dvh))]">
        <header className="shrink-0 px-3 py-1.5 border-b border-app-line flex items-center justify-between"><h2 className="text-sm font-bold text-app-ink">일정 검색</h2><button type="button" aria-label="일정 검색 닫기" title="닫기" onClick={onClose} className="min-h-9 min-w-9 flex items-center justify-center rounded-lg text-app-muted hover:bg-app-soft"><X aria-hidden="true" className="h-4 w-4"/></button></header>
        {/* Search Input Bar */}
        <div className="px-3 py-2 border-b border-app-line flex items-center gap-2 bg-app-canvas">
          <Search className="w-4 h-4 text-app-accent shrink-0" />
          <input
            ref={inputRef}
            type="search"
            aria-label="일정 검색어"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="일정 제목, 메모, 카테고리 검색..."
            className="w-full min-w-0 bg-transparent text-base sm:text-sm text-app-ink placeholder:text-app-muted/70 focus:outline-none"
          />
          {query && (
            <button
              aria-label="검색어 지우기"
              onClick={() => setQuery('')}
              className="p-1 text-app-muted hover:text-app-ink rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

        </div>

        <details className="shrink-0 px-3 py-1 border-b border-app-line text-xs text-app-muted"><summary className="min-h-8 cursor-pointer py-1.5"><span className="inline-flex items-center gap-1"><CalendarRange aria-hidden="true" className="h-3.5 w-3.5"/>기간 검색{hasRange?' · 적용 중':''}</span></summary><div className="grid gap-2 pb-2 sm:grid-cols-2"><DatePicker label="검색 시작일" value={from} onChange={setFrom}/><DatePicker label="검색 종료일" value={to} onChange={setTo}/></div>{hasRange&&<button type="button" onClick={()=>{setFrom('');setTo('');}} className="min-h-8 text-xs text-app-accent">기간 초기화</button>}{invalidRange&&<p role="alert" className="pb-2 text-xs text-red-600">종료일은 시작일 이후로 선택해 주세요.</p>}</details>
        {/* Results List */}
        <div className="flex-1 px-3 py-2 overflow-y-auto space-y-1 min-h-0">
          {!query.trim()&&!hasRange ? (
            <div className="py-1.5 text-center text-xs text-app-muted">
              검색어 또는 기간으로 일정을 찾아보세요.
            </div>
          ) : results.length === 0 ? (
            <div className="py-1.5 text-center text-xs text-app-muted">
              조건에 맞는 일정이 없습니다.
            </div>
          ) : (
            <>
              <div className="px-3 py-1 text-[11px] font-semibold text-app-muted flex items-center justify-between">
                <span>검색 결과</span>
                <span>{results.length}건</span>
              </div>
              {results.map((item) => (
                <div
                  key={item.id}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); onSelectSchedule(item); } }}
                  onClick={() => {
                    onClose();
                    onSelectSchedule(item);
                  }}
                  className="p-2 rounded-lg hover:bg-app-canvas transition-colors cursor-pointer flex items-center justify-between gap-3 border border-transparent hover:border-app-line"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {item.isImportant && <Star aria-label="중요 일정" className="w-3.5 h-3.5 shrink-0 text-app-accent fill-current" />}
                      <span className={`text-sm text-app-ink break-words ${item.completed ? 'line-through text-app-muted' : item.isImportant ? 'font-bold' : 'font-medium'}`}>
                        {item.title}
                      </span>
                      {item.completed && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md font-medium">
                          완료
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-app-muted">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-app-accent" />
                        {formatKoreanDate(item.date)}
                      </span>
                      {item.startTime && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-app-muted" />
                          {item.startTime}
                        </span>
                      )}
                      <span className="bg-app-soft text-app-accent px-1.5 py-0.2 rounded text-[10px] font-semibold">
                        {catMap.get(item.category) || item.category || '미분류'}
                      </span>
                    </div>
                    {item.memo && (
                      <p className="text-xs text-app-muted mt-0.5 truncate">{item.memo}</p>
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
