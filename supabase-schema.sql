-- ============================================================
--  TIVRA – Complete Database Schema v2
--  Roles: admin | teacher | student | parent
--  Access: manual payment approval + admin grant/revoke
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── 1. APPROVED COLLEGES ───────────────────────────────────
create table if not exists approved_colleges (
  id           uuid primary key default gen_random_uuid(),
  college_name text not null,
  email_domain text not null unique,
  created_at   timestamptz default now()
);

insert into approved_colleges (college_name, email_domain)
values ('NGF College of Engineering and Technology', 'ngf.ac.in')
on conflict (email_domain) do nothing;

-- ─── 2. PROGRAMS ────────────────────────────────────────────
create table if not exists programs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

insert into programs (name, slug, description)
values ('Cloud LaunchPad', 'cloud-launchpad',
        'A 6-month AWS training program: Cloud Practitioner + Solutions Architect Associate.')
on conflict (slug) do nothing;

-- ─── 3. PHASES ──────────────────────────────────────────────
create table if not exists phases (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid references programs(id) on delete cascade,
  title        text not null,
  phase_number int not null,
  description  text,
  unique (program_id, phase_number)
);

insert into phases (program_id, title, phase_number, description)
select id,'AWS Cloud Practitioner',1,'Cloud fundamentals, IAM, EC2, S3, RDS, VPC and billing.'
from programs where slug='cloud-launchpad' on conflict do nothing;

insert into phases (program_id, title, phase_number, description)
select id,'Solutions Architect Associate',2,'Advanced architecture, serverless, HA, security and DR.'
from programs where slug='cloud-launchpad' on conflict do nothing;

-- ─── 4. MODULES ─────────────────────────────────────────────
create table if not exists modules (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid references phases(id) on delete cascade,
  title         text not null,
  module_number int not null,
  notes_url     text,
  is_unlocked   boolean default true,
  created_at    timestamptz default now(),
  unique (phase_id, module_number)
);

do $$
declare p1 uuid; p2 uuid;
begin
  select id into p1 from phases where phase_number=1
    and program_id=(select id from programs where slug='cloud-launchpad');
  select id into p2 from phases where phase_number=2
    and program_id=(select id from programs where slug='cloud-launchpad');

  insert into modules (phase_id,title,module_number) values
    (p1,'Intro to Cloud Computing',1),
    (p1,'AWS Global Infrastructure',2),
    (p1,'Cloud Service Models (IaaS, PaaS, SaaS)',3),
    (p1,'IAM & Shared Responsibility Model',4),
    (p1,'EC2 & Compute Services',5),
    (p1,'Storage: S3 & EBS',6),
    (p1,'Database: RDS & DynamoDB',7),
    (p1,'Networking & VPC',8),
    (p1,'Cloud Monitoring & Security',9),
    (p1,'AWS Pricing & Billing',10),
    (p1,'Cost Optimization Strategies',11),
    (p2,'EC2 Advanced & Auto Scaling',1),
    (p2,'Load Balancers & High Availability',2),
    (p2,'Serverless: Lambda & API Gateway',3),
    (p2,'Advanced Storage & Replication',4),
    (p2,'Hybrid Connectivity & VPC Architecture',5),
    (p2,'Route 53 & Failover Policies',6),
    (p2,'CloudFront & Global Accelerator',7),
    (p2,'Advanced IAM & Security Services',8),
    (p2,'KMS, Secrets Manager, WAF',9),
    (p2,'CloudWatch & CloudTrail',10),
    (p2,'SQS, SNS & EventBridge',11),
    (p2,'Migration Strategies & Disaster Recovery',12),
    (p2,'Architecture Patterns & Cost Optimization',13)
  on conflict do nothing;
end $$;

