-- Food-name autocomplete and monthly CoupleDaily BI snapshots.

create table if not exists public.meal_food_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null check (char_length(trim(food_name)) between 1 and 40),
  normalized_name text not null,
  created_at timestamptz not null default now(),
  unique (meal_id, normalized_name)
);

create index if not exists meal_food_items_couple_name_idx on public.meal_food_items(couple_id, normalized_name);

create or replace function public.prepare_meal_food_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent public.meals%rowtype;
begin
  select * into parent from public.meals where id = new.meal_id;
  if parent.id is null then raise exception 'Meal not found'; end if;
  new.couple_id := parent.couple_id;
  new.user_id := parent.user_id;
  new.food_name := regexp_replace(trim(new.food_name), '\s+', ' ', 'g');
  new.normalized_name := lower(new.food_name);
  return new;
end $$;

drop trigger if exists prepare_meal_food_item on public.meal_food_items;
create trigger prepare_meal_food_item before insert or update on public.meal_food_items
for each row execute function public.prepare_meal_food_item();

alter table public.meal_food_items enable row level security;
create policy "Couple members can view meal foods" on public.meal_food_items for select to authenticated
using (public.is_couple_member(couple_id));
create policy "Users can manage their meal foods" on public.meal_food_items for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.meal_food_items to authenticated;

create table if not exists public.monthly_bi_snapshots (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  period_start date not null,
  period_end date not null,
  status text not null check (status in ('in_progress', 'finalized', 'needs_recalculation')),
  stats jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  dirty_at timestamptz,
  unique (couple_id, month_start)
);

alter table public.monthly_bi_snapshots enable row level security;
create policy "Couple members can view monthly BI" on public.monthly_bi_snapshots for select to authenticated
using (public.is_couple_member(couple_id));
grant select on public.monthly_bi_snapshots to authenticated;

create or replace function public.calculate_monthly_bi(p_couple uuid, p_month date, p_status text default 'in_progress')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  month_first date := date_trunc('month', p_month)::date;
  current_month date := date_trunc('month', timezone('Asia/Seoul', now()))::date;
  period_last date;
  member record;
  people jsonb := '{}'::jsonb;
  person jsonb;
  together jsonb;
  result jsonb;
begin
  period_last := case when month_first = current_month then timezone('Asia/Seoul', now())::date else (month_first + interval '1 month - 1 day')::date end;

  for member in select user_id from public.couple_members where couple_id = p_couple loop
    select jsonb_build_object(
      'activeDays', (select count(*) from (select meal_date d from public.meals where couple_id=p_couple and user_id=member.user_id and meal_date between month_first and period_last union select diary_date from public.diaries where couple_id=p_couple and user_id=member.user_id and diary_date between month_first and period_last union select (start_at at time zone 'Asia/Seoul')::date from public.schedules where couple_id=p_couple and user_id=member.user_id and (start_at at time zone 'Asia/Seoul')::date between month_first and period_last) x),
      'mealCount', (select count(*) from public.meals where couple_id=p_couple and user_id=member.user_id and meal_date between month_first and period_last),
      'scheduleCount', (select count(*) from public.schedules where couple_id=p_couple and user_id=member.user_id and (start_at at time zone 'Asia/Seoul')::date between month_first and period_last),
      'diaryDays', (select count(distinct diary_date) from public.diaries where couple_id=p_couple and user_id=member.user_id and diary_date between month_first and period_last),
      'photoMealCount', (select count(distinct m.id) from public.meals m join public.meal_photos p on p.meal_id=m.id where m.couple_id=p_couple and m.user_id=member.user_id and m.meal_date between month_first and period_last),
      'goals', (select jsonb_build_object(
        'total', count(*), 'achieved', count(*) filter(where status='achieved'), 'partial', count(*) filter(where status='partial'), 'missed', count(*) filter(where status='missed'), 'unrated', count(*) filter(where status is null),
        'score', coalesce(round((sum(case status when 'achieved' then 100 when 'partial' then 50 when 'missed' then 0 end)::numeric / nullif(count(status),0))),0),
        'evaluationRate', coalesce(round(count(status)::numeric * 100 / nullif(count(*),0)),0)
      ) from public.monthly_goals where couple_id=p_couple and user_id=member.user_id and target_month=month_first),
      'topFoods', (select coalesce(jsonb_agg(jsonb_build_object('name', food_name, 'count', uses) order by uses desc, food_name), '[]'::jsonb) from (select min(f.food_name) food_name, count(*) uses from public.meal_food_items f join public.meals m on m.id=f.meal_id where f.couple_id=p_couple and f.user_id=member.user_id and m.meal_date between month_first and period_last group by f.normalized_name order by uses desc, food_name limit 5) ranked)
    ) into person;
    people := people || jsonb_build_object(member.user_id::text, person);
  end loop;

  select jsonb_build_object(
    'activeDays', count(distinct d),
    'bothMealDays', count(*) filter(where meal_users >= 2),
    'bothScheduleDays', count(*) filter(where schedule_users >= 2),
    'bothDiaryDays', count(*) filter(where diary_users >= 2)
  ) into together from (
    select day::date d,
      (select count(distinct user_id) from public.meals where couple_id=p_couple and meal_date=day::date) meal_users,
      (select count(distinct user_id) from public.schedules where couple_id=p_couple and (start_at at time zone 'Asia/Seoul')::date=day::date) schedule_users,
      (select count(distinct user_id) from public.diaries where couple_id=p_couple and diary_date=day::date) diary_users
    from generate_series(month_first, period_last, interval '1 day') day
  ) days where meal_users+schedule_users+diary_users > 0;

  result := jsonb_build_object('users', people, 'together', together);
  insert into public.monthly_bi_snapshots(couple_id, month_start, period_start, period_end, status, stats, calculated_at, dirty_at)
  values(p_couple, month_first, month_first, period_last, p_status, result, now(), null)
  on conflict(couple_id, month_start) do update set period_end=excluded.period_end, status=excluded.status, stats=excluded.stats, calculated_at=now(), dirty_at=null;
  return (select to_jsonb(s) from public.monthly_bi_snapshots s where s.couple_id=p_couple and s.month_start=month_first);
