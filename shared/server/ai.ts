import type { D1Database, HubEnv } from './d1';
import type { AppName, UserName } from './auth';

// Gemini 호출은 서버에서만 한다. 키는 Cloudflare 비밀값 GEMINI_KEY_C·GEMINI_KEY_D에만 있고
// 브라우저·로그·D1에는 남기지 않는다. 사용자는 자기 키만 쓴다(세션의 user로 고름).
// shortcut: 기본 모델 이름은 Google이 자주 바꾼다. 안 맞으면 GEMINI_MODEL 비밀값으로 바꾼다.
export const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com';
const TIMEOUT_MS = 60000;
const RETRIES = [1000, 2500]; // 다시 부르기 전 기다리는 시간(ms)

export type AiErrorCode = 'no_key' | 'invalid_key' | 'rate_limited' | 'quota_exceeded' | 'blocked' | 'bad_response' | 'upstream_error' | 'overloaded' | 'bad_request' | 'timeout';

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  no_key: 'Gemini 키가 아직 연결되지 않았어요. 소유자에게 키 등록을 요청하세요.',
  invalid_key: 'Gemini 키가 맞지 않거나 사용이 막혀 있어요. 키를 확인해 주세요.',
  rate_limited: 'Gemini 호출이 잠시 너무 많아요. 1분쯤 뒤에 다시 시도해 주세요.',
  quota_exceeded: '오늘 Gemini 사용 한도를 넘었어요. 내일 다시 시도하거나 한도를 확인해 주세요.',
  blocked: 'Gemini가 이 요청에 답하지 않았어요(안전 정책). 내용을 바꿔 다시 시도해 주세요.',
  bad_response: 'Gemini 답을 읽지 못했어요. 다시 시도해 주세요.',
  upstream_error: 'Gemini 서버에 문제가 있어요. 잠시 뒤에 다시 시도해 주세요.',
  overloaded: 'Gemini 서버가 지금 붐벼요(구글 쪽 과부하). 1~2분 뒤에 다시 시도해 주세요.',
  bad_request: 'Gemini가 요청을 받지 않았어요. 같은 일이 계속되면 소유자에게 알려 주세요.',
  timeout: 'Gemini 답이 너무 늦어요. 다시 시도해 주세요.',
};

export class AiError extends Error {
  constructor(public code: AiErrorCode, public status = 502) { super(AI_ERROR_MESSAGES[code]); }
}

