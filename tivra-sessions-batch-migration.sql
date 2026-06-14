-- Add batch_id to live_sessions table
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_batch_id ON live_sessions(batch_id);
