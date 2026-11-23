import { expect, test } from '@playwright/test';
import { renumberMarkers } from '../src/photoMarkers';

test('사진 순서를 바꾸면 본문 [사진 n] 번호가 따라 바뀐다', () => {
  const body = '처음\n[사진 1]\n가운데 [사진 2] 글\n[사진 3]\n끝 [사진] [사진 9]';
  expect(renumberMarkers(body, ['a', 'b', 'c'], ['c', 'a', 'b'])).toBe('처음\n[사진 2]\n가운데 [사진 3] 글\n[사진 1]\n끝 [사진] [사진 9]');
});

test('사진을 지우면 그 표시는 없어지고 뒤 번호가 당겨진다', () => {
  const body = '처음\n[사진 1]\n가운데 [사진 2] 글\n[사진 3]';
  expect(renumberMarkers(body, ['a', 'b', 'c'], ['a', 'c'])).toBe('처음\n[사진 1]\n가운데 글\n[사진 2]');
  expect(renumberMarkers(body, ['a', 'b', 'c'], ['b', 'c'])).toBe('처음\n가운데 [사진 1] 글\n[사진 2]');
});
