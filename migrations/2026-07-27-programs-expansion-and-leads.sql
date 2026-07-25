-- ════════════════════════════════════════════════════════════════
-- TIVRA — Programme expansion (7 programmes), curriculum lead-gen,
-- and admin curriculum-PDF management
--
-- Context: the site is expanding from 2 to 7 programmes at new
-- prices, and pricing/duration must live in exactly one place
-- (`programs`) so the frontend never hardcodes them again — see
-- src/app/api/create-order/route.ts and the public marketing pages,
-- all rewritten to read from this table directly.
--
-- This migration also adds the schema for a new curriculum
-- lead-capture flow ("View Curriculum" now requires a short form
-- before the PDF unlocks) and per-programme curriculum PDF storage,
-- managed from a new admin page — no code changes needed to update
-- pricing, duration, or curriculum files going forward.
-- ════════════════════════════════════════════════════════════════

-- ── New columns on `programs` ──────────────────────────────────────
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS curriculum_url  text,               -- storage path in the `curricula` bucket, not a public URL
  ADD COLUMN IF NOT EXISTS faqs            jsonb,               -- optional per-programme [{q,a}] override; null = use shared default FAQ set
  ADD COLUMN IF NOT EXISTS display_order   integer DEFAULT 100; -- controls listing order on homepage/programs page

-- ── Re-price the 2 existing programmes ─────────────────────────────
UPDATE programs SET
  price_inr      = 15499,
  duration_label = '6 Months',
  display_order  = 10
WHERE slug = 'cloud-launchpad';

UPDATE programs SET
  price_inr      = 21999,
  duration_label = '6 Months',
  display_order  = 20
WHERE slug = 'cloud-architect';

-- ── Insert the 5 new programmes ─────────────────────────────────────
-- No curriculum modules/FAQs/instructor info exist yet for these —
-- deliberately left null/generic rather than fabricated. Populate via
-- the new /admin/programs page (curriculum PDF) and future migrations
-- (instructor info, learning outcomes) once real content is provided.
INSERT INTO programs (name, slug, description, tagline, is_active, price_inr, duration_label, display_order, learning_outcomes)
VALUES
  ('Data LaunchPad',   'data-launchpad',   'Your first step into data analytics and engineering.', 'Full curriculum details coming soon.', true, 11999, '6 Months', 30, '{}'),
  ('Data Architect',   'data-architect',   'Advanced data engineering and architecture for production systems.', 'Full curriculum details coming soon.', true, 17999, '6 Months', 40, '{}'),
  ('Dev LaunchPad',    'dev-launchpad',    'Your first step into full-stack software development.', 'Full curriculum details coming soon.', true, 11999, '6 Months', 50, '{}'),
  ('AI Dev Architect', 'ai-dev-architect', 'Applied AI engineering — build and ship real AI-powered products.', 'Full curriculum details coming soon.', true, 19999, '6 Months', 60, '{}'),
  ('DSA Mastery',      'dsa-mastery',      'Data structures & algorithms for interviews and competitive programming.', 'Full curriculum details coming soon.', true, 12999, '4 Months', 70, '{}')
ON CONFLICT (slug) DO NOTHING;

-- ── Curriculum download leads ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS curriculum_leads (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid references programs(id),
  full_name        text not null,
  email            text not null,
  phone            text not null,
  college_name     text,
  graduation_year  integer,
  current_status   text check (current_status in ('student','graduate','working_professional')),
  created_at       timestamptz default now()
);

ALTER TABLE curriculum_leads ENABLE ROW LEVEL SECURITY;

-- Public lead-capture form runs as anon/authenticated — allow inserts,
-- but no client (anon or authenticated) can ever read the leads back;
-- only the admin panel reads these, via the service-role key which
-- bypasses RLS entirely (same pattern as `payment_requests`).
DROP POLICY IF EXISTS curriculum_leads_insert ON curriculum_leads;
CREATE POLICY curriculum_leads_insert ON curriculum_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ── Storage bucket for curriculum PDFs ────────────────────────────────
-- Private (public=false) — the whole point of the lead-gate is that
-- the PDF isn't reachable without submitting the form first, so a
-- guessable public URL would defeat it. Reads happen only via a
-- short-lived signed URL minted after a successful lead submission;
-- writes happen only via the service-role admin upload route, which
-- bypasses storage RLS entirely (same approach as the existing
-- `notes` bucket used by src/app/api/upload-notes/route.ts).
INSERT INTO storage.buckets (id, name, public)
VALUES ('curricula', 'curricula', false)
ON CONFLICT (id) DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────────────
SELECT slug, name, price_inr, duration_label, display_order, is_active
FROM programs
ORDER BY display_order;
