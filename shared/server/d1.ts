// Cloudflare D1과 Pages Functions에서 쓰는 최소 타입(외부 패키지 없이).
export interface D1Result<T> { results: T[] }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

/** Cloudflare R2(사진 저장소)의 최소 타입 */
export interface R2ObjectBody { body: ReadableStream; httpMetadata?: { contentType?: string }; size: number }
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

/** hub·minilog가 함께 쓰는 환경 값. 값은 Cloudflare 대시보드(비밀값)에만 둔다. */
export interface HubEnv {
  DB?: D1Database;
  /** "C:<해시>,D:<해시>" — 미니어리 로그인 코드의 SHA-256 해시에 사용자 이름을 붙인 것 */
  USER_CODE_HASHES?: string;
  GEMINI_KEY_C?: string;
  GEMINI_KEY_D?: string;
  /** 기본 Gemini 모델(없으면 DEFAULT_MODEL) */
  GEMINI_MODEL?: string;
  /** 시험용: 네이버 블로그 RSS 주소를 가짜 서버로 바꿀 때만 쓴다(기본 https://rss.blog.naver.com) */
  BLOG_RSS_BASE?: string;
  /** 시험용: Gemini 주소를 가짜 서버로 바꿀 때만 쓴다 */
  GEMINI_API_BASE?: string;
  /** 미니로그 사진 저장소(R2) */
  MINILOG_PHOTOS?: R2Bucket;
  /** Minoffia 통계 API용 토큰 */
  STATS_API_TOKEN?: string;
  /** 네이버 메일 연결: "아이디@naver.com:애플리케이션 비밀번호"(Cloudflare 비밀값에만) */
  NAVER_MAIL_C?: string;
  NAVER_MAIL_D?: string;
  /** Gmail 연결: "주소@gmail.com:앱 비밀번호"(Cloudflare 비밀값에만, 2단계 인증 필요) */
  GMAIL_MAIL_C?: string;
  GMAIL_MAIL_D?: string;
  /** 아침 알림(웹 푸시) VAPID 키: 공개 키(65바이트)·비밀 키(32바이트) base64url. Cloudflare 비밀값에만 */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** 시험용: 이 출처의 푸시 주소를 받는다(운영에는 넣지 않음) */
  PUSH_TEST_ORIGIN?: string;
  /** 메일 자동 받기 예약 작업(GitHub Actions)이 보내는 토큰 */
  MAIL_CRON_TOKEN?: string;
  /** 시험용: 가짜 메일 서버 "127.0.0.1:포트"(IMAP=포트, SMTP=포트+1) */
  MAIL_TEST_SERVER?: string;
  [key: string]: unknown;
}
export interface HubContext { request: Request; env: HubEnv; params?: Record<string, string | string[]> }

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
