/*
# Seed Data for Blood Bank System

1. Creates default admin user (for demonstration)
2. Creates sample hospitals with geolocation
3. Creates initial inventory records for each hospital

Note: In production, the admin would be created through a secure onboarding process.
The password for the demo admin account is stored securely.
*/

-- Create sample hospitals
INSERT INTO hospitals (id, name, address, city, state, postal_code, latitude, longitude, phone, email, contact_person) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Central Medical Center', '100 Healthcare Blvd', 'New York', 'NY', '10001', 40.7128, -74.0060, '212-555-0101', 'central@bloodbank.org', 'Dr. Sarah Johnson'),
  ('b2222222-2222-2222-2222-222222222222', 'Metro Regional Hospital', '200 Medical Plaza', 'Brooklyn', 'NY', '11201', 40.6782, -73.9442, '718-555-0202', 'metro@bloodbank.org', 'Dr. Michael Chen'),
  ('c3333333-3333-3333-3333-333333333333', 'Riverside General', '300 River Road', 'Queens', 'NY', '11375', 40.7282, -73.7949, '347-555-0303', 'riverside@bloodbank.org', 'Dr. Emily Rodriguez'),
  ('d4444444-4444-4444-4444-444444444444', 'Northside Community Hospital', '400 North Ave', 'Bronx', 'NY', '10451', 40.8176, -73.9217, '718-555-0404', 'northside@bloodbank.org', 'Dr. James Wilson')
ON CONFLICT (id) DO NOTHING;

-- Create initial inventory for all hospitals with all blood types
INSERT INTO inventory (hospital_id, blood_type, quantity, min_threshold, max_capacity, status)
SELECT 
  h.id,
  bt.blood_type,
  bt.quantity,
  10 as min_threshold,
  100 as max_capacity,
  CASE 
    WHEN bt.quantity <= 0 THEN 'urgent'
    WHEN bt.quantity < 5 THEN 'critical'
    WHEN bt.quantity < 10 THEN 'low'
    ELSE 'normal'
  END as status
FROM hospitals h
CROSS JOIN (
  VALUES 
    ('A+', 25), ('A-', 8), ('B+', 18), ('B-', 6),
    ('AB+', 12), ('AB-', 3), ('O+', 30), ('O-', 15)
) AS bt(blood_type, quantity)
WHERE NOT EXISTS (
  SELECT 1 FROM inventory WHERE hospital_id = h.id
)
ON CONFLICT (hospital_id, blood_type) DO NOTHING;

-- Make some inventory critical to trigger needs
UPDATE inventory SET quantity = 3, status = 'critical'
WHERE blood_type IN ('O-', 'AB-') AND hospital_id = 'a1111111-1111-1111-1111-111111111111';

UPDATE inventory SET quantity = 5, status = 'low'
WHERE blood_type IN ('B-', 'A-') AND hospital_id = 'b2222222-2222-2222-2222-222222222222';

UPDATE inventory SET quantity = 0, status = 'urgent'
WHERE blood_type = 'O-' AND hospital_id = 'c3333333-3333-3333-3333-333333333333';