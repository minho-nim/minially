// 협찬·광고 캠페인과 수익 기록. 모든 쿼리에 user 조건. 계약 정보라 다른 사람·통계에는 내보내지 않는다.
import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

export const KINDS = ['sponsor', 'ad', 'other'] as const;
export const STATUSES = ['proposed', 'in_progress', 'posted', 'paid', 'cancelled'] as const;
export type Kind = (typeof KINDS)[number];
export type Status = (typeof STATUSES)[number];

/** 체험단 가이드 정리(업체 가이드에서 뽑은 조건). 원고 점검과 캘린더(방문일)에 쓴다. */
export interface Guide { keywords: string[]; hashtags: string[]; min_photos: number | null; min_chars: number | null; links: string[]; visit_on: string | null; notes: string }
export interface Campaign {
  id: string; kind: Kind; brand: string; title: string; provided: string; amount: number;
  deadline: string | null; status: Status; paid_on: string | null; draft_id: string | null; memo: string;
  guide: Guide | null; created_at: number; updated_at: number;
}
const COLUMNS = 'id, kind, brand, title, provided, amount, deadline, status, paid_on, draft_id, memo, guide, created_at, updated_at';
type Row = Omit<Campaign, 'guide'> & { guide: string | null };
const toCampaign = (r: Row): Campaign => ({ ...r, guide: r.guide ? cleanGuide(JSON.parse(r.guide)) : null });

const words = (v: unknown, n: number, max: number) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.replace(/^#+/, '').trim().slice(0, max)).filter(Boolean))].slice(0, n) : []);
const count = (v: unknown, max: number) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n <= max ? n : null; };
/** 가이드 값 정리(모르는 칸 버리고 길이 자르기). 다 비면 null */
export function cleanGuide(v: unknown): Guide | null {
  if (!v || typeof v !== 'object') return null;
  const g = v as Record<string, unknown>;
  const guide: Guide = {
    keywords: words(g.keywords, 10, 40), hashtags: words(g.hashtags, 30, 40), min_photos: count(g.min_photos, 50), min_chars: count(g.min_chars, 20000),
    links: Array.isArray(g.links) ? g.links.filter((x): x is string => typeof x === 'string' && /^https:\/\/\S+$/.test(x) && x.length <= 500).slice(0, 5) : [],
    visit_on: typeof g.visit_on === 'string' && validDate(g.visit_on) ? g.visit_on : null,
    notes: typeof g.notes === 'string' ? g.notes.trim().slice(0, 1000) : '',
  };
  return guide.keywords.length || guide.hashtags.length || guide.min_photos || guide.min_chars || guide.links.length || guide.visit_on || guide.notes ? guide : null;
}
const LIMITS = { brand: 60, title: 100, provided: 500, memo: 1000, amount: 10_000_000_000 };

/** YYYY-MM-DD 이고 실제 있는 날짜인지 */
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

type Patch = Partial<Omit<Campaign, 'id' | 'created_at' | 'updated_at'>>;

/** 사용자가 보낸 값 검사. 틀리면 오류 문구. */
export function readCampaign(body: Record<string, unknown>): Patch | string {
  const patch: Patch = {};
  if (body.kind !== undefined) {
    if (!KINDS.includes(body.kind as Kind)) return '종류가 올바르지 않아요.';
    patch.kind = body.kind as Kind;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as Status)) return '상태가 올바르지 않아요.';
    patch.status = body.status as Status;
  }
  for (const key of ['brand', 'title', 'provided', 'memo'] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string') return '글자만 저장할 수 있어요.';
    const value = (body[key] as string).trim();
    if (value.length > LIMITS[key]) return '내용이 너무 길어요.';
    patch[key] = value;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > LIMITS.amount) return '금액은 0 이상의 원 단위 숫자로 적어 주세요.';
    patch.amount = amount;
  }
  for (const key of ['deadline', 'paid_on'] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === '') { patch[key] = null; continue; }
    if (typeof body[key] !== 'string' || !validDate(body[key] as string)) return '날짜 형식이 올바르지 않아요.';
    patch[key] = body[key] as string;
  }
  if (body.guide !== undefined) patch.guide = body.guide === null ? null : cleanGuide(body.guide);
  if (body.draft_id !== undefined) {
    if (body.draft_id === null || body.draft_id === '') patch.draft_id = null;
    else if (typeof body.draft_id === 'string' && /^[0-9a-f-]{36}$/.test(body.draft_id)) patch.draft_id = body.draft_id;
    else return '연결할 원고가 올바르지 않아요.';
  }
  return patch;
}

export async function listCampaigns(db: D1Database, user: UserName) {
  return (await db.prepare(`SELECT ${COLUMNS} FROM minilog_campaigns WHERE user = ? ORDER BY status IN ('paid', 'cancelled'), deadline IS NULL, deadline, updated_at DESC LIMIT 500`).bind(user).all<Row>()).results.map(toCampaign);
}

