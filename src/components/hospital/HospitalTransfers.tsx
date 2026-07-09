import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, HospitalRequest, Hospital, Inventory, STATUS_COLORS, BLOOD_TYPES } from '../../lib/supabase';
import { ArrowRight, Loader2, Send, Package, AlertCircle } from 'lucide-react';

export function HospitalTransfers() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<(HospitalRequest & { requester_hospital: Hospital; provider_hospital: Hospital | null })[]>([]);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    blood_type: '',
    quantity: 1,
    urgency: 'normal' as HospitalRequest['urgency'],
    notes: '',
  });

  useEffect(() => {
    if (profile?.hospital_id) {
      fetchData();
    }
  }, [profile]);

  async function fetchData() {
    setLoading(true);

    const { data: reqData } = await supabase
      .from('hospital_requests')
      .select(`
        *,
        requester_hospital:hospitals!requester_hospital_id(*),
        provider_hospital:hospitals!provider_hospital_id(*)
      `)
      .eq('requester_hospital_id', profile!.hospital_id)
      .order('created_at', { ascending: false });
    if (reqData) setRequests(reqData as any);

    const { data: invData } = await supabase
      .from('inventory')
      .select('*')
      .eq('hospital_id', profile!.hospital_id);
    if (invData) setInventory(invData);

    setLoading(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from('hospital_requests').insert({
      requester_hospital_id: profile!.hospital_id,
      blood_type: formData.blood_type,
      quantity: formData.quantity,
      urgency: formData.urgency,
      notes: formData.notes,
    });

    if (!error) {
      setShowNewRequest(false);
      setFormData({ blood_type: '', quantity: 1, urgency: 'normal', notes: '' });
      fetchData();
    }
    setSaving(false);
  };

  const criticalInventory = inventory.filter((i) =>
    ['urgent', 'critical'].includes(i.status)
  );

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
        <h2 className="text-2xl font-bold text-slate-900">Blood Transfer Requests</h2>
        <button
          onClick={() => setShowNewRequest(true)}
          className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium flex items-center gap-2 hover:from-red-600 hover:to-rose-700"
        >
          <Send className="w-4 h-4" /> New Request
        </button>
      </div>

      {criticalInventory.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Critical Inventory Alert</p>
            <p className="text-sm text-red-700 mt-1">
              The following blood types need immediate attention:{' '}
              {criticalInventory.map((i) => i.blood_type).join(', ')}
            </p>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">No transfer requests yet</p>
          <button
            onClick={() => setShowNewRequest(true)}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200"
          >
            Create First Request
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="px-4 py-3 bg-red-100 rounded-xl">
                    <span className="text-red-700 font-bold text-xl">{req.blood_type}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{req.quantity} units</p>
                    <p className="text-sm text-slate-500">
                      Urgency:{' '}
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          req.urgency === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : req.urgency === 'high'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {req.urgency}
                      </span>
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[req.status]}`}>
                  {req.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <ArrowRight className="w-4 h-4 text-emerald-500" />
                <span>Provider: </span>
                <span className="font-medium">
                  {req.provider_hospital?.name || 'Pending assignment by Admin'}
                </span>
              </div>

              {req.notes && (
                <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                  <span className="font-medium">Notes:</span> {req.notes}
                </p>
              )}

              <p className="mt-3 text-xs text-slate-400">
                Requested: {new Date(req.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {showNewRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">New Blood Request</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Blood Type</label>
                <select
                  value={formData.blood_type}
                  onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none bg-white"
                  required
                >
                  <option value="">Select blood type</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity (units)</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none"
                  min={1}
                  max={20}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Urgency</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none bg-white"
                >
                  <option value="low">Low - Within a week</option>
                  <option value="normal">Normal - Within 3 days</option>
                  <option value="high">High - Within 24 hours</option>
                  <option value="critical">Critical - Immediate</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none resize-none"
                  rows={3}
                  placeholder="Additional details..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewRequest(false)}
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
