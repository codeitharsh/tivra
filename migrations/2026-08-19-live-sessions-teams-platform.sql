-- ════════════════════════════════════════════════════════════════
-- TIVRA — Switch live classes to teacher-provided Microsoft Teams
-- links (from Daily.co — which, like every hosted video API we
-- evaluated, required a card on file to activate, which isn't
-- available right now).
--
-- Tivra no longer hosts the video call itself: the teacher creates
-- the meeting in their own Teams account and pastes the join link in
-- when scheduling (stored in the existing join_url column). Tivra
-- still does its own batch/programme authorization check before
-- handing that link to a student — only how the actual call is hosted
-- changed. This migration just re-adds 'teams' to the platform check
-- constraint. Old values ('jitsi', 'daily') stay allowed for
-- historical completed sessions.
--
-- Run this in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════

alter table live_sessions
  drop constraint if exists live_sessions_platform_check;

alter table live_sessions
  add constraint live_sessions_platform_check
  check (platform in ('zoom','meet','daily','livekit','jitsi','teams'));

alter table live_sessions
  alter column platform set default 'teams';
