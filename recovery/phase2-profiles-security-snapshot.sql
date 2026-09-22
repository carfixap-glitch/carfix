-- Additional CarFix Phase 2 recovery snapshot.
-- Captured before profile privilege and public is_admin changes.

create schema if not exists private;

create or replace function private.is_admin()
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

grant execute on function private.is_admin() to authenticated;

create policy "admins can view profiles"
on public.profiles for select
to authenticated
using ((select public.is_admin()));

create policy "profiles_select"
on public.profiles for select
to authenticated
using (((select auth.uid()) = id) or (select private.is_admin()));

create policy "profiles_update"
on public.profiles for update
to authenticated
using (((select auth.uid()) = id) or (select private.is_admin()))
with check (((select auth.uid()) = id) or (select private.is_admin()));

grant update on table public.profiles to authenticated;
