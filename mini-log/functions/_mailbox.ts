// 메일 연결(네이버·Gmail): IMAP(받기)·SMTP(보내기)를 Cloudflare TCP 소켓으로 직접 쓴다(유료 API·OAuth 없음).
// 계정은 Cloudflare 비밀값에만 둔다(D1·로그·화면에 넣지 않음):
//   NAVER_MAIL_C·D = "아이디@naver.com:애플리케이션 비밀번호", GMAIL_MAIL_C·D = "주소@gmail.com:앱 비밀번호"(2단계 인증 필요)
// 시험에서는 MAIL_TEST_SERVER(네이버)·MAIL_TEST_SERVER_GMAIL(Gmail)="127.0.0.1:포트"(IMAP=포트, SMTP=포트+1, 암호화 없음)로 가짜 서버에 붙는다.
import { connect } from 'cloudflare:sockets';
import type { HubEnv } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

export type Provider = 'naver' | 'gmail';
export const PROVIDERS: Provider[] = ['naver', 'gmail'];
export const PROVIDER_LABEL: Record<Provider, string> = { naver: '네이버', gmail: 'Gmail' };
export interface MailAccount { provider: Provider; address: string; password: string }
export class MailError extends Error {}

const SECRET: Record<Provider, string> = { naver: 'NAVER_MAIL', gmail: 'GMAIL_MAIL' };
const HOSTS: Record<Provider, { imap: string; smtp: string }> = { naver: { imap: 'imap.naver.com', smtp: 'smtp.naver.com' }, gmail: { imap: 'imap.gmail.com', smtp: 'smtp.gmail.com' } };
const TEST_VAR: Record<Provider, string> = { naver: 'MAIL_TEST_SERVER', gmail: 'MAIL_TEST_SERVER_GMAIL' };

export function mailAccountOf(env: HubEnv, user: UserName, provider: Provider): MailAccount | null {
  const raw = env[`${SECRET[provider]}_${user}`];
  if (typeof raw !== 'string') return null;
  const i = raw.indexOf(':');
  // Gmail 앱 비밀번호는 4자씩 띄어 보여 주므로 빈칸은 지운다
  const address = raw.slice(0, i).trim().toLowerCase(), password = provider === 'gmail' ? raw.slice(i + 1).replace(/\s+/g, '') : raw.slice(i + 1);
  if (i <= 0 || !/^[^\s@:]+@[^\s@:]+$/.test(address) || !password) return null;
  return { provider, address, password };
}

/** 이 사람의 연결된 메일 계정(네이버 → Gmail 순) */
export const mailAccounts = (env: HubEnv, user: UserName) => PROVIDERS.map(p => mailAccountOf(env, user, p)).filter((a): a is MailAccount => !!a);

/** 화면에 보낼 연결 정보: 주소는 앞 두 글자만(비밀번호는 절대 넣지 않음) */
export function accountInfo(env: HubEnv, user: UserName) {
  const accounts = mailAccounts(env, user).map(a => ({ provider: a.provider, address: a.address.replace(/^(.{2})[^@]*/, '$1***') }));
  return { connected: accounts.length > 0, address: accounts.map(a => a.address).join(' · '), accounts };
}

function servers(env: HubEnv, provider: Provider) {
  const v = env[TEST_VAR[provider]];
  const test = typeof v === 'string' ? v.match(/^127\.0\.0\.1:(\d+)$/) : null;
  if (test) { const port = Number(test[1]); return { imap: { hostname: '127.0.0.1', port }, smtp: { hostname: '127.0.0.1', port: port + 1 }, tls: false }; }
  return { imap: { hostname: HOSTS[provider].imap, port: 993 }, smtp: { hostname: HOSTS[provider].smtp, port: 465 }, tls: true };
}

const enc = new TextEncoder();
/** 소켓에서 줄·정해진 바이트 수를 읽는 도우미(바이트는 latin1 글자로 다룬다) */
class Conn {
  private buf = '';
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  constructor(private socket: ReturnType<typeof connect>, private deadline: number) {
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }
  private async more() {
    if (Date.now() > this.deadline) throw new MailError('메일 서버가 너무 늦게 답해요.');
    const { value, done } = await this.reader.read();
    if (done) throw new MailError('메일 서버 연결이 끊겼어요.');
    for (const b of value) this.buf += String.fromCharCode(b);
  }
  async line() {
    let i: number;
    while ((i = this.buf.indexOf('\r\n')) < 0) await this.more();
    const out = this.buf.slice(0, i); this.buf = this.buf.slice(i + 2);
    return out;
  }
  async bytes(n: number) {
    while (this.buf.length < n) await this.more();
    const out = this.buf.slice(0, n); this.buf = this.buf.slice(n);
    return out;
  }
  async send(text: string) { await this.writer.write(enc.encode(text)); }
  async close() { try { await this.socket.close(); } catch { /* 이미 닫힘 */ } }
}

