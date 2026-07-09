import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, DonationRequest, Hospital, STATUS_COLORS } from '../../lib/supabase';
import { Calendar, Clock, Building2, XCircle, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export function DonorAppointments() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<(DonationRequest & { hospitals: Hospital })[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.donor_id) {
      fetchAppointments();
    }
  }, [profile, statusFilter]);

  async function fetchAppointments() {
    setLoading(true);
    let query = supabase
      .from('donation_requests')
      .select('*, hospitals(*)')
      .eq('donor_id', profile!.donor_id)
      .order('requested_date', { ascending: true });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    if (data) setAppointments(data as any);
    setLoading(false);
  }

  const handleCancel = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    setCancellingId(requestId);

    await supabase
      .from('donation_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    setCancellingId(null);
    fetchAppointments();
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${minutes} ${ampm}`;
  };

  const isUpcoming = (date: string) => new Date(date) >= new Date(new Date().toDateString());

  if (loading && appointments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">My Appointments</h2>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'pending', 'admin_review', 'approved', 'confirmed', 'completed', 'cancelled', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 rounded-xl text-sm capitalize whitespace-nowrap ${
              statusFilter === s ? 'bg-red-100 text-red-700 font-medium' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {appointments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No appointments found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((apt) => {
            const upcoming = isUpcoming(apt.requested_date) && apt.status !== 'cancelled' && apt.status !== 'rejected';

            return (
              <div
                key={apt.id}
                className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${
                  apt.status === 'cancelled' || apt.status === 'rejected' ? 'opacity-70' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-red-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{apt.hospitals?.name}</h3>
                        <p className="text-sm text-slate-500">
                          {apt.hospitals?.city}, {apt.hospitals?.state}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="px-4 py-2 bg-red-100 rounded-xl font-bold text-red-700">
                        {apt.blood_type}
                      </div>

                      <div className="text-center px-4 py-2 bg-slate-100 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-700">{formatDate(apt.requested_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-600">{formatTime(apt.requested_time)}</span>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[apt.status]}`}>
                        {apt.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {apt.notes && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-600">{apt.notes}</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                      Requested: {new Date(apt.created_at).toLocaleString()}
                    </div>

                    <div className="flex gap-2">
                      {upcoming && apt.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(apt.id)}
                          disabled={cancellingId === apt.id}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 flex items-center gap-2 disabled:opacity-50"
                        >
                          {cancellingId === apt.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Cancel
                        </button>
                      )}

                      {apt.status === 'approved' && (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <AlertCircle className="w-4 h-4" />
                          Awaiting hospital confirmation
                        </div>
                      )}

                      {apt.status === 'confirmed' && (
                        <div className="flex items-center gap-2 text-sm text-emerald-600">
                          <CheckCircle className="w-4 h-4" />
                          Confirmed - Please arrive on time
                        </div>
                      )}

                      {apt.status === 'completed' && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <CheckCircle className="w-4 h-4" />
                          Thank you for your donation!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
