import { supabase } from '../lib/supabase'

export const defaultPushPreferences = {
  meals: true,
  schedules: true,
  goals: true,
  diaries: true,
  anniversaries: true,
}

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BPg83Gw7v_MOakmiCBV9spRSGjr_ZwzNRiZLiVgOyt88waxAz5MXQD2dWCbNVCO4wmovbgv5IhGGN7RzP9of-oU'

const urlBase64ToUint8Array = (value) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}

const ensurePushSupport = () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('이 기기에서는 웹 푸시 알림을 지원하지 않습니다.')
  }
  if (!vapidPublicKey) {
    throw new Error('푸시 알림 서버 설정이 아직 완료되지 않았습니다.')
  }
}

export async function getPushSettings(userId) {
  if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { enabled: false, preferences: defaultPushPreferences }
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return { enabled: false, preferences: defaultPushPreferences }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('enabled, preferences')
    .eq('endpoint', subscription.endpoint)
    .maybeSingle()

  if (error) throw error
  return {
    enabled: Boolean(data?.enabled),
    preferences: { ...defaultPushPreferences, ...(data?.preferences || {}) },
  }
}

export async function enablePushNotifications(userId, preferences = defaultPushPreferences) {
  ensurePushSupport()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('기기 설정에서 CoupleDaily 알림 권한을 허용해 주세요.')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
  const json = subscription.toJSON()

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: json.keys.p256dh,
    auth_key: json.keys.auth,
    enabled: true,
    preferences,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  if (error) throw error
}

export async function disablePushNotifications() {
  ensurePushSupport()
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('endpoint', subscription.endpoint)
  if (error) throw error
}

export async function savePushPreferences(preferences) {
  ensurePushSupport()
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) throw new Error('먼저 전체 알림을 켜 주세요.')

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ preferences, updated_at: new Date().toISOString() })
    .eq('endpoint', subscription.endpoint)
  if (error) throw error
}

export function notifyPartner(category, title, body, url = '/') {
  supabase.functions.invoke('send-partner-push', {
    body: { category, title, body, url },
  }).catch(() => {})
}
