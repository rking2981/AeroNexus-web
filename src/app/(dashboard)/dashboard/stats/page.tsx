'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

type Window = '30d' | '60d' | '90d' | 'month' | 'all';

const WINDOWS: { key: Window; label: string }[] = [
  { key: 'month', label: 'This Month' },
  { key: '30d',   label: 'Last 30 Days' },
  { key: '60d',   label: 'Last 60 Days' },
  { key: '90d',   label: 'Last 90 Days' },
  { key: 'all',   label: 'All Time' },
];

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

function happinessColor(v: number) {
  if (v >= 85) return 'text-green-400';
  if (v >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 text-center">
      <p className="text-2xl font-bold text-aero">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="text-sm font-mono text-gray-500 w-6 text-center">{rank}</span>;
}

// ─── Leaderboard table ────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  pilot?: {
    id: string;
    display_name: string;
    reputation: number;
    xp_points: number;
    auto_rank: string;
    is_founder: boolean;
    airline?: { name: string; icao_code: string } | null;
  };
  flights: number;
  total_hours: number;
  total_pax: number;
  avg_pax_happiness: string;
  avg_landing_vs_fpm: number | null;
}

function LeaderboardTable({ entries, loading }: { entries: LeaderboardEntry[]; loading: boolean }) {
  if (loading) return (
    <div className="flex flex-col gap-2">
      {[1,2,3,4,5].map(i => <div key={i} className="glass-card rounded-2xl h-14 animate-pulse" />)}
    </div>
  );

  if (entries.length === 0) return (
    <div className="glass-card rounded-2xl p-12 text-center">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-gray-400 text-sm">No flights recorded in this time window yet.</p>
    </div>
  );

  const COLS = '40px 1fr 80px 80px 90px 100px 110px';

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid px-5 py-3 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest"
        style={{ gridTemplateColumns: COLS }}>
        <span>#</span>
        <span>Pilot</span>
        <span className="text-right">Flights</span>
        <span className="text-right">Hours</span>
        <span className="text-right">PAX</span>
        <span className="text-right">Happiness</span>
        <span className="text-right">Avg VS</span>
      </div>

      {entries.map((entry) => (
        <div key={entry.rank}
          className="grid px-5 py-3.5 border-b border-white/5 last:border-0 items-center hover:bg-white/3 transition"
          style={{ gridTemplateColumns: COLS }}>
          {/* Rank */}
          <div className="flex items-center">
            <MedalIcon rank={entry.rank} />
          </div>

          {/* Pilot info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white text-sm truncate">{entry.pilot?.display_name ?? '—'}</span>
              {entry.pilot?.is_founder && <span className="text-[10px] text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-full">Founder</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('text-[10px]', RANK_COLORS[entry.pilot?.auto_rank ?? ''] ?? 'text-gray-500')}>
                {entry.pilot?.auto_rank ?? '—'}
              </span>
              {entry.pilot?.airline && (
                <span className="text-[10px] text-gray-600">{entry.pilot.airline.icao_code}</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <span className="text-right text-sm font-mono text-white">{entry.flights}</span>
          <span className="text-right text-sm font-mono text-gray-300">{entry.total_hours}h</span>
          <span className="text-right text-sm font-mono text-gray-300">{entry.total_pax.toLocaleString()}</span>
          <span className={cn('text-right text-sm font-mono font-bold', happinessColor(Number(entry.avg_pax_happiness)))}>
            {Number(entry.avg_pax_happiness).toFixed(0)}%
          </span>
          <span className={cn('text-right text-sm font-mono', vsColor(entry.avg_landing_vs_fpm))}>
            {entry.avg_landing_vs_fpm !== null ? `${entry.avg_landing_vs_fpm} fpm` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [activeTab, setActiveTab] = useState<'network' | 'airline' | 'my'>('network');
  const [window, setWindow] = useState<Window>('month');
  const [loading, setLoading] = useState(false);

  // Network leaderboard
  const [networkBoard, setNetworkBoard] = useState<LeaderboardEntry[]>([]);

  // Airline leaderboard + stats
  const [airlineBoard, setAirlineBoard] = useState<LeaderboardEntry[]>([]);
  const [airlineStats, setAirlineStats] = useState<{
    completed_flights: number; total_hours: number; total_pax: number;
    avg_pax_happiness: number | null; avg_landing_vs_fpm: number | null;
    pilot_count: number; avg_pilot_reputation: number | null;
    active_hull_count: number; flights_in_progress: number;
    airline: { name: string; icao_code: string; currency_symbol: string } | null;
  } | null>(null);

  // My stats
  const [myStats, setMyStats] = useState<{
    flights: number; total_hours: number; total_pax: number;
    avg_pax_happiness: number | null; avg_landing_vs_fpm: number | null;
    pilot: { display_name: string; reputation: number; xp_points: number } | null;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const calls: Promise<void>[] = [];

      if (activeTab === 'network') {
        calls.push(
          api.get(`/stats/leaderboard/network?window=${window}&limit=25`)
            .then(r => setNetworkBoard(r.data))
        );
      }

      if (activeTab === 'airline' && user?.airline_id) {
        calls.push(
          api.get(`/stats/leaderboard/pilots?window=${window}&limit=25`)
            .then(r => setAirlineBoard(r.data.map((e: LeaderboardEntry, i: number) => ({ ...e, rank: i + 1 })))),
          api.get(`/stats/airline?window=${window}`)
            .then(r => setAirlineStats(r.data)),
        );
      }

      if (activeTab === 'my' && user?.id) {
        calls.push(
          api.get(`/stats/pilots/${user.id}?window=${window}`)
            .then(r => setMyStats(r.data))
        );
      }

      await Promise.all(calls);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [activeTab, window, user?.id, user?.airline_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { key: 'network', label: '🌐 Network' },
    ...(user?.airline_id ? [{ key: 'airline', label: '🏢 My Airline' }] : []),
    { key: 'my', label: '👤 My Stats' },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Stats & Leaderboards</h1>
        <p className="text-gray-400 text-sm">Pilot rankings, airline performance, and network analytics.</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {/* Tab selector */}
        <div className="flex gap-1 glass-card rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium transition',
                activeTab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Time window */}
        <div className="flex gap-1 glass-card rounded-xl p-1 ml-auto">
          {WINDOWS.map(w => (
            <button key={w.key} onClick={() => setWindow(w.key)}
              className={cn('px-3 py-2 rounded-lg text-xs font-medium transition',
                window === w.key ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white')}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Network tab ── */}
      {activeTab === 'network' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg">Top Pilots — Network</h2>
            <span className="text-xs text-gray-500 border border-white/10 px-2 py-0.5 rounded-full">
              {WINDOWS.find(w => w.key === window)?.label}
            </span>
          </div>
          <LeaderboardTable entries={networkBoard} loading={loading} />
        </div>
      )}

      {/* ── Airline tab ── */}
      {activeTab === 'airline' && (
        <div className="flex flex-col gap-6">
          {/* Airline summary stats */}
          {airlineStats && (
            <>
              <h2 className="font-bold text-lg">{airlineStats.airline?.name} — Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Completed Flights" value={airlineStats.completed_flights.toLocaleString()} />
                <StatCard label="Total Hours" value={`${airlineStats.total_hours.toLocaleString()}h`} />
                <StatCard label="Total PAX Carried" value={airlineStats.total_pax.toLocaleString()} />
                <StatCard label="Avg PAX Happiness"
                  value={airlineStats.avg_pax_happiness ? `${Number(airlineStats.avg_pax_happiness).toFixed(0)}%` : '—'} />
                <StatCard label="Active Pilots" value={airlineStats.pilot_count.toString()} />
                <StatCard label="Active Aircraft" value={airlineStats.active_hull_count.toString()} />
                <StatCard label="Flights In Progress" value={airlineStats.flights_in_progress.toString()} />
                <StatCard label="Avg Pilot Reputation"
                  value={airlineStats.avg_pilot_reputation ? Number(airlineStats.avg_pilot_reputation).toFixed(1) : '—'}
                  sub="out of 5.0" />
              </div>
              <div className="h-px bg-white/5" />
            </>
          )}

          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg">Top Pilots — {airlineStats?.airline?.icao_code}</h2>
            <span className="text-xs text-gray-500 border border-white/10 px-2 py-0.5 rounded-full">
              {WINDOWS.find(w => w.key === window)?.label}
            </span>
          </div>
          <LeaderboardTable entries={airlineBoard} loading={loading} />
        </div>
      )}

      {/* ── My Stats tab ── */}
      {activeTab === 'my' && myStats && (
        <div className="flex flex-col gap-6">
          <h2 className="font-bold text-lg">
            {myStats.pilot?.display_name} — Personal Stats
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Flights Completed" value={myStats.flights.toLocaleString()} />
            <StatCard label="Flight Hours" value={`${myStats.total_hours}h`} />
            <StatCard label="PAX Carried" value={(myStats.total_pax ?? 0).toLocaleString()} />
            <StatCard label="Avg PAX Happiness"
              value={myStats.avg_pax_happiness ? `${Number(myStats.avg_pax_happiness).toFixed(0)}%` : '—'} />
            <StatCard label="Reputation" value={Number(myStats.pilot?.reputation ?? 0).toFixed(1)} sub="out of 5.0" />
            <StatCard label="XP Points" value={(myStats.pilot?.xp_points ?? 0).toLocaleString()} />
            <StatCard label="Avg Landing VS"
              value={myStats.avg_landing_vs_fpm ? `${Math.round(Number(myStats.avg_landing_vs_fpm))} fpm` : '—'} />
            <StatCard label="Time Window" value={WINDOWS.find(w => w.key === window)?.label ?? ''} />
          </div>

          {/* Landing VS rating */}
          {myStats.avg_landing_vs_fpm !== null && (
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-bold mb-3 text-sm">Landing Quality</h3>
              <div className="flex items-center gap-4">
                <div className={cn('text-3xl font-bold font-mono', vsColor(Math.round(Number(myStats.avg_landing_vs_fpm))))}>
                  {Math.round(Number(myStats.avg_landing_vs_fpm))} fpm
                </div>
                <div className="text-sm text-gray-400">
                  {Math.abs(Number(myStats.avg_landing_vs_fpm)) <= 200
                    ? '✅ Smooth — butter landings'
                    : Math.abs(Number(myStats.avg_landing_vs_fpm)) <= 400
                    ? '⚠️ Firm — acceptable range'
                    : '❌ Hard — needs improvement'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'my' && loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="glass-card rounded-2xl h-24 animate-pulse" />)}
        </div>
      )}
    </div>
  );
}
