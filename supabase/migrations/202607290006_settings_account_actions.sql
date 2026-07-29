-- Destructive account actions, callable only for the authenticated user.

create or replace function public.disconnect_partner()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_couple_id uuid;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select couple_id into current_couple_id
  from public.couple_members
  where user_id = current_user_id;

  if current_couple_id is null then
    return false;
  end if;

  delete from public.couples where id = current_couple_id;
  return true;
end;
$$;

create or replace function public.delete_my_account(confirmation_text text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_couple_id uuid;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if confirmation_text is distinct from '탈퇴' then
    raise exception '확인 문구가 올바르지 않습니다.';
  end if;

  select couple_id into current_couple_id
  from public.couple_members
  where user_id = current_user_id;

  if current_couple_id is not null then
    delete from public.couples where id = current_couple_id;
  end if;

  delete from auth.users where id = current_user_id;
  return true;
end;
$$;

revoke all on function public.disconnect_partner() from public, anon;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.disconnect_partner() to authenticated;
grant execute on function public.delete_my_account(text) to authenticated;
