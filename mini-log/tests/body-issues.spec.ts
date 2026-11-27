import { expect, test } from '@playwright/test';
import { CODE_D } from '../playwright.config';
import { findIssues } from '../src/bodyIssues';
import { login } from './helpers';

test('본문 문제 위치: 확인 필요·지어낸 숫자·상투 표현·긴 문장을 자리째 찾고, 겹치면 급한 것만 남긴다', () => {
  const body = '성수동 소금빵 가게에 다녀왔어요. 가격은 4,500원이었어요.\n[작성자 확인 필요]\n결론적으로 정말 좋았어요. 이 가게는 골목 안쪽에 있어서 처음 가는 사람은 지도를 보고도 한참을 헤맬 수 있는데 저도 두 바퀴를 돌았어요.';
  const issues = findIssues(body, '소금빵 맛있었다');
  const of = (k: string) => issues.filter(i => i.kind === k).map(i => body.slice(i.start, i.end));
  expect(of('unsure')).toEqual(['[작성자 확인 필요]']);
  expect(of('fact')).toEqual(['4,500원']);
  expect(of('cliche')).toEqual(['결론적으로']);
  expect(of('long')).toHaveLength(1);
  expect(of('long')[0]).toMatch(/^이 가게는 골목 안쪽에/);
  // 경험 칸에 그 숫자가 있으면 사실 확인으로 잡지 않는다
  expect(findIssues(body, '빵 4500원').filter(i => i.kind === 'fact')).toHaveLength(0);
  // 자리가 겹치지 않는다
  for (let i = 1; i < issues.length; i++) expect(issues[i].start).toBeGreaterThanOrEqual(issues[i - 1].end);
});

test('원고 본문에 밑줄이 그어지고, 다음 문제를 누르면 그 부분이 골라진다', async ({ page }) => {
  await login(page, CODE_D);
  await page.getByRole('button', { name: '새 원고' }).click();
  const body = page.getByLabel('본문');
  await body.fill('첫 문장이에요.\n[작성자 확인 필요]\n결론적으로 좋았어요.');
  await expect(page.getByText('본문에 살펴볼 곳')).toContainText('2');
  await expect(page.locator('.body-mirror mark.issue-unsure')).toHaveText('[작성자 확인 필요]');
  await page.getByRole('button', { name: '다음 문제' }).click();
  await expect(page.locator('.issue-pos')).toHaveText('1 / 2');
  await expect(page.locator('.issue-reason')).toContainText('확인 필요');
  expect(await body.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd))).toBe('[작성자 확인 필요]');
  await page.getByRole('button', { name: '다음 문제' }).click();
  expect(await body.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd))).toBe('결론적으로');
  // 고치면 밑줄이 사라진다
  await body.fill('첫 문장이에요.\n둘째 줄은 직접 겪은 이야기예요.');
  await expect(page.getByText('본문에 표시할 문제가 없어요')).toBeVisible();
  // 밑줄 끄기는 계정에 기억된다: 새로고침해도, 다른 기기(새 브라우저)에서도 꺼져 있다
  await page.getByRole('button', { name: '밑줄 끄기' }).click();
  await expect(page.locator('.body-mirror')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: '밑줄 켜기' })).toBeVisible();
  const other = await page.context().browser()!.newContext();
  const phone = await other.newPage();
  await login(phone, CODE_D);
  await phone.getByRole('button', { name: '새 원고' }).click();
  await expect(phone.getByRole('button', { name: '밑줄 켜기' })).toBeVisible();
  await other.close();
  await page.getByRole('button', { name: '밑줄 켜기' }).click();
  await expect.poll(async () => page.evaluate(async () => (await (await fetch('/api/prefs')).json()).marks_off)).toBe(false);
});

test('겹쳐 그린 글이 본문 칸과 같은 자리에 놓인다(밑줄이 글자 아래에 맞음)', async ({ page }) => {
  await login(page, CODE_D);
  await page.getByRole('button', { name: '새 원고' }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 860 });
    const long = Array.from({ length: 40 }, (_, i) => `${i + 1}번째 줄 결론적으로 이어지는 글이에요.`).join('\n');
    await page.getByLabel('본문').fill(long);
    const box = (sel: string) => page.locator(sel).evaluate(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), s.fontSize, s.lineHeight, s.paddingLeft, (el as HTMLElement).clientWidth]; });
    expect(await box('.body-mirror')).toEqual(await box('textarea#body'));
    // 맨 아래로 내려도 같이 움직인다
    await page.getByLabel('본문').evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
    const tops = await page.evaluate(() => [document.querySelector('textarea#body')!.scrollTop, document.querySelector('.body-mirror')!.scrollTop]);
    expect(Math.abs(tops[0] - tops[1])).toBeLessThanOrEqual(1);
  }
});
