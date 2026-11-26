// 켤 때 새 버전 알림(켜고 3초 뒤 한 번 확인).
// - Windows 앱: 새 버전이 받아져 있으면 '준비됨 · 지금 재시작', 자동 다운로드가 꺼져 있으면 '받기'. 재시작은 기존 저장 확인을 거친다.
// - 웹·폰: 서버 version.json이 지금보다 새로우면 '새 버전이 있어요 · 새로고침'.
// - 업데이트 뒤 처음 켰을 때: '0.1.x로 바뀌었어요'와 바뀐 점(이 빌드의 릴리스 노트) 한 번.
// 같은 버전 알림은 닫으면 다시 띄우지 않는다(이 기기 브라우저 저장소, 못 쓰면 이번 실행 동안만).
import { useEffect, useState } from 'react';
import { Download, RefreshCw, Sparkles, X } from 'lucide-react';
import notesText from '../../../desktop/RELEASE-NOTES.md?raw';
import { formatAppVersion, isNewerVersion, releaseNoteItems } from '../../utils/appVersion';

const SEEN = 'minially.version.seen', DISMISSED = 'minially.update.dismissed';
export const UPDATE_CHECK_DELAY = 3000;
const read = (key: string) => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* 저장 못 하면 이번 실행 동안만 */ } };

type Notice = { kind: 'changed' } | { kind: 'web'; version: string } | { kind: 'ready' | 'available'; version: string };

export function UpdateNotice({ raised = false }: { raised?: boolean }) {
  const current = __APP_RELEASE__;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const seen = read(SEEN);
    write(SEEN, current);
    if (seen && isNewerVersion(current, seen)) setNotice({ kind: 'changed' }); // 업데이트 뒤 첫 실행(처음 설치면 조용히)
    const api = window.miniallyDesktop;
    let stop = false, off: (() => void) | undefined;
    const timer = window.setTimeout(async () => {
      if (stop) return;
      if (api) {
        // Windows 앱: 앱이 켜고 3초 뒤 확인을 시작한다(desktop/main.cjs). 상태가 '받음/있음'이 되면 알린다.
        const show = (u: { kind: string; version: string }) => {
          if (stop || (u.kind !== 'ready' && u.kind !== 'available') || read(DISMISSED) === `${u.kind}:${u.version}`) return;
          setNotice(n => (n?.kind === 'changed' ? n : { kind: u.kind as 'ready' | 'available', version: u.version }));
        };
        off = api.onState(state => show(state.update));
        try { show((await api.getState()).update); } catch { /* 상태를 못 읽으면 제목 표시줄 배지만 */ }
        return;
      }
      if (!navigator.onLine) return;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json() as { version?: unknown };
        const latest = typeof body.version === 'string' ? body.version : '';
        if (!stop && isNewerVersion(latest, current) && read(DISMISSED) !== `web:${latest}`) setNotice(n => (n?.kind === 'changed' ? n : { kind: 'web', version: latest }));
      } catch { /* 오프라인·서버 오류면 알리지 않음 */ }
    }, UPDATE_CHECK_DELAY);
    return () => { stop = true; window.clearTimeout(timer); off?.(); };
  }, [current]);

  if (!notice) return null;
  const items = releaseNoteItems(notesText);
  const close = () => { if (notice.kind !== 'changed') write(DISMISSED, `${notice.kind}:${notice.version}`); setNotice(null); setOpen(false); };
  async function act() {
    if (!notice || busy) return;
    setBusy(true); setError('');
    try {
      if (notice.kind === 'web') {
        const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
        await reg?.update().catch(() => {});
        window.location.reload();
      } else if (notice.kind === 'ready') await window.miniallyDesktop!.installUpdate();
      else if (notice.kind === 'available') { await window.miniallyDesktop!.downloadUpdate(); setNotice(null); }
    } catch { setError('열린 편집창과 저장 상태를 확인한 뒤 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  const title = notice.kind === 'changed' ? `${formatAppVersion(current)}로 바뀌었어요`
    : notice.kind === 'ready' ? `새 버전 ${formatAppVersion(notice.version)} 준비됨`
    : `새 버전 ${formatAppVersion(notice.version)}이 있어요`;
  const action = notice.kind === 'ready' ? '지금 재시작' : notice.kind === 'available' ? '받기' : notice.kind === 'web' ? '새로고침' : '';
  const Icon = notice.kind === 'changed' ? Sparkles : notice.kind === 'web' ? RefreshCw : Download;

  return <div role="status" aria-label="새 버전 알림" data-update-notice={notice.kind}
    className={`fixed left-1/2 z-40 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border border-app-line bg-white p-3 text-app-ink shadow-lg ${raised ? 'bottom-36 md:bottom-20' : 'bottom-20 md:bottom-6'}`}>
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-app-accent-ink" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm font-semibold">{title}</p>
      {notice.kind === 'changed' && items.length > 0 && <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-app-accent-ink hover:bg-app-soft md:min-h-9">{open ? '접기' : '바뀐 점 보기'}</button>}
      {action && <button type="button" disabled={busy} onClick={() => { void act(); }} className="min-h-11 shrink-0 rounded-lg bg-app-accent-ink px-3 text-xs font-bold text-white disabled:opacity-60 md:min-h-9">{busy ? '잠시만요…' : action}</button>}
      <button type="button" aria-label="새 버전 알림 닫기" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-muted hover:bg-app-soft md:h-9 md:w-9"><X className="h-4 w-4" /></button>
    </div>
    {notice.kind === 'ready' && <p className="mt-1 pl-6 text-xs text-app-muted">저장 상태를 확인한 뒤 다시 켜져요. 나중에 하려면 위쪽 버전 표시에서 재시작할 수 있어요.</p>}
    {notice.kind === 'web' && <p className="mt-1 pl-6 text-xs text-app-muted">새로고침하면 바로 적용돼요. 작성 중인 글은 먼저 저장해 주세요.</p>}
    {open && <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto rounded-xl bg-app-soft py-2 pl-7 pr-3 text-xs leading-5">{items.map(item => <li key={item}>{item}</li>)}</ul>}
    {error && <p role="alert" className="mt-1 pl-6 text-xs text-red-700">{error}</p>}
  </div>;
}
