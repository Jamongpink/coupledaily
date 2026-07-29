-- Date-based private authoring and couple-shared reading for diaries.

create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_date date not null,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, user_id, diary_date)
);

create index if not exists diaries_couple_date_idx
  on public.diaries(couple_id, diary_date);
create index if not exists diaries_user_id_idx
  on public.diaries(user_id);

alter table public.diaries enable row level security;

drop policy if exists "Couple members can view diaries" on public.diaries;
create policy "Couple members can view diaries"
  on public.diaries for select to authenticated
  using (public.is_couple_member(couple_id));

drop policy if exists "Users can create their diaries" on public.diaries;
create policy "Users can create their diaries"
  on public.diaries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  );

drop policy if exists "Users can update their diaries" on public.diaries;
create policy "Users can update their diaries"
  on public.diaries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  );

drop policy if exists "Users can delete their diaries" on public.diaries;
create policy "Users can delete their diaries"
  on public.diaries for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.diaries to authenticated;
