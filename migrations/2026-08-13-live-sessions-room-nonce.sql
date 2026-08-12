-- ════════════════════════════════════════════════════════════════
-- TIVRA — Time-box the Jitsi room password per go-live cycle.
--
-- The room password was previously derived purely from the session's
-- own (stable, never-changing) id, via HMAC. That means a password
-- leaked once stayed valid forever for that session — ending and
-- restarting a class did nothing to invalidate a previously-shared
-- link. room_nonce is regenerated every time a NEW Jitsi room is
-- created for a session (i.e. each time it goes live after having
-- been ended), and folded into the password derivation, so a fresh
-- go-live cycle invalidates any password shared during a prior one.
--
-- Run this in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════

alter table live_sessions
  add column if not exists room_nonce text;
