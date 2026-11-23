// 토톰이: 미니 가족 캐릭터(새싹 달린 동글동글 토마토). 앱마다 색만 바꿔 입는다.
// React 없이 SVG 문자열만 만든다(shared 폴더는 외부 패키지를 쓰지 않음). 안의 값은 모두 이 파일의 상수라 사용자 입력이 섞이지 않는다.

export type TotomKind = 'hub' | 'minially' | 'minilog';
export type TotomPose = 'idle' | 'wave';

const INK = '#2B2233';
export const TOTOM_COLORS: Record<TotomKind, string> = {
  hub: '#FFAA9C',       // 코랄 토마토
  minially: '#F4A3BB',  // 분홍 토마토
  minilog: '#FFBE85',   // 살구 토마토
};

function face() {
  return `<circle cx="49" cy="68" r="4.2" fill="${INK}"/><circle cx="71" cy="68" r="4.2" fill="${INK}"/>` +
    `<circle cx="50.3" cy="66.6" r="1.3" fill="#fff"/><circle cx="72.3" cy="66.6" r="1.3" fill="#fff"/>` +
    `<ellipse cx="40" cy="77" rx="6" ry="3.4" fill="#FF7E8F" opacity=".55"/><ellipse cx="80" cy="77" rx="6" ry="3.4" fill="#FF7E8F" opacity=".55"/>` +
    `<path d="M55 76 Q60 81 65 76" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
}

function parts(kind: TotomKind, opts: { face: boolean; feet: boolean; pose: TotomPose }) {
  const c = TOTOM_COLORS[kind];
  const feet = opts.feet
    ? `<ellipse cx="48" cy="104" rx="8" ry="4" fill="${INK}" opacity=".85"/><ellipse cx="72" cy="104" rx="8" ry="4" fill="${INK}" opacity=".85"/>`
    : '';
  const arms = opts.pose === 'wave'
    ? `<path d="M24 70 q-12 -6 -12 -20" stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round" style="filter:brightness(.93)"/>` +
      `<path d="M96 70 q12 -6 12 -20" stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round" style="filter:brightness(.93)"/>`
    : '';
  return feet + arms +
    `<path d="M60 40 C60 32 60 28 60 22" stroke="#4FA463" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<path d="M60 27 C50 15 38 19 41 28 C49 31 56 30 60 27Z" fill="#79C98A"/>` +
    `<path d="M60 24 C71 11 84 15 81 24 C73 28 66 27 60 24Z" fill="#79C98A"/>` +
    `<ellipse cx="60" cy="70" rx="38" ry="34" fill="${c}"/>` +
    `<ellipse cx="46" cy="54" rx="10" ry="6" fill="#fff" opacity=".35" transform="rotate(-25 46 54)"/>` +
    (opts.face ? face() : '');
}

/** 토톰이 SVG 문자열. size는 px. 24px 미만에서는 얼굴·발을 빼고 형태만 남긴다. */
export function totomSvg(kind: TotomKind, size = 64, pose: TotomPose = 'idle') {
  const small = size < 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false">${parts(kind, { face: !small, feet: !small, pose })}</svg>`;
}

/** 앱 아이콘(정사각형): 여백을 줄여 캐릭터를 크게. 발은 빼고 몸·새싹·얼굴만. */
export function totomIconSvg(kind: TotomKind, background: string) {
  // 캐릭터(새싹 위끝 y≈12 ~ 몸 아래 y≈104, 좌우 22~98)가 아이콘의 약 92%를 채우도록 확대
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="${background}"/>` +
    `<g transform="translate(60 61) scale(1.18) translate(-60 -60)">${parts(kind, { face: true, feet: false, pose: 'idle' })}</g></svg>\n`;
}
