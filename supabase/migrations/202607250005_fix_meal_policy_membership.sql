-- Use security-definer membership helpers so meal RLS does not require
-- granting direct access to the private couple_members table.

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.couple_members
    where couple_members.couple_id = target_couple_id
      and couple_members.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_view_meal(target_meal_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.meals
    join public.couple_members
      on couple_members.couple_id = meals.couple_id
    where meals.id = target_meal_id
      and couple_members.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_couple_member(uuid) from public, anon;
revoke all on function public.can_view_meal(uuid) from public, anon;
grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.can_view_meal(uuid) to authenticated;

drop policy if exists "Couple members can view meals" on public.meals;
create policy "Couple members can view meals"
  on public.meals for select to authenticated
  using (public.is_couple_member(couple_id));

drop policy if exists "Users can create their meals" on public.meals;
create policy "Users can create their meals"
  on public.meals for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  );

drop policy if exists "Couple members can view meal photos" on public.meal_photos;
create policy "Couple members can view meal photos"
  on public.meal_photos for select to authenticated
  using (public.can_view_meal(meal_id));

drop policy if exists "Couple members can view stored meal photos" on storage.objects;
create policy "Couple members can view stored meal photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and public.can_view_meal(((storage.foldername(name))[2])::uuid)
  );
