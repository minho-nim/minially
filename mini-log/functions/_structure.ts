// 블로그 구조: 카테고리 나무(2단까지)·글 배치·주제 묶음. 모든 쿼리에 user 조건.
// 블로그 쪽 카테고리를 바꾸지는 않는다(블로그 API 없음). 미니로그 안에서 정리·안내만.
import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

export interface Category { id: string; name: string; parent_id: string | null; sort: number }
export interface Bundle { id: string; name: string; hub: string; members: string[] }
/** 구조 화면에 쓰는 글 한 줄. key = 'post:<글키>'(블로그에서 가져온 글) 또는 'draft:<id>'(아직 게시 안 한 원고) */
export interface Item { key: string; kind: 'post' | 'draft'; title: string; url: string; date: string | null; views: number | null; status: string; tags: string[]; category_id: string | null; draft_id: string | null }
/** 묶음 안에서 빠진 링크: 본문(미니로그 원고)이 있는 글만 검사 */
export interface LinkGap { item: string; missing: string[] }

const ID = /^[0-9a-f-]{36}$/;
const ITEM = /^(post:[^\s]{1,300}|draft:[0-9a-f-]{36})$/;
export const STRUCTURE_LIMITS = { categories: 60, name: 30, bundles: 50, members: 20, place: 300 };

export async function listCategories(db: D1Database, user: UserName) {
  return (await db.prepare('SELECT id, name, parent_id, sort FROM minilog_categories WHERE user = ? ORDER BY sort, created_at').bind(user).all<Category>()).results;
}

/** 나무 전체를 바꾼다(추가·이름·순서·위치·삭제). 지운 카테고리의 글은 미분류로, 지운 대분류의 소분류는 함께 지운다. */
export async function saveCategories(db: D1Database, user: UserName, body: unknown): Promise<Category[] | string> {
  const list = Array.isArray((body as { categories?: unknown })?.categories) ? (body as { categories: unknown[] }).categories : null;
  if (!list) return '카테고리 목록이 필요해요.';
  if (list.length > STRUCTURE_LIMITS.categories) return `카테고리는 ${STRUCTURE_LIMITS.categories}개까지예요.`;
  const next: Category[] = [];
  for (const [i, raw] of list.entries()) {
    const c = raw as Record<string, unknown>;
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    if (typeof c.id !== 'string' || !ID.test(c.id)) return '카테고리 아이디가 올바르지 않아요.';
    if (!name || name.length > STRUCTURE_LIMITS.name) return `카테고리 이름은 1~${STRUCTURE_LIMITS.name}자로 적어 주세요.`;
    const parent = c.parent_id === null || c.parent_id === undefined || c.parent_id === '' ? null : String(c.parent_id);
    next.push({ id: c.id, name, parent_id: parent, sort: i });
  }
  const ids = new Set(next.map(c => c.id));
  if (ids.size !== next.length) return '같은 카테고리가 두 번 있어요.';
  for (const c of next) {
    if (!c.parent_id) continue;
    const parent = next.find(p => p.id === c.parent_id);
    if (!parent) return '상위 카테고리를 찾을 수 없어요.';
    if (parent.parent_id) return '카테고리는 2단(대분류 › 소분류)까지예요.';
  }
  // 다른 사람 카테고리 아이디를 가로채지 못하게: 이미 있는 아이디는 내 것이어야 한다
  const taken = (await db.prepare(`SELECT id FROM minilog_categories WHERE user != ? AND id IN (${next.map(() => '?').join(',') || "''"})`).bind(user, ...next.map(c => c.id)).all<{ id: string }>()).results;
  if (taken.length) return '카테고리 아이디가 올바르지 않아요.';
  const now = Date.now();
  const keep = next.map(c => c.id);
  await db.batch([
    db.prepare(`DELETE FROM minilog_placements WHERE user = ?${keep.length ? ` AND category_id NOT IN (${keep.map(() => '?').join(',')})` : ''}`).bind(user, ...keep),
    db.prepare(`DELETE FROM minilog_categories WHERE user = ?${keep.length ? ` AND id NOT IN (${keep.map(() => '?').join(',')})` : ''}`).bind(user, ...keep),
    ...next.map(c => db.prepare('INSERT INTO minilog_categories (id, user, name, parent_id, sort, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, parent_id = excluded.parent_id, sort = excluded.sort WHERE minilog_categories.user = excluded.user')
      .bind(c.id, user, c.name, c.parent_id, c.sort, now)),
  ]);
  return listCategories(db, user);
}

