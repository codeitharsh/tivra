-- ════════════════════════════════════════════════════════════════
-- TIVRA — Recovery: find students with active access but ZERO
-- enrolled_programs rows.
--
-- Root cause: admin/route.ts's grant_access action (used for manual/
-- offline payment activation) never wrote to enrolled_programs at
-- all until this fix. Any student activated this way before the fix
-- has an active account but no programme entitlement record — every
-- per-programme access check added this session (middleware,
-- requireProgramAccess, submit-test, submit-assessment, attendance)
-- would incorrectly lock these students out of their own paid
-- content.
--
-- This script finds them and lets you fix them — but since there's
-- no way to know WHICH programme each affected student actually paid
-- for purely from profiles/payment_requests in every case, Step 2
-- gives you a few different ways to backfill depending on what
-- information is actually available for each student.
-- ════════════════════════════════════════════════════════════════


-- ── STEP 1 — Find every active student with zero enrollments ─────

SELECT
  p.id, p.email, p.full_name, p.access_status, p.payment_verified_at, p.payment_notes
FROM profiles p
WHERE p.role = 'student'
  AND p.access_status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM enrolled_programs ep WHERE ep.student_id = p.id
  )
ORDER BY p.payment_verified_at DESC;

-- If this returns zero rows, nobody was affected — either every
-- active student already went through the Razorpay auto-flow (which
-- always wrote enrolled_programs correctly), or this is a fresh
-- database with no manually-granted students yet.


-- ── STEP 2a — If payment_requests has a usable plan/program_id ────
-- Check whether the affected students' approved payment_requests rows
-- already have enough info to backfill automatically.

SELECT
  pr.student_id, pr.plan, pr.program_id, pr.status, pr.payment_method, pr.created_at
FROM payment_requests pr
WHERE pr.student_id IN (
  SELECT p.id FROM profiles p
  WHERE p.role = 'student' AND p.access_status = 'active'
    AND NOT EXISTS (SELECT 1 FROM enrolled_programs ep WHERE ep.student_id = p.id)
)
ORDER BY pr.created_at DESC;

-- If this shows a usable `plan` value for each affected student,
-- Step 2b below can backfill all of them automatically. If `plan` is
-- null/missing for some, you'll need to fix those manually via the
-- admin panel's Grant Access modal (now fixed to include a programme
-- selector) instead — re-granting access to a student who's already
-- active is safe; it will just add the missing enrolled_programs row
-- without changing anything else.


-- ── STEP 2b — Automatic backfill using payment_requests.plan ──────
-- ONLY run this if Step 2a showed usable plan values. Maps the same
-- way verify-payment and the fixed grant_access action do.

INSERT INTO enrolled_programs (student_id, program_id, plan, amount_paid, enrolled_at, access_granted_at)
SELECT
  pr.student_id,
  prog.id,
  'manual_grant_backfill',
  pr.amount,
  pr.created_at,
  now()
FROM payment_requests pr
JOIN profiles p ON p.id = pr.student_id
CROSS JOIN LATERAL (
  -- Expand 'bundle' into both programme slugs; everything else maps 1:1
  SELECT unnest(
    CASE pr.plan
      WHEN 'bundle' THEN ARRAY['cloud-launchpad', 'cloud-architect']
      WHEN 'cloud_launchpad' THEN ARRAY['cloud-launchpad']
      WHEN 'cloud_architect' THEN ARRAY['cloud-architect']
      ELSE ARRAY[]::text[]
    END
  ) AS slug
) slugs
JOIN programs prog ON prog.slug = slugs.slug
WHERE p.role = 'student'
  AND p.access_status = 'active'
  AND pr.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM enrolled_programs ep WHERE ep.student_id = p.id)
ON CONFLICT (student_id, program_id) DO NOTHING;


-- ── STEP 3 — Confirm the fix worked ───────────────────────────────
-- Re-run Step 1 — it should now return fewer rows (ideally zero, if
-- every affected student had a usable plan value to backfill from).
