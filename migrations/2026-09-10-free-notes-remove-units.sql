-- Reverts the Unit layer added in
-- migrations/2026-09-05-free-notes-units-progress.sql — topics now
-- belong directly to a subject again (Subject -> Topic -> PDF, no
-- grouping layer in between). free_notes has 0 rows and units has a
-- single empty row at the time of this migration, so this is a clean
-- structural change, not a data migration.

alter table free_notes add column if not exists subject_id uuid references subjects(id) on delete cascade;

alter table free_notes drop constraint if exists free_notes_unit_id_note_number_key;
alter table free_notes drop column if exists unit_id;
alter table free_notes alter column subject_id set not null;
alter table free_notes add constraint free_notes_subject_id_note_number_key unique (subject_id, note_number);

create index if not exists idx_free_notes_subject_id on free_notes(subject_id);

drop table if exists units;
