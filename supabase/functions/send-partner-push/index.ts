import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const allowedCategories = new Set(['meals', 'schedules', 'goals', 'diaries', 'anniversaries'])
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization = request.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401)

  const payload = await request.json()
  if (!allowedCategories.has(payload.category)) {
    return json({ error: 'Invalid category' }, 400)
  }

  const { data: membership } = await adminClient
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', authData.user.id)
    .maybeSingle()
  if (!membership) return json({ sent: 0 })

  const { data: partnerMembership } = await adminClient
    .from('couple_members')
    .select('user_id')
    .eq('couple_id', membership.couple_id)
    .neq('user_id', authData.user.id)
    .maybeSingle()
  if (!partnerMembership) return json({ sent: 0 })

  const { data: subscriptions } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key, preferences')
    .eq('user_id', partnerMembership.user_id)
    .eq('enabled', true)

  const targets = (subscriptions || []).filter(
    (subscription) => subscription.preferences?.[payload.category] !== false,
  )

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') || 'https://coupledaily.vercel.app',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  let sent = 0
  for (const subscription of targets) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      }, JSON.stringify({
        title: String(payload.title || 'CoupleDaily').slice(0, 80),
        body: String(payload.body || '파트너가 새로운 기록을 남겼어요.').slice(0, 180),
        url: String(payload.url || '/'),
        tag: `coupledaily-${payload.category}`,
      }), { TTL: 3600, urgency: 'high' })
      sent += 1
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0)
      if (statusCode === 404 || statusCode === 410) {
        await adminClient.from('push_subscriptions').delete().eq('id', subscription.id)
      }
    }
  }

  return json({ sent })
})
