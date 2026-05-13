'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { onFlightStatus } from '@/lib/acars-bridge';
import { cn } from '@/lib/utils';

interface ActiveFlight {
  id: string;
  status: string;
  pax_count: number;
  cargo_kg: number;
  departed_at: string | null;
  taxi_at: string | null;
  takeoff_at: string | null;
  hull: { registration: string; aircraft_type: string; aircraft_category: string };
  route: {
    distance_nm: number;
    base_ticket_price: number;
    origin: { icao: string; name: string };
    destination: { icao: string; name: string };
  };
  airline: { name: string; icao_code: string } | null;
}

const STATUS_STEPS = [
  { key: 'BOARDING', label: 'Boarding' },
  { key: 'TAXI',     label: 'Taxi' },
  { key: 'TAKEOFF',  label: 'Takeoff' },
  { key: 'CLIMB',    label: 'Climb' },
  { key: 'CRUISE',   label: 'Cruise' },
  { key: 'DESCENT',  label: 'Descent' },
  { key: 'LANDED',   label: 'Landed' },
];

const STATUS_COLORS: Record<string, string> = {
  BOARDING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  TAXI:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  TAKEOFF:  'text-aero bg-aero/10 border-aero/20',
  CLIMB:    'text-aero bg-aero/10 border-aero/20',
  CRUISE:   'text-green-400 bg-green-500/10 border-green-500/20',
  DESCENT:  'text-aero bg-aero/10 border-aero/20',
  LANDED:   'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

export default function ActiveFlightPage() {
  const router = useRouter();
  const [flight, setFlight] = useState<ActiveFlight | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [newCert, setNewCert] = useState<string | null>(null);
  // SimBrief OFP
  const [ofp, setOfp] = useState<Record<string, unknown> | null>(null);
  const [ofpLoading, setOfpLoading] = useState(false);
  const [ofpError, setOfpError] = useState('');
  const [ofpSynced, setOfpSynced] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Initial load
    api.get('/flights/active')
      .then(r => setFlight(r.data))
      .finally(() => setLoading(false));

    // Instant update from ACARS WebSocket when FSM fires a transition
    const unsubscribe = onFlightStatus((status) => {
      setFlight(prev => prev ? { ...prev, status } : prev);
    });

    // Fallback poll every 10s — catches cases where ACARS isn't connected
    // or the page loaded after the last WebSocket status message
    pollRef.current = setInterval(() => {
      api.get('/flights/active').then(r => {
        if (r.data) setFlight(prev => prev ? { ...prev, status: r.data.status } : r.data);
      }).catch(() => {});
    }, 10_000);

    return () => {
      unsubscribe();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function generateFlightPlan() {
    if (!flight) return;
    setGeneratingPlan(true); setOfpError('');
    try {
      const { data } = await api.post('/integrations/simbrief/dispatch-url', {
        origin:       flight.route.origin.icao,
        destination:  flight.route.destination.icao,
        aircraft_icao: flight.hull.aircraft_type,
        registration: flight.hull.registration,
        airline_icao: flight.airline?.icao_code,
        pax_count:    flight.pax_count,
        cargo_kg:     flight.cargo_kg > 0 ? flight.cargo_kg : undefined,
      });
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setOfpError(msg ?? 'Could not generate SimBrief flight plan.');
    } finally { setGeneratingPlan(false); }
  }

  async function fetchOFP() {
    setOfpLoading(true); setOfpError(''); setOfpSynced(false);
    try {
      const { data } = await api.get('/integrations/simbrief/ofp');
      setOfp(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setOfpError(msg ?? 'Could not fetch OFP from SimBrief.');
    } finally { setOfpLoading(false); }
  }

  async function syncOFP() {
    if (!flight) return;
    setOfpLoading(true); setOfpError('');
    try {
      const { data } = await api.post(`/integrations/simbrief/sync/${flight.id}`);
      setOfp(data);
      setOfpSynced(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setOfpError(msg ?? 'Could not sync OFP to flight.');
    } finally { setOfpLoading(false); }
  }

  async function handleDispatch() {
    if (!flight) return;
    setDispatching(true); setError('');
    try {
      await api.patch(`/flights/${flight.id}/dispatch`);
      router.push('/dashboard/logbook');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Dispatch failed.');
    } finally { setDispatching(false); }
  }

  async function handleComplete() {
    if (!flight) return;
    setDispatching(true); setError('');
    try {
      const { data } = await api.patch(`/flights/${flight.id}/complete`, {
        pax_happiness: 85,
        block_time_min: Math.round(flight.route.distance_nm / 7.5),
        landing_vs_fpm: -150,
      });
      if (data?.new_certification) {
        setNewCert(data.new_certification);
        setTimeout(() => router.push('/dashboard/logbook'), 3500);
      } else {
        router.push('/dashboard/logbook');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Could not complete flight.');
    } finally { setDispatching(false); }
  }

  async function handleCancel() {
    if (!flight || !confirm(`Cancel flight ${flight.route.origin.icao} → ${flight.route.destination.icao}?`)) return;
    setCancelling(true); setError('');
    try {
      await api.patch(`/flights/${flight.id}/cancel`);
      setFlight(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Cancel failed.');
    } finally { setCancelling(false); }
  }

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  if (!flight) return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="glass-card rounded-2xl p-12 text-center">
        <p className="text-4xl mb-4">🌐</p>
        <h2 className="text-xl font-bold mb-2">No Active Flight</h2>
        <p className="text-gray-400 text-sm mb-6">You don&apos;t have a flight in progress right now.</p>
        <Link href="/dashboard/flights"
          className="bg-aero text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition text-sm">
          Book a Flight
        </Link>
      </div>
    </div>
  );

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === flight.status);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {newCert && (
        <div className="glass-card rounded-2xl p-5 mb-6 border border-purple-500/40 bg-purple-500/10 flex items-center gap-4 animate-pulse">
          <span className="text-3xl">🏅</span>
          <div>
            <p className="font-bold text-purple-300">Type Rating Earned!</p>
            <p className="text-sm text-purple-200 mt-0.5">{newCert} has been added to your certifications.</p>
          </div>
        </div>
      )}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Active Flight</h1>
          <p className="text-gray-400 text-sm">{flight.airline?.name ?? 'Your Airline'}</p>
        </div>
        <span className={cn('text-sm font-bold px-3 py-1.5 rounded-full border', STATUS_COLORS[flight.status] ?? 'text-gray-400 border-white/10')}>
          {flight.status}
        </span>
      </div>

      {/* Route card */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="font-mono text-3xl font-extrabold text-aero">{flight.route.origin.icao}</p>
            <p className="text-xs text-gray-400 mt-1">{flight.route.origin.name}</p>
          </div>
          <div className="flex flex-col items-center gap-1 text-gray-500">
            <span className="text-2xl">→</span>
            <span className="text-xs">{flight.route.distance_nm.toLocaleString()} nm</span>
          </div>
          <div className="text-center">
            <p className="font-mono text-3xl font-extrabold text-white">{flight.route.destination.icao}</p>
            <p className="text-xs text-gray-400 mt-1">{flight.route.destination.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            { label: 'Aircraft', value: `${flight.hull.registration}` },
            { label: 'Type', value: flight.hull.aircraft_type },
            { label: 'Passengers', value: flight.pax_count.toLocaleString() },
            { label: 'Departed', value: flight.departed_at ? new Date(flight.departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' },
          ].map(r => (
            <div key={r.label} className="glass-card rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">{r.label}</p>
              <p className="font-medium font-mono">{r.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Progress tracker */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Flight Progress</h3>
        <div className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done   = i < currentStepIdx;
            const active = i === currentStepIdx;
            const future = i > currentStepIdx;
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    done   ? 'bg-aero/30 border-aero' :
                    active ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/40' :
                             'bg-white/5 border-white/10'
                  )} />
                  <span className={cn('text-[10px] text-center leading-tight font-medium',
                    active ? 'text-green-400' :
                    done   ? 'text-aero/80' :
                             'text-gray-600')}>
                    {step.label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mb-5 mx-1 rounded-full transition-all',
                    done ? 'bg-aero/40' : 'bg-white/8'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SimBrief OFP Panel */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">SimBrief</h3>
            <p className="text-xs text-gray-600 mt-0.5">Flight planning &amp; OFP import</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={generateFlightPlan} disabled={generatingPlan}
              className="text-xs bg-aero text-black font-bold px-3 py-1.5 rounded-lg hover:brightness-110 transition disabled:opacity-50">
              {generatingPlan ? 'Opening…' : '📋 Generate Flight Plan'}
            </button>
            <button onClick={fetchOFP} disabled={ofpLoading}
              className="text-xs border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition text-gray-400 hover:text-white disabled:opacity-50">
              {ofpLoading ? 'Loading…' : ofp ? 'Refresh OFP' : 'Load OFP'}
            </button>
            {ofp && (
              <button onClick={syncOFP} disabled={ofpLoading}
                className={cn('text-xs border px-3 py-1.5 rounded-lg transition disabled:opacity-50',
                  ofpSynced
                    ? 'border-green-500/30 text-green-400 bg-green-500/10'
                    : 'border-aero/30 text-aero hover:bg-aero/10')}>
                {ofpSynced ? '✓ Synced' : 'Sync Weights →'}
              </button>
            )}
          </div>
        </div>

        {ofpError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">
            {ofpError}
            {ofpError.includes('username') && (
              <a href="/dashboard/profile" className="ml-2 text-aero underline">Set in Profile →</a>
            )}
          </p>
        )}

        {!ofp && !ofpError && (
          <p className="text-xs text-gray-600">
            Click <span className="text-white">Generate Flight Plan</span> to open SimBrief pre-filled with your flight details.
            Once generated, click <span className="text-white">Load OFP</span> to import the fuel and weight data.
          </p>
        )}

        {ofp && (() => {
          const o = ofp as {
            origin?: string; destination?: string; route?: string; cruise_altitude?: string;
            aircraft_icao?: string; registration?: string; flight_number?: string;
            block_fuel_kg?: number; trip_fuel_kg?: number; tow?: number; zfw?: number;
            payload_kg?: number; distance_nm?: number; est_block_time_min?: number;
            cruise_mach?: string; avg_wind_component?: string; alternate?: string;
            units?: string;
          };
          const fmt = (n: number | null | undefined, unit = 'kg') => n != null ? `${n.toLocaleString()} ${unit}` : '—';
          return (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="font-mono font-bold text-aero">{o.origin}</span>
                <span className="text-gray-500">→</span>
                <span className="font-mono font-bold text-white">{o.destination}</span>
                {o.alternate && <span className="text-xs text-gray-500">ALT: <span className="font-mono">{o.alternate}</span></span>}
                {o.flight_number && <span className="font-mono text-xs border border-aero/30 text-aero px-1.5 py-0.5 rounded">{o.flight_number}</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                {[
                  { label: 'Block Fuel', value: fmt(o.block_fuel_kg) },
                  { label: 'Trip Fuel', value: fmt(o.trip_fuel_kg) },
                  { label: 'TOW', value: fmt(o.tow) },
                  { label: 'ZFW', value: fmt(o.zfw) },
                  { label: 'Payload', value: fmt(o.payload_kg) },
                  { label: 'Distance', value: o.distance_nm ? `${o.distance_nm.toLocaleString()} nm` : '—' },
                  { label: 'Block Time', value: o.est_block_time_min ? `${Math.floor(o.est_block_time_min / 60)}h ${o.est_block_time_min % 60}m` : '—' },
                  { label: 'Cruise', value: [o.cruise_altitude, o.cruise_mach].filter(Boolean).join(' · ') || '—' },
                ].map(row => (
                  <div key={row.label} className="glass-card rounded-xl p-2.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{row.label}</p>
                    <p className="text-sm font-mono font-medium">{row.value}</p>
                  </div>
                ))}
              </div>
              {o.route && (
                <div className="glass-card rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Route</p>
                  <p className="font-mono text-xs text-gray-300 break-all leading-relaxed">{o.route}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 mb-4 border border-red-500/20 bg-red-500/5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">

        {/* ACARS status banner — shown once flight is underway */}
        {flight.status !== 'BOARDING' && (
          <div className="glass-card rounded-xl p-4 flex items-center gap-3 border border-aero/20">
            <span className="text-aero text-lg">🖥️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-aero">ACARS is controlling this flight</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Flight status, phase detection, and completion are handled automatically by the ACARS desktop client.
                Open ACARS to monitor your flight.
              </p>
            </div>
          </div>
        )}

        {/* Dispatch — only shown at BOARDING, starts the flight clock */}
        {flight.status === 'BOARDING' && (
          <div className="flex gap-3">
            <button onClick={handleDispatch} disabled={dispatching}
              className="flex-1 bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
              {dispatching ? 'Dispatching…' : '🛫 Ready to Taxi — Start Flight'}
            </button>
          </div>
        )}

        {/* Cancel — always available regardless of status */}
        <button onClick={handleCancel} disabled={cancelling}
          className="w-full border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold py-2.5 rounded-xl transition text-sm disabled:opacity-50">
          {cancelling ? 'Cancelling…' : 'Cancel Flight'}
        </button>
      </div>
    </div>
  );
}
