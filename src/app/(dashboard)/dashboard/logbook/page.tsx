'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface Flight {
  id: string;
  status: string;
  pax_count: number;
  pax_happiness: number;
  landing_vs_fpm: number | null;
  block_time_min: number | null;
  departed_at: string | null;
  arrived_at: string | null;
  hull: { registration: string; aircraft_type: string; aircraft_category: string };
  route: {
    distance_nm: number;
    origin: { icao: string; name: string };
    destination: { icao: string; name: string };
  };
}

function HappinessBar({ value }: { value: number }) {
  const color = value >= 85 ? 'bg-green-500' : value >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className={cn('text-xs', value >= 85 ? 'text-green-400' : value >= 70 ? 'text-amber-400' : 'text-red-400')}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'text-green-400 bg-green-500/10 border-green-500/20',
  IN_FLIGHT: 'text-aero bg-aero/10 border-aero/20',
  CRUISE: 'text-aero bg-aero/10 border-aero/20',
  BOARDING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  TAXI: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  CANCELLED: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
};

export default function LogbookPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<{ flights: Flight[]; ad_context: { show_ad: boolean } } | null>(null);
  const [loading, setLoading] = useState(true);
  const isFreeAds = (user as { pilot_tier?: string })?.pilot_tier === 'FREE_ADS';

  useEffect(() => {
    api.get('/flights/logbook')
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const flights = data?.flights ?? [];
  const totalHours = flights
    .filter(f => f.status === 'COMPLETED')
    .reduce((s, f) => s + (f.block_time_min ?? 0) / 60, 0);

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Logbook</h1>
          <p className="text-gray-400 text-sm">
            {flights.length} flights · {totalHours.toFixed(1)} hours
            {isFreeAds && <span className="ml-2 text-amber-400 text-xs">· Showing last 10 flights</span>}
          </p>
        </div>
        <Link href="/dashboard/flights"
          className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm">
          Book Flight ✈️
        </Link>
      </div>

      {/* Ad banner for free tier */}
      {isFreeAds && (
        <div className="glass-card rounded-2xl p-4 mb-6 border border-amber-500/20 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            📋 Free pilots see their last 10 flights.
          </p>
          <Link href="/dashboard/billing" className="text-xs text-aero hover:underline">
            Upgrade for unlimited history →
          </Link>
        </div>
      )}

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
            <div key={flight.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold">{flight.route.origin.icao}</span>
                      <span className="text-gray-500 text-sm">→</span>
                      <span className="font-mono font-bold">{flight.route.destination.icao}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[flight.status] ?? 'text-gray-400 border-white/20')}>
                        {flight.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {flight.hull.registration} · {flight.hull.aircraft_type} · {flight.route.distance_nm.toLocaleString()} nm
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {flight.arrived_at
                    ? new Date(flight.arrived_at).toLocaleDateString()
                    : flight.departed_at
                    ? new Date(flight.departed_at).toLocaleDateString()
                    : '—'}
                </div>
              </div>

              {flight.status === 'COMPLETED' && (
                <div className="flex items-center gap-6 pt-3 border-t border-white/5">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">PAX Happiness</p>
                    <HappinessBar value={Number(flight.pax_happiness)} />
                  </div>
                  {flight.landing_vs_fpm !== null && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Landing VS</p>
                      <p className={cn('text-xs font-mono font-bold',
                        Math.abs(flight.landing_vs_fpm) <= 200 ? 'text-green-400'
                        : Math.abs(flight.landing_vs_fpm) <= 400 ? 'text-amber-400' : 'text-red-400')}>
                        {flight.landing_vs_fpm} fpm
                      </p>
                    </div>
                  )}
                  {flight.block_time_min && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Time</p>
                      <p className="text-xs font-mono">{Math.floor(flight.block_time_min / 60)}h {flight.block_time_min % 60}m</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">PAX</p>
                    <p className="text-xs">{flight.pax_count}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
