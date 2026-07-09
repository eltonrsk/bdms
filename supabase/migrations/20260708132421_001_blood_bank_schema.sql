/*
# Blood Bank Management System Schema

1. New Tables (in dependency order):
- `hospitals` - Hospital information with geolocation
- `donors` - Donor profiles with medical history
- `user_profiles` - Extends auth.users with role-based access (admin, hospital, donor)
- `inventory` - Blood inventory per hospital with thresholds
- `donation_requests` - Scheduling donor appointments with hospitals
- `hospital_requests` - Inter-hospital blood transfer requests
- `verification_logs` - Audit trail for all blood transactions

2. Security
- RLS enabled on all tables
- Role-based access control (admin, hospital, donor)
- Hospital-scoped data for hospital users
- Donor-scoped data for donor users
- Admin has full access for verification and oversight

3. Key Features
- Automatic threshold alerts via triggers
- Geolocation support for proximity matching
- Status workflow for requests (pending -> approved/verified -> completed)
*/

-- Hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  country text DEFAULT 'US',
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  phone text NOT NULL,
  email text UNIQUE NOT NULL,
  contact_person text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Donors table
CREATE TABLE IF NOT EXISTS donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL,
  blood_type text NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  rh_factor text NOT NULL CHECK (rh_factor IN ('+', '-')),
  date_of_birth date NOT NULL,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  district text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  last_donation_date date,
  total_donations integer DEFAULT 0,
  is_eligible boolean DEFAULT true,
  medical_notes text,
  created_at timestamptz DEFAULT now()
);

-- User profiles table with role-based access
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'hospital', 'donor')),
  hospital_id uuid REFERENCES hospitals(id) ON DELETE SET NULL,
  donor_id uuid REFERENCES donors(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Blood inventory per hospital
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  blood_type text NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  quantity integer NOT NULL DEFAULT 0,
  min_threshold integer NOT NULL DEFAULT 10,
  max_capacity integer NOT NULL DEFAULT 100,
  last_updated timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  status text DEFAULT 'normal' CHECK (status IN ('normal', 'low', 'critical', 'urgent')),
  UNIQUE(hospital_id, blood_type)
);

-- Donation requests from donors to hospitals
CREATE TABLE IF NOT EXISTS donation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  blood_type text NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'admin_review', 'approved', 'confirmed', 'completed', 'cancelled', 'rejected')),
  admin_verified_by uuid REFERENCES auth.users(id),
  admin_verified_at timestamptz,
  hospital_confirmed_by uuid REFERENCES auth.users(id),
  hospital_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inter-hospital blood transfer requests
CREATE TABLE IF NOT EXISTS hospital_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_hospital_id uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  provider_hospital_id uuid REFERENCES hospitals(id) ON DELETE SET NULL,
  blood_type text NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  quantity integer NOT NULL,
  urgency text DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'admin_approved', 'provider_assigned', 'preparing', 'in_transit', 'delivered', 'completed', 'cancelled', 'rejected')),
  admin_approved_by uuid REFERENCES auth.users(id),
  admin_approved_at timestamptz,
  provider_confirmed_by uuid REFERENCES auth.users(id),
  provider_confirmed_at timestamptz,
  requester_received_by uuid REFERENCES auth.users(id),
  requester_received_at timestamptz,
  notes text,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Verification logs for audit trail
CREATE TABLE IF NOT EXISTS verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('inventory', 'donation_request', 'hospital_request', 'donor')),
  entity_id uuid NOT NULL,
  verifier_id uuid REFERENCES auth.users(id),
  old_status text,
  new_status text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_inventory_hospital ON inventory(hospital_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_donors_location ON donors(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_donation_requests_donor ON donation_requests(donor_id);
CREATE INDEX IF NOT EXISTS idx_donation_requests_hospital ON donation_requests(hospital_id);
CREATE INDEX IF NOT EXISTS idx_donation_requests_status ON donation_requests(status);
CREATE INDEX IF NOT EXISTS idx_hospital_requests_requester ON hospital_requests(requester_hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_requests_provider ON hospital_requests(provider_hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_requests_status ON hospital_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_logs_entity ON verification_logs(entity_type, entity_id);

-- Function to auto-update inventory status based on threshold
CREATE OR REPLACE FUNCTION update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated := now();
  
  IF NEW.quantity <= 0 THEN
    NEW.status := 'urgent';
  ELSIF NEW.quantity < NEW.min_threshold / 2 THEN
    NEW.status := 'critical';
  ELSIF NEW.quantity < NEW.min_threshold THEN
    NEW.status := 'low';
  ELSE
    NEW.status := 'normal';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-status update
DROP TRIGGER IF EXISTS inventory_status_trigger ON inventory;
CREATE TRIGGER inventory_status_trigger
  BEFORE UPDATE OF quantity ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_status();

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
CREATE POLICY "users_read_own_profile" ON user_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins_full_access_profiles" ON user_profiles;
CREATE POLICY "admins_full_access_profiles" ON user_profiles FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "users_insert_profile" ON user_profiles;
CREATE POLICY "users_insert_profile" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Hospitals Policies - Admins have full access, hospitals can read/write own data, donors can read
DROP POLICY IF EXISTS "admins_hospitals_all" ON hospitals;
CREATE POLICY "admins_hospitals_all" ON hospitals FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "hospitals_manage_own" ON hospitals;
CREATE POLICY "hospitals_manage_own" ON hospitals FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = hospitals.id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = hospitals.id
  ));

DROP POLICY IF EXISTS "donors_read_active_hospitals" ON hospitals;
CREATE POLICY "donors_read_active_hospitals" ON hospitals FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'donor'
    )
  );

