import { useEffect, useRef } from 'react';
import type { ReminderSettings, Schedule } from '../types';
import { getTodayDateString } from '../utils/dateHelpers';

// 일정 알림: 앱이 열려 있는 동안(PC 설치 앱은 창을 내려 둬도) 시작 N분 전에 알림을 띄운다.
// 앱을 완전히 닫으면 알리지 못한다(서버 푸시가 필요).
const SENT_KEY = 'minially-reminders-sent';

function loadSent(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}'); } catch { return {}; }
}
function saveSent(sent: Record<string, number>) {
  const weekAgo = Date.now() - 7 * 86400_000;
  const kept = Object.fromEntries(Object.entries(sent).filter(([, at]) => at > weekAgo));
  try { localStorage.setItem(SENT_KEY, JSON.stringify(kept)); } catch { /* 무시 */ }
}

export function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function show(title: string, body: string, tag: string) {
  const options: NotificationOptions = { body, tag, icon: `${import.meta.env.BASE_URL}pwa-192x192.png`, badge: `${import.meta.env.BASE_URL}pwa-192x192.png` };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, options); return; }
  } catch { /* 서비스 워커가 없으면 아래로 */ }
  new Notification(title, options);
}

export function useScheduleReminders(schedules: Schedule[], reminder: ReminderSettings | undefined) {
  const latest = useRef(schedules);
  latest.current = schedules;

  useEffect(() => {
    if (!reminder?.enabled || !notificationSupported()) return;
    const lead = Math.max(0, reminder.minutesBefore) * 60_000;
    const check = () => {
      if (Notification.permission !== 'granted') return;
      const today = getTodayDateString();
      const now = Date.now();
      const sent = loadSent();
      let changed = false;
      for (const s of latest.current) {
        if (s.date !== today || !s.startTime || s.completed) continue;
        const [h, m] = s.startTime.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        const start = new Date(); start.setHours(h, m, 0, 0);
        const at = start.getTime() - lead;
        const key = `${s.id}@${s.date}@${s.startTime}`;
        // 알릴 시각이 지났고, 시작한 지 10분이 넘지 않았고, 아직 안 보냈으면
        if (now >= at && now <= start.getTime() + 10 * 60_000 && !sent[key]) {
          sent[key] = now; changed = true;
          const left = Math.ceil((start.getTime() - now) / 60_000);
          const when = left >= 60 ? '1시간 뒤 시작' : left > 0 ? `${left}분 뒤 시작` : '지금 시작';
          void show(s.title, `${s.startTime}${s.endTime ? ` ~ ${s.endTime}` : ''} · ${when}`, key);
        }
      }
      if (changed) saveSent(sent);
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [reminder?.enabled, reminder?.minutesBefore]);
}
