import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../shared/client/api';

// 내 계정: 연결한 블로그, 공개 SNS 아이디(직접 적음), 제안서 연락 이메일, 바깥 서비스 연결 상태. 비밀번호는 받지 않는다.
export interface AccountSummary {
  user: string;
  blogs: { blog_id: string; platform: string; name: string; url: string; post_count: number; synced_at: number | null }[];
  handles: { platform: string; label: string; handle: string; url: string }[];
  contact_email: string;
}
export const HANDLE_FIELDS = [
  { platform: 'instagram', label: '인스타그램' }, { platform: 'threads', label: '스레드' }, { platform: 'x', label: 'X' }, { platform: 'youtube', label: '유튜브' },
] as const;
// 바깥 서비스와 '로그인 연결'이 되는지(2026-11 확인 기준). 연결하려면 소유자가 키를 준비해야 하는 것은 그렇게 적는다.
export const CONNECTIONS = [
  { name: '네이버 블로그', state: '공개 RSS로 글 목록만', note: '네이버가 글쓰기 API를 닫아 로그인 연결·자동 게시는 하지 않아요' },
  { name: '인스타그램·스레드', state: '연결 안 함', note: 'Meta 개발자 앱·비즈니스(크리에이터) 계정이 있어야 숫자를 받아 올 수 있어요' },
  { name: '메일(네이버·Gmail)·네이버 캘린더', state: '앱 비밀번호로 연결', note: '위 \'메일·캘린더 연결\'에서 직접 연결해요(로그인 연결 OAuth는 쓰지 않음)' },
];

export function AccountsList({ account }: { account: AccountSummary }) {
  return (
    <dl className="account-list">
      <div><dt>블로그</dt><dd>{account.blogs.length ? account.blogs.map(b => <a key={b.blog_id} href={b.url} target="_blank" rel="noopener noreferrer">{b.platform} {b.name}<span className="muted small"> · 글 {b.post_count}개</span></a>) : <span className="muted">연결 안 함</span>}</dd></div>
      {HANDLE_FIELDS.map(f => {
        const h = account.handles.find(x => x.platform === f.platform);
        return <div key={f.platform}><dt>{f.label}</dt><dd>{h ? <a href={h.url} target="_blank" rel="noopener noreferrer">@{h.handle}</a> : <span className="muted">안 적음</span>}</dd></div>;
      })}
      <div><dt>연락 이메일</dt><dd>{account.contact_email || <span className="muted">제안서에 안 적음</span>}</dd></div>
    </dl>
  );
}

export function AccountsCard() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => { api<AccountSummary>('/api/accounts').then(setAccount).catch(e => setMessage({ kind: 'error', text: e instanceof Error ? e.message : '계정 정보를 불러오지 못했어요.' })); }, []);

  async function save(event: FormEvent, platform: string) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const next = await api<AccountSummary>('/api/accounts', { method: 'PUT', body: { platform, handle: drafts[platform] ?? '' } });
      setAccount(next); setDrafts(d => { const c = { ...d }; delete c[platform]; return c; });
      setMessage({ kind: 'info', text: '저장했어요.' });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '저장하지 못했어요.' }); }
    finally { setBusy(false); }
  }

  return (
    <section className="card step" aria-labelledby="accounts-title">
      <h2 id="accounts-title" className="step-title">내 계정</h2>
      <p className="muted small" style={{ margin: 0 }}>공개 아이디만 적어요. 비밀번호는 묻지도 저장하지도 않아요.</p>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
      {account && <AccountsList account={account} />}
      {account && (
        <div className="handle-forms">
          {HANDLE_FIELDS.map(f => {
            const saved = account.handles.find(x => x.platform === f.platform)?.handle ?? '';
            const value = drafts[f.platform] ?? saved;
            return (
              <form key={f.platform} className="publish-row" onSubmit={e => { void save(e, f.platform); }}>
                <label htmlFor={`handle-${f.platform}`} className="handle-label">{f.label}</label>
                <input id={`handle-${f.platform}`} className="input" value={value} maxLength={120} placeholder="@아이디 또는 프로필 주소" onChange={e => setDrafts(d => ({ ...d, [f.platform]: e.target.value }))} />
                <button className="btn small" type="submit" aria-label={`${f.label} 아이디 저장`} disabled={busy || value === saved}>저장</button>
              </form>
            );
          })}
        </div>
      )}
      <details className="connections">
        <summary className="small">바깥 서비스 연결 상태</summary>
        <ul className="plan-list">{CONNECTIONS.map(c => <li key={c.name} className="small"><b>{c.name}</b> · {c.state}<span className="muted"> — {c.note}</span></li>)}</ul>
      </details>
    </section>
  );
}
