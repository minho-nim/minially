import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import type { AppSettings } from '../../types';
import { notificationSupported } from '../../hooks/useScheduleReminders';

const LEADS = [0, 5, 10, 30, 60];

export const ReminderSetting: React.FC<{ settings: AppSettings; onChange: (next: AppSettings) => void }> = ({ settings, onChange }) => {
  const reminder = settings.reminder ?? { enabled: false, minutesBefore: 10 };
  const [note, setNote] = useState('');
  const supported = notificationSupported();
  const permission = supported ? Notification.permission : 'denied';

  const toggle = async () => {
    if (!supported) return;
    if (!reminder.enabled) {
      const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (result !== 'granted') { setNote('알림이 차단되어 있어요. 브라우저 주소창 왼쪽의 사이트 설정에서 알림을 허용해 주세요.'); return; }
    }
    setNote('');
    onChange({ ...settings, reminder: { ...reminder, enabled: !reminder.enabled } });
  };

  return (
    <div className="p-3 bg-app-canvas border border-app-line rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-app-ink inline-flex items-center gap-1"><Bell className="w-3.5 h-3.5" />일정 알림</p>
          <p className="text-[11px] text-app-muted">시간이 있는 오늘 일정을 시작 전에 알려 줘요. 미니어리가 열려 있을 때만 알려요(PC 앱은 창을 내려 둬도 돼요).</p>
        </div>
        <button type="button" role="switch" aria-checked={reminder.enabled} aria-label="일정 알림" disabled={!supported} onClick={() => void toggle()}
          className={`shrink-0 w-11 h-6 rounded-full transition-colors relative cursor-pointer disabled:opacity-50 ${reminder.enabled ? 'bg-app-accent' : 'bg-app-line'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${reminder.enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      {reminder.enabled && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-app-muted">언제:</span>
          {LEADS.map(m => (
            <button key={m} type="button" onClick={() => onChange({ ...settings, reminder: { ...reminder, minutesBefore: m } })}
              className={`px-2.5 py-1 rounded-md border cursor-pointer ${reminder.minutesBefore === m ? 'bg-app-accent text-white border-transparent' : 'bg-white border-app-line text-app-muted'}`}>
              {m === 0 ? '시작할 때' : m === 60 ? '1시간 전' : `${m}분 전`}
            </button>
          ))}
        </div>
      )}
      {reminder.enabled && permission !== 'granted' && <p className="text-[11px] text-red-600">이 기기에서는 알림이 허용되지 않았어요. 스위치를 껐다 켜서 허용해 주세요.</p>}
      {!supported && <p className="text-[11px] text-app-muted">이 브라우저는 알림을 지원하지 않아요. 아이폰은 홈 화면에 추가한 앱에서만 알림을 쓸 수 있어요.</p>}
      {note && <p role="status" className="text-[11px] text-red-600">{note}</p>}
    </div>
  );
};
