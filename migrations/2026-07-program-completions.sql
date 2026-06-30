-- ════════════════════════════════════════════════════════════════
-- TIVRA — Programme Completion Certificate migration
-- Run this in the Supabase SQL editor.
--
-- Context: certificates (existing table) tracks PER-PHASE assessment
-- passes — this already works correctly and is unchanged here.
-- This migration adds a SEPARATE table for the overall "you finished
-- everything you enrolled in" certificate — distinct from, and issued
-- in addition to, the per-phase certificates. A Bundle student who
-- passes both Cloud LaunchPad and Cloud Architect phase assessments
-- gets 2 phase certificates (as today) PLUS 1 new completion
-- certificate once both are done.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS program_completions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id           uuid REFERENCES programs(id) ON DELETE SET NULL,
  -- plan reflects what they actually paid for: 'cloud_launchpad' | 'cloud_architect' | 'bundle'
  plan                 text NOT NULL,
  -- snapshot of which phase_ids contributed to this completion, for audit/display
  phase_ids_completed  uuid[] NOT NULL DEFAULT '{}',
  issued_at            timestamptz NOT NULL DEFAULT now(),
  is_revoked           boolean NOT NULL DEFAULT false,
  verification_code    text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
);

-- One completion certificate per student per plan — re-running the
-- check after future enrollments won't create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS program_completions_student_plan_unique
  ON program_completions (student_id, plan);

CREATE INDEX IF NOT EXISTS idx_program_completions_student
  ON program_completions (student_id);

CREATE INDEX IF NOT EXISTS idx_program_completions_verification
  ON program_completions (verification_code);

ALTER TABLE program_completions ENABLE ROW LEVEL SECURITY;

-- Students can read their own completion certificates
CREATE POLICY "Students read own program completions"
  ON program_completions FOR SELECT
  USING (student_id = auth.uid());

-- Admins/teachers can read all (for support/verification purposes)
CREATE POLICY "Staff read all program completions"
  ON program_completions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','teacher'))
  );

-- Only the service role (server-side, via adminSB()) writes rows —
-- no direct client insert/update policy needed, matching the pattern
-- already used for the certificates table.
