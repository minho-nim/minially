import { expect, test } from '@playwright/test';
import { threadsText, xLength, xText, X_LIMIT, THREADS_LIMIT, composeUrl } from '../src/publishKit';

test('X 글자 수는 한글 2·주소 23으로 세고, 길면 문장 단위로 잘라 280 안에 맞춘다', () => {
  expect(xLength('abc')).toBe(3);
  expect(xLength('가나다')).toBe(6);
  expect(xLength('보기 https://blog.naver.com/a/123456789012')).toBe(4 + 1 + 23);
  const long = '소금빵이 정말 바삭하고 맛있었어요. '.repeat(20);
  const t = xText(long, '', ['빵', '카페'], 'https://blog.naver.com/a/1');
  expect(xLength(t)).toBeLessThanOrEqual(X_LIMIT);
  expect(t.endsWith('https://blog.naver.com/a/1 #빵')).toBe(true);
  expect(t).toContain('…');
});

test('스레드는 500자 안에 태그 1개와 주소, [사진] 표시는 빼고 composeUrl은 글을 주소에 넣는다', () => {
  const t = threadsText('제목', '첫 줄 [사진 1]\n\n\n둘째 줄. '.repeat(80), ['#빵', '카페'], 'https://x.test/p');
  expect(t.length).toBeLessThanOrEqual(THREADS_LIMIT);
  expect(t).not.toContain('[사진');
  expect(t.endsWith('https://x.test/p\n#빵')).toBe(true);
  expect(composeUrl('threads', 'a b&c')).toBe('https://www.threads.net/intent/post?text=a%20b%26c');
});
