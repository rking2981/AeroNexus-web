'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const ALL_PERMISSIONS = [
  { key: 'can_manage_fleet',      label: 'Manage Fleet',      desc: 'Add, edit, retire aircraft' },
  { key: 'can_manage_routes',     label: 'Manage Routes',     desc: 'Create and edit routes & hubs' },
  { key: 'can_manage_crew',       label: 'Manage Crew',       desc: 'Invite, suspend, remove pilots' },
  { key: 'can_view_finances',     label: 'View Finances',     desc: 'Read P&L and transactions' },
  { key: 'can_manage_finances',   label: 'Manage Finances',   desc: 'Full finance access' },
  { key: 'can_manage_hubs',       label: 'Manage Hubs',       desc: 'Add and remove hubs' },
  { key: 'can_book_flights',      label: 'Book Flights',      desc: 'Book flights on behalf of airline' },
  { key: 'can_dispatch_flights',  label: 'Dispatch Flights',  desc: 'Dispatch and complete flights' },
  { key: 'can_manage_cargo',      label: 'Manage Cargo',      desc: 'Accept and manage cargo shipments' },
  { key: 'can_manage_contracts',  label: 'Manage Contracts',  desc: 'Accept and assign contracts' },
  { key: 'can_manage_insurance',  label: 'Manage Insurance',  desc: 'Buy and manage insurance policies' },
  { key: 'can_view_reports',      label: 'View Reports',      desc: 'See issue tracker reports' },
  { key: 'can_manage_promotions', label: 'Manage Promotions', desc: 'Create and manage ads/promotions' },
];

interface Position {
  id: string; name: string; description: string | null;
  is_active: boolean; permissions: Record<string, boolean>;
  _count: { members: number };
  members: { id: string; user: { id: string; display_name: string; avatar_url: string | null; va_pilot_id: string | null } }[];
}

interface Pilot { id: string; display_name: string; va_pilot_id: string | null }

