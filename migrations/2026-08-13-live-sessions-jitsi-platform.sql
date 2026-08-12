-- ════════════════════════════════════════════════════════════════
-- TIVRA — Fix "Unable to schedule live class" error.
--
-- live_sessions.platform has a check constraint that only allows
-- ('zoom','meet','daily','livekit') — but src/app/api/daily/route.ts
-- inserts platform:'jitsi' for every scheduled session (the app moved
-- to Jitsi Meet, the constraint was never updated). Every insert into
-- live_sessions was being rejected by Postgres with a check-constraint
-- violation, surfaced to the teacher/admin as a generic "Failed to
-- schedule" error.
--
-- Run this in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════

alter table live_sessions
  drop constraint if exists live_sessions_platform_check;

alter table live_sessions
  add constraint live_sessions_platform_check
  check (platform in ('zoom','meet','daily','livekit','jitsi'));

alter table live_sessions
  alter column platform set default 'jitsi';
