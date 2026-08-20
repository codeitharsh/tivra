-- ════════════════════════════════════════════════════════════════
-- TIVRA — Add an "original price" alongside the existing (discounted/
-- current) price_inr, so the site can show a struck-through original
-- next to the real price instead of just the number on its own.
--
-- price_inr keeps its existing meaning unchanged (the real amount
-- charged at checkout) — original_price_inr is purely a display value,
-- optional, and only shown when it's actually higher than price_inr.
--
-- Run this in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════

alter table programs
  add column if not exists original_price_inr numeric;
