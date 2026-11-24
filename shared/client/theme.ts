// 화면 테마: hub 설정에서 고른 것(auto·light·dark)을 두 앱에 적용. 서버 값을 기기에도 기억해 두어 첫 화면부터 맞춘다.
export type Theme = 'auto' | 'light' | 'dark';
const KEY = 'minihub.theme';
const BG = { light: '#FFF9F4', dark: '#1B1719' };

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme; else root.dataset.theme = theme;
  // 주소창 색: 고정 테마면 두 meta를 같은 색으로
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    const fallback = meta.media.includes('dark') ? BG.dark : BG.light;
    meta.content = theme === 'auto' ? fallback : BG[theme];
  });
  try { localStorage.setItem(KEY, theme); } catch { /* 기억 못 해도 화면은 바뀜 */ }
}

export function cachedTheme(): Theme {
  try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'auto'; } catch { return 'auto'; }
}
