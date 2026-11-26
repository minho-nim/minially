// 메일 원문(RFC 5322 + MIME) 읽기·쓰기. 외부 패키지 없이 필요한 만큼만: 머리줄, 인코딩된 제목, base64·quoted-printable, multipart.
// 본문은 text/plain을 먼저, 없으면 text/html에서 글자만 뽑는다. HTML은 화면에 넣지 않는다(글자만 씀).

const enc = new TextEncoder();

/** 문자셋 이름으로 바이트를 글자로. 모르는 문자셋이면 UTF-8로 읽는다 */
export function decodeBytes(bytes: Uint8Array, charset = 'utf-8') {
  const name = charset.toLowerCase().replace(/^"|"$/g, '');
  const alias = /ks_c_5601|euc-kr|cp949|x-windows-949/.test(name) ? 'euc-kr' : name;
  try { return new TextDecoder(alias).decode(bytes); } catch { return new TextDecoder().decode(bytes); }
}

const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0) & 0xff);

export function base64Bytes(s: string) {
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, '');
  try { return latin1(atob(clean)); } catch { return new Uint8Array(); }
}

export function qpBytes(s: string, header = false) {
  const text = (header ? s.replace(/_/g, ' ') : s).replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) { out.push(parseInt(text.slice(i + 1, i + 3), 16)); i += 2; }
    else out.push(text.charCodeAt(i) & 0xff);
  }
  return Uint8Array.from(out);
}

/** =?UTF-8?B?...?= 같은 인코딩된 머리줄 글자 풀기 */
export function decodeWords(value: string) {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=(\s+(?==\?))?/g, (_m, charset: string, kind: string, data: string) =>
    decodeBytes(kind.toUpperCase() === 'B' ? base64Bytes(data) : qpBytes(data, true), charset));
}

/** 머리줄 묶음 → 이름(소문자)별 값(이어진 줄을 펴고, 인코딩은 그대로) */
export function parseHeaders(block: string) {
  const headers = new Map<string, string>();
  for (const line of block.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    if (!headers.has(key)) headers.set(key, line.slice(i + 1).trim());
  }
  return headers;
}

const param = (value: string, name: string) => value.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i'))?.slice(1).find(Boolean) ?? '';

/** 인코딩 없이 8비트로 온 머리줄(UTF-8 바이트)을 글자로 */
const fixHeader = (v: string) => (/[\x80-\xff]/.test(v) ? decodeBytes(latin1(v)) : v);

/** 'A <a@b.c>' → 이름·주소 */
export function parseAddress(value: string) {
  const v = decodeWords(fixHeader(value)).trim();
  const m = v.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim(), address: m[2].toLowerCase() };
  const bare = v.match(/[^\s<>"]+@[^\s<>"]+/);
  return { name: '', address: bare ? bare[0].toLowerCase() : '' };
}

/** HTML에서 글자만(스크립트·스타일 빼고, 줄바꿈 살리기) */
export function htmlText(html: string) {
  return html.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

interface Part { headers: Map<string, string>; body: string }
function splitPart(raw: string): Part {
  const cut = raw.search(/\r?\n\r?\n/);
  if (cut < 0) return { headers: parseHeaders(raw), body: '' };
  return { headers: parseHeaders(raw.slice(0, cut)), body: raw.slice(cut).replace(/^\r?\n\r?\n/, '') };
}

function partText(part: Part): { plain: string; html: string } {
  const type = part.headers.get('content-type') ?? 'text/plain';
  if (/^multipart\//i.test(type)) {
    const boundary = param(type, 'boundary');
    if (!boundary) return { plain: '', html: '' };
    const pieces = part.body.split(`--${boundary}`).slice(1).filter(p => !p.startsWith('--'));
    let plain = '', html = '';
    for (const piece of pieces) {
      const got = partText(splitPart(piece.replace(/^\r?\n/, '')));
      plain ||= got.plain; html ||= got.html;
    }
    return { plain, html };
  }
  if (/attachment/i.test(part.headers.get('content-disposition') ?? '')) return { plain: '', html: '' };
  const cte = (part.headers.get('content-transfer-encoding') ?? '').toLowerCase();
  const bytes = cte === 'base64' ? base64Bytes(part.body) : cte === 'quoted-printable' ? qpBytes(part.body) : latin1(part.body);
  const text = decodeBytes(bytes, param(type, 'charset') || 'utf-8');
  return /^text\/html/i.test(type) ? { plain: '', html: text } : /^text\/plain/i.test(type) ? { plain: text, html: '' } : { plain: '', html: '' };
}

export interface ParsedMail { from: { name: string; address: string }; subject: string; date: number | null; messageId: string; references: string; text: string; html: string; bulk: boolean }

/** 메일 원문(바이트를 latin1 글자로 받은 것) 읽기. 본문은 8,000자까지 */
export function parseMail(raw: string): ParsedMail {
  const top = splitPart(raw);
  const { plain, html } = partText(top);
  const h = top.headers;
  const date = Date.parse(h.get('date') ?? '');
  return {
    from: parseAddress(h.get('from') ?? ''),
    subject: decodeWords(fixHeader(h.get('subject') ?? '')).replace(/\s+/g, ' ').trim().slice(0, 300),
    date: Number.isNaN(date) ? null : date,
    messageId: (h.get('message-id') ?? '').trim().slice(0, 300),
    references: (h.get('references') ?? '').trim().slice(0, 1000),
    text: (plain || htmlText(html)).replace(/\r\n/g, '\n').trim().slice(0, 8000),
    html: html.length <= 300_000 ? html : '', // 너무 큰 HTML은 버리고 글만 보여 준다
    // 광고·뉴스레터(대량 발송)는 AI로 보내지 않는다
    bulk: h.has('list-unsubscribe') || /bulk|list|junk/i.test(h.get('precedence') ?? ''),
  };
}

const b64 = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const encodeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(enc.encode(s))}?=`);

/** 답장 메일 원문(UTF-8 글, base64). 줄바꿈은 CRLF */
export function buildMail(m: { from: string; to: string; subject: string; body: string; html?: string; inReplyTo?: string; references?: string; date?: Date; id: string }) {
  // 머리줄에 줄바꿈이 들어가면 다른 머리줄을 끼워 넣을 수 있어 모두 한 줄로
  const one = (v?: string) => (v ?? '').replace(/[\r\n]+/g, ' ').trim();
  m = { ...m, from: one(m.from), to: one(m.to), subject: one(m.subject), inReplyTo: one(m.inReplyTo) || undefined, references: one(m.references) || undefined, id: one(m.id) };
  const part = (text: string) => b64(enc.encode(text.replace(/\r?\n/g, '\r\n'))).replace(/.{76}/g, '$&\r\n');
  const body = part(m.body);
  const boundary = `minilog-${m.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`;
  const content = m.html
    ? [`Content-Type: multipart/alternative; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', body,
      `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', part(m.html), `--${boundary}--`, '']
    : ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', body, ''];
  return [
    `From: ${m.from}`, `To: ${m.to}`, `Subject: ${encodeWord(m.subject)}`, `Date: ${(m.date ?? new Date()).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${m.id}`, ...(m.inReplyTo ? [`In-Reply-To: ${m.inReplyTo}`, `References: ${[m.references, m.inReplyTo].filter(Boolean).join(' ')}`] : []),
    'MIME-Version: 1.0', ...content,
  ].join('\r\n');
}
