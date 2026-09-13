-- Adds an end-of-course "Test Your Knowledge" quiz for self-paced
-- courses, mirroring the existing assessments / assessment_questions /
-- assessment_attempts pattern used for paid-programme phase assessments
-- (see src/app/programs/[slug]/assessments/[assessmentId]/page.tsx).
--
-- One quiz per course (unique course_id). Passing it becomes a
-- requirement for course completion / certificate issuance alongside
-- finishing all required lessons — see src/lib/course-completion.ts.

CREATE TABLE course_quizzes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Test Your Knowledge',
  passing_percent integer NOT NULL DEFAULT 70,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_quiz_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        uuid NOT NULL REFERENCES course_quizzes(id) ON DELETE CASCADE,
  question_text  text NOT NULL,
  options        jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation    text,
  order_num      integer NOT NULL
);

CREATE TABLE course_quiz_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id       uuid NOT NULL REFERENCES course_quizzes(id) ON DELETE CASCADE,
  score_percent numeric NOT NULL,
  answers       jsonb NOT NULL,
  passed        boolean NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_quiz_questions_quiz ON course_quiz_questions(quiz_id);
CREATE INDEX idx_course_quiz_attempts_student_quiz ON course_quiz_attempts(student_id, quiz_id);

ALTER TABLE course_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Same posture as assessments/assessment_questions: no client SELECT
-- policy at all — questions (and correct answers) are only ever read
-- via the service-role client in a server component/route that has
-- already verified the student completed all required lessons. Quiz
-- metadata (title, passing_percent) is likewise only ever read
-- server-side for the same reason.
CREATE POLICY "Staff manage course_quizzes" ON course_quizzes
  FOR ALL USING (is_staff());
CREATE POLICY "Staff manage course_quiz_questions" ON course_quiz_questions
  FOR ALL USING (is_staff());

CREATE POLICY "Staff view course_quiz_attempts" ON course_quiz_attempts
  FOR SELECT USING (is_staff());
CREATE POLICY "Student own course_quiz_attempts" ON course_quiz_attempts
  FOR ALL USING (auth.uid() = student_id);
