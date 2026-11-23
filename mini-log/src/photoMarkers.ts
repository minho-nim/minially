// 본문의 [사진 n] 표시를 사진 순서에 맞춰 고친다(화면 밖 순수 함수, 시험: tests/markers.spec.ts).
const MARKER = /\[사진\s*(\d+)\]/g;

/**
 * before: 바꾸기 전 사진 id 순서, after: 바꾼 뒤 순서(지운 사진은 빠짐).
 * 옮긴 사진은 새 번호로, 지운 사진의 표시는 없앤다(표시만 있던 줄은 줄째로).
 * 번호가 사진 수를 넘는 표시나 번호 없는 [사진]은 그대로 둔다.
 */
export function renumberMarkers(body: string, before: string[], after: string[]) {
  const lines = body.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    let removed = false;
    const next = line.replace(MARKER, (whole, n: string) => {
      const id = before[Number(n) - 1];
      if (!id) return whole;
      const index = after.indexOf(id);
      if (index === -1) { removed = true; return ''; }
      return `[사진 ${index + 1}]`;
    });
    if (removed && next.trim() === '') continue;
    out.push(removed ? next.replace(/ {2,}/g, ' ').trimEnd() : next);
  }
  return out.join('\n');
}
