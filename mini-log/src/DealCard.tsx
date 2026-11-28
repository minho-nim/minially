import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import { STATUS_LABEL, todayKst, won, type Campaign, type Status } from './Campaigns';

// 메일 화면의 협찬 연결: 위에는 단계별 요약 띠, 메일을 열면 오른쪽에 그 메일과 이어진 협찬 카드(단계·금액·마감·지난 협찬·대화·가이드).
// 단계 옮기기는 사람이 누를 때만. 수락하면 '진행 중'이 되고 서버가 빈 원고를 준비한다.
const OPEN_ASK: Status[] = ['interested', 'applied', 'proposed'];
const STEPS: [string, Status[]][] = [['제안', OPEN_ASK], ['진행', ['in_progress']], ['게시', ['posted']], ['정산', ['paid']]];

export function DealStrip({ campaigns, onCampaigns }: { campaigns: Campaign[]; onCampaigns: () => void }) {
  const sp = campaigns.filter(c => c.kind === 'sponsor');
  const month = todayKst().slice(0, 7);
  const cells: [string, string][] = [
    ['연락·제안', `${sp.filter(c => OPEN_ASK.includes(c.status)).length}건`],
    ['진행', `${sp.filter(c => c.status === 'in_progress').length}건`],
    ['게시', `${sp.filter(c => c.status === 'posted').length}건`],
    ['정산 대기', won(sp.filter(c => c.status === 'in_progress' || c.status === 'posted').reduce((n, c) => n + c.amount, 0))],
    [`${Number(month.slice(5))}월 받음`, won(sp.filter(c => c.status === 'paid' && c.paid_on?.startsWith(month)).reduce((n, c) => n + c.amount, 0))],
  ];
  return (
    <div className="deal-strip" role="group" aria-label="협찬 단계 요약">
      {cells.map(([k, v]) => <button key={k} type="button" onClick={onCampaigns}><span className="muted small">{k}</span><b>{v}</b></button>)}
    </div>
  );
}

interface Past { id: string; title: string; amount: number; status: string; on: string | null }
interface MailLite { id: string; subject: string; kind: string; status: string; received_at: number; campaign_id: string | null }

export function DealCard({ campaign, mails, onCampaigns, onChanged }: { campaign: Campaign; mails: MailLite[]; onCampaigns: () => void; onChanged: (c: Campaign, note: string) => void }) {
  const [tab, setTab] = useState<'talk' | 'guide' | 'money'>('talk');
  const [past, setPast] = useState<Past[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api<{ past: Past[] }>(`/api/campaigns/history?brand=${encodeURIComponent(campaign.brand)}&except=${campaign.id}`).then(d => { if (alive) setPast(d.past); }).catch(() => {});
    return () => { alive = false; };
  }, [campaign.id, campaign.brand]);
  const stepIdx = STEPS.findIndex(([, st]) => st.includes(campaign.status));
  const talk = mails.filter(m => m.campaign_id === campaign.id).sort((a, b) => b.received_at - a.received_at);
  async function move(status: Status) {
    setBusy(true);
    try {
      const r = await api<{ campaign: Campaign; prepared_draft?: { planned_on: string | null } | null }>(`/api/campaigns/${campaign.id}`, { method: 'PUT', body: { status } });
      onChanged(r.campaign, `${campaign.brand}: ${STATUS_LABEL[status]}(으)로 옮겼어요.${r.prepared_draft ? ' 가이드를 넣은 빈 원고를 준비했어요.' : ''}`);
    } catch (e) { onChanged(campaign, e instanceof Error ? e.message : '옮기지 못했어요.'); }
    finally { setBusy(false); }
  }
  return (
    <aside className="deal-card card" aria-label={`${campaign.brand} 협찬`}>
      <div className="row-between"><b className="deal-brand">{campaign.brand}</b><button type="button" className="link-btn small" onClick={onCampaigns}>협찬 →</button></div>
      <ol className="deal-steps" aria-label="협찬 단계">
        {STEPS.map(([label], i) => <li key={label} className={i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''} aria-current={i === stepIdx ? 'step' : undefined}>{label}</li>)}
      </ol>
      <p className="small" style={{ margin: 0 }}>{campaign.amount ? won(campaign.amount) : '원고료 —'}{campaign.deadline ? ` · 마감 ${campaign.deadline.slice(5).replace('-', '/')}` : ''}{past.length ? ` · 지난 협찬 ${past.length}건(${past[0].amount ? won(past[0].amount) : '원고료 없음'})` : ''}</p>
      <div className="tabs-row" role="tablist" aria-label="협찬 보기">
        {([['talk', `대화 ${talk.length}`], ['guide', '가이드'], ['money', '정산']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`chip-btn${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'talk' && (talk.length ? <ul className="deal-list">{talk.slice(0, 6).map(m => <li key={m.id}><span className="muted small">{m.kind === 'outgoing' ? '보냄' : m.status === 'sent' ? '답장함' : '받음'}</span>{m.subject || '(제목 없음)'}</li>)}</ul> : <p className="muted small" style={{ margin: 0 }}>이어진 메일이 없어요.</p>)}
      {tab === 'guide' && (campaign.guide ? <p className="small" style={{ margin: 0 }}>{[...campaign.guide.keywords.map(k => `🔑 ${k}`), ...campaign.guide.hashtags.map(h => `#${h}`), campaign.guide.min_photos ? `사진 ${campaign.guide.min_photos}장+` : '', campaign.guide.visit_on ? `방문 ${campaign.guide.visit_on.slice(5)}` : ''].filter(Boolean).join(' · ') || '가이드 칸이 비어 있어요.'}</p> : <p className="muted small" style={{ margin: 0 }}>가이드가 없어요. 협찬 화면에서 '가이드로 채우기'를 써 보세요.</p>)}
      {tab === 'money' && <p className="small" style={{ margin: 0 }}>{campaign.status === 'paid' ? `${campaign.paid_on ?? ''} 받음 · ${won(campaign.amount)}` : campaign.status === 'posted' ? `게시 완료 · 정산 기다림 ${won(campaign.amount)}` : `아직 정산 전 · ${won(campaign.amount)}`}</p>}
      <div className="deal-actions">
        {OPEN_ASK.includes(campaign.status) && <button type="button" className="btn primary" disabled={busy} onClick={() => { void move('in_progress'); }}>수락 → 진행 중(원고 준비)</button>}
        {OPEN_ASK.includes(campaign.status) && <button type="button" className="btn ghost" disabled={busy} onClick={() => { void move('cancelled'); }}>거절로 표시</button>}
        {campaign.status === 'in_progress' && <button type="button" className="btn" disabled={busy} onClick={() => { void move('posted'); }}>게시 완료로</button>}
        {campaign.status === 'posted' && <button type="button" className="btn" disabled={busy} onClick={() => { void move('paid'); }}>정산 받음으로</button>}
      </div>
    </aside>
  );
}
