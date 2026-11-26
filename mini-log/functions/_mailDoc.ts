// 메일 쓰기 문서: 서식 있는 글을 정해진 모양(문단·목록·인용 + 굵게·기울임·밑줄·취소선·크기·색·링크)으로만 다룬다.
// 화면 편집기가 이 모양으로 바꿔 보내고, 서버가 검사한 뒤 메일용 HTML(인라인 스타일)과 글만 버전을 만든다.
// HTML을 받아 그대로 쓰지 않으므로 스크립트·바깥 이미지·이상한 스타일이 들어갈 수 없다.

export const MAIL_SIZES = { s: 12, m: 14, l: 18, xl: 24 } as const;
export type MailSize = keyof typeof MAIL_SIZES;
export const MAIL_COLORS = ['#222222', '#666666', '#D0574B', '#E4A11B', '#2E8B57', '#2F6FD6', '#7A4FC4'] as const;

export interface MailRun { t: string; b?: true; i?: true; u?: true; s?: true; size?: MailSize; color?: string; href?: string }
export interface MailBlock { type: 'p' | 'ul' | 'ol' | 'quote'; runs?: MailRun[]; items?: MailRun[][] }
export type MailDoc = MailBlock[];

const LIMITS = { blocks: 300, items: 100, runs: 200, chars: 20000 };

function cleanRuns(value: unknown, budget: { left: number }): MailRun[] | null {
  if (!Array.isArray(value) || value.length > LIMITS.runs) return null;
  const out: MailRun[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.t !== 'string') return null;
    const t = r.t.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').replace(/\n/g, ' ');
    budget.left -= t.length;
    if (budget.left < 0) return null;
    if (!t) continue;
    const run: MailRun = { t };
    for (const k of ['b', 'i', 'u', 's'] as const) if (r[k] === true) run[k] = true;
    if (typeof r.size === 'string' && r.size in MAIL_SIZES && r.size !== 'm') run.size = r.size as MailSize;
    if (typeof r.color === 'string' && (MAIL_COLORS as readonly string[]).includes(r.color.toUpperCase()) && r.color.toUpperCase() !== '#222222') run.color = r.color.toUpperCase();
    if (typeof r.href === 'string' && /^https:\/\/[^\s"'<>]{1,500}$/.test(r.href)) run.href = r.href;
    out.push(run);
  }
  return out;
}

/** 화면이 보낸 문서 검사. 모양이 틀리거나 너무 크면 null */
export function readMailDoc(value: unknown): MailDoc | null {
  if (!Array.isArray(value) || value.length > LIMITS.blocks) return null;
  const budget = { left: LIMITS.chars };
  const doc: MailDoc = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const b = raw as Record<string, unknown>;
    if (b.type === 'p' || b.type === 'quote') {
      const runs = cleanRuns(b.runs ?? [], budget);
      if (!runs) return null;
      doc.push({ type: b.type, runs });
    } else if (b.type === 'ul' || b.type === 'ol') {
      if (!Array.isArray(b.items) || b.items.length > LIMITS.items) return null;
      const items: MailRun[][] = [];
      for (const item of b.items) { const runs = cleanRuns(item, budget); if (!runs) return null; items.push(runs); }
      doc.push({ type: b.type, items });
    } else return null;
  }
  return doc;
}

/** 글만 있는 답장(AI 초안 등)을 문서로: 빈 줄 없이 한 줄이 한 문단 */
export const docFromText = (text: string): MailDoc => text.replace(/\r/g, '').split('\n').map(line => ({ type: 'p' as const, runs: line ? [{ t: line }] : [] }));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function runsHtml(runs: MailRun[]) {
  return runs.map(r => {
    let h = esc(r.t);
    const style = [r.size ? `font-size:${MAIL_SIZES[r.size]}px` : '', r.color ? `color:${r.color}` : ''].filter(Boolean).join(';');
    if (style) h = `<span style="${style}">${h}</span>`;
    if (r.b) h = `<b>${h}</b>`;
    if (r.i) h = `<i>${h}</i>`;
    if (r.u) h = `<u>${h}</u>`;
    if (r.s) h = `<s>${h}</s>`;
    if (r.href) h = `<a href="${esc(r.href)}" style="color:#2F6FD6">${h}</a>`;
    return h;
  }).join('');
}

/** 메일용 HTML(메일 앱이 잘 보이게 인라인 스타일) */
export function docToHtml(doc: MailDoc) {
  const body = doc.map(b => {
    if (b.type === 'ul' || b.type === 'ol') return `<${b.type} style="margin:0 0 10px;padding-left:22px">${(b.items ?? []).map(i => `<li>${runsHtml(i)}</li>`).join('')}</${b.type}>`;
    const inner = runsHtml(b.runs ?? []) || '<br>';
    return b.type === 'quote' ? `<blockquote style="margin:0 0 10px;padding-left:10px;border-left:3px solid #ccc;color:#555">${inner}</blockquote>` : `<p style="margin:0 0 6px">${inner}</p>`;
  }).join('');
  return `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.6;color:#222">${body}</div>`;
}

/** 글만 버전(메일 앱이 HTML을 못 볼 때, 저장·AI용) */
export function docToText(doc: MailDoc) {
  return doc.map(b => {
    const line = (runs: MailRun[]) => runs.map(r => (r.href && r.href !== r.t ? `${r.t}(${r.href})` : r.t)).join('');
    if (b.type === 'ul') return (b.items ?? []).map(i => `- ${line(i)}`).join('\n');
    if (b.type === 'ol') return (b.items ?? []).map((i, n) => `${n + 1}. ${line(i)}`).join('\n');
    return b.type === 'quote' ? `> ${line(b.runs ?? [])}` : line(b.runs ?? []);
  }).join('\n');
}
