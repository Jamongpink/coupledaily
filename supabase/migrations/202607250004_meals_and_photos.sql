-- CoupleDaily meals and private meal photo storage.

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_date date not null,
  meal_type text not null check (
    meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'lateNight')
  ),
  meal_time time not null,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, meal_date, meal_type)
);

create table if not exists public.meal_photos (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null check (sort_order between 0 and 2),
  created_at timestamptz not null default now(),
  unique (meal_id, sort_order)
);

create index if not exists meals_couple_date_idx
  on public.meals(couple_id, meal_date);
create index if not exists meal_photos_meal_id_idx
  on public.meal_photos(meal_id);

alter table public.meals enable row level security;
alter table public.meal_photos enable row level security;

drop policy if exists "Couple members can view meals" on public.meals;
create policy "Couple members can view meals"
  on public.meals for select to authenticated
  using (
    exists (
      select 1
      from public.couple_members as members
      where members.couple_id = meals.couple_id
        and members.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can create their meals" on public.meals;
create policy "Users can create their meals"
  on public.meals for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.couple_members as members
      where members.couple_id = meals.couple_id
        and members.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update their meals" on public.meals;
create policy "Users can update their meals"
  on public.meals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their meals" on public.meals;
create policy "Users can delete their meals"
  on public.meals for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Couple members can view meal photos" on public.meal_photos;
create policy "Couple members can view meal photos"
  on public.meal_photos for select to authenticated
  using (
    exists (
      select 1
      from public.meals
      join public.couple_members
        on couple_members.couple_id = meals.couple_id
      where meals.id = meal_photos.meal_id
        and couple_members.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can manage their meal photos" on public.meal_photos;
create policy "Users can manage their meal photos"
  on public.meal_photos for all to authenticated
  using (
    exists (
      select 1 from public.meals
      where meals.id = meal_photos.meal_id
        and meals.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meals
      where meals.id = meal_photos.meal_id
        and meals.user_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-photos',
  'meal-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Couple members can view stored meal photos" on storage.objects;
create policy "Couple members can view stored meal photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and exists (
      select 1
      from public.meals
      join public.couple_members
        on couple_members.couple_id = meals.couple_id
      where meals.id = ((storage.foldername(name))[2])::uuid
        and couple_members.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can upload their meal photos" on storage.objects;
create policy "Users can upload their meal photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their meal photos" on storage.objects;
create policy "Users can update their meal photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their meal photos" on storage.objects;
create policy "Users can delete their meal photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.meal_photos to authenticated;
