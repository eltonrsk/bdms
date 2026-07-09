import { useState, useEffect } from 'react';
import { supabase, DonationRequest, Donor, Hospital, STATUS_COLORS } from '../../lib/supabase';
import { User, Building2, Calendar, Clock, Check, X, Loader2, MessageSquare } from 'lucide-react';

export function AdminDonations() {
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState<(DonationRequest & { donors: Donor; hospitals: Hospital })[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDonations();
  }, [statusFilter]);

  async function fetchDonations() {
    setLoading(true);
    let query = supabase
      .from('donation_requests')
      .select('*, donors(*), hospitals(*)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    if (data) {
      let filtered = data as any;
      if (searchQuery) {
        filtered = filtered.filter(
          (d: any) =>
            d.donors?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.donors?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.donors?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.hospitals?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      setDonations(filtered);
    }
    setLoading(false);
  }

  const handleStatusUpdate = async (requestId: string, newStatus: DonationRequest['status']) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const updates: Partial<DonationRequest> = { status: newStatus };

    if (newStatus === 'approved') {
      updates.admin_verified_by = userId;
      updates.admin_verified_at = new Date().toISOString();
    }

    await supabase.from('donation_requests').update(updates).eq('id', requestId);
    fetchDonations();
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString();
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  };

  if (loading && donations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Donation Requests</h2>
        <button
          onClick={fetchDonations}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by donor or hospital..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchDonations();
              }}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {['all', 'pending', 'admin_review', 'approved', 'confirmed', 'completed', 'cancelled', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-sm rounded-xl capitalize whitespace-nowrap ${
                  statusFilter === s ? 'bg-red-100 text-red-700 font-medium' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {donations.map((donation) => (
          <div key={donation.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {donation.donors?.first_name} {donation.donors?.last_name}
                  </h3>
                  <p className="text-sm text-slate-500">{donation.donors?.email}</p>
                </div>
                <div className="hidden md:block h-10 w-px bg-slate-200 mx-2" />
                <div className="hidden md:flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-700">{donation.hospitals?.name}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="px-3 py-2 bg-red-100 rounded-lg">
                    <span className="text-red-700 font-bold">{donation.blood_type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  {formatDate(donation.requested_date)}
                  <Clock className="w-4 h-4 ml-2" />
                  {formatTime(donation.requested_time)}
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[donation.status]}`}>
                  {donation.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {donation.notes && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
                <p className="text-sm text-slate-600">{donation.notes}</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Created: {new Date(donation.created_at).toLocaleString()}
              </p>
              <div className="flex gap-2">
                {donation.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(donation.id, 'approved')}
                      className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(donation.id, 'rejected')}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 flex items-center gap-1"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </>
                )}
                {donation.status === 'approved' && (
                  <button
                    onClick={() => handleStatusUpdate(donation.id, 'completed')}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
                  >
                    Mark Completed
                  </button>
                )}
                {(donation.status === 'pending' || donation.status === 'approved') && (
                  <button
                    onClick={() => handleStatusUpdate(donation.id, 'cancelled')}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {donations.length === 0 && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No donation requests found</p>
        </div>
      )}
    </div>
  );
}
