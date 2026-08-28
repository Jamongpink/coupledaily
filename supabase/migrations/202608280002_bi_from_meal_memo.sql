-- Use the existing meal memo as the food name/autocomplete source and BI basis.

create or replace function public.calculate_monthly_bi(p_couple uuid, p_month date, p_status text default 'in_progress')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  month_first date := date_trunc('month', p_month)::date;
  current_month date := date_trunc('month', timezone('Asia/Seoul', now()))::date;
  period_last date;
  member record;
  people jsonb := '{}'::jsonb;
  person jsonb;
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
      'topFoods', (
        select coalesce(jsonb_agg(jsonb_build_object('name', food_name, 'count', uses) order by uses desc, food_name), '[]'::jsonb)
        from (
          select min(trim(food_name)) food_name, count(*) uses
          from public.meals m
          cross join lateral regexp_split_to_table(m.memo, '\s*,\s*') food_name
          where m.couple_id=p_couple and m.user_id=member.user_id
            and m.meal_date between month_first and period_last
            and trim(food_name) <> ''
          group by lower(regexp_replace(trim(food_name), '\s+', ' ', 'g'))
          order by uses desc, food_name
          limit 5
        ) ranked
      )
    ) into person;
    people := people || jsonb_build_object(member.user_id::text, person);
  end loop;

  result := jsonb_build_object('users', people);
  insert into public.monthly_bi_snapshots(couple_id, month_start, period_start, period_end, status, stats, calculated_at, dirty_at)
  values(p_couple, month_first, month_first, period_last, p_status, result, now(), null)
  on conflict(couple_id, month_start) do update set period_end=excluded.period_end, status=excluded.status, stats=excluded.stats, calculated_at=now(), dirty_at=null;
  return (select to_jsonb(s) from public.monthly_bi_snapshots s where s.couple_id=p_couple and s.month_start=month_first);
end $$;

drop trigger if exists meal_foods_mark_bi_dirty on public.meal_food_items;
drop trigger if exists prepare_meal_food_item on public.meal_food_items;
drop function if exists public.mark_food_monthly_bi_dirty();
drop function if exists public.prepare_meal_food_item();
drop table if exists public.meal_food_items;
