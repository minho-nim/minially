import type { D1Database } from './d1';

// 미니어리 표(sync_*)와 같은 D1을 쓰므로 이름 앞에 hub_·ai_·minilog_를 붙여 겹치지 않게 한다.
// 기존 표는 건드리지 않는다(만들기만 하고 지우거나 바꾸지 않음).
let ready = false;
export async function ensureHubSchema(db: D1Database) {
  if (ready) return;
  await db.batch([
    // 서버 세션: 토큰 원문 대신 해시만 저장. app은 세션을 만든 앱(다른 앱에서는 못 씀).
    db.prepare('CREATE TABLE IF NOT EXISTS hub_sessions (token_hash TEXT PRIMARY KEY, user TEXT NOT NULL, app TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS hub_sessions_user ON hub_sessions (user)'),
    // 틀린 코드 시도 횟수(IP별, 10분 창)
    db.prepare('CREATE TABLE IF NOT EXISTS hub_attempts (ip TEXT PRIMARY KEY, window_start INTEGER NOT NULL, failures INTEGER NOT NULL)'),
    // AI 호출 기록: 키·입력·출력 원문은 남기지 않고 숫자와 오류 종류만.
    db.prepare('CREATE TABLE IF NOT EXISTS ai_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT NOT NULL, app TEXT NOT NULL, model TEXT NOT NULL, task TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_code TEXT, created_at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS ai_usage_user_time ON ai_usage (user, created_at)'),
    // 미니로그 원고
    // 주의: 운영 DB에 표가 생긴 뒤에는 이 CREATE 문을 고쳐도 기존 표에 칸이 생기지 않는다. 칸을 늘릴 때는 ALTER TABLE을 따로 넣는다.
    db.prepare("CREATE TABLE IF NOT EXISTS minilog_drafts (id TEXT PRIMARY KEY, user TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', hashtags TEXT NOT NULL DEFAULT '', experience TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', published_url TEXT NOT NULL DEFAULT '', published_at INTEGER, style_id TEXT NOT NULL DEFAULT 'mine', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare('CREATE INDEX IF NOT EXISTS minilog_drafts_user ON minilog_drafts (user, updated_at)'),
    // 미니로그 사진: 파일은 R2(키 = 사용자/원고/사진id), 여기에는 정보만. expires_at이 지나면 지운다(게시 후 30일).
    db.prepare('CREATE TABLE IF NOT EXISTS minilog_photos (id TEXT PRIMARY KEY, user TEXT NOT NULL, draft_id TEXT NOT NULL, r2_key TEXT NOT NULL, name TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, position INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER)'),
    db.prepare('CREATE INDEX IF NOT EXISTS minilog_photos_draft ON minilog_photos (user, draft_id, position)'),
    db.prepare('CREATE INDEX IF NOT EXISTS minilog_photos_expiry ON minilog_photos (user, expires_at)'),
    // 문체: kind='mine'(내 문체, 사용자당 1개) 또는 'reference'(참고 블로거, 여러 개). samples = 붙여 넣은 글(JSON 배열), profile = AI 요약(JSON)
    db.prepare("CREATE TABLE IF NOT EXISTS minilog_styles (id TEXT PRIMARY KEY, user TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', samples TEXT NOT NULL DEFAULT '[]', profile TEXT, analyzed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare('CREATE INDEX IF NOT EXISTS minilog_styles_user ON minilog_styles (user, kind, created_at)'),
  ]);
  ready = true;
}
