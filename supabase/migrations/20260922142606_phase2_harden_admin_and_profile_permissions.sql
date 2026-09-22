-- Keep the public RPC used by the admin login, but remove elevated execution.
-- Once the redundant recursive policy below is removed, RLS allows each caller
-- to read their own profile row and check only their own role.
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

-- This policy is redundant with profiles_select and called the public helper
-- from inside a profiles query. Remove it to avoid policy recursion.
drop policy if exists "admins can view profiles" on public.profiles;

-- Customers currently have no profile-editing flow. Removing table-wide UPDATE
-- prevents them from changing the role column and promoting themselves to admin.
revoke update on table public.profiles from authenticated;
