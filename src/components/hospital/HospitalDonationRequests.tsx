import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, DonationRequest, Donor, STATUS_COLORS } from '../../lib/supabase';
import { Calendar, Clock, CheckCircle, XCircle, Phone, Mail, User, Loader2 } from 'lucide-react';

export function HospitalDonationRequests() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<(DonationRequest & { donors: Donor })[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'confirmed' | 'completed'>('all');

  useEffect(() => {
    if (profile?.hospital_id) {
      fetchRequests();
    }
  }, [profile, statusFilter]);

  async function fetchRequests() {
    setLoading(true);
    let query = supabase
      .from('donation_requests')
      .select('*, donors(*)')
      .eq('hospital_id', profile!.hospital_id)
      .order('requested_date', { ascending: true });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    if (data) setRequests(data as any);
    setLoading(false);
  }

  const handleConfirm = async (requestId: string, confirm: boolean) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    await supabase
      .from('donation_requests')
      .update({
        status: confirm ? 'confirmed' : 'cancelled',
        hospital_confirmed_by: userId,
        hospital_confirmed_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    fetchRequests();
  };

  const handleComplete = async (requestId: string) => {
    await supabase
      .from('donation_requests')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    const request = requests.find((r) => r.id === requestId);
    if (request) {
      await supabase.from('donors').update({
        last_donation_date: new Date().toISOString().split('T')[0],
        total_donations: (request.donors?.total_donations || 0) + 1,
      }).eq('id', request.donor_id);

      await supabase.rpc('update_inventory_count', {
        p_hospital_id: profile!.hospital_id,
        p_blood_type: request.blood_type,
        p_delta: 1,
      });
    }

    fetchRequests();
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${minutes} ${ampm}`;
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
        <h2 className="text-2xl font-bold text-slate-900">Incoming Donation Requests</h2>
        <button
          onClick={fetchRequests}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {['all', 'approved', 'confirmed', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s as any)}
            className={`px-4 py-2 rounded-xl text-sm capitalize ${
              statusFilter === s ? 'bg-red-100 text-red-700 font-medium' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No donation requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const isToday = new Date(req.requested_date).toDateString() === new Date().toDateString();
            const isPast = new Date(req.requested_date) < new Date();

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 ${
                  isPast && req.status !== 'completed' ? 'border-l-4 border-l-amber-400' : ''
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                      <User className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {req.donors?.first_name} {req.donors?.last_name}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {req.donors?.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {req.donors?.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="px-4 py-2 bg-red-100 rounded-lg mb-1">
                        <span className="text-red-700 font-bold text-xl">{req.blood_type}</span>
                      </div>
                      <span className="text-xs text-slate-500">Blood Type</span>
                    </div>

                    <div className="text-center px-4 py-2 bg-slate-100 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className={`font-medium ${isToday ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {new Date(req.requested_date).toLocaleDateString()}
                          {isToday && <span className="ml-1 text-xs">(Today)</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">{formatTime(req.requested_time)}</span>
                      </div>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                      {req.status}
                    </span>
                  </div>
                </div>

                {req.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">{req.notes}</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end gap-3">
                  {req.status === 'approved' && (
                    <>
                      <button
                        onClick={() => handleConfirm(req.id, true)}
                        className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirm Appointment
                      </button>
                      <button
                        onClick={() => handleConfirm(req.id, false)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Decline
                      </button>
                    </>
                  )}
                  {req.status === 'confirmed' && !isPast && (
                    <button
                      onClick={() => handleComplete(req.id)}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200"
                    >
                      Mark as Completed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
