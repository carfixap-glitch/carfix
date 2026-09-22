-- Trigger functions should only run through their owning trigger.
revoke execute on function public.assign_assessment_payment() from public;
revoke execute on function public.assign_assessment_payment() from anon;
revoke execute on function public.assign_assessment_payment() from authenticated;

-- Assessment payment and processing state are server-controlled fields.
-- Current customer flows only insert and read assessments. The payment and
-- analysis Edge Functions use the service-role client for legitimate updates.
revoke update on table public.assessments from authenticated;