export function geminiKey(env: HubEnv, user: UserName): string | null {
  const key = env[`GEMINI_KEY_${user}`];
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

export interface GeminiRequest {
  env: HubEnv;
  db: D1Database;
  user: UserName;
  app: AppName | 'minially';
  /** 작업 이름(예: draft) — 통계용 */
  task: string;
  prompt: string;
  /** 함께 보낼 사진(base64). 사진 분석에 쓴다. */
  images?: { mimeType: string; data: string }[];
  json?: boolean;
  /** 구글 검색 연결(최신 정보). 켜면 JSON 모드는 쓸 수 없어 답 글에서 JSON을 꺼내 쓴다. */
  search?: boolean;
  model?: string;
}

export interface GeminiResult { text: string; model: string; inputTokens: number; outputTokens: number }

async function record(db: D1Database, r: { user: string; app: string; model: string; task: string; input: number; output: number; status: 'ok' | 'error'; error?: string }) {
  await db.prepare('INSERT INTO ai_usage (user, app, model, task, input_tokens, output_tokens, status, error_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(r.user, r.app, r.model, r.task, r.input, r.output, r.status, r.error ?? null, Date.now()).run();
}

function classify(status: number, text: string): AiErrorCode {
  if (status === 429) return /quota|exceeded|limit: 0|per day/i.test(text) && !/per minute/i.test(text) ? 'quota_exceeded' : 'rate_limited';
  if (status === 400 && /api key/i.test(text)) return 'invalid_key';
  if (status === 401 || status === 403) return 'invalid_key';
  if (status === 503 || /overloaded|UNAVAILABLE/i.test(text)) return 'overloaded';
  if (status === 400 || status === 404) return 'bad_request';
  return 'upstream_error';
}

/**
 * 구글이 모델을 내렸거나(404) 새 키에 열어 주지 않을 때(2.5 모델은 예전에 쓴 사람만) 한 번 바꿔 부를 모델.
 * 구글 공식 안내(Gemini deprecations, 2026-11)의 권장 대체 모델. 지금 잘 되는 키는 원래 모델을 그대로 쓴다.
 */
export const MODEL_FALLBACK: Record<string, string> = {
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-3.8-flash',
};
const modelGone = (status: number, text: string) => status === 404 && /model|NOT_FOUND|no longer available/i.test(text);

/** Gemini를 부르고 결과와 관계없이 ai_usage에 한 줄 남긴다. 실패하면 AiError를 던진다. 모델이 없어졌으면 권장 대체 모델로 한 번 더 */
export async function callGemini(req: GeminiRequest): Promise<GeminiResult> {
  const first = req.model || (typeof req.env.GEMINI_MODEL === 'string' && req.env.GEMINI_MODEL) || DEFAULT_MODEL;
  try { return await callModel(req, first); }
  catch (error) {
    const next = MODEL_FALLBACK[first];
    if (error instanceof ModelGone && next) { console.error(`gemini ${req.app}/${req.task} 모델 ${first} 사용 불가 → ${next}로 다시`); return callModel(req, next); }
    if (error instanceof ModelGone) throw error.ai;
    throw error;
  }
}
class ModelGone extends Error { constructor(public ai: AiError) { super(ai.message); } }

async function callModel(req: GeminiRequest, model: string): Promise<GeminiResult> {
  const base = (typeof req.env.GEMINI_API_BASE === 'string' && req.env.GEMINI_API_BASE) || DEFAULT_BASE;
  const fail = async (code: AiErrorCode, status = 502): Promise<never> => {
    await record(req.db, { user: req.user, app: req.app, model, task: req.task, input: 0, output: 0, status: 'error', error: code });
    throw new AiError(code, status);
  };
  const key = geminiKey(req.env, req.user);
  if (!key) return fail('no_key', 409);

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [...(req.images ?? []).map(image => ({ inline_data: { mime_type: image.mimeType, data: image.data } })), { text: req.prompt }] }],
    ...(req.search ? { tools: [{ google_search: {} }] } : req.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  });
  // 구글 서버가 잠깐 붐비거나(503) 끊기면 조금 기다렸다가 두 번까지 다시 부른다. 키 오류·한도·형식 오류는 다시 부르지 않는다.
  const started = Date.now();
  let response: Response | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body,
        signal: AbortSignal.timeout(Math.max(5000, TIMEOUT_MS - (Date.now() - started))),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') return fail('timeout');
      response = null;
    }
    const retryable = !response || response.status >= 500;
    if (!retryable || attempt >= RETRIES.length || Date.now() - started > TIMEOUT_MS / 2) break;
    await response?.body?.cancel().catch(() => {});
    await new Promise(resolve => setTimeout(resolve, RETRIES[attempt]));
  }
  if (!response) return fail('upstream_error');
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const code = classify(response.status, detail);
    // 원인 확인용(키는 요청 머리에만 있고 응답에는 없다): Cloudflare 로그에 상태와 구글 메시지 앞부분만
    console.error(`gemini ${req.app}/${req.task} ${model} ${response.status} ${code}: ${detail.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[키 가림]').replace(/\s+/g, ' ').slice(0, 300)}`);
    if (modelGone(response.status, detail)) {
      await record(req.db, { user: req.user, app: req.app, model, task: req.task, input: 0, output: 0, status: 'error', error: 'model_gone' });
      throw new ModelGone(new AiError('bad_request', 502));
    }
    return fail(code, code === 'rate_limited' || code === 'quota_exceeded' ? 429 : code === 'overloaded' ? 503 : 502);
  }
  let data: { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string }; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
  try { data = await response.json(); } catch { return fail('bad_response'); }
  const input = data.usageMetadata?.promptTokenCount ?? 0;
  const output = data.usageMetadata?.candidatesTokenCount ?? 0;
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (data.promptFeedback?.blockReason || (!text && data.candidates?.[0]?.finishReason === 'SAFETY')) {
    await record(req.db, { user: req.user, app: req.app, model, task: req.task, input, output, status: 'error', error: 'blocked' });
    throw new AiError('blocked', 422);
  }
  if (!text) {
    await record(req.db, { user: req.user, app: req.app, model, task: req.task, input, output, status: 'error', error: 'bad_response' });
    throw new AiError('bad_response');
  }
  await record(req.db, { user: req.user, app: req.app, model, task: req.task, input, output, status: 'ok' });
  return { text, model, inputTokens: input, outputTokens: output };
}
