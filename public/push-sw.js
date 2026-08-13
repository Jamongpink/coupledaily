self.addEventListener('push', (event) => {
  const fallback = {
    title: 'CoupleDaily',
    body: '파트너가 새로운 기록을 남겼어요.',
    url: '/',
  }

  let payload = fallback
  try {
    payload = { ...fallback, ...(event.data?.json() || {}) }
  } catch {
    payload = { ...fallback, body: event.data?.text() || fallback.body }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa/screen-heart-v2-192.png',
      badge: '/pwa/screen-heart-v2-192.png',
      tag: payload.tag || 'coupledaily-partner-record',
      renotify: true,
      data: { url: payload.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    Promise.all([
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => notification.close())
      }),
      'clearAppBadge' in self.navigator
        ? self.navigator.clearAppBadge().catch(() => {})
        : Promise.resolve(),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const existingClient = clients.find((client) => client.url.startsWith(self.location.origin))
        if (existingClient) {
          return existingClient.navigate(targetUrl).then(() => existingClient.focus())
        }
        return self.clients.openWindow(targetUrl)
      }),
    ]),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CLEAR_NOTIFICATIONS') return
  event.waitUntil(
    Promise.all([
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => notification.close())
      }),
      'clearAppBadge' in self.navigator
        ? self.navigator.clearAppBadge().catch(() => {})
        : Promise.resolve(),
    ]),
  )
})
