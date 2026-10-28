import { AppData } from '../types';

export const INITIAL_DATA: AppData = {
  schedules: [],
  projects: [],
  tasks: [],
  presets: [],
  categories: [
    { id: 'work', name: '업무', color: '#D98DAA', isDefault: true },
    { id: 'personal', name: '개인', color: '#B08898', isDefault: true },
    { id: 'study', name: '공부/자기계발', color: '#8899B0', isDefault: false },
    { id: 'health', name: '운동/건강', color: '#88B098', isDefault: false },
  ],
  recurrenceRules: [],
  recurrenceExceptions: [],
  settings: {
    startDayOfWeek: 0,
    defaultCategory: 'personal',
    defaultView: 'month',
    showCompletedInCalendar: true,
    vibrateOnAction: true,
  },
};
