-- 2026-04-27: First-time client portal onboarding flag.
--
-- Note: the canonical user-profile table in this project is `users`, not `profiles`.
-- The Supabase auth.users table is separate and not modified here.

alter table users
  add column if not exists has_completed_onboarding boolean not null default false;

-- Existing partner-managed clients added before this migration should not see the
-- welcome card. Backfill them as already onboarded.
update users
set has_completed_onboarding = true
where created_at < now()
  and has_completed_onboarding = false;
