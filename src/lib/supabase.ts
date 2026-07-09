import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'hospital' | 'donor';

export interface UserProfile {
  id: string;
  role: UserRole;
  hospital_id: string | null;
  donor_id: string | null;
  created_at: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  contact_person: string;
  is_active: boolean;
  created_at: string;
}

export interface Inventory {
  id: string;
  hospital_id: string;
  blood_type: string;
  quantity: number;
  min_threshold: number;
  max_capacity: number;
  last_updated: string;
  updated_by: string | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  status: 'normal' | 'low' | 'critical' | 'urgent';
  hospitals?: Hospital;
}

export interface Donor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  blood_type: string;
  rh_factor: string;
  date_of_birth: string;
  gender: string | null;
  district: string | null;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  last_donation_date: string | null;
  total_donations: number;
  is_eligible: boolean;
  medical_notes: string | null;
  created_at: string;
}

export interface DonationRequest {
  id: string;
  donor_id: string;
  hospital_id: string;
  blood_type: string;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  status: 'pending' | 'admin_review' | 'approved' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
  admin_verified_by: string | null;
  admin_verified_at: string | null;
  hospital_confirmed_by: string | null;
  hospital_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  donors?: Donor;
  hospitals?: Hospital;
}

export interface HospitalRequest {
  id: string;
  requester_hospital_id: string;
  provider_hospital_id: string | null;
  blood_type: string;
  quantity: number;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'admin_approved' | 'provider_assigned' | 'preparing' | 'in_transit' | 'delivered' | 'completed' | 'cancelled' | 'rejected';
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  provider_confirmed_by: string | null;
  provider_confirmed_at: string | null;
  requester_received_by: string | null;
  requester_received_at: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  requester_hospital?: Hospital;
  provider_hospital?: Hospital;
}

export interface VerificationLog {
  id: string;
  action: string;
  entity_type: 'inventory' | 'donation_request' | 'hospital_request' | 'donor';
  entity_id: string;
  verifier_id: string | null;
  old_status: string | null;
  new_status: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodType = typeof BLOOD_TYPES[number];

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const STATUS_COLORS: Record<string, string> = {
  normal: 'bg-emerald-100 text-emerald-800',
  low: 'bg-amber-100 text-amber-800',
  critical: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
  pending: 'bg-slate-100 text-slate-800',
  admin_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800',
  confirmed: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
  admin_approved: 'bg-emerald-100 text-emerald-800',
  provider_assigned: 'bg-blue-100 text-blue-800',
  preparing: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-teal-100 text-teal-800',
};
