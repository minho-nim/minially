import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { defaultDm, defaultMail, instagramDmHref, mailtoHref, priceLine, sentence, type ProposalForm, type ProposalStats } from '../src/proposalKit';

const form: ProposalForm = { blog_name: '토몽이의 동네 기록', topic: '동네 카페', intro: '솔직한 동네 기록', about: '', audience: '', strengths: '', offers: '- 체험단\n- 제품 리뷰', cases: '', price: '원고료 10만 원부터', show_price: false, contact_email: 'me@example.com', contact_extra: '' };
const stats: ProposalStats = { blogs: ['myblog'], posts_total: 12, posts_per_month: 4, avg_views: 1234, with_stats: 5, top: [], tags: [], sponsor_done: 2, brands: [] };

test('기본 메일·단가 문장·메일 앱 주소(규칙, AI 없이)', () => {
  expect(priceLine(form)).toBe(''); // 단가는 켤 때만
  expect(priceLine({ ...form, show_price: true })).toBe('원고료 10만 원부터 (협의 가능)');
  expect(priceLine({ ...form, show_price: true, price: '협의' })).toBe('협의');
  const mail = defaultMail(form, stats, '토마토', '○○카페', '겨울 신메뉴');
  expect(mail.subject).toBe('[협찬 제안] 토몽이의 동네 기록 블로그 × ○○카페');
  expect(mail.body).toContain('안녕하세요, ○○카페 담당자님.');
  expect(mail.body).toContain('동네 카페 블로그 「토몽이의 동네 기록」을 운영하는 토마토입니다. 솔직한 동네 기록이에요.');
  expect(sentence('카페 다니는 블로그')).toBe('카페 다니는 블로그예요.');
  expect(sentence('매주 새 글을 써요.')).toBe('매주 새 글을 써요.');
  expect(mail.body).toContain('한 달에 4개 정도 글을 올리고 있어요, 글 평균 조회수는 1,234회예요.');
  expect(mail.body).toContain('겨울 신메뉴를 직접 경험하고');
  expect(defaultMail(form, stats, '토마토', 'A', '앰플').body).toContain('앰플을 직접');
  expect(defaultMail(form, stats, '토마토', 'A', 'iPhone').body).toContain('iPhone을(를) 직접');
  expect(mail.body).toContain('- 체험단\n- 제품 리뷰');
  expect(mail.body).not.toContain('진행 비용');
  expect(defaultMail({ ...form, show_price: true }, stats, '토마토', '○○카페', '').body).toContain('진행 비용: 원고료 10만 원부터 (협의 가능)');
  expect(mail.body).toContain('블로그 소개서(PDF)를 첨부했어요.');
  expect(mailtoHref('a@b.co', '제목', '본문')).toBe('mailto:a%40b.co?subject=%EC%A0%9C%EB%AA%A9&body=%EB%B3%B8%EB%AC%B8');
  expect(decodeURIComponent(mailtoHref('a@b.co', 's', 'x'.repeat(3000)).split('body=')[1]).length).toBe(1800);
});

test('인스타 DM 기본 글·DM 주소', () => {
  const dm = defaultDm(form, stats, '토마토', '○○카페', '겨울 신메뉴');
  expect(dm).toContain('안녕하세요, ○○카페 담당자님!');
  expect(dm).toContain('겨울 신메뉴를 직접 경험하고');
  expect(dm).toContain('한 달에 4개 정도 글을 올리고, 글 평균 조회수는 1,234회예요.');
  expect(dm).toContain('메일로 보내 드릴게요(me@example.com)');
  expect(dm.length).toBeLessThan(300);
  expect(defaultDm(form, stats, '토마토', '○○카페', '')).toContain('○○카페의 제품·서비스를 직접');
  expect(instagramDmHref('@cafe_example')).toBe('https://ig.me/m/cafe_example');
  expect(instagramDmHref('https://www.instagram.com/cafe.ex/?hl=ko')).toBe('https://ig.me/m/cafe.ex');
  expect(instagramDmHref('나쁜 아이디!')).toBeNull();
});

