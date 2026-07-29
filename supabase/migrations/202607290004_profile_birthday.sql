-- Birthday collected during CoupleDaily onboarding after social login.

alter table public.profiles
  add column if not exists birthday date
  check (birthday is null or birthday <= current_date);
