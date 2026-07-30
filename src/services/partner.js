import { supabase } from '../lib/supabase'

export async function getPartnerConnection() {
  const { data, error } = await supabase.rpc('get_partner_connection')

  if (error) {
    throw error
  }

  return data?.[0] ?? null
}

export async function createPartnerInvite() {
  const { data, error } = await supabase.rpc('create_partner_invite')

  if (error) {
    throw error
  }

  return data?.[0] ?? null
}

export async function acceptPartnerInvite(code) {
  const { data, error } = await supabase.rpc('accept_partner_invite', {
    invite_code: code,
  })

  if (error) {
    throw error
  }

  return data
}

export async function connectDemoPartner(nickname = '다정이') {
  const { data, error } = await supabase.rpc('connect_demo_partner', {
    demo_nickname: nickname,
  })

  if (error) {
    throw error
  }

  return data
}

export async function disconnectPartner() {
  const { data, error } = await supabase.rpc('disconnect_partner')
  if (error) throw error
  return data
}

export async function deleteMyAccount(confirmation) {
  const { data, error } = await supabase.rpc('delete_my_account', {
    confirmation_text: confirmation,
  })
  if (error) {
    if (error.message?.includes('delete_my_account')) {
      throw new Error('회원 탈퇴용 데이터베이스 설정이 적용되지 않았습니다.')
    }
    throw error
  }
  if (data !== true) {
    throw new Error('회원 탈퇴가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.')
  }
  return data
}
