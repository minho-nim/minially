import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

const MAIL = 'http://127.0.0.1:8905';
const GMAIL = 'http://127.0.0.1:8915';
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
  expect(readReplies('설명 {"replies":[{"id":"m1","subject":"Re: a","body":" 본문 "},{"id":"m9","body":"x"}]}', ['m1'])).toEqual([{ id: 'm1', subject: 'Re: a', body: '본문', options: [{ style: 'polite', body: '본문' }] }]);
  // 세 안: 순서는 짧게·정중·조건 협의, 모르는 종류·같은 종류 두 번은 뺌, 처음 보여 줄 글은 정중 안
  const three = readReplies(JSON.stringify({ replies: [{ id: 'm1', options: [{ style: 'terms', body: 'T' }, { style: 'rude', body: 'X' }, { style: 'short', body: 'S' }, { style: 'polite', body: 'P' }, { style: 'polite', body: 'P2' }] }] }), ['m1']);
  expect(three[0].options.map(o => o.style)).toEqual(['short', 'polite', 'terms']);
  expect(three[0].body).toBe('P');
  expect(sameBrand('(주)성수 빵집', '성수빵집')).toBe(true);
  expect(sameBrand('빵', '빵집')).toBe(false);
});

test('메일 자동 처리: 받기 → 분류·협찬 담기 → 답장 초안 → 사람이 눌러야 보내기, 두 번 받아도 겹치지 않음', async ({ page, request }) => {
  for (const r of [await request.get('/api/mail'), await request.post('/api/mail/sync', { data: {} }), await request.post('/api/mail/x/send', { data: {} })]) expect(r.status()).toBe(401);
  // 예약 작업 주소는 토큰이 있어야 한다
  expect((await request.post('/api/mail/cron')).status()).toBe(401);
  expect((await request.post('/api/mail/cron', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);

  await request.post(`${MAIL}/reset`);
  await request.post(`${GMAIL}/reset`);
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
  expect(data.address).toBe('c-***@naver.com · c-***@gmail.com'); // 주소는 앞부분만, 연결된 계정 모두
  const bySubject = (s: string) => data.mails.find((m: { subject: string }) => m.subject.includes(s));
  expect(bySubject('협찬 제안')).toMatchObject({ kind: 'offer', brand: '메일빵집', deadline: '2026-12-20', needs_reply: 1, status: 'drafted' });
  expect(bySubject('협찬 제안').reply_body).toContain('가짜 AI 답장 초안');
  expect(bySubject('선정')).toMatchObject({ kind: 'notice', deadline: '2026-12-05', needs_reply: 0 });
  expect(bySubject('답장드립니다')).toMatchObject({ kind: 'pitch_reply', campaign_id: pitched });
  expect(bySubject('이번 주 소식')).toMatchObject({ kind: 'other' }); // 뉴스레터는 AI로 보내지 않는다
  expect(data.waiting).toBe(2);
  const campaigns = (await page.evaluate(async () => (await fetch('/api/campaigns')).json())).campaigns as { id: string; brand: string; deadline: string | null; status: string; pitch: { reply: string } | null; guide: { visit_on: string | null } | null; suggest: { status: string; reason: string } | null }[];
  expect(campaigns.find(c => c.brand === '메일빵집')).toMatchObject({ deadline: '2026-12-20', status: 'proposed' });
  // 단계는 AI가 바꾸지 않고 '옮길까요?' 제안만(선정 안내 → 신청함으로 담고 진행 중 제안, 좋다는 답장 → 진행 중 제안)
  expect(campaigns.find(c => c.brand === '메일구름카페')).toMatchObject({ status: 'applied', guide: { visit_on: '2026-12-05' }, suggest: { status: 'in_progress' } });
  expect(campaigns.find(c => c.id === pitched)).toMatchObject({ status: 'proposed', pitch: { reply: 'yes' }, suggest: { status: 'in_progress' } });
  // 제안은 사람만 지울 수 있고, 만들 수는 없다
  expect(await page.evaluate(async id => (await fetch(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify({ suggest: { status: 'paid', reason: 'x' } }) })).status, pitched)).toBe(400);
  // 협찬 화면: '옮기기'를 누르면 바뀌고 제안이 사라진다, '아니에요'는 단계 그대로
  await page.goto('/#campaigns');
  const cloud = page.getByRole('group', { name: '메일구름카페 단계 제안' });
  await expect(cloud).toContainText('선정·진행 안내 메일이 왔어요');
  await cloud.getByRole('button', { name: '진행 중(으)로 옮기기' }).click();
  await expect(cloud).toHaveCount(0);
  await page.getByRole('group', { name: '메일달빛상점 단계 제안' }).getByRole('button', { name: '아니에요' }).click();
  await expect(page.getByRole('group', { name: '메일달빛상점 단계 제안' })).toHaveCount(0);
  const after = (await page.evaluate(async () => (await fetch('/api/campaigns')).json())).campaigns as { brand: string; status: string; suggest: unknown }[];
  expect(after.find(c => c.brand === '메일구름카페')).toMatchObject({ status: 'in_progress', suggest: null });
  expect(after.find(c => c.brand === '메일달빛상점')).toMatchObject({ status: 'proposed', suggest: null });

  // 화면: 메뉴 숫자, 메일 앱처럼 목록 → 읽기, 서식 있는 답장을 고쳐 보내기(확인 한 번 더)
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^메일(\s|$)/ })).toContainText('2');
  await page.getByRole('button', { name: /^메일(\s|$)/ }).click();
  const rows = page.getByRole('complementary', { name: '메일 목록' });
  await expect(rows.getByRole('button', { name: /이번 주 소식/ })).toHaveCount(0); // 기타는 '협찬 관련'에 안 보인다
  await rows.getByRole('button', { name: /\[협찬 제안\] 겨울 신메뉴 체험/ }).click();
  const reader = page.getByRole('region', { name: '메일 읽기' });
  await expect(reader.getByRole('heading', { name: '[협찬 제안] 겨울 신메뉴 체험' })).toBeVisible();
  await expect(reader).toContainText('협찬에 담음: 메일빵집');
  await expect(reader).toContainText('AI 요약');
  const editor = reader.getByRole('textbox', { name: '답장 내용' });
  await expect(editor).toContainText('가짜 AI 답장 초안');
  // 미리 써 둔 세 안: 처음엔 '정중하게', 다른 안을 누르면 그 글로 바뀐다(아직 안 보냄)
  const tabs = reader.getByRole('tablist', { name: '답장 안' });
  await expect(tabs.getByRole('tab')).toHaveText(['짧게', '정중하게', '조건 협의']);
  await expect(tabs.getByRole('tab', { name: '정중하게' })).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: '조건 협의' }).click();
  await expect(editor).toContainText('가짜 조건 협의 안');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('안녕하세요, 제안 감사합니다.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('12월 둘째 주에 방문할게요.');
  await page.keyboard.press('ControlOrMeta+A');
  await reader.getByRole('button', { name: '굵게' }).click();
  expect((await (await request.get(`${MAIL}/sent`)).json())).toEqual([]); // 아직 안 보냄
  await reader.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(reader.getByRole('group', { name: '보내기 확인' })).toContainText('offer@bread.kr');
  await reader.getByRole('button', { name: '보내기 확정' }).click();
  await expect(reader).toContainText('답장을 보냈어요');
  const sent = await (await request.get(`${MAIL}/sent`)).json();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ from: 'c-test@naver.com', to: 'offer@bread.kr' });
  expect(sent[0].data).toContain('In-Reply-To: <o1@bread.kr>');
  expect(sent[0].data).toContain('multipart/alternative');
  const { parseMail } = await import('../functions/_mime');
  expect(parseMail(sent[0].data).text).toBe('안녕하세요, 제안 감사합니다.\n12월 둘째 주에 방문할게요.');
  const htmlPart = Buffer.from(sent[0].data.split('Content-Type: text/html; charset=UTF-8')[1].split('\r\n\r\n')[1].split('--minilog')[0].replace(/\s/g, ''), 'base64').toString('utf8');
  expect(htmlPart).toContain('<b>안녕하세요, 제안 감사합니다.</b>');
  await expect(page.getByRole('navigation', { name: '미니로그 메뉴' }).getByRole('button', { name: /^메일(\s|$)/ })).toContainText('1');

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
  expect(d).toMatchObject({ list: { connected: false, mails: [], waiting: 0 }, sync: 409, send: 404, edit: 404 }); // 남의 메일은 '없음'
  await other.close();

  // 다른 시험(협찬 합계 등)에 영향이 없게 만든 협찬과, 진행 중으로 옮길 때 준비된 원고를 지운다
  await page.evaluate(async brands => {
    for (const c of (await (await fetch('/api/campaigns')).json()).campaigns as { id: string; brand: string; draft_id: string | null }[]) {
      if (!brands.includes(c.brand)) continue;
      await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
      if (c.draft_id) await fetch(`/api/drafts/${c.draft_id}`, { method: 'DELETE' });
    }
  }, ['메일빵집', '메일구름카페', '메일달빛상점']);
});

