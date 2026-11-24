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

/** 기본 메일(규칙): 업체·제안 대상만 넣으면 바로 쓸 수 있는 초안 */
export function defaultMail(f: ProposalForm, s: ProposalStats, name: string, brand: string, product: string) {
  const blog = f.blog_name || '제 블로그';
  const subject = `[협찬 제안] ${f.blog_name ? `${f.blog_name} 블로그` : name} × ${brand || '귀사'}`;
  const numbers = [
    s.posts_per_month ? `최근 3개월 동안 한 달에 ${s.posts_per_month}개 정도 글을 올리고 있어요` : '',
    s.avg_views ? `글 평균 조회수는 ${s.avg_views.toLocaleString('ko-KR')}회예요` : '',
  ].filter(Boolean).join(', ');
  const offers = lines(f.offers);
  const price = priceLine(f);
  const body = [
    `안녕하세요, ${brand || '귀사'} 담당자님.`,
    '',
    `${f.topic ? `${f.topic} 블로그 ` : '블로그 '}「${blog}」${eulReul(blog) === '를' ? '를' : '을'} 운영하는 ${name}입니다.${f.intro ? ` ${sentence(f.intro)}` : ''}`,
    numbers ? `${numbers}.` : '',
    '',
    `${product ? `${product}${eulReul(product)}` : `${brand || '귀사'}의 제품·서비스를`} 직접 경험하고, 제 블로그 독자분들께 솔직한 후기로 소개하고 싶어 연락드렸습니다.`,
    offers.length ? `\n가능한 진행 방식\n${offers.map(o => `- ${o}`).join('\n')}` : '',
    price ? `\n진행 비용: ${price}` : '',
    '',
    '블로그 소개서(PDF)를 첨부했어요. 검토해 보시고 편하게 회신 부탁드립니다.',
    '',
    `${name} 드림`,
    [f.contact_email, f.contact_extra].filter(Boolean).join(' · '),
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim();
  return { subject, body };
}

/** 메일 앱 열기 주소(본문이 너무 길면 일부 메일 앱이 자르므로 1,800자까지) */
export function mailtoHref(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
}

/** 인스타 DM용 짧은 제안(규칙, 300자 안팎) */
export function defaultDm(f: ProposalForm, s: ProposalStats, name: string, brand: string, product: string) {
  const blog = f.blog_name || '제 블로그';
  const target = product ? `${product}${eulReul(product)}` : `${brand || '제품·서비스'}${brand ? '의 제품·서비스를' : ''}`.replace('제품·서비스을', '제품·서비스를');
  return [
    `안녕하세요, ${brand ? `${brand} ` : ''}담당자님!`,
    `${f.topic ? `${f.topic} 블로그 ` : '블로그 '}「${blog}」${eulReul(blog) === '를' ? '를' : '을'} 운영하는 ${name}입니다.`,
    `${target} 직접 경험하고 솔직한 후기로 소개하고 싶어 연락드렸어요.`,
    s.posts_per_month && s.avg_views ? `한 달에 ${s.posts_per_month}개 정도 글을 올리고, 글 평균 조회수는 ${s.avg_views.toLocaleString('ko-KR')}회예요.`
      : s.posts_per_month ? `한 달에 ${s.posts_per_month}개 정도 글을 올리고 있어요.` : s.avg_views ? `글 평균 조회수는 ${s.avg_views.toLocaleString('ko-KR')}회예요.` : '',
    priceLine(f) ? `진행 비용: ${priceLine(f)}` : '',
    f.contact_email ? `자세한 제안서는 메일로 보내 드릴게요(${f.contact_email}).` : '자세한 제안서도 보내 드릴 수 있어요.',
    '편하게 답장 주세요. 감사합니다!',
  ].filter(Boolean).join('\n');
}

/** 인스타 아이디(@포함·주소도 됨) → DM 열기 주소. 형식이 틀리면 null */
export function instagramDmHref(handle: string) {
  const id = handle.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(id) ? `https://ig.me/m/${id}` : null;
}
