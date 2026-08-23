-- Self-paced courses (AWS Skill Builder / Coursera / MS Learn-style) — a
-- parallel, independent schema to the cohort-scoped programs/phases/modules
-- tables, since those carry enrollment/teacher/batch semantics that don't
-- apply here. Open to ANY registered user regardless of payment status —
-- same precedent as migrations/2026-08-23-free-notes.sql.

create table if not exists courses (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique,
  title                       text not null,
  description                 text,
  difficulty                  text not null default 'beginner'
                                check (difficulty in ('beginner','intermediate','advanced')),
  estimated_duration_minutes  integer,
  skills                      text[] not null default '{}',
  learning_outcomes           text[] not null default '{}',
  status                      text not null default 'draft'
                                check (status in ('draft','review','published','archived')),
  is_certificate_enabled      boolean not null default true,
  cover_image_path            text,               -- storage path in the public `course-assets` bucket
  display_order               integer not null default 100,
  created_by                  uuid references profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table if not exists course_modules (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses(id) on delete cascade,
  title         text not null,
  module_number integer not null,
  created_at    timestamptz not null default now(),
  unique (course_id, module_number)
);

create table if not exists course_lessons (
  id                          uuid primary key default gen_random_uuid(),
  module_id                   uuid not null references course_modules(id) on delete cascade,
  title                       text not null,
  lesson_number               integer not null,
  estimated_duration_minutes  integer not null default 5,
  is_required                 boolean not null default true,
  -- Ordered array of typed content blocks — see
  -- src/components/course/LessonBlockRenderer.tsx for the shape.
  -- Deliberately jsonb (not a giant HTML string, not a separate blocks
  -- table): blocks are always authored/fetched together with their
  -- lesson, and the `type` discriminant makes new block types additive.
  content                     jsonb not null default '[]'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (module_id, lesson_number)
);

create table if not exists course_enrollments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references profiles(id) on delete cascade,
  course_id      uuid not null references courses(id) on delete cascade,
  enrolled_at    timestamptz not null default now(),
  last_lesson_id uuid references course_lessons(id) on delete set null,
  unique (student_id, course_id)
);

create table if not exists course_lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles(id) on delete cascade,
  lesson_id    uuid not null references course_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  -- Row existing = complete. No status enum needed: MVP's completion
  -- signal is a single "Mark Complete" click, not a partial state.
  unique (student_id, lesson_id)
);

create table if not exists course_completions (
  id                         uuid primary key default gen_random_uuid(),
  student_id                 uuid not null references profiles(id) on delete cascade,
  course_id                  uuid references courses(id) on delete set null,
  completed_lesson_count     integer not null,
  total_required_lesson_count integer not null,
  issued_at                  timestamptz not null default now(),
  is_revoked                 boolean not null default false,
  -- Same verification-code shape as program_completions, so the
  -- verify page's fallback chain and certificate route can reuse the
  -- exact same lookup/rendering logic.
  verification_code          text not null unique
                               default substr(replace(gen_random_uuid()::text,'-',''),1,12),
  unique (student_id, course_id)
);

create index if not exists idx_course_modules_course_id       on course_modules(course_id);
create index if not exists idx_course_lessons_module_id       on course_lessons(module_id);
create index if not exists idx_course_enrollments_student_id  on course_enrollments(student_id);
create index if not exists idx_course_enrollments_course_id   on course_enrollments(course_id);
create index if not exists idx_course_lesson_progress_student on course_lesson_progress(student_id);
create index if not exists idx_course_lesson_progress_lesson  on course_lesson_progress(lesson_id);
create index if not exists idx_course_completions_student     on course_completions(student_id);

alter table courses                enable row level security;
alter table course_modules         enable row level security;
alter table course_lessons         enable row level security;
alter table course_enrollments     enable row level security;
alter table course_lesson_progress enable row level security;
alter table course_completions     enable row level security;

-- Courses / modules / lessons — any authenticated user can read PUBLISHED
-- rows (never drafts, enforced at the database, not just filtered in the
-- UI); staff (is_staff(), reused from supabase-schema.sql) can read/write
-- everything regardless of status.
drop policy if exists "Auth read published courses" on courses;
create policy "Auth read published courses" on courses for select
  using ((status = 'published' and auth.uid() is not null) or is_staff());

drop policy if exists "Staff manage courses" on courses;
create policy "Staff manage courses" on courses for all
  using (is_staff()) with check (is_staff());

drop policy if exists "Auth read course_modules" on course_modules;
create policy "Auth read course_modules" on course_modules for select
  using (
    is_staff() or (
      auth.uid() is not null and exists (
        select 1 from courses c where c.id = course_modules.course_id and c.status = 'published'
      )
    )
  );

drop policy if exists "Staff manage course_modules" on course_modules;
create policy "Staff manage course_modules" on course_modules for all
  using (is_staff()) with check (is_staff());

drop policy if exists "Auth read course_lessons" on course_lessons;
create policy "Auth read course_lessons" on course_lessons for select
  using (
    is_staff() or (
      auth.uid() is not null and exists (
        select 1 from course_modules m join courses c on c.id = m.course_id
        where m.id = course_lessons.module_id and c.status = 'published'
      )
    )
  );

drop policy if exists "Staff manage course_lessons" on course_lessons;
create policy "Staff manage course_lessons" on course_lessons for all
  using (is_staff()) with check (is_staff());

-- Enrollments — self-service is safe here (it's bookkeeping for "resume
-- where you left off," not a content-access gate), so students may manage
-- their own row directly, same convention as "Student own progress"/
-- "Student own payments" elsewhere in supabase-schema.sql.
drop policy if exists "Student own enrollment" on course_enrollments;
create policy "Student own enrollment" on course_enrollments for all
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

drop policy if exists "Staff view enrollments" on course_enrollments;
create policy "Staff view enrollments" on course_enrollments for select using (is_staff());

-- Lesson progress — students may only ever READ their own rows. There is
-- deliberately NO insert/update/delete policy for regular users: every
-- completion write goes through POST /api/course-progress (service-role,
-- re-derives student_id from the session, validates the lesson belongs to
-- a published course) so a student can never mark an arbitrary lesson
-- complete or touch another student's progress via a direct DB call.
drop policy if exists "Student read own progress" on course_lesson_progress;
create policy "Student read own progress" on course_lesson_progress for select
  using (auth.uid() = student_id);

drop policy if exists "Staff manage progress" on course_lesson_progress;
create policy "Staff manage progress" on course_lesson_progress for all
  using (is_staff()) with check (is_staff());

-- Completions — same shape as the existing `certificates` table: student
-- reads their own, anyone can verify (needed by the public /verify/[code]
-- page), only admins write. Issuance itself only ever happens through the
-- service-role helper in src/lib/course-completion.ts, never a policy a
-- student's own session could satisfy.
drop policy if exists "Student own course completions" on course_completions;
create policy "Student own course completions" on course_completions for select
  using (auth.uid() = student_id);

drop policy if exists "Public verify course completions" on course_completions;
create policy "Public verify course completions" on course_completions for select using (true);

drop policy if exists "Admin manage course completions" on course_completions;
create policy "Admin manage course completions" on course_completions for all
  using (is_admin()) with check (is_admin());

-- Public bucket — unlike `notes`/`free-notes` (gated PDFs behind signed
-- URLs), lesson images/diagrams and course cover images are illustrative
-- instructional content meant to render directly in a lesson block, so a
-- public URL is the right fit here (same reasoning as any other
-- publicly-servable marketing asset). Writes still only ever happen via
-- the service-role admin API.
insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do nothing;
