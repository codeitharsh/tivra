-- Adds batch scoping to weekly_tests, mirroring the existing
-- live_sessions.batch_id pattern (tivra-sessions-batch-migration.sql).
-- Nullable: null means "visible to the whole programme" (unchanged
-- behavior for every existing row).

alter table weekly_tests
  add column if not exists batch_id uuid references batches(id) on delete set null;

create index if not exists idx_weekly_tests_batch_id on weekly_tests(batch_id);
