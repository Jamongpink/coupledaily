import { supabase } from '../lib/supabase'

export async function getGoalsForMonth(coupleId, month) {
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('id, user_id, title, status, target_month, created_at')
    .eq('couple_id', coupleId)
    .eq('target_month', month)
    .order('created_at')

  if (error) throw error
  return data || []
}

export async function createGoal({ coupleId, month, title }) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const userId = authData.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('monthly_goals')
    .insert({
      couple_id: coupleId,
      user_id: userId,
      target_month: month,
      title: title.trim(),
    })
    .select('id, user_id, title, status, target_month, created_at')
    .single()

  if (error) throw error
  return data
}

export async function updateGoalStatus(goalId, status) {
  const { data, error } = await supabase
    .from('monthly_goals')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .select('id, status')
    .single()

  if (error) throw error
  return data
}

export async function deleteGoal(goalId) {
  const { error } = await supabase
    .from('monthly_goals')
    .delete()
    .eq('id', goalId)

  if (error) throw error
}
