// 올리기 보조: 네이버·티스토리 글쓰기에 붙여 넣을 글과 사진 파일 이름을 만든다.

/** 본문의 [사진 n] 표시를 붙여 넣은 뒤 눈에 잘 띄는 '📷 사진 n'으로 바꾼다(그 자리에 사진을 넣으면 됨). */
export const pasteBody = (body: string) => body.replace(/\[사진\s*(\d+)\]/g, '📷 사진 $1').trim();
export const hashtagLine = (tags: string[]) => tags.map(t => `#${t}`).join(' ');
export const fullText = (title: string, body: string, tags: string[]) => [title.trim(), pasteBody(body), hashtagLine(tags)].filter(Boolean).join('\n\n');

/** 사진 파일 이름: 'minilog_20261124_01.jpg'. 번호 순서 = 글 순서.
 *  한글 이름은 일부 브라우저(헤드리스 Chrome 등)에서 'download'로 바뀌어 영문·숫자만 쓴다. */
export function photoFileName(index: number, now = Date.now()) {
  const day = new Date(now + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, '');
  return `minilog_${day}_${String(index + 1).padStart(2, '0')}.jpg`;
}
