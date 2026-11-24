import { useRef, useState } from 'react';
import { api } from '../../shared/client/api';

// mini-log 데이터 백업: 받기(JSON 파일) · 불러오기(합치기, 불러오기 전에 지금 데이터를 자동으로 한 번 더 받아 둠)
type Count = { added: number; updated: number; kept: number; skipped: number };
type Result = Record<'drafts' | 'campaigns' | 'styles' | 'blogs' | 'posts' | 'proposal', Count>;
const LABEL: Record<keyof Result, string> = { drafts: '원고', campaigns: '협찬·수익', styles: '문체', blogs: '블로그', posts: '글 숫자', proposal: '제안서' };

async function download(label = '') {
  const data = await api<Record<string, unknown>>('/api/backup');
  const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `minilog-backup-${day}${label ? `-${label}` : ''}.json`;
  document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [confirmFile, setConfirmFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function save() {
    setBusy(true); setMessage(null);
    try { await download(); setMessage({ kind: 'info', text: '백업 파일을 받았어요. 안전한 곳에 두세요.' }); }
    catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '백업을 받지 못했어요.' }); }
    finally { setBusy(false); }
  }

  async function restore(file: File) {
    setConfirmFile(null); setBusy(true); setMessage(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('백업 파일이 너무 커요(20MB까지).');
      let data: unknown;
      try { data = JSON.parse(await file.text()); } catch { throw new Error('백업 파일(JSON)을 읽지 못했어요.'); }
      await download('before-restore');
      const { result } = await api<{ result: Result }>('/api/backup', { body: data });
      const parts = (Object.keys(LABEL) as (keyof Result)[]).map(k => ({ k, c: result[k] })).filter(({ c }) => c.added || c.updated).map(({ k, c }) => `${LABEL[k]} ${c.added ? `더함 ${c.added}` : ''}${c.added && c.updated ? '·' : ''}${c.updated ? `바꿈 ${c.updated}` : ''}`);
      const skipped = (Object.values(result) as Count[]).reduce((n, c) => n + c.skipped, 0);
      setMessage({ kind: 'info', text: `불러왔어요. ${parts.length ? parts.join(', ') : '바뀐 것 없음(지금 데이터가 더 최신)'}.${skipped ? ` 형식이 맞지 않아 건너뛴 항목 ${skipped}개.` : ''} 불러오기 전 데이터는 이름 끝이 before-restore인 파일로 받아 두었어요. 화면을 새로고침하면 보여요.` });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '백업을 불러오지 못했어요.' }); }
    finally { setBusy(false); }
  }

  return (
    <section className="card step" aria-labelledby="backup-title">
      <h2 id="backup-title" className="step-title">데이터 백업</h2>
      <p className="muted small" style={{ margin: 0 }}>원고·협찬·문체·블로그 숫자를 파일 하나로(사진 제외). 불러오기는 <b>합치기</b>(없는 것만 더하고, 더 최신인 것만 바꿈).</p>
      <div className="publish-row" style={{ alignItems: 'center' }}>
        <button className="btn" onClick={() => { void save(); }} disabled={busy}>{busy ? '처리 중…' : '백업 받기'}</button>
        <button className="btn" onClick={() => input.current?.click()} disabled={busy}>백업 불러오기</button>
        <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="불러올 백업 파일" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setConfirmFile(f); }} />
      </div>
      {confirmFile && (
        <div className="custom-banner" role="group" aria-label="백업 불러오기 확인">
          <span><b>{confirmFile.name}</b>과 합칠까요? 지금 데이터는 지우지 않고, 불러오기 전에 지금 데이터를 파일로 한 번 더 받아 둬요.</span>
          <button className="btn small primary" onClick={() => { void restore(confirmFile); }}>합치기</button>
          <button className="btn small ghost" onClick={() => setConfirmFile(null)}>취소</button>
        </div>
      )}
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
    </section>
  );
}
