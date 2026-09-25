create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('CF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  category text not null check (category in ('assessment_issue','payment_issue','ai_result_question','account_issue','privacy_data_request','technical_problem','other_grievance')),
  subject text not null check (char_length(subject) between 3 and 160),
  status text not null default 'open' check (status in ('open','in_review','waiting_for_customer','resolved')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz);
create table public.support_messages (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer','admin','ai')), sender_user_id uuid references public.profiles(id) on delete set null,
  message text not null check (char_length(message) between 1 and 5000), created_at timestamptz not null default now());
create index support_tickets_user_id_created_at_idx on public.support_tickets(user_id, created_at desc);
create index support_tickets_status_created_at_idx on public.support_tickets(status, created_at desc);
create index support_tickets_assessment_id_idx on public.support_tickets(assessment_id) where assessment_id is not null;
create index support_messages_ticket_id_created_at_idx on public.support_messages(ticket_id, created_at);
create index support_messages_sender_user_id_idx on public.support_messages(sender_user_id) where sender_user_id is not null;
alter table public.support_tickets enable row level security; alter table public.support_messages enable row level security;
revoke all on public.support_tickets from anon; revoke all on public.support_messages from anon;
grant select, insert, update on public.support_tickets to authenticated; grant select, insert on public.support_messages to authenticated;
grant select, insert, update, delete on public.support_tickets to service_role; grant select, insert, update, delete on public.support_messages to service_role;
create policy support_tickets_select on public.support_tickets for select to authenticated using ((user_id=(select auth.uid())) or (select private.is_admin()));
create policy support_tickets_customer_insert on public.support_tickets for insert to authenticated with check (user_id=(select auth.uid()) and status='open' and resolved_at is null and (assessment_id is null or exists(select 1 from public.assessments a where a.id=support_tickets.assessment_id and a.user_id=(select auth.uid()))));
create policy support_tickets_admin_update on public.support_tickets for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy support_messages_select on public.support_messages for select to authenticated using (exists(select 1 from public.support_tickets t where t.id=support_messages.ticket_id and (t.user_id=(select auth.uid()) or (select private.is_admin()))));
create policy support_messages_insert on public.support_messages for insert to authenticated with check (
(sender_type='customer' and sender_user_id=(select auth.uid()) and exists(select 1 from public.support_tickets t where t.id=support_messages.ticket_id and t.user_id=(select auth.uid()) and t.status<>'resolved'))
or (sender_type='admin' and sender_user_id=(select auth.uid()) and (select private.is_admin())));