export default function PositionsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';
  const [positions, setPositions] = useState<Position[]>([]);
  const [pilots, setPilots]       = useState<Pilot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Position | null>(null);

  // Create form
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [newDesc, setNewDesc]     = useState('');
  const [newPerms, setNewPerms]   = useState<Record<string, boolean>>({});
  const [saving, setSaving]       = useState(false);

  // Assign member
  const [assignUserId, setAssignUserId] = useState('');
  const [assigning, setAssigning]       = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/positions'),
      api.get('/pilots'),
    ]).then(([p, r]) => {
      setPositions(p.data);
      setPilots(r.data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const { data } = await api.post('/positions', { name: newName, description: newDesc, permissions: newPerms });
    setPositions(p => [...p, { ...data, members: [], _count: { members: 0 } }]);
    setNewName(''); setNewDesc(''); setNewPerms({}); setCreating(false); setSaving(false);
  }

  async function toggleActive(pos: Position) {
    const { data } = await api.patch(`/positions/${pos.id}`, { is_active: !pos.is_active });
    setPositions(p => p.map(x => x.id === pos.id ? { ...x, is_active: data.is_active } : x));
    if (selected?.id === pos.id) setSelected(s => s ? { ...s, is_active: data.is_active } : s);
  }

  async function deletePosition(pos: Position) {
    if (!confirm(`Delete position "${pos.name}"?`)) return;
    await api.delete(`/positions/${pos.id}`);
    setPositions(p => p.filter(x => x.id !== pos.id));
    if (selected?.id === pos.id) setSelected(null);
  }

  async function assignMember() {
    if (!selected || !assignUserId) return;
    setAssigning(true);
    const { data } = await api.post(`/positions/${selected.id}/members`, { user_id: assignUserId });
    const pilot = pilots.find(p => p.id === assignUserId);
    if (pilot) {
      const member = { id: data.id, user: { id: pilot.id, display_name: pilot.display_name, avatar_url: null, va_pilot_id: pilot.va_pilot_id } };
      setSelected(s => s ? { ...s, members: [...s.members, member], _count: { members: s._count.members + 1 } } : s);
    }
    setAssignUserId(''); setAssigning(false);
  }

  async function removeMember(positionId: string, userId: string) {
    await api.delete(`/positions/${positionId}/members/${userId}`);
    setSelected(s => s ? { ...s, members: s.members.filter(m => m.user.id !== userId), _count: { members: s._count.members - 1 } } : s);
  }

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-40 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Positions</h1>
          <p className="text-gray-400 text-sm">Define roles and permissions for your crew members</p>
        </div>
        {isManager && (
          <button onClick={() => setCreating(true)}
            className="bg-aero text-black font-bold px-4 py-2.5 rounded-xl text-sm hover:brightness-110 transition flex-shrink-0">
            + New Position
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Position list */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2">
          {positions.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-gray-500 text-sm">
              No positions yet.{isManager && <><br/>Create one to get started.</>}
            </div>
          ) : positions.map(pos => (
            <button key={pos.id} onClick={() => setSelected(pos)}
              className={cn('glass-card rounded-xl p-4 text-left transition hover:bg-white/5 w-full',
                selected?.id === pos.id && 'border border-aero/30 bg-aero/5')}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-white truncate">{pos.name}</span>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', pos.is_active ? 'text-green-400 bg-green-500/10' : 'text-gray-500 bg-white/5')}>
                  {pos.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-gray-500">{pos._count.members} member{pos._count.members !== 1 ? 's' : ''}</p>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0">
          {creating && (
            <div className="glass-card rounded-2xl p-6 mb-4">
              <h3 className="font-bold mb-4">New Position</h3>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Position name (e.g. Chief Pilot)" required
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Permissions</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_PERMISSIONS.map(p => (
                      <label key={p.key} className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/5 cursor-pointer transition">
                        <input type="checkbox" checked={!!newPerms[p.key]} onChange={e => setNewPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                          className="mt-0.5 accent-[#00C8FF]" />
                        <div>
                          <p className="text-xs font-semibold text-white">{p.label}</p>
                          <p className="text-[10px] text-gray-500">{p.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving || !newName}
                    className="bg-aero text-black font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-40 hover:brightness-110 transition">
                    {saving ? 'Creating…' : 'Create Position'}
                  </button>
                  <button type="button" onClick={() => setCreating(false)}
                    className="border border-white/10 text-gray-400 px-5 py-2 rounded-xl text-sm hover:text-white transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {selected ? (
            <div className="flex flex-col gap-5">
              {/* Header */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-xl font-bold">{selected.name}</h2>
                  {isManager && (
                    <div className="flex gap-2">
                      <button onClick={() => toggleActive(selected)}
                        className={cn('text-xs font-bold px-3 py-1.5 rounded-lg border transition',
                          selected.is_active ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10')}>
                        {selected.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deletePosition(selected)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {selected.description && <p className="text-sm text-gray-400">{selected.description}</p>}
              </div>

              {/* Permissions */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-gray-300 mb-4">Permissions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map(p => {
                    const enabled = !!selected.permissions[p.key];
                    return (
                      <div key={p.key} className={cn('flex items-center gap-3 p-3 rounded-xl border',
                        enabled ? 'border-aero/20 bg-aero/5' : 'border-white/5 bg-white/[0.02] opacity-50')}>
                        <span className={cn('text-sm', enabled ? 'text-aero' : 'text-gray-600')}>{enabled ? '✓' : '✗'}</span>
                        <div>
                          <p className="text-xs font-semibold text-white">{p.label}</p>
                          <p className="text-[10px] text-gray-500">{p.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Members */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-gray-300 mb-4">Members ({selected.members.length})</h3>
                {selected.members.length === 0 ? (
                  <p className="text-sm text-gray-500">No members assigned.</p>
                ) : (
                  <div className="flex flex-col gap-2 mb-4">
                    {selected.members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-aero/20 flex items-center justify-center text-aero text-xs font-bold flex-shrink-0">
                          {m.user.display_name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{m.user.display_name}</p>
                          {m.user.va_pilot_id && <p className="text-xs text-gray-500 font-mono">{m.user.va_pilot_id}</p>}
                        </div>
                        {isManager && (
                          <button onClick={() => removeMember(selected.id, m.user.id)}
                            className="text-xs text-red-400 border border-red-500/20 px-2 py-1 rounded-lg hover:bg-red-500/10 transition flex-shrink-0">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {isManager && (
                  <div className="flex gap-2">
                    <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-aero focus:outline-none">
                      <option value="">Select pilot to assign…</option>
                      {pilots.filter(p => !selected.members.some(m => m.user.id === p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.display_name}{p.va_pilot_id ? ` (${p.va_pilot_id})` : ''}</option>
                      ))}
                    </select>
                    <button onClick={assignMember} disabled={!assignUserId || assigning}
                      className="bg-aero text-black font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:brightness-110 transition flex-shrink-0">
                      {assigning ? '…' : 'Assign'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : !creating && (
            <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
              Select a position to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
