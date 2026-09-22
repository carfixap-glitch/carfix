create unique index if not exists payments_order_id_unique
  on public.payments (order_id)
  where order_id is not null;

create unique index if not exists payments_payment_id_unique
  on public.payments (payment_id)
  where payment_id is not null;

create unique index if not exists payments_one_pending_per_assessment
  on public.payments (assessment_id, user_id)
  where status = 'pending';

revoke all on table public.payments from anon;
revoke insert, update, delete, truncate, references, trigger on table public.payments from authenticated;
grant select on table public.payments to authenticated;

create or replace function public.finalize_razorpay_payment(
  p_user_id uuid,
  p_assessment_id uuid,
  p_order_id text,
  p_payment_id text,
  p_signature text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  payment_row public.payments%rowtype;
  assessment_amount numeric;
  now_at timestamptz := now();
begin
  select * into payment_row
  from public.payments
  where assessment_id = p_assessment_id
    and user_id = p_user_id
    and order_id = p_order_id
  for update;

  if not found then raise exception 'payment order not found'; end if;
  if payment_row.status = 'paid' then
    return jsonb_build_object('payment_status', 'paid');
  end if;

  select payment_amount into assessment_amount
  from public.assessments
  where id = p_assessment_id and user_id = p_user_id
  for update;

  if not found then raise exception 'assessment not found'; end if;
  if payment_row.amount <> assessment_amount then raise exception 'payment amount mismatch'; end if;

  update public.payments
  set status = 'paid', payment_id = p_payment_id, signature = p_signature,
      paid_at = now_at, updated_at = now_at
  where id = payment_row.id;

  update public.assessments
  set payment_status = 'paid', updated_at = now_at
  where id = p_assessment_id and user_id = p_user_id;

  return jsonb_build_object('payment_status', 'paid');
end;
$$;

revoke all on function public.finalize_razorpay_payment(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finalize_razorpay_payment(uuid, uuid, text, text, text) to service_role;

create or replace function public.reconcile_razorpay_webhook(
  p_order_id text,
  p_payment_id text,
  p_amount_paise bigint,
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  payment_row public.payments%rowtype;
  now_at timestamptz := now();
begin
  if p_status not in ('paid', 'failed') then raise exception 'invalid payment status'; end if;

  select * into payment_row
  from public.payments
  where order_id = p_order_id
  for update;

  if not found then raise exception 'payment order not found'; end if;
  if round(payment_row.amount * 100) <> p_amount_paise then raise exception 'payment amount mismatch'; end if;
  if payment_row.status = 'paid' then return jsonb_build_object('payment_status', 'paid'); end if;

  update public.payments
  set status = p_status,
      payment_id = coalesce(payment_id, p_payment_id),
      paid_at = case when p_status = 'paid' then coalesce(paid_at, now_at) else paid_at end,
      updated_at = now_at
  where id = payment_row.id;

  if p_status = 'paid' then
    update public.assessments
    set payment_status = 'paid', updated_at = now_at
    where id = payment_row.assessment_id and user_id = payment_row.user_id;
  end if;

  return jsonb_build_object('payment_status', p_status);
end;
$$;

revoke all on function public.reconcile_razorpay_webhook(text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.reconcile_razorpay_webhook(text, text, bigint, text) to service_role;
