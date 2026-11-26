import type { D1Database } from './d1';

// 미니어리 표(sync_*)와 같은 D1을 쓰므로 이름 앞에 hub_·ai_·minilog_를 붙여 겹치지 않게 한다.
// 기존 표는 건드리지 않는다(만들기만 하고 지우거나 바꾸지 않음).
// 표 만들기는 DB(바인딩)마다 한 번만. 같은 Worker 안에서 다른 DB가 오면 그 DB도 확인한다.
// 바인딩 객체가 요청마다 새로 와도 hub_schema_meta의 지문이 같으면 읽기 한 번으로 끝난다.
const ready = new WeakSet<object>();

const SAFE_NAME = /^[a-z_]+$/;
/** 칸이 없을 때만 ALTER TABLE ADD COLUMN(이름은 이 파일의 상수만 받는다) */
async function ensureColumn(db: D1Database, table: string, column: string, type: string) {
  if (!SAFE_NAME.test(table) || !SAFE_NAME.test(column) || !/^[A-Z ]+$/.test(type)) throw new Error('bad schema name');
  const columns = (await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()).results;
  if (!columns.some(c => c.name === column)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
}

// 표·색인 만들기(CREATE ... IF NOT EXISTS). 문장을 바꾸면 SCHEMA_VERSION이 저절로 바뀌어 다음 요청 때 다시 확인한다.
const TABLES = [
  // 서버 세션: 토큰 원문 대신 해시만 저장. app은 세션을 만든 앱(다른 앱에서는 못 씀).
  'CREATE TABLE IF NOT EXISTS hub_sessions (token_hash TEXT PRIMARY KEY, user TEXT NOT NULL, app TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS hub_sessions_user ON hub_sessions (user)',
  // 틀린 코드 시도 횟수(IP별, 10분 창)
  'CREATE TABLE IF NOT EXISTS hub_attempts (ip TEXT PRIMARY KEY, window_start INTEGER NOT NULL, failures INTEGER NOT NULL)',
  // AI 호출 기록: 키·입력·출력 원문은 남기지 않고 숫자와 오류 종류만.
  'CREATE TABLE IF NOT EXISTS ai_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT NOT NULL, app TEXT NOT NULL, model TEXT NOT NULL, task TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_code TEXT, created_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS ai_usage_user_time ON ai_usage (user, created_at)',
  // 미니로그 원고
  // 주의: 운영 DB에 표가 생긴 뒤에는 이 CREATE 문을 고쳐도 기존 표에 칸이 생기지 않는다. 칸을 늘릴 때는 ALTER TABLE을 따로 넣는다.
  "CREATE TABLE IF NOT EXISTS minilog_drafts (id TEXT PRIMARY KEY, user TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', hashtags TEXT NOT NULL DEFAULT '', experience TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', published_url TEXT NOT NULL DEFAULT '', published_at INTEGER, style_id TEXT NOT NULL DEFAULT 'mine', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
  'CREATE INDEX IF NOT EXISTS minilog_drafts_user ON minilog_drafts (user, updated_at)',
  // 미니로그 사진: 파일은 R2(키 = 사용자/원고/사진id), 여기에는 정보만. expires_at이 지나면 지운다(게시 후 30일).
  'CREATE TABLE IF NOT EXISTS minilog_photos (id TEXT PRIMARY KEY, user TEXT NOT NULL, draft_id TEXT NOT NULL, r2_key TEXT NOT NULL, name TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, position INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER)',
  'CREATE INDEX IF NOT EXISTS minilog_photos_draft ON minilog_photos (user, draft_id, position)',
  'CREATE INDEX IF NOT EXISTS minilog_photos_expiry ON minilog_photos (user, expires_at)',
  // 문체: kind='mine'(내 문체, 사용자당 1개) 또는 'reference'(참고 블로거, 여러 개). samples = 붙여 넣은 글(JSON 배열), profile = AI 요약(JSON)
  "CREATE TABLE IF NOT EXISTS minilog_styles (id TEXT PRIMARY KEY, user TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', samples TEXT NOT NULL DEFAULT '[]', profile TEXT, analyzed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
  'CREATE INDEX IF NOT EXISTS minilog_styles_user ON minilog_styles (user, kind, created_at)',
  // 협찬·광고 캠페인과 수익. 계약 정보라 본인만 보고, 통합 대시보드·통계 API에는 내보내지 않는다.
  "CREATE TABLE IF NOT EXISTS minilog_campaigns (id TEXT PRIMARY KEY, user TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'sponsor', brand TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', provided TEXT NOT NULL DEFAULT '', amount INTEGER NOT NULL DEFAULT 0, deadline TEXT, status TEXT NOT NULL DEFAULT 'proposed', paid_on TEXT, draft_id TEXT, memo TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
  'CREATE INDEX IF NOT EXISTS minilog_campaigns_user ON minilog_campaigns (user, status, deadline)',
  // 내 네이버 블로그(사용자당 여러 개): 아이디와 RSS로 가져온 글(조회수·공감·댓글은 사용자가 캡처나 손으로 기록)
  'CREATE TABLE IF NOT EXISTS minilog_blogs (user TEXT NOT NULL, blog_id TEXT NOT NULL, synced_at INTEGER, created_at INTEGER NOT NULL, PRIMARY KEY (user, blog_id))',
  "CREATE TABLE IF NOT EXISTS minilog_posts (user TEXT NOT NULL, post_key TEXT NOT NULL, blog_id TEXT NOT NULL DEFAULT '', url TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', published_on TEXT, summary TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '', views INTEGER, likes INTEGER, comments INTEGER, stats_on TEXT, draft_id TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (user, post_key))",
  // 사용자 설정(보여 줄 이름·화면 테마). 두 앱이 함께 쓴다.
  'CREATE TABLE IF NOT EXISTS hub_profiles (user TEXT PRIMARY KEY, name TEXT NOT NULL, theme TEXT NOT NULL DEFAULT \'auto\', updated_at INTEGER NOT NULL)',
  // 협찬 제안서 기본 양식(사용자당 1개)
  'CREATE TABLE IF NOT EXISTS minilog_proposals (user TEXT PRIMARY KEY, form TEXT NOT NULL, updated_at INTEGER NOT NULL)',
  // 글감: 참고 블로그(사용자별, 최근 글 제목만), 마지막 추천 결과
  "CREATE TABLE IF NOT EXISTS minilog_watch (user TEXT NOT NULL, blog_id TEXT NOT NULL, titles TEXT NOT NULL DEFAULT '[]', synced_at INTEGER, created_at INTEGER NOT NULL, PRIMARY KEY (user, blog_id))",
  // 달력 구독 주소: 주소에 든 비밀값은 해시만 저장(사람마다 하나, 다시 만들면 이전 주소는 끊김)
  'CREATE TABLE IF NOT EXISTS minilog_ics (user TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS minilog_goals (user TEXT PRIMARY KEY, monthly INTEGER NOT NULL, updated_at INTEGER NOT NULL)', // 한 달 수익 목표(원)
  // 블로그 구조: 카테고리(2단까지), 글 배치(item = 'post:<글키>' 또는 'draft:<원고id>'), 주제 묶음(대표 글 + 세부 글)
  'CREATE TABLE IF NOT EXISTS minilog_categories (id TEXT PRIMARY KEY, user TEXT NOT NULL, name TEXT NOT NULL, parent_id TEXT, sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS minilog_placements (user TEXT NOT NULL, item TEXT NOT NULL, category_id TEXT NOT NULL, PRIMARY KEY (user, item))',
  'CREATE TABLE IF NOT EXISTS minilog_bundles (id TEXT PRIMARY KEY, user TEXT NOT NULL, name TEXT NOT NULL, hub TEXT NOT NULL, members TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS minilog_ideas (user TEXT PRIMARY KEY, ideas TEXT NOT NULL, used_search INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)',
  // 다른 곳에도 올리기: 사람이 '올렸어요'로 체크한 곳(instagram·threads·x)과 시각. 앱이 대신 올리지 않으므로 기록만 한다
  'CREATE TABLE IF NOT EXISTS minilog_shares (user TEXT NOT NULL, draft_id TEXT NOT NULL, channel TEXT NOT NULL, shared_at INTEGER NOT NULL, PRIMARY KEY (user, draft_id, channel))',
  // 게시 시간표: 글을 올리는 요일(0=일~6=토, JSON 배열). 원고를 빈 게시일에 나눠 넣을 때만 쓰고 자동 게시는 하지 않는다
  'CREATE TABLE IF NOT EXISTS minilog_rhythm (user TEXT PRIMARY KEY, days TEXT NOT NULL, updated_at INTEGER NOT NULL)',
  // 계정 정보: 사람이 적은 공개 SNS 아이디만(비밀번호·토큰은 저장하지 않음)
  'CREATE TABLE IF NOT EXISTS minilog_accounts (user TEXT NOT NULL, platform TEXT NOT NULL, handle TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user, platform))',
  // 받은 메일(네이버 메일 연결): 보낸 사람·제목·본문 앞부분(4,000자)과 AI 분류·답장 초안. 90일 지나면 지운다. 계정 비밀번호는 여기에 없다
  "CREATE TABLE IF NOT EXISTS minilog_mails (id TEXT PRIMARY KEY, user TEXT NOT NULL, uid INTEGER NOT NULL, message_id TEXT NOT NULL DEFAULT '', refs TEXT NOT NULL DEFAULT '', from_name TEXT NOT NULL DEFAULT '', from_addr TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', received_at INTEGER NOT NULL, snippet TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'unknown', brand TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', deadline TEXT, needs_reply INTEGER NOT NULL DEFAULT 0, reply_subject TEXT NOT NULL DEFAULT '', reply_body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', campaign_id TEXT, sent_at INTEGER, created_at INTEGER NOT NULL)",
  'CREATE UNIQUE INDEX IF NOT EXISTS minilog_mails_uid ON minilog_mails (user, uid)',
  // 메일 받기 상태: 마지막으로 읽은 UID, 동시에 두 번 돌지 않게 잡는 잠금 시각, 마지막 오류
  'CREATE TABLE IF NOT EXISTS minilog_mail_state (user TEXT PRIMARY KEY, uid_validity INTEGER NOT NULL DEFAULT 0, last_uid INTEGER NOT NULL DEFAULT 0, synced_at INTEGER, lock_until INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT \'\')',
  // 글감 담아 두기: 떠오른 글감 한 줄(100자)·메모(500자)·참고 주소(https)만. 한 사람 200개까지
  "CREATE TABLE IF NOT EXISTS minilog_saved_ideas (id TEXT PRIMARY KEY, user TEXT NOT NULL, text TEXT NOT NULL, memo TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)",
  'CREATE INDEX IF NOT EXISTS minilog_saved_ideas_user ON minilog_saved_ideas (user, created_at)',
  // 해시태그 묶음: 자주 쓰는 태그 모음(이름 20자, 태그 30개). 한 사람 20묶음까지
  "CREATE TABLE IF NOT EXISTS minilog_tag_sets (id TEXT PRIMARY KEY, user TEXT NOT NULL, name TEXT NOT NULL, tags TEXT NOT NULL, created_at INTEGER NOT NULL)",
  // 글쓰기 설정(계정 기반): 원고 글 구조(기본·홈피드형). 자주 쓴 글 종류는 따로 저장하지 않고 원고에서 센다
  "CREATE TABLE IF NOT EXISTS minilog_prefs (user TEXT PRIMARY KEY, structure TEXT NOT NULL DEFAULT 'basic', updated_at INTEGER NOT NULL)",
  // 게시 7일 뒤 돌아보기: 사람이 고른 평가(good·ok·low)와 메모(300자), 그때 조회수
  "CREATE TABLE IF NOT EXISTS minilog_reviews (user TEXT NOT NULL, draft_id TEXT NOT NULL, verdict TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', views INTEGER, created_at INTEGER NOT NULL, PRIMARY KEY (user, draft_id))",
];
// 이미 만들어진 표에 나중에 더한 칸(운영 DB는 CREATE 문을 고쳐도 칸이 생기지 않는다). 있으면 건너뛴다.
const COLUMNS: [table: string, column: string, type: string][] = [
  ['minilog_drafts', 'planned_on', 'TEXT'], // 게시 예정일 YYYY-MM-DD
  ['minilog_drafts', 'post_type', 'TEXT'], // 글 종류(맛집·제품 등, mini-log/functions/_postTypes.ts)
  ['minilog_campaigns', 'guide', 'TEXT'], // 체험단 가이드 정리(JSON: 필수 키워드·사진 수·방문일 등)
  ['minilog_campaigns', 'pitch', 'TEXT'], // 먼저 제안한 기록(JSON: 보낸 날·메일/DM·답장)
  ['minilog_photos', 'note', 'TEXT'], // 사진마다 적는 실제 경험 메모(AI 초안 재료)
  ['minilog_campaigns', 'source_url', 'TEXT'], // 체험단 모집 공고 주소(직접 붙여 넣음, https만)
  ['minilog_campaigns', 'apply_by', 'TEXT'], // 신청 마감일 YYYY-MM-DD
  ['minilog_drafts', 'ai_body', 'TEXT'], // AI가 마지막으로 쓴 본문 원문('더 내 스타일로'에서 사람이 고친 최종본과 비교)
  ['minilog_mails', 'body_html', 'TEXT'], // 받은 메일 HTML 원문(300KB까지, 화면이 허용한 모양으로만 다시 그림)
  ['minilog_mails', 'reply_doc', 'TEXT'], // 서식 있는 답장(JSON 문서, _mailDoc.ts)
  ['minilog_mails', 'to_addr', 'TEXT'], // 내가 새로 쓴 메일의 받는 사람
];

/** 표 정의 전체의 지문(FNV-1a). 두 앱(hub·mini-log)이 같은 코드를 쓰므로 같은 값이 나온다 */
export const SCHEMA_VERSION = (() => {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify([TABLES, COLUMNS])) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
})();

export async function ensureHubSchema(db: D1Database) {
  if (ready.has(db)) return;
  // 이미 지금 구조로 만들어진 DB면 읽기 한 번으로 끝낸다(요청마다 바인딩 객체가 새로 와도 CREATE·PRAGMA를 다시 돌지 않게).
  const done = await db.prepare('SELECT version FROM hub_schema_meta WHERE id = 1').first<{ version: string }>().catch(() => null);
  if (done?.version === SCHEMA_VERSION) { ready.add(db); return; }
  await db.batch(TABLES.map(sql => db.prepare(sql)));
  for (const [table, column, type] of COLUMNS) await ensureColumn(db, table, column, type);
  await db.prepare('CREATE TABLE IF NOT EXISTS hub_schema_meta (id INTEGER PRIMARY KEY CHECK (id = 1), version TEXT NOT NULL)').run();
  await db.prepare('INSERT INTO hub_schema_meta (id, version) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET version = excluded.version').bind(SCHEMA_VERSION).run();
  ready.add(db);
}
