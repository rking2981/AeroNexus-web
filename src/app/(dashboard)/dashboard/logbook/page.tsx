'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AdSenseUnit } from '@/components/shared/AdSenseUnit';

import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const FlightTrackMap = dynamic(
  () => import('@/components/FlightTrackMap').then((m) => m.FlightTrackMap),
  { ssr: false, loading: () => <div className="h-64 rounded-xl bg-white/5 animate-pulse" /> },
);

interface Flight {
  id: string;
  status: string;
  pax_count: number;
  pax_happiness: number;
  landing_vs_fpm: number | null;
  block_time_min: number | null;
  fuel_used_kg: string | null;
  max_g_force: string | null;
  landing_type: string;
  departed_at: string | null;
  arrived_at: string | null;
  takeoff_at: string | null;
  landed_at: string | null;
  hull: { registration: string; aircraft_type: string; aircraft_category: string };
  route: {
    distance_nm: number;
    base_ticket_price: number;
    origin: { icao: string; name: string; city: string | null; country: string };
    destination: { icao: string; name: string; city: string | null; country: string };
  };
  airline: { name: string; icao_code: string } | null;
}

interface TrackPoint {
  lat: string;
  lon: string;
  alt_ft: number | null;
  hdg: number | null;
  spd_kts: number | null;
  recorded_at: string;
}

interface TrackData {
  id: string;
  status: string;
  track_points: TrackPoint[];
  route: {
    origin: { icao: string; latitude: string; longitude: string };
    destination: { icao: string; latitude: string; longitude: string };
  };
}

