import { useEffect, useState } from 'react';
import { api, formatNumber } from '../../shared/client/api';
import { diffKind, diffText, monthLabel, shiftMonth, sumSummaries, thisMonthKst, type MonthlyReport, type MonthSummary } from '../../shared/client/report';
import { Signature } from './Tomong';
import { useNameOf } from './names';
import { HistoryCompare } from './History';

// 미니허브 월간 보고: C·D 합계 + 사람별 나란히 비교 + 각자 요약·TOP 3. 'PDF로 저장'은 이 부분만 A4로.
type Row = { label: string; pick: (s: MonthSummary) => number; unit?: string; money?: boolean; ai?: boolean };
const ROWS: Row[] = [
  { label: '게시한 글', pick: s => s.posts, unit: '개' },
  { label: '조회수 합계', pick: s => s.views },
  { label: '공감 합계', pick: s => s.likes },
  { label: '댓글 합계', pick: s => s.comments },
  { label: '받은 금액', pick: s => s.revenue, unit: '원', money: true },
  { label: '협찬 건수', pick: s => s.sponsor_count, unit: '건', money: true },
  { label: 'AI 호출', pick: s => s.ai_calls, unit: '번', ai: true },
  { label: 'AI 토큰', pick: s => s.ai_tokens, ai: true },
];

/** 사람 칸에는 그 줄에서 가장 큰 값 대비 막대를 함께 그린다(누가 더 많은지 한눈에) */
function Cell({ now, before, unit = '', max, color }: { now: number; before: number; unit?: string; max?: number; color?: string }) {
  return <td><b>{formatNumber(now)}{unit}</b>{max !== undefined && <span className="cell-bar" aria-hidden="true"><span style={{ width: `${max ? (now / max) * 100 : 0}%`, background: color }} /></span>}<span className={`diff ${diffKind(now, before)}`}>{diffText(now, before)}</span></td>;
}
const PERSON_COLORS = ['var(--sig)', '#7C8CE0', '#3FAE8B'];

/** compare: 사람별 월별 비교(최근 12개월)는 통합 대시보드에서만 보여 준다(내 대시보드에서는 비교할 것이 아니고, 늦게 불러와 아래 칸을 밀어내지 않게) */
export function Monthly({ compare = false }: { compare?: boolean }) {
  const nameOf = useNameOf();
  const [month, setMonth] = useState(thisMonthKst);
  const [reports, setReports] = useState<MonthlyReport[] | null>(null);
  const [error, setError] = useState('');
  const [withRevenue, setWithRevenue] = useState(true);
  const [withAi, setWithAi] = useState(false);

  useEffect(() => {
    let alive = true;
    setReports(null); setError('');
    api<{ reports: MonthlyReport[] }>(`/api/report?month=${month}`).then(d => { if (alive) setReports(d.reports); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : '불러오지 못했어요.'); });
    return () => { alive = false; };
  }, [month]);

  const total = reports && sumSummaries(reports.map(r => r.summary));
  const totalPrev = reports && sumSummaries(reports.map(r => r.prev));
  const isThisMonth = month === thisMonthKst();

  return (
    <section id="monthly" className={`monthly stack${withRevenue ? '' : ' pdf-no-revenue'}${withAi ? '' : ' pdf-no-ai'}`} aria-labelledby="monthly-title">
      <div className="monthly-head">
        <h2 id="monthly-title" className="section-title" style={{ margin: 0 }}>월간 보고</h2>
        <div className="month-nav no-print">
          <button className="btn small" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="지난달">‹</button>
          <span className="month-label" aria-live="polite">{monthLabel(month)}</span>
          <button className="btn small" onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={isThisMonth} aria-label="다음 달">›</button>
        </div>
        <div className="pdf-row no-print">
          <label className="check"><input type="checkbox" checked={withRevenue} onChange={e => setWithRevenue(e.target.checked)} /> PDF에 수익</label>
          <label className="check"><input type="checkbox" checked={withAi} onChange={e => setWithAi(e.target.checked)} /> PDF에 AI 사용량</label>
          <button className="btn" onClick={() => window.print()} disabled={!reports}>PDF로 저장</button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!reports && !error && <p className="muted small" role="status">불러오는 중…</p>}
      {reports && total && totalPrev && (
        <>
          <div className="print-only report-print-head">
            <Signature kind="hub" word="hub" size={14} tomong={26} />
            <h1>{monthLabel(month)} 블로그 월간 보고({reports.map(r => nameOf(r.user)).join('·')})</h1>
            <p>{isThisMonth ? `${new Date().toLocaleDateString('ko-KR')} 기준(진행 중인 달)` : '한 달 전체'}</p>
          </div>

          <div className="kpis">
            {ROWS.slice(0, 3).map(r => (
              <div key={r.label} className="card kpi">
                <span className="label">두 사람 {r.label}</span>
                <span className="value">{formatNumber(r.pick(total))}{r.unit ?? ''}</span>
                <span className={`hint diff ${diffKind(r.pick(total), r.pick(totalPrev))}`}>{diffText(r.pick(total), r.pick(totalPrev))}</span>
              </div>
            ))}
            <div className="card kpi pdf-revenue">
              <span className="label">두 사람 받은 금액</span>
              <span className="value">{formatNumber(total.revenue)}원</span>
              <span className={`hint diff ${diffKind(total.revenue, totalPrev.revenue)}`}>{diffText(total.revenue, totalPrev.revenue)}</span>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">사람별 비교<span className="muted small"> · 지난달 대비</span></h3>
            <div className="table-wrap">
              <table className="compare">
                <thead><tr><th scope="col">항목</th>{reports.map(r => <th key={r.user} scope="col">{nameOf(r.user)}</th>)}<th scope="col">합계</th></tr></thead>
                <tbody>
                  {ROWS.map(row => (
                    <tr key={row.label} className={row.money ? 'pdf-revenue' : row.ai ? 'pdf-ai' : undefined}>
                      <th scope="row">{row.label}</th>
                      {reports.map((r, i) => <Cell key={r.user} now={row.pick(r.summary)} before={row.pick(r.prev)} unit={row.unit} max={Math.max(...reports.map(x => row.pick(x.summary)))} color={PERSON_COLORS[i % PERSON_COLORS.length]} />)}
                      <Cell now={row.pick(total)} before={row.pick(totalPrev)} unit={row.unit} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="person-grid">
            {reports.map(r => (
              <div key={r.user} className="card person">
                <h3 className="card-title">{nameOf(r.user)}<span className="muted small"> · {r.blogs.length ? `블로그 ${r.blogs.length}개` : '연결한 블로그 없음'}</span></h3>
                <ul className="summary-list">{r.comments.map(c => <li key={c} className={c.startsWith('받은 금액') ? 'pdf-revenue' : undefined}>{c}</li>)}</ul>
                {r.top.length > 0 && (
                  <ol className="top3" aria-label={`${nameOf(r.user)} 조회수 TOP 3`}>
                    {r.top.slice(0, 3).map(p => <li key={p.url}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a><span className="muted small">조회 {formatNumber(p.views ?? 0)}</span></li>)}
                  </ol>
                )}
              </div>
            ))}
          </div>
          <p className="muted small print-only" style={{ margin: 0 }}>조회·공감은 블로그 통계 캡처나 직접 적은 숫자 기준이에요. · hub로 만든 보고서</p>
        </>
      )}
      {compare && <HistoryCompare />}
    </section>
  );
}
