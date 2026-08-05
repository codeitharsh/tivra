-- ════════════════════════════════════════════════════════════════
-- TIVRA — Admin audit log, migration version-tracking, and safe
-- NOT NULL backfills (Medium findings from the 2026-08 audit).
--
-- Run this in the Supabase SQL Editor, after
-- 2026-08-security-hardening.sql. Idempotent, safe to re-run.
--
--  1. admin_audit_log — a generic table for recording sensitive admin
--     actions. Only `change_role` writes to it for now (see
--     src/app/api/admin/route.ts); more actions can start writing to
--     it later without any schema change.
--
--  2. schema_migrations — this repo's migrations have always been
--     hand-run SQL files tracked only by filename convention, with no
--     record of what's actually been applied to a given database
--     (that's exactly how faculty_referrals ended up untracked). This
--     doesn't turn it into a real migration tool — it just gives you
--     a table to check "has X already been run here?" going forward.
--     Backfilled with every migration file that exists in this repo
--     as of this one, on the assumption you're running this against
--     the database they were already applied to. If that's wrong for
--     any of them, delete that row after running this.
--
--  3. NOT NULL on payment_requests.amount, test_attempts.score_percent,
--     certificates.score_percent — verified by reading every insert
--     path in the codebase that every current write already sets
--     these; the backfill only matters for any pre-existing rows left
--     over from before those code paths were correct. Deliberately
--     NOT touching programs.price_inr/duration_label — those are
--     intentionally nullable (drives the "Revealing Soon" state on
--     unpriced programmes); forcing NOT NULL there would break that
--     feature outright.
-- ════════════════════════════════════════════════════════════════


-- ── 1. Admin audit log ──────────────────────────────────────────────

create table if not exists admin_audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles(id),
  action     text not null,
  target_id  uuid,
  details    jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_admin_audit_log_actor  on admin_audit_log(actor_id);
create index if not exists idx_admin_audit_log_target on admin_audit_log(target_id);

alter table admin_audit_log enable row level security;

drop policy if exists "Staff read audit log" on admin_audit_log;
create policy "Staff read audit log"
  on admin_audit_log for select using (is_staff());

-- Inserts only ever happen server-side via the service-role client
-- (which bypasses RLS entirely) — intentionally no INSERT policy, so
-- nothing with just an anon/authenticated session can write a fake
-- audit row.


-- ── 2. Migration version tracking ───────────────────────────────────

create table if not exists schema_migrations (
  filename    text primary key,
  applied_at  timestamptz default now(),
  note        text
);

insert into schema_migrations (filename, note) values
  ('supabase-schema.sql',                          'Base schema'),
  ('tivra-v2-migration.sql',                        'enrolled_programs + payment_requests plan/emi fields'),
  ('tivra-batches-migration.sql',                   'Batches'),
  ('tivra-daily-migration.sql',                     'Daily.co live session fields'),
  ('tivra-sessions-batch-migration.sql',            'Live sessions <-> batches'),
  ('fix-trigger.sql',                               'handle_new_user() role/access_status fix'),
  ('migrations/2026-06-audit-and-idempotency.sql',  NULL),
  ('migrations/2026-07-27-programs-expansion-and-leads.sql', NULL),
  ('migrations/2026-07-28-program-content-and-features.sql', NULL),
  ('migrations/2026-07-program-completions.sql',    NULL),
  ('migrations/2026-07-program-explore-metadata.sql', NULL),
  ('migrations/2026-07-recover-missing-enrollments.sql', 'Backfill script, not schema-changing'),
  ('migrations/2026-08-security-hardening.sql',     'RLS gaps, indexes, payment-approval trigger'),
  ('migrations/2026-08-audit-log-tracking-and-constraints.sql', 'This file')
on conflict (filename) do nothing;

-- Going forward: add a row here at the bottom of any new migration
-- file, e.g.
--   insert into schema_migrations (filename, note)
--   values ('migrations/2026-09-whatever.sql', 'short description')
--   on conflict (filename) do nothing;


-- ── 3. Safe NOT NULL backfills ───────────────────────────────────────

-- payment_requests.amount — any existing NULL here is already a data
-- anomaly (every insert path sets it); 0 makes it visible rather than
-- hidden, not a claim that the amount was actually zero.
update payment_requests set amount = 0 where amount is null;
alter table payment_requests alter column amount set not null;

update test_attempts set score_percent = 0 where score_percent is null;
alter table test_attempts alter column score_percent set not null;

update certificates set score_percent = 0 where score_percent is null;
alter table certificates alter column score_percent set not null;


-- ── Done — verification queries ─────────────────────────────────────

-- select count(*) from admin_audit_log;              -- 0 until the next role change
-- select * from schema_migrations order by applied_at;
-- select column_name, is_nullable from information_schema.columns
--   where table_name in ('payment_requests','test_attempts','certificates')
--   and column_name in ('amount','score_percent');
