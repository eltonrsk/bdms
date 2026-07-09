import { useState, useEffect } from 'react';
import { supabase, HospitalRequest, Hospital, STATUS_COLORS } from '../../lib/supabase';
import { ArrowRight, Check, X, Loader2, Truck, AlertCircle } from 'lucide-react';

export function AdminTransfers() {
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<(HospitalRequest & { requester_hospital: Hospital; provider_hospital: Hospital | null })[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [assigningProvider, setAssigningProvider] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'completed'>('all');

  useEffect(() => {
    fetchTransfers();
    fetchHospitals();
  }, [filter]);

  async function fetchHospitals() {
    const { data } = await supabase.from('hospitals').select('*').order('name');
    if (data) setHospitals(data);
  }

  async function fetchTransfers() {
    setLoading(true);
    let query = supabase
      .from('hospital_requests')
      .select(`
        *,
        requester_hospital:hospitals!requester_hospital_id(*),
        provider_hospital:hospitals!provider_hospital_id(*)
      `)
      .order('created_at', { ascending: false });

    if (filter === 'pending') {
      query = query.in('status', ['pending', 'admin_approved', 'provider_assigned']);
    } else if (filter === 'approved') {
      query = query.in('status', ['preparing', 'in_transit', 'delivered']);
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed');
    }

    const { data } = await query;
    if (data) setTransfers(data as any);
    setLoading(false);
  }

  const handleApprove = async (requestId: string) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { error } = await supabase
      .from('hospital_requests')
      .update({
        status: 'admin_approved',
        admin_approved_by: userId,
        admin_approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) fetchTransfers();
  };

  const handleAssignProvider = async (requestId: string) => {
    if (!selectedProvider) return;
    setAssigningProvider(requestId);

    const { error } = await supabase
      .from('hospital_requests')
      .update({
        provider_hospital_id: selectedProvider,
        status: 'provider_assigned',
      })
      .eq('id', requestId);

    if (!error) {
      setSelectedProvider('');
      fetchTransfers();
    }
    setAssigningProvider(null);
  };

  const handleReject = async (requestId: string, reason: string) => {
    const { error } = await supabase
      .from('hospital_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason,
      })
      .eq('id', requestId);

    if (!error) fetchTransfers();
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
        <h2 className="text-2xl font-bold text-slate-900">Transfer Requests</h2>
        <div className="flex gap-2">
          {['all', 'pending', 'approved', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 text-sm rounded-lg capitalize ${
                filter === f ? 'bg-red-100 text-red-700 font-medium' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {transfers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No transfer requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transfers.map((transfer) => (
            <div
              key={transfer.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[transfer.status]}`}
                    >
                      {transfer.status.replace('_', ' ')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        transfer.urgency === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : transfer.urgency === 'high'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {transfer.urgency}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-slate-100 rounded-lg">
                      <p className="text-xs text-slate-500">Requester</p>
                      <p className="font-medium text-slate-900">{transfer.requester_hospital.name}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                    <div className="px-4 py-2 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-emerald-600">Provider</p>
                      <p className="font-medium text-slate-900">
                        {transfer.provider_hospital?.name || 'Not Assigned'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="px-3 py-1.5 bg-red-100 rounded-lg inline-block">
                    <span className="text-red-700 font-bold text-lg">{transfer.blood_type}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{transfer.quantity} units</p>
                </div>
              </div>

              {transfer.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(transfer.id)}
                    className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:');
                      if (reason) handleReject(transfer.id, reason);
                    }}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}

              {transfer.status === 'admin_approved' && (
                <div className="flex items-center gap-3 bg-amber-50 p-4 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="text-amber-800 text-sm flex-1">Approved - Assign a provider hospital</p>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Select Hospital</option>
                    {hospitals
                      .filter((h) => h.id !== transfer.requester_hospital_id)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleAssignProvider(transfer.id)}
                    disabled={!selectedProvider || assigningProvider === transfer.id}
                    className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {assigningProvider === transfer.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Assign'
                    )}
                  </button>
                </div>
              )}

              {transfer.notes && (
                <p className="text-sm text-slate-500 mt-3">
                  <span className="font-medium">Notes:</span> {transfer.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
