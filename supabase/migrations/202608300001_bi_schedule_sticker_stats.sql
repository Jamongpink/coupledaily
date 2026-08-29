-- Add per-user monthly schedule sticker TOP 5 to BI snapshots.

create or replace function public.add_schedule_sticker_stats(p_couple uuid, p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  month_first date := date_trunc('month', p_month)::date;
  current_month date := date_trunc('month', timezone('Asia/Seoul', now()))::date;
  period_last date;
  member record;
  sticker_stats jsonb;
  weekly_stats jsonb;
  updated_stats jsonb;
begin
  period_last := case
    when month_first = current_month then timezone('Asia/Seoul', now())::date
    else (month_first + interval '1 month - 1 day')::date
  end;

  select stats into updated_stats
  from public.monthly_bi_snapshots
  where couple_id = p_couple and month_start = month_first;

  if updated_stats is null then return null; end if;

  for member in select user_id from public.couple_members where couple_id = p_couple loop
    select coalesce(
      jsonb_agg(jsonb_build_object('sticker', sticker, 'count', uses) order by uses desc, sticker),
      '[]'::jsonb
    ) into sticker_stats
    from (
      select sticker, count(*) uses
      from public.schedules
      where couple_id = p_couple
        and user_id = member.user_id
        and (start_at at time zone 'Asia/Seoul')::date between month_first and period_last
      group by sticker
      order by uses desc, sticker
      limit 5
    ) ranked;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'startDate', greatest(week_start::date, month_first),
          'endDate', least((week_start::date + 6), period_last),
          'stickers', (
            select coalesce(
              jsonb_agg(jsonb_build_object('sticker', sticker, 'count', uses) order by uses desc, sticker),
              '[]'::jsonb
            )
            from (
              select s.sticker, count(*) uses
              from public.schedules s
              where s.couple_id = p_couple
                and s.user_id = member.user_id
                and (s.start_at at time zone 'Asia/Seoul')::date
                  between greatest(week_start::date, month_first) and least((week_start::date + 6), period_last)
              group by s.sticker
              order by uses desc, s.sticker
            ) week_ranked
          )
        ) order by week_start
      ),
      '[]'::jsonb
    ) into weekly_stats
    from generate_series(
      date_trunc('week', month_first)::date,
      date_trunc('week', period_last)::date,
      interval '7 days'
    ) generated(week_start);

    updated_stats := jsonb_set(
      updated_stats,
      array['users', member.user_id::text, 'scheduleStickers'],
      jsonb_build_object('monthly', sticker_stats, 'weekly', weekly_stats),
      true
    );
  end loop;

  update public.monthly_bi_snapshots
  set stats = updated_stats
  where couple_id = p_couple and month_start = month_first;

  return (
    select to_jsonb(snapshot)
    from public.monthly_bi_snapshots snapshot
    where snapshot.couple_id = p_couple and snapshot.month_start = month_first
  );
end $$;

create or replace function public.get_monthly_bi(p_month date, p_recalculate boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target_couple uuid;
  target_month date := date_trunc('month', p_month)::date;
  existing jsonb;
begin
  select couple_id into target_couple from public.couple_members where user_id=auth.uid() limit 1;
  if target_couple is null then raise exception 'Partner connection required'; end if;

  if not p_recalculate then
    select to_jsonb(s) into existing
    from public.monthly_bi_snapshots s
    where s.couple_id=target_couple and s.month_start=target_month;
  end if;

  if existing is null then
    perform public.calculate_monthly_bi(
      target_couple,
      target_month,
      case when target_month < date_trunc('month', timezone('Asia/Seoul',now()))::date then 'finalized' else 'in_progress' end
    );
  end if;

  return public.add_schedule_sticker_stats(target_couple, target_month);
end $$;

create or replace function public.finalize_previous_monthly_bi()
returns void language plpgsql security definer set search_path=public as $$
declare
  c record;
  previous_month date := (date_trunc('month',timezone('Asia/Seoul',now())) - interval '1 month')::date;
begin
  if extract(day from timezone('Asia/Seoul',now())) <> 1 then return; end if;
  for c in select id from public.couples loop
    perform public.calculate_monthly_bi(c.id, previous_month, 'finalized');
    perform public.add_schedule_sticker_stats(c.id, previous_month);
  end loop;
end $$;

revoke all on function public.add_schedule_sticker_stats(uuid, date) from public, anon, authenticated;
