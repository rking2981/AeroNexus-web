'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import RechartsCharts from './charts';

interface Airline {
  id: string;
  name: string;
  icao_code: string;
  iata_code: string | null;
  hub_country: string | null;
  balance: number;
  currency_code: string;
  currency_symbol: string;
  subscription_tier: string;
  subscription_status: string;
  branding: Record<string, string> | null;
  trial_days_left: number | null;
  trial_expired: boolean;
  trial_expires_at: string | null;
}

interface RecentFlight {
  id: string;
  from: string;
  to: string;
  arrived_at: string;
  pax: number;
  aircraft_type: string;
  distance_nm: number;
  pilot: string;
  pax_happiness: number;
  landing_vs_fpm: number | null;
  grade: string | null;
  score: number | null;
  revenue: number;
}

interface Charts {
  daily_revenue: Record<string, number>;
  cargo_by_type: { type: string; revenue: number; count: number }[];
  top_routes: { route: string; flights: number }[];
}

interface LiveFlight {
  id: string;
  status: string;
  pax_count: number;
  hull: { registration: string; aircraft_type: string };
  pilot: { id: string; display_name: string; sayintentions_api_key: string | null; sayintentions_verified: boolean };
  route: { origin: { icao: string; name: string }; destination: { icao: string; name: string }; distance_nm: number };
}

const QUICK_MESSAGES = [
  'ATIS updated at destination — check before descent',
  'Expect delays at destination — hold if able',
  'Fuel prices elevated — consider alternate',
  'Smooth flight, well done',
  'Weather improving at destination',
];

