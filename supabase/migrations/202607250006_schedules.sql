-- CoupleDaily shared schedules.

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  sticker text not null default '✨',
  start_at timestamptz not null,
  end_at timestamptz not null,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists schedules_couple_time_idx
  on public.schedules(couple_id, start_at, end_at);
create index if not exists schedules_user_id_idx
  on public.schedules(user_id);

alter table public.schedules enable row level security;

drop policy if exists "Couple members can view schedules" on public.schedules;
create policy "Couple members can view schedules"
  on public.schedules for select to authenticated
  using (public.is_couple_member(couple_id));

drop policy if exists "Users can create their schedules" on public.schedules;
create policy "Users can create their schedules"
  on public.schedules for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  );

drop policy if exists "Users can update their schedules" on public.schedules;
create policy "Users can update their schedules"
  on public.schedules for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  );

drop policy if exists "Users can delete their schedules" on public.schedules;
create policy "Users can delete their schedules"
  on public.schedules for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.schedules to authenticated;
