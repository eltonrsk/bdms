import { useState, useEffect } from 'react';
import { supabase, Donor } from '../../lib/supabase';
import { User, Phone, Mail, MapPin, Calendar, Droplets, Search, Loader2, CheckCircle, XCircle } from 'lucide-react';

export function AdminDonors() {
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState<string>('all');
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'eligible' | 'ineligible'>('all');

  const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  useEffect(() => {
    fetchDonors();
  }, [bloodTypeFilter, eligibilityFilter]);

  async function fetchDonors() {
    setLoading(true);
    let query = supabase.from('donors').select('*').order('created_at', { ascending: false });

    if (bloodTypeFilter !== 'all') {
      query = query.eq('blood_type', bloodTypeFilter);
    }

    if (eligibilityFilter !== 'all') {
      query = query.eq('is_eligible', eligibilityFilter === 'eligible');
    }

    const { data } = await query;
    if (data) {
      let filtered = data;
      if (searchQuery) {
        filtered = data.filter(
          (d) =>
            d.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      setDonors(filtered);
    }
    setLoading(false);
  }

  const handleToggleEligibility = async (donor: Donor) => {
    await supabase
      .from('donors')
      .update({ is_eligible: !donor.is_eligible })
      .eq('id', donor.id);
    fetchDonors();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  const calculateAge = (dob: string) => {
    const today = new Date();
    const birthDate = new Date(dob);
    const age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    return m < 0 || (m === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
  };

  if (loading && donors.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Donor Management</h2>
        <button
          onClick={fetchDonors}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search donors..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchDonors();
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
          <div className="flex gap-1">
            {['all', 'eligible', 'ineligible'].map((f) => (
              <button
                key={f}
                onClick={() => setEligibilityFilter(f as any)}
                className={`px-3 py-2 text-sm rounded-xl capitalize ${
                  eligibilityFilter === f
                    ? 'bg-red-100 text-red-700 font-medium'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {donors.map((donor) => (
          <div key={donor.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {donor.first_name} {donor.last_name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {calculateAge(donor.date_of_birth)} years old
                  </p>
                </div>
              </div>
              <div
                className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  donor.blood_type.includes('+')
                    ? 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                {donor.blood_type}
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 mb-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                {donor.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                {donor.phone}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                {donor.city}, {donor.state}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                Last donation: {formatDate(donor.last_donation_date)}
              </div>
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-slate-400" />
                Total donations: {donor.total_donations}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => handleToggleEligibility(donor)}
                className={`w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
                  donor.is_eligible
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {donor.is_eligible ? (
                  <>
                    <CheckCircle className="w-4 h-4" /> Eligible to Donate
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" /> Not Eligible
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {donors.length === 0 && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No donors found</p>
        </div>
      )}
    </div>
  );
}
