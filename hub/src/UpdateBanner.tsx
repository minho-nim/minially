// 켤 때 새 버전 알림: 3초 뒤 서버에 더 새 화면이 있으면 '새 버전이 있어요 · 새로고침'을 한 번 보여 준다.
import { useEffect, useState } from 'react';
import { dismissBuild, newerBuild, reloadFresh, UPDATE_DELAY } from '../../shared/client/updateCheck';

export function UpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const timer = window.setTimeout(() => { void newerBuild(__APP_COMMIT__).then(v => { if (!stop) setLatest(v); }); }, UPDATE_DELAY);
    return () => { stop = true; window.clearTimeout(timer); };
  }, []);
  if (!latest) return null;
  return <div role="status" aria-label="새 버전 알림" className="update-banner">
    <span>새 버전이 있어요. 새로고침하면 바로 적용돼요(쓰던 글은 먼저 저장돼요).</span>
    <button type="button" className="btn primary small" onClick={() => { void reloadFresh(); }}>새로고침</button>
    <button type="button" className="btn ghost small" aria-label="새 버전 알림 닫기" onClick={() => { dismissBuild(latest); setLatest(null); }}>닫기</button>
  </div>;
}
