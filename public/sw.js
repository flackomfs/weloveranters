self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    const rawPayload = event.data.text();
    try {
      const parsed = JSON.parse(rawPayload);
      if (parsed && typeof parsed === 'object') payload = parsed;
    } catch {
      payload = { body: rawPayload };
    }
  }

  const title = typeof payload.title === 'string' ? payload.title : 'WeLoveRanters';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'You have a new notification.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    data: { url: '/notifications' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL('/notifications', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if ('navigate' in client) await client.navigate(targetUrl);
        return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