function HappinessBar({ value }: { value: number }) {
  const color = value >= 85 ? 'bg-green-500' : value >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className={cn('text-xs font-mono', value >= 85 ? 'text-green-400' : value >= 70 ? 'text-amber-400' : 'text-red-400')}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

function vsColor(fpm: number) {
  const abs = Math.abs(fpm);
  if (abs <= 200) return 'text-green-400';
  if (abs <= 400) return 'text-amber-400';
  return 'text-red-400';
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

// ─── Flight detail panel ──────────────────────────────────────────────────────

function FlightDetail({ flight, onClose }: { flight: Flight; onClose: () => void }) {
  const [track, setTrack] = useState<TrackData | null>(null);
  const [trackLoading, setTrackLoading] = useState(true);

  useEffect(() => {
    api.get(`/flights/${flight.id}/track`)
      .then((r) => setTrack(r.data))
      .catch(() => setTrack(null))
      .finally(() => setTrackLoading(false));
  }, [flight.id]);

  const isCompleted = flight.status === 'COMPLETED';
  const grossRevenue = isCompleted
    ? (flight.route.base_ticket_price * flight.pax_count)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xl text-aero">{flight.route.origin.icao}</span>
              <span className="text-gray-500">→</span>
              <span className="font-mono font-bold text-xl">{flight.route.destination.icao}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {flight.route.origin.name} → {flight.route.destination.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition text-xl leading-none">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Map */}
          {trackLoading ? (
            <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
          ) : track ? (
            <FlightTrackMap
              origin={track.route.origin}
              destination={track.route.destination}
              trackPoints={track.track_points}
              height="280px"
            />
          ) : null}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Date', value: formatDate(flight.arrived_at ?? flight.departed_at) },
              { label: 'Operated By', value: flight.airline ? `${flight.airline.name} (${flight.airline.icao_code})` : '—' },
              { label: 'Aircraft', value: `${flight.hull.registration} · ${flight.hull.aircraft_type}` },
              { label: 'Category', value: flight.hull.aircraft_category.replace('_', ' ') },
              { label: 'Distance', value: `${flight.route.distance_nm.toLocaleString()} nm` },
              { label: 'Landing Type', value: flight.landing_type.replace('_', ' ') },
            ].map((r) => (
              <div key={r.label} className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">{r.label}</p>
                <p className="text-sm font-medium">{r.value}</p>
              </div>
            ))}
          </div>

          {/* Times */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Departed', value: formatTime(flight.departed_at) },
              { label: 'Takeoff', value: formatTime(flight.takeoff_at) },
              { label: 'Landed', value: formatTime(flight.landed_at) },
              { label: 'Arrived', value: formatTime(flight.arrived_at) },
            ].map((r) => (
              <div key={r.label} className="text-center">
                <p className="text-xs text-gray-500 mb-0.5">{r.label}</p>
                <p className="text-sm font-mono font-bold">{r.value}</p>
              </div>
            ))}
          </div>

          {/* Flight stats */}
          {isCompleted && (
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Block Time</p>
                <p className="text-sm font-mono font-bold">{flight.block_time_min ? formatDuration(flight.block_time_min) : '—'}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">PAX</p>
                <p className="text-sm font-mono font-bold">{flight.pax_count}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-2">PAX Happiness</p>
                <HappinessBar value={Number(flight.pax_happiness)} />
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Landing VS</p>
                {flight.landing_vs_fpm !== null ? (
                  <p className={cn('text-sm font-mono font-bold', vsColor(flight.landing_vs_fpm))}>
                    {flight.landing_vs_fpm} fpm
                  </p>
                ) : <p className="text-sm text-gray-500">—</p>}
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Fuel Used</p>
                <p className="text-sm font-mono font-bold">
                  {flight.fuel_used_kg ? `${Number(flight.fuel_used_kg).toLocaleString()} kg` : '—'}
                </p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Max G-Force</p>
                <p className={cn('text-sm font-mono font-bold',
                  flight.max_g_force ? (Number(flight.max_g_force) > 2 ? 'text-red-400' : Number(flight.max_g_force) > 1.5 ? 'text-amber-400' : 'text-green-400') : '')}>
                  {flight.max_g_force ? `${Number(flight.max_g_force).toFixed(2)}g` : '—'}
                </p>
              </div>
              {grossRevenue !== null && (
                <div className="glass-card rounded-xl p-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Gross Revenue</p>
                  <p className="text-sm font-mono font-bold text-green-400">
                    ${grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main logbook page ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'text-green-400 bg-green-500/10 border-green-500/20',
  CRUISE:    'text-aero bg-aero/10 border-aero/20',
  CLIMB:     'text-aero bg-aero/10 border-aero/20',
  DESCENT:   'text-aero bg-aero/10 border-aero/20',
  BOARDING:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  TAXI:      'text-amber-400 bg-amber-500/10 border-amber-500/20',
  TAKEOFF:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  LANDED:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  CANCELLED: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
};

export default function LogbookPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<{ flights: Flight[]; ad_context: { show_ad: boolean } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Flight | null>(null);
  const u = user as { pilot_tier?: string; role?: string } | null;
  const isFreeAds = u?.pilot_tier === 'FREE_ADS' && u?.role !== 'ADMIN';

  useEffect(() => {
    api.get('/flights/logbook')
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const flights = data?.flights ?? [];
  const completed = flights.filter((f) => f.status === 'COMPLETED');
  const totalHours = completed.reduce((s, f) => s + (f.block_time_min ?? 0) / 60, 0);
  const totalNm = completed.reduce((s, f) => s + f.route.distance_nm, 0);

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Logbook</h1>
          <p className="text-gray-400 text-sm">
            {completed.length} flights · {totalHours.toFixed(1)} hours · {totalNm.toLocaleString()} nm
            {isFreeAds && <span className="ml-2 text-amber-400">· Last 10 flights</span>}
          </p>
        </div>
        <Link href="/dashboard/flights"
          className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm">
          Book Flight ✈️
        </Link>
      </div>

      {/* Stat cards */}
      {completed.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Flights', value: completed.length.toLocaleString() },
            { label: 'Hours', value: totalHours.toFixed(1) },
            { label: 'Distance', value: `${totalNm.toLocaleString()} nm` },
            { label: 'Avg PAX Happiness', value: `${(completed.reduce((s, f) => s + Number(f.pax_happiness), 0) / completed.length).toFixed(0)}%` },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
              <p className="text-xl font-bold text-aero">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Free tier banner */}
      {isFreeAds && (
        <div className="glass-card rounded-2xl p-4 mb-6 border border-amber-500/20 flex items-center justify-between">
          <p className="text-sm text-gray-400">Free pilots see their last 10 flights.</p>
          <Link href="/dashboard/airline/settings" className="text-xs text-aero hover:underline">
            Upgrade for unlimited history →
          </Link>
        </div>
      )}

      {/* AdSense — FREE_ADS pilots only */}
      <AdSenseUnit slot="2345678901" format="horizontal" className="mb-6" />

      {flights.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-xl font-bold mb-2">No flights yet</h3>
          <p className="text-gray-400 text-sm mb-6">Book your first flight to start building your logbook.</p>
          <Link href="/dashboard/flights"
            className="inline-block bg-aero text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition text-sm">
            Book First Flight
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flights.map((flight) => (
            <button
              key={flight.id}
              onClick={() => flight.status === 'COMPLETED' ? setSelected(flight) : undefined}
              className={cn(
                'glass-card rounded-2xl p-5 text-left w-full transition',
                flight.status === 'COMPLETED' ? 'hover:border-aero/20 border border-transparent cursor-pointer' : 'cursor-default border border-transparent',
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono font-bold text-aero">{flight.route.origin.icao}</span>
                    <span className="text-gray-500 text-sm">→</span>
                    <span className="font-mono font-bold">{flight.route.destination.icao}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[flight.status] ?? 'text-gray-400 border-white/20')}>
                      {flight.status.replace(/_/g, ' ')}
                    </span>
                    {flight.status === 'COMPLETED' && (
                      <span className="text-xs text-gray-600">tap to expand</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {flight.route.origin.name}
                    {flight.route.origin.city ? ` (${flight.route.origin.city})` : ''} → {flight.route.destination.name}
                    {flight.route.destination.city ? ` (${flight.route.destination.city})` : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500 flex-shrink-0 ml-3">
                  <p>{formatDate(flight.arrived_at ?? flight.departed_at)}</p>
                  <p className="font-mono">{formatTime(flight.departed_at)} → {formatTime(flight.arrived_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span className="font-mono">{flight.hull.registration}</span>
                <span>{flight.hull.aircraft_type}</span>
                <span>{flight.route.distance_nm.toLocaleString()} nm</span>
                {flight.block_time_min && <span>{formatDuration(flight.block_time_min)}</span>}
                {flight.airline && <span className="text-gray-600">{flight.airline.icao_code}</span>}
              </div>

              {flight.status === 'COMPLETED' && (
                <div className="flex items-center gap-6 pt-3 border-t border-white/5 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">PAX Happiness</p>
                    <HappinessBar value={Number(flight.pax_happiness)} />
                  </div>
                  {flight.landing_vs_fpm !== null && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Landing VS</p>
                      <p className={cn('text-xs font-mono font-bold', vsColor(flight.landing_vs_fpm))}>
                        {flight.landing_vs_fpm} fpm
                      </p>
                    </div>
                  )}
                  {flight.fuel_used_kg && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Fuel</p>
                      <p className="text-xs font-mono">{Number(flight.fuel_used_kg).toLocaleString()} kg</p>
                    </div>
                  )}
                  {flight.max_g_force && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Max G</p>
                      <p className={cn('text-xs font-mono font-bold',
                        Number(flight.max_g_force) > 2 ? 'text-red-400' : Number(flight.max_g_force) > 1.5 ? 'text-amber-400' : 'text-green-400')}>
                        {Number(flight.max_g_force).toFixed(2)}g
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">PAX</p>
                    <p className="text-xs font-mono">{flight.pax_count}</p>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Flight detail modal */}
      {selected && <FlightDetail flight={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
