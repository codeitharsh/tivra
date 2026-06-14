-- Add Daily.co fields to live_sessions
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS daily_room_name text,
  ADD COLUMN IF NOT EXISTS daily_room_url  text;

-- Index for room lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_daily_room ON live_sessions(daily_room_name);
