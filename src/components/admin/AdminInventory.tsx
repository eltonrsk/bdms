import { useState, useEffect } from 'react';
import { supabase, Inventory, Hospital, STATUS_COLORS } from '../../lib/supabase';
import { Search, Loader2, CheckCircle, XCircle } from 'lucide-react';

export function AdminInventory() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<(Inventory & { hospitals: Hospital })[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'low' | 'critical' | 'urgent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
    fetchHospitals();
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [selectedHospital, statusFilter]);

  async function fetchHospitals() {
    const { data } = await supabase.from('hospitals').select('*').order('name');
    if (data) setHospitals(data);
  }

  async function fetchInventory() {
    setLoading(true);
    let query = supabase
      .from('inventory')
      .select('*, hospitals!inner(*)')
      .order('status')
      .order('quantity', { ascending: true });

    if (selectedHospital !== 'all') {
      query = query.eq('hospital_id', selectedHospital);
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    if (data) {
      let filtered = data as (Inventory & { hospitals: Hospital })[];
      if (searchQuery) {
        filtered = filtered.filter(
          (inv) =>
            inv.hospitals.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.blood_type.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      setInventory(filtered);
    }
    setLoading(false);
  }

  const handleVerify = async (invId: string, verify: boolean) => {
    setVerifyingId(invId);
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { error } = await supabase
      .from('inventory')
      .update({
        is_verified: verify,
        verified_by: verify ? userId : null,
        verified_at: verify ? new Date().toISOString() : null,
      })
      .eq('id', invId);

    if (!error) {
      await fetchInventory();
    }
    setVerifyingId(null);
  };

  const groupedInventory = inventory.reduce(
    (acc, inv) => {
      if (!acc[inv.hospital_id]) {
        acc[inv.hospital_id] = {
          hospital: inv.hospitals,
          items: [],
        };
      }
      acc[inv.hospital_id].items.push(inv);
      return acc;
    },
    {} as Record<string, { hospital: Hospital; items: (Inventory & { hospitals: Hospital })[] }>
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
        <h2 className="text-2xl font-bold text-slate-900">Inventory Management</h2>
        <button
          onClick={fetchInventory}
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
              placeholder="Search hospitals or blood types..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchInventory();
              }}
              className="w-full pl-11 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={selectedHospital}
            onChange={(e) => setSelectedHospital(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white"
          >
            <option value="all">All Hospitals</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {['all', 'urgent', 'critical', 'low', 'normal'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-3 py-2 text-sm rounded-xl capitalize transition-all ${
                  statusFilter === status
                    ? 'bg-red-100 text-red-700 font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {Object.values(groupedInventory).map(({ hospital, items }) => (
          <div
            key={hospital.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{hospital.name}</h3>
                <p className="text-sm text-slate-500">
                  {hospital.city}, {hospital.state}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {items.filter((i) => !i.is_verified).length > 0 && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                    {items.filter((i) => !i.is_verified).length} unverified
                  </span>
                )}
                <span className="text-sm text-slate-500">{items.length} blood types</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-slate-100">
              {items.map((inv) => (
                <div
                  key={inv.id}
                  className={`p-4 bg-white flex flex-col items-center justify-center ${
                    inv.is_verified ? 'opacity-100' : 'opacity-80'
                  }`}
                >
                  <div className="relative mb-2">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
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
                    {verifyingId === inv.id ? (
                      <Loader2 className="w-4 h-4 animate-spin absolute -right-1 -top-1 text-slate-400" />
                    ) : inv.is_verified ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 absolute -right-1 -top-1" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300 absolute -right-1 -top-1" />
                    )}
                  </div>
                  <p className="text-xl font-bold text-slate-900">{inv.quantity}</p>
                  <p className="text-xs text-slate-500">units</p>
                  <span
                    className={`mt-2 px-2 py-0.5 rounded text-xs capitalize ${
                      STATUS_COLORS[inv.status]
                    }`}
                  >
                    {inv.status}
                  </span>
                  {!inv.is_verified && (
                    <button
                      onClick={() => handleVerify(inv.id, true)}
                      disabled={verifyingId === inv.id}
                      className="mt-2 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50"
                    >
                      Verify
                    </button>
                  )}
                  {inv.is_verified && (
                    <button
                      onClick={() => handleVerify(inv.id, false)}
                      disabled={verifyingId === inv.id}
                      className="mt-2 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                      Unverify
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