const quote = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const imapDate = (ms: number) => { const d = new Date(ms); return `${d.getUTCDate()}-${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}-${d.getUTCFullYear()}`; };

/** IMAP 명령 하나: 꼬리표가 붙은 끝 줄까지 읽고, {n} 덩어리(메일 원문)는 따로 모은다 */
async function command(c: Conn, tag: string, text: string) {
  await c.send(`${tag} ${text}\r\n`);
  const lines: string[] = [], literals: string[] = [];
  for (;;) {
    let line = await c.line();
    let size: RegExpMatchArray | null;
    while ((size = line.match(/\{(\d+)\}$/))) { literals.push(await c.bytes(Number(size[1]))); line = line.slice(0, -size[0].length) + (await c.line()); }
    if (line.startsWith(`${tag} `)) {
      if (!line.startsWith(`${tag} OK`)) throw new MailError(/AUTHENTICATIONFAILED|LOGIN|NO \[AUTH/i.test(line) ? '메일 로그인에 실패했어요. 애플리케이션 비밀번호와 IMAP 사용 설정을 확인해 주세요.' : '메일 서버가 요청을 거절했어요.');
      return { lines, literals };
    }
    lines.push(line);
  }
}

export interface Fetched { uid: number; raw: string }

/** 받은편지함에서 lastUid 다음 메일을 최대 limit개(새것부터). 처음이면 최근 14일만 본다 */
export async function fetchNew(env: HubEnv, account: MailAccount, lastUid: number, limit = 20): Promise<{ uidValidity: number; mails: Fetched[] }> {
  const s = servers(env, account.provider);
  const c = new Conn(connect(s.imap, { secureTransport: s.tls ? 'on' : 'off' }), Date.now() + 25000);
  try {
    if (!/^\* (OK|PREAUTH)/.test(await c.line())) throw new MailError('메일 서버가 응답하지 않아요.');
    await command(c, 'a1', `LOGIN ${quote(account.address)} ${quote(account.password)}`);
    const sel = await command(c, 'a2', 'SELECT INBOX');
    const uidValidity = Number(sel.lines.join(' ').match(/UIDVALIDITY (\d+)/)?.[1] ?? 0);
    const search = await command(c, 'a3', lastUid > 0 ? `UID SEARCH UID ${lastUid + 1}:*` : `UID SEARCH SINCE ${imapDate(Date.now() - 14 * 86400000)}`);
    const uids = (search.lines.find(l => l.startsWith('* SEARCH'))?.slice(8).trim().split(/\s+/) ?? []).map(Number).filter(u => u > lastUid).sort((a, b) => a - b).slice(-limit);
    const mails: Fetched[] = [];
    for (const [i, uid] of uids.entries()) {
      const got = await command(c, `f${i}`, `UID FETCH ${uid} (BODY.PEEK[]<0.200000>)`);
      if (got.literals[0]) mails.push({ uid, raw: got.literals[0] });
    }
    try { await command(c, 'z', 'LOGOUT'); } catch { /* 끝 인사는 실패해도 된다 */ }
    return { uidValidity, mails };
  } finally { await c.close(); }
}

const b64 = (s: string) => { let out = ''; for (const b of enc.encode(s)) out += String.fromCharCode(b); return btoa(out); };

async function reply(c: Conn, want: string) {
  let line = await c.line();
  while (/^\d{3}-/.test(line)) line = await c.line();
  if (!line.startsWith(want)) throw new MailError(line.startsWith('535') ? '메일 로그인에 실패했어요. 애플리케이션 비밀번호를 확인해 주세요.' : '메일을 보내지 못했어요. 받는 주소를 확인해 주세요.');
}

/** SMTP로 메일 한 통 보내기(사람이 '보내기'를 눌렀을 때만 부른다) */
export async function sendMail(env: HubEnv, account: MailAccount, to: string, raw: string) {
  const s = servers(env, account.provider);
  const c = new Conn(connect(s.smtp, { secureTransport: s.tls ? 'on' : 'off' }), Date.now() + 25000);
  try {
    await reply(c, '220');
    await c.send('EHLO minilog\r\n'); await reply(c, '250');
    await c.send('AUTH LOGIN\r\n'); await reply(c, '334');
    await c.send(`${b64(account.address)}\r\n`); await reply(c, '334');
    await c.send(`${b64(account.password)}\r\n`); await reply(c, '235');
    await c.send(`MAIL FROM:<${account.address}>\r\n`); await reply(c, '250');
    await c.send(`RCPT TO:<${to}>\r\n`); await reply(c, '250');
    await c.send('DATA\r\n'); await reply(c, '354');
    await c.send(`${raw.replace(/\r\n\./g, '\r\n..')}\r\n.\r\n`); await reply(c, '250');
    try { await c.send('QUIT\r\n'); } catch { /* 이미 보냄 */ }
  } finally { await c.close(); }
}
