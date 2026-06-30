-- ════════════════════════════════════════════════════════════════
-- TIVRA — Explore-page metadata for programs
--
-- Context: the original brief for the Explore page required showing
-- programme descriptions, LEARNING OUTCOMES, INSTRUCTOR INFORMATION,
-- and DURATION/DIFFICULTY — but the `programs` table had no columns
-- for any of this. The Explore page (src/app/pending/page.tsx) worked
-- around the gap with a hardcoded array of exactly 2 programmes,
-- which directly contradicts the DB-driven generalization done
-- elsewhere in this codebase (proxy.ts, the /programs/[slug] routes,
-- etc.) and silently drifts out of sync with the real database.
--
-- This migration adds the missing columns so the Explore page (and
-- the public programme landing pages) can be made genuinely
-- DB-driven, with real content for the 2 existing programmes
-- backfilled below using the same copy already live on their public
-- landing pages and the curriculum brief work referenced elsewhere
-- in this project's history.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS price_inr           integer,
  ADD COLUMN IF NOT EXISTS duration_label       text,
  ADD COLUMN IF NOT EXISTS difficulty           text CHECK (difficulty IN ('beginner','intermediate','advanced')),
  ADD COLUMN IF NOT EXISTS instructor_name      text,
  ADD COLUMN IF NOT EXISTS instructor_title     text,
  ADD COLUMN IF NOT EXISTS instructor_bio       text,
  ADD COLUMN IF NOT EXISTS learning_outcomes    text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tagline              text;

-- ── Backfill the 2 existing programmes with real content ──────────
-- Instructor info (Lakshika, Systems Associate at Infosys) and the
-- duration/pricing already live on the public site — this just moves
-- it into the database so the Explore page can read it dynamically
-- instead of duplicating it in a hardcoded array.

UPDATE programs SET
  price_inr        = 699900 / 100,
  duration_label    = '4 months',
  difficulty        = 'beginner',
  instructor_name   = 'Lakshika',
  instructor_title  = 'Systems Associate, Infosys',
  instructor_bio    = 'AWS-certified cloud practitioner with hands-on enterprise systems experience at Infosys, teaching the fundamentals she uses on the job every day.',
  learning_outcomes = ARRAY[
    'Understand core cloud computing concepts and AWS''s global infrastructure',
    'Configure IAM users, roles, and policies following least-privilege practices',
    'Launch and manage EC2 instances, S3 storage, and RDS/DynamoDB databases',
    'Set up VPCs, subnets, and networking for secure cloud architectures',
    'Read and optimise AWS billing, with real cost-control strategies',
    'Pass the AWS Certified Cloud Practitioner exam with confidence'
  ],
  tagline           = 'Your first step into cloud computing.'
WHERE slug = 'cloud-launchpad';

UPDATE programs SET
  price_inr         = 999900 / 100,
  duration_label    = '6 months',
  difficulty         = 'intermediate',
  instructor_name    = 'Lakshika',
  instructor_title   = 'Systems Associate, Infosys',
  instructor_bio     = 'AWS-certified cloud practitioner with hands-on enterprise systems experience at Infosys, teaching production-grade architecture patterns used in real deployments.',
  learning_outcomes  = ARRAY[
    'Design highly available, fault-tolerant architectures on AWS',
    'Configure advanced networking — Transit Gateway, Direct Connect, hybrid connectivity',
    'Implement auto-scaling, load balancing, and serverless patterns with Lambda',
    'Apply AWS Well-Architected Framework principles to real systems',
    'Plan migration and disaster-recovery strategies for production workloads',
    'Pass the AWS Certified Solutions Architect – Associate exam with confidence'
  ],
  tagline            = 'Design systems that scale.'
WHERE slug = 'cloud-architect';

-- ── Verify the backfill landed correctly ───────────────────────────
SELECT slug, price_inr, duration_label, difficulty, instructor_name,
       array_length(learning_outcomes, 1) AS outcome_count
FROM programs;
