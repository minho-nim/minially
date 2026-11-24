// 협찬 제안서 화면 공용: 타입과 기본 메일(규칙으로 만드는 초안, AI 없이)
export interface ProposalForm {
  blog_name: string; topic: string; intro: string; about: string; audience: string; strengths: string; offers: string; cases: string;
  price: string; show_price: boolean; contact_email: string; contact_extra: string;
}
export interface ProposalStats {
  blogs: string[]; posts_total: number; posts_per_month: number; avg_views: number | null; with_stats: number;
  top: { title: string; url: string; views: number; likes: number | null }[];
  tags: string[]; sponsor_done: number; brands: string[];
}

/** 끝 글자 받침에 따라 '을/를'(한글이 아니면 '을(를)') */
export function eulReul(word: string) {
  const c = word.trim().slice(-1).charCodeAt(0);
  if (c < 0xac00 || c > 0xd7a3) return '을(를)';
  return (c - 0xac00) % 28 ? '을' : '를';
}

/** 한 줄 소개를 문장으로: 끝이 '요·다·.' 등이 아니면 '이에요/예요.'를 붙인다 */
export function sentence(text: string) {
  const t = text.trim().replace(/[.。]+$/, '');
  if (/[요다!?]$/.test(t)) return `${t}.`;
  return `${t}${eulReul(t) === '을' ? '이에요' : '예요'}.`;
}

const lines = (text: string) => text.split('\n').map(l => l.replace(/^[-•·]\s*/, '').trim()).filter(Boolean);
export const bullets = lines;

/** 단가 문장: 켜져 있고 적은 값이 있을 때만. '협의 가능'을 붙인다. */
export const priceLine = (f: ProposalForm) => (f.show_price && f.price.trim() ? `${f.price.trim()}${/협의/.test(f.price) ? '' : ' (협의 가능)'}` : '');

/** 이번에 제안할 업체 정보(저장 안 함) */
export interface Pitch { brand: string; product: string; reason: string; schedule: string }
export const EMPTY_PITCH: Pitch = { brand: '', product: '', reason: '', schedule: '' };

const target = (p: Pitch) => (p.product ? `${p.product}${eulReul(p.product)}` : p.brand ? `${p.brand}${eulReul(p.brand)}` : '제품·서비스를');
const numbersLine = (s: ProposalStats) => [
  s.avg_views ? `글 평균 조회수 ${s.avg_views.toLocaleString('ko-KR')}회` : '',
  s.posts_per_month ? `한 달에 글 ${s.posts_per_month}개 정도` : '',
  s.sponsor_done ? `협찬 진행 ${s.sponsor_done}건` : '',
].filter(Boolean).join(' · ');

/**
 * 기본 메일(규칙, AI 없이). 먼저 제안하는 글에서 답이 잘 오는 순서를 따른다:
 * 짧은 자기소개 → 왜 이 업체인지 → 업체가 얻는 것(독자·숫자·대표 글) → 제안 조건(방식·일정·비용) → 답장 방법.
 * '협업 요청드립니다' 같은 막연한 말 대신 구체적으로 쓴다.
 */
export function defaultMail(f: ProposalForm, s: ProposalStats, name: string, p: Pitch) {
  const blog = f.blog_name || '제 블로그';
  const brand = p.brand || '귀사';
  const subject = `[블로그 리뷰 제안] ${p.brand ? `${p.brand} ` : ''}${p.product ? `${p.product} ` : ''}- ${f.topic ? `${f.topic} 블로거 ` : '블로거 '}${name}`.replace(/\s+/g, ' ');
  const offers = lines(f.offers);
  const price = priceLine(f);
  const nums = numbersLine(s);
  const top = s.top[0];
  // '' = 빈 줄, null = 이번엔 넣지 않는 줄
  const BR = '';
  const body = ([
    `안녕하세요, ${brand} 담당자님.`,
    `${f.topic ? `${f.topic} 블로그 ` : '블로그 '}「${blog}」${eulReul(blog) === '를' ? '를' : '을'} 운영하는 ${name}입니다.${f.intro ? ` ${sentence(f.intro)}` : ''}`,
    BR,
    p.reason ? sentence(p.reason) : null,
    `${target(p)} 직접 경험하고 제 블로그 독자분들께 솔직한 후기로 소개하고 싶어 연락드렸습니다.`,
    BR,
    f.audience || nums || top ? '업체에 도움이 되는 점' : null,
    f.audience ? `- 주요 독자: ${f.audience.replace(/[.。]$/, '')}` : null,
    nums ? `- ${nums}` : null,
    top ? `- 대표 글: ${top.title}(조회 ${top.views.toLocaleString('ko-KR')}회)` : null,
    ...lines(f.strengths).slice(0, 2).map(l => `- ${l}`),
    BR,
    offers.length || p.schedule || price ? '제안 내용' : null,
    offers.length ? `- 방식: ${offers.join(', ')}` : null,
    p.schedule ? `- 일정: ${p.schedule}` : null,
    price ? `- 비용: ${price}` : null,
    offers.length || p.schedule || price ? '- 게시 후 조회수 등 결과를 정리해 공유드려요.' : null,
    BR,
    '블로그 소개서(PDF)를 첨부했어요. 괜찮으시면 이 메일로 편하게 회신 주세요. 일정에 맞춰 진행할게요.',
    BR,
    `${name} 드림`,
    [f.contact_email, f.contact_extra].filter(Boolean).join(' · '),
  ] as (string | null)[]).filter((l): l is string => l !== null).filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === ''))).join('\n').trim().replace(/\n{3,}/g, '\n\n');
  return { subject, body };
}

/** 메일 앱 열기 주소(본문이 너무 길면 일부 메일 앱이 자르므로 1,800자까지) */
export function mailtoHref(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
}

/** 인스타 DM용 짧은 제안(규칙, 300자 안팎): 누구인지 → 왜 이 업체 → 숫자 한 줄 → 답장 방법 */
export function defaultDm(f: ProposalForm, s: ProposalStats, name: string, p: Pitch) {
  const blog = f.blog_name || '제 블로그';
  const nums = numbersLine(s);
  return [
    `안녕하세요, ${p.brand ? `${p.brand} ` : ''}담당자님!`,
    `${f.topic ? `${f.topic} 블로그 ` : '블로그 '}「${blog}」${eulReul(blog) === '를' ? '를' : '을'} 운영하는 ${name}입니다.`,
    p.reason ? sentence(p.reason) : '',
    `${target(p)} 직접 경험하고 블로그 후기로 소개하고 싶어 연락드렸어요.`,
    nums ? `(${nums})` : '',
    priceLine(f) ? `비용: ${priceLine(f)}` : '',
    f.contact_email ? `괜찮으시면 메일 주소를 알려 주시거나 ${f.contact_email}로 연락 주세요. 소개서를 보내 드릴게요.` : '괜찮으시면 답장 주세요. 소개서를 보내 드릴게요.',
    '감사합니다!',
  ].filter(Boolean).join('\n');
}

/** 인스타 아이디(@포함·주소도 됨) → DM 열기 주소. 형식이 틀리면 null */
export function instagramDmHref(handle: string) {
  const id = handle.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(id) ? `https://ig.me/m/${id}` : null;
}
