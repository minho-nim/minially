// 아침 알림(웹 푸시): 알림에는 내용이 없다(빈 푸시). 받으면 로그인된 상태로 /api/brief를 읽어 할 일 제목만 보여 준다.
// 로그아웃돼 있거나 읽지 못하면 내용 없이 '오늘 할 일을 확인해 보세요'만. 누르면 미니로그를 연다.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let title = '미니로그 · 오늘 할 일';
    let body = '오늘 할 일을 확인해 보세요.';
    try {
      const res = await fetch('/api/brief', { credentials: 'same-origin', cache: 'no-store' });
      if (res.ok) {
        const brief = await res.json();
        const items = Array.isArray(brief.items) ? brief.items : [];
        if (!items.length) return; // 그사이 다 했으면 알리지 않는다
        title = `미니로그 · 오늘 할 일 ${items.length}개`;
        body = items.slice(0, 3).map(i => `${String(i.title).slice(0, 40)}${i.sub ? ` (${String(i.sub).slice(0, 20)})` : ''}`).join('\n');
      }
    } catch { /* 내용 없이 알린다 */ }
    await self.registration.showNotification(title, { body, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', tag: 'minilog-brief', data: { url: '/' } });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => new URL(c.url).origin === self.location.origin);
    if (open) { await open.focus(); return; }
    await self.clients.openWindow('/');
  })());
});
