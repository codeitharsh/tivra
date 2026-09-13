-- Adds a paid "Intermediate" tier to the self-paced course catalog,
-- linked to its "Beginner" sibling via track_slug, plus a richer
-- assessment structure (per-module tests + a final assessment) so a
-- paid course can require more than the single "Test Your Knowledge"
-- quiz every free course has today.
--
-- The payment path is deliberately isolated from programs/
-- enrolled_programs/payment_requests (see migrations comment history
-- and src/lib/course-completion.ts) — a course purchase must never
-- touch profiles.access_status or programme entitlements.

ALTER TABLE courses ADD COLUMN price_inr integer;
ALTER TABLE courses ADD COLUMN original_price_inr integer;
ALTER TABLE courses ADD COLUMN track_slug text;
CREATE INDEX idx_courses_track_slug ON courses(track_slug) WHERE track_slug IS NOT NULL;

CREATE TABLE course_payment_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount            numeric NOT NULL,
  razorpay_order_id text NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  transaction_ref   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at       timestamptz
);
CREATE INDEX idx_course_payment_requests_order ON course_payment_requests(razorpay_order_id);

CREATE TABLE course_purchases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id           uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount_paid         numeric NOT NULL,
  razorpay_payment_id text,
  purchased_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);
CREATE INDEX idx_course_purchases_student ON course_purchases(student_id);

ALTER TABLE course_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_purchases ENABLE ROW LEVEL SECURITY;

-- Same posture as assessment_questions/course_quiz_questions: no client
-- SELECT policy at all — orders are only ever created/read via the
-- service-role client in create-course-order/verify-course-payment.
CREATE POLICY "Staff manage course_payment_requests" ON course_payment_requests
  FOR ALL USING (is_staff());

CREATE POLICY "Student own course_purchases" ON course_purchases
  FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Staff manage course_purchases" ON course_purchases
  FOR ALL USING (is_staff());

-- ── Richer assessment structure ─────────────────────────────────
-- module_id NULL = whole-course final assessment (every existing
-- course_quizzes row is this, unchanged). module_id set = a per-module
-- test. quiz_type is redundant with "is module_id null" but kept as an
-- explicit, readable label rather than inferring it everywhere.
ALTER TABLE course_quizzes ADD COLUMN module_id uuid REFERENCES course_modules(id) ON DELETE CASCADE;
ALTER TABLE course_quizzes ADD COLUMN quiz_type text NOT NULL DEFAULT 'final_assessment' CHECK (quiz_type IN ('module_test', 'final_assessment'));

ALTER TABLE course_quizzes DROP CONSTRAINT course_quizzes_course_id_key;
ALTER TABLE course_quizzes ADD CONSTRAINT course_quizzes_course_id_module_id_key UNIQUE (course_id, module_id);
