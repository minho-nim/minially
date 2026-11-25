// 체험단 공고 찾기 보조: 미니로그는 공고 사이트를 긁지 않는다.
// 내 지역·분야로 검색 화면을 열어 주고(고르는 건 그 사이트에서), 휴대폰 공유로 받은 공고 주소를 '관심'으로 담게 돕는다.

export interface Shared { url: string; title: string }

const firstHttps = (text: string) => text.match(/https:\/\/[^\s<>"']+/)?.[0] ?? '';

/** 휴대폰 공유(앱 공유 대상)로 열린 주소 /?title=&text=&url= 에서 공고 주소를 꺼낸다. https 주소가 없으면 null.
 *  안드로이드는 주소를 text에 넣어 보내는 앱이 많아서 text에서도 찾는다. */
export function readShare(search: string): Shared | null {
  const q = new URLSearchParams(search);
  if (!q.has('url') && !q.has('text')) return null;
  const url = [q.get('url') ?? '', q.get('text') ?? ''].map(firstHttps).find(Boolean) ?? '';
  if (!url || url.length > 500) return null;
  const title = (q.get('title') ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 100);
  return { url, title };
}

export interface FinderPrefs { region: string; topic: string }
const KEY = 'minilog.finder';
export function loadPrefs(): FinderPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<FinderPrefs>;
    return { region: typeof v.region === 'string' ? v.region.slice(0, 30) : '', topic: typeof v.topic === 'string' ? v.topic.slice(0, 30) : '' };
  } catch { return { region: '', topic: '' }; }
}
export function savePrefs(p: FinderPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 저장이 막혀도 이번에는 쓸 수 있다 */ }
}

/** 네이버 통합검색: '성수 맛집 체험단 모집' */
export function searchUrl(p: FinderPrefs) {
  const query = [p.region.trim(), p.topic.trim(), '체험단 모집'].filter(Boolean).join(' ');
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}

/** 공고를 모아 둔 사이트(첫 화면으로 연다. 검색·신청은 그 사이트에서) */
export const PLATFORMS: [string, string][] = [
  ['체험ZIP(통합 검색)', 'https://www.exp-zip.co.kr/'],
  ['레뷰', 'https://www.revu.net/'],
  ['리뷰노트', 'https://www.reviewnote.co.kr/'],
  ['디너의여왕', 'https://dinnerqueen.net/'],
];
