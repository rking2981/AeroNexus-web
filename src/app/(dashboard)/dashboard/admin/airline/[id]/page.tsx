'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import RechartsCharts from '@/app/(dashboard)/dashboard/airline/charts';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AirlineDetail {
  id: string; name: string; icao_code: string; iata_code: string | null;
  hub_country: string | null; subscription_tier: string; subscription_status: string;
  balance: string; earned_balance: string; currency_code: string; currency_symbol: string;
  flight_multiplier: number; multiplier_mode: string; created_at: string;
  trial_days_left: number | null; trial_expired: boolean;
  _count: { users: number; hulls: number; flights: number; routes: number };
}

interface Hull {
  id: string; registration: string; aircraft_type: string; aircraft_category: string;
  status: string; airframe_hours: string; engine_wear_percent: string;
  current_airport_icao: string | null;
  aircraft_type_rel: { name: string; manufacturer: string; pax_capacity: number } | null;
}

interface Route {
  id: string; status: string; distance_nm: number; aircraft_type: string;
  base_ticket_price: string; flight_number: string | null; route_type: string;
  origin: { icao: string; name: string; city: string; country: string };
  destination: { icao: string; name: string; city: string; country: string };
}

interface CrewMember {
  id: string; display_name: string; email: string; role: string;
  reputation: string; xp_points: number; current_airport_icao: string | null;
  va_rank: string | null; pilot_tier: string; is_founder: boolean;
  is_suspended: boolean; created_at: string;
  _count: { flights: number };
}

interface Transaction {
  id: string; amount: string; description: string | null;
  expense_type: string | null; created_at: string;
}

interface RecentFlight {
  id: string; from: string; to: string; arrived_at: string;
  pax: number; aircraft_type: string; distance_nm: number; pilot: string;
  pax_happiness: number; landing_vs_fpm: number | null;
  grade: string | null; score: number | null; revenue: number;
}

interface OverviewCharts {
  daily_revenue: Record<string, number>;
  cargo_by_type: { type: string; revenue: number; count: number }[];
  top_routes: { route: string; flights: number }[];
  expenses_by_type?: { type: string; amount: number }[];
}

interface FinancesData {
  revenue: number; expenses: number; net: number;
  airline: { balance: string; earned_balance: string; currency_code: string; currency_symbol: string } | null;
  transactions: Transaction[];
}

// ─── Helper components ──────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray' }) {
  const s = {
    green:  'text-green-400 border-green-500/20 bg-green-500/10',
    amber:  'text-amber-400 border-amber-500/20 bg-amber-500/10',
    red:    'text-red-400 border-red-500/20 bg-red-500/10',
    blue:   'text-blue-400 border-blue-500/20 bg-blue-500/10',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    gray:   'text-gray-400 border-white/10 bg-white/5',
  };
  return <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', s[color])}>{label}</span>;
}

function tierColor(t: string): 'purple' | 'blue' | 'gray' {
  return t === 'FOUNDERS' ? 'purple' : t === 'ENTERPRISE' ? 'blue' : 'gray';
}
function statusColor(s: string): 'green' | 'amber' | 'red' | 'gray' {
  return s === 'ACTIVE' ? 'green' : s === 'TRIALING' || s === 'PAST_DUE' ? 'amber' : s === 'CANCELED' ? 'red' : 'gray';
}
function wearColor(pct: number): string {
  if (pct >= 80) return 'text-red-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-green-400';
}

