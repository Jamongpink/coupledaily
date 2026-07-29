-- Shared couple anniversaries.

create table if not exists public.anniversaries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 60),
  anniversary_date date not null,
  repeats_yearly boolean not null default true,
  memo text not null default '' check (char_length(memo) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists anniversaries_couple_date_idx
  on public.anniversaries(couple_id, anniversary_date);

alter table public.anniversaries enable row level security;

drop policy if exists "Couple members can view anniversaries" on public.anniversaries;
create policy "Couple members can view anniversaries"
  on public.anniversaries for select to authenticated
  using (public.is_couple_member(couple_id));

drop policy if exists "Couple members can create anniversaries" on public.anniversaries;
create policy "Couple members can create anniversaries"
  on public.anniversaries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  );

drop policy if exists "Couple members can update anniversaries" on public.anniversaries;
create policy "Couple members can update anniversaries"
  on public.anniversaries for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

drop policy if exists "Couple members can delete anniversaries" on public.anniversaries;
create policy "Couple members can delete anniversaries"
  on public.anniversaries for delete to authenticated
  using (public.is_couple_member(couple_id));

grant select, insert, update, delete on public.anniversaries to authenticated;