/** 글 여러 개를 한 카테고리로(null이면 미분류로) */
export async function place(db: D1Database, user: UserName, body: unknown): Promise<true | string> {
  const b = body as { items?: unknown; category_id?: unknown };
  const items = Array.isArray(b?.items) ? b.items.filter((x): x is string => typeof x === 'string' && ITEM.test(x)) : [];
  if (!items.length || items.length > STRUCTURE_LIMITS.place) return '옮길 글을 골라 주세요.';
  const cat = b.category_id === null || b.category_id === undefined || b.category_id === '' ? null : String(b.category_id);
  if (cat && !(await db.prepare('SELECT 1 AS ok FROM minilog_categories WHERE user = ? AND id = ?').bind(user, cat).first())) return '카테고리를 찾을 수 없어요.';
  await db.batch(items.map(item => cat
    ? db.prepare('INSERT INTO minilog_placements (user, item, category_id) VALUES (?, ?, ?) ON CONFLICT(user, item) DO UPDATE SET category_id = excluded.category_id').bind(user, item, cat)
    : db.prepare('DELETE FROM minilog_placements WHERE user = ? AND item = ?').bind(user, item)));
  return true;
}

export async function listBundles(db: D1Database, user: UserName): Promise<Bundle[]> {
  return (await db.prepare('SELECT id, name, hub, members FROM minilog_bundles WHERE user = ? ORDER BY created_at').bind(user).all<{ id: string; name: string; hub: string; members: string }>()).results
    .map(r => ({ ...r, members: (JSON.parse(r.members) as string[]).filter(m => ITEM.test(m)) }));
}

