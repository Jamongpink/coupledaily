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
  if (error) throw error
  return data
}
