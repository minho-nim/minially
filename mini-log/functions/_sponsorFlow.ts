// 협찬 흐름 돕기(AI 없음, 규칙만): ① 선정(진행 중)되면 가이드가 붙은 빈 원고를 마감 전날에 준비 ② 정산 확인·게시 결과 보고 메일 초안.
// 메일은 초안만 만들고 보내기는 사람이 메일 화면에서 직접 한다. 숫자·주소는 실제 기록에 있는 것만 넣는다(없으면 빼고 지어내지 않음).
import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';
import { createDraft, updateDraft } from './_drafts';
import { updateCampaign, type Campaign } from './_campaigns';

export const PAYMENT_DAYS = 14; // 게시 뒤 이만큼 지나도 정산이 안 되면 브리핑에 '입금 확인'
const DAY = 86400000;
export const kstDay = (now = Date.now(), add = 0) => new Date(now + 9 * 3600000 + add * DAY).toISOString().slice(0, 10);
export const daysSince = (from: string, today: string) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;

/** 협찬이 '진행 중'이 되었고 연결된 원고가 없으면: 제목·필수 해시태그·글 종류(협찬)를 넣은 빈 원고를 마감 전날(지났으면 날짜 없이)에 만들고 연결 */
export async function prepareDraft(db: D1Database, user: UserName, c: Campaign, now = Date.now()) {
  if (c.kind !== 'sponsor' || c.draft_id) return null;
  const today = kstDay(now);
  const before = c.deadline ? kstDay(Date.parse(`${c.deadline}T00:00:00Z`) - 9 * 3600000, -1) : null;
  const planned = before && before >= today ? before : c.deadline && c.deadline >= today ? c.deadline : null;
  const draft = await createDraft(db, user, planned);
  await updateDraft(db, user, draft.id, { title: `${c.brand}${c.title ? ` ${c.title}` : ''}`.slice(0, 200), hashtags: (c.guide?.hashtags ?? []).slice(0, 30), post_type: 'sponsored' });
  await updateCampaign(db, user, c.id, { draft_id: draft.id });
  return { id: draft.id, planned_on: planned };
}

/** 그 협찬 메일을 보낸 주소(가장 최근, 내가 보낸 메일 제외). 없으면 빈칸 */
async function brandAddress(db: D1Database, user: UserName, id: string) {
  const row = await db.prepare("SELECT from_addr FROM minilog_mails WHERE user = ? AND campaign_id = ? AND kind != 'outgoing' AND from_addr != '' ORDER BY received_at DESC LIMIT 1").bind(user, id).first<{ from_addr: string }>();
  return row?.from_addr ?? '';
}

export type MailKind = 'payment' | 'report';
/** 정산 확인(payment)·게시 결과 보고(report) 메일 초안 */
export async function sponsorMail(db: D1Database, user: UserName, c: Campaign, kind: MailKind, now = Date.now()) {
  const [to, draft, form] = await Promise.all([
    brandAddress(db, user, c.id),
    c.draft_id ? db.prepare('SELECT title, published_url, published_at FROM minilog_drafts WHERE user = ? AND id = ?').bind(user, c.draft_id).first<{ title: string; published_url: string; published_at: number | null }>() : null,
    db.prepare('SELECT form FROM minilog_proposals WHERE user = ?').bind(user).first<{ form: string }>(),
  ]);
  let blog = '';
  try { blog = String(JSON.parse(form?.form ?? '{}').blog_name ?? '').trim().slice(0, 60); } catch { blog = ''; }
  const stats = c.draft_id ? await db.prepare('SELECT views, stats_on FROM minilog_posts WHERE user = ? AND draft_id = ? AND views IS NOT NULL ORDER BY stats_on DESC LIMIT 1').bind(user, c.draft_id).first<{ views: number; stats_on: string | null }>() : null;
  const url = draft?.published_url ?? '';
  const posted = c.posted_on ?? (draft?.published_at ? kstDay(draft.published_at) : null);
  const name = c.title ? `${c.brand}(${c.title})` : c.brand;
  const me = blog ? `${blog} 블로그` : '블로그';
  const hello = [`안녕하세요, ${c.brand} 담당자님.`, `${me}입니다.`, ''];
  const bye = ['', '감사합니다.', blog ? `${blog} 드림` : ''];
  if (kind === 'payment') {
    return {
      to, subject: `[${c.brand}] 원고료 정산 확인 부탁드려요`,
      text: [...hello,
        `${name} 리뷰를 ${posted ? `${md(posted)}에 ` : ''}게시했는데, 정산이 진행되었는지 확인 부탁드리려고 연락드렸어요.`,
        '', ...(c.amount ? [`- 금액: ${won(c.amount)}`] : []), ...(url ? [`- 게시 글: ${url}`] : []),
        '', '혹시 필요한 서류(계좌·신분증 사본·세금 처리 정보 등)가 있으면 알려 주세요. 바로 보내 드릴게요.', ...bye].join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    };
  }
  return {
    to, subject: `[${c.brand}] 리뷰 게시 안내 드려요`,
    text: [...hello,
      `${name} 리뷰를 ${posted ? `${md(posted)}에 ` : ''}게시했어요.`,
      '', ...(url ? [`- 게시 글: ${url}`] : []),
      ...(stats ? [`- 조회수: ${stats.views.toLocaleString('ko-KR')}회${stats.stats_on ? `(${md(stats.stats_on)} 기준)` : ''}`] : []),
      '', '수정할 부분이 있으면 편하게 말씀해 주세요. 좋은 기회 주셔서 감사합니다. 다음에도 함께할 수 있으면 좋겠어요.', ...bye].join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  };
}
