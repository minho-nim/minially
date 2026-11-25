import { useEffect, useState } from 'react';
import { api, formatNumber } from '../../shared/client/api';
import { diffKind, diffText, KIND_LABEL, monthLabel, shiftMonth, shortMonth, thisMonthKst, type History, type MonthlyReport, type MonthSummary } from '../../shared/client/report';
import { Columns } from './Charts';
import { Signature, Tomong } from './Tomong';
import { blogInfo } from './Blog';
import { won } from './Campaigns';

// 월간 보고: 이번 달 글·조회·공감·수익·AI 사용량과 지난달 비교. 'PDF로 저장'은 A4 보고서 서식으로 인쇄(브라우저의 PDF 저장).
const num = (n: number | null) => (n === null ? '—' : formatNumber(n));

function Kpi({ label, now, before, unit = '', hint }: { label: string; now: number; before: number; unit?: string; hint?: string }) {
  return (
    <div className="card kpi">
      <span className="label">{label}</span>
      <span className="value">{formatNumber(now)}{unit}</span>
      <span className={`hint diff ${diffKind(now, before)}`}>{diffText(now, before)}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function ReportView({ user, onBack }: { user: string; onBack: () => void }) {
  const [month, setMonth] = useState(thisMonthKst);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState('');
  const [withRevenue, setWithRevenue] = useState(false);
  const [withAi, setWithAi] = useState(false);

  useEffect(() => {
    let alive = true;
    setReport(null); setError('');
    api<{ report: MonthlyReport }>(`/api/report?month=${month}`).then(d => { if (alive) setReport(d.report); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : '불러오지 못했어요.'); });
    return () => { alive = false; };
  }, [month]);

  const s: MonthSummary | undefined = report?.summary;
  const p: MonthSummary | undefined = report?.prev;
  const isThisMonth = month === thisMonthKst();

  return (
    <article className={`stack report${withRevenue ? '' : ' pdf-no-revenue'}${withAi ? '' : ' pdf-no-ai'}`} aria-labelledby="report-title">
      <div className="editor-head no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="report-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>월간 보고</h1>
        </div>
        <div className="month-nav">
          <button className="btn small" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="지난달">‹</button>
          <span className="cal-month" aria-live="polite">{monthLabel(month)}</span>
          <button className="btn small" onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={isThisMonth} aria-label="다음 달">›</button>
        </div>
      </div>

      <section className="card step no-print" aria-label="PDF로 저장">
        <div className="publish-row" style={{ alignItems: 'center' }}>
          <span className="small" style={{ flex: '1 1 220px' }}>광고 제안·보고용 A4 서식으로 저장해요. 인쇄 창에서 <b>"PDF로 저장"</b>을 고르세요.</span>
          <button className="btn primary" onClick={() => window.print()} disabled={!report}>PDF로 저장</button>
        </div>
        <div className="pdf-options">
          <label className="check"><input type="checkbox" checked={withRevenue} onChange={e => setWithRevenue(e.target.checked)} /> PDF에 수익 넣기</label>
          <label className="check"><input type="checkbox" checked={withAi} onChange={e => setWithAi(e.target.checked)} /> PDF에 AI 사용량 넣기</label>
        </div>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {!report && !error && <p className="muted small" role="status">불러오는 중…</p>}
      {report && s && p && (
        <>
          <header className="card report-head">
            <div className="report-brand"><Signature kind="minilog" word="log" size={15} tomong={28} /><span className="muted small">월간 블로그 보고</span></div>
            <h2 className="report-title">{monthLabel(month)} 블로그 보고</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {report.blogs.length ? report.blogs.map(b => { const i = blogInfo(b); return `${i.platform} ${i.name}`; }).join(' · ') : user}
              {' · '}{isThisMonth ? `${new Date().toLocaleDateString('ko-KR')} 기준(진행 중인 달)` : '한 달 전체'}
            </p>
          </header>

          {report.comments.length > 0 && (
            <section className="card step report-summary" aria-labelledby="r-sum">
              <h3 id="r-sum" className="step-title">이달의 요약</h3>
              <ul>{report.comments.map(c => <li key={c} className={c.startsWith('받은 금액') ? 'pdf-revenue' : undefined}>{c}</li>)}</ul>
            </section>
          )}

          <div className="kpis report-kpis">
            <Kpi label="게시한 글" now={s.posts} before={p.posts} unit="개" hint={s.minilog_published ? `미니로그로 쓴 글 ${s.minilog_published}개` : undefined} />
            <Kpi label="조회수 합계" now={s.views} before={p.views} hint={`숫자 있는 글 ${s.with_stats}/${s.posts}개`} />
            <Kpi label="공감 합계" now={s.likes} before={p.likes} hint={`댓글 ${formatNumber(s.comments)}`} />
            <div className="pdf-revenue"><Kpi label="받은 금액" now={s.revenue} before={p.revenue} unit="원" hint={`협찬 ${s.sponsor_count}건`} /></div>
          </div>

          <section className="card step" aria-labelledby="r-top">
            <h3 id="r-top" className="step-title">조회수 TOP 5<span className="step-sub">이번 달 올린 글</span></h3>
            {report.top.length === 0 ? <p className="muted small" style={{ margin: 0 }}>조회수를 적은 글이 없어요. 블로그 탭에서 통계 캡처를 올리면 채워져요.</p> : (
              <ol className="top-posts">
                {report.top.map((post, i) => <li key={post.url}><span className="rank">{i + 1}</span><a href={post.url} target="_blank" rel="noopener noreferrer">{post.title}</a><span className="muted small">조회 {num(post.views)} · 공감 {num(post.likes)}</span></li>)}
              </ol>
            )}
          </section>

          <section className="card step" aria-labelledby="r-posts">
            <h3 id="r-posts" className="step-title">이번 달 올린 글<span className="step-sub">{report.posts.length}개</span></h3>
            {report.posts.length === 0 ? <p className="muted small" style={{ margin: 0 }}>이 달에 올린 글이 없어요(블로그 탭에서 글을 가져와야 보여요).</p> : (
              <div className="table-wrap">
                <table className="mini-table report-table">
                  <thead><tr><th>날짜</th><th>제목</th><th>조회</th><th>공감</th><th>댓글</th></tr></thead>
                  <tbody>{report.posts.map(post => <tr key={post.url}><td>{post.published_on?.slice(5).replace('-', '/') ?? ''}</td><td className="t"><a href={post.url} target="_blank" rel="noopener noreferrer">{post.title}</a></td><td>{num(post.views)}</td><td>{num(post.likes)}</td><td>{num(post.comments)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {report.tags.length > 0 && <p className="muted small" style={{ margin: 0 }}>자주 쓴 태그: {report.tags.map(t => `#${t.tag}(${t.count})`).join(' ')}</p>}
          </section>

          <section className="card step pdf-revenue" aria-labelledby="r-rev">
            <h3 id="r-rev" className="step-title">협찬·광고 수익<span className="step-sub">받은 날 기준</span></h3>
            <p style={{ margin: 0 }} className="small">협찬 {won(s.sponsor_revenue)} · 광고 {won(s.ad_revenue)} · 기타 {won(s.other_revenue)} · <b>합계 {won(s.revenue)}</b></p>
            {report.revenue_items.length > 0 && (
              <ul className="expiring">{report.revenue_items.map((r, i) => <li key={i}><span>{r.paid_on.slice(5).replace('-', '/')} {KIND_LABEL[r.kind] ?? r.kind} · {r.brand}{r.title ? ` ${r.title}` : ''}</span><b>{won(r.amount)}</b></li>)}</ul>
            )}
          </section>

          <section className="card step pdf-ai" aria-labelledby="r-ai">
            <h3 id="r-ai" className="step-title">AI 사용량<span className="step-sub">hub 전체 앱</span></h3>
            <p style={{ margin: 0 }} className="small">호출 {formatNumber(s.ai_calls)}번({diffText(s.ai_calls, p.ai_calls)}) · 토큰 {formatNumber(s.ai_tokens)} · 오류 {formatNumber(s.ai_errors)}</p>
          </section>

          <p className="report-foot muted small">조회·공감은 블로그 통계 캡처나 직접 적은 숫자 기준이라 실제와 조금 다를 수 있어요. · 미니로그로 만든 보고서</p>
          {report.posts.length === 0 && s.revenue === 0 && <div className="profile no-print"><Tomong kind="minilog" size={44} /><p className="muted small" style={{ margin: 0 }}>이 달 기록이 아직 없어요. 지난달(‹)도 볼 수 있어요.</p></div>}
        </>
      )}
      <HistorySection current={month} onPick={m => { setMonth(m); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
    </article>
  );
}

/** 누적 합계와 최근 12개월 내역(내 숫자). 미니허브는 같은 계산으로 사람별로 견준다. PDF에는 넣지 않는다. */
function HistorySection({ current, onPick }: { current: string; onPick: (month: string) => void }) {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api<{ history: History }>('/api/history').then(d => { if (alive) setHistory(d.history); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : '불러오지 못했어요.'); });
    return () => { alive = false; };
  }, []);
  const t = history?.total;
  const rows = history ? [...history.months].reverse() : [];
  return (
    <section className="card step no-print history" aria-labelledby="h-title">
      <h2 id="h-title" className="step-title">누적 합계·월별 내역<span className="step-sub">{t?.first_month ? `${monthLabel(t.first_month)} 글부터` : '내 숫자'}</span></h2>
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      {!history && !error && <p className="muted small" role="status" style={{ margin: 0 }}>불러오는 중…</p>}
      {history && t && (
        <>
          <div className="kpis" aria-label="누적 합계">
            <div className="card kpi"><span className="label">지금까지 올린 글</span><span className="value">{formatNumber(t.posts)}개</span><span className="hint">미니로그로 쓴 글 {formatNumber(t.minilog_published)}개</span></div>
            <div className="card kpi"><span className="label">지금까지 조회수</span><span className="value">{formatNumber(t.views)}</span><span className="hint">공감 {formatNumber(t.likes)} · 댓글 {formatNumber(t.comments)}</span></div>
            <div className="card kpi"><span className="label">지금까지 받은 돈</span><span className="value">{won(t.revenue)}</span><span className="hint">협찬 {formatNumber(t.sponsor_count)}건</span></div>
            <div className="card kpi"><span className="label">지금까지 AI 사용</span><span className="value">{formatNumber(t.ai_calls)}번</span><span className="hint">토큰 {formatNumber(t.ai_tokens)}</span></div>
          </div>
          <Columns label="최근 12개월 올린 글" items={history.months.map(m => ({ label: shortMonth(m.month), value: m.posts }))} />
          <div className="table-wrap">
            <table className="mini-table history-table">
              <caption className="sr-only">최근 12개월 월별 내역(최근 달부터)</caption>
              <thead><tr><th scope="col">달</th><th scope="col">글</th><th scope="col">조회</th><th scope="col">공감</th><th scope="col">댓글</th><th scope="col">받은 금액</th><th scope="col">협찬</th><th scope="col">AI</th></tr></thead>
              <tbody>
                {rows.map(m => (
                  <tr key={m.month} aria-current={m.month === current ? 'true' : undefined}>
                    <th scope="row"><button type="button" className="link-btn" onClick={() => onPick(m.month)} aria-label={`${monthLabel(m.month)} 보고 보기`}>{m.month.slice(2).replace('-', '.')}</button></th>
                    <td>{formatNumber(m.posts)}</td><td>{formatNumber(m.views)}</td><td>{formatNumber(m.likes)}</td><td>{formatNumber(m.comments)}</td><td>{formatNumber(m.revenue)}</td><td>{formatNumber(m.sponsor_count)}</td><td>{formatNumber(m.ai_calls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ margin: 0 }}>달을 누르면 그달 보고를 봐요. 받은 금액은 원, 조회·공감은 적어 둔 숫자 기준이에요.</p>
        </>
      )}
    </section>
  );
}
