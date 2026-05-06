'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { publicApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface LiveFlight {
  id: string;
  status: string;
  current_lat: string | null;
  current_lon: string | null;
  current_alt_ft: number | null;
  current_hdg: number | null;
  current_spd_kts: number | null;
  hull: { registration: string; aircraft_type: string; aircraft_category: string };
  pilot: { display_name: string };
  airline: { name: string; icao_code: string } | null;
  route: {
    origin: { icao: string; name: string };
    destination: { icao: string; name: string };
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  BOARDING:  'text-amber-400',
  TAXI:      'text-amber-400',
  TAKEOFF:   'text-aero',
  CLIMB:     'text-aero',
  CRUISE:    'text-green-400',
  DESCENT:   'text-aero',
  LANDED:    'text-gray-400',
};

// Dynamically import the map so it's never SSR'd
const LiveMapInner = dynamic(() => import('@/components/LiveMapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-[#080810] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-aero border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const [flights, setFlights] = useState<LiveFlight[]>([]);
  const [selected, setSelected] = useState<LiveFlight | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFlights = useCallback(async () => {
    try {
      const { data } = await publicApi.get('/flights/live');
      setFlights(data);
      setLastUpdate(new Date());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchFlights();
    intervalRef.current = setInterval(fetchFlights, 10000); // refresh every 10s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchFlights]);

  const positioned = flights.filter((f) => f.current_lat && f.current_lon);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-white/5 bg-black/30 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm">Live Flights</h2>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aero opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-aero" />
              </span>
              <span className="text-xs text-gray-500">{positioned.length} airborne</span>
            </div>
          </div>
          {lastUpdate && (
            <p className="text-[10px] text-gray-600 mt-1">
              Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>

        {/* Flight list */}
        <div className="flex-1 overflow-y-auto">
          {positioned.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-4xl mb-3">✈️</p>
              <p className="text-gray-500 text-sm">No active flights right now.</p>
              <p className="text-gray-600 text-xs mt-1">Check back when pilots are flying.</p>
            </div>
          ) : (
            positioned.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(selected?.id === f.id ? null : f)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-white/5 transition hover:bg-white/5',
                  selected?.id === f.id && 'bg-aero/5 border-l-2 border-l-aero',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-bold text-white">
                    {f.route?.origin.icao ?? '???'} → {f.route?.destination.icao ?? '???'}
                  </span>
                  <span className={cn('text-[10px] font-bold uppercase', STATUS_COLORS[f.status] ?? 'text-gray-400')}>
                    {f.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{f.hull.registration} · {f.hull.aircraft_type}</p>
                <p className="text-xs text-gray-600 mt-0.5">{f.pilot.display_name}</p>
                {f.current_alt_ft != null && (
                  <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
                    FL{Math.round(f.current_alt_ft / 100).toString().padStart(3, '0')}
                    {f.current_spd_kts != null && ` · ${f.current_spd_kts}kts`}
                    {f.current_hdg != null && ` · HDG ${f.current_hdg.toString().padStart(3, '0')}°`}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Map */}
      <LiveMapInner
        flights={positioned}
        selected={selected}
        onSelect={setSelected}
      />
    </div>
  );
}
