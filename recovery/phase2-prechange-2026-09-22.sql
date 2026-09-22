-- CarFix Phase 2 pre-change recovery snapshot
-- Captured 2026-09-22 before any Phase 2 production changes.
-- Supabase Auth leaked-password protection was disabled at capture time.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$function$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
