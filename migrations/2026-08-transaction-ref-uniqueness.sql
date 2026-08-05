-- ════════════════════════════════════════════════════════════════
-- TIVRA — Guard against a duplicate transaction_ref (the Low finding
-- from the 2026-08 audit).
--
-- Not currently exploitable: the only insert path into payment_requests
-- is create-order/route.ts, and transaction_ref is only ever set by
-- verify-payment/route.ts to Razorpay's own payment_id (globally
-- unique already, and separately protected by the existing unique
-- index on razorpay_order_id). This is purely defensive — it closes
-- the gap in case a manual/offline-payment submission path is ever
-- added later without a developer remembering this constraint.
--
-- A plain unique index is safe here: transaction_ref is null for
-- every 'pending' row before verification, and Postgres treats
-- multiple NULLs as non-conflicting under a UNIQUE constraint, so
-- this won't fail against existing data.
-- ════════════════════════════════════════════════════════════════

create unique index if not exists idx_payment_requests_transaction_ref_unique
  on payment_requests(transaction_ref)
  where transaction_ref is not null;

insert into schema_migrations (filename, note)
values ('migrations/2026-08-transaction-ref-uniqueness.sql', 'Defensive unique index, not currently exploitable')
on conflict (filename) do nothing;