-- Inventory Policies
DROP POLICY IF EXISTS "admins_inventory_all" ON inventory;
CREATE POLICY "admins_inventory_all" ON inventory FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "hospitals_inventory_own" ON inventory;
CREATE POLICY "hospitals_inventory_own" ON inventory FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = inventory.hospital_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = inventory.hospital_id
  ));

DROP POLICY IF EXISTS "donors_inventory_verified" ON inventory;
CREATE POLICY "donors_inventory_verified" ON inventory FOR SELECT
  TO authenticated
  USING (
    is_verified = true 
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'donor')
  );

-- Donors Policies
DROP POLICY IF EXISTS "donors_read_own" ON donors;
CREATE POLICY "donors_read_own" ON donors FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.donor_id = donors.id
  ));

DROP POLICY IF EXISTS "donors_update_own" ON donors;
CREATE POLICY "donors_update_own" ON donors FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.donor_id = donors.id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.donor_id = donors.id
  ));

DROP POLICY IF EXISTS "admins_donors_all" ON donors;
CREATE POLICY "admins_donors_all" ON donors FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "hospitals_read_donors" ON donors;
CREATE POLICY "hospitals_read_donors" ON donors FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND role = 'hospital'
  ));

DROP POLICY IF EXISTS "donors_insert" ON donors;
CREATE POLICY "donors_insert" ON donors FOR INSERT
  TO authenticated WITH CHECK (true);

-- Donation Requests Policies
DROP POLICY IF EXISTS "donors_donation_requests" ON donation_requests;
CREATE POLICY "donors_donation_requests" ON donation_requests FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.donor_id = donation_requests.donor_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.donor_id = donation_requests.donor_id
  ));

DROP POLICY IF EXISTS "hospitals_donation_requests" ON donation_requests;
CREATE POLICY "hospitals_donation_requests" ON donation_requests FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = donation_requests.hospital_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = donation_requests.hospital_id
  ));

DROP POLICY IF EXISTS "admins_donation_requests_all" ON donation_requests;
CREATE POLICY "admins_donation_requests_all" ON donation_requests FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Hospital Requests Policies
DROP POLICY IF EXISTS "requester_hospital_requests" ON hospital_requests;
CREATE POLICY "requester_hospital_requests" ON hospital_requests FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = hospital_requests.requester_hospital_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = hospital_requests.requester_hospital_id
  ));

DROP POLICY IF EXISTS "provider_hospital_requests" ON hospital_requests;
CREATE POLICY "provider_hospital_requests" ON hospital_requests FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = hospital_requests.provider_hospital_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.hospital_id = hospital_requests.provider_hospital_id
  ));

DROP POLICY IF EXISTS "admins_hospital_requests_all" ON hospital_requests;
CREATE POLICY "admins_hospital_requests_all" ON hospital_requests FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "hospitals_read_pending_requests" ON hospital_requests;
CREATE POLICY "hospitals_read_pending_requests" ON hospital_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'hospital')
    AND status IN ('pending', 'admin_approved', 'provider_assigned')
  );

-- Verification Logs Policies
DROP POLICY IF EXISTS "admins_logs_all" ON verification_logs;
CREATE POLICY "admins_logs_all" ON verification_logs FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "insert_logs" ON verification_logs;
CREATE POLICY "insert_logs" ON verification_logs FOR INSERT
  TO authenticated WITH CHECK (true);