-- Phase 9 reliability hardening: durable AI analysis attempt telemetry.
-- Prepared only on the feature branch. Apply to Supabase after explicit approval.

create table if not exists public.ai_analysis_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('started','completed','failed','timed_out')),
  provider text not null default 'openai',
  model text not null,
  provider_request_id text,
  provider_attempts integer not null default 0 check (provider_attempts >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  estimated_cost_usd numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assessment_id, attempt_number)
);

create index if not exists ai_analysis_attempts_assessment_started_idx
  on public.ai_analysis_attempts (assessment_id, started_at desc);

create index if not exists ai_analysis_attempts_status_started_idx
  on public.ai_analysis_attempts (status, started_at desc);

alter table public.ai_analysis_attempts enable row level security;

-- Customers may read telemetry only for assessments they own.
create policy "Customers can read own AI attempts"
on public.ai_analysis_attempts
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.assessments a
    where a.id = ai_analysis_attempts.assessment_id
      and a.user_id = (select auth.uid())
  )
);

-- Writes are intentionally server-only through the Edge Function secret key.
revoke insert, update, delete on public.ai_analysis_attempts from anon, authenticated;
grant select on public.ai_analysis_attempts to authenticated;