end $$;

create or replace function public.get_monthly_bi(p_month date, p_recalculate boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target_couple uuid; target_month date := date_trunc('month', p_month)::date; existing jsonb;
begin
  select couple_id into target_couple from public.couple_members where user_id=auth.uid() limit 1;
  if target_couple is null then raise exception 'Partner connection required'; end if;
  if not p_recalculate then select to_jsonb(s) into existing from public.monthly_bi_snapshots s where s.couple_id=target_couple and s.month_start=target_month; end if;
  if existing is not null then return existing; end if;
  return public.calculate_monthly_bi(target_couple, target_month, case when target_month < date_trunc('month', timezone('Asia/Seoul',now()))::date then 'finalized' else 'in_progress' end);
end $$;
grant execute on function public.get_monthly_bi(date, boolean) to authenticated;

create or replace function public.mark_monthly_bi_dirty()
returns trigger language plpgsql security definer set search_path=public as $$
declare cid uuid; changed_date date;
begin
  if tg_table_name='meals' then cid:=coalesce(new.couple_id,old.couple_id); changed_date:=coalesce(new.meal_date,old.meal_date);
  elsif tg_table_name='diaries' then cid:=coalesce(new.couple_id,old.couple_id); changed_date:=coalesce(new.diary_date,old.diary_date);
  elsif tg_table_name='monthly_goals' then cid:=coalesce(new.couple_id,old.couple_id); changed_date:=coalesce(new.target_month,old.target_month);
  else cid:=coalesce(new.couple_id,old.couple_id); changed_date:=coalesce((new.start_at at time zone 'Asia/Seoul')::date,(old.start_at at time zone 'Asia/Seoul')::date); end if;
  if date_trunc('month',changed_date)::date < date_trunc('month',timezone('Asia/Seoul',now()))::date then
    update public.monthly_bi_snapshots set status='needs_recalculation', dirty_at=now() where couple_id=cid and month_start=date_trunc('month',changed_date)::date;
  end if;
  return coalesce(new,old);
end $$;

drop trigger if exists meals_mark_bi_dirty on public.meals;
create trigger meals_mark_bi_dirty after insert or update or delete on public.meals for each row execute function public.mark_monthly_bi_dirty();
drop trigger if exists schedules_mark_bi_dirty on public.schedules;
create trigger schedules_mark_bi_dirty after insert or update or delete on public.schedules for each row execute function public.mark_monthly_bi_dirty();
drop trigger if exists diaries_mark_bi_dirty on public.diaries;
create trigger diaries_mark_bi_dirty after insert or update or delete on public.diaries for each row execute function public.mark_monthly_bi_dirty();
drop trigger if exists goals_mark_bi_dirty on public.monthly_goals;
create trigger goals_mark_bi_dirty after insert or update or delete on public.monthly_goals for each row execute function public.mark_monthly_bi_dirty();

create or replace function public.mark_food_monthly_bi_dirty()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_meal public.meals%rowtype;
begin
  select * into target_meal from public.meals where id=coalesce(new.meal_id,old.meal_id);
  if target_meal.meal_date < date_trunc('month',timezone('Asia/Seoul',now()))::date then
    update public.monthly_bi_snapshots set status='needs_recalculation', dirty_at=now()
    where couple_id=target_meal.couple_id and month_start=date_trunc('month',target_meal.meal_date)::date;
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists meal_foods_mark_bi_dirty on public.meal_food_items;
create trigger meal_foods_mark_bi_dirty after insert or update or delete on public.meal_food_items for each row execute function public.mark_food_monthly_bi_dirty();

create or replace function public.finalize_previous_monthly_bi()
returns void language plpgsql security definer set search_path=public as $$
declare c record; previous_month date := (date_trunc('month',timezone('Asia/Seoul',now())) - interval '1 month')::date;
begin
  if extract(day from timezone('Asia/Seoul',now())) <> 1 then return; end if;
  for c in select id from public.couples loop perform public.calculate_monthly_bi(c.id, previous_month, 'finalized'); end loop;
end $$;

create extension if not exists pg_cron with schema extensions;
do $$ begin perform cron.unschedule(jobid) from cron.job where jobname='coupledaily-monthly-bi'; exception when others then null; end $$;
select cron.schedule('coupledaily-monthly-bi', '1 15 * * *', 'select public.finalize_previous_monthly_bi()');
