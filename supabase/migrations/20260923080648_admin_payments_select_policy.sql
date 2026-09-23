alter policy "admins can view all payments"
  on public.payments
  to authenticated
  using ((select public.is_admin()));
