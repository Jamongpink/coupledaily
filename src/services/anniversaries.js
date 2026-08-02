import { supabase } from '../lib/supabase'
import { notifyPartner } from './pushNotifications'

const fields = 'id, couple_id, user_id, title, anniversary_date, repeats_yearly, memo, created_at, updated_at'

export async function getAnniversaries(coupleId) {
  const { data, error } = await supabase
    .from('anniversaries')
    .select(fields)
    .eq('couple_id', coupleId)
    .order('anniversary_date')

  if (error) throw error
  return data || []
}

export async function saveAnniversary({ id, coupleId, title, date, repeatsYearly, memo }) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const userId = authData.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const values = {
    couple_id: coupleId,
    user_id: userId,
    title: title.trim(),
    anniversary_date: date,
    repeats_yearly: repeatsYearly,
    memo: memo?.trim() || '',
    updated_at: new Date().toISOString(),
  }

  const query = id
    ? supabase.from('anniversaries').update(values).eq('id', id)
    : supabase.from('anniversaries').insert(values)
  const { data, error } = await query.select(fields).single()

  if (error) throw error
  notifyPartner('anniversaries', '기념일 변경', `파트너가 “${title.trim()}” 기념일을 ${id ? '수정' : '등록'}했어요.`)
  return data
}

export async function deleteAnniversary(id) {
  const { error } = await supabase.from('anniversaries').delete().eq('id', id)
  if (error) throw error
}
