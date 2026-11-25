// 안드로이드 '공유'로 받은 사진·글(문자·메일): 서비스 워커가 받아 이 기기 캐시에 잠깐 두고 앱을 연다(서버로 보내지 않음).
// 앱이 열리면 꺼내 '사진·글로 일정 넣기'를 띄우고 캐시에서 지운다. 글은 기기 안 규칙으로만 읽는다.
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
      const text = [form.get('title'), form.get('text'), form.get('url')].filter(v => typeof v === 'string' && v.trim()).join('\n').slice(0, 4000);
      if (text) {
        const cache = await caches.open('minially-share');
        await cache.put('shared-text', new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } }));
        return Response.redirect(`${home}?share-photo=text`, 303);
      }
    } catch { /* 형식이 틀린 공유는 앱만 연다 */ }
    return Response.redirect(home, 303);
  })());
});
