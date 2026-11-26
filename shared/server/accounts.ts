// 계정 정보(미니로그 내 계정 · 미니허브 두 사람): 연결한 블로그, 사람이 적은 공개 SNS 아이디, 제안서 연락 이메일.
// 비밀번호·로그인 쿠키·API 토큰은 저장하지 않는다. 숫자·공개 아이디만 다룬다.
import type { D1Database } from './d1';
import type { UserName } from './auth';

export const HANDLE_PLATFORMS = {
  instagram: { label: '인스타그램', re: /^[A-Za-z0-9._]{1,30}$/, url: (h: string) => `https://www.instagram.com/${h}/` },
  threads: { label: '스레드', re: /^[A-Za-z0-9._]{1,30}$/, url: (h: string) => `https://www.threads.net/@${h}` },
  x: { label: 'X', re: /^[A-Za-z0-9_]{1,15}$/, url: (h: string) => `https://x.com/${h}` },
  youtube: { label: '유튜브', re: /^[A-Za-z0-9._-]{3,30}$/, url: (h: string) => `https://www.youtube.com/@${h}` },
} as const;
export type HandlePlatform = keyof typeof HANDLE_PLATFORMS;
export const isHandlePlatform = (v: unknown): v is HandlePlatform => typeof v === 'string' && v in HANDLE_PLATFORMS;

/** '@name', 'name', 프로필 주소를 아이디로. 빈 값이면 ''(지우기), 형식이 틀리면 null */
export function readHandle(platform: HandlePlatform, raw: unknown): string | null {
  if (raw === null || raw === undefined) return '';
  if (typeof raw !== 'string') return null;
  const value = raw.trim()
    .replace(/^https?:\/\/(www\.|m\.)?(instagram\.com|threads\.net|threads\.com|x\.com|twitter\.com|youtube\.com)\//i, '')
    .replace(/[/?#].*$/, '').replace(/^@/, '');
  if (!value) return '';
  return HANDLE_PLATFORMS[platform].re.test(value) ? value : null;
}

const blogUrl = (id: string) => (id.startsWith('tistory:') ? `https://${id.slice(8)}.tistory.com` : `https://blog.naver.com/${id}`);

export async function accountSummary(db: D1Database, user: UserName) {
  const blogs = (await db.prepare('SELECT b.blog_id, b.synced_at, (SELECT COUNT(*) FROM minilog_posts p WHERE p.user = b.user AND p.blog_id = b.blog_id) AS post_count FROM minilog_blogs b WHERE b.user = ? ORDER BY b.created_at')
    .bind(user).all<{ blog_id: string; synced_at: number | null; post_count: number }>()).results
    .map(b => ({ ...b, platform: b.blog_id.startsWith('tistory:') ? '티스토리' : '네이버', name: b.blog_id.replace(/^tistory:/, ''), url: blogUrl(b.blog_id) }));
  const rows = (await db.prepare('SELECT platform, handle FROM minilog_accounts WHERE user = ? ORDER BY platform').bind(user).all<{ platform: string; handle: string }>()).results;
  const handles = rows.filter(r => isHandlePlatform(r.platform))
    .map(r => ({ platform: r.platform as HandlePlatform, label: HANDLE_PLATFORMS[r.platform as HandlePlatform].label, handle: r.handle, url: HANDLE_PLATFORMS[r.platform as HandlePlatform].url(r.handle) }));
  const form = await db.prepare('SELECT form FROM minilog_proposals WHERE user = ?').bind(user).first<{ form: string }>();
  let contactEmail = '';
  try { contactEmail = form ? String(JSON.parse(form.form).contact_email ?? '') : ''; } catch { /* 양식이 깨졌으면 비워 둔다 */ }
  return { user, blogs, handles, contact_email: contactEmail };
}

export async function setHandle(db: D1Database, user: UserName, platform: HandlePlatform, handle: string) {
  if (!handle) await db.prepare('DELETE FROM minilog_accounts WHERE user = ? AND platform = ?').bind(user, platform).run();
  else await db.prepare('INSERT INTO minilog_accounts (user, platform, handle, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user, platform) DO UPDATE SET handle = excluded.handle, updated_at = excluded.updated_at')
    .bind(user, platform, handle, Date.now()).run();
}
