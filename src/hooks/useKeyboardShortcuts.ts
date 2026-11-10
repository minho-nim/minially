import { useEffect } from 'react';

// PC에서 키보드만으로 쓰기 위한 단축키. 입력 중이거나 팝업이 열려 있으면 동작하지 않는다.
export interface ShortcutActions {
  newSchedule: () => void;
  search: () => void;
  settings: () => void;
  today: () => void;
  calendarTab: () => void;
  tasksTab: () => void;
  todaySchedules: () => void;
  help: () => void;
  isCalendar: boolean;
}

export const SHORTCUTS: [string, string][] = [
  ['N', '새 일정'],
  ['Ctrl + F  또는  /', '검색'],
  ['← / →', '이전 / 다음 달(주)'],
  ['T', '오늘로 이동'],
  ['M / W', '월간 / 주간 보기'],
  ['1 / 2', '캘린더 / 할 일'],
  ['D', '오늘 일정 보기'],
  ['Ctrl + ,', '설정'],
  ['?', '단축키 도움말'],
];

function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

const modalOpen = () => !!document.querySelector('[role="dialog"][aria-modal="true"], [role="dialog"][aria-label="날짜별 일정"]');
const click = (name: string) => document.querySelector<HTMLButtonElement>(`[data-shortcut="${name}"]`)?.click();

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || typing(e.target)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.altKey && (e.key === 'f' || e.key === 'F')) { if (modalOpen()) return; e.preventDefault(); actions.search(); return; }
      if (ctrl && e.key === ',') { e.preventDefault(); actions.settings(); return; }
      if (ctrl || e.altKey || modalOpen()) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const run = (fn: () => void) => { e.preventDefault(); fn(); };
      switch (key) {
        case 'n': case 'ㅜ': return run(actions.newSchedule);
        case '/': return run(actions.search);
        case '?': return run(actions.help);
        case '1': return run(actions.calendarTab);
        case '2': return run(actions.tasksTab);
        case 'd': case 'ㅇ': return run(actions.todaySchedules);
        case 't': case 'ㅅ': return run(actions.today);
        case 'm': case 'ㅡ': if (actions.isCalendar) run(() => click('month')); return;
        case 'w': case 'ㅈ': if (actions.isCalendar) run(() => click('week')); return;
        case 'ArrowLeft': if (actions.isCalendar) run(() => click('prev')); return;
        case 'ArrowRight': if (actions.isCalendar) run(() => click('next')); return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);
}
