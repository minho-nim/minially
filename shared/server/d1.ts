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

/** hub·minilog가 함께 쓰는 환경 값. 값은 Cloudflare 대시보드(비밀값)에만 둔다. */
export interface HubEnv {
  DB?: D1Database;
  /** "C:<해시>,D:<해시>" — 미니어리 로그인 코드의 SHA-256 해시에 사용자 이름을 붙인 것 */
  USER_CODE_HASHES?: string;
  GEMINI_KEY_C?: string;
  GEMINI_KEY_D?: string;
  /** 기본 Gemini 모델(없으면 DEFAULT_MODEL) */
  GEMINI_MODEL?: string;
  /** 시험용: Gemini 주소를 가짜 서버로 바꿀 때만 쓴다 */
  GEMINI_API_BASE?: string;
  /** Minoffia 통계 API용 토큰 */
  STATS_API_TOKEN?: string;
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
