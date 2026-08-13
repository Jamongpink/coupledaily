import { supabase } from '../lib/supabase'
import { notifyPartner } from './pushNotifications'

function localDateTime(date, time) {
  return new Date(`${date}T${time}:00`).toISOString()
}

export async function getSchedulesForDate(coupleId, date) {
  const dayStart = new Date(`${date}T00:00:00`)
  const nextDay = new Date(dayStart)
  nextDay.setDate(nextDay.getDate() + 1)

  const { data, error } = await supabase
    .from('schedules')
    .select('id, user_id, title, sticker, start_at, end_at, memo')
    .eq('couple_id', coupleId)
    .lt('start_at', nextDay.toISOString())
    .gt('end_at', dayStart.toISOString())
    .order('start_at')

  if (error) throw error
  return data || []
}

export async function getSchedulesForMonth(coupleId, monthStart, monthEnd) {
  const start = new Date(`${monthStart}T00:00:00`).toISOString()
  const end = new Date(`${monthEnd}T00:00:00`).toISOString()
  const { data, error } = await supabase
    .from('schedules')
    .select('start_at, end_at, user_id')
    .eq('couple_id', coupleId)
    .lt('start_at', end)
    .gt('end_at', start)

  if (error) throw error
  return data || []
}

export async function saveSchedule({
  id,
  coupleId,
  title,
  sticker,
  startDate,
  startTime,
  endDate,
  endTime,
  memo,
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const userId = authData.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const startAt = localDateTime(startDate, startTime)
  const endAt = localDateTime(endDate, endTime)
  if (new Date(endAt) <= new Date(startAt)) {
    throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.')
  }

  const values = {
    couple_id: coupleId,
    user_id: userId,
    title: title.trim(),
    sticker,
    start_at: startAt,
    end_at: endAt,
    memo: memo?.trim() || '',
    updated_at: new Date().toISOString(),
  }

  const query = id
    ? supabase.from('schedules').update(values).eq('id', id).eq('user_id', userId)
    : supabase.from('schedules').insert(values)

  const { data, error } = await query.select('id').single()
  if (error) throw error
  notifyPartner(
    'schedules',
    '새 일정',
    `파트너가 “${title.trim()}” 일정을 ${id ? '수정' : '등록'}했어요.`,
    `/?daily=${startDate}`,
  )
  return data.id
}

export async function deleteSchedule(scheduleId) {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', scheduleId)

  if (error) throw error
}
