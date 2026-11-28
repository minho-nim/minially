import { json, readJson, type HubContext, type HubEnv } from '../../../shared/server/d1';
import { requireSession, type UserName } from '../../../shared/server/auth';
import { MailError, PROVIDER_LABEL, PROVIDERS, mailAccountOf, testLogin, type Provider } from '../_mailbox';
import { credReady, deleteCred, readLogin, saveCred, savedCreds } from '../_creds';

// 연결 안내 화면: 네이버(메일·캘린더)·Gmail 앱 비밀번호를 화면에서 직접 연결한다.
// GET → { can_save, accounts:[{provider,label,connected,source,address}] }  (비밀번호는 내보내지 않음, 주소는 앞 두 글자만)
// PUT { provider, login, password } → 실제로 로그인해 본 뒤에만 암호화해 저장
// DELETE ?provider= → 화면에서 넣은 연결만 끊음(Cloudflare 비밀값은 그대로)
const mask = (a: string) => a.replace(/^(.{2})[^@]*/, '$1***');

async function state(env: HubEnv, db: D1Database, user: UserName) {
  const saved = await savedCreds(env, db, user);
  return {
    can_save: await credReady(env),
    accounts: PROVIDERS.map(p => {
      const app = saved[p];
      const admin = mailAccountOf(env, user, p);
      const address = app ? app.login : admin?.address ?? '';
      return { provider: p, label: PROVIDER_LABEL[p], connected: !!(app || admin), source: app ? 'app' : admin ? 'admin' : null, address: address ? mask(address) : '' };
    }),
  };
}
type D1Database = NonNullable<HubEnv['DB']>;

export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await state(ctx.env, auth.db, auth.session.user));
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  const provider = body?.provider;
  if (provider !== 'naver' && provider !== 'gmail') return json({ error: '연결할 곳을 골라 주세요.' }, 400);
  if (!(await credReady(ctx.env))) return json({ error: '아직 화면에서 연결할 수 없어요. 관리자가 암호화 키(CRED_KEY)를 먼저 넣어야 해요.' }, 503);
  const r = readLogin(provider, body?.login, body?.password);
  if (typeof r === 'string') return json({ error: r }, 400);
  // 먼저 실제로 로그인해 본다(메일함은 읽지 않음). 실패하면 저장하지 않는다
  try { await testLogin(ctx.env, { provider, address: r.login, password: r.password }); }
  catch (e) { return json({ error: e instanceof MailError ? e.message : '메일 서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.' }, 400); }
  if (!(await saveCred(ctx.env, auth.db, auth.session.user, provider, r.login, r.password))) return json({ error: '저장하지 못했어요.' }, 500);
  return json(await state(ctx.env, auth.db, auth.session.user));
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const provider = new URL(ctx.request.url).searchParams.get('provider');
  if (provider !== 'naver' && provider !== 'gmail') return json({ error: '끊을 곳을 골라 주세요.' }, 400);
  await deleteCred(auth.db, auth.session.user, provider);
  return json(await state(ctx.env, auth.db, auth.session.user));
};
