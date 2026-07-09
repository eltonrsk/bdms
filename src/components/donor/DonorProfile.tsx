import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, Donor } from '../../lib/supabase';
import { User, Mail, Phone, MapPin, Droplets, Save, Loader2 } from 'lucide-react';

export function DonorProfile() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [donor, setDonor] = useState<Donor | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    blood_type: '',
    date_of_birth: '',
    gender: '',
    district: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
  });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile?.donor_id) {
      fetchDonor();
    }
  }, [profile]);

  async function fetchDonor() {
    setLoading(true);
    const { data } = await supabase
      .from('donors')
      .select('*')
      .eq('id', profile!.donor_id)
      .maybeSingle();

    if (data) {
      setDonor(data);
      setFormData({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        blood_type: data.blood_type,
        date_of_birth: data.date_of_birth,
        gender: data.gender || '',
        district: data.district || '',
        address: data.address,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
      });
    }
    setLoading(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    const { error } = await supabase
      .from('donors')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        gender: formData.gender || null,
        district: formData.district,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
      })
      .eq('id', profile!.donor_id);

    if (!error) {
      setSuccess(true);
      fetchDonor();
    }
    setSaving(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">My Profile</h2>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <Droplets className="w-5 h-5 text-emerald-600" />
          <p className="text-emerald-800">Profile updated successfully!</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
            <User className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              {donor?.first_name} {donor?.last_name}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                {donor?.blood_type}
              </span>
              <span className={`text-sm ${donor?.is_eligible ? 'text-emerald-600' : 'text-amber-600'}`}>
                {donor?.is_eligible ? 'Eligible to donate' : 'Not eligible'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-3xl font-bold text-slate-900">{donor?.total_donations || 0}</p>
            <p className="text-sm text-slate-500">Total Donations</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-lg font-bold text-slate-900">
              {donor?.last_donation_date ? formatDate(donor.last_donation_date) : 'Never'}
            </p>
            <p className="text-sm text-slate-500">Last Donation</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email (Read Only)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={user?.email || ''}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-600"
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Blood Type (Read Only)</label>
              <input
                type="text"
                value={formData.blood_type}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold text-red-600 text-center"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
              <input
                type="text"
                value={formatDate(formData.date_of_birth)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-600"
                readOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">District of Origin</label>
              <select
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white"
              >
                <option value="">Select your district</option>
                <option value="Arusha Urban">Arusha Urban</option>
                <option value="Arusha Rural">Arusha Rural</option>
                <option value="Meru">Meru</option>
                <option value="Karatu">Karatu</option>
                <option value="Longido">Longido</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Postal Code</label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-rose-700 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
