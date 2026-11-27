// 메뉴 아이콘(선 아이콘, 글자 색을 따름). 미니로그 src/NavIcon.tsx와 같은 모양(공용 폴더에 React 타입이 없어 복사).
const PATHS: Record<string, string> = {
  overview: 'M4 3h6v9H4zM14 3h6v5h-6zM14 12h6v9h-6zM4 16h6v5H4z',
  monthly: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6',
  apps: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  usage: 'M12 3l1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
};
export function NavIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg className="nav-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? PATHS.overview} />
    </svg>
  );
}
