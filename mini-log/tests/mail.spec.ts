import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

const MAIL = 'http://127.0.0.1:8905';
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const raw = (o: { from: string; subject: string; body: string; id: string; extra?: string }) => [
  `From: ${o.from}`, 'To: c-test@naver.com', `Subject: =?UTF-8?B?${b64(o.subject)}?=`, 'Date: Thu, 26 Nov 2026 10:00:00 +0900', `Message-ID: ${o.id}`,
  ...(o.extra ? [o.extra] : []), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(o.body), '',
].join('\r\n');

test('메일 읽기·쓰기 규칙: 인코딩된 제목, base64·QP 본문, multipart, 뉴스레터, 답장 원문', async () => {
  const { parseMail, buildMail, parseAddress } = await import('../functions/_mime');
  const plain = parseMail(raw({ from: '=?UTF-8?B?' + b64('성수빵집 담당자') + '?= <hello@bread.kr>', subject: '[협찬 제안] 겨울 신메뉴', body: '안녕하세요\n체험 제안드립니다.', id: '<a1@bread.kr>' }));
  expect(plain).toMatchObject({ from: { name: '성수빵집 담당자', address: 'hello@bread.kr' }, subject: '[협찬 제안] 겨울 신메뉴', messageId: '<a1@bread.kr>', bulk: false });
  expect(plain.text).toBe('안녕하세요\n체험 제안드립니다.');
  const multi = parseMail(['From: a@b.kr', 'Subject: =?utf-8?Q?=ED=85=8C=EC=8A=A4=ED=8A=B8_QP?=', 'List-Unsubscribe: <https://x.kr/u>', 'Content-Type: multipart/alternative; boundary="BB"', '',
    '--BB', 'Content-Type: text/html; charset=UTF-8', '', '<p>html <b>본문</b></p><script>bad()</script>', '--BB', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: quoted-printable', '', '=EC=95=88=EB=85=95 plain', '--BB--', ''].join('\r\n'));
  expect(multi).toMatchObject({ subject: '테스트 QP', text: '안녕 plain', bulk: true });
  const bytes = (t: string) => Buffer.from(t, 'utf8').toString('latin1'); // 메일 서버에서 받은 그대로(8비트)
  const html = parseMail(bytes(['From: 김토몽 <x@y.kr>', 'Subject: 8비트 제목', 'Content-Type: text/html; charset=UTF-8', '', '<div>첫 줄</div><div>둘째&amp;줄</div><style>p{}</style>'].join('\r\n')));
  expect(html).toMatchObject({ subject: '8비트 제목', from: { name: '김토몽', address: 'x@y.kr' } });
  expect(html.text).toBe('첫 줄\n둘째&줄');
  expect(parseAddress('no-name@x.kr')).toEqual({ name: '', address: 'no-name@x.kr' });
  const built = buildMail({ from: 'c-test@naver.com', to: 'hello@bread.kr', subject: 'Re: 겨울 신메뉴', body: '고맙습니다\n일정 알려 주세요', inReplyTo: '<a1@bread.kr>', id: '<r1@minilog>' });
  const back = parseMail(built);
  expect(back).toMatchObject({ subject: 'Re: 겨울 신메뉴', text: '고맙습니다\n일정 알려 주세요' });
  expect(built).toContain('In-Reply-To: <a1@bread.kr>');
});

test('AI 분류 답 검사와 업체 이름 맞추기', async () => {
  const { readJudgements, readReplies, sameBrand } = await import('../functions/_mailRules');
  const got = readJudgements(JSON.stringify({ mails: [
    { id: 'm1', kind: 'offer', brand: '빵집', amount: '5만', deadline: '2026-02-30', needs_reply: true },
    { id: 'zz', kind: 'offer' }, { id: 'm2', kind: 'spam' },
  ] }), ['m1', 'm2']);
  expect(got).toEqual([{ id: 'm1', kind: 'offer', brand: '빵집', title: '', amount: 0, deadline: null, visit_on: null, answer: 'unknown', summary: '', needs_reply: true }]);
  expect(readReplies('설명 {"replies":[{"id":"m1","subject":"Re: a","body":" 본문 "},{"id":"m9","body":"x"}]}', ['m1'])).toEqual([{ id: 'm1', subject: 'Re: a', body: '본문' }]);
  expect(sameBrand('(주)성수 빵집', '성수빵집')).toBe(true);
  expect(sameBrand('빵', '빵집')).toBe(false);
});

test('메일 자동 처리: 받기 → 분류·협찬 담기 → 답장 초안 → 사람이 눌러야 보내기, 두 번 받아도 겹치지 않음', async ({ page, request }) => {
  for (const r of [await request.get('/api/mail'), await request.post('/api/mail/sync', { data: {} }), await request.post('/api/mail/x/send', { data: {} })]) expect(r.status()).toBe(401);
  // 예약 작업 주소는 토큰이 있어야 한다
  expect((await request.post('/api/mail/cron')).status()).toBe(401);
  expect((await request.post('/api/mail/cron', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);

  await request.post(`${MAIL}/reset`);
  for (const m of [
    { from: '메일빵집 <offer@bread.kr>', subject: '[협찬 제안] 겨울 신메뉴 체험', body: '안녕하세요. 겨울 신메뉴 체험을 제안드려요. 원고료 5만 원, 12월 20일까지 게시.', id: '<o1@bread.kr>' },
    { from: '구름카페 <notice@cloud.kr>', subject: '체험단 선정 안내', body: '선정되셨습니다. 12월 5일 방문해 주세요.', id: '<n1@cloud.kr>' },
    { from: '달빛상점 <moon@shop.kr>', subject: '제안 주신 건 답장드립니다', body: '좋아요, 진행해요.', id: '<p1@shop.kr>' },
    { from: '뉴스 <news@letter.kr>', subject: '이번 주 소식', body: '광고', id: '<l1@letter.kr>', extra: 'List-Unsubscribe: <https://letter.kr/u>' },
  ]) await request.post(`${MAIL}/inbox`, { data: { raw: raw(m) } });

  await login(page, CODE_C);
  // 내가 먼저 제안해 둔 업체(답장이 오면 '좋다고 함'으로 바뀐다)
  const pitched = await page.evaluate(async () => (await (await fetch('/api/campaigns', { method: 'POST', body: JSON.stringify({ brand: '메일달빛상점', status: 'proposed', pitch: { on: '2026-11-20', via: 'mail', reply: 'waiting' } }) })).json()).campaign.id);

  // 예약 작업이 받는다(C만 연결, D는 건너뜀)
  const cron = await request.post('/api/mail/cron', { headers: { authorization: 'Bearer test-cron' } });
  expect(await cron.json()).toEqual({ results: { C: { added: 4 }, D: { added: 0, skipped: 'no_account' } } });

  const data = await page.evaluate(async () => (await fetch('/api/mail')).json());
  expect(data.connected).toBe(true);
  expect(data.address).toBe('c-***@naver.com'); // 주소는 앞부분만
  const bySubject = (s: string) => data.mails.find((m: { subject: string }) => m.subject.includes(s));
  expect(bySubject('협찬 제안')).toMatchObject({ kind: 'offer', brand: '메일빵집', deadline: '2026-12-20', needs_reply: 1, status: 'drafted' });
  expect(bySubject('협찬 제안').reply_body).toContain('가짜 AI 답장 초안');
  expect(bySubject('선정')).toMatchObject({ kind: 'notice', deadline: '2026-12-05', needs_reply: 0 });
  expect(bySubject('답장드립니다')).toMatchObject({ kind: 'pitch_reply', campaign_id: pitched });
  expect(bySubject('이번 주 소식')).toMatchObject({ kind: 'other' }); // 뉴스레터는 AI로 보내지 않는다
  expect(data.waiting).toBe(2);
  const campaigns = (await page.evaluate(async () => (await fetch('/api/campaigns')).json())).campaigns as { id: string; brand: string; deadline: string | null; status: string; pitch: { reply: string } | null; guide: { visit_on: string | null } | null }[];
  expect(campaigns.find(c => c.brand === '메일빵집')).toMatchObject({ deadline: '2026-12-20', status: 'proposed' });
  expect(campaigns.find(c => c.brand === '메일구름카페')).toMatchObject({ status: 'in_progress', guide: { visit_on: '2026-12-05' } });
  expect(campaigns.find(c => c.id === pitched)?.pitch?.reply).toBe('yes');

  // 화면: 메뉴 숫자, 고쳐서 보내기(확인 한 번 더)
  await page.reload();
  await expect(page.getByRole('button', { name: /^메일/ })).toContainText('2');
  await page.getByRole('button', { name: /^메일/ }).click();
  const offer = page.locator('.mail').filter({ hasText: '[협찬 제안] 겨울 신메뉴 체험' });
  await expect(offer).toContainText('협찬에 담음: 메일빵집');
  await expect(page.locator('.mail').filter({ hasText: '이번 주 소식' })).toHaveCount(0); // 기타는 기본으로 숨김
  await offer.getByLabel('답장 내용').fill('안녕하세요, 제안 감사합니다.\n12월 둘째 주에 방문할게요.');
  expect((await (await request.get(`${MAIL}/sent`)).json())).toEqual([]); // 아직 안 보냄
  await offer.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(offer.getByRole('group', { name: '보내기 확인' })).toContainText('offer@bread.kr');
  await offer.getByRole('button', { name: '보내기 확정' }).click();
  await expect(offer).toContainText('보냄');
  const sent = await (await request.get(`${MAIL}/sent`)).json();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ from: 'c-test@naver.com', to: 'offer@bread.kr' });
  expect(sent[0].data).toContain('In-Reply-To: <o1@bread.kr>');
  const { parseMail } = await import('../functions/_mime');
  expect(parseMail(sent[0].data).text).toBe('안녕하세요, 제안 감사합니다.\n12월 둘째 주에 방문할게요.');
  await expect(page.getByRole('button', { name: /^메일/ })).toContainText('1');

  // 다시 받아도 겹치지 않는다, 보낸 답장은 다시 못 보낸다
  const again = await page.evaluate(async () => (await fetch('/api/mail/sync', { method: 'POST', body: '{}' })).json());
  expect(again.added).toBe(0);
  const offerId = bySubject('협찬 제안').id;
  expect(await page.evaluate(async id => (await fetch(`/api/mail/${id}/send`, { method: 'POST', body: '{}' })).status, offerId)).toBe(409);

  // D는 연결 안 됨, C의 메일을 볼 수도 보낼 수도 없다
  const other = await page.context().browser()!.newPage();
  await login(other, CODE_D);
  const d = await other.evaluate(async id => ({
    list: await (await fetch('/api/mail')).json(),
    sync: (await fetch('/api/mail/sync', { method: 'POST', body: '{}' })).status,
    send: (await fetch(`/api/mail/${id}/send`, { method: 'POST', body: '{}' })).status,
    edit: (await fetch(`/api/mail/${id}`, { method: 'PUT', body: JSON.stringify({ reply_body: 'x' }) })).status,
  }), bySubject('답장드립니다').id);
  expect(d).toMatchObject({ list: { connected: false, mails: [], waiting: 0 }, sync: 409, send: 409, edit: 404 });
  await other.close();

  // 다른 시험(협찬 합계 등)에 영향이 없게 만든 협찬을 지운다
  await page.evaluate(async ids => { for (const id of ids) await fetch(`/api/campaigns/${id}`, { method: 'DELETE' }); },
    campaigns.filter(c => ['메일빵집', '메일구름카페', '메일달빛상점'].includes(c.brand)).map(c => c.id));
});
