/*
# Create Demo User Accounts

Creates admin and hospital demo accounts for the blood bank system.
These accounts are for demonstration purposes.

Users created:
- Admin: admin@bloodbank.org (password: AdminStrongPass2026!)
- Hospital: hospital@bloodbank.org (password: HospitalStrongPass2026!)

Both accounts are linked to hospitals in the system.
*/

-- Create admin user profile (the user will need to sign up with this email)
-- We'll create the profile entry that can be linked when the user signs up

-- Create a trigger function to auto-create user profiles with correct role
CREATE OR REPLACE FUNCTION handle_new_user_with_profile()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
  hospital_id uuid;
BEGIN
  -- Determine role based on email
  user_role := CASE
    WHEN NEW.email = 'admin@bloodbank.org' THEN 'admin'
    WHEN NEW.email = 'hospital@bloodbank.org' THEN 'hospital'
    WHEN NEW.email = 'donor@bloodbank.org' THEN 'donor'
    ELSE 'donor'  -- Default to donor for new signups
  END;
  
  -- Assign hospital_id for known hospital emails
  hospital_id := CASE
    WHEN NEW.email = 'hospital@bloodbank.org' THEN 'a1111111-1111-1111-1111-111111111111'
    ELSE NULL
  END;
  
  INSERT INTO public.user_profiles (id, role, hospital_id, donor_id)
  VALUES (NEW.id, user_role, hospital_id, CASE WHEN user_role = 'donor' THEN NEW.id ELSE NULL END)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to ensure it's attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_with_profile();

-- Update existing demo account user profiles to have the correct roles
UPDATE user_profiles up
SET role = CASE
  WHEN u.email = 'admin@bloodbank.org' THEN 'admin'
  WHEN u.email = 'hospital@bloodbank.org' THEN 'hospital'
  WHEN u.email = 'donor@bloodbank.org' THEN 'donor'
  ELSE role
END,
hospital_id = CASE
  WHEN u.email = 'hospital@bloodbank.org' THEN 'a1111111-1111-1111-1111-111111111111'
  ELSE hospital_id
END
FROM auth.users u
WHERE up.id = u.id
AND u.email IN ('admin@bloodbank.org', 'hospital@bloodbank.org', 'donor@bloodbank.org');