test('제안서: AI 초안 → 고치고 저장 → 미리보기·PDF(단가 옵션) → 메일 본문 수정·AI 다듬기·메일 앱', async ({ page, browser }) => {
  await login(page, CODE_C);
  const ids = await page.evaluate(async () => {
    const send = (url: string, method: string, body: unknown) => fetch(url, { method, body: JSON.stringify(body) }).then(r => r.json());
    await send('/api/blog', 'POST', { blog_id: 'myblog' });
    await send('/api/blog/sync', 'POST', { blog_id: 'myblog' });
    await send('/api/blog/posts/223000000001', 'PUT', { views: '1200', likes: '30', comments: '4' });
    await send('/api/blog/posts/223000000002', 'PUT', { views: '800', likes: '20', comments: '2' });
    await send('/api/blog/posts/223000000003', 'PUT', { views: '100', likes: '1', comments: '0' });
    return [(await send('/api/campaigns', 'POST', { kind: 'sponsor', brand: '보고시험카페', title: '체험단', amount: 0, status: 'posted' })).campaign.id as string];
  });
  const stats = await page.evaluate(async () => (await (await fetch('/api/proposal')).json()).stats);
  expect(stats.top[0].title).toBe('동네 빵집 소금빵 후기');
  expect(stats.brands).toContain('보고시험카페');

  await page.getByRole('button', { name: '협찬', exact: true }).click();
  await page.getByRole('button', { name: '제안서·메일 만들기' }).click();
  await expect(page).toHaveURL(/#proposal$/);
  await expect(page.getByRole('heading', { name: '협찬 제안서' })).toBeVisible();

  // AI 초안: 실제 숫자(평균 조회수)와 실제 협찬 업체만
  await page.getByRole('button', { name: 'AI로 초안 쓰기' }).click();
  await expect(page.getByLabel('블로그 이름')).toHaveValue('토몽이의 동네 기록');
  await expect(page.getByLabel('블로그 소개')).toHaveValue(`평균 조회수 ${stats.avg_views} 기준으로 소개해요.`);
  await expect(page.getByLabel('진행 사례')).toHaveValue('- 보고시험카페 체험단');
  await page.getByLabel('한 줄 소개').fill('직접 가 보고 쓰는 솔직한 동네 기록');
  await page.getByLabel('연락받을 이메일').fill('tomong@example.com');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '저장했어요' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('한 줄 소개')).toHaveValue('직접 가 보고 쓰는 솔직한 동네 기록');

  // 미리보기: 숫자·대표 글, 단가는 켤 때만
  const doc = page.locator('.proposal-doc');
  await expect(doc.locator('.pd-name')).toHaveText('토몽이의 동네 기록');
  await expect(doc).toContainText('동네 빵집 소금빵 후기');
  await expect(doc).not.toContainText('진행 비용');
  await page.getByLabel('단가 넣기(제안서·메일)').check();
  await page.getByLabel('단가', { exact: true }).fill('원고료 10만 원부터');
  await expect(doc).toContainText('원고료 10만 원부터 (협의 가능)');

  // PDF 서식: 제안서만 보인다
  await page.emulateMedia({ media: 'print' });
  await expect(doc).toBeVisible();
  await expect(page.getByLabel('블로그 이름')).toBeHidden();
  await expect(page.locator('#p-mail')).toBeHidden();
  await expect(page.locator('.side')).toBeHidden();
  expect((await page.pdf({ format: 'A4' })).byteLength).toBeGreaterThan(10000);
  await page.emulateMedia({ media: 'screen' });

  // 메일: 업체 이름만 넣어도 기본 본문, 고치면 유지, AI로 다듬기, 메일 앱 주소
  await page.getByLabel('업체 이름').fill('○○카페');
  await expect(page.getByLabel('제목')).toHaveValue('[협찬 제안] 토몽이의 동네 기록 블로그 × ○○카페');
  await expect(page.getByLabel('본문')).toHaveValue(/진행 비용: 원고료 10만 원부터 \(협의 가능\)/);
  await expect(page.getByRole('button', { name: '메일 앱 열기' })).toBeDisabled();
  await page.getByLabel('업체 이메일').fill('partner@example.com');
  await page.getByLabel('본문').fill('제가 직접 고친 본문이에요.');
  await page.getByLabel('제안할 제품·서비스(선택)').fill('신메뉴');
  await expect(page.getByLabel('본문')).toHaveValue('제가 직접 고친 본문이에요.'); // 고친 건 덮지 않음
  await page.getByRole('button', { name: 'AI로 다듬기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('[협찬 제안] ○○카페님께 (다듬음)');
  const href = await page.getByRole('link', { name: '메일 앱 열기' }).getAttribute('href');
  expect(href).toMatch(/^mailto:partner%40example\.com\?subject=/);
  expect(decodeURIComponent(href!.split('body=')[1])).toContain('다듬은 본문이에요');
  await page.getByRole('button', { name: '기본 본문으로 되돌리기' }).click();
  await expect(page.getByLabel('본문')).toHaveValue(/신메뉴를 직접 경험하고/);

  // 이번 제안용으로 고치기: 미리보기·메일에는 들어가고 기본 양식은 그대로
  await page.getByRole('button', { name: '이번 제안용으로 고치기' }).click();
  await page.getByLabel('한 줄 소개').fill('○○카페만을 위한 소개');
  await expect(doc).toContainText('○○카페만을 위한 소개');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '기본 양식으로 돌아가기' }).click();
  await expect(page.getByLabel('한 줄 소개')).toHaveValue('직접 가 보고 쓰는 솔직한 동네 기록');
  expect(await page.evaluate(async () => (await (await fetch('/api/proposal')).json()).form.intro)).toBe('직접 가 보고 쓰는 솔직한 동네 기록');

  // 인스타 DM: 짧은 기본 글, 아이디로 DM 열기, AI 다듬기(자연스러운 한국어 규칙 포함)
  await page.getByRole('tab', { name: '인스타 DM' }).click();
  await expect(page.getByLabel('제목')).toHaveCount(0);
  await expect(page.getByLabel(/DM 내용/)).toHaveValue(/안녕하세요, ○○카페 담당자님!/);
  await expect(page.getByRole('button', { name: /인스타 DM 열기/ })).toBeDisabled(); // 아이디를 넣기 전
  await page.getByLabel('업체 인스타 아이디').fill('@cafe_example');
  await expect(page.getByRole('link', { name: /인스타 DM 열기/ })).toHaveAttribute('href', 'https://ig.me/m/cafe_example');
  await page.getByRole('button', { name: 'AI로 다듬기' }).click();
  await expect(page.getByLabel(/DM 내용/)).toHaveValue('안녕하세요! 다듬은 DM이에요. (규칙 적용)');
  await page.getByRole('tab', { name: '메일' }).click();
  await expect(page.getByLabel('제목')).toHaveValue(/\[협찬 제안\]/);

  // 다른 사용자는 C 양식을 못 본다, 잘못된 이메일 400
  const d = await (await browser.newContext()).newPage();
  await login(d, CODE_D);
  const dForm = await d.evaluate(async () => (await (await fetch('/api/proposal')).json()).form);
  expect(dForm.blog_name).toBe('');
  expect(await d.evaluate(async () => (await fetch('/api/proposal', { method: 'PUT', body: JSON.stringify({ contact_email: 'not-an-email' }) })).status)).toBe(400);
  await page.evaluate(async list => { for (const id of list) await fetch(`/api/campaigns/${id}`, { method: 'DELETE' }); }, ids);
});

test('제안서 API는 로그인 없이 쓸 수 없다', async ({ request }) => {
  expect((await request.get('/api/proposal')).status()).toBe(401);
  expect((await request.post('/api/proposal/draft', { data: {} })).status()).toBe(401);
  expect((await request.post('/api/proposal/mail', { data: {} })).status()).toBe(401);
});
