-- Phase 6B: require an MFA-backed session for every admin RLS decision.
-- Deploy the MFA-capable web application before applying this migration so an
-- existing administrator can enroll and verify a TOTP factor first.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    );
$function$;

-- The public helper is intentionally role-only. It is used solely to route an
-- authenticated administrator into MFA enrollment/challenge. All privileged
-- data access is enforced by private.is_admin() above.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$function$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

-- Reduce exposed-table privileges to the operations actually used by clients.
-- RLS remains the primary row-level control; these grants are defense in depth.
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;
grant select, insert on table public.profiles to authenticated;