-- ─── 5. PROFILES ────────────────────────────────────────────
-- Role hierarchy: admin > teacher > student | parent
-- access_status: pending_payment → active (admin grants) | restricted
create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  email               text unique,

  -- Role: admin | teacher | student | parent
  role                text not null default 'student'
                        check (role in ('student','teacher','admin','parent')),

  -- How they enrolled
  access_type         text check (access_type in ('college','individual','teacher_invite','parent')),

  -- Access state — admin manually sets to 'active' after payment verification
  access_status       text not null default 'pending_payment'
                        check (access_status in ('pending_payment','active','restricted')),

  -- Payment info (filled by admin when verifying)
  payment_verified_at  timestamptz,
  payment_verified_by  uuid,           -- admin who approved
  payment_notes        text,           -- e.g. "UPI ref #12345"

  -- Enrollment
  college_id           uuid references approved_colleges(id),
  enrolled_program_id  uuid references programs(id),

  -- Linked accounts (parent ↔ student)
  linked_student_id    uuid references profiles(id),

  -- Preferences
  leaderboard_opt_in   boolean default false,

  -- Streak
  streak_count         int default 0,
  last_login_date      date,

  -- Phone (useful for payment verification)
  phone                text,

  created_at           timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── 6. PAYMENT REQUESTS ────────────────────────────────────
-- Student submits payment details; admin reviews and approves
create table if not exists payment_requests (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid references profiles(id) on delete cascade,
  program_id      uuid references programs(id),
  amount          numeric(10,2),
  payment_method  text,         -- 'upi', 'bank_transfer', 'cash', etc.
  transaction_ref text,         -- UPI ref / UTR number
  screenshot_url  text,         -- uploaded screenshot (Supabase Storage)
  status          text default 'pending'
                    check (status in ('pending','approved','rejected')),
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  rejection_note  text,
  created_at      timestamptz default now()
);

-- ─── 7. MODULE PROGRESS ─────────────────────────────────────
create table if not exists module_progress (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references profiles(id) on delete cascade,
  module_id    uuid references modules(id) on delete cascade,
  status       text not null default 'not_started'
                 check (status in ('not_started','in_progress','completed')),
  completed_at timestamptz,
  unique (student_id, module_id)
);

-- ─── 8. WEEKLY TESTS ────────────────────────────────────────
create table if not exists weekly_tests (
  id                   uuid primary key default gen_random_uuid(),
  program_id           uuid references programs(id) on delete cascade,
  phase_id             uuid references phases(id),
  week_number          int not null,
  title                text not null,
  topic                text,
  unlock_datetime      timestamptz,
  duration_minutes     int default 30,
  is_manually_unlocked boolean default false,
  created_at           timestamptz default now()
);

create table if not exists test_questions (
  id             uuid primary key default gen_random_uuid(),
  test_id        uuid references weekly_tests(id) on delete cascade,
  question_text  text not null,
  options        jsonb not null,
  correct_answer text not null,
  explanation    text,
  order_num      int default 0
);

create table if not exists test_attempts (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid references profiles(id) on delete cascade,
  test_id       uuid references weekly_tests(id) on delete cascade,
  score_percent numeric(5,2),
  answers       jsonb,
  submitted_at  timestamptz default now(),
  unique (student_id, test_id)
);

-- ─── 9. ASSESSMENTS ─────────────────────────────────────────
create table if not exists assessments (
  id                   uuid primary key default gen_random_uuid(),
  phase_id             uuid references phases(id) on delete cascade unique,
  title                text not null,
  total_questions      int default 60,
  duration_minutes     int default 90,
  passing_percent      numeric(5,2) default 75,
  unlock_datetime      timestamptz,
  is_manually_unlocked boolean default false,
  created_at           timestamptz default now()
);

create table if not exists assessment_questions (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid references assessments(id) on delete cascade,
  question_text  text not null,
  options        jsonb not null,
  correct_answer text not null,
  explanation    text,
  order_num      int default 0
);

