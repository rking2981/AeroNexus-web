'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { publicApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface LiveFlight {
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
    origin: { icao: string; name: string; latitude: string; longitude: string };
    destination: { icao: string; name: string; latitude: string; longitude: string };
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  BOARDING: 'BOARDING',
  TAXI:     'TAXI',
  TAKEOFF:  'TAKEOFF',
  CLIMB:    'CLIMB',
  CRUISE:   'EN ROUTE',
  DESCENT:  'DESCENT',
  LANDED:   'LANDED',
};

const STATUS_COLOR: Record<string, string> = {
  BOARDING: '#F59E0B',
  TAXI:     '#F59E0B',
  TAKEOFF:  '#00D1FF',
  CLIMB:    '#00D1FF',
  CRUISE:   '#4ADE80',
  DESCENT:  '#00D1FF',
  LANDED:   '#6B7280',
};

const LiveMapInner = dynamic(() => import('@/components/LiveMapInner'), {
  ssr: false,
  loading: () => (
    <div className="bg-[#080810] flex items-center justify-center" style={{ height: '60vh' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-aero border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

// ─── Flip board row ───────────────────────────────────────────────────────────

function FlipRow({ flight, selected, onClick }: {
  flight: LiveFlight;
  selected: boolean;
  onClick: () => void;
}) {
  const statusColor = STATUS_COLOR[flight.status] ?? '#6B7280';
  const statusLabel = STATUS_LABEL[flight.status] ?? flight.status;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left grid items-center gap-2 px-4 py-3 border-b border-white/5 transition-all duration-150 font-mono',
        'hover:bg-white/5',
        selected && 'bg-aero/5 border-l-2 border-l-aero',
      )}
      style={{ gridTemplateColumns: '90px 1fr 1fr 120px 80px 90px 90px' }}
    >
      {/* Flight / registration */}
      <span className="text-white font-bold text-sm tracking-wider truncate">
        {flight.hull.registration}
      </span>

      {/* Origin */}
      <span className="text-aero font-bold text-sm tracking-widest truncate">
        {flight.route?.origin.icao ?? '—'}
      </span>

      {/* Destination */}
      <span className="text-white text-sm tracking-widest truncate">
        {flight.route?.destination.icao ?? '—'}
      </span>

      {/* Aircraft */}
      <span className="text-gray-400 text-xs truncate">
        {flight.hull.aircraft_type}
      </span>

      {/* Altitude */}
      <span className="text-gray-400 text-xs text-right">
        {flight.current_alt_ft != null
          ? `FL${Math.round(flight.current_alt_ft / 100).toString().padStart(3, '0')}`
          : '—'}
      </span>

      {/* Speed */}
      <span className="text-gray-400 text-xs text-right">
        {flight.current_spd_kts != null ? `${flight.current_spd_kts}kt` : '—'}
      </span>

      {/* Status */}
      <span className="text-xs font-bold tracking-wider text-right" style={{ color: statusColor }}>
        {statusLabel}
      </span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
    intervalRef.current = setInterval(fetchFlights, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchFlights]);

  const positioned = flights.filter((f) => f.current_lat && f.current_lon);

  function handleSelect(f: LiveFlight) {
    setSelected((prev) => prev?.id === f.id ? null : f);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Map — always visible, takes remaining height */}
      <div style={{ flex: '1 1 0', minHeight: '300px', position: 'relative' }}>
        <LiveMapInner
          flights={positioned}
          selected={selected}
          onSelect={(f) => f ? handleSelect(f) : setSelected(null)}
        />
      </div>

      {/* Flight board — bottom panel, fixed height */}
      <div className="flex-shrink-0 border-t border-white/10 bg-[#050508]" style={{ height: '220px' }}>

        {/* Board header */}
        <div
          className="grid items-center gap-2 px-4 py-2 border-b border-white/10 bg-black/60 font-mono"
          style={{ gridTemplateColumns: '90px 1fr 1fr 120px 80px 90px 90px' }}
        >
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Flight</span>
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Origin</span>
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Destination</span>
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Aircraft</span>
          <span className="text-[10px] text-gray-600 uppercase tracking-widest text-right">Alt</span>
          <span className="text-[10px] text-gray-600 uppercase tracking-widest text-right">Speed</span>
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">Status</span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aero opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-aero" />
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="overflow-y-auto" style={{ height: 'calc(220px - 36px)' }}>
          {positioned.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-gray-600 font-mono text-sm tracking-widest">NO ACTIVE FLIGHTS</p>
              {lastUpdate && (
                <p className="text-gray-700 text-xs mt-2 font-mono">
                  LAST CHECKED {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
          ) : (
            positioned.map((f) => (
              <FlipRow
                key={f.id}
                flight={f}
                selected={selected?.id === f.id}
                onClick={() => handleSelect(f)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
