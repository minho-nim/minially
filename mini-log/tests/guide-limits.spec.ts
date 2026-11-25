// 체험단 공고 주소 검사와 본문 크기 제한(서버 없이 함수만 시험)
import { expect, test } from '@playwright/test';
import { isPublicHttps, readCapped } from '../functions/_guide';

test('공개 https 주소만 열고, 끝 점이 붙은 이름·여러 IP 표기 같은 내부 주소는 거절한다', () => {
  const ok = (u: string) => isPublicHttps(new URL(u));
  expect(ok('https://www.revu.net/campaign/1')).toBe(true);
  expect(ok('https://blog.naver.com/x/1')).toBe(true);
  for (const bad of ['http://example.com/', 'https://localhost/', 'https://localhost./', 'https://a.localhost/', 'https://printer.local/', 'https://db.internal/',
    'https://127.0.0.1/', 'https://127.1/', 'https://0x7f.1/', 'https://2130706433/', 'https://[::1]/', 'https://example.com:8443/', 'https://user:pw@example.com/', 'https://intranet/'])
    expect(ok(bad), bad).toBe(false);
});

test('본문은 정한 크기까지만 읽고 나머지는 받지 않는다', async () => {
  let pulled = 0;
  const big = new ReadableStream<Uint8Array>({
    pull(controller) { pulled += 1; controller.enqueue(new TextEncoder().encode('가'.repeat(10_000))); }, // 끝없이 나오는 본문(조각당 30,000바이트)
  });
  const text = await readCapped(new Response(big), 100_000);
  expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(100_002);
  expect(text.startsWith('가가가')).toBe(true);
  expect(pulled).toBeLessThan(10); // 4조각쯤 읽고 멈춤(끝까지 받지 않음)
  expect(await readCapped(new Response('짧은 글'), 100_000)).toBe('짧은 글');
});
