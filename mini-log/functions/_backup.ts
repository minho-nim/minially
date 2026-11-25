// mini-log 백업: 원고·협찬·문체·제안서 양식·내 블로그(글·숫자)·참고 블로그·블로그 구조·수익 목표를 JSON 하나로. 사진(30일 보관)·채팅·로그인 정보는 빼고.
// 불러오기는 '합치기': 없는 것은 더하고, 같은 것은 백업 쪽 updated_at이 더 클 때만 바꾼다. 다른 사용자의 id와 겹치면 건너뛴다.
import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';
import { readPatch } from './_drafts';
import { readCampaign } from './_campaigns';
import { cleanProfile, readSamples, STYLE_LIMITS } from './_style';
import { emptyForm, readForm } from './_proposal';
import { parseBlogInput } from './_blog';

export const BACKUP_VERSION = 1;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);
const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export async function exportBackup(db: D1Database, user: UserName) {
  const all = (sql: string) => db.prepare(sql).bind(user).all<Record<string, unknown>>().then(r => r.results);
  const [drafts, campaigns, styles, blogs, posts, watch, proposal, categories, placements, bundles, goal] = await Promise.all([
    all('SELECT id, title, body, hashtags, experience, status, published_url, published_at, style_id, COALESCE(post_type, \'none\') AS post_type, planned_on, created_at, updated_at FROM minilog_drafts WHERE user = ?'),
    all("SELECT id, kind, brand, title, provided, amount, deadline, status, paid_on, draft_id, memo, guide, pitch, COALESCE(source_url, '') AS source_url, apply_by, created_at, updated_at FROM minilog_campaigns WHERE user = ?"),
    all('SELECT id, kind, name, source, samples, profile, analyzed_at, created_at, updated_at FROM minilog_styles WHERE user = ?'),
    all('SELECT blog_id, synced_at, created_at FROM minilog_blogs WHERE user = ?'),
    all('SELECT post_key, blog_id, url, title, published_on, summary, tags, views, likes, comments, stats_on, draft_id, created_at FROM minilog_posts WHERE user = ?'),
    all('SELECT blog_id, titles, synced_at, created_at FROM minilog_watch WHERE user = ?'),
    db.prepare('SELECT form, updated_at FROM minilog_proposals WHERE user = ?').bind(user).first<{ form: string; updated_at: number }>(),
    all('SELECT id, name, parent_id, sort FROM minilog_categories WHERE user = ? ORDER BY sort'),
    all('SELECT item, category_id FROM minilog_placements WHERE user = ?'),
    all('SELECT id, name, hub, members, created_at, updated_at FROM minilog_bundles WHERE user = ?'),
    db.prepare('SELECT monthly FROM minilog_goals WHERE user = ?').bind(user).first<{ monthly: number }>(),
  ]);
  return {
    app: 'mini-log', version: BACKUP_VERSION, exported_at: Date.now(),
    drafts: drafts.map(d => ({ ...d, hashtags: String(d.hashtags || '').split('\n').filter(Boolean) })),
    campaigns: campaigns.map(c => ({ ...c, guide: c.guide ? JSON.parse(String(c.guide)) : null, pitch: c.pitch ? JSON.parse(String(c.pitch)) : null })),
    styles: styles.map(s => ({ ...s, samples: JSON.parse(String(s.samples || '[]')), profile: s.profile ? JSON.parse(String(s.profile)) : null })),
    blogs, posts, watch: watch.map(w => ({ ...w, titles: JSON.parse(String(w.titles || '[]')) })),
    proposal: proposal ? { form: JSON.parse(proposal.form), updated_at: proposal.updated_at } : null,
    // 블로그 구조(카테고리·배치·묶음)와 수익 목표
    structure: { categories, placements, bundles: bundles.map(b => ({ ...b, members: JSON.parse(String(b.members || '[]')) })) },
    goal: goal?.monthly ?? null,
  };
}

