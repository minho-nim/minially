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

/** 본문을 짧은 글용으로: 사진 표시·빈 줄 정리, 문장 단위로 자른다 */
function shortBody(title: string, body: string) {
  return [title.trim(), body.replace(/[ \t]*\[사진\s*\d*\][ \t]*/g, '').replace(/\n{2,}/g, '\n').trim()].filter(Boolean).join('\n\n');
}
function cutTo(text: string, fits: (t: string) => boolean) {
  if (fits(text)) return text;
  const parts = text.split(/(?<=[.!?~요다])\s+/);
  let out = '';
  for (const p of parts) { const next = out ? `${out} ${p}` : p; if (!fits(`${next}…`)) break; out = next; }
  if (!out) { out = text; while (out && !fits(`${out}…`)) out = out.slice(0, -1); }
  return `${out.trimEnd()}…`;
}

/** 스레드: 500자, 주제 태그 1개 권장. 글 주소가 있으면 끝에 붙인다 */
export const THREADS_LIMIT = 500;
export function threadsText(title: string, body: string, tags: string[], url = '', draft?: string) {
  const tag = tags.map(t => t.replace(/^#+/, '').replace(/\s+/g, '')).find(Boolean);
  const tail = [url.trim(), tag ? `#${tag}` : ''].filter(Boolean).join('\n');
  const room = THREADS_LIMIT - (tail ? tail.length + 2 : 0);
  return [cutTo((draft ?? shortBody(title, body)).trim(), t => t.length <= room), tail].filter(Boolean).join('\n\n');
}

/** X 글자 수: 한글·한자·일본어는 2, 주소는 23으로 센다(X 기준) */
export function xLength(text: string) {
  let n = 0;
  const rest = text.replace(/https?:\/\/\S+/g, () => { n += 23; return ''; });
  for (const ch of rest) n += /[ᄀ-ᇿ　-鿿가-힯豈-﫿＀-￯]/.test(ch) ? 2 : 1;
  return n;
}
export const X_LIMIT = 280;
export function xText(title: string, body: string, tags: string[], url = '', draft?: string) {
  const tag = tags.map(t => t.replace(/^#+/, '').replace(/\s+/g, '')).find(Boolean);
  const tail = [url.trim(), tag ? `#${tag}` : ''].filter(Boolean).join(' ');
  const room = X_LIMIT - (tail ? xLength(tail) + 1 : 0);
  return [cutTo((draft ?? title.trim()) || shortBody(title, body), t => xLength(t) <= room), tail].filter(Boolean).join('\n');
}

/** 글이 채워진 채로 여는 작성 화면 주소(게시는 사람이 그 앱에서 누른다) */
export const composeUrl = (where: 'threads' | 'x', text: string) =>
  where === 'threads' ? `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}` : `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
