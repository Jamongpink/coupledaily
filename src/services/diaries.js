import { supabase } from '../lib/supabase'
import { notifyPartner } from './pushNotifications'

const diaryFields = 'id, couple_id, user_id, diary_date, content, created_at, updated_at'

export async function getDiariesForDate(coupleId, date) {
  const { data, error } = await supabase
    .from('diaries')
    .select(diaryFields)
    .eq('couple_id', coupleId)
    .eq('diary_date', date)

  if (error) throw error
  return data || []
}

export async function saveDiary({ coupleId, date, content }) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const userId = authData.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('diaries')
    .upsert(
      {
        couple_id: coupleId,
        user_id: userId,
        diary_date: date,
        content: content.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'couple_id,user_id,diary_date' },
    )
    .select(diaryFields)
    .single()

  if (error) throw error
  notifyPartner('diaries', '새 일기', '파트너가 오늘의 일기를 남겼어요.')
  return data
}

export async function deleteDiary(diaryId) {
  const { error } = await supabase.from('diaries').delete().eq('id', diaryId)
  if (error) throw error
}
