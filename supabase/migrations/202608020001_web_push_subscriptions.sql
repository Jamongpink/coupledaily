-- Browser Web Push subscriptions owned by each authenticated user.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  enabled boolean not null default true,
  preferences jsonb not null default '{"meals":true,"schedules":true,"goals":true,"diaries":true,"anniversaries":true}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view their push subscriptions" on public.push_subscriptions;
create policy "Users can view their push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create their push subscriptions" on public.push_subscriptions;
create policy "Users can create their push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their push subscriptions" on public.push_subscriptions;
create policy "Users can update their push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their push subscriptions" on public.push_subscriptions;
create policy "Users can delete their push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
