-- ============================================================
--  TIVRA — Batch System Migration
--  Run this in Supabase SQL Editor
-- ============================================================

-- ── Batch types ──────────────────────────────────────────────
CREATE TYPE batch_type   AS ENUM ('open', 'college', 'corporate', 'custom');
CREATE TYPE batch_status AS ENUM ('upcoming', 'active', 'closed', 'archived');

-- ── Batches table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      uuid REFERENCES programs(id) ON DELETE CASCADE,
  name            text NOT NULL,           -- e.g. "Cloud LaunchPad — Jan 2025"
  description     text,
  batch_type      batch_type NOT NULL DEFAULT 'open',
  status          batch_status NOT NULL DEFAULT 'upcoming',

  -- Registration visibility
  is_visible      boolean NOT NULL DEFAULT true,   -- false = hidden (college/private batches)
  max_students    int,                              -- null = unlimited

  -- Dates
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  starts_at              timestamptz,
  ends_at                timestamptz,

  -- Pricing
  price_inr       numeric(10,2),           -- null = free or contact

  -- Meta
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── Add batch_id to profiles ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES batches(id) ON DELETE SET NULL;

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_batch_id  ON profiles(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_program_id ON batches(program_id);
CREATE INDEX IF NOT EXISTS idx_batches_status     ON batches(status);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- Public can read visible batches
CREATE POLICY "Public read visible batches"
ON batches FOR SELECT
USING (is_visible = true);

-- Admins can do everything
CREATE POLICY "Admins full access to batches"
ON batches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── Seed: create first open batch for Cloud LaunchPad ─────────
INSERT INTO batches (
  program_id, name, description, batch_type, status,
  is_visible, registration_opens_at, starts_at
)
SELECT
  id,
  'Cloud LaunchPad — Batch 1',
  'First open batch of Cloud LaunchPad. Open for individual registration.',
  'open',
  'active',
  true,
  now(),
  now()
FROM programs
WHERE slug = 'cloud-launchpad'
ON CONFLICT DO NOTHING;

-- ── Verify ───────────────────────────────────────────────────
SELECT id, name, batch_type, status, is_visible FROM batches;
