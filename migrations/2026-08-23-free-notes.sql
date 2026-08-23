-- Free Notes — a self-study library (DSA, Computer Networks, OOPS, DBMS,
-- etc.) open to ANY registered user, independent of paid-programme
-- enrollment or access_status. Deliberately a flat, separate schema —
-- no phases, no sequencing, no progress tracking — matching how this
-- is presented on GfG/Testbook/PW/Unacademy: a plain subject/topic
-- library, not a scaled-down "course."

create table if not exists subjects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,          -- 'Data Structures & Algorithms'
  slug          text not null unique,
  description   text,
  is_active     boolean not null default true,
  display_order integer not null default 100,
  created_at    timestamptz not null default now()
);

create table if not exists free_notes (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references subjects(id) on delete cascade,
  title       text not null,
  note_number integer not null,
  notes_url   text,                     -- storage path in the `free-notes` bucket, not a public URL
  created_at  timestamptz not null default now(),
  unique (subject_id, note_number)
);

create index if not exists idx_free_notes_subject_id on free_notes(subject_id);

alter table subjects   enable row level security;
alter table free_notes enable row level security;

-- Any authenticated user can read, regardless of role or access_status —
-- this is the whole point. Reuses is_staff(), already defined once in
-- supabase-schema.sql, for the write policy rather than re-deriving a
-- role check inline.
drop policy if exists "Auth read subjects" on subjects;
create policy "Auth read subjects" on subjects for select using (auth.uid() is not null);

drop policy if exists "Staff manage subjects" on subjects;
create policy "Staff manage subjects" on subjects for all
  using (is_staff()) with check (is_staff());

drop policy if exists "Auth read free_notes" on free_notes;
create policy "Auth read free_notes" on free_notes for select using (auth.uid() is not null);

drop policy if exists "Staff manage free_notes" on free_notes;
create policy "Staff manage free_notes" on free_notes for all
  using (is_staff()) with check (is_staff());

-- Private bucket — same approach as the existing `notes`/`curricula`
-- buckets: all writes go through the service-role upload route
-- (bypasses storage RLS entirely), all reads happen via a short-lived
-- signed URL minted server-side. No public URL ever exists for a file
-- in this bucket.
insert into storage.buckets (id, name, public)
values ('free-notes', 'free-notes', false)
on conflict (id) do nothing;

-- No seed subjects — admin creates these directly from /admin/free-notes.
