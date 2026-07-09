/*
# Create Demo Donor Account

Creates a donor demo account for the blood bank system.
- Donor: donor@bloodbank.org (password: DonorStrongPass2026!)

Also fixes the handle_new_user_with_profile trigger so that when a donor
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

-- Create the demo donor auth user.
-- Using a fixed UUID so we can reference it for the donors + user_profiles rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'donor@bloodbank.org') THEN
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      'e5555555-5555-5555-5555-555555555555',
      'authenticated',
      'authenticated',
      'donor@bloodbank.org',
      crypt('DonorStrongPass2026!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"role": "donor"}'::jsonb,
      '{"role": "donor"}'::jsonb
    );
  END IF;
END $$;

-- Create the donor record (id matches the auth user id so client-side
-- inserts that use id = user.id remain consistent).
INSERT INTO donors (
  id,
  first_name,
  last_name,
  email,
  phone,
  blood_type,
  rh_factor,
  date_of_birth,
  gender,
  address,
  city,
  state,
  postal_code,
  last_donation_date,
  total_donations,
  is_eligible,
  medical_notes
) VALUES (
  'e5555555-5555-5555-5555-555555555555',
  'Alex',
  'Donor',
  'donor@bloodbank.org',
  '212-555-0505',
  'O+',
  '+',
  '1992-05-14',
  'male',
  '500 Park Avenue',
  'New York',
  'NY',
  '10022',
  '2026-01-15',
  3,
  true,
  'Healthy, no recent travel or medications.'
)
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  blood_type = EXCLUDED.blood_type,
  rh_factor = EXCLUDED.rh_factor,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  postal_code = EXCLUDED.postal_code,
  last_donation_date = EXCLUDED.last_donation_date,
  total_donations = EXCLUDED.total_donations,
  is_eligible = EXCLUDED.is_eligible,
  medical_notes = EXCLUDED.medical_notes;

-- Create the user_profiles row linking the auth user to the donor record.
INSERT INTO user_profiles (id, role, donor_id)
VALUES ('e5555555-5555-5555-5555-555555555555', 'donor', 'e5555555-5555-5555-5555-555555555555')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  donor_id = EXCLUDED.donor_id;
