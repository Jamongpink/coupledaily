import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Reminder = {
  eventType: 'anniversary' | 'birthday'
  eventKey: string
  coupleId: string
  title: string
  body: string
}

const json = (body: unknown, status = 200) => Response.json(body, { status })

const koreaDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: cronSecret } = await admin
    .from('notification_cron_secrets')
    .select('secret')
    .eq('name', 'date-reminders')
    .maybeSingle()

  if (!cronSecret?.secret || request.headers.get('x-cron-secret') !== cronSecret.secret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const today = koreaDate()
  const monthDay = today.slice(5)
  const [{ data: anniversaries }, { data: profiles }, { data: memberships }] = await Promise.all([
    admin.from('anniversaries').select('id, couple_id, title, anniversary_date, repeats_yearly'),
    admin.from('profiles').select('id, nickname, birthday').not('birthday', 'is', null),
    admin.from('couple_members').select('couple_id, user_id'),
  ])

  const reminders: Reminder[] = []
  for (const anniversary of anniversaries || []) {
    const isToday = anniversary.repeats_yearly
      ? anniversary.anniversary_date.slice(5) === monthDay
      : anniversary.anniversary_date === today
    if (isToday) reminders.push({
      eventType: 'anniversary',
      eventKey: anniversary.id,
      coupleId: anniversary.couple_id,
      title: '오늘은 우리의 기념일이에요 ♥',
      body: anniversary.title,
    })
  }

  const membershipByUser = new Map((memberships || []).map((row) => [row.user_id, row.couple_id]))
  for (const profile of profiles || []) {
    if (profile.birthday?.slice(5) !== monthDay) continue
    const coupleId = membershipByUser.get(profile.id)
    if (!coupleId) continue
    reminders.push({
      eventType: 'birthday',
      eventKey: profile.id,
      coupleId,
      title: '오늘은 생일이에요 🎂',
      body: `${profile.nickname || '파트너'}님의 생일을 함께 축하해 주세요.`,
    })
  }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') || 'https://coupledaily.vercel.app',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  let delivered = 0
  for (const reminder of reminders) {
    const recipients = (memberships || [])
      .filter((row) => row.couple_id === reminder.coupleId)
      .map((row) => row.user_id)

    for (const recipientId of recipients) {
      const { data: existing } = await admin
        .from('notification_deliveries')
        .select('id')
        .eq('delivery_date', today)
        .eq('event_type', reminder.eventType)
        .eq('event_key', reminder.eventKey)
        .eq('recipient_id', recipientId)
        .maybeSingle()
      if (existing) continue

      const { data: subscriptions } = await admin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth_key, preferences')
        .eq('user_id', recipientId)
        .eq('enabled', true)

      const targets = (subscriptions || []).filter(
        (subscription) => subscription.preferences?.anniversaries !== false,
      )
      let sentToRecipient = false

      for (const subscription of targets) {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          }, JSON.stringify({
            title: reminder.title,
            body: reminder.body,
            url: '/',
            tag: `coupledaily-${reminder.eventType}-${reminder.eventKey}`,
          }), { TTL: 43200, urgency: 'high' })
          sentToRecipient = true
        } catch (error) {
          const statusCode = Number((error as { statusCode?: number })?.statusCode || 0)
          if (statusCode === 404 || statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('id', subscription.id)
          }
        }
      }

      if (sentToRecipient) {
        const { error } = await admin.from('notification_deliveries').insert({
          delivery_date: today,
          event_type: reminder.eventType,
          event_key: reminder.eventKey,
          recipient_id: recipientId,
        })
        if (!error) delivered += 1
      }
    }
  }

  return json({ date: today, reminders: reminders.length, delivered })
})
