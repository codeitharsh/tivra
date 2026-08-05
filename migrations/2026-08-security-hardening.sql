-- ════════════════════════════════════════════════════════════════
-- TIVRA — Security hardening pass (Critical/High findings from the
-- 2026-08 backend/RLS/database audit).
--
-- Run this in the Supabase SQL Editor. Every statement is idempotent
-- (safe to re-run) using IF NOT EXISTS / DROP-then-CREATE guards, in
-- keeping with this repo's existing migration convention.
--
-- What this fixes, and why:
--
--  1. test_questions / assessment_questions had NO row level security
--     at all. Every legitimate read of these tables already goes
--     through the service-role client server-side (take-test pages
--     explicitly SELECT only id/question_text/options, never
--     correct_answer) — but because RLS was never enabled, Supabase's
--     PostgREST API exposed the FULL row (including correct_answer)
--     to anyone with the public anon key and a valid session, via a
--     direct REST call that never touches this app's code at all.
--     That's a live answer-leak, not a theoretical one.
--
--  2. session_controls (live-class join codes) had no RLS either —
--     same class of issue, lower severity (a join code, not a graded
--     answer key), same fix.
--
--  3. faculty_referrals exists in production but was never captured
--     in any tracked migration — this creates it (safely, if it's
--     already there) and brings it under RLS for the first time.
--
--  4. payment_requests' "Student own payments" policy only declared a
--     USING clause. Postgres falls back to USING as the WITH CHECK
--     for FOR ALL policies when none is given, so this was very
--     likely NOT exploitable — but making it explicit removes any
--     ambiguity for the next person reading this schema.
--
--  5. Indexes on the leading column of an existing composite
--     UNIQUE constraint (e.g. test_attempts(student_id, test_id))
--     are already usable for single-column lookups on that leading
--     column — Postgres can use a prefix of a multi-column index.
--     What's actually missing is coverage for (a) columns that are
--     NOT the leading column of any existing constraint, and (b)
--     columns with no covering constraint at all. This migration
--     only adds those — not a blanket "index everything" pass.
--
--  6. payment_requests.status flipping to 'approved' is supposed to
--     always be paired with an enrolled_programs row — but that
--     pairing lived entirely in application code, with no DB-level
--     guarantee. That's exactly how the incident behind
--     2026-07-recover-missing-enrollments.sql happened (a code path
--     updated payment_requests without also writing
--     enrolled_programs). This adds a trigger as a safety net: it
--     does nothing when app code already did its job (ON CONFLICT DO
--     NOTHING), and silently fills the gap when it didn't.
-- ════════════════════════════════════════════════════════════════


-- ── 1. RLS: test_questions / assessment_questions ─────────────────
-- Locks direct table access down to staff (teachers/admins manage
-- questions from the browser via the anon-key client). Student-facing
-- test-taking already goes through the service-role client server
-- side, which bypasses RLS entirely — this change does not affect it.

alter table test_questions       enable row level security;
alter table assessment_questions enable row level security;

drop policy if exists "Staff manage test_questions" on test_questions;
create policy "Staff manage test_questions"
  on test_questions for all using (is_staff());

drop policy if exists "Staff manage assessment_questions" on assessment_questions;
create policy "Staff manage assessment_questions"
  on assessment_questions for all using (is_staff());


-- ── 2. RLS: session_controls ───────────────────────────────────────
-- Attendance marking and live-session join-code reads are both
-- server-side (service-role client) — this only blocks direct client
-- access to join codes for sessions the caller isn't staff on.

alter table session_controls enable row level security;

drop policy if exists "Staff manage session_controls" on session_controls;
create policy "Staff manage session_controls"
  on session_controls for all using (is_staff());


-- ── 3. faculty_referrals: bring under version control + RLS ────────
-- Matches the columns already relied on by src/types/database.ts and
-- every route that queries this table. Safe no-op if the table (and
-- its data) already exists — CREATE TABLE IF NOT EXISTS never touches
-- existing rows.

create table if not exists faculty_referrals (
  id              uuid primary key default gen_random_uuid(),
  faculty_name    text not null,
  faculty_email   text,
  referral_code   text not null unique,
  discount_amount numeric(10,2) not null default 0,
  is_active       boolean not null default true,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now()
);

alter table faculty_referrals enable row level security;

drop policy if exists "Staff manage faculty_referrals" on faculty_referrals;
create policy "Staff manage faculty_referrals"
  on faculty_referrals for all using (is_staff());


-- ── 4. payment_requests: make the INSERT check explicit ────────────

drop policy if exists "Student own payments" on payment_requests;
create policy "Student own payments"
  on payment_requests for all
  using      (auth.uid() = student_id)
  with check (auth.uid() = student_id);


-- ── 5. Missing indexes ──────────────────────────────────────────────
-- Only columns genuinely uncovered by an existing constraint/index —
-- see header note. Plain CREATE INDEX (not CONCURRENTLY) matches this
-- repo's existing migrations and is fine at current table sizes; once
-- these tables are large in production, prefer recreating with
-- CONCURRENTLY to avoid locking writes during the build.

create index if not exists idx_assessment_attempts_student  on assessment_attempts(student_id);
create index if not exists idx_module_progress_module        on module_progress(module_id);
create index if not exists idx_payment_requests_student      on payment_requests(student_id);
create index if not exists idx_attendance_records_student    on attendance_records(student_id);
create index if not exists idx_doubts_student                on doubts(student_id);
create index if not exists idx_doubts_module                 on doubts(module_id);
create index if not exists idx_enrolled_programs_program     on enrolled_programs(program_id);
create index if not exists idx_test_attempts_test            on test_attempts(test_id);


-- ── 6. Safety-net trigger: approved payment → enrollment ────────────
-- Fires only on the transition INTO 'approved' (not on every update),
-- and only when program_id is actually set — mirrors the exact shape
-- verify-payment/route.ts already upserts, so this is a no-op when
-- application code did its job.

create or replace function ensure_enrollment_on_payment_approval()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'approved'
     and (old.status is distinct from 'approved')
     and new.program_id is not null then
    insert into enrolled_programs (student_id, program_id, plan, amount_paid, enrolled_at, access_granted_at)
    values (
      new.student_id,
      new.program_id,
      coalesce(new.plan, 'upfront'),
      new.amount,
      now(),
      now()
    )
    on conflict (student_id, program_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_approval_enrollment on payment_requests;
create trigger trg_payment_approval_enrollment
  after update on payment_requests
  for each row
  execute function ensure_enrollment_on_payment_approval();


-- ── Done — verification queries ─────────────────────────────────────
-- Run these after applying the migration to confirm it landed cleanly.

-- Should return true for all 5 rows:
-- select relname, relrowsecurity from pg_class
--   where relname in ('test_questions','assessment_questions','session_controls','faculty_referrals','payment_requests');

-- Should list the 8 new indexes:
-- select indexname from pg_indexes where indexname like 'idx_%' and indexname in (
--   'idx_assessment_attempts_student','idx_module_progress_module','idx_payment_requests_student',
--   'idx_attendance_records_student','idx_doubts_student','idx_doubts_module',
--   'idx_enrolled_programs_program','idx_test_attempts_test');

-- Should return the trigger:
-- select tgname from pg_trigger where tgname = 'trg_payment_approval_enrollment';
