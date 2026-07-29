-- CoupleDaily monthly goals and self evaluation.

create table if not exists public.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_month date not null check (extract(day from target_month) = 1),
  title text not null check (char_length(trim(title)) between 1 and 100),
  status text check (status in ('achieved', 'partial', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monthly_goals_couple_month_idx
  on public.monthly_goals(couple_id, target_month, created_at);
create index if not exists monthly_goals_user_id_idx
  on public.monthly_goals(user_id);

alter table public.monthly_goals enable row level security;

drop policy if exists "Couple members can view monthly goals" on public.monthly_goals;
create policy "Couple members can view monthly goals"
  on public.monthly_goals for select to authenticated
  using (public.is_couple_member(couple_id));

drop policy if exists "Users can create their monthly goals" on public.monthly_goals;
create policy "Users can create their monthly goals"
  on public.monthly_goals for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  );

drop policy if exists "Users can update their monthly goals" on public.monthly_goals;
create policy "Users can update their monthly goals"
  on public.monthly_goals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  );

drop policy if exists "Users can delete their monthly goals" on public.monthly_goals;
create policy "Users can delete their monthly goals"
  on public.monthly_goals for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.monthly_goals to authenticated;
