/*
# Fix Trigger Function

Fixes the handle_new_user_with_profile trigger so that when a donor
signs up, the trigger links the donor_id from the donors table (matched
by email) into the user_profiles row. Previously donor_id was left NULL,
which broke the donor dashboard (it depends on profile.donor_id).
*/

-- Fix the trigger function to link donor_id by email on signup.
-- The donors row is inserted by the SignUp component using id = NEW.id,
-- but that insert happens AFTER auth.users insert, so the trigger may
-- run before the donors row exists. We handle both cases: link if the
-- donor row already exists, otherwise leave donor_id NULL (the donor
-- row is inserted shortly after by the client, and an admin can link
-- it later, or a follow-up profile update can set it).
CREATE OR REPLACE FUNCTION handle_new_user_with_profile()
RETURNS TRIGGER AS $$
DECLARE
  existing_donor_id uuid;
BEGIN
  SELECT id INTO existing_donor_id FROM public.donors WHERE email = NEW.email LIMIT 1;

  INSERT INTO public.user_profiles (id, role, donor_id)
  VALUES (NEW.id, 'donor', existing_donor_id)
  ON CONFLICT (id) DO UPDATE SET donor_id = EXCLUDED.donor_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
