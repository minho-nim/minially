import { ScheduleCategory, TaskPriority, TaskStatus } from '../types';

export const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

export function formatKoreanDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayName = DAYS_KR[date.getDay()];
    return `${y}년 ${m}월 ${d}일 (${dayName})`;
  } catch {
    return dateStr;
  }
}

export function formatShortDate(dateStr: string): string {
  try {
    const [, m, d] = dateStr.split('-').map(Number);
    return `${m}월 ${d}일`;
  } catch {
    return dateStr;
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCategoryBadge(category: ScheduleCategory): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (category) {
    case 'work':
      return {
        label: '업무',
        bgClass: 'bg-[#F9EBEF]',
        textClass: 'text-[#9E5170]',
        borderClass: 'border-[#ECD0DB]'
      };
    case 'personal':
      return {
        label: '개인',
        bgClass: 'bg-[#F6EFF4]',
        textClass: 'text-[#875982]',
        borderClass: 'border-[#E7D6E4]'
      };
    case 'project':
    default:
      return {
        label: '프로젝트',
        bgClass: 'bg-[#FFF0F4]',
        textClass: 'text-[#B8587C]',
        borderClass: 'border-[#F5D2DF]'
      };
  }
}

export function getTaskStatusBadge(status: TaskStatus): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'todo':
      return {
        label: '대기',
        bgClass: 'bg-stone-100',
        textClass: 'text-stone-600',
        borderClass: 'border-stone-200'
      };
    case 'doing':
      return {
        label: '진행 중',
        bgClass: 'bg-[#F9EBEF]',
        textClass: 'text-[#B8587C]',
        borderClass: 'border-[#ECD0DB]'
      };
    case 'done':
    default:
      return {
        label: '완료',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200'
      };
  }
}

export function getPriorityBadge(priority: TaskPriority): {
  label: string;
  colorClass: string;
} {
  switch (priority) {
    case 'high':
      return { label: '높음', colorClass: 'text-[#B8587C] font-semibold' };
    case 'medium':
      return { label: '보통', colorClass: 'text-stone-600' };
    case 'low':
    default:
      return { label: '낮음', colorClass: 'text-stone-400' };
  }
}

