'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface AirlineBan {
  id: string;
  user_id: string;
  reason: string | null;
  banned_at: string;
  user: { id: string; display_name: string; email: string };
}

interface RankTier {
  id?: string;
  rank: string;
  min_hours: number;
  min_flights: number;
  sort_order: number;
}

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

  const [activeTab, setActiveTab] = useState<'roster' | 'banned' | 'ranks'>('roster');
  const [airlineBans, setAirlineBans] = useState<AirlineBan[]>([]);
  const [banReason, setBanReason] = useState('');
  const [showBanReason, setShowBanReason] = useState<string | null>(null);
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

  // VA Rank override per pilot
  const [editingRank, setEditingRank] = useState<string | null>(null);
  const [rankInput, setRankInput] = useState('');

  // Rank tier editor
  const [rankTiers, setRankTiers] = useState<RankTier[]>([]);
  const [isCustomRanks, setIsCustomRanks] = useState(false);
  const [ranksSaving, setRanksSaving] = useState(false);
  const [ranksError, setRanksError] = useState('');
  const [ranksSaved, setRanksSaved] = useState(false);

  useEffect(() => {
    api.get('/pilots').then((r) => setPilots(r.data)).finally(() => setLoading(false));
    api.get('/pilots/ranks').then((r) => { setRankTiers(r.data.tiers); setIsCustomRanks(r.data.custom); });
    if (isManager) api.get('/pilots/bans').then((r) => setAirlineBans(r.data)).catch(() => {});
  }, [isManager]);

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

  async function handleAirlineBan(pilot: Pilot, reason: string) {
    setActionLoading(pilot.id); setActionError('');
    try {
      await api.post(`/pilots/${pilot.id}/airline-ban`, { reason: reason || undefined });
      // Remove from active roster, add to bans list
      setPilots(pilots.filter(p => p.id !== pilot.id));
      setAirlineBans([{ id: Date.now().toString(), user_id: pilot.id, reason: reason || null, banned_at: new Date().toISOString(), user: { id: pilot.id, display_name: pilot.display_name, email: pilot.email } }, ...airlineBans]);
      setSelected(null); setShowBanReason(null); setBanReason('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Action failed.');
    } finally { setActionLoading(null); }
  }

  async function handleAirlineUnban(ban: AirlineBan) {
    setActionLoading(ban.user_id); setActionError('');
    try {
      await api.delete(`/pilots/${ban.user_id}/airline-ban`);
      setAirlineBans(airlineBans.filter(b => b.user_id !== ban.user_id));
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

  const activePilots = pilots; // roster only contains active airline members now

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Crew Center</h1>
          <p className="text-gray-400 text-sm">
            {activePilots.length} active pilot{activePilots.length !== 1 ? 's' : ''}
            {airlineBans.length > 0 && ` · ${airlineBans.length} airline ban${airlineBans.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isManager && (
          <button onClick={() => setShowInvite(!showInvite)}
            className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm">
            + Add Pilot
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {[
          { key: 'roster', label: '👥 Roster' },
          { key: 'banned', label: `🚫 Airline Bans${airlineBans.length > 0 ? ` (${airlineBans.length})` : ''}` },
          { key: 'ranks', label: '🏅 Rank Structure' },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              activeTab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Airline Bans tab ── */}
      {activeTab === 'banned' && (
        <div className="max-w-2xl flex flex-col gap-4">
          <div>
            <h2 className="font-bold text-lg mb-1">Airline Bans</h2>
            <p className="text-sm text-gray-400">These pilots have been banned from your airline. They can still access AeroNexus and join other airlines.</p>
          </div>

          {airlineBans.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">✅</p>
              <p className="text-gray-400 text-sm">No airline bans on record.</p>
            </div>
          ) : (
            airlineBans.map((ban) => (
              <div key={ban.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-white text-sm">{ban.user.display_name}</p>
                  <p className="text-xs text-gray-500">{ban.user.email}</p>
                  {ban.reason && <p className="text-xs text-gray-600 mt-1 italic">"{ban.reason}"</p>}
                  <p className="text-[10px] text-gray-700 mt-1">Banned {new Date(ban.banned_at).toLocaleDateString()}</p>
                </div>
                {isManager && (
                  <button onClick={() => handleAirlineUnban(ban)} disabled={actionLoading === ban.user_id}
                    className="flex-shrink-0 text-xs font-bold px-3 py-2 rounded-xl border border-green-500/30 text-green-400 hover:bg-green-500/10 transition disabled:opacity-50">
                    {actionLoading === ban.user_id ? '...' : 'Lift Ban'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Rank Structure tab ── */}
      {activeTab === 'ranks' && (
        <div className="max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg">Rank Structure</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {isCustomRanks ? 'Custom rank tiers for your airline.' : 'Using AeroNexus system defaults.'}
              </p>
            </div>
            {isCustomRanks && isManager && (
              <button onClick={async () => {
                if (!confirm('Reset to system defaults? All custom ranks will be removed.')) return;
                const { data } = await api.delete('/pilots/ranks');
                setRankTiers(data.tiers); setIsCustomRanks(false);
              }} className="text-xs text-gray-500 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition">
                Reset to Defaults
              </button>
            )}
          </div>

          {/* System defaults preview — shown only when not customised */}
          {!isCustomRanks && (
            <div className="glass-card rounded-2xl overflow-hidden mb-4 border border-white/5">
              <div className="px-4 py-2.5 border-b border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">System Default Ranks</p>
              </div>
              {rankTiers.map((tier, i) => (
                <div key={i} className="grid px-4 py-2.5 border-b border-white/5 last:border-0 items-center"
                  style={{ gridTemplateColumns: '32px 1fr 110px 110px' }}>
                  <span className="text-xs text-gray-600 font-mono">{i + 1}</span>
                  <span className="text-sm text-white font-medium">{tier.rank}</span>
                  <span className="text-sm font-mono text-gray-400 text-right">{tier.min_hours}h</span>
                  <span className="text-sm font-mono text-gray-400 text-right">{tier.min_flights} flights</span>
                </div>
              ))}
            </div>
          )}

          {/* Separator + customize prompt */}
          {!isCustomRanks && isManager && (
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px bg-white/5 flex-1" />
              <span className="text-xs text-gray-600 uppercase tracking-widest">Customize for your airline</span>
              <div className="h-px bg-white/5 flex-1" />
            </div>
          )}

          <div className="glass-card rounded-2xl overflow-hidden mb-4">
            {/* Header */}
            <div className="grid px-4 py-2.5 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest"
              style={{ gridTemplateColumns: '32px 1fr 110px 110px 36px' }}>
              <span>#</span>
              <span>Rank Name</span>
              <span className="text-right">Min Hours</span>
              <span className="text-right">Min Flights</span>
              <span />
            </div>

            {rankTiers.map((tier, i) => (
              <div key={i} className="grid px-4 py-2.5 border-b border-white/5 last:border-0 items-center gap-3"
                style={{ gridTemplateColumns: '32px 1fr 110px 110px 36px' }}>
                <span className="text-xs text-gray-600 font-mono">{i + 1}</span>

                {isManager ? (
                  <input value={tier.rank}
                    onChange={(e) => setRankTiers(rankTiers.map((t, j) => j === i ? { ...t, rank: e.target.value } : t))}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-aero focus:outline-none transition" />
                ) : (
                  <span className="text-sm text-white font-medium">{tier.rank}</span>
                )}

                {isManager ? (
                  <input type="number" min={0} value={tier.min_hours}
                    onChange={(e) => setRankTiers(rankTiers.map((t, j) => j === i ? { ...t, min_hours: Number(e.target.value) } : t))}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white text-right focus:border-aero focus:outline-none transition" />
                ) : (
                  <span className="text-sm font-mono text-gray-300 text-right">{tier.min_hours}h</span>
                )}

                {isManager ? (
                  <input type="number" min={0} value={tier.min_flights}
                    onChange={(e) => setRankTiers(rankTiers.map((t, j) => j === i ? { ...t, min_flights: Number(e.target.value) } : t))}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white text-right focus:border-aero focus:outline-none transition" />
                ) : (
                  <span className="text-sm font-mono text-gray-300 text-right">{tier.min_flights} flights</span>
                )}

                {isManager && (
                  <button onClick={() => setRankTiers(rankTiers.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-300 text-sm transition" title="Remove tier">✕</button>
                )}
              </div>
            ))}
          </div>

          {isManager && (
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setRankTiers([...rankTiers, { rank: 'New Rank', min_hours: 0, min_flights: 0, sort_order: rankTiers.length }])}
                disabled={rankTiers.length >= 10}
                className="text-sm border border-white/20 px-4 py-2 rounded-xl hover:bg-white/5 transition disabled:opacity-40">
                + Add Tier
              </button>
              <button onClick={async () => {
                setRanksSaving(true); setRanksError(''); setRanksSaved(false);
                try {
                  const { data } = await api.post('/pilots/ranks', { tiers: rankTiers.map((t, i) => ({ ...t, sort_order: i })) });
                  setRankTiers(data.tiers); setIsCustomRanks(data.custom);
                  setRanksSaved(true); setTimeout(() => setRanksSaved(false), 3000);
                } catch (err: unknown) {
                  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                  setRanksError(msg ?? 'Failed to save ranks.');
                } finally { setRanksSaving(false); }
              }} disabled={ranksSaving}
                className="bg-aero text-black font-bold px-5 py-2 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                {ranksSaving ? 'Saving...' : 'Save Rank Structure'}
              </button>
              {ranksSaved && <p className="text-green-400 text-sm self-center">✓ Saved</p>}
              {ranksError && <p className="text-red-400 text-sm self-center">{ranksError}</p>}
            </div>
          )}

          {/* How it works */}
          <div className="glass-card rounded-2xl p-4 mt-6 border border-white/5">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">How Ranks Work</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Pilots are automatically promoted when they meet <strong className="text-white">both</strong>{' '}the minimum hours and minimum flights for the next tier.
              Ranks are re-evaluated after every completed flight. You can also manually override a pilot&apos;s rank from their profile in the Roster tab.
            </p>
          </div>
        </div>
      )}

      {/* Roster tab content below */}
      {activeTab === 'roster' && (
      <>
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
                        <select value={rankInput} onChange={e => setRankInput(e.target.value)}
                          className="flex-1 rounded-lg border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white focus:border-aero focus:outline-none">
                          <option value="">— Auto ({selected.auto_rank})</option>
                          {rankTiers.map((t) => (
                            <option key={t.rank} value={t.rank}>{t.rank}</option>
                          ))}
                        </select>
                        <button onClick={async () => {
                          try {
                            await api.patch(`/pilots/${selected.id}/rank`, { va_rank: rankInput || null });
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
                    {/* Airline ban with optional reason */}
                    {showBanReason === selected.id ? (
                      <div className="flex flex-col gap-2">
                        <input value={banReason} onChange={e => setBanReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-red-400 focus:outline-none" />
                        <div className="flex gap-2">
                          <button onClick={() => handleAirlineBan(selected, banReason)} disabled={!!actionLoading}
                            className="flex-1 text-xs font-bold py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition disabled:opacity-50">
                            {actionLoading === selected.id ? '...' : 'Confirm Ban'}
                          </button>
                          <button onClick={() => { setShowBanReason(null); setBanReason(''); }}
                            className="text-xs px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowBanReason(selected.id)} disabled={!!actionLoading}
                        className="w-full text-sm font-bold py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50">
                        Ban from Airline
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
      </>
      )}
    </div>
  );
}
