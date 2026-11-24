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

/** 인스타그램 글(규칙): 제목 한 줄 + 본문(사진 표시 빼고, 문단 사이 빈 줄) + 해시태그 30개까지. 인스타 글자 한도 2,200자 안으로. */
export function instagramText(title: string, body: string, tags: string[], caption?: string) {
  const strip = (t: string) => t.replace(/[ \t]*\[사진\s*\d*\][ \t]*/g, '').split('\n').map(l => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const text = strip(caption ?? [title.trim(), body].filter(Boolean).join('\n\n'));
  const line = [...new Set(tags.map(t => t.replace(/^#+/, '').replace(/\s+/g, '')).filter(Boolean))].slice(0, 30).map(t => `#${t}`).join(' ');
  const room = 2200 - (line ? line.length + 2 : 0);
  const cut = text.length > room ? `${text.slice(0, Math.max(0, room - 1)).trimEnd()}…` : text;
  return [cut, line].filter(Boolean).join('\n\n');
}
