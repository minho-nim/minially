import { useEffect, useMemo, useState } from 'react';
import { api, formatNumber } from '../../shared/client/api';
import { Tomong } from './Tomong';
import { blogInfo } from './Blog';
import { bullets, defaultDm, defaultMail, EMPTY_PITCH, instagramDmHref, mailtoHref, priceLine, type Pitch, type ProposalForm, type ProposalStats } from './proposalKit';

// 협찬 제안(먼저 연락하기): ① 어디에 제안할지 ② 메시지(기본 글 → 고치기 → AI 다듬기 → 메일 앱·인스타) ③ 제안서 PDF.
// 내 소개(제안서 내용)는 한 번 써 두면 되니 접어 두고, 업체마다 바뀌는 것만 앞에 둔다.
type Field = { key: keyof ProposalForm; label: string; rows?: number; placeholder: string };
const FIELDS: Field[] = [
  { key: 'blog_name', label: '블로그 이름', placeholder: '예: 토몽이의 동네 기록' },
  { key: 'topic', label: '주제', placeholder: '예: 서울 카페·디저트, 주말 나들이' },
  { key: 'intro', label: '한 줄 소개', placeholder: '예: 직접 가 보고 솔직하게 쓰는 동네 카페 기록' },
  { key: 'about', label: '블로그 소개', rows: 3, placeholder: '어떤 글을 어떻게 쓰는지 2~3문장' },
  { key: 'audience', label: '주요 독자층', rows: 2, placeholder: '예: 서울에 사는 20~30대, 주말 데이트 장소를 찾는 분' },
  { key: 'strengths', label: '협찬하면 좋은 점', rows: 3, placeholder: '한 줄에 하나씩' },
  { key: 'offers', label: '가능한 협찬 방식', rows: 3, placeholder: '한 줄에 하나씩(예: 체험단 방문 후기, 제품 리뷰, 원고 의뢰)' },
  { key: 'cases', label: '진행 사례', rows: 2, placeholder: '한 줄에 하나씩(예: ○○카페 신메뉴 체험)' },
];
const TIPS = [
  '업체가 얻는 것(독자·숫자·대표 글)을 내 소개보다 먼저',
  "'협업 요청드립니다' 대신 왜 이 업체인지 한 줄",
  '방식·일정·비용을 빠짐없이(묻고 답하다 늦어지지 않게)',
  '답장하는 방법을 분명히, 같은 글을 여러 곳에 복사해 보내지 않기',
];