function fmt(n: number, sym = '$'): string {
  return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'fleet' | 'routes' | 'crew' | 'finances';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview',  label: 'Overview',  icon: '🏢' },
  { key: 'fleet',     label: 'Fleet',     icon: '✈️' },
  { key: 'routes',    label: 'Routes',    icon: '🌐' },
  { key: 'crew',      label: 'Crew',      icon: '👥' },
  { key: 'finances',  label: 'Finances',  icon: '💰' },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminAirlinePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const airlineId = params.id as string;

  const [tab, setTab] = useState<Tab>('overview');
  const [airline, setAirline] = useState<AirlineDetail | null>(null);
  const [fleet, setFleet] = useState<Hull[] | null>(null);
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [crew, setCrew] = useState<CrewMember[] | null>(null);
  const [finances, setFinances] = useState<FinancesData | null>(null);
  const [recentFlights, setRecentFlights] = useState<RecentFlight[]>([]);
  const [overviewCharts, setOverviewCharts] = useState<OverviewCharts | null>(null);
  const [showAllFlights, setShowAllFlights] = useState(false);
  const [allFlightsLoading, setAllFlightsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'PLATFORM_ADMIN') router.replace('/dashboard');
  }, [user, router]);

  useEffect(() => {
    api.get(`/admin/airlines/${airlineId}`)
      .then(r => setAirline(r.data))
      .finally(() => setLoading(false));
    api.get(`/admin/airlines/${airlineId}/overview`)
      .then(r => {
        setRecentFlights(r.data.recent_flights ?? []);
        setOverviewCharts(r.data.charts ?? null);
      })
      .catch(() => {});
  }, [airlineId]);

  const loadTab = useCallback(async (t: Tab) => {
    if (t === 'fleet' && !fleet) {
      const r = await api.get(`/admin/airlines/${airlineId}/fleet`);
      setFleet(r.data);
    } else if (t === 'routes' && !routes) {
      const r = await api.get(`/admin/airlines/${airlineId}/routes`);
      setRoutes(r.data);
    } else if (t === 'crew' && !crew) {
      const r = await api.get(`/admin/airlines/${airlineId}/crew`);
      setCrew(r.data);
    } else if (t === 'finances' && !finances) {
      const r = await api.get(`/admin/airlines/${airlineId}/finances`);
      setFinances(r.data);
    }
  }, [airlineId, fleet, routes, crew, finances]);

  function switchTab(t: Tab) {
    setTab(t);
    loadTab(t);
  }

  if (!user || user.role !== 'PLATFORM_ADMIN') return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => window.close()} className="text-gray-500 hover:text-white transition text-sm border border-white/10 px-3 py-1.5 rounded-lg">
          ✕ Close
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-400 border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 rounded-full font-bold">ADMIN VIEW</span>
          {loading && <span className="text-xs text-gray-500">Loading…</span>}
          {airline && (
            <>
              <h1 className="text-2xl font-bold text-white">{airline.name}</h1>
              <span className="font-mono text-sm text-aero border border-aero/20 px-2 py-0.5 rounded">{airline.icao_code}</span>
              <Badge label={airline.subscription_tier} color={tierColor(airline.subscription_tier)} />
              <Badge label={airline.subscription_status} color={statusColor(airline.subscription_status)} />
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 glass-card rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && airline && (
        <div className="flex flex-col gap-6">
          {/* Trial banner */}
          {airline.trial_days_left !== null && (
            <div className={cn('rounded-2xl p-4 border text-sm',
              airline.trial_expired
                ? 'bg-red-500/5 border-red-500/20 text-red-400'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-400')}>
              {airline.trial_expired ? 'Trial expired' : `Trial active — ${airline.trial_days_left} day${airline.trial_days_left !== 1 ? 's' : ''} remaining`}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Balance', value: `${airline.currency_symbol}${Number(airline.balance).toLocaleString()}`, icon: '💰' },
              { label: 'Earned Total', value: `${airline.currency_symbol}${Number(airline.earned_balance).toLocaleString()}`, icon: '📈' },
              { label: 'Pilots', value: airline._count.users, icon: '👤' },
              { label: 'Fleet', value: airline._count.hulls, icon: '✈️' },
              { label: 'Routes', value: airline._count.routes, icon: '🌐' },
              { label: 'Flights', value: airline._count.flights, icon: '📋' },
              { label: 'Multiplier', value: `${airline.flight_multiplier}× (${airline.multiplier_mode})`, icon: '⚡' },
              { label: 'Currency', value: airline.currency_code, icon: '💱' },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-2xl p-5 text-center">
                <p className="text-2xl mb-2">{s.icon}</p>
                <p className="text-lg font-bold text-aero">{String(s.value)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="glass-card rounded-2xl p-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Airline Info</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['ICAO', airline.icao_code],
                ['IATA', airline.iata_code ?? '—'],
                ['Hub Country', airline.hub_country ?? '—'],
                ['Member Since', new Date(airline.created_at).toLocaleDateString()],
                ['Subscription', `${airline.subscription_tier} / ${airline.subscription_status}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <RechartsCharts
            charts={overviewCharts ?? { daily_revenue: {}, cargo_by_type: [], top_routes: [] }}
            currencySymbol={airline.currency_symbol}
          />

          {/* Recent flights */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                {showAllFlights ? 'All Flights' : 'Flights — Last 7 Days'}
              </p>
            </div>
            {recentFlights.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-600 text-sm">No completed flights in the last 7 days.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['From', 'To', 'Arrival', 'PAX', 'A/C', 'Dist.', 'PIC', 'Rating', 'Income'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentFlights.map((f, i) => (
                      <tr key={f.id} className={cn('border-b border-white/5 hover:bg-white/3 transition', i % 2 !== 0 ? 'bg-white/1' : '')}>
                        <td className="px-4 py-2.5 font-mono text-aero text-xs font-bold">{f.from}</td>
                        <td className="px-4 py-2.5 font-mono text-white text-xs font-bold">{f.to}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                          {f.arrived_at ? new Date(f.arrived_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-300">{f.pax}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{f.aircraft_type}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{f.distance_nm.toLocaleString()} nm</td>
                        <td className="px-4 py-2.5 text-xs text-gray-300 whitespace-nowrap max-w-32 truncate">{f.pilot}</td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          {f.grade ? (
                            <span className={cn('font-bold', f.grade === 'S' ? 'text-[#00D1FF]' : f.grade === 'A' ? 'text-green-400' : f.grade === 'B' ? 'text-lime-400' : f.grade === 'C' ? 'text-amber-400' : 'text-red-400')}>
                              {f.grade}{f.score !== null ? ` (${f.score}%)` : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">PAX {Math.round(f.pax_happiness)}%</span>
                          )}
                        </td>
                        <td className={cn('px-4 py-2.5 text-xs font-mono font-bold whitespace-nowrap', f.revenue < 0 ? 'text-red-400' : 'text-green-400')}>
                          {f.revenue < 0 ? '-' : ''}{airline.currency_symbol}{Math.abs(f.revenue).toLocaleString('en-US', { minimumFractionDigits: Math.abs(f.revenue) % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              onClick={async () => {
                if (showAllFlights) {
                  setShowAllFlights(false);
                  const r = await api.get(`/admin/airlines/${airlineId}/overview`);
                  setRecentFlights(r.data.recent_flights ?? []);
                } else {
                  setAllFlightsLoading(true);
                  try {
                    const r = await api.get(`/admin/airlines/${airlineId}/overview?all=true`);
                    setRecentFlights(r.data.recent_flights ?? []);
                    setShowAllFlights(true);
                  } finally {
                    setAllFlightsLoading(false);
                  }
                }
              }}
              disabled={allFlightsLoading}
              className="w-full py-3 text-xs text-aero hover:text-white border-t border-white/5 transition disabled:opacity-50"
            >
              {allFlightsLoading ? 'Loading…' : showAllFlights ? '▲ Show Less' : '▼ View All Flights'}
            </button>
          </div>
        </div>
      )}

      {/* Fleet */}
      {tab === 'fleet' && (
        !fleet ? <div className="glass-card rounded-2xl h-48 animate-pulse" /> : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500">{fleet.length} aircraft</p>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="grid px-4 py-2.5 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest"
                style={{ gridTemplateColumns: '100px 1fr 80px 100px 80px 80px 100px' }}>
                <span>Reg</span><span>Type</span><span>Cat</span><span>Status</span>
                <span className="text-right">Hours</span><span className="text-right">Wear</span><span className="text-right">Location</span>
              </div>
              {fleet.map(h => (
                <div key={h.id} className="grid px-4 py-3 border-b border-white/5 last:border-0 items-center gap-2 text-sm"
                  style={{ gridTemplateColumns: '100px 1fr 80px 100px 80px 80px 100px' }}>
                  <span className="font-mono font-bold text-aero">{h.registration}</span>
                  <span className="text-white truncate">{h.aircraft_type_rel?.name ?? h.aircraft_type}</span>
                  <span className="text-xs text-gray-400">{h.aircraft_category}</span>
                  <Badge label={h.status}
                    color={h.status === 'ACTIVE' ? 'green' : h.status === 'MAINTENANCE' ? 'amber' : h.status === 'REPOSSESSED' ? 'red' : 'gray'} />
                  <span className="text-right font-mono text-gray-300">{Math.round(Number(h.airframe_hours))}h</span>
                  <span className={cn('text-right font-mono text-sm', wearColor(Number(h.engine_wear_percent)))}>
                    {Math.round(Number(h.engine_wear_percent))}%
                  </span>
                  <span className="text-right font-mono text-xs text-gray-400">{h.current_airport_icao ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Routes */}
      {tab === 'routes' && (
        !routes ? <div className="glass-card rounded-2xl h-48 animate-pulse" /> : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500">{routes.length} routes</p>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="grid px-4 py-2.5 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest"
                style={{ gridTemplateColumns: '80px 80px 80px 1fr 80px 80px 100px' }}>
                <span>Flight#</span><span>Origin</span><span>Dest</span><span>Aircraft</span>
                <span className="text-right">Dist</span><span className="text-right">Price</span><span className="text-right">Status</span>
              </div>
              {routes.map(r => (
                <div key={r.id} className="grid px-4 py-3 border-b border-white/5 last:border-0 items-center gap-2 text-sm"
                  style={{ gridTemplateColumns: '80px 80px 80px 1fr 80px 80px 100px' }}>
                  <span className="font-mono text-xs text-gray-400">{r.flight_number ?? '—'}</span>
                  <span className="font-mono font-bold text-aero">{r.origin.icao}</span>
                  <span className="font-mono font-bold text-white">{r.destination.icao}</span>
                  <span className="text-xs text-gray-300 truncate">{r.aircraft_type}</span>
                  <span className="text-right font-mono text-gray-300">{r.distance_nm.toLocaleString()}</span>
                  <span className="text-right font-mono text-green-400">${Number(r.base_ticket_price).toLocaleString()}</span>
                  <div className="flex justify-end">
                    <Badge label={r.status} color={r.status === 'ACTIVE' ? 'green' : r.status === 'SUSPENDED' ? 'amber' : 'gray'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Crew */}
      {tab === 'crew' && (
        !crew ? <div className="glass-card rounded-2xl h-48 animate-pulse" /> : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500">{crew.length} crew members</p>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="grid px-4 py-2.5 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest"
                style={{ gridTemplateColumns: '1fr 120px 80px 80px 80px 80px 80px' }}>
                <span>Pilot</span><span>Rank</span><span>Role</span><span>Tier</span>
                <span className="text-right">Rep</span><span className="text-right">Flights</span><span className="text-right">Location</span>
              </div>
              {crew.map(p => (
                <div key={p.id} className="grid px-4 py-3 border-b border-white/5 last:border-0 items-center gap-2 text-sm"
                  style={{ gridTemplateColumns: '1fr 120px 80px 80px 80px 80px 80px' }}>
                  <div>
                    <p className="text-white font-medium">{p.display_name}</p>
                    <p className="text-xs text-gray-500">{p.email}</p>
                  </div>
                  <span className="text-xs text-gray-300">{p.va_rank ?? 'No rank'}</span>
                  <Badge label={p.role} color={p.role === 'VA_MANAGER' ? 'blue' : 'gray'} />
                  <Badge label={p.pilot_tier} color={p.pilot_tier === 'PRO_SUB' ? 'purple' : 'gray'} />
                  <span className="text-right font-mono text-aero">{Number(p.reputation).toFixed(1)}</span>
                  <span className="text-right font-mono text-gray-300">{p._count.flights}</span>
                  <span className="text-right font-mono text-xs text-gray-400">{p.current_airport_icao ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Finances */}
      {tab === 'finances' && (
        !finances ? <div className="glass-card rounded-2xl h-48 animate-pulse" /> : (
          <div className="flex flex-col gap-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Revenue', value: fmt(finances.revenue, finances.airline?.currency_symbol ?? '$'), color: 'text-green-400' },
                { label: 'Total Expenses', value: fmt(finances.expenses, finances.airline?.currency_symbol ?? '$'), color: 'text-red-400' },
                { label: 'Net P&L', value: fmt(finances.net, finances.airline?.currency_symbol ?? '$'), color: finances.net >= 0 ? 'text-green-400' : 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="glass-card rounded-2xl p-6 text-center">
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Transactions */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest flex justify-between">
                <span>Transactions (last 200)</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {finances.transactions.map(t => (
                  <div key={t.id} className="px-4 py-3 border-b border-white/5 last:border-0 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="text-white text-xs truncate">{t.description ?? t.expense_type ?? 'Transaction'}</p>
                      <p className="text-gray-500 text-[10px]">{new Date(t.created_at).toLocaleString()}</p>
                    </div>
                    <span className={cn('font-mono font-bold flex-shrink-0 text-sm',
                      Number(t.amount) >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {Number(t.amount) >= 0 ? '+' : ''}{fmt(Number(t.amount), finances.airline?.currency_symbol ?? '$')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
