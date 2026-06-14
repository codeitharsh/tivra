-- ═══════════════════════════════════════════════════════════════
--  TIVRA V2 MIGRATION
--  Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Programs: add Cloud Architect ─────────────────────────
INSERT INTO programs (name, slug, description, is_active)
VALUES (
  'Cloud Architect',
  'cloud-architect',
  'AWS Solutions Architect Associate certification programme — 4 months',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. enrolled_programs: many-to-many student ↔ programs ────
CREATE TABLE IF NOT EXISTS enrolled_programs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  program_id   uuid NOT NULL REFERENCES programs(id)  ON DELETE CASCADE,
  plan         text NOT NULL DEFAULT 'upfront',  -- 'upfront' | 'emi_3' | 'emi_6'
  amount_paid  numeric(10,2),
  enrolled_at  timestamptz DEFAULT now(),
  access_granted_at timestamptz,
  UNIQUE(student_id, program_id)
);

ALTER TABLE enrolled_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own enrollments"
ON enrolled_programs FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Admins full access to enrolled_programs"
ON enrolled_programs FOR ALL
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── 3. Add plan + emi fields to payment_requests ─────────────
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS plan          text DEFAULT 'upfront',
  ADD COLUMN IF NOT EXISTS emi_months    int,
  ADD COLUMN IF NOT EXISTS program_ids   text[];  -- array of program slugs selected

-- ── 4. Add teacher assignment to modules ─────────────────────
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS assigned_teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_modules_teacher ON modules(assigned_teacher_id);

-- ── 5. Add batch_id + enrolled_program_ids to profiles ───────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS selected_programs  text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS batch_id           uuid     REFERENCES batches(id) ON DELETE SET NULL;

-- ── 6. Notifications table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text,
  type       text DEFAULT 'info',  -- 'info' | 'success' | 'warning'
  is_read    boolean DEFAULT false,
  link       text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins insert notifications"
ON notifications FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','teacher'))
);

-- ── 7. Seed Cloud Architect phases + modules ─────────────────
DO $$
DECLARE
  prog_id uuid;
  p1_id   uuid;
  p2_id   uuid;
BEGIN
  SELECT id INTO prog_id FROM programs WHERE slug = 'cloud-architect';
  IF prog_id IS NULL THEN RETURN; END IF;

  -- Phase 1: Foundation (2 months)
  INSERT INTO phases (program_id, title, phase_number, description)
  VALUES (prog_id, 'AWS Solutions Architect Foundation', 1, 'Core architecture concepts and services')
  ON CONFLICT DO NOTHING
  RETURNING id INTO p1_id;

  IF p1_id IS NOT NULL THEN
    INSERT INTO modules (phase_id, title, module_number, is_unlocked) VALUES
      (p1_id, 'EC2 Advanced & Auto Scaling',        1, false),
      (p1_id, 'Load Balancers & High Availability', 2, false),
      (p1_id, 'Serverless — Lambda & API Gateway',  3, false),
      (p1_id, 'Advanced Storage & Replication',     4, false),
      (p1_id, 'Hybrid Connectivity & Architecture', 5, false),
      (p1_id, 'Route 53 & DNS Policies',            6, false)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Phase 2: Advanced (2 months)
  INSERT INTO phases (program_id, title, phase_number, description)
  VALUES (prog_id, 'AWS Solutions Architect Advanced', 2, 'Advanced patterns and exam preparation')
  ON CONFLICT DO NOTHING
  RETURNING id INTO p2_id;

  IF p2_id IS NOT NULL THEN
    INSERT INTO modules (phase_id, title, module_number, is_unlocked) VALUES
      (p2_id, 'CloudFront & Global Accelerator',  1, false),
      (p2_id, 'Advanced IAM & Security',          2, false),
      (p2_id, 'Migration & Disaster Recovery',    3, false),
      (p2_id, 'Architecture Patterns',            4, false),
      (p2_id, 'Well-Architected Framework',       5, false),
      (p2_id, 'Solutions Architect Exam Prep',    6, false)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────
SELECT name, slug FROM programs ORDER BY name;
SELECT COUNT(*) as module_count, p.name FROM modules m
JOIN phases ph ON ph.id = m.phase_id
JOIN programs p ON p.id = ph.program_id
GROUP BY p.name;
