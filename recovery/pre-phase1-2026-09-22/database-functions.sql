-- Recovery snapshot captured 2026-09-22 before Phase 1 changes.
-- Source: live Supabase project lenrhtlpnlcsoecnbmcv.

CREATE OR REPLACE FUNCTION public.assign_assessment_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  profile_exists boolean;
begin
  select true into profile_exists
  from public.profiles
  where id = new.user_id
  for update;

  if not found then
    raise exception 'Customer profile not found';
  end if;

  if exists (
    select 1
    from public.assessments
    where user_id = new.user_id
  ) then
    new.payment_required := true;
    new.payment_status := 'pending';
    new.payment_amount := 199;
  else
    new.payment_required := false;
    new.payment_status := 'free';
    new.payment_amount := 0;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$function$;

-- Privileges observed at snapshot time:
-- assign_assessment_payment(): anon EXECUTE=true, authenticated EXECUTE=true
-- is_admin(): anon EXECUTE=false, authenticated EXECUTE=true