function DispatchPanel() {
  const [flights, setFlights] = useState<LiveFlight[]>([]);
  const [selected, setSelected] = useState<LiveFlight | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/flights/airline-live')
      .then(r => setFlights(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    const iv = setInterval(() => {
      api.get('/flights/airline-live').then(r => setFlights(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  async function send() {
    if (!selected || !message.trim() || sending) return;
    setSending(true); setResult(null);
    try {
      const { data } = await api.post('/integrations/cpdlc/send', {
        pilot_user_id: selected.pilot.id,
        message: message.trim(),
        from: 'AERONEXUS DISPATCH',
      });
      if (data.ok) {
        setResult({ ok: true, msg: `Sent to ${selected.pilot.display_name}` });
        setMessage('');
        setTimeout(() => setResult(null), 4000);
      } else {
        setResult({ ok: false, msg: data.error ?? 'Send failed' });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setResult({ ok: false, msg: msg ?? 'Send failed' });
    } finally { setSending(false); }
  }

  if (loading) return null;
  if (flights.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg">Dispatch</h2>
          <p className="text-xs text-gray-500">{flights.length} active flight{flights.length !== 1 ? 's' : ''} · Send CPDLC to pilots via SayIntentions</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </span>
      </div>

      {/* Active flights */}
      <div className="flex flex-col gap-2 mb-4">
        {flights.map(f => (
          <button
            key={f.id}
            onClick={() => setSelected(s => s?.id === f.id ? null : f)}
            className={cn(
              'flex items-center justify-between px-4 py-3 rounded-xl border text-left transition',
              selected?.id === f.id
                ? 'border-aero/40 bg-aero/5'
                : 'border-white/5 bg-white/2 hover:bg-white/5'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-aero w-16">{f.hull.registration}</span>
              <span className="text-sm font-medium">{f.route.origin.icao} → {f.route.destination.icao}</span>
              <span className="text-xs text-gray-500">{f.pilot.display_name}</span>
            </div>
            <div className="flex items-center gap-2">
              {!f.pilot.sayintentions_api_key && (
                <span className="text-[10px] text-amber-400 border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 rounded-full">No SI key</span>
              )}
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                f.status === 'CRUISE' ? 'text-aero border-aero/20 bg-aero/5' :
                f.status === 'CLIMB'  ? 'text-green-400 border-green-500/20 bg-green-500/5' :
                'text-gray-400 border-white/10 bg-white/5'
              )}>{f.status}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Message compose */}
      {selected && (
        <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
          <p className="text-xs text-gray-400">
            Sending CPDLC to <span className="text-white font-medium">{selected.pilot.display_name}</span>
            {!selected.pilot.sayintentions_api_key && (
              <span className="text-amber-400 ml-2">— pilot has no SayIntentions key, message will not deliver</span>
            )}
          </p>

          {/* Quick messages */}
          <div className="flex flex-wrap gap-2">
            {QUICK_MESSAGES.map(q => (
              <button key={q} onClick={() => setMessage(q)}
                className="text-[10px] border border-white/10 bg-white/5 px-2.5 py-1 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white">
                {q}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 128))}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type CPDLC message… (max 128 chars)"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white font-mono focus:border-aero focus:outline-none transition"
            />
            <button
              onClick={send}
              disabled={sending || !message.trim()}
              className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 flex-shrink-0"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>

          {result && (
            <p className={cn('text-xs px-3 py-2 rounded-lg border', result.ok
              ? 'text-green-400 bg-green-500/10 border-green-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20')}>
              {result.ok ? '✓ ' : '✗ '}{result.msg}
            </p>
          )}
          <p className="text-[10px] text-gray-600">{message.length} / 128 characters</p>
        </div>
      )}
    </div>
  );
}

function formatRevenue(v: number, symbol: string): string {
  const abs = Math.abs(v);
  const hascents = abs % 1 !== 0;
  const formatted = `${symbol}${abs.toLocaleString('en-US', { minimumFractionDigits: hascents ? 2 : 0, maximumFractionDigits: 2 })}`;
  return v < 0 ? `-${formatted}` : formatted;
}

function gradeColor(grade: string | null) {
  switch (grade) {
    case 'S': return 'text-[#00D1FF]';
    case 'A': return 'text-green-400';
    case 'B': return 'text-lime-400';
    case 'C': return 'text-amber-400';
    case 'D': return 'text-orange-400';
    case 'F': return 'text-red-400';
    default:  return 'text-gray-500';
  }
}


export default function AirlinePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [airline, setAirline] = useState<Airline | null>(null);
  const [recentFlights, setRecentFlights] = useState<RecentFlight[]>([]);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [allFlightsLoading, setAllFlightsLoading] = useState(false);

  useEffect(() => {
    if (!user?.airline_id) {
      router.replace('/dashboard/airline/create');
      return;
    }
    api.get('/airline')
      .then(r => setAirline(r.data))
      .catch(() => router.replace('/dashboard/airline/create'))
      .finally(() => setLoading(false));

    api.get('/airline/overview')
      .then(r => {
        setRecentFlights(r.data.recent_flights ?? []);
        setCharts(r.data.charts ?? null);
      })
      .catch(() => {}); // charts are non-critical — fail silently
  }, [user, router]);

  if (loading) return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <div className="glass-card rounded-2xl h-24 animate-pulse" />
      <div className="glass-card rounded-2xl h-48 animate-pulse" />
      <div className="glass-card rounded-2xl h-64 animate-pulse" />
    </div>
  );

  if (!airline) return null;

  const sym = airline.currency_symbol;

  const tierColor = {
    FOUNDERS: 'text-purple-400',
    ENTERPRISE: 'text-aero',
    STARTUP: 'text-gray-400',
  }[airline.subscription_tier] ?? 'text-gray-400';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">{airline.name}</h1>
          <p className="text-gray-400 text-sm flex items-center gap-3">
            <span className="font-mono">{airline.icao_code}</span>
            {airline.iata_code && <span className="font-mono">{airline.iata_code}</span>}
            {airline.hub_country && <span>{airline.hub_country}</span>}
            <span className={`font-bold ${tierColor}`}>{airline.subscription_tier}</span>
          </p>
        </div>
        <Link href="/dashboard/airline/settings" className="glass-card px-4 py-2 rounded-xl text-sm hover:bg-white/5 transition">
          Settings
        </Link>
      </div>

      {/* Trial banner */}
      {airline.trial_days_left !== null && (
        <div className={`mb-6 rounded-2xl p-4 flex items-center justify-between gap-4 border ${
          airline.trial_expired ? 'bg-red-500/10 border-red-500/30'
          : airline.trial_days_left <= 2 ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-aero/5 border-aero/20'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{airline.trial_expired ? '🔒' : '⏳'}</span>
            <div>
              <p className={`text-sm font-bold ${airline.trial_expired ? 'text-red-400' : airline.trial_days_left <= 2 ? 'text-amber-400' : 'text-aero'}`}>
                {airline.trial_expired ? 'Your free trial has expired'
                  : `Free trial — ${airline.trial_days_left} day${airline.trial_days_left !== 1 ? 's' : ''} remaining`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {airline.trial_expired ? 'Subscribe to restore access to airline management features.'
                  : 'Subscribe before your trial ends to keep access to all features.'}
              </p>
            </div>
          </div>
          <Link href="/dashboard/founders" className={`flex-shrink-0 font-bold text-sm px-4 py-2 rounded-xl transition ${
            airline.trial_expired ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-aero text-black hover:brightness-110'
          }`}>
            Subscribe →
          </Link>
        </div>
      )}

      {/* Balance + quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass-card rounded-2xl p-6 md:col-span-1">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Airline Balance</p>
          <p className="text-3xl font-bold text-aero">
            {sym}{Number(airline.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span className="text-sm text-gray-500 ml-2">{airline.currency_code}</span>
          </p>
        </div>
        <div className="md:col-span-2 grid grid-cols-3 gap-3">
          {[
            { href: '/dashboard/fleet', label: 'Fleet', icon: '🛩️' },
            { href: '/dashboard/network', label: 'Routes', icon: '🌐' },
            { href: '/dashboard/crew', label: 'Crew', icon: '👥' },
            { href: '/dashboard/finances', label: 'Finances', icon: '💰' },
            { href: '/dashboard/promotions', label: 'Promotions', icon: '📢' },
            { href: '/dashboard/airline/settings', label: 'Branding', icon: '🎨' },
          ].map(item => (
            <Link key={item.href} href={item.href} className="glass-card rounded-xl p-3 hover:bg-white/5 transition group text-center">
              <div className="text-lg mb-1">{item.icon}</div>
              <p className="text-xs font-medium group-hover:text-aero transition">{item.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="mb-8">
        <RechartsCharts
          charts={charts ?? { daily_revenue: {}, cargo_by_type: [], top_routes: [] }}
          currencySymbol={sym}
        />
      </div>

      {/* Dispatch panel — only shown when pilots are flying */}
      <DispatchPanel />

      {/* Recent flights table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
            {showAll ? 'All Flights' : 'Flights — Last 7 Days'}
          </p>
        </div>
        {recentFlights.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-600 text-sm">No completed flights in the last 7 days.</div>
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
                {recentFlights.map((f, i) => {
                  const isNegative = f.revenue < 0;
                  return (
                    <tr key={f.id} className={cn('border-b border-white/5 hover:bg-white/3 transition', i % 2 === 0 ? '' : 'bg-white/1')}>
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
                          <span className={cn('font-bold', gradeColor(f.grade))}>
                            {f.grade} {f.score !== null ? `(${f.score}%)` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400">PAX {Math.round(f.pax_happiness)}%</span>
                        )}
                      </td>
                      <td className={cn('px-4 py-2.5 text-xs font-mono font-bold whitespace-nowrap', isNegative ? 'text-red-400' : 'text-green-400')}>
                        {formatRevenue(f.revenue, airline.currency_symbol)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* View All / Show Less footer */}
        <button
          onClick={async () => {
            if (showAll) {
              // Collapse — reload 7-day view
              setShowAll(false);
              const r = await api.get('/airline/overview');
              setRecentFlights(r.data.recent_flights ?? []);
            } else {
              // Expand — fetch all flights
              setAllFlightsLoading(true);
              try {
                const r = await api.get('/airline/overview?all=true');
                setRecentFlights(r.data.recent_flights ?? []);
                setShowAll(true);
              } finally {
                setAllFlightsLoading(false);
              }
            }
          }}
          disabled={allFlightsLoading}
          className="w-full py-3 text-xs text-aero hover:text-white border-t border-white/5 transition disabled:opacity-50"
        >
          {allFlightsLoading ? 'Loading…' : showAll ? '▲ Show Less' : '▼ View All Flights'}
        </button>
      </div>
    </div>
  );
}
