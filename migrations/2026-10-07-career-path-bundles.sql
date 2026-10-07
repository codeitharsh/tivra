-- Role-based "career path" bundles (e.g. "Data Analyst" = Python + Excel +
-- Power BI + SQL) — a single purchase that unlocks every course in the
-- bundle. Same isolated-payment-system pattern as course_payment_requests/
-- course_purchases (see 2026-09-15-paid-courses.sql): never touches
-- programs/enrolled_programs/profiles.access_status. Course-level
-- entitlement (hasPurchasedCourse, src/lib/course-access.ts) gets a new
-- OR-clause checking career_path_purchases via career_path_courses rather
-- than this being a separate gate scattered elsewhere.

CREATE TABLE career_paths (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  title               text NOT NULL,
  description         text,
  cover_image_path    text,
  skills              text[] NOT NULL DEFAULT '{}',
  price_inr           integer,
  original_price_inr  integer,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  display_order       integer NOT NULL DEFAULT 100,
  created_by          uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE career_path_courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_path_id  uuid NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  display_order   integer NOT NULL DEFAULT 100,
  UNIQUE (career_path_id, course_id)
);

CREATE TABLE career_path_payment_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  career_path_id    uuid NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  amount            numeric NOT NULL,
  razorpay_order_id text NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  transaction_ref   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at       timestamptz
);
CREATE INDEX idx_career_path_payment_requests_order ON career_path_payment_requests(razorpay_order_id);

CREATE TABLE career_path_purchases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  career_path_id      uuid NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  amount_paid         numeric NOT NULL,
  razorpay_payment_id text,
  purchased_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, career_path_id)
);
CREATE INDEX idx_career_path_purchases_student ON career_path_purchases(student_id);

ALTER TABLE career_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_path_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_path_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_path_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published career_paths are public" ON career_paths
  FOR SELECT USING (status = 'published' OR is_staff());
CREATE POLICY "Staff manage career_paths" ON career_paths
  FOR ALL USING (is_staff());

CREATE POLICY "career_path_courses readable with their path" ON career_path_courses
  FOR SELECT USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM career_paths cp WHERE cp.id = career_path_id AND cp.status = 'published'
    )
  );
CREATE POLICY "Staff manage career_path_courses" ON career_path_courses
  FOR ALL USING (is_staff());

-- Same posture as course_payment_requests: no client SELECT policy at
-- all — orders are only ever created/read via the service-role client in
-- create-careerpath-order/verify-careerpath-payment.
CREATE POLICY "Staff manage career_path_payment_requests" ON career_path_payment_requests
  FOR ALL USING (is_staff());

CREATE POLICY "Student own career_path_purchases" ON career_path_purchases
  FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Staff manage career_path_purchases" ON career_path_purchases
  FOR ALL USING (is_staff());
