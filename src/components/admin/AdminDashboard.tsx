import { useState, useEffect } from 'react';
import { supabase, Inventory, Hospital, DonationRequest, HospitalRequest, STATUS_COLORS } from '../../lib/supabase';
import {
  AlertTriangle,
  Clock,
  Building2,
  Package,
  Truck,
  Users,
  ArrowRight,
  Check,
  X,
  Loader2,
} from 'lucide-react';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalHospitals: 0,
    activeAlerts: 0,
    pendingDonations: 0,
    pendingTransfers: 0,
  });
  const [urgentInventory, setUrgentInventory] = useState<(Inventory & { hospitals: Hospital })[]>([]);
  const [pendingDonations, setPendingDonations] = useState<(DonationRequest & { donors: { first_name: string; last_name: string; blood_type: string }; hospitals: { name: string } })[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<(HospitalRequest & { requester_hospital: { name: string }; provider_hospital: { name: string } | null })[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'urgent' | 'critical' | 'low'>('all');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);

    const { data: hospitals } = await supabase.from('hospitals').select('id');
    const { data: alerts } = await supabase
      .from('inventory')
      .select('id')
      .in('status', ['urgent', 'critical']);
    const { data: donations } = await supabase
      .from('donation_requests')
      .select('id')
      .in('status', ['pending', 'admin_review']);
    const { data: transfers } = await supabase
      .from('hospital_requests')
      .select('id')
      .eq('status', 'pending');

    setStats({
      totalHospitals: hospitals?.length || 0,
      activeAlerts: alerts?.length || 0,
      pendingDonations: donations?.length || 0,
      pendingTransfers: transfers?.length || 0,
    });

    const { data: invData } = await supabase
      .from('inventory')
      .select('*, hospitals!inner(*)')
      .in('status', ['urgent', 'critical', 'low'])
      .order('quantity', { ascending: true });

    if (invData) {
      setUrgentInventory(invData as (Inventory & { hospitals: Hospital })[]);
    }

    const { data: donData } = await supabase
      .from('donation_requests')
      .select('*, donors(first_name, last_name, blood_type), hospitals(name)')
      .in('status', ['pending', 'admin_review'])
      .order('created_at', { ascending: true });

    if (donData) {
      setPendingDonations(donData as any);
    }

    const { data: transData } = await supabase
      .from('hospital_requests')
      .select('*, requester_hospital:hospitals!requester_hospital_id(name), provider_hospital:hospitals!provider_hospital_id(name)')
      .in('status', ['pending', 'admin_approved'])
      .order('created_at', { ascending: true });

    if (transData) {
      setPendingTransfers(transData as any);
    }

    setLoading(false);
  }

  const filteredInventory = urgentInventory.filter(
    (inv) => activeFilter === 'all' || inv.status === activeFilter
  );

  const handleVerifyDonation = async (requestId: string, approve: boolean) => {
    const newStatus = approve ? 'approved' : 'rejected';
    const { error } = await supabase
      .from('donation_requests')
      .update({
        status: newStatus,
        admin_verified_by: (await supabase.auth.getUser()).data.user?.id,
        admin_verified_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) {
      fetchDashboardData();
    }
  };

  const handleApproveTransfer = async (requestId: string, approve: boolean) => {
    const newStatus = approve ? 'admin_approved' : 'rejected';
    const { error } = await supabase
      .from('hospital_requests')
      .update({
        status: newStatus,
        admin_approved_by: (await supabase.auth.getUser()).data.user?.id,
        admin_approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) {
      fetchDashboardData();
    }
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
        <h2 className="text-2xl font-bold text-slate-900">Admin Dashboard</h2>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Hospitals</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalHospitals}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Alerts</p>
              <p className="text-2xl font-bold text-slate-900">{stats.activeAlerts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending Donations</p>
              <p className="text-2xl font-bold text-slate-900">{stats.pendingDonations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending Transfers</p>
              <p className="text-2xl font-bold text-slate-900">{stats.pendingTransfers}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Inventory Alerts</h3>
              <div className="flex gap-1">
                {['all', 'urgent', 'critical', 'low'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter as any)}
                    className={`px-3 py-1 text-xs rounded-lg capitalize ${
                      activeFilter === filter
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {filteredInventory.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No inventory alerts</p>
              </div>
            ) : (
              filteredInventory.map((inv) => (
                <div key={inv.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                          inv.status === 'urgent'
                            ? 'bg-red-100 text-red-600'
                            : inv.status === 'critical'
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-amber-100 text-amber-600'
                        }`}
                      >
                        {inv.blood_type}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{inv.hospitals.name}</p>
                        <p className="text-sm text-slate-500">
                          {inv.quantity} units ({inv.min_threshold} min)
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        STATUS_COLORS[inv.status]
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Pending Donation Requests</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {pendingDonations.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No pending donations</p>
              </div>
            ) : (
              pendingDonations.map((req) => (
                <div key={req.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {req.donors.first_name} {req.donors.last_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {req.blood_type} for {req.hospitals.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerifyDonation(req.id, true)}
                        className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleVerifyDonation(req.id, false)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Inter-Hospital Transfer Requests</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {pendingTransfers.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No pending transfer requests</p>
            </div>
          ) : (
            pendingTransfers.map((req) => (
              <div key={req.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium">
                        {req.requester_hospital.name}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <div className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                        {req.provider_hospital?.name || 'Pending Assignment'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm font-medium">
                        {req.blood_type}
                      </span>
                      <span className="text-sm text-slate-600">{req.quantity} units</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        req.urgency === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : req.urgency === 'high'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {req.urgency}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveTransfer(req.id, true)}
                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproveTransfer(req.id, false)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