create table if not exists assessment_attempts (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid references profiles(id) on delete cascade,
  assessment_id  uuid references assessments(id) on delete cascade,
  score_percent  numeric(5,2),
  answers        jsonb,
  passed         boolean default false,
  submitted_at   timestamptz default now()
);

-- ─── 10. CERTIFICATES ───────────────────────────────────────
create table if not exists certificates (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid references profiles(id) on delete cascade,
  assessment_id     uuid references assessments(id),
  phase_id          uuid references phases(id),
  score_percent     numeric(5,2),
  issued_at         timestamptz default now(),
  issued_by         text default 'auto' check (issued_by in ('auto','admin')),
  is_revoked        boolean default false,
  verification_code uuid default gen_random_uuid() unique
);

-- ─── 11. DOUBTS ─────────────────────────────────────────────
create table if not exists doubts (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid references profiles(id) on delete cascade,
  module_id     uuid references modules(id),
  question_text text not null,
  upvotes       int default 0,
  is_resolved   boolean default false,
  created_at    timestamptz default now()
);

create table if not exists doubt_answers (
  id           uuid primary key default gen_random_uuid(),
  doubt_id     uuid references doubts(id) on delete cascade,
  answered_by  uuid references profiles(id),
  answer_text  text not null,
  is_accepted  boolean default false,
  created_at   timestamptz default now()
);

-- ─── 12. LIVE SESSIONS ──────────────────────────────────────
create table if not exists live_sessions (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid references programs(id),
  phase_id         uuid references phases(id),
  module_id        uuid references modules(id),
  title            text not null,
  description      text,
  scheduled_at     timestamptz not null,
  duration_minutes int default 60,
  join_url         text,
  recording_url    text,
  platform         text default 'zoom'
                     check (platform in ('zoom','meet','daily','livekit')),
  is_live          boolean default false,
  is_completed     boolean default false,
  host_id          uuid references profiles(id),
  created_by       uuid references profiles(id),
  created_at       timestamptz default now()
);

-- ─── 13. ATTENDANCE ─────────────────────────────────────────
-- Attendance is recorded automatically when student joins + leaves live session
create table if not exists attendance_records (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references live_sessions(id) on delete cascade,
  student_id      uuid references profiles(id) on delete cascade,

  -- Auto-recorded times
  joined_at       timestamptz,
  left_at         timestamptz,
  duration_minutes int generated always as (
    extract(epoch from (left_at - joined_at)) / 60
  ) stored,

  -- Status derived from duration vs session duration
  status          text default 'absent'
                    check (status in ('present','partial','absent','late')),

  -- Manual override by admin/teacher
  is_override     boolean default false,
  override_by     uuid references profiles(id),
  override_reason text,

  -- Session code verification (optional extra security)
  session_code    char(4),

  created_at      timestamptz default now(),
  unique (session_id, student_id)
);

-- Session code for live classes (teacher opens window)
create table if not exists session_controls (
  id                        uuid primary key references live_sessions(id) on delete cascade,
  session_code              char(4),
  attendance_window_open    boolean default false,
  window_opened_at          timestamptz,
  window_closes_at          timestamptz,
  auto_close_minutes        int default 15
);

-- ─── 14. ROW-LEVEL SECURITY ─────────────────────────────────
alter table profiles            enable row level security;
alter table payment_requests    enable row level security;
alter table module_progress     enable row level security;
alter table test_attempts       enable row level security;
alter table assessment_attempts enable row level security;
alter table certificates        enable row level security;
alter table doubts              enable row level security;
alter table doubt_answers       enable row level security;
alter table attendance_records  enable row level security;

-- Helper function: is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: is admin or teacher?
create or replace function is_staff()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','teacher')
  );
$$;

-- Profiles
create policy "Own profile read"    on profiles for select using (auth.uid() = id);
create policy "Own profile update"  on profiles for update using (auth.uid() = id);
create policy "Staff read all"      on profiles for select using (is_staff());
create policy "Admin update all"    on profiles for update using (is_admin());

