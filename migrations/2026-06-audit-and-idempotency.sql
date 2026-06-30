-- ════════════════════════════════════════════════════════════════
-- TIVRA — Payment idempotency + audit fix migration
-- Run this in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════

-- Ensure required columns exist (no-op if already present from earlier work)
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS plan text;

-- Prevent the same Razorpay order from ever being recorded twice.
-- This is the database-level backstop for the idempotency check now
-- enforced in application code in /api/verify-payment.
CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_razorpay_order_id_unique
  ON payment_requests (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- Helpful index for the verify-payment lookup-by-order-id query
CREATE INDEX IF NOT EXISTS idx_payment_requests_order_id
  ON payment_requests (razorpay_order_id);

-- ════════════════════════════════════════════════════════════════
-- Audit trail for curriculum mutations (modules table)
-- ════════════════════════════════════════════════════════════════
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

