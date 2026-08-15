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
    (async () => {
      const notifications = await self.registration.getNotifications().catch(() => [])
      notifications.forEach((notification) => notification.close())

      if ('clearAppBadge' in self.navigator) {
        await self.navigator.clearAppBadge().catch(() => {})
      }

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existingClient = clients.find((client) => client.url.startsWith(self.location.origin))

      if (!existingClient) {
        await self.clients.openWindow(targetUrl)
        return
      }

      // iOS standalone PWAs do not always apply Client.navigate() after a
      // notification click. Tell the running app to update its own view first.
      existingClient.postMessage({ type: 'OPEN_NOTIFICATION_URL', url: targetUrl })
      await existingClient.focus()
    })(),
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