-- Payment requests
create policy "Student own payments"  on payment_requests for all using (auth.uid() = student_id);
create policy "Admin view payments"   on payment_requests for select using (is_admin());
create policy "Admin update payments" on payment_requests for update using (is_admin());

-- Module progress
create policy "Student own progress" on module_progress for all using (auth.uid() = student_id);
create policy "Staff view progress"  on module_progress for select using (is_staff());

-- Test attempts
create policy "Student own attempts"   on test_attempts for all using (auth.uid() = student_id);
create policy "Staff view attempts"    on test_attempts for select using (is_staff());

-- Assessment attempts
create policy "Student own assess"   on assessment_attempts for all using (auth.uid() = student_id);
create policy "Staff view assess"    on assessment_attempts for select using (is_staff());

-- Certificates
create policy "Student own certs"  on certificates for select using (auth.uid() = student_id);
create policy "Public verify cert" on certificates for select using (true);
create policy "Admin manage certs" on certificates for all using (is_admin());

-- Doubts
create policy "Auth read doubts"   on doubts for select using (auth.uid() is not null);
create policy "Student post doubt" on doubts for insert with check (auth.uid() = student_id);
create policy "Student del doubt"  on doubts for delete using (auth.uid() = student_id);
create policy "Staff resolve"      on doubts for update using (is_staff());

-- Doubt answers
create policy "Auth read answers"  on doubt_answers for select using (auth.uid() is not null);
create policy "Staff post answer"  on doubt_answers for insert with check (is_staff());
create policy "Staff del answer"   on doubt_answers for delete using (is_staff());

-- Attendance
create policy "Student own attendance" on attendance_records for select using (auth.uid() = student_id);
create policy "Student mark join"      on attendance_records for insert with check (auth.uid() = student_id);
create policy "Student update own"     on attendance_records for update using (auth.uid() = student_id);
create policy "Staff manage attend"    on attendance_records for all using (is_staff());

-- ─── 15. USEFUL VIEWS ───────────────────────────────────────

-- Admin: full student list with progress + payment status
create or replace view v_admin_students as
select
  p.id, p.full_name, p.email, p.role,
  p.access_type, p.access_status,
  p.phone, p.streak_count, p.created_at,
  p.payment_verified_at,
  p.payment_notes,
  ac.college_name,
  pr.full_name as verified_by_name,
  count(distinct case when mp.status='completed' then mp.id end) as modules_done,
  round(
    count(distinct case when mp.status='completed' then mp.id end)::numeric / 24 * 100, 1
  ) as progress_percent,
  latest_pay.status as payment_request_status,
  latest_pay.transaction_ref,
  latest_pay.created_at as payment_submitted_at
from profiles p
left join approved_colleges ac on ac.id = p.college_id
left join profiles pr on pr.id = p.payment_verified_by
left join module_progress mp on mp.student_id = p.id
left join lateral (
  select status, transaction_ref, created_at
  from payment_requests
  where student_id = p.id
  order by created_at desc limit 1
) latest_pay on true
where p.role in ('student','parent')
group by p.id, ac.college_name, pr.full_name,
         latest_pay.status, latest_pay.transaction_ref, latest_pay.created_at;

-- Attendance export view
create or replace view v_attendance_export as
select
  ls.title          as session_title,
  ls.scheduled_at   as session_date,
  ls.duration_minutes as session_duration_mins,
  p.full_name       as student_name,
  p.email           as student_email,
  ar.joined_at,
  ar.left_at,
  ar.duration_minutes as attended_minutes,
  ar.status,
  ar.is_override,
  ar.override_reason
from attendance_records ar
join live_sessions ls on ls.id = ar.session_id
join profiles p       on p.id  = ar.student_id
order by ls.scheduled_at desc, p.full_name;

-- ─── DONE ───────────────────────────────────────────────────
