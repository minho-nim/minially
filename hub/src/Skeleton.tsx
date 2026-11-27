// 미니로그·미니허브에 같은 내용으로 둔다(shared 폴더에는 React 타입이 없어서). 고치면 둘 다 고친다.
// 불러오는 동안 화면 윤곽(Mobbin·Refero의 로딩 화면처럼): 글 한 줄 대신 회색 자리를 먼저 그려 화면이 덜 출렁이게.
// 화면 읽기 프로그램에는 '불러오는 중'으로 알린다(aria-busy). 여러 개가 한꺼번에 떠도 상태 알림(role=status)끼리 겹치지 않게 status로 두지 않는다.
export function Skeleton({ rows = 3, label = '불러오는 중…', compact = false }: { rows?: number; label?: string; compact?: boolean }) {
  return (
    <div className={`skel${compact ? ' compact' : ''}`} aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skel-row" key={i} aria-hidden="true">
          <span className="skel-bar" style={{ width: `${[55, 40, 62, 48][i % 4]}%` }} />
          {!compact && <span className="skel-bar thin" style={{ width: `${[82, 70, 76, 64][i % 4]}%` }} />}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
