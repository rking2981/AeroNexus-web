'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface PilotStats {
  pilot_id: string;
  total_flights: number;
  total_hours: number;
  avg_happiness: number | null;
  avg_vs: number | null;
}

interface Pilot {
  id: string;
  display_name: string;
  email: string;
  reputation: number;
  xp_points: number;
  pilot_tier: string;
  is_founder: boolean;
  is_banned: boolean;
  auto_rank: string;
  va_rank: string | null;
  current_airport_icao: string | null;
  created_at: string;
  stats: PilotStats;
}

const RANK_COLORS: Record<string, string> = {
  'Student Pilot':    'text-gray-400',
  'Private Pilot':    'text-blue-400',
  'Commercial Pilot': 'text-green-400',
  'First Officer':    'text-cyan-400',
  'Captain':          'text-aero',
  'Senior Captain':   'text-amber-400',
  'Chief Pilot':      'text-purple-400',
};

function vsColor(fpm: number | null) {
  if (fpm === null) return 'text-gray-500';
  const abs = Math.abs(fpm);
  if (abs <= 200) return 'text-green-400';
  if (abs <= 400) return 'text-amber-400';
  return 'text-red-400';
}

function RepBar({ value }: { value: number }) {
  const pct = (Number(value) / 5) * 100;
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400">{Number(value).toFixed(1)}</span>
    </div>
  );
}

