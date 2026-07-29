-- CoupleDaily: profiles and secure one-to-one partner connections.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '사용자',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create table if not exists public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partner_invites_code_format check (code ~ '^[A-Z0-9]{8}$')
);

create index if not exists couple_members_user_id_idx
  on public.couple_members(user_id);
create index if not exists partner_invites_created_by_idx
  on public.partner_invites(created_by);
create index if not exists partner_invites_couple_id_idx
  on public.partner_invites(couple_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      '사용자'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do update
    set nickname = excluded.nickname,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, nickname, avatar_url)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'name', ''),
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(users.raw_user_meta_data ->> 'user_name', ''),
    '사용자'
  ),
  coalesce(
    users.raw_user_meta_data ->> 'avatar_url',
    users.raw_user_meta_data ->> 'picture'
  )
from auth.users as users
on conflict (id) do nothing;

create or replace function public.create_partner_invite()
returns table (invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_couple_id uuid;
  generated_code text;
  generated_expires_at timestamptz;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select members.couple_id
    into current_couple_id
  from public.couple_members as members
  where members.user_id = current_user_id;

  if current_couple_id is null then
    insert into public.couples (created_by)
    values (current_user_id)
    returning id into current_couple_id;

    insert into public.couple_members (couple_id, user_id)
    values (current_couple_id, current_user_id);
  elsif (
    select count(*)
    from public.couple_members as members
    where members.couple_id = current_couple_id
  ) >= 2 then
    raise exception '이미 파트너와 연결되어 있습니다.';
  end if;

  update public.partner_invites as invites
  set expires_at = now()
  where invites.created_by = current_user_id
    and invites.accepted_at is null
    and invites.expires_at > now();

  loop
    generated_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.partner_invites where code = generated_code
    );
  end loop;

  generated_expires_at := now() + interval '24 hours';

  insert into public.partner_invites (
    couple_id,
    code,
    created_by,
    expires_at
  )
  values (
    current_couple_id,
    generated_code,
    current_user_id,
    generated_expires_at
  );

  return query select generated_code, generated_expires_at;
end;
$$;

create or replace function public.accept_partner_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  invite_record public.partner_invites%rowtype;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if exists (
    select 1 from public.couple_members where user_id = current_user_id
  ) then
    raise exception '이미 커플에 참여하고 있습니다.';
  end if;

  select *
    into invite_record
  from public.partner_invites
  where code = upper(trim(invite_code))
  for update;

  if invite_record.id is null then
    raise exception '초대 코드를 확인해 주세요.';
  end if;

  if invite_record.created_by = current_user_id then
    raise exception '본인이 만든 초대 코드는 사용할 수 없습니다.';
  end if;

  if invite_record.accepted_at is not null or invite_record.expires_at <= now() then
    raise exception '만료되었거나 이미 사용된 초대 코드입니다.';
  end if;

  if (
    select count(*) from public.couple_members
    where couple_id = invite_record.couple_id
  ) >= 2 then
    raise exception '이미 파트너 연결이 완료된 코드입니다.';
  end if;

  insert into public.couple_members (couple_id, user_id)
  values (invite_record.couple_id, current_user_id);

  update public.partner_invites
  set accepted_at = now(),
      accepted_by = current_user_id
  where id = invite_record.id;

  return invite_record.couple_id;
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
    partner.user_id,
    profile.nickname,
    profile.avatar_url,
    partner.joined_at
  from public.couple_members as mine
  left join public.couple_members as partner
    on partner.couple_id = mine.couple_id
   and partner.user_id <> mine.user_id
  left join public.profiles as profile
    on profile.id = partner.user_id
  where mine.user_id = (select auth.uid())
  limit 1;
$$;

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.partner_invites enable row level security;

drop policy if exists "Users can view their profile" on public.profiles;
create policy "Users can view their profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_partner_invite() from public, anon;
revoke all on function public.accept_partner_invite(text) from public, anon;
revoke all on function public.get_partner_connection() from public, anon;
grant execute on function public.create_partner_invite() to authenticated;
grant execute on function public.accept_partner_invite(text) to authenticated;
grant execute on function public.get_partner_connection() to authenticated;

grant select, update on public.profiles to authenticated;
revoke all on public.couples from anon, authenticated;
revoke all on public.couple_members from anon, authenticated;
revoke all on public.partner_invites from anon, authenticated;
