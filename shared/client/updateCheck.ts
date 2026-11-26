// 켤 때 새 버전 확인(미니허브·미니로그 공용): 켜고 3초 뒤 서버의 version.json 커밋이 지금 화면의 커밋과 다르면 새 버전이 있는 것.
// 개발 서버('dev')·오프라인·못 읽으면 알리지 않는다. 닫은 커밋은 이 기기 브라우저 저장소에 적어 다시 띄우지 않는다.
export const UPDATE_DELAY = 3000;
const KEY = 'minihub.update.dismissed';

export async function newerBuild(current: string): Promise<string | null> {
  if (!/^[0-9a-f]{7}$/.test(current) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json() as { commit?: unknown };
    const latest = typeof body.commit === 'string' && /^[0-9a-f]{7}$/.test(body.commit) ? body.commit : null;
    if (!latest || latest === current) return null;
    try { if (localStorage.getItem(KEY) === latest) return null; } catch { /* 저장소를 못 쓰면 이번 실행만 */ }
    return latest;
  } catch { return null; }
}

export function dismissBuild(commit: string) { try { localStorage.setItem(KEY, commit); } catch { /* 이번 실행만 */ } }

/** 서비스 워커를 새로 받은 뒤 다시 불러온다(새 화면 파일로) */
export async function reloadFresh() {
  try { const reg = await navigator.serviceWorker?.getRegistration?.(); await reg?.update(); } catch { /* 그냥 다시 불러온다 */ }
  window.location.reload();
}
