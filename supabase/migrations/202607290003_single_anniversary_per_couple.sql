-- A couple can keep one shared anniversary only.

with ranked_anniversaries as (
  select
    id,
    row_number() over (
      partition by couple_id
      order by updated_at desc, created_at desc, id desc
    ) as position
  from public.anniversaries
)
delete from public.anniversaries
where id in (
  select id
  from ranked_anniversaries
  where position > 1
);

create unique index if not exists anniversaries_one_per_couple_idx
  on public.anniversaries(couple_id);
