import { expect, test, type Page } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

const kst = (days: number) => new Date(Date.now() + 9 * 3600000 + days * 86400000).toISOString().slice(0, 10);
const call = (page: Page, path: string, method = 'GET', body?: unknown) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p as string, { method: m as string, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
  return { status: r.status, data: await r.json().catch(() => null) };
}, [path, method, body] as const);

test('캘린더 한눈에: 놓친 것·오늘·이번 주·그 뒤로 할 일을 한 목록에, 날짜를 누르면 달력으로, 달을 넘기면 고른 날도 그 달로', async ({ page }) => {
  await login(page, CODE_C);
  const make = async (title: string, planned_on: string) => { const id = (await call(page, '/api/drafts', 'POST', {})).data.draft.id; await call(page, `/api/drafts/${id}`, 'PUT', { title, planned_on }); return id; };
  const ids = [await make('놓친 한눈 원고', kst(-2)), await make('오늘 한눈 원고', kst(0)), await make('나중 한눈 원고', kst(20))];
  const camp = (await call(page, '/api/campaigns', 'POST', { brand: '한눈빵집', status: 'in_progress', deadline: kst(20) })).data.campaign.id;
  await page.reload();
  await page.goto('/#calendar');
  const agenda = page.getByRole('region', { name: /할 일 한눈에/ });
  await expect(page.getByRole('tab', { name: '한눈에' })).toHaveAttribute('aria-selected', 'true');
  await expect(agenda.getByRole('group', { name: '놓친 것' })).toContainText('놓친 한눈 원고');
  await expect(agenda.getByRole('group', { name: '오늘' })).toContainText('오늘 한눈 원고');
  const later = agenda.getByRole('group', { name: '그 뒤(30일까지)' });
  await expect(later).toContainText('나중 한눈 원고');
  await expect(later).toContainText('한눈빵집');
  // 원고 바로 열기
  await agenda.locator('.cal-list li', { hasText: '오늘 한눈 원고' }).getByRole('button', { name: '원고 열기' }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('오늘 한눈 원고');
  // 날짜를 누르면 그 날의 달력
  await page.goto('/#calendar');
  await page.getByRole('region', { name: /할 일 한눈에/ }).locator('.cal-list li', { hasText: '나중 한눈 원고' }).getByRole('button', { name: /달력에서 보기/ }).click();
  await expect(page.getByRole('tab', { name: '달력' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { selected: true })).toHaveAccessibleName(new RegExp(`^${Number(kst(20).slice(5, 7))}월 ${Number(kst(20).slice(8))}일`));
  // 달을 넘기면 고른 날도 그 달 1일로(목록과 달이 어긋나지 않게)
  await page.getByRole('button', { name: '다음 달' }).click();
  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(page.getByRole('gridcell', { selected: true })).toHaveAccessibleName(/월 1일,/);
  // 인스타 격자는 접혀 있다가 펼친다
  await page.getByRole('button', { name: '인스타 격자 보기' }).click();
  await expect(page.getByRole('button', { name: '인스타 격자 접기' })).toBeVisible();
  for (const id of ids) await call(page, `/api/drafts/${id}`, 'DELETE');
  await call(page, `/api/campaigns/${camp}`, 'DELETE');
});

test('원고 여러 개 골라 지우기와 한 번에 되돌리기, 남의 원고는 못 지움', async ({ page, browser }) => {
  await login(page, CODE_D);
  const ids: string[] = [];
  for (const t of ['정리 시험 1', '정리 시험 2', '남길 원고']) { const id = (await call(page, '/api/drafts', 'POST', {})).data.draft.id; await call(page, `/api/drafts/${id}`, 'PUT', { title: t }); ids.push(id); }
  await page.reload();
  const list = page.getByRole('navigation', { name: '원고' });
  await page.getByRole('button', { name: '여러 개 지우기' }).click();
  await list.getByLabel(/정리 시험 1/).check();
  await list.getByLabel(/정리 시험 2/).check();
  await page.getByRole('button', { name: '2개 지우기' }).click();
  await expect(page.getByText('원고 2개를 지웠어요')).toBeVisible();
  await expect(list).not.toContainText('정리 시험');
  await expect(list).toContainText('남길 원고');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(list).toContainText('정리 시험 1');
  await expect(list).toContainText('정리 시험 2');
  // 남의 원고는 지울 수 없다
  const other = await browser.newPage();
  await login(other, CODE_C);
  expect((await call(other, `/api/drafts/${ids[0]}`, 'DELETE')).status).toBe(404);
  await other.close();
  for (const id of ids) await call(page, `/api/drafts/${id}`, 'DELETE');
});

test('메일은 미니로그에서만 지우고 10분 안에 되돌리고, 남의 메일은 못 지움', async ({ page, request, browser }) => {
  await login(page, CODE_C);
  const MAIL = 'http://127.0.0.1:8905';
  await request.post(`${MAIL}/inbox`, { data: { raw: ['From: 지울곳 <bye@del.kr>', 'Subject: delete me', 'Message-ID: <del1@del.kr>', 'Content-Type: text/plain; charset=UTF-8', '', '지울 메일이에요.', ''].join('\r\n') } });
  await page.evaluate(async () => { await fetch('/api/mail/sync', { method: 'POST', body: '{}' }); });
  const mail = (await call(page, '/api/mail')).data.mails.find((m: { subject: string }) => m.subject === 'delete me');
  expect(mail).toBeTruthy();
  const other = await browser.newPage();
  await login(other, CODE_D);
  expect((await call(other, `/api/mail/${mail.id}`, 'DELETE')).status).toBe(404);
  await other.close();
  await page.goto('/#mail');
  await page.getByRole('tab', { name: '전체' }).click();
  await page.getByRole('button', { name: /delete me/ }).first().click();
  await page.getByRole('button', { name: '미니로그에서 지우기' }).click();
  await expect(page.getByText("'delete me' 메일을 지웠어요")).toBeVisible();
  expect((await call(page, '/api/mail')).data.mails.some((m: { id: string }) => m.id === mail.id)).toBe(false);
  // 다시 받아도 돌아오지 않는다
  await page.evaluate(async () => { await fetch('/api/mail/sync', { method: 'POST', body: '{}' }); });
  expect((await call(page, '/api/mail')).data.mails.some((m: { subject: string }) => m.subject === 'delete me')).toBe(false);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(async () => (await call(page, '/api/mail')).data.mails.some((m: { id: string }) => m.id === mail.id)).toBe(true);
  await call(page, `/api/mail/${mail.id}`, 'DELETE');
});

test('다음 할 일: 원고 화면 진행 막대가 끝난 단계에 ✓, 다음 단계 하나를 버튼으로, 첫 화면은 쓰던 원고 이어 쓰기', async ({ page }) => {
  await login(page, CODE_D);
  const id = (await call(page, '/api/drafts', 'POST', {})).data.draft.id;
  await call(page, `/api/drafts/${id}`, 'PUT', { title: '다음할일 시험 원고' });
  await page.reload();
  // 첫 화면: 급한 일이 없으면 쓰던 원고 이어 쓰기
  const brief = page.getByRole('region', { name: /좋은 하루예요/ });
  await brief.getByRole('button', { name: /‘다음할일 시험 원고’ 이어 쓰기/ }).click();
  const steps = page.getByRole('navigation', { name: '원고 진행 단계' });
  await expect(steps.getByRole('button', { name: /경험/ })).toHaveAttribute('aria-current', 'step');
  await expect(steps.getByRole('button', { name: /다음: 겪은 일 적기/ })).toBeVisible();
  // 경험·본문을 채우면 다음은 점검·승인
  await call(page, `/api/drafts/${id}`, 'PUT', { experience: '토요일 오전에 다녀옴', body: '소금빵이 맛있었어요.' });
  await page.reload();
  await expect(steps.getByRole('button', { name: /점검·승인/ })).toHaveAttribute('aria-current', 'step');
  await expect(steps.locator('li.done')).toHaveCount(2); // 경험·초안(사진은 선택)
  await call(page, `/api/drafts/${id}`, 'PUT', { status: 'published', published_url: 'https://blog.naver.com/x/1' });
  await page.reload();
  await expect(steps).toContainText('다 끝났어요');
  await call(page, `/api/drafts/${id}`, 'DELETE');
});

test('보는 계정(전체·네이버·구글): 메일을 계정별로 거르고, 한 화면에서 고르면 캘린더·블로그도 같이, 기본은 전체', async ({ page, request }) => {
  await login(page, CODE_C);
  const raw = (from: string, subject: string, id: string) => [`From: ${from}`, `Subject: ${subject}`, `Message-ID: ${id}`, 'Content-Type: text/plain; charset=UTF-8', '', '본문', ''].join('\r\n');
  await request.post('http://127.0.0.1:8905/inbox', { data: { raw: raw('네이버쪽 <n@src.kr>', 'source naver mail', '<sn1@src.kr>') } });
  await request.post('http://127.0.0.1:8915/inbox', { data: { raw: raw('구글쪽 <g@src.kr>', 'source gmail mail', '<sg1@src.kr>') } });
  await page.evaluate(async () => { await fetch('/api/mail/sync', { method: 'POST', body: '{}' }); });
  await page.goto('/#mail');
  await page.getByRole('tab', { name: '전체' }).click();
  const sw = page.getByRole('group', { name: '보는 계정' });
  await expect(sw.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
  const rows = page.getByRole('complementary', { name: '메일 목록' });
  await expect(rows).toContainText('source naver mail');
  await expect(rows).toContainText('source gmail mail');
  await sw.getByRole('button', { name: '네이버' }).click();
  await expect(rows).toContainText('source naver mail');
  await expect(rows).not.toContainText('source gmail mail');
  await sw.getByRole('button', { name: '구글' }).click();
  await expect(rows).toContainText('source gmail mail');
  await expect(rows).not.toContainText('source naver mail');
  // 다른 화면도 같은 계정, 새로고침해도 기억
  await page.goto('/#calendar');
  await page.reload();
  await expect(page.getByRole('group', { name: '보는 계정' }).getByRole('button', { name: '구글' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: '보는 계정' })).toContainText('구글 일정만');
  await page.getByRole('group', { name: '보는 계정' }).getByRole('button', { name: '전체' }).click();
  for (const m of (await call(page, '/api/mail')).data.mails as { id: string; subject: string }[]) if (m.subject.startsWith('source ')) await call(page, `/api/mail/${m.id}`, 'DELETE');
});

test('오늘 보드: 다가오는 7일·답장할 메일·진행 흐름·요약이 한 화면에, 누르면 그 화면으로', async ({ page }) => {
  await login(page, CODE_C);
  const draft = (await call(page, '/api/drafts', 'POST', {})).data.draft.id;
  await call(page, `/api/drafts/${draft}`, 'PUT', { title: '오늘보드 원고', planned_on: kst(2), experience: '다녀옴', body: '본문' });
  const camp = (await call(page, '/api/campaigns', 'POST', { brand: '오늘보드카페', status: 'posted', amount: 40000, deadline: kst(3) })).data.campaign.id;
  await page.reload();
  const board = page.getByLabel('오늘 보드');
  const week = board.getByRole('region', { name: '다가오는 7일' });
  await expect(week).toContainText('오늘보드 원고 게시');
  await expect(week).toContainText('오늘보드카페 마감');
  const flow = board.getByRole('region', { name: /진행 흐름/ });
  const campRow = flow.locator('.flow-row', { hasText: '오늘보드카페' });
  await expect(campRow.getByRole('button', { name: '입금 확인 ▶' })).toBeVisible();
  const draftRow = flow.locator('.flow-row', { hasText: '오늘보드 원고' });
  await expect(draftRow.getByRole('button', { name: '점검·승인 ▶' })).toBeVisible();
  await expect(board.getByRole('region', { name: '받을 돈' })).toContainText('40,000원');
  await expect(board.getByRole('region', { name: '연결 계정' })).toContainText('네이버 메일 ✓');
  // 진행 흐름에서 지금 단계를 누르면 그 화면으로
  await draftRow.getByRole('button', { name: '점검·승인 ▶' }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('오늘보드 원고');
  await page.goto('/');
  await page.getByLabel('오늘 보드').locator('.flow-row', { hasText: '오늘보드카페' }).getByRole('button', { name: '입금 확인 ▶' }).click();
  await expect(page.getByRole('heading', { name: '협찬·수익' })).toBeVisible();
  await call(page, `/api/campaigns/${camp}`, 'DELETE');
  await call(page, `/api/drafts/${draft}`, 'DELETE');
});
