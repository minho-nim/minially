import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import { useNameOf } from './names';

// 두 사람의 계정 정보: 연결 블로그·공개 SNS 아이디·제안서 연락 이메일(미니로그에서 각자 적음). 비밀번호·토큰은 없다.
interface Account {
  user: string;
  blogs: { blog_id: string; platform: string; name: string; url: string; post_count: number }[];
  handles: { platform: string; label: string; handle: string; url: string }[];
  contact_email: string;
}
const FIELDS = [['instagram', '인스타그램'], ['threads', '스레드'], ['x', 'X'], ['youtube', '유튜브']] as const;

export function AccountsPanel() {
  const nameOf = useNameOf();
  const [users, setUsers] = useState<Account[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<{ users: Account[] }>('/api/accounts').then(d => setUsers(d.users)).catch(e => setError(e instanceof Error ? e.message : '불러오지 못했어요.')); }, []);
  return (
    <section id="accounts" className="card" aria-labelledby="accounts-title">
      <h2 id="accounts-title" className="section-title">계정</h2>
      <p className="muted small" style={{ margin: 0 }}>각자 미니로그 '내 계정'에서 적은 공개 아이디예요. 비밀번호는 저장하지 않아요.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {users && (
        <div className="account-cards">
          {users.map(u => (
            <div key={u.user} className="account-card">
              <b>{nameOf(u.user)}</b>
              <dl className="account-list">
                <div><dt>블로그</dt><dd>{u.blogs.length ? u.blogs.map(b => <a key={b.blog_id} href={b.url} target="_blank" rel="noopener noreferrer">{b.platform} {b.name}<span className="muted"> · 글 {b.post_count}개</span></a>) : <span className="muted">연결 안 함</span>}</dd></div>
                {FIELDS.map(([platform, label]) => {
                  const h = u.handles.find(x => x.platform === platform);
                  return <div key={platform}><dt>{label}</dt><dd>{h ? <a href={h.url} target="_blank" rel="noopener noreferrer">@{h.handle}</a> : <span className="muted">안 적음</span>}</dd></div>;
                })}
                <div><dt>연락 이메일</dt><dd>{u.contact_email || <span className="muted">안 적음</span>}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
