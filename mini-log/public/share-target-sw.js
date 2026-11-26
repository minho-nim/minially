// 휴대폰 '공유 → 미니로그'로 받은 사진·글: 서비스 워커가 받아 사진은 이 기기 캐시에 잠깐 두고 앱을 연다(서버로 보내지 않음).
// 글·주소만 오면 예전처럼 /?title=&text=&url= 로 열어 협찬 '관심'으로 담는다.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share') return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const files = form.getAll('photos').filter(f => f && typeof f !== 'string' && f.type.startsWith('image/') && f.size <= 25 * 1024 * 1024).slice(0, 20);
      if (files.length) {
        const cache = await caches.open('minilog-share');
        for (const key of await cache.keys()) await cache.delete(key);
        await Promise.all(files.map((f, i) => cache.put(`shared-photo-${i}`, new Response(f, { headers: { 'content-type': f.type, 'x-file-name': encodeURIComponent((f.name || `photo-${i + 1}.jpg`).slice(0, 120)) } }))));
        return Response.redirect(`/?share-photos=${files.length}`, 303);
      }
      const q = new URLSearchParams();
      for (const k of ['title', 'text', 'url']) { const v = form.get(k); if (typeof v === 'string' && v.trim()) q.set(k, v.slice(0, 2000)); }
      return Response.redirect(q.size ? `/?${q}` : '/', 303);
    } catch { return Response.redirect('/', 303); }
  })());
});
