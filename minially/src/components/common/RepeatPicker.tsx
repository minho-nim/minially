import React, { useState } from 'react';
import { DatePicker } from './DatePicker';
import { choiceOf, hasMissingDays, WEEKDAY_NAMES, withChoice, type RepeatChoice, type RepeatSettings } from '../../utils/repeat';

const choices = (date: string): [RepeatChoice, string][] => {
  const month = Number(date.slice(5, 7)), day = Number(date.slice(8, 10));
  return [['none', '반복 없음'], ['daily', '매일'], ['weekdays', '평일'], ['weekly', '매주'], ['biweekly', '2주마다'],
    ['monthly', date ? `매월 ${day}일` : '매월 같은 날짜'], ['yearly', date ? `매년 ${month}월 ${day}일` : '매년 같은 날짜']];
};
type EndMode = 'never' | 'date' | 'count';
const END_MODES: [EndMode, string][] = [['never', '계속'], ['date', '날짜'], ['count', '횟수']];

/** 반복 선택 판: 간편 입력창과 상세 등록 창이 같이 쓴다. */
export function RepeatPicker({ value, onChange, date, idPrefix }: { value: RepeatSettings; onChange: (value: RepeatSettings) => void; date: string; idPrefix: string }) {
  const choice = choiceOf(value);
  const set = (patch: Partial<RepeatSettings>) => onChange({ ...value, ...patch });
  const toggleDay = (day: number) => set({ weekdays: value.weekdays.includes(day) ? value.weekdays.filter(d => d !== day) : [...value.weekdays, day] });
  const day = Number(date.slice(8, 10));
  // 끝내는 방식은 하나만: 계속 / 종료일 / 횟수
  const [endMode, setEndMode] = useState<EndMode>(() => value.count !== '' ? 'count' : value.endDate ? 'date' : 'never');
  const chooseEnd = (mode: EndMode) => { setEndMode(mode); set(mode === 'date' ? { count: '' } : mode === 'count' ? { endDate: '' } : { endDate: '', count: '' }); };
  return <div className="space-y-2" data-repeat-picker>
    <label className="block text-xs font-semibold" htmlFor={idPrefix + '-repeat'}>반복</label>
    <select id={idPrefix + '-repeat'} value={choice} onChange={e => onChange(withChoice(value, e.target.value as RepeatChoice, date))} className="w-full min-h-10 px-3 text-sm border border-app-line rounded-xl bg-app-canvas">
      {choices(date).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      {choice === 'custom' && <option value="custom">기존 사용자 지정 반복 유지</option>}
    </select>
    {value.frequency === 'weekly' && <div role="group" aria-label="반복 요일" className="flex gap-1">
      {WEEKDAY_NAMES.map((name, i) => <button key={name} type="button" aria-pressed={value.weekdays.includes(i)} aria-label={name + '요일'} onClick={() => toggleDay(i)}
        className={'flex-1 min-h-9 rounded-lg text-xs border ' + (value.weekdays.includes(i) ? 'bg-app-accent-ink text-white border-app-accent font-semibold' : 'bg-white border-app-line text-app-muted')}>{name}</button>)}
    </div>}
    {hasMissingDays(value, date) && <label className="flex flex-wrap items-center gap-1 text-xs text-app-muted">
      {value.frequency === 'yearly' ? '2월 29일이 없는 해는' : `${day}일이 없는 달은`}
      <select aria-label="없는 날짜 처리" value={value.missingDay} onChange={e => set({ missingDay: e.target.value as RepeatSettings['missingDay'] })} className="min-h-9 px-2 border border-app-line rounded-lg bg-white text-app-ink">
        <option value="last">{value.frequency === 'yearly' ? '2월 28일에 표시' : '말일에 표시'}</option><option value="skip">건너뛰기</option>
      </select>
    </label>}
    {value.frequency !== 'none' && <>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold shrink-0">끝</span>
        <div role="radiogroup" aria-label="반복 끝" className="flex flex-1 gap-1">
          {END_MODES.map(([mode, label]) => <button key={mode} type="button" role="radio" aria-checked={endMode === mode} onClick={() => chooseEnd(mode)}
            className={'flex-1 min-h-9 rounded-lg text-xs border ' + (endMode === mode ? 'bg-app-accent-ink text-white border-app-accent font-semibold' : 'bg-white border-app-line text-app-muted')}>{label}</button>)}
        </div>
      </div>
      {endMode === 'date' && <DatePicker label="반복 종료일" value={value.endDate} onChange={endDate => set({ endDate })} />}
      {endMode === 'count' && <label className="flex items-center gap-2 text-xs text-app-muted">
        횟수
        <input type="number" inputMode="numeric" min={1} max={999} aria-label="반복 횟수" value={value.count}
          onChange={e => set({ count: e.target.value === '' ? '' : Math.floor(Number(e.target.value)) })} className="w-24 min-h-9 px-2 text-base border border-app-line rounded-lg bg-white text-app-ink" />
        번
      </label>}
    </>}
  </div>;
}
