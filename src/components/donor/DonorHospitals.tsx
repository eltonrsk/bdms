import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, Hospital, Inventory, STATUS_COLORS } from '../../lib/supabase';
import { Building2, MapPin, Phone, Droplets, Loader2 } from 'lucide-react';

interface HospitalWithInventory extends Hospital {
  inventory: Inventory[];
  distance?: number;
}

export function DonorHospitals() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState<HospitalWithInventory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState<string>('all');
  const [needsOnly, setNeedsOnly] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<HospitalWithInventory | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    time: '09:00',
    blood_type: '',
    notes: '',
  });

  useEffect(() => {
    fetchHospitals();
  }, [bloodTypeFilter, needsOnly]);

  useEffect(() => {
    if (profile?.donor_id) {
      fetchDonorBloodType();
    }
  }, [profile]);

  async function fetchDonorBloodType() {
    const { data } = await supabase
      .from('donors')
      .select('blood_type')
      .eq('id', profile!.donor_id)
      .maybeSingle();
    if (data) {
      setScheduleForm((prev) => ({ ...prev, blood_type: data.blood_type }));
    }
  }

  async function fetchHospitals() {
    setLoading(true);

    const { data: hospitalsData } = await supabase
      .from('hospitals')
      .select('*')
      .eq('is_active', true)
      .order('name');

    let hospitals = hospitalsData || [];

    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('*, hospitals!inner(*)')
      .eq('is_verified', true);

    if (inventoryData) {
      const hospitalMap = new Map<string, HospitalWithInventory>();
      hospitals.forEach((h) => {
        hospitalMap.set(h.id, { ...h, inventory: [], distance: undefined });
      });

      inventoryData.forEach((inv: any) => {
        const hospital = inv.hospitals as Hospital;
        if (hospitalMap.has(hospital.id)) {
          hospitalMap.get(hospital.id)!.inventory.push(inv);
        }
      });

      hospitals = Array.from(hospitalMap.values());
    }

    let filteredHospitals: HospitalWithInventory[] = hospitals;

    if (bloodTypeFilter !== 'all') {
      filteredHospitals = filteredHospitals.filter((h) =>
        h.inventory.some((inv) => inv.blood_type === bloodTypeFilter)
      );
    }

    if (needsOnly) {
      filteredHospitals = filteredHospitals.filter((h) =>
        h.inventory.some((inv) => ['low', 'critical', 'urgent'].includes(inv.status))
      );
    }

    if (searchQuery) {
      filteredHospitals = filteredHospitals.filter(
        (h) =>
          h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setHospitals(filteredHospitals);
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
      fetchHospitals();
    }
    setSaving(false);
  };

  const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  if (loading && hospitals.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Find Hospitals</h2>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-64">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchHospitals();
              }}
              className="w-full pl-11 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
          <select
            value={bloodTypeFilter}
            onChange={(e) => setBloodTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl outline-none bg-white"
          >
            <option value="all">All Blood Types</option>
            {BLOOD_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {bt}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={needsOnly}
              onChange={(e) => setNeedsOnly(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded"
            />
            <span className="text-sm text-slate-700">In Need Only</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hospitals.map((hospital) => {
          const needsBlood = hospital.inventory.filter((inv) =>
            ['low', 'critical', 'urgent'].includes(inv.status)
          );

          return (
            <div
              key={hospital.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">{hospital.name}</h3>
                    <div className="space-y-1 text-sm text-slate-500">
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {hospital.city}, {hospital.state}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {hospital.phone}
                      </p>
                    </div>
                  </div>
                  {needsBlood.length > 0 && (
                    <div className="px-2 py-1 bg-red-100 rounded-lg">
                      <Droplets className="w-4 h-4 text-red-600" />
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Blood Inventory Status</p>
                  <div className="flex flex-wrap gap-1">
                    {BLOOD_TYPES.map((bt) => {
                      const inv = hospital.inventory.find((i) => i.blood_type === bt);
                      return (
                        <div
                          key={bt}
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            inv?.status === 'urgent'
                              ? 'bg-red-100 text-red-700'
                              : inv?.status === 'critical'
                              ? 'bg-orange-100 text-orange-700'
                              : inv?.status === 'low'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {bt}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {needsBlood.length > 0 && (
                  <div className="mb-4 p-3 bg-red-50 rounded-xl">
                    <p className="text-xs font-medium text-red-800 mb-2">Urgently needs:</p>
                    <div className="flex flex-wrap gap-1">
                      {needsBlood.map((inv) => (
                        <span
                          key={inv.blood_type}
                          className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                            STATUS_COLORS[inv.status]
                          }`}
                        >
                          {inv.blood_type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

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
                  className="w-full py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-rose-700 transition-all"
                >
                  Schedule Donation
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {hospitals.length === 0 && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No hospitals found matching your criteria</p>
        </div>
      )}

      {showScheduleModal && selectedHospital && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-8 h-8 text-red-600" />
              <div>
                <h3 className="text-xl font-bold text-slate-900">Schedule Donation</h3>
                <p className="text-slate-500 text-sm">{selectedHospital.name}</p>
              </div>
            </div>

            <form onSubmit={handleSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Blood Type</label>
                <input
                  type="text"
                  value={scheduleForm.blood_type}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold text-red-600 text-center"
                  readOnly
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
