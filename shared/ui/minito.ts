// 미니토: 미니 가족 캐릭터(방울토마토). 앱마다 실제 토마토 품종 색을 입는다.
// React 없이 SVG 문자열만 만든다(shared 폴더는 외부 패키지를 쓰지 않음). 안의 값은 모두 이 파일의 상수라 사용자 입력이 섞이지 않는다.

export type MinitoKind = 'hub' | 'minially' | 'minilog';
export type MinitoPose = 'idle' | 'wave';

const INK = '#2B2233';
const LEAF = '#3E9A57';
export const MINITO_COLORS: Record<MinitoKind, { body: string; shade: string }> = {
  hub: { body: '#FF5A4E', shade: '#E4443A' },       // 빨간 토마토
  minially: { body: '#F58BA8', shade: '#E0708F' },  // 분홍 토마토
  minilog: { body: '#FFA03A', shade: '#EE8A24' },   // 주황 대추방울토마토
};

function body(kind: MinitoKind, face: boolean) {
  const { body: fill, shade } = MINITO_COLORS[kind];
  const calyx = [0, 72, 144, 216, 288].map(a => {
    const r = ((a - 90) * Math.PI) / 180;
    const x = 60 + Math.cos(r) * 16;
    const y = 34 + Math.sin(r) * 7;
    return `<path d="M60 34 Q${(60 + x) / 2 + 3} ${(34 + y) / 2 - 6} ${x.toFixed(1)} ${y.toFixed(1)}" stroke="${LEAF}" stroke-width="6" stroke-linecap="round" fill="none"/>`;
  }).join('');
  const eyes = face
    ? `<circle cx="49" cy="68" r="4.4" fill="${INK}"/><circle cx="71" cy="68" r="4.4" fill="${INK}"/>` +
      `<circle cx="50.4" cy="66.4" r="1.4" fill="#fff"/><circle cx="72.4" cy="66.4" r="1.4" fill="#fff"/>` +
      `<ellipse cx="39" cy="77" rx="6" ry="3.4" fill="#fff" opacity=".35"/><ellipse cx="81" cy="77" rx="6" ry="3.4" fill="#fff" opacity=".35"/>` +
      `<path d="M55 76 Q60 81 65 76" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
    : '';
  return `<ellipse cx="60" cy="66" rx="40" ry="36" fill="${fill}"/>` +
    `<path d="M38 93 Q60 104 82 93" stroke="${shade}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>` +
    `<ellipse cx="43" cy="51" rx="9" ry="5.5" fill="#fff" opacity=".45" transform="rotate(-30 43 51)"/>` +
    calyx + `<path d="M60 34 q1 -10 6 -14" stroke="${LEAF}" stroke-width="5" fill="none" stroke-linecap="round"/>` + eyes;
}

/** 미니토 SVG 문자열. size는 px. 작은 크기(24px 미만)에서는 얼굴을 빼서 형태만 남긴다. */
export function minitoSvg(kind: MinitoKind, size = 64, pose: MinitoPose = 'idle') {
  const face = size >= 24;
  const extra = pose === 'wave'
    ? `<path d="M48 100 l-4 12 M72 100 l4 12" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` +
      `<path class="minito-arm" d="M22 62 q-12 -10 -6 -24" stroke="${MINITO_COLORS[kind].body}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      `<path d="M98 62 q12 -10 6 -24" stroke="${MINITO_COLORS[kind].body}" stroke-width="7" fill="none" stroke-linecap="round"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false">${extra}${body(kind, face)}</svg>`;
}