export function readBundle(body: unknown): Omit<Bundle, 'id'> | string {
  const b = body as Record<string, unknown>;
  const name = typeof b?.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 40) return '묶음 이름은 1~40자로 적어 주세요.';
  const members = Array.isArray(b.members) ? [...new Set(b.members.filter((x): x is string => typeof x === 'string' && ITEM.test(x)))] : [];
  const hub = typeof b.hub === 'string' && ITEM.test(b.hub) ? b.hub : '';
  if (!hub) return '대표 글을 골라 주세요.';
  const rest = members.filter(m => m !== hub);
  if (!rest.length) return '세부 글을 한 개 이상 골라 주세요.';
  if (rest.length + 1 > STRUCTURE_LIMITS.members) return `묶음에는 ${STRUCTURE_LIMITS.members}개까지 넣을 수 있어요.`;
  return { name, hub, members: rest };
}
export async function saveBundle(db: D1Database, user: UserName, id: string | null, bundle: Omit<Bundle, 'id'>): Promise<Bundle | null | string> {
  const now = Date.now();
  if (!id) {
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM minilog_bundles WHERE user = ?').bind(user).first<{ n: number }>())?.n ?? 0;
    if (count >= STRUCTURE_LIMITS.bundles) return `묶음은 ${STRUCTURE_LIMITS.bundles}개까지예요.`;
    const newId = crypto.randomUUID();
    await db.prepare('INSERT INTO minilog_bundles (id, user, name, hub, members, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId, user, bundle.name, bundle.hub, JSON.stringify(bundle.members), now, now).run();
    return { id: newId, ...bundle };
  }
  if (!(await db.prepare('SELECT 1 AS ok FROM minilog_bundles WHERE user = ? AND id = ?').bind(user, id).first())) return null;
  await db.prepare('UPDATE minilog_bundles SET name = ?, hub = ?, members = ?, updated_at = ? WHERE user = ? AND id = ?').bind(bundle.name, bundle.hub, JSON.stringify(bundle.members), now, user, id).run();
  return { id, ...bundle };
}
export async function deleteBundle(db: D1Database, user: UserName, id: string) {
  await db.prepare('DELETE FROM minilog_bundles WHERE user = ? AND id = ?').bind(user, id).run();
}

/** 구조 화면에 쓰는 글 목록: 블로그에서 가져온 글 + 아직 게시하지 않은 원고 */
export async function listItems(db: D1Database, user: UserName): Promise<{ items: Item[]; bodies: Map<string, string> }> {
  const [posts, drafts, places] = await Promise.all([
    db.prepare('SELECT post_key, url, title, published_on, views, tags, draft_id FROM minilog_posts WHERE user = ? ORDER BY published_on DESC LIMIT 500').bind(user)
      .all<{ post_key: string; url: string; title: string; published_on: string | null; views: number | null; tags: string; draft_id: string | null }>(),
    db.prepare('SELECT id, title, body, status, published_url, planned_on, updated_at FROM minilog_drafts WHERE user = ? ORDER BY updated_at DESC LIMIT 300').bind(user)
      .all<{ id: string; title: string; body: string; status: string; published_url: string; planned_on: string | null; updated_at: number }>(),
    db.prepare('SELECT item, category_id FROM minilog_placements WHERE user = ?').bind(user).all<{ item: string; category_id: string }>(),
  ]);
  const placed = new Map(places.results.map(p => [p.item, p.category_id]));
  const linked = new Set(posts.results.map(p => p.draft_id).filter(Boolean));
  const draftById = new Map(drafts.results.map(d => [d.id, d]));
  const bodies = new Map<string, string>();
  const items: Item[] = posts.results.map(p => {
    const key = `post:${p.post_key}`;
    const body = p.draft_id ? draftById.get(p.draft_id)?.body : undefined;
    if (body) bodies.set(key, body);
    return { key, kind: 'post', title: p.title, url: p.url, date: p.published_on, views: p.views, status: 'published', tags: p.tags ? p.tags.split(',').filter(Boolean) : [], category_id: placed.get(key) ?? null, draft_id: p.draft_id };
  });
  for (const d of drafts.results) {
    if (linked.has(d.id)) continue; // 블로그 글과 이어진 원고는 그 글로 센다
    const key = `draft:${d.id}`;
    if (d.body) bodies.set(key, d.body);
    items.push({ key, kind: 'draft', title: d.title.trim() || '제목 없는 원고', url: d.published_url, date: d.planned_on, views: null, status: d.status, tags: [], category_id: placed.get(key) ?? null, draft_id: d.id });
  }
  return { items, bodies };
}

/** 묶음마다: 본문이 있는 글에서 같은 묶음 다른 글(주소가 있는 것)로의 링크가 빠졌는지 */
export function linkGaps(bundles: Bundle[], items: Item[], bodies: Map<string, string>): Record<string, LinkGap[]> {
  const byKey = new Map(items.map(i => [i.key, i]));
  const out: Record<string, LinkGap[]> = {};
  for (const b of bundles) {
    const all = [b.hub, ...b.members];
    out[b.id] = all.filter(k => bodies.has(k)).map(k => {
      const body = bodies.get(k)!;
      const missing = all.filter(o => o !== k).filter(o => { const url = byKey.get(o)?.url; return url && !body.includes(url) && !body.includes(url.replace(/^https?:\/\//, '')); });
      return { item: k, missing };
    });
  }
  return out;
}

/** 글감 추천용: 90일 넘게 새 글이 없거나 비어 있는 카테고리 이름(대분류는 소분류 글까지 센다) */
export async function quietCategories(db: D1Database, user: UserName, today: string): Promise<string[]> {
  const cats = await listCategories(db, user);
  if (!cats.length) return [];
  const { items } = await listItems(db, user);
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) - 90 * 86400000).toISOString().slice(0, 10);
  return cats.filter(c => {
    const ids = [c.id, ...cats.filter(x => x.parent_id === c.id).map(x => x.id)];
    const dates = items.filter(i => i.category_id && ids.includes(i.category_id) && (i.kind === 'post' || i.status === 'published')).map(i => i.date ?? '');
    return !dates.some(d => d >= limit);
  }).map(c => (c.parent_id ? `${cats.find(p => p.id === c.parent_id)?.name ?? ''} › ${c.name}` : c.name)).slice(0, 8);
}
