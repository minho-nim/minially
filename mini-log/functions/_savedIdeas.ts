import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

// 글감 담아 두기(Buffer·Later의 아이디어 보관함처럼): 떠오른 글감을 한 줄로 적어 두고 나중에 원고·한 달 계획으로 쓴다.
// 다른 사이트 주소는 적어 두기만 하고 서버가 열지 않는다.
export const SAVED = { text: 100, memo: 500, url: 500, max: 200 };
export interface SavedIdea { id: string; text: string; memo: string; url: string; created_at: number }

const oneLine = (v: string) => v.replace(/\s+/g, ' ').trim();

/** { text, memo?, url? } 검사 → 값 또는 오류 문구 */
export function readSavedIdea(body: Record<string, unknown> | null): Omit<SavedIdea, 'id' | 'created_at'> | string {
  if (!body) return 'JSON 형식이 아닙니다.';
  const { text, memo = '', url = '' } = body;
  if (typeof text !== 'string' || typeof memo !== 'string' || typeof url !== 'string') return '글감은 글자로만 적을 수 있어요.';
  const t = oneLine(text);
  if (!t) return '글감을 한 줄 적어 주세요.';
  if (t.length > SAVED.text) return `글감은 ${SAVED.text}자까지예요.`;
  const m = memo.replace(/\r\n?/g, '\n').trim();
  if (m.length > SAVED.memo) return `메모는 ${SAVED.memo}자까지예요.`;
  const u = url.trim();
  if (u && (u.length > SAVED.url || !/^https:\/\/[^\s/]+\.[^\s]+$/.test(u))) return '참고 주소는 https://로 시작하는 주소만 적을 수 있어요.';
  return { text: t, memo: m, url: u };
}

export async function listSavedIdeas(db: D1Database, user: UserName) {
  return (await db.prepare('SELECT id, text, memo, url, created_at FROM minilog_saved_ideas WHERE user = ? ORDER BY created_at DESC, id LIMIT ?').bind(user, SAVED.max).all<SavedIdea>()).results;
}

export async function addSavedIdea(db: D1Database, user: UserName, idea: Omit<SavedIdea, 'id' | 'created_at'>, now = Date.now()) {
  const count = (await db.prepare('SELECT COUNT(*) AS n FROM minilog_saved_ideas WHERE user = ?').bind(user).first<{ n: number }>())?.n ?? 0;
  if (count >= SAVED.max) return `글감은 ${SAVED.max}개까지 담아 둘 수 있어요. 쓴 것은 지워 주세요.`;
  await db.prepare('INSERT INTO minilog_saved_ideas (id, user, text, memo, url, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), user, idea.text, idea.memo, idea.url, now).run();
  return null;
}

export async function deleteSavedIdea(db: D1Database, user: UserName, id: string) {
  const found = await db.prepare('SELECT id FROM minilog_saved_ideas WHERE user = ? AND id = ?').bind(user, id).first();
  if (!found) return false;
  await db.prepare('DELETE FROM minilog_saved_ideas WHERE user = ? AND id = ?').bind(user, id).run();
  return true;
}
