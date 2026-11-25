// 안드로이드 '공유'로 받은 사진: 서비스 워커가 받아 이 기기 캐시에 잠깐 두고 앱을 연다(서버로 보내지 않음).
// 앱이 열리면 사진을 꺼내 '사진으로 일정 넣기'를 띄우고 캐시에서 지운다.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/share-photo')) return;
  event.respondWith((async () => {
    const home = url.pathname.replace(/share-photo$/, '');
    try {
      const form = await event.request.formData();
      const file = form.get('photo');
      if (file && typeof file !== 'string' && file.type.startsWith('image/') && file.size <= 25 * 1024 * 1024) {
        const cache = await caches.open('minially-share');
        await cache.put('shared-photo', new Response(file, { headers: { 'content-type': file.type } }));
        return Response.redirect(`${home}?share-photo=1`, 303);
      }
    } catch { /* 형식이 틀린 공유는 앱만 연다 */ }
    return Response.redirect(home, 303);
  })());
});
