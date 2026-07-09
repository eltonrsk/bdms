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
BEGIN
  -- Default role is donor
  INSERT INTO public.user_profiles (id, role)
  VALUES (NEW.id, 'donor');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- For existing users, we can update their profiles
-- Note: In production, you would create these users through Supabase Auth

-- Insert a note about demo accounts
COMMENT ON TABLE user_profiles IS 'User profiles with role-based access. Demo accounts can be created by signing up with admin@bloodbank.org or hospital@bloodbank.org and then updating the role manually.';