-- Return the connected partner's birthday without broadening profiles RLS.

drop function if exists public.get_partner_connection();

create function public.get_partner_connection()
returns table (
  couple_id uuid,
  partner_id uuid,
  partner_nickname text,
  partner_avatar_url text,
  partner_birthday date,
  connected_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    mine.couple_id,
    case
      when partner.user_id is not null then partner.user_id
      when couples.demo_partner_nickname is not null
        then '00000000-0000-0000-0000-000000000001'::uuid
      else null
    end,
    coalesce(profile.nickname, couples.demo_partner_nickname),
    profile.avatar_url,
    profile.birthday,
    coalesce(partner.joined_at, couples.demo_connected_at)
  from public.couple_members as mine
  join public.couples as couples
    on couples.id = mine.couple_id
  left join public.couple_members as partner
    on partner.couple_id = mine.couple_id
   and partner.user_id <> mine.user_id
  left join public.profiles as profile
    on profile.id = partner.user_id
  where mine.user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.get_partner_connection() from public, anon;
grant execute on function public.get_partner_connection() to authenticated;
