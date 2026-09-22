create index if not exists manual_assessments_assessment_id_idx
  on public.manual_assessments (assessment_id);

create index if not exists manual_assessments_created_by_idx
  on public.manual_assessments (created_by);

create index if not exists manual_assessments_vehicle_id_idx
  on public.manual_assessments (vehicle_id);

alter policy "customers can view own payments"
  on public.payments
  using (user_id = (select auth.uid()));

alter policy "manual_assessments_customer_select"
  on public.manual_assessments
  using (customer_id = (select auth.uid()));
