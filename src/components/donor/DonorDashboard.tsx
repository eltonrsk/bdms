import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, Donor, Hospital, DonationRequest, STATUS_COLORS } from '../../lib/supabase';
import { Building2, MapPin, Calendar, Droplets, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface HospitalWithNeeds extends Hospital {
  needs: { blood_type: string; status: string; quantity: number }[];
  distance?: number;
}

export function DonorDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [donor, setDonor] = useState<Donor | null>(null);
  const [nearbyHospitals, setNearbyHospitals] = useState<HospitalWithNeeds[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<(DonationRequest & { hospitals: Hospital })[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<HospitalWithNeeds | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    time: '09:00',
    blood_type: '',
    notes: '',
  });

  useEffect(() => {
    if (profile?.donor_id) {
      fetchDonorData();
    }
  }, [profile]);

  async function fetchDonorData() {
    setLoading(true);

    const { data: donorData } = await supabase
      .from('donors')
      .select('*')
      .eq('id', profile!.donor_id)
      .maybeSingle();
    if (donorData) {
      setDonor(donorData);
      setScheduleForm((prev) => ({ ...prev, blood_type: donorData.blood_type }));
    }

    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('blood_type, status, quantity, hospital_id, is_verified, hospitals(*)')
      .eq('is_verified', true)
      .in('status', ['low', 'critical', 'urgent']);

    if (inventoryData) {
      const hospitalMap = new Map<string, HospitalWithNeeds>();
      inventoryData.forEach((inv: any) => {
        if (!inv.hospitals) return;
        const hospital = inv.hospitals as Hospital;
        if (!hospitalMap.has(hospital.id)) {
          hospitalMap.set(hospital.id, {
            ...hospital,
            needs: [],
            distance: undefined,
          });
        }
        hospitalMap.get(hospital.id)!.needs.push({
          blood_type: inv.blood_type,
          status: inv.status,
          quantity: inv.quantity,
        });
      });

      const hospitalsArray = Array.from(hospitalMap.values());
      setNearbyHospitals(hospitalsArray);
    }

    const { data: appointments } = await supabase
      .from('donation_requests')
      .select('*, hospitals(*)')
      .eq('donor_id', profile!.donor_id)
      .in('status', ['approved', 'confirmed'])
      .order('requested_date', { ascending: true });
    if (appointments) {
      setUpcomingAppointments(appointments as any);
    }

    setLoading(false);
  }

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospital || !profile?.donor_id) return;

    setSaving(true);
    const { error } = await supabase.from('donation_requests').insert({
      donor_id: profile.donor_id,
      hospital_id: selectedHospital.id,
      blood_type: scheduleForm.blood_type,
      requested_date: scheduleForm.date,
      requested_time: scheduleForm.time,
      notes: scheduleForm.notes,
      status: 'pending',
    });

    if (!error) {
      setShowScheduleModal(false);
      setSelectedHospital(null);
      setScheduleForm((prev) => ({ ...prev, date: '', time: '09:00', notes: '' }));
      fetchDonorData();
    }
    setSaving(false);
  };

  const canDonate = () => {
    if (!donor) return false;
    if (!donor.is_eligible) return false;
    if (donor.last_donation_date) {
      const lastDonation = new Date(donor.last_donation_date);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return lastDonation < threeMonthsAgo;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome, {donor?.first_name}</h2>
          <p className="text-slate-500">
            Blood Type: <span className="font-bold text-red-600">{donor?.blood_type}</span>
          </p>
        </div>
        <div className="text-right">
          {canDonate() ? (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Eligible to Donate</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Not Eligible</span>
            </div>
          )}
        </div>
      </div>

      {upcomingAppointments.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <h3 className="font-semibold text-emerald-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Upcoming Appointments
          </h3>
          <div className="space-y-3">
            {upcomingAppointments.map((apt) => (
              <div
                key={apt.id}
                className="bg-white rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-slate-900">{apt.hospitals?.name}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(apt.requested_date).toLocaleDateString()} at{' '}
                      {apt.requested_time}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                  {apt.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-slate-900 mt-8">Hospitals in Need</h3>

      {nearbyHospitals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <Droplets className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-slate-700 font-medium">All blood supplies are at healthy levels!</p>
          <p className="text-slate-500 text-sm mt-2">No hospitals are currently in urgent need.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nearbyHospitals.map((hospital) => (
            <div
              key={hospital.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">{hospital.name}</h4>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {hospital.city}, {hospital.state}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-red-600" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {hospital.needs.map((need) => (
                    <div key={need.blood_type} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                      need.status === 'urgent'
                        ? 'bg-red-100 text-red-700'
                        : need.status === 'critical'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                    >
                      {need.blood_type}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setSelectedHospital(hospital);
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setScheduleForm((prev) => ({
                      ...prev,
                      date: tomorrow.toISOString().split('T')[0],
                    }));
                    setShowScheduleModal(true);
                  }}
                  disabled={!canDonate()}
                  className="w-full py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {canDonate() ? 'Schedule Donation' : 'Not Eligible'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showScheduleModal && selectedHospital && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Schedule Donation</h3>
            <p className="text-slate-500 text-sm mb-4">{selectedHospital.name}</p>

            <form onSubmit={handleSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Date</label>
                <input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Time</label>
                <input
                  type="time"
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Blood Type</label>
                <input
                  type="text"
                  value={scheduleForm.blood_type}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold text-red-600"
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-800">
                Your request will be reviewed by the admin and hospital before confirmation.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleModal(false);
                    setSelectedHospital(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-rose-700 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