export function ProposalView({ name, onBack }: { name: string; onBack: () => void }) {
  const [base, setBase] = useState<ProposalForm | null>(null);
  // 이번 제안용(업체 맞춤): 기본 양식을 복사해 고치고, 저장하지 않는다
  const [custom, setCustom] = useState<ProposalForm | null>(null);
  const form = custom ?? base;
  const setForm = (next: ProposalForm | ((f: ProposalForm | null) => ProposalForm | null)) => (custom ? setCustom : setBase)(next as never);
  const [stats, setStats] = useState<ProposalStats | null>(null);
  const [dirty, setDirty] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState<'save' | 'draft' | 'mail' | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [pitch, setPitch] = useState<Pitch>(EMPTY_PITCH);
  const [mail, setMail] = useState({ to: '', ig: '', subject: '', body: '' });
  const [channel, setChannel] = useState<'mail' | 'dm'>('mail');
  const [mailTouched, setMailTouched] = useState(false);
  const [preview, setPreview] = useState<'message' | 'doc'>('message');
  const fail = (e: unknown, text: string) => setMessage({ kind: 'error', text: e instanceof Error ? e.message : text });

  useEffect(() => {
    api<{ form: ProposalForm; stats: ProposalStats }>('/api/proposal').then(d => {
      setBase(d.form); setStats(d.stats);
      if (!d.form.blog_name.trim()) setProfileOpen(true); // 처음이면 내 소개부터 펼쳐 둔다
    }).catch(e => fail(e, '불러오지 못했어요.'));
  }, []);

  const set = (patch: Partial<ProposalForm>) => { setForm(f => f && { ...f, ...patch }); if (!custom) setDirty(true); };
  const setP = (patch: Partial<Pitch>) => setPitch(p => ({ ...p, ...patch }));

  async function save() {
    if (!base) return;
    setBusy('save'); setMessage(null);
    try { const r = await api<{ form: ProposalForm }>('/api/proposal', { method: 'PUT', body: base }); setBase(r.form); setDirty(false); setMessage({ kind: 'info', text: '내 소개를 저장했어요.' }); }
    catch (e) { fail(e, '저장하지 못했어요.'); }
    finally { setBusy(null); }
  }

  async function aiDraft() {
    if (!form) return;
    if (dirty && !custom) await save();
    setBusy('draft'); setMessage(null);
    try {
      const { draft } = await api<{ draft: Partial<ProposalForm> }>('/api/proposal/draft', { body: {} });
      setForm(f => f && { ...f, ...draft }); setDirty(true);
      setMessage({ kind: 'info', text: 'AI 초안을 넣었어요. 사실과 다른 곳은 고친 뒤 "저장"을 눌러 주세요.' });
    } catch (e) { fail(e, 'AI 초안을 만들지 못했어요.'); }
    finally { setBusy(null); }
  }

  // 업체 정보를 바꾸면, 아직 손대지 않은 메시지는 기본 글을 다시 채운다
  const draftText = useMemo(() => {
    if (!form || !stats) return null;
    const p = { brand: pitch.brand.trim(), product: pitch.product.trim(), reason: pitch.reason.trim(), schedule: pitch.schedule.trim() };
    return channel === 'dm' ? { subject: '', body: defaultDm(form, stats, name, p) } : defaultMail(form, stats, name, p);
  }, [form, stats, name, pitch, channel]);
  useEffect(() => { if (draftText && !mailTouched) setMail(m => ({ ...m, subject: draftText.subject, body: draftText.body })); }, [draftText, mailTouched]);
  function switchChannel(next: 'mail' | 'dm') { if (next === channel) return; setChannel(next); setMailTouched(false); }

  async function polish() {
    setBusy('mail'); setMessage(null);
    try {
      const r = await api<{ subject: string; body: string }>('/api/proposal/mail', { body: { brand: pitch.brand, product: pitch.product, subject: mail.subject, body: mail.body, kind: channel } });
      setMail(m => ({ ...m, ...r })); setMailTouched(true);
      setMessage({ kind: 'info', text: `AI가 ${channel === 'dm' ? 'DM' : '메일'}을 다듬었어요. 확인하고 고친 뒤 보내세요.` });
    } catch (e) { fail(e, '메일을 다듬지 못했어요.'); }
    finally { setBusy(null); }
  }

  async function copyMail() {
    try { await navigator.clipboard.writeText(channel === 'dm' ? mail.body : `${mail.subject}\n\n${mail.body}`); setMessage({ kind: 'info', text: channel === 'dm' ? 'DM을 복사했어요. 인스타 대화창에 붙여 넣으세요.' : '제목과 본문을 복사했어요.' }); }
    catch { setMessage({ kind: 'error', text: '복사하지 못했어요. 본문을 직접 선택해 복사해 주세요.' }); }
  }

  const validTo = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(mail.to.trim());
  const igHref = instagramDmHref(mail.ig);
  const price = form ? priceLine(form) : '';
  // 보내기 전 확인: 답이 잘 오는 글의 조건
  const checks = form ? [
    { ok: !!pitch.brand.trim(), label: '업체 이름' },
    { ok: !!pitch.reason.trim(), label: '왜 이 업체인지' },
    { ok: !!(stats?.avg_views || stats?.posts_per_month), label: '숫자(조회수·글 수)' },
    { ok: bullets(form.offers).length > 0 || !!pitch.schedule.trim(), label: '방식·일정' },
    { ok: !!form.contact_email.trim(), label: '답장 받을 곳' },
  ] : [];
  const done = checks.filter(c => c.ok).length;

  return (
    <article className="stack proposal" aria-labelledby="prop-title">
      <div className="editor-head no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" style={{ display: 'inline-flex' }} onClick={onBack}>← 협찬</button>
          <h1 id="prop-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>협찬 제안하기</h1>
        </div>
      </div>
      {message && <p className={`no-print ${message.kind === 'error' ? 'error' : 'muted small'}`} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
      {!form && !message && <p className="muted small" role="status">불러오는 중…</p>}

      {form && stats && (
        <div className="pitch-layout">
          <div className="stack no-print" style={{ minWidth: 0 }}>
            <section className="card step" aria-labelledby="p-who">
              <h2 id="p-who" className="step-title"><span className="n">1</span>어디에 제안할까요?</h2>
              <div className="form-grid">
                <div className="field"><label htmlFor="m-brand">업체 이름</label><input id="m-brand" className="input" value={pitch.brand} maxLength={60} placeholder="예: ○○카페" onChange={e => setP({ brand: e.target.value })} /></div>
                <div className="field"><label htmlFor="m-product">제안할 제품·서비스(선택)</label><input id="m-product" className="input" value={pitch.product} maxLength={100} placeholder="예: 겨울 신메뉴" onChange={e => setP({ product: e.target.value })} /></div>
              </div>
              <div className="field">
                <label htmlFor="m-reason">왜 이 업체인가요? <span className="muted small">답장을 가르는 한 줄</span></label>
                <input id="m-reason" className="input" value={pitch.reason} maxLength={150} placeholder="예: 3년째 다니는 단골이라 메뉴와 분위기를 잘 알아요" onChange={e => setP({ reason: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="m-schedule">가능한 일정(선택)</label>
                <input id="m-schedule" className="input" value={pitch.schedule} maxLength={80} placeholder="예: 12월 둘째 주 방문, 2주 안에 게시" onChange={e => setP({ schedule: e.target.value })} />
              </div>
            </section>

            <section className="card step" aria-labelledby="p-mail">
              <div className="row-between">
                <h2 id="p-mail" className="step-title"><span className="n">2</span>메시지</h2>
                <div className="style-tabs" role="tablist" aria-label="보낼 곳">
                  <button role="tab" aria-selected={channel === 'mail'} onClick={() => switchChannel('mail')}>메일</button>
                  <button role="tab" aria-selected={channel === 'dm'} onClick={() => switchChannel('dm')}>인스타 DM</button>
                </div>
              </div>
              <div className="pitch-meter" role="group" aria-label={`보내기 전 확인 ${done}/${checks.length}`}>
                <div className="pitch-meter-bar" aria-hidden="true"><span style={{ width: `${(done / Math.max(1, checks.length)) * 100}%` }} /></div>
                <ul className="chips">{checks.map(c => <li key={c.label} className={`chip${c.ok ? ' ok' : ' warn'}`}>{c.ok ? '✓' : '·'} {c.label}</li>)}</ul>
              </div>
              {channel === 'mail'
                ? <div className="field"><label htmlFor="m-to">업체 이메일</label><input id="m-to" className="input" type="email" value={mail.to} placeholder="partner@example.com" onChange={e => setMail(m => ({ ...m, to: e.target.value }))} /></div>
                : <div className="field"><label htmlFor="m-ig">업체 인스타 아이디</label><input id="m-ig" className="input" value={mail.ig} placeholder="@cafe_example 또는 인스타 주소" autoCapitalize="none" spellCheck={false} onChange={e => setMail(m => ({ ...m, ig: e.target.value }))} /></div>}
              {channel === 'mail' && <div className="field"><label htmlFor="m-subject">제목</label><input id="m-subject" className="input" value={mail.subject} onChange={e => { setMail(m => ({ ...m, subject: e.target.value })); setMailTouched(true); }} /></div>}
              <div className="field"><label htmlFor="m-body">{channel === 'dm' ? 'DM 내용' : '본문'}<span className="muted small"> · {mail.body.length}자</span></label><textarea id="m-body" className="textarea" rows={channel === 'dm' ? 8 : 14} value={mail.body} onChange={e => { setMail(m => ({ ...m, body: e.target.value })); setMailTouched(true); }} /></div>
              <div className="ai-row">
                <button className="btn" onClick={() => { void polish(); }} disabled={busy !== null || !pitch.brand.trim() || !mail.body.trim()}>{busy === 'mail' ? '다듬는 중…' : 'AI로 다듬기'}</button>
                {mailTouched && <button className="btn ghost small" onClick={() => setMailTouched(false)}>기본 글로 되돌리기</button>}
                <button className={channel === 'dm' ? 'btn primary' : 'btn'} onClick={() => { void copyMail(); }} disabled={!mail.body.trim()}>{channel === 'dm' ? 'DM 복사' : '복사'}</button>
                {channel === 'mail' && (validTo
                  ? <a className="btn primary" href={mailtoHref(mail.to, mail.subject, mail.body)}>메일 앱 열기</a>
                  : <button className="btn primary" disabled>메일 앱 열기</button>)}
                {channel === 'dm' && (igHref
                  ? <a className="btn" href={igHref} target="_blank" rel="noopener noreferrer">인스타 DM 열기 ↗</a>
                  : <button className="btn" disabled>인스타 DM 열기 ↗</button>)}
              </div>
              <details className="pitch-tips">
                <summary className="muted small">ⓘ 답장이 잘 오는 제안 글</summary>
                <ul className="small">{TIPS.map(t => <li key={t}>{t}</li>)}</ul>
                <p className="muted small" style={{ margin: 0 }}>{channel === 'mail' ? '메일 앱에서 제안서 PDF를 직접 첨부해 주세요(브라우저는 파일을 자동으로 붙일 수 없어요).' : '인스타는 앱이 대신 보낼 수 없어요. 복사 → DM 열기 → 붙여 넣기. 제안서는 답장이 오면 메일로 보내세요.'}</p>
              </details>
            </section>

            <section className="card step" aria-labelledby="p-form">
              <button type="button" className="profile-toggle" aria-expanded={profileOpen} aria-controls="p-form-body" onClick={() => setProfileOpen(v => !v)}>
                <h2 id="p-form" className="step-title" style={{ margin: 0 }}><span className="n">3</span>{custom ? '이번 제안용 소개' : '내 소개(제안서에 들어가요)'}{dirty && !custom && <span className="step-sub">저장 안 됨</span>}</h2>
                <span className="muted small">{profileOpen ? '접기 ▲' : form.blog_name ? `${form.blog_name} · 고치기 ▼` : '처음 한 번만 ▼'}</span>
              </button>
              {profileOpen && (
                <div id="p-form-body" className="stack" style={{ gap: 10 }}>
                  {custom ? (
                    <div className="custom-banner" role="status">
                      <span>이 업체에 맞춰 고치는 중이에요. <b>기본 소개는 그대로</b> 남아요.</span>
                      <button className="btn small" onClick={() => setCustom(null)}>기본 양식으로 돌아가기</button>
                    </div>
                  ) : null}
                  <div className="ai-row">
                    <button className="btn primary small" onClick={() => { void aiDraft(); }} disabled={busy !== null}>{busy === 'draft' ? '쓰는 중…' : 'AI로 초안 쓰기'}</button>
                    {!custom && <button className="btn small" onClick={() => { void save(); }} disabled={busy !== null || !dirty}>{busy === 'save' ? '저장 중…' : '저장'}</button>}
                    {!custom && <button className="btn ghost small" onClick={() => base && setCustom({ ...base })} disabled={busy !== null}>이번 제안용으로 고치기</button>}
                    {busy === 'draft' && <span className="ai-busy" role="status"><Tomong kind="minilog" size={28} bounce /><span className="hand">토몽이가 쓰고 있어요</span></span>}
                  </div>
                  <div className="prop-fields">
                    {FIELDS.map(f => (
                      <div className="field" key={f.key}>
                        <label htmlFor={`p-${f.key}`}>{f.label}</label>
                        {f.rows
                          ? <textarea id={`p-${f.key}`} className="textarea" rows={f.rows} value={form[f.key] as string} placeholder={f.placeholder} onChange={e => set({ [f.key]: e.target.value })} />
                          : <input id={`p-${f.key}`} className="input" value={form[f.key] as string} placeholder={f.placeholder} onChange={e => set({ [f.key]: e.target.value })} />}
                      </div>
                    ))}
                    <div className="field">
                      <label className="check"><input type="checkbox" checked={form.show_price} onChange={e => set({ show_price: e.target.checked })} /> 단가 넣기(제안서·메일)</label>
                      <input id="p-price" aria-label="단가" className="input" value={form.price} disabled={!form.show_price} placeholder="예: 원고료 10만 원부터, 체험단은 제품 제공만" onChange={e => set({ price: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor="p-contact_email">연락받을 이메일</label>
                      <input id="p-contact_email" className="input" type="email" autoComplete="email" value={form.contact_email} placeholder="name@example.com" onChange={e => set({ contact_email: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor="p-contact_extra">다른 연락처(선택)</label>
                      <input id="p-contact_extra" className="input" value={form.contact_extra} placeholder="예: 인스타그램 @tomong" onChange={e => set({ contact_extra: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="pitch-preview stack" aria-labelledby="p-preview">
            <div className="row-between no-print">
              <h2 id="p-preview" className="step-title" style={{ margin: 0 }}>미리보기</h2>
              <div className="style-tabs" role="tablist" aria-label="미리보기">
                <button role="tab" aria-selected={preview === 'message'} onClick={() => setPreview('message')}>{channel === 'dm' ? 'DM' : '메일'}</button>
                <button role="tab" aria-selected={preview === 'doc'} onClick={() => setPreview('doc')}>제안서 PDF</button>
              </div>
            </div>
            {preview === 'message' && (
              <div className={`card mail-preview no-print${channel === 'dm' ? ' dm' : ''}`} aria-label="받는 사람이 보는 모습">
                {channel === 'mail' && <p className="mp-meta"><b>받는 사람</b> {mail.to || '업체 이메일'}<br /><b>제목</b> {mail.subject}</p>}
                <p className="mp-body">{mail.body}</p>
              </div>
            )}
            <div className={preview === 'doc' ? 'stack' : 'print-only'} style={{ gap: 8 }}>
              <div className="row-between no-print">
                <p className="muted small" style={{ margin: 0 }}>인쇄 창에서 <b>"PDF로 저장"</b>을 고르세요(A4 한 장).</p>
                <button className="btn primary small" onClick={() => window.print()}>PDF 만들기</button>
              </div>
              <div className="card proposal-doc">
                <header className="pd-head">
                  <p className="pd-kicker">협찬 제안서{form.topic ? ` · ${form.topic}` : ''}</p>
                  <h3 className="pd-name">{form.blog_name || '블로그 이름'}</h3>
                  {form.intro && <p className="pd-intro">{form.intro}</p>}
                  <p className="pd-links">{stats.blogs.map(b => blogInfo(b).home.replace('https://', '')).join(' · ')}</p>
                </header>
                <div className="pd-nums">
                  <div><b>{stats.avg_views === null ? '—' : formatNumber(stats.avg_views)}</b><span>글 평균 조회수</span></div>
                  <div><b>{stats.posts_per_month}</b><span>한 달 평균 글</span></div>
                  <div><b>{formatNumber(stats.sponsor_done)}</b><span>진행한 협찬</span></div>
                </div>
                {form.about && <div className="pd-sec"><h4>블로그 소개</h4><p>{form.about}</p></div>}
                {form.audience && <div className="pd-sec"><h4>주요 독자층</h4><p>{form.audience}</p></div>}
                {form.strengths && <div className="pd-sec"><h4>협찬하면 좋은 점</h4><ul>{bullets(form.strengths).map(l => <li key={l}>{l}</li>)}</ul></div>}
                {stats.top.length > 0 && <div className="pd-sec"><h4>대표 글</h4><ol>{stats.top.map(t => <li key={t.url}>{t.title} <span className="muted">· 조회 {formatNumber(t.views)}</span></li>)}</ol></div>}
                {form.offers && <div className="pd-sec"><h4>협찬 방식</h4><ul>{bullets(form.offers).map(l => <li key={l}>{l}</li>)}</ul></div>}
                {form.cases && <div className="pd-sec"><h4>진행 사례</h4><ul>{bullets(form.cases).map(l => <li key={l}>{l}</li>)}</ul></div>}
                {price && <div className="pd-sec"><h4>진행 비용</h4><p>{price}</p></div>}
                <footer className="pd-foot">{name}{form.contact_email ? ` · ${form.contact_email}` : ''}{form.contact_extra ? ` · ${form.contact_extra}` : ''}</footer>
                <p className="pd-note">조회수는 블로그 통계 기록(글 {stats.with_stats}개) 기준이에요.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
