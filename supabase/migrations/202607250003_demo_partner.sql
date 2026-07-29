-- Demo partner support for developing CoupleDaily with one real login.

alter table public.couples
  add column if not exists demo_partner_nickname text,
  add column if not exists demo_connected_at timestamptz;

create or replace function public.connect_demo_partner(
  demo_nickname text default '다정이'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_couple_id uuid;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select members.couple_id
    into current_couple_id
  from public.couple_members as members
  where members.user_id = current_user_id;

  if current_couple_id is null then
    insert into public.couples (
      created_by,
      demo_partner_nickname,
      demo_connected_at
    )
    values (
      current_user_id,
      coalesce(nullif(trim(demo_nickname), ''), '다정이'),
      now()
    )
    returning id into current_couple_id;

    insert into public.couple_members (couple_id, user_id)
    values (current_couple_id, current_user_id);
  else
    if (
      select count(*)
      from public.couple_members as members
      where members.couple_id = current_couple_id
    ) >= 2 then
      raise exception '이미 실제 파트너와 연결되어 있습니다.';
    end if;

    update public.couples as couples
    set demo_partner_nickname = coalesce(nullif(trim(demo_nickname), ''), '다정이'),
        demo_connected_at = now()
    where couples.id = current_couple_id;
  end if;

  update public.partner_invites as invites
  set expires_at = now()
  where invites.created_by = current_user_id
    and invites.accepted_at is null
    and invites.expires_at > now();

  return current_couple_id;
end;
$$;

create or replace function public.get_partner_connection()
returns table (
  couple_id uuid,
  partner_id uuid,
  partner_nickname text,
  partner_avatar_url text,
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

revoke all on function public.connect_demo_partner(text) from public, anon;
revoke all on function public.get_partner_connection() from public, anon;
grant execute on function public.connect_demo_partner(text) to authenticated;
grant execute on function public.get_partner_connection() to authenticated;
