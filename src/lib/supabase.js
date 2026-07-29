import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const getSupabaseConnectionError = () => {
  if (!supabaseUrl || !supabaseKey) {
    return 'Supabase 환경변수가 설정되지 않았습니다.';
  }

  return null;
};