export default function CrewPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pilot | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // VA Rank override
  const [editingRank, setEditingRank] = useState<string | null>(null);
  const [rankInput, setRankInput] = useState('');

  useEffect(() => {
    api.get('/pilots').then((r) => setPilots(r.data)).finally(() => setLoading(false));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true); setInviteError(''); setInviteSuccess('');
    try {
      const { data } = await api.post('/pilots/join', { email: inviteEmail });
      setInviteSuccess(`${data.display_name} has joined your airline.`);
      setInviteEmail('');
      const { data: roster } = await api.get('/pilots');
      setPilots(roster);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setInviteError(msg ?? 'Failed to add pilot.');
    } finally { setInviteLoading(false); }
  }

  async function handleSuspend(pilot: Pilot) {
    setActionLoading(pilot.id); setActionError('');
    try {
      await api.patch(`/pilots/${pilot.id}/suspend`);
      setPilots(pilots.map(p => p.id === pilot.id ? { ...p, is_banned: true } : p));
      setSelected(s => s?.id === pilot.id ? { ...s, is_banned: true } : s);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Action failed.');
    } finally { setActionLoading(null); }
  }

  async function handleReinstate(pilot: Pilot) {
    setActionLoading(pilot.id); setActionError('');
    try {
      await api.patch(`/pilots/${pilot.id}/reinstate`);
      setPilots(pilots.map(p => p.id === pilot.id ? { ...p, is_banned: false } : p));
      setSelected(s => s?.id === pilot.id ? { ...s, is_banned: false } : s);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Action failed.');
    } finally { setActionLoading(null); }
  }

  async function handleRemove(pilot: Pilot) {
    if (!confirm(`Remove ${pilot.display_name} from your airline?`)) return;
    setActionLoading(pilot.id); setActionError('');
    try {
      await api.delete(`/pilots/${pilot.id}`);
      setPilots(pilots.filter(p => p.id !== pilot.id));
      if (selected?.id === pilot.id) setSelected(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Action failed.');
    } finally { setActionLoading(null); }
  }

  const activePilots = pilots.filter(p => !p.is_banned);
  const suspendedPilots = pilots.filter(p => p.is_banned);

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Crew Center</h1>
          <p className="text-gray-400 text-sm">
            {activePilots.length} active pilot{activePilots.length !== 1 ? 's' : ''}
            {suspendedPilots.length > 0 && ` · ${suspendedPilots.length} suspended`}
          </p>
        </div>
        {isManager && (
          <button onClick={() => setShowInvite(!showInvite)}
            className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm">
            + Add Pilot
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="glass-card rounded-2xl p-5 mb-6 border border-aero/20">
          <h3 className="font-bold mb-3">Add Pilot by Email</h3>
          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email" required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="pilot@example.com"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition"
            />
            <button type="submit" disabled={inviteLoading}
              className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:brightness-110 transition">
              {inviteLoading ? 'Adding...' : 'Add Pilot'}
            </button>
            <button type="button" onClick={() => setShowInvite(false)}
              className="border border-white/20 px-4 py-2.5 rounded-xl text-sm hover:bg-white/5 transition">
              Cancel
            </button>
          </form>
          {inviteError && <p className="text-sm text-red-400 mt-2">{inviteError}</p>}
          {inviteSuccess && <p className="text-sm text-green-400 mt-2">{inviteSuccess}</p>}
        </div>
      )}

      {actionError && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">{actionError}</p>
      )}

      {pilots.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-4xl mb-4">👥</p>
          <h3 className="text-xl font-bold mb-2">No pilots yet</h3>
          <p className="text-gray-400 text-sm mb-6">Add pilots to your airline by email address.</p>
          {isManager && (
            <button onClick={() => setShowInvite(true)}
              className="bg-aero text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition text-sm">
              Add First Pilot
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Roster list */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3 mb-2">
              {[
                { label: 'Total Pilots', value: pilots.length },
                { label: 'Total Flights', value: pilots.reduce((s, p) => s + (p.stats?.total_flights ?? 0), 0).toLocaleString() },
                { label: 'Total Hours', value: `${pilots.reduce((s, p) => s + (p.stats?.total_hours ?? 0), 0).toFixed(0)}h` },
                { label: 'Avg Reputation', value: pilots.length > 0 ? (pilots.reduce((s, p) => s + Number(p.reputation), 0) / pilots.length).toFixed(1) : '—' },
              ].map(s => (
                <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
                  <p className="text-xl font-bold text-aero">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Active pilots */}
            {activePilots.map((pilot) => (
              <button key={pilot.id} onClick={() => setSelected(selected?.id === pilot.id ? null : pilot)}
                className={cn(
                  'glass-card rounded-2xl p-4 text-left w-full transition border',
                  selected?.id === pilot.id ? 'border-aero/30 bg-aero/5' : 'border-transparent hover:border-white/10',
                )}>
                <div className="flex items-center justify-between gap-4">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
                      pilot.is_founder ? 'bg-purple-500/20 text-purple-300' : 'bg-aero/15 text-aero',
                    )}>
                      {pilot.display_name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">{pilot.display_name}</span>
                        {pilot.is_founder && <span className="text-[10px] text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-full">Founder</span>}
                        {pilot.pilot_tier === 'PRO_SUB' && <span className="text-[10px] text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">PRO</span>}
                      </div>
                      <span className={cn('text-xs', RANK_COLORS[pilot.va_rank ?? pilot.auto_rank] ?? 'text-gray-400')}>
                        {pilot.va_rank ?? pilot.auto_rank}
                      </span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 flex-shrink-0 text-right">
                    <div>
                      <p className="text-xs text-gray-500">Flights</p>
                      <p className="text-sm font-mono text-white">{pilot.stats?.total_flights ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hours</p>
                      <p className="text-sm font-mono text-white">{pilot.stats?.total_hours ?? 0}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Reputation</p>
                      <RepBar value={pilot.reputation} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg VS</p>
                      <p className={cn('text-sm font-mono', vsColor(pilot.stats?.avg_vs ?? null))}>
                        {pilot.stats?.avg_vs ? `${Math.round(Number(pilot.stats.avg_vs))}` : '—'}
                      </p>
                    </div>
                    {pilot.current_airport_icao && (
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="text-sm font-mono text-aero">{pilot.current_airport_icao}</p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {/* Suspended pilots */}
            {suspendedPilots.length > 0 && (
              <>
                <div className="flex items-center gap-3 mt-2">
                  <div className="h-px bg-white/5 flex-1" />
                  <span className="text-xs text-gray-600 uppercase tracking-widest">Suspended</span>
                  <div className="h-px bg-white/5 flex-1" />
                </div>
                {suspendedPilots.map((pilot) => (
                  <button key={pilot.id} onClick={() => setSelected(selected?.id === pilot.id ? null : pilot)}
                    className={cn(
                      'glass-card rounded-2xl p-4 text-left w-full transition border opacity-60',
                      selected?.id === pilot.id ? 'border-red-500/30' : 'border-transparent',
                    )}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-sm font-bold text-red-400 flex-shrink-0">
                        {pilot.display_name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{pilot.display_name}</span>
                          <span className="text-[10px] text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">SUSPENDED</span>
                        </div>
                        <span className="text-xs text-gray-500">{pilot.email}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-72 flex-shrink-0 sticky top-0">
              <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
                {/* Header */}
                <div className="p-5 border-b border-white/5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold',
                      selected.is_founder ? 'bg-purple-500/20 text-purple-300' : 'bg-aero/15 text-aero',
                    )}>
                      {selected.display_name[0].toUpperCase()}
                    </div>
                    <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
                  </div>
                  <p className="font-bold text-white">{selected.display_name}</p>
                  <p className="text-xs text-gray-500 mb-1">{selected.email}</p>
                  <span className={cn('text-xs', RANK_COLORS[selected.va_rank ?? selected.auto_rank] ?? 'text-gray-400')}>
                    {selected.va_rank ?? selected.auto_rank}
                  </span>
                  {selected.is_banned && (
                    <p className="text-xs text-red-400 font-bold mt-1">SUSPENDED</p>
                  )}
                </div>

                {/* Stats */}
                <div className="p-4 border-b border-white/5 grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Flights', value: (selected.stats?.total_flights ?? 0).toString() },
                    { label: 'Hours', value: `${selected.stats?.total_hours ?? 0}h` },
                    { label: 'Reputation', value: Number(selected.reputation).toFixed(1) },
                    { label: 'XP', value: selected.xp_points.toLocaleString() },
                    { label: 'Avg Happiness', value: selected.stats?.avg_happiness ? `${Number(selected.stats.avg_happiness).toFixed(0)}%` : '—' },
                    { label: 'Avg Landing VS', value: selected.stats?.avg_vs ? `${Math.round(Number(selected.stats.avg_vs))} fpm` : '—' },
                    { label: 'Current Airport', value: selected.current_airport_icao ?? '—' },
                    { label: 'Member Since', value: new Date(selected.created_at).toLocaleDateString() },
                  ].map(r => (
                    <div key={r.label}>
                      <p className="text-gray-500 mb-0.5">{r.label}</p>
                      <p className="font-mono text-white text-sm">{r.value}</p>
                    </div>
                  ))}
                </div>

                {/* VA Rank override */}
                {isManager && (
                  <div className="p-4 border-b border-white/5">
                    <p className="text-xs text-gray-500 mb-2">VA Rank Override</p>
                    {editingRank === selected.id ? (
                      <div className="flex gap-2">
                        <input value={rankInput} onChange={e => setRankInput(e.target.value)}
                          placeholder="e.g. Senior Captain"
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-aero focus:outline-none" />
                        <button onClick={async () => {
                          try {
                            await api.patch(`/pilots/${selected.id}`, { va_rank: rankInput || null });
                            setPilots(pilots.map(p => p.id === selected.id ? { ...p, va_rank: rankInput || null } : p));
                            setSelected({ ...selected, va_rank: rankInput || null });
                            setEditingRank(null);
                          } catch { setActionError('Failed to update rank.'); }
                        }} className="text-xs bg-aero text-black font-bold px-2 py-1.5 rounded-lg">Save</button>
                        <button onClick={() => setEditingRank(null)} className="text-xs text-gray-500 hover:text-white px-2">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">{selected.va_rank ?? 'Auto (' + selected.auto_rank + ')'}</span>
                        <button onClick={() => { setEditingRank(selected.id); setRankInput(selected.va_rank ?? ''); }}
                          className="text-xs text-aero hover:underline">Edit</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {isManager && (
                  <div className="p-4 flex flex-col gap-2">
                    {selected.is_banned ? (
                      <button onClick={() => handleReinstate(selected)} disabled={!!actionLoading}
                        className="w-full text-sm font-bold py-2 rounded-xl border border-green-500/30 text-green-400 hover:bg-green-500/10 transition disabled:opacity-50">
                        {actionLoading === selected.id ? '...' : 'Reinstate Pilot'}
                      </button>
                    ) : (
                      <button onClick={() => handleSuspend(selected)} disabled={!!actionLoading}
                        className="w-full text-sm font-bold py-2 rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition disabled:opacity-50">
                        {actionLoading === selected.id ? '...' : 'Suspend Pilot'}
                      </button>
                    )}
                    <button onClick={() => handleRemove(selected)} disabled={!!actionLoading}
                      className="w-full text-sm font-bold py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50">
                      {actionLoading === selected.id ? '...' : 'Remove from Airline'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
