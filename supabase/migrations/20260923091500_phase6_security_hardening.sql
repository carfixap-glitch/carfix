create schema if not exists private;
grant usage on schema private to service_role;

create table if not exists private.request_rate_limits (
  user_id uuid not null,
  action text not null check (char_length(action) between 1 and 80),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, action)
);

revoke all on table private.request_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table private.request_rate_limits to service_role;

create or replace function public.consume_request_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer, remaining integer)
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  current_count integer;
  current_window timestamptz;
  now_at timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_action is null or char_length(p_action) not between 1 and 80 then
    raise exception 'invalid rate-limit identity';
  end if;
  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit configuration';
  end if;

  insert into private.request_rate_limits as limits
    (user_id, action, window_started_at, request_count, updated_at)
  values (p_user_id, p_action, now_at, 1, now_at)
  on conflict (user_id, action) do update
  set window_started_at = case
        when limits.window_started_at <= now_at - make_interval(secs => p_window_seconds) then now_at
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at <= now_at - make_interval(secs => p_window_seconds) then 1
        else limits.request_count + 1
      end,
      updated_at = now_at
  returning request_count, window_started_at into current_count, current_window;

  allowed := current_count <= p_limit;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (current_window + make_interval(secs => p_window_seconds) - now_at)))::integer)
  end;
  remaining := greatest(0, p_limit - current_count);
  return next;
end;
$$;

revoke all on function public.consume_request_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_request_limit(uuid, text, integer, integer) to service_role;

drop policy if exists "admins can view assessment garages" on public.assessment_garages;
drop policy if exists "admins can view assessment photos" on public.assessment_photos;
drop policy if exists "admins can view assessments" on public.assessments;
drop policy if exists "admins can update assessments" on public.assessments;
drop policy if exists "admins can view damage analysis" on public.damage_analysis;
drop policy if exists "admins can view repair estimates" on public.repair_estimates;
drop policy if exists "admins can view vehicles" on public.vehicles;

drop policy if exists "admins can view garages" on public.garages;
drop policy if exists "admins can manage garages" on public.garages;
drop policy if exists garages_admin_insert on public.garages;
drop policy if exists garages_admin_update on public.garages;
drop policy if exists garages_admin_delete on public.garages;
create policy garages_admin_insert on public.garages
for insert to authenticated
with check ((select private.is_admin()));
create policy garages_admin_update on public.garages
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy garages_admin_delete on public.garages
for delete to authenticated
using ((select private.is_admin()));

drop policy if exists "admins can view all payments" on public.payments;
drop policy if exists "customers can view own payments" on public.payments;
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_admin()));

drop policy if exists manual_assessments_admin_all on public.manual_assessments;
drop policy if exists manual_assessments_customer_select on public.manual_assessments;
drop policy if exists manual_assessments_select on public.manual_assessments;
drop policy if exists manual_assessments_admin_insert on public.manual_assessments;
drop policy if exists manual_assessments_admin_update on public.manual_assessments;
drop policy if exists manual_assessments_admin_delete on public.manual_assessments;
create policy manual_assessments_select on public.manual_assessments
for select to authenticated
using ((customer_id = (select auth.uid())) or (select private.is_admin()));
create policy manual_assessments_admin_insert on public.manual_assessments
for insert to authenticated
with check ((select private.is_admin()));
create policy manual_assessments_admin_update on public.manual_assessments
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy manual_assessments_admin_delete on public.manual_assessments
for delete to authenticated
using ((select private.is_admin()));
