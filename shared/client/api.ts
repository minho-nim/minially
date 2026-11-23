// 브라우저 쪽 공통 도구(hub·minilog). 외부 패키지 없이 fetch만 쓴다.
// 세션은 HttpOnly 쿠키라 자바스크립트에서 읽지 않는다(키·토큰을 브라우저 저장소에 두지 않음).

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('인터넷 연결을 확인해 주세요.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError((data as { error?: string }).error ?? `요청이 실패했어요(${response.status}).`, response.status, (data as { code?: string }).code);
  return data as T;
}

/** 각 앱 주소. 미니어리 운영 주소는 Windows 앱 동기화 때문에 바꾸지 않는다. */
export const APP_LINKS = {
  hub: 'https://minihub.pages.dev',
  minially: 'https://minially.pages.dev',
  minilog: 'https://mini-log.pages.dev', // minilog.pages.dev는 이미 다른 사람이 써서 mini-log로 만듦
} as const;

export interface UsageRow { app: string; calls: number; errors: number; input_tokens: number; output_tokens: number }

export const APP_LABELS: Record<string, string> = { hub: '미니허브', minially: '미니어리', minilog: '미니로그' };

export const formatNumber = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
