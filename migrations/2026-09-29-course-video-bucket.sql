-- Separate public bucket for course lesson videos. Kept apart from
-- `course-assets` (small in-lesson images/diagrams, 5MB cap enforced in
-- upload-course-asset) since recordings run tens of MB; same "public
-- bucket, writes only via service-role" reasoning as course-assets in
-- migrations/2026-08-24-self-paced-courses.sql. No file_size_limit is set
-- here deliberately — the project's global max-upload-size setting
-- (Supabase Dashboard → Settings → Storage) is the actual ceiling, and
-- setting a bucket-level limit above that value makes bucket creation
-- itself fail with a 413. Raise the project-wide setting there if a
-- lesson video ever needs to exceed it.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('course-videos', 'course-videos', true, array['video/mp4'])
on conflict (id) do update set
  allowed_mime_types = excluded.allowed_mime_types;
