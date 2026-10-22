// JobRadar service worker: shows push notifications for new strong matches.
// It does no caching or request interception.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'JobRadar', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'JobRadar', {
      body: data.body || '',
      icon: '/favicon.ico',
      tag: 'jobradar-matches', // newer alerts replace older ones instead of stacking
      data: { url: data.url || '/feed' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only ever open pages of this app
  const target = new URL(event.notification.data?.url || '/feed', self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/feed';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => w.url.startsWith(self.location.origin));
      if (existing) {
        existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })
  );
});
