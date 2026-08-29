-- Remove the sticker enrichment helper. Restore get_monthly_bi and
-- finalize_previous_monthly_bi from the preceding BI migrations when rolling back.
drop function if exists public.add_schedule_sticker_stats(uuid, date);
