-- ============================================================
--  TIVRA — Fix the handle_new_user trigger
--  Run this in Supabase SQL Editor BEFORE testing registration
-- ============================================================

-- Drop and recreate the trigger function with safer logic
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert with only the guaranteed-safe columns
  -- access_status has a default of 'pending_payment' in the table
  -- role has a default of 'student'
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    access_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'student',
    'pending_payment'
  )
  ON CONFLICT (id) DO NOTHING;  -- safe if row already exists

  RETURN NEW;
END;
$$;

-- Recreate the trigger (drop first to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Verify the fix ──────────────────────────────────────────
-- This should show the trigger exists:
SELECT tgname, tgtype, proname
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE tgname = 'on_auth_user_created';
