create or replace function public.mark_support_ticket_customer_replied()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sender_type = 'customer' then
    update public.support_tickets
    set status = case when status = 'waiting_for_customer' then 'in_review' else status end,
        updated_at = now()
    where id = new.ticket_id and status <> 'resolved';
  end if;
  return new;
end;
$$;
revoke all on function public.mark_support_ticket_customer_replied() from public, anon, authenticated;
drop trigger if exists support_customer_reply_status on public.support_messages;
create trigger support_customer_reply_status after insert on public.support_messages
for each row execute function public.mark_support_ticket_customer_replied();