test('메일 쓰기 문서: 정해진 모양만 받고, HTML은 서버가 이스케이프해 만든다', async () => {
  const { readMailDoc, docToHtml, docToText, docFromText } = await import('../functions/_mailDoc');
  const doc = readMailDoc([
    { type: 'p', runs: [{ t: '안녕 <script>', b: true, color: '#d0574b', size: 'l' }, { t: '링크', href: 'javascript:alert(1)' }, { t: '좋은 링크', href: 'https://ok.kr/a' }, { t: '이상한 색', color: 'red; background:url(x)' }] },
    { type: 'ul', items: [[{ t: '하나' }], [{ t: '둘', i: true }]] },
    { type: 'quote', runs: [{ t: '인용' }] },
  ]);
  expect(doc).not.toBeNull();
  expect(doc![0].runs).toEqual([{ t: '안녕 <script>', b: true, color: '#D0574B', size: 'l' }, { t: '링크' }, { t: '좋은 링크', href: 'https://ok.kr/a' }, { t: '이상한 색' }]);
  const html = docToHtml(doc!);
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('<b><span style="font-size:18px;color:#D0574B">');
  expect(html).not.toContain('javascript:');
  expect(docToText(doc!)).toBe('안녕 <script>링크좋은 링크(https://ok.kr/a)이상한 색\n- 하나\n- 둘\n> 인용');
  for (const bad of [null, 'x', [{ type: 'h1', runs: [] }], [{ type: 'p', runs: [{ t: 1 }] }], [{ type: 'p', runs: [{ t: '가'.repeat(20001) }] }]]) expect(readMailDoc(bad)).toBeNull();
  expect(docFromText('첫 줄\n\n셋째')).toEqual([{ type: 'p', runs: [{ t: '첫 줄' }] }, { type: 'p', runs: [] }, { type: 'p', runs: [{ t: '셋째' }] }]);
});