type Counts = { added: number; updated: number; kept: number; skipped: number };
const counts = (): Counts => ({ added: 0, updated: 0, kept: 0, skipped: 0 });

/** 백업 합치기. 형식이 틀린 항목은 건너뛴다(전체를 거절하지 않음). */
export async function mergeBackup(db: D1Database, user: UserName, data: Record<string, unknown>) {
  if (data.app !== 'mini-log' || data.version !== BACKUP_VERSION) throw new Error('mini-log 백업 파일이 아니에요.');
  const result = { drafts: counts(), campaigns: counts(), styles: counts(), blogs: counts(), posts: counts(), proposal: counts(), structure: counts() };
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 5000) as Record<string, unknown>[] : []);

  // 원고
  for (const d of list(data.drafts)) {
    const patch = readPatch({ title: d.title, body: d.body, experience: d.experience, hashtags: d.hashtags, status: d.status, published_url: d.published_url || undefined, planned_on: d.planned_on ?? null, style_id: d.style_id, ...(d.post_type ? { post_type: d.post_type } : {}) });
    const created = time(d.created_at), updated = time(d.updated_at);
    if (!uuid(d.id) || typeof patch === 'string' || !created || !updated) { result.drafts.skipped++; continue; }
    const cur = await db.prepare('SELECT user, updated_at FROM minilog_drafts WHERE id = ?').bind(d.id).first<{ user: string; updated_at: number }>();
    if (cur && cur.user !== user) { result.drafts.skipped++; continue; }
    if (cur && cur.updated_at >= updated) { result.drafts.kept++; continue; }
    const row = [patch.title ?? '', patch.body ?? '', (patch.hashtags ?? []).join('\n'), patch.experience ?? '', patch.status ?? 'draft', patch.published_url ?? '', time(d.published_at), patch.style_id ?? 'mine', patch.post_type ?? 'none', patch.planned_on ?? null];
    if (cur) { await db.prepare('UPDATE minilog_drafts SET title = ?, body = ?, hashtags = ?, experience = ?, status = ?, published_url = ?, published_at = ?, style_id = ?, post_type = ?, planned_on = ?, updated_at = ? WHERE id = ? AND user = ?').bind(...row, updated, d.id, user).run(); result.drafts.updated++; }
    else { await db.prepare('INSERT INTO minilog_drafts (id, user, title, body, hashtags, experience, status, published_url, published_at, style_id, post_type, planned_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(d.id, user, ...row, created, updated).run(); result.drafts.added++; }
  }

  // 협찬·수익
  for (const c of list(data.campaigns)) {
    const patch = readCampaign({ kind: c.kind, brand: c.brand, title: c.title, provided: c.provided, amount: c.amount, deadline: c.deadline ?? null, status: c.status, paid_on: c.paid_on ?? null, memo: c.memo, guide: c.guide ?? null, pitch: c.pitch ?? null, source_url: c.source_url ?? '', apply_by: c.apply_by ?? null });
    const created = time(c.created_at), updated = time(c.updated_at);
    if (!uuid(c.id) || typeof patch === 'string' || !created || !updated) { result.campaigns.skipped++; continue; }
    const cur = await db.prepare('SELECT user, updated_at FROM minilog_campaigns WHERE id = ?').bind(c.id).first<{ user: string; updated_at: number }>();
    if (cur && cur.user !== user) { result.campaigns.skipped++; continue; }
    if (cur && cur.updated_at >= updated) { result.campaigns.kept++; continue; }
    const draftId = uuid(c.draft_id) && (await db.prepare('SELECT 1 AS ok FROM minilog_drafts WHERE id = ? AND user = ?').bind(c.draft_id, user).first()) ? c.draft_id : null;
    const row = [patch.kind ?? 'sponsor', patch.brand ?? '', patch.title ?? '', patch.provided ?? '', patch.amount ?? 0, patch.deadline ?? null, patch.status ?? 'proposed', patch.paid_on ?? null, draftId, patch.memo ?? '', patch.guide ? JSON.stringify(patch.guide) : null, patch.pitch ? JSON.stringify(patch.pitch) : null, patch.source_url ?? '', patch.apply_by ?? null];
    if (cur) { await db.prepare('UPDATE minilog_campaigns SET kind = ?, brand = ?, title = ?, provided = ?, amount = ?, deadline = ?, status = ?, paid_on = ?, draft_id = ?, memo = ?, guide = ?, pitch = ?, source_url = ?, apply_by = ?, updated_at = ? WHERE id = ? AND user = ?').bind(...row, updated, c.id, user).run(); result.campaigns.updated++; }
    else { await db.prepare('INSERT INTO minilog_campaigns (id, user, kind, brand, title, provided, amount, deadline, status, paid_on, draft_id, memo, guide, pitch, source_url, apply_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(c.id, user, ...row, created, updated).run(); result.campaigns.added++; }
  }

  // 문체: 내 문체는 사용자당 하나라 id가 달라도 내 문체끼리 합친다
  for (const s of list(data.styles)) {
    const samples = readSamples(s.samples), created = time(s.created_at), updated = time(s.updated_at);
    const kind = s.kind === 'mine' || s.kind === 'reference' ? s.kind : null;
    if (!uuid(s.id) || !kind || typeof samples === 'string' || !created || !updated) { result.styles.skipped++; continue; }
    const profile = s.profile ? cleanProfile(s.profile) : null;
    const cur = kind === 'mine'
      ? await db.prepare("SELECT id, user, updated_at FROM minilog_styles WHERE user = ? AND kind = 'mine'").bind(user).first<{ id: string; user: string; updated_at: number }>()
      : await db.prepare('SELECT id, user, updated_at FROM minilog_styles WHERE id = ?').bind(s.id).first<{ id: string; user: string; updated_at: number }>();
    if (cur && cur.user !== user) { result.styles.skipped++; continue; }
    if (cur && cur.updated_at >= updated) { result.styles.kept++; continue; }
    const row = [str(s.name, STYLE_LIMITS.name), str(s.source, STYLE_LIMITS.source), JSON.stringify(samples), profile ? JSON.stringify(profile) : null, profile ? time(s.analyzed_at) : null];
    if (cur) { await db.prepare('UPDATE minilog_styles SET name = ?, source = ?, samples = ?, profile = ?, analyzed_at = ?, updated_at = ? WHERE id = ? AND user = ?').bind(...row, updated, cur.id, user).run(); result.styles.updated++; }
    else {
      if (kind === 'reference' && ((await db.prepare("SELECT COUNT(*) AS n FROM minilog_styles WHERE user = ? AND kind = 'reference'").bind(user).first<{ n: number }>())?.n ?? 0) >= STYLE_LIMITS.references) { result.styles.skipped++; continue; }
      // 내 문체는 아이디가 다른 사람 것과 겹칠 수 있다(다른 계정 백업) → 새 아이디로
      const styleId = (await db.prepare('SELECT 1 AS ok FROM minilog_styles WHERE id = ?').bind(s.id).first()) ? crypto.randomUUID() : s.id;
      await db.prepare('INSERT INTO minilog_styles (id, user, kind, name, source, samples, profile, analyzed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(styleId, user, kind, ...row, created, updated).run(); result.styles.added++;
    }
  }

  // 내 블로그·글 숫자(블로그는 5개까지), 참고 블로그(10개까지)
  for (const b of list(data.blogs)) {
    const id = parseBlogInput(b.blog_id);
    if (!id) { result.blogs.skipped++; continue; }
    if (await db.prepare('SELECT 1 AS ok FROM minilog_blogs WHERE user = ? AND blog_id = ?').bind(user, id).first()) { result.blogs.kept++; continue; }
    if (((await db.prepare('SELECT COUNT(*) AS n FROM minilog_blogs WHERE user = ?').bind(user).first<{ n: number }>())?.n ?? 0) >= 5) { result.blogs.skipped++; continue; }
    await db.prepare('INSERT INTO minilog_blogs (user, blog_id, synced_at, created_at) VALUES (?, ?, ?, ?)').bind(user, id, time(b.synced_at), time(b.created_at) ?? Date.now()).run(); result.blogs.added++;
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null);
  for (const p of list(data.posts)) {
    const key = str(p.post_key, 300), url = str(p.url, 500);
    if (!key || !/^https:\/\//.test(url)) { result.posts.skipped++; continue; }
    const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const cur = await db.prepare('SELECT stats_on FROM minilog_posts WHERE user = ? AND post_key = ?').bind(user, key).first<{ stats_on: string | null }>();
    if (cur) {
      // 글 목록은 RSS가 다시 채우므로 숫자만: 백업 쪽 숫자가 더 최근이면 바꾼다
      if (day(p.stats_on) && (!cur.stats_on || day(p.stats_on)! > cur.stats_on)) { await db.prepare('UPDATE minilog_posts SET views = ?, likes = ?, comments = ?, stats_on = ? WHERE user = ? AND post_key = ?').bind(num(p.views), num(p.likes), num(p.comments), day(p.stats_on), user, key).run(); result.posts.updated++; }
      else result.posts.kept++;
      continue;
    }
    await db.prepare('INSERT INTO minilog_posts (user, post_key, blog_id, url, title, published_on, summary, tags, views, likes, comments, stats_on, draft_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)')
      .bind(user, key, str(p.blog_id, 80), url, str(p.title, 300), day(p.published_on), str(p.summary, 1000), str(p.tags, 1000), num(p.views), num(p.likes), num(p.comments), day(p.stats_on), time(p.created_at) ?? Date.now()).run();
    result.posts.added++;
  }
  for (const w of list(data.watch)) {
    const id = parseBlogInput(w.blog_id);
    if (!id || await db.prepare('SELECT 1 AS ok FROM minilog_watch WHERE user = ? AND blog_id = ?').bind(user, id).first()) continue;
    if (((await db.prepare('SELECT COUNT(*) AS n FROM minilog_watch WHERE user = ?').bind(user).first<{ n: number }>())?.n ?? 0) >= 10) continue;
    const titles = Array.isArray(w.titles) ? w.titles.filter((t): t is string => typeof t === 'string').map(t => t.slice(0, 300)).slice(0, 15) : [];
    await db.prepare('INSERT INTO minilog_watch (user, blog_id, titles, synced_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(user, id, JSON.stringify(titles), time(w.synced_at), time(w.created_at) ?? Date.now()).run();
  }

  // 제안서 양식(사용자당 하나)
  const prop = data.proposal as { form?: Record<string, unknown>; updated_at?: unknown } | null;
  if (prop && typeof prop === 'object' && prop.form && typeof prop.form === 'object') {
    const form = readForm(prop.form, emptyForm()), updated = time(prop.updated_at);
    const cur = await db.prepare('SELECT updated_at FROM minilog_proposals WHERE user = ?').bind(user).first<{ updated_at: number }>();
    if (typeof form === 'string' || !updated) result.proposal.skipped++;
    else if (cur && cur.updated_at >= updated) result.proposal.kept++;
    else { await db.prepare('INSERT INTO minilog_proposals (user, form, updated_at) VALUES (?, ?, ?) ON CONFLICT(user) DO UPDATE SET form = excluded.form, updated_at = excluded.updated_at').bind(user, JSON.stringify(form), updated).run(); result.proposal[cur ? 'updated' : 'added']++; }
  }
  // 블로그 구조: 없는 카테고리·묶음만 더하고(다른 사용자 아이디와 겹치면 건너뜀), 배치는 비어 있는 글에만
  const st = (data.structure ?? {}) as { categories?: unknown; placements?: unknown; bundles?: unknown };
  const cats = list(st.categories).slice(0, 60);
  const mine = new Set((await db.prepare('SELECT id FROM minilog_categories WHERE user = ?').bind(user).all<{ id: string }>()).results.map(r => r.id));
  // 다른 사용자 아이디와 겹치면 새 아이디로(다른 계정 백업을 합칠 때). 같은 이름·같은 상위의 내 카테고리가 이미 있으면 그걸 쓴다(다시 합쳐도 두 번 생기지 않게)
  const idMap = new Map<string, string>();
  const mapId = (id: unknown) => (uuid(id) ? (mine.has(id) ? id : idMap.get(id) ?? null) : null);
  for (const c of [...cats].sort((x, y) => (x.parent_id ? 1 : 0) - (y.parent_id ? 1 : 0))) {
    const name = str(c.name, 30).trim();
    if (!uuid(c.id) || !name) { result.structure.skipped++; continue; }
    if (mine.has(c.id)) { result.structure.kept++; continue; }
    const parent = mapId(c.parent_id);
    const same = await db.prepare('SELECT id FROM minilog_categories WHERE user = ? AND name = ? AND parent_id IS ?').bind(user, name, parent).first<{ id: string }>();
    if (same) { idMap.set(c.id, same.id); result.structure.kept++; continue; }
    const id = (await db.prepare('SELECT 1 AS ok FROM minilog_categories WHERE id = ?').bind(c.id).first()) ? crypto.randomUUID() : c.id;
    idMap.set(c.id, id);
    await db.prepare('INSERT INTO minilog_categories (id, user, name, parent_id, sort, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, user, name, parent, Number(c.sort) || 0, Date.now()).run();
    result.structure.added++;
  }
  const owned = new Set((await db.prepare('SELECT id FROM minilog_categories WHERE user = ?').bind(user).all<{ id: string }>()).results.map(r => r.id));
  for (const p of list(st.placements).slice(0, 2000)) {
    const item = str(p.item, 320), cat = mapId(p.category_id);
    if (!/^(post:\S{1,300}|draft:[0-9a-f-]{36})$/.test(item) || !cat || !owned.has(cat)) continue;
    await db.prepare('INSERT INTO minilog_placements (user, item, category_id) VALUES (?, ?, ?) ON CONFLICT(user, item) DO NOTHING').bind(user, item, cat).run();
  }
  for (const b of list(st.bundles).slice(0, 50)) {
    const name = str(b.name, 40).trim(), hub = str(b.hub, 320);
    const members = Array.isArray(b.members) ? b.members.filter((m): m is string => typeof m === 'string').slice(0, 20) : [];
    if (!uuid(b.id) || !name || !hub || !members.length) { result.structure.skipped++; continue; }
    const cur = await db.prepare('SELECT user FROM minilog_bundles WHERE id = ?').bind(b.id).first<{ user: string }>();
    if (cur?.user === user || await db.prepare('SELECT 1 AS ok FROM minilog_bundles WHERE user = ? AND name = ?').bind(user, name).first()) { result.structure.kept++; continue; }
    await db.prepare('INSERT INTO minilog_bundles (id, user, name, hub, members, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(cur ? crypto.randomUUID() : b.id, user, name, hub, JSON.stringify(members), time(b.created_at) ?? Date.now(), time(b.updated_at) ?? Date.now()).run();
    result.structure.added++;
  }
  // 수익 목표: 지금 없을 때만
  const goal = Number(data.goal);
  if (Number.isSafeInteger(goal) && goal >= 1000 && !(await db.prepare('SELECT 1 AS ok FROM minilog_goals WHERE user = ?').bind(user).first())) {
    await db.prepare('INSERT INTO minilog_goals (user, monthly, updated_at) VALUES (?, ?, ?)').bind(user, goal, Date.now()).run();
  }
  return result;
}
