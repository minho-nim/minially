import React from 'react';

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [hour = '09', minute = '00'] = value.split(':');
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  const legacy = !minutes.includes(minute);
  return <div role="group" aria-label={label} className="flex items-center gap-1 w-full min-w-0">
    <select aria-label={label + ' 시'} value={hour} onChange={e => onChange(e.target.value + ':' + String(Math.floor(Number(minute) / 5) * 5).padStart(2, '0'))} className="min-w-0 flex-1 bg-transparent text-sm text-[#3E3438] focus:outline-none">
      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
    </select><span aria-hidden="true">:</span>
    <select aria-label={label + ' 분'} value={minute} onChange={e => onChange(hour + ':' + e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#3E3438] focus:outline-none">
      {legacy && <option value={minute}>{minute}분 (기존)</option>}{minutes.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  </div>;
}
