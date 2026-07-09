import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, Inventory, DonationRequest, Hospital, STATUS_COLORS } from '../../lib/supabase';
import { Package, Users, AlertTriangle, Clock, Loader2, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

export function HospitalDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [pendingDonations, setPendingDonations] = useState<(DonationRequest & { donors: { first_name: string; last_name: string; blood_type: string } })[]>([]);
  const [stats, setStats] = useState({
    totalUnits: 0,
    criticalTypes: 0,
    pendingRequests: 0,
    completedToday: 0,
  });

  useEffect(() => {
    if (profile?.hospital_id) {
      fetchDashboardData();
    }
  }, [profile]);

  async function fetchDashboardData() {
    setLoading(true);

    const { data: hospitalData } = await supabase
      .from('hospitals')
      .select('*')
      .eq('id', profile!.hospital_id)
      .maybeSingle();
    if (hospitalData) setHospital(hospitalData);

    const { data: invData } = await supabase
      .from('inventory')
      .select('*')
      .eq('hospital_id', profile!.hospital_id)
      .order('status');
    if (invData) {
      setInventory(invData);
      setStats((prev) => ({
        ...prev,
        totalUnits: invData.reduce((sum, i) => sum + i.quantity, 0),
        criticalTypes: invData.filter((i) => ['critical', 'urgent'].includes(i.status)).length,
      }));
    }

    const { data: donations } = await supabase
      .from('donation_requests')
      .select('*, donors(first_name, last_name, blood_type)')
      .eq('hospital_id', profile!.hospital_id)
      .in('status', ['approved', 'confirmed'])
      .order('requested_date');
    if (donations) {
      setPendingDonations(donations as any);
      setStats((prev) => ({
        ...prev,
        pendingRequests: donations.filter((d: any) => d.status === 'approved').length,
        completedToday: donations.filter((d: any) => d.status === 'confirmed').length,
      }));
    }

    setLoading(false);
  }

  const handleConfirmDonation = async (requestId: string, confirm: boolean) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    await supabase
      .from('donation_requests')
      .update({
        status: confirm ? 'confirmed' : 'cancelled',
        hospital_confirmed_by: userId,
        hospital_confirmed_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    fetchDashboardData();
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
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500">{hospital?.name}</p>
        </div>
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
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Units</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalUnits}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Critical Types</p>
              <p className="text-2xl font-bold text-slate-900">{stats.criticalTypes}</p>
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
              <p className="text-2xl font-bold text-slate-900">{stats.pendingRequests}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Confirmed Today</p>
              <p className="text-2xl font-bold text-slate-900">{stats.completedToday}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Blood Inventory</h3>
          </div>
          <div className="grid grid-cols-4 gap-px bg-slate-100">
            {inventory.map((inv) => (
              <div
                key={inv.id}
                className="p-4 bg-white flex flex-col items-center justify-center"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold mb-1 ${
                    inv.status === 'urgent'
                      ? 'bg-red-100 text-red-600'
                      : inv.status === 'critical'
                      ? 'bg-orange-100 text-orange-600'
                      : inv.status === 'low'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {inv.blood_type}
                </div>
                <p className="text-lg font-bold text-slate-900">{inv.quantity}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status]}`}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Incoming Donations</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {pendingDonations.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No pending donations</p>
              </div>
            ) : (
              pendingDonations.map((donation) => (
                <div key={donation.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {donation.donors?.first_name} {donation.donors?.last_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {donation.blood_type} - {new Date(donation.requested_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {donation.status === 'approved' && (
                        <>
                          <button
                            onClick={() => handleConfirmDonation(donation.id, true)}
                            className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleConfirmDonation(donation.id, false)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[donation.status]}`}>
                        {donation.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
