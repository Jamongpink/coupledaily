import { supabase } from '../lib/supabase'

export async function getMonthlyBi(month, recalculate = false) {
  const { data, error } = await supabase.rpc('get_monthly_bi', {
    p_month: month,
    p_recalculate: recalculate,
  })
  if (error) throw error
  return data
}
