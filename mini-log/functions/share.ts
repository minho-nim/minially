// 서비스 워커가 아직 없을 때(설치 직후 등) 공유 POST가 서버로 오면: 사진은 받지 않고(저장 안 함) 글·주소만 예전처럼 넘긴다.
export const onRequestPost = async ({ request }: { request: Request }) => {
  const q = new URLSearchParams();
  try {
    const form = await request.formData();
    for (const k of ['title', 'text', 'url']) { const v = form.get(k); if (typeof v === 'string' && v.trim()) q.set(k, v.slice(0, 2000)); }
    if (form.getAll('photos').some(f => typeof f !== 'string')) q.set('share-photos', 'missing');
  } catch { /* 형식이 틀리면 앱만 연다 */ }
  return new Response(null, { status: 303, headers: { location: q.size ? `/?${q}` : '/' } });
};
