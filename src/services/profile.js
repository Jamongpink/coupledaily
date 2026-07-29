import { supabase } from '../lib/supabase'

export async function getMyProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const userId = authData.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, birthday')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function saveMyBirthday(birthday) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const userId = authData.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('profiles')
    .update({
      birthday,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('birthday')
    .single()

  if (error) throw error
  return data.birthday
}
