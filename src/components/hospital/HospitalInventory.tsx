import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, Inventory, STATUS_COLORS } from '../../lib/supabase';
import { Package, Edit, Loader2, CheckCircle, Save, Minus, Plus } from 'lucide-react';
import { BLOOD_TYPES } from '../../lib/supabase';

export function HospitalInventory() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ quantity: 0, min_threshold: 10, max_capacity: 100 });

  useEffect(() => {
    if (profile?.hospital_id) {
      fetchInventory();
    }
  }, [profile]);

  async function fetchInventory() {
    setLoading(true);
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('hospital_id', profile!.hospital_id)
      .order('blood_type');
    if (data) setInventory(data);
    setLoading(false);
  }

  const startEditing = (inv: Inventory) => {
    setEditingId(inv.id);
    setEditForm({
      quantity: inv.quantity,
      min_threshold: inv.min_threshold,
      max_capacity: inv.max_capacity,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const userId = (await supabase.auth.getUser()).data.user?.id;

    await supabase
      .from('inventory')
      .update({
        quantity: editForm.quantity,
        min_threshold: editForm.min_threshold,
        max_capacity: editForm.max_capacity,
        updated_by: userId,
      })
      .eq('id', editingId);

    setEditingId(null);
    fetchInventory();
  };

  const quickAdjust = async (inv: Inventory, delta: number) => {
    const newQuantity = Math.max(0, Math.min(inv.max_capacity, inv.quantity + delta));
    const userId = (await supabase.auth.getUser()).data.user?.id;

    await supabase
      .from('inventory')
      .update({
        quantity: newQuantity,
        updated_by: userId,
      })
      .eq('id', inv.id);

    fetchInventory();
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
        <h2 className="text-2xl font-bold text-slate-900">Inventory Management</h2>
        <button
          onClick={fetchInventory}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {BLOOD_TYPES.map((bloodType) => {
          const inv = inventory.find((i) => i.blood_type === bloodType);
          const isEditing = editingId === inv?.id;

          return (
            <div
              key={bloodType}
              className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${
                inv?.status === 'urgent' || inv?.status === 'critical'
                  ? 'ring-2 ring-red-200'
                  : ''
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl ${
                      inv?.status === 'urgent'
                        ? 'bg-red-100 text-red-600'
                        : inv?.status === 'critical'
                        ? 'bg-orange-100 text-orange-600'
                        : inv?.status === 'low'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {bloodType}
                  </div>
                  {inv?.is_verified && (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  )}
                </div>

                {inv && isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Quantity</label>
                      <input
                        type="number"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-center font-bold text-lg"
                        min={0}
                        max={editForm.max_capacity}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Min</label>
                        <input
                          type="number"
                          value={editForm.min_threshold}
                          onChange={(e) => setEditForm({ ...editForm, min_threshold: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-center text-sm"
                          min={1}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Max</label>
                        <input
                          type="number"
                          value={editForm.max_capacity}
                          onChange={(e) => setEditForm({ ...editForm, max_capacity: parseInt(e.target.value) || 100 })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-center text-sm"
                          min={1}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleUpdate}
                      className="w-full py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : inv ? (
                  <div>
                    <div className="text-center mb-4">
                      <p className="text-4xl font-bold text-slate-900">{inv.quantity}</p>
                      <p className="text-sm text-slate-500">
                        Min: {inv.min_threshold} / Max: {inv.max_capacity}
                      </p>
                    </div>

                    <div className="flex justify-center gap-2 mb-4">
                      <button
                        onClick={() => quickAdjust(inv, -1)}
                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => quickAdjust(inv, 1)}
                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <span
                      className={`block text-center px-3 py-1.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status]}`}
                    >
                      {inv.status}
                    </span>

                    <button
                      onClick={() => startEditing(inv)}
                      className="mt-4 w-full py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" /> Edit Details
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-6">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Not tracked</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Inventory changes are automatically verified by the admin before being shown to donors.
          Status is calculated based on quantity vs. minimum threshold.
        </p>
      </div>
    </div>
  );
}