export async function getCampaign(db: D1Database, user: UserName, id: string) {
  const row = await db.prepare(`SELECT ${COLUMNS} FROM minilog_campaigns WHERE user = ? AND id = ?`).bind(user, id).first<Row>();
  return row ? toCampaign(row) : null;
}

/** 연결할 원고가 본인 것인지 */
async function ownsDraft(db: D1Database, user: UserName, draftId: string | null | undefined) {
  if (!draftId) return true;
  return !!(await db.prepare('SELECT 1 AS ok FROM minilog_drafts WHERE user = ? AND id = ?').bind(user, draftId).first());
}

/** 정산 완료인데 받은 날짜가 없으면 오늘(한국 시간)로 채운다. */
function normalize(next: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>) {
  if (next.kind !== 'sponsor' && !next.brand) next.brand = next.kind === 'ad' ? '광고 수익' : '기타 수익';
  if (next.status === 'paid' && !next.paid_on) next.paid_on = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  return next;
}

export async function createCampaign(db: D1Database, user: UserName, patch: Patch): Promise<Campaign | string> {
  const base = normalize({ kind: 'sponsor', brand: '', title: '', provided: '', amount: 0, deadline: null, status: 'proposed', paid_on: null, draft_id: null, memo: '', guide: null, ...patch });
  if (!base.brand) return '업체 이름을 적어 주세요.';
  if (!(await ownsDraft(db, user, base.draft_id))) return '연결할 원고를 찾을 수 없어요.';
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.prepare('INSERT INTO minilog_campaigns (id, user, kind, brand, title, provided, amount, deadline, status, paid_on, draft_id, memo, guide, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user, base.kind, base.brand, base.title, base.provided, base.amount, base.deadline, base.status, base.paid_on, base.draft_id, base.memo, base.guide ? JSON.stringify(base.guide) : null, now, now).run();
  return (await getCampaign(db, user, id))!;
}

export async function updateCampaign(db: D1Database, user: UserName, id: string, patch: Patch): Promise<Campaign | null | string> {
  const current = await getCampaign(db, user, id);
  if (!current) return null;
  const next = normalize({ ...current, ...patch });
  if (!next.brand) return '업체 이름을 적어 주세요.';
  if (!(await ownsDraft(db, user, next.draft_id))) return '연결할 원고를 찾을 수 없어요.';
  await db.prepare('UPDATE minilog_campaigns SET kind = ?, brand = ?, title = ?, provided = ?, amount = ?, deadline = ?, status = ?, paid_on = ?, draft_id = ?, memo = ?, guide = ?, updated_at = ? WHERE user = ? AND id = ?')
    .bind(next.kind, next.brand, next.title, next.provided, next.amount, next.deadline, next.status, next.paid_on, next.draft_id, next.memo, next.guide ? JSON.stringify(next.guide) : null, Date.now(), user, id).run();
  return getCampaign(db, user, id);
}

export async function deleteCampaign(db: D1Database, user: UserName, id: string) {
  await db.prepare('DELETE FROM minilog_campaigns WHERE user = ? AND id = ?').bind(user, id).run();
}

/** 대시보드용: 최근 6개월 월별 정산 금액, 이번 달 수익, 다가오는 마감(진행 중인 것만) */
export async function revenueSummary(db: D1Database, user: UserName, today: string) {
  const month = today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const rows = (await db.prepare("SELECT substr(paid_on, 1, 7) AS month, SUM(amount) AS total, COUNT(*) AS count FROM minilog_campaigns WHERE user = ? AND status = 'paid' AND paid_on >= ? GROUP BY month")
    .bind(user, `${months[0]}-01`).all<{ month: string; total: number; count: number }>()).results;
  const byMonth = new Map(rows.map(r => [r.month, r]));
  const pending = await db.prepare("SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM minilog_campaigns WHERE user = ? AND status IN ('proposed', 'in_progress', 'posted')").bind(user).first<{ total: number; count: number }>();
  const upcoming = (await db.prepare("SELECT id, brand, title, deadline, status FROM minilog_campaigns WHERE user = ? AND status IN ('proposed', 'in_progress', 'posted') AND deadline IS NOT NULL AND deadline >= ? ORDER BY deadline LIMIT 5")
    .bind(user, today).all<{ id: string; brand: string; title: string; deadline: string; status: Status }>()).results;
  return {
    this_month: byMonth.get(month)?.total ?? 0,
    months: months.map(mm => ({ month: mm, total: byMonth.get(mm)?.total ?? 0, count: byMonth.get(mm)?.count ?? 0 })),
    pending: { total: pending?.total ?? 0, count: pending?.count ?? 0 },
    upcoming,
  };
}
