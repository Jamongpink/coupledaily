-- Qualify partner_invites columns because the function also returns expires_at.

create or replace function public.create_partner_invite()
returns table (invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_couple_id uuid;
  generated_code text;
  generated_expires_at timestamptz;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select members.couple_id
    into current_couple_id
  from public.couple_members as members
  where members.user_id = current_user_id;

  if current_couple_id is null then
    insert into public.couples (created_by)
    values (current_user_id)
    returning id into current_couple_id;

    insert into public.couple_members (couple_id, user_id)
    values (current_couple_id, current_user_id);
  elsif (
    select count(*)
    from public.couple_members as members
    where members.couple_id = current_couple_id
  ) >= 2 then
    raise exception '이미 파트너와 연결되어 있습니다.';
  end if;

  update public.partner_invites as invites
  set expires_at = now()
  where invites.created_by = current_user_id
    and invites.accepted_at is null
    and invites.expires_at > now();

  loop
    generated_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (
      select 1
      from public.partner_invites as invites
      where invites.code = generated_code
    );
  end loop;

  generated_expires_at := now() + interval '24 hours';

  insert into public.partner_invites (
    couple_id,
    code,
    created_by,
    expires_at
  )
  values (
    current_couple_id,
    generated_code,
    current_user_id,
    generated_expires_at
  );

  return query select generated_code, generated_expires_at;
end;
$$;

revoke all on function public.create_partner_invite() from public, anon;
grant execute on function public.create_partner_invite() to authenticated;