test('받은 HTML 메일은 원래 모양으로 보되 스크립트·바깥 이미지·javascript 링크는 막고, 새 메일을 서식 있게 써서 보낸다', async ({ page, request }) => {
  await request.post(`${MAIL}/reset`);
  const html = '<div style="font-size:18px;color:#2F6FD6"><b>강조된 안내</b> 입니다</div><script>window.__hacked=1</script><img src="https://tracker.example/p.gif" alt="로고"><a href="javascript:alert(1)">나쁜 링크</a> <a href="https://good.example/x">좋은 링크</a><table><tr><td colspan="2">표 칸</td></tr></table>';
  await request.post(`${MAIL}/inbox`, { data: { raw: ['From: 안내 <info@html.kr>', `Subject: =?UTF-8?B?${b64('HTML 안내 메일')}?=`, 'Message-ID: <h1@html.kr>', 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html), ''].join('\r\n') } });
  await login(page, CODE_C);
  await page.evaluate(async () => { await fetch('/api/mail/sync', { method: 'POST', body: '{}' }); });
  const blocked: string[] = [];
  page.on('request', r => { if (r.url().includes('tracker.example')) blocked.push(r.url()); });
  await page.getByRole('button', { name: /^메일(\s|$)/ }).click();
  await page.getByRole('tab', { name: '전체' }).click();
  await page.getByRole('complementary', { name: '메일 목록' }).getByRole('button', { name: /HTML 안내 메일/ }).click();
  const reader = page.getByRole('region', { name: '메일 읽기' });
  const body = reader.locator('.mail-html');
  await expect(body.locator('b')).toHaveText('강조된 안내');
  await expect(body.locator('div').first()).toHaveCSS('color', 'rgb(47, 111, 214)');
  await expect(body).toContainText('[이미지: 로고]');
  await expect(body.locator('img, script')).toHaveCount(0);
  await expect(body.getByText('나쁜 링크')).not.toHaveAttribute('href', /.*/);
  await expect(body.getByRole('link', { name: '좋은 링크' })).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(body.locator('td')).toHaveAttribute('colspan', '2');
  expect(await page.evaluate(() => (window as unknown as { __hacked?: number }).__hacked)).toBeUndefined();
  expect(blocked).toEqual([]);
  await reader.getByRole('button', { name: '글만 보기' }).click();
  await expect(reader.locator('.mail-body')).toContainText('강조된 안내');

  // 새 메일: 받는 사람·제목·서식 있는 내용 → 보내기 확정 → '보낸 메일'
  await page.getByRole('button', { name: '새 메일' }).click();
  const compose = page.getByRole('region', { name: '새 메일 쓰기' });
  await compose.getByLabel('받는 사람').fill('brand@shop.kr');
  await compose.getByLabel('제목').fill('[협찬 제안] 토몽이 블로그입니다');
  await compose.getByRole('textbox', { name: '메일 내용' }).click();
  await page.keyboard.type('안녕하세요, 제안드립니다.');
  await page.keyboard.press('ControlOrMeta+A');
  await compose.getByLabel('글자 크기').selectOption('l');
  await compose.getByRole('button', { name: '보내기', exact: true }).click();
  await compose.getByRole('button', { name: '보내기 확정' }).click();
  await expect(page.getByRole('tab', { name: '보낸 메일' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('complementary', { name: '메일 목록' })).toContainText('받는 사람: brand@shop.kr');
  const sent = await (await request.get(`${MAIL}/sent`)).json();
  expect(sent.at(-1)).toMatchObject({ to: 'brand@shop.kr' });
  expect(sent.at(-1).data).toContain('multipart/alternative');
  // 잘못된 받는 사람·제목 줄바꿈은 서버가 막는다
  const bad = await page.evaluate(async () => [
    (await fetch('/api/mail/compose', { method: 'POST', body: JSON.stringify({ to: 'a@b.kr, c@d.kr', subject: 'x', doc: [{ type: 'p', runs: [{ t: 'x' }] }] }) })).status,
    (await fetch('/api/mail/compose', { method: 'POST', body: JSON.stringify({ to: 'a@b.kr', subject: 'x', doc: [{ type: 'script' }] }) })).status,
  ]);
  expect(bad).toEqual([400, 400]);
});

test('네이버·Gmail을 한 메일함에: 같은 번호도 겹치지 않고, 계정 표시, 답장은 받은 계정으로, 새 메일은 고른 계정으로', async ({ page, request }) => {
  await request.post(`${MAIL}/reset`);
  await request.post(`${GMAIL}/reset`);
  // 두 계정에 같은 번호(UID)의 메일을 넣는다(실제로도 계정마다 번호를 따로 센다)
  const n = await (await request.post(`${MAIL}/inbox`, { data: { uid: 5000, raw: raw({ from: '네이버빵집 <hi@nbread.kr>', subject: '[협찬 제안] 네이버로 온 제안', body: '체험 제안드려요.', id: '<nv1@nbread.kr>' }) } })).json();
  const g = await (await request.post(`${GMAIL}/inbox`, { data: { uid: 5000, raw: raw({ from: '지메일카페 <hi@gcafe.kr>', subject: '[협찬 제안] Gmail로 온 제안', body: '체험 제안드려요.', id: '<gm1@gcafe.kr>' }) } })).json();
  expect([n.uid, g.uid]).toEqual([5000, 5000]);

  await login(page, CODE_C);
  const synced = await page.evaluate(async () => (await fetch('/api/mail/sync', { method: 'POST', body: '{}' })).json());
  expect(synced.error).toBeFalsy();
  const bySubject = (s: string) => synced.mails.find((m: { subject: string }) => m.subject.includes(s));
  expect(bySubject('네이버로 온')).toMatchObject({ account: 'naver', kind: 'offer' });
  expect(bySubject('Gmail로 온')).toMatchObject({ account: 'gmail', kind: 'offer' });
  expect(synced.accounts).toEqual([{ provider: 'naver', address: 'c-***@naver.com' }, { provider: 'gmail', address: 'c-***@gmail.com' }]);

  // 화면: 계정 표시, Gmail로 받은 메일의 답장은 Gmail로 나간다
  await page.getByRole('button', { name: /^메일(\s|$)/ }).click();
  const rows = page.getByRole('complementary', { name: '메일 목록' });
  await expect(rows.getByRole('button', { name: /Gmail로 온 제안/ })).toContainText('Gmail');
  await expect(rows.getByRole('button', { name: /네이버로 온 제안/ })).toContainText('네이버');
  await rows.getByRole('button', { name: /Gmail로 온 제안/ }).click();
  const reader = page.getByRole('region', { name: '메일 읽기' });
  await expect(reader).toContainText('Gmail로 받음');
  await reader.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(reader.getByRole('group', { name: '보내기 확인' })).toContainText('Gmail으로');
  await reader.getByRole('button', { name: '보내기 확정' }).click();
  await expect(reader).toContainText('답장을 보냈어요');
  expect(await (await request.get(`${GMAIL}/sent`)).json()).toEqual([expect.objectContaining({ from: 'c-test@gmail.com', to: 'hi@gcafe.kr' })]);
  expect(await (await request.get(`${MAIL}/sent`)).json()).toEqual([]);

  // 새 메일: 보내는 계정을 Gmail로 고르면 Gmail로, 이상한 계정 값은 거절
  await page.getByRole('button', { name: '새 메일' }).click();
  const compose = page.getByRole('region', { name: '새 메일 쓰기' });
  await compose.getByRole('group', { name: '보내는 계정' }).getByRole('button', { name: /Gmail/ }).click();
  await compose.getByLabel('받는 사람').fill('brand@gshop.kr');
  await compose.getByLabel('제목').fill('Gmail로 보내는 제안');
  await compose.getByRole('textbox', { name: '메일 내용' }).click();
  await page.keyboard.type('안녕하세요.');
  await compose.getByRole('button', { name: '보내기', exact: true }).click();
  await compose.getByRole('button', { name: '보내기 확정' }).click();
  await expect(page.getByRole('tab', { name: '보낸 메일' })).toHaveAttribute('aria-selected', 'true');
  expect((await (await request.get(`${GMAIL}/sent`)).json()).at(-1)).toMatchObject({ from: 'c-test@gmail.com', to: 'brand@gshop.kr' });
  expect(await page.evaluate(async () => (await fetch('/api/mail/compose', { method: 'POST', body: JSON.stringify({ to: 'a@b.kr', subject: 'x', doc: [{ type: 'p', runs: [{ text: 'x' }] }], from: 'daum' }) })).status)).toBe(400);

  // 다시 받아도 겹치지 않는다(계정마다 받은 위치를 따로 기억)
  const again = await page.evaluate(async () => (await fetch('/api/mail/sync', { method: 'POST', body: '{}' })).json());
  expect(again.added).toBe(0);

  await page.evaluate(async () => { for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) if (/네이버로 온|Gmail로 온/.test(c.memo)) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' }); });
});
