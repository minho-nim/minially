import { formatNumber } from '../../shared/client/api';

// 작은 그래프 모음(라이브러리 없이 SVG·CSS). mini-log/src/Charts.tsx와 같은 내용을 유지한다(앱마다 React를 따로 써서 복사본).
// 숫자는 늘 글자로도 함께 보여 준다(색만으로 구분하지 않기).

export interface Slice { label: string; value: number; color: string }

/** 도넛: 가운데 합계, 옆에 범례(이름·값·비율) */
export function Donut({ slices, center, sub, size = 112, format = formatNumber, label }: { slices: Slice[]; center?: string; sub?: string; size?: number; format?: (n: number) => string; label: string }) {
  const total = slices.reduce((n, s) => n + Math.max(0, s.value), 0);
  const r = 15.915; // 둘레 100
  let offset = 25; // 12시 방향부터
  return (
    <div className="donut">
      <svg width={size} height={size} viewBox="0 0 42 42" role="img" aria-label={`${label}: ${slices.map(s => `${s.label} ${format(s.value)}`).join(', ')}`}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--chart-empty)" strokeWidth="6" />
        {total > 0 && slices.filter(s => s.value > 0).map(s => {
          const pct = (s.value / total) * 100;
          const el = <circle key={s.label} cx="21" cy="21" r={r} fill="none" stroke={s.color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />;
          offset -= pct;
          return el;
        })}
        <text x="21" y={sub ? 21 : 23} textAnchor="middle" className="donut-center">{center ?? format(total)}</text>
        {sub && <text x="21" y="27" textAnchor="middle" className="donut-sub">{sub}</text>}
      </svg>
      <ul className="donut-legend">
        {slices.map(s => (
          <li key={s.label}><i style={{ background: s.color }} aria-hidden="true" /><span>{s.label}</span><b>{format(s.value)}</b><span className="muted">{total ? Math.round((s.value / total) * 100) : 0}%</span></li>
        ))}
      </ul>
    </div>
  );
}

/** 세로 막대(월별 등): 막대 위에 값, 아래에 이름. 마지막(이번 달)은 진하게 */
export function Columns({ items, format = formatNumber, label, color = 'var(--chart-main)' }: { items: { label: string; value: number }[]; format?: (n: number) => string; label: string; color?: string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="cols" role="img" aria-label={`${label}: ${items.map(i => `${i.label} ${format(i.value)}`).join(', ')}`}>
      {items.map((i, n) => (
        <div key={i.label} className={`col${n === items.length - 1 ? ' now' : ''}`}>
          <span className="col-val">{i.value ? format(i.value) : ''}</span>
          <span className="col-bar" style={{ height: `${Math.max(i.value ? 6 : 2, (i.value / max) * 100)}%`, background: color }} />
          <span className="col-label">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

/** 가로 막대 목록(순위·작업별 등): 이름 | 막대 | 값 */
export function BarList({ items, format = formatNumber, label, color = 'var(--chart-main)' }: { items: { label: string; value: number; hint?: string; href?: string }[]; format?: (n: number) => string; label: string; color?: string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <ul className="barlist" aria-label={label}>
      {items.map(i => (
        <li key={i.label}>
          <span className="bl-name">{i.href ? <a href={i.href} target="_blank" rel="noopener noreferrer">{i.label}</a> : i.label}{i.hint && <span className="muted small"> {i.hint}</span>}</span>
          <span className="bl-track" aria-hidden="true"><span style={{ width: `${(i.value / max) * 100}%`, background: color }} /></span>
          <b className="bl-val">{format(i.value)}</b>
        </li>
      ))}
    </ul>
  );
}
