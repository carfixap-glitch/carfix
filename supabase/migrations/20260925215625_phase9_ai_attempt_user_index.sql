-- Phase 9 reliability hardening: cover the user_id foreign key used by AI attempt telemetry.
create index if not exists ai_analysis_attempts_user_id_idx
  on public.ai_analysis_attempts (user_id);
