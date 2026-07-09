import { useState, useEffect } from 'react';
import { supabase, Hospital } from '../../lib/supabase';
import { Building2, MapPin, Phone, Mail, User, Edit, CheckCircle, XCircle, Loader2, Plus } from 'lucide-react';

export function AdminHospitals() {
  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    phone: '',
    email: '',
    contact_person: '',
    password: '',
    latitude: '',
    longitude: '',
  });

  useEffect(() => {
    fetchHospitals();
  }, []);

  async function fetchHospitals() {
    setLoading(true);
    const { data } = await supabase.from('hospitals').select('*').order('name');
    if (data) setHospitals(data);
    setLoading(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSubmitError(null);

    const { password, ...restFormData } = formData;
    const hospitalData = {
      ...restFormData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
    };

    try {
      if (editingHospital) {
        await supabase.from('hospitals').update(hospitalData).eq('id', editingHospital.id).select();
      } else {
        // call server-side function to create hospital and auth user
        const payload = {
          hospital: hospitalData,
          email: formData.email,
          password: formData.password || undefined,
        } as any;

        const fnRes = await supabase.functions.invoke('create-hospital', {
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        });

        if (fnRes.error) {
          setSubmitError(fnRes.error.message || 'Failed to create hospital');
          console.error('Create hospital function error:', fnRes.error);
          setSaving(false);
          return;
        }
      }
    } catch (err: any) {
      setSubmitError(err?.message || String(err));
      console.error('Hospital save error:', err);
      setSaving(false);
      return;
    }

    await fetchHospitals();
    setShowModal(false);
    setEditingHospital(null);
    resetForm();
    setSaving(false);
  };

  const handleToggleActive = async (hospital: Hospital) => {
    await supabase
      .from('hospitals')
      .update({ is_active: !hospital.is_active })
      .eq('id', hospital.id);
    fetchHospitals();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      phone: '',
      email: '',
      contact_person: '',
      password: '',
      latitude: '',
      longitude: '',
    });
  };

  const openEditModal = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setFormData({
      name: hospital.name,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      postal_code: hospital.postal_code,
      phone: hospital.phone,
      email: hospital.email,
      contact_person: hospital.contact_person,
      password: '',
      latitude: hospital.latitude?.toString() || '',
      longitude: hospital.longitude?.toString() || '',
    });
    setShowModal(true);
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
        <h2 className="text-2xl font-bold text-slate-900">Hospital Management</h2>
        <button
          onClick={() => {
            resetForm();
            setEditingHospital(null);
            setShowModal(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium flex items-center gap-2 hover:from-red-600 hover:to-rose-700 transition-all"
        >
          <Plus className="w-5 h-5" /> Add Hospital
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hospitals.map((hospital) => (
          <div
            key={hospital.id}
            className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${
              !hospital.is_active ? 'opacity-60' : ''
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{hospital.name}</h3>
                    <p className="text-sm text-slate-500">
                      {hospital.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(hospital)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {hospital.city}, {hospital.state}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {hospital.phone}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {hospital.email}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  {hospital.contact_person}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => handleToggleActive(hospital)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  hospital.is_active
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                {hospital.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-semibold text-slate-900">
                {editingHospital ? 'Edit Hospital' : 'Add New Hospital'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
              </div>
              {!editingHospital && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Initial Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="Set an initial password or leave blank to auto-generate"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Latitude (Optional)</label>
                  <input
                    type="text"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Longitude (Optional)</label>
                  <input
                    type="text"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingHospital(null);
                    resetForm();
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-rose-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Hospital'
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
