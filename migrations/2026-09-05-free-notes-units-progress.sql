-- Extends Free Notes (subjects -> free_notes) with a Unit layer and
-- per-topic completion tracking, turning a flat subject/note library
-- into a proper Subject -> Unit -> Topic curriculum. free_notes is
-- empty at the time of this migration, so this is a clean structural
-- change, not a backfill: subject_id moves off free_notes entirely in
-- favor of unit_id (units.subject_id becomes the single source of
-- truth for which subject a topic belongs to).

create table if not exists units (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references subjects(id) on delete cascade,
  title         text not null,          -- 'Unit 3: Object-Oriented Programming'
  unit_number   integer not null,
  created_at    timestamptz not null default now(),
  unique (subject_id, unit_number)
);

create index if not exists idx_units_subject_id on units(subject_id);

alter table free_notes add column if not exists unit_id uuid references units(id) on delete cascade;

-- Table is empty (0 rows) at migration time, so no backfill is needed
-- before tightening these constraints.
alter table free_notes drop constraint if exists free_notes_subject_id_note_number_key;
alter table free_notes drop column if exists subject_id;
alter table free_notes alter column unit_id set not null;
alter table free_notes add constraint free_notes_unit_id_note_number_key unique (unit_id, note_number);

create index if not exists idx_free_notes_unit_id on free_notes(unit_id);

create table if not exists free_note_progress (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references profiles(id) on delete cascade,
  note_id        uuid not null references free_notes(id) on delete cascade,
  completed_at   timestamptz not null default now(),
  unique (student_id, note_id)
);

create index if not exists idx_free_note_progress_student on free_note_progress(student_id);
create index if not exists idx_free_note_progress_note     on free_note_progress(note_id);

alter table units               enable row level security;
alter table free_note_progress  enable row level security;

-- Same shape as the existing subjects policies — any authenticated
-- user can read, staff manage everything.
drop policy if exists "Auth read units" on units;
create policy "Auth read units" on units for select using (auth.uid() is not null);

drop policy if exists "Staff manage units" on units;
create policy "Staff manage units" on units for all
  using (is_staff()) with check (is_staff());

-- Same shape as course_lesson_progress — student may only ever READ
-- their own rows. No insert/update policy at all: every completion
-- write goes through POST /api/free-notes-progress (service-role,
-- re-derives student_id from the session), so a student can never
-- mark an arbitrary topic complete via a direct DB call.
drop policy if exists "Student read own note progress" on free_note_progress;
create policy "Student read own note progress" on free_note_progress for select
  using (auth.uid() = student_id);

drop policy if exists "Staff manage note progress" on free_note_progress;
create policy "Staff manage note progress" on free_note_progress for all
  using (is_staff()) with check (is_staff());
