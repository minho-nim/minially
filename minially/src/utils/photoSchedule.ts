// 사진으로 일정 넣기(클라이언트): 사진을 긴 변 2048px JPEG로 줄이고 대비를 살짝 올려(작은 글자도 읽히게)(위치·촬영 정보도 빠짐) 서버에 보내고, 일정 후보를 받는다.
// 저장은 하지 않는다. 사람이 고른 후보만 App이 일정으로 저장한다.
import { syncEngine } from '../sync/syncEngine';
import type { Schedule } from '../types';

/** 글에서 찾은 반복(매주 화·목, 격주, 매일, 매달 5일). label은 화면에 보여 줄 말 */
export interface PhotoRepeat { frequency: 'daily' | 'weekly' | 'monthly'; interval: number; weekdays?: number[]; label: string }
/** until: 여러 날 일정의 마지막 날(YYYY-MM-DD, 없으면 하루짜리). repeat: 반복 일정이면 규칙(date는 첫 날). guessed: 오전·오후를 짐작한 시간 */
export interface PhotoEvent { title: string; date: string; start: string | null; end: string | null; location: string; memo: string; source: string; uncertain: boolean; until?: string; repeat?: PhotoRepeat; guessed?: boolean }

const MAX_SIDE = 2048;
const MAX_DATA_URL = 4_000_000;

export async function shrinkForReading(file: Blob): Promise<string> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('이 사진 형식은 열 수 없어요(HEIC는 JPG로 바꿔 넣어 주세요).'); }
  for (const side of [MAX_SIDE, 1600, 1280]) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
    ctx.filter = 'contrast(1.12)'; // 흐린 캡처·어두운 사진의 글자를 조금 또렷하게(색은 그대로, 지원하지 않는 브라우저는 그냥 그림)
    ctx.drawImage(bitmap, 0, 0, width, height);
    ctx.filter = 'none';
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    if (dataUrl.length <= MAX_DATA_URL) { bitmap.close(); return dataUrl; }
  }
  bitmap.close();
  throw new Error('사진이 너무 커요. 글자가 있는 부분만 잘라서 넣어 주세요.');
}

export class PhotoReadError extends Error { constructor(message: string, public code: string) { super(message); } }

export function readPhotoSchedule(dataUrl: string, today: string) { return askServer({ image: dataUrl, today }); }
/** 글로 넣기에서 규칙이 못 찾아 사람이 'AI로 다시 읽기'를 누를 때만(글이 구글 무료 AI로 간다) */
export function readTextScheduleWithAi(text: string, today: string) { return askServer({ text, today }); }

async function askServer(payload: { image: string; today: string } | { text: string; today: string }): Promise<PhotoEvent[]> {
  const code = syncEngine.code;
  if (!code) throw new PhotoReadError('동기화 코드로 로그인하면 쓸 수 있어요.', 'no_login');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new PhotoReadError('인터넷에 연결되면 쓸 수 있어요.', 'offline');
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api/photo-schedule`, { method: 'POST', cache: 'no-store', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  } catch { throw new PhotoReadError('인터넷에 연결되면 쓸 수 있어요.', 'offline'); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PhotoReadError(body?.error ?? `서버 오류(${res.status})`, body?.code ?? String(res.status));
  return Array.isArray(body.events) ? body.events : [];
}

/** 같은 날 시간이 겹치는 기존 일정(시간 없는 후보·일정은 겹침으로 보지 않음, 끝 시간이 없으면 1시간으로 봄) */
export function overlapping(candidate: { date: string; start: string | null; end: string | null }, schedules: Schedule[]) {
  if (!candidate.start) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const s1 = toMin(candidate.start), e1 = candidate.end ? toMin(candidate.end) : s1 + 60;
  return schedules.find(s => s.date === candidate.date && s.startTime && toMin(s.startTime) < e1 && s1 < (s.endTime ? toMin(s.endTime) : toMin(s.startTime) + 60)) ?? null;
}
