import { useEffect, useState } from 'react';
import { api, formatNumber } from '../../shared/client/api';
import { monthLabel, shortMonth, type History, type MonthRow } from '../../shared/client/report';
import { GroupedColumns } from './Charts';
import { useNameOf } from './names';

// 사람별 월별 비교(최근 12개월)와 누적 합계. 미니로그에서 각자 보는 숫자와 같은 계산(shared/server/report.ts monthlyHistory).
const METRICS: { key: keyof MonthRow; label: string; unit: string }[] = [
  { key: 'posts', label: '게시 글', unit: '개' },
  { key: 'views', label: '조회수', unit: '' },
  { key: 'revenue', label: '받은 금액', unit: '원' },
  { key: 'ai_calls', label: 'AI 호출', unit: '번' },
];
const PERSON_COLORS = ['var(--sig)', '#7C8CE0', '#3FAE8B'];

export function HistoryCompare() {
  const nameOf = useNameOf();
  const [histories, setHistories] = useState<History[] | null>(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState(METRICS[0]);
  useEffect(() => {
    let alive = true;
    api<{ histories: History[] }>('/api/history').then(d => { if (alive) setHistories(d.histories); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : '불러오지 못했어요.'); });
    return () => { alive = false; };
  }, []);
  const months = histories?.[0]?.months.map(m => m.month) ?? [];
  const fmt = (n: number) => `${formatNumber(n)}${metric.unit}`;
  return (
    <section className="card stack no-print history-compare" aria-labelledby="hc-title">
      <h3 id="hc-title" className="card-title">월별 비교<span className="muted small"> · 최근 12개월{months.length ? ` (${monthLabel(months[0])}~)` : ''}</span></h3>
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      {!histories && !error && <p className="muted small" role="status" style={{ margin: 0 }}>불러오는 중…</p>}
      {histories && (
        <>
          <div className="seg" role="group" aria-label="비교할 숫자">
            {METRICS.map(m => <button key={m.key} type="button" aria-pressed={m.key === metric.key} onClick={() => setMetric(m)}>{m.label}</button>)}
          </div>
          {!histories.some(h => h.months.some(m => Number(m[metric.key] ?? 0) > 0)) ? <p className="muted small" style={{ margin: 0 }}>최근 12개월 {metric.label} 기록이 아직 없어요. 각자 미니로그에서 블로그 글·수익을 기록하면 여기서 견줘 볼 수 있어요.</p> : <GroupedColumns label={`사람별 월별 ${metric.label}`} format={fmt} series={histories.map((h, i) => ({ name: nameOf(h.user), color: PERSON_COLORS[i % PERSON_COLORS.length] }))}
            items={months.map((m, n) => ({ label: shortMonth(m), values: histories.map(h => Number(h.months[n]?.[metric.key] ?? 0)) }))} />}
          <div className="table-wrap">
            <table className="compare-like">
              <caption className="sr-only">사람별 누적 합계</caption>
              <thead><tr><th scope="col">누적 합계</th><th scope="col">글</th><th scope="col">조회</th><th scope="col">받은 금액</th><th scope="col">협찬</th><th scope="col">AI</th><th scope="col">12개월 {metric.label}</th></tr></thead>
              <tbody>{histories.map(h => (
                <tr key={h.user}>
                  <th scope="row">{nameOf(h.user)}</th>
                  <td>{formatNumber(h.total.posts)}</td><td>{formatNumber(h.total.views)}</td><td>{formatNumber(h.total.revenue)}원</td><td>{formatNumber(h.total.sponsor_count)}</td><td>{formatNumber(h.total.ai_calls)}</td>
                  <td>{fmt(h.months.reduce((n, m) => n + Number(m[metric.key] ?? 0), 0))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="muted small" style={{ margin: 0 }}>각자 미니로그 '월간보고'의 누적 합계·월별 내역과 같은 숫자예요.</p>
        </>
      )}
    </section>
  );
}
