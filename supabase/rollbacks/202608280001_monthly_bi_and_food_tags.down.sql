-- Roll back 202608280001_monthly_bi_and_food_tags.sql.
-- WARNING: this removes food-name tags and monthly BI snapshot data created after deployment.

do $$
declare target_job bigint;
begin
  select jobid into target_job from cron.job where jobname = 'coupledaily-monthly-bi' limit 1;
  if target_job is not null then perform cron.unschedule(target_job); end if;
exception when undefined_table then null;
end $$;

drop trigger if exists meal_foods_mark_bi_dirty on public.meal_food_items;
drop trigger if exists goals_mark_bi_dirty on public.monthly_goals;
drop trigger if exists diaries_mark_bi_dirty on public.diaries;
drop trigger if exists schedules_mark_bi_dirty on public.schedules;
drop trigger if exists meals_mark_bi_dirty on public.meals;
drop trigger if exists prepare_meal_food_item on public.meal_food_items;

drop function if exists public.finalize_previous_monthly_bi();
drop function if exists public.mark_food_monthly_bi_dirty();
drop function if exists public.mark_monthly_bi_dirty();
drop function if exists public.get_monthly_bi(date, boolean);
drop function if exists public.calculate_monthly_bi(uuid, date, text);
drop function if exists public.prepare_meal_food_item();

drop table if exists public.monthly_bi_snapshots;
drop table if exists public.meal_food_items;
