'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { publicApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { onSimData } from '@/lib/acars-bridge';

export interface LiveFlight {
  id: string;
  status: string;
  current_lat: string | null;
  current_lon: string | null;
  current_alt_ft: number | null;
  current_hdg: number | null;
  current_spd_kts: number | null;
  _no_telemetry?: boolean;
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
};

const STATUS_COLOR: Record<string, string> = {
  BOARDING: '#F59E0B',
  TAXI:     '#F59E0B',
  TAKEOFF:  '#00D1FF',
  CLIMB:    '#00D1FF',
  CRUISE:   '#4ADE80',
  DESCENT:  '#00D1FF',
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

// ─── Flip tile — single character cell ───────────────────────────────────────

function FlipTile({ char, dim = false, color }: { char: string; dim?: boolean; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 30,
      background: dim ? '#1a1a1a' : '#181818',
      color: dim ? '#555' : color ?? '#00D1FF',
      fontFamily: "Impact, 'Arial Narrow', 'Arial Black', sans-serif",
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: 0,
      borderRadius: 3,
      margin: '0 1px',
      position: 'relative',
      boxShadow: '0 1px 3px rgba(0,0,0,0.8)',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Crease line — the classic Solari split */}
      <span style={{
        position: 'absolute',
        left: 0, right: 0,
        top: '50%',
        height: 1,
        background: 'rgba(0,0,0,0.6)',
        pointerEvents: 'none',
      }} />
      {char}
    </span>
  );
}

function FlipWord({ value, width, color }: { value: string; width: number; color?: string }) {
  const chars = value.toUpperCase().padEnd(width).slice(0, width).split('');
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {chars.map((c, i) => (
        <FlipTile key={i} char={c === ' ' ? ' ' : c} dim={c === ' '} color={c !== ' ' ? color : undefined} />
      ))}
    </div>
  );
}

// ─── Flip board row ───────────────────────────────────────────────────────────

const COLS = [
  { key: 'flight',  label: 'FLIGHT',  width: 7  },
  { key: 'origin',  label: 'ORIGIN',  width: 4  },
  { key: 'dest',    label: 'DEST',    width: 4  },
  { key: 'airline', label: 'AIRLINE', width: 6  },
  { key: 'alt',     label: 'ALT',     width: 5  },
  { key: 'spd',     label: 'SPD',     width: 5  },
  { key: 'status',  label: 'STATUS',  width: 8  },
];

function FlipRow({ flight, selected, onClick }: {
  flight: LiveFlight;
  selected: boolean;
  onClick: () => void;
}) {
  const statusLabel = (STATUS_LABEL[flight.status] ?? flight.status).toUpperCase();
  const statusColor = STATUS_COLOR[flight.status] ?? '#6B7280';

  const alt = flight.current_alt_ft != null
    ? `FL${Math.round(flight.current_alt_ft / 100).toString().padStart(3, '0')}`
    : '-----';
  const spd = flight.current_spd_kts != null
    ? `${flight.current_spd_kts}KT`
    : '-----';

  const values: Record<string, string> = {
    flight:  flight.hull.registration,
    origin:  flight.route?.origin.icao ?? '----',
    dest:    flight.route?.destination.icao ?? '----',
    airline: flight.airline?.icao_code ?? '------',
    alt,
    spd,
    status:  statusLabel,
  };

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: selected ? 'rgba(0,209,255,0.06)' : 'transparent',
        borderLeft: selected ? '2px solid #00D1FF' : '2px solid transparent',
        cursor: 'pointer',
        width: '100%',
        transition: 'background 0.1s',
      }}
    >
      {COLS.map((col) => (
        <div key={col.key} style={{ flexShrink: 0 }}>
          <FlipWord
            value={values[col.key]}
            width={col.width}
            color={col.key === 'status' ? statusColor : undefined}
          />
        </div>
      ))}
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
      // Keep selected in sync with fresh data so position/speed/altitude stay current
      setSelected(prev => prev ? (data.find((f: LiveFlight) => f.id === prev.id) ?? prev) : null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchFlights();
    intervalRef.current = setInterval(fetchFlights, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchFlights]);

  // Update selected flight's live telemetry and marker position from ACARS WebSocket
  // This fires every second (sim data rate) so the popup stays current even when selected
  useEffect(() => {
    const unsub = onSimData((data) => {
      setSelected(prev => {
        if (!prev || prev._no_telemetry) return prev;
        return {
          ...prev,
          current_lat:     String(data.lat),
          current_lon:     String(data.lon),
          current_alt_ft:  Math.round(data.alt_ft),
          current_hdg:     Math.round(data.heading),
          current_spd_kts: Math.round(data.speed_kts),
        };
      });
      // Also update the matching flight in the flights array so the marker moves
      setFlights(prev => prev.map(f =>
        f.current_lat && !f._no_telemetry
          ? { ...f,
              current_lat:     String(data.lat),
              current_lon:     String(data.lon),
              current_hdg:     Math.round(data.heading),
              current_spd_kts: Math.round(data.speed_kts),
              current_alt_ft:  Math.round(data.alt_ft),
            }
          : f,
      ));
    });
    return () => unsub();
  }, []);

  // Flights with live ACARS position, plus flights without one using origin airport as fallback
  const positioned = flights.map((f) => {
    if (f.current_lat && f.current_lon) return f;
    if (f.route?.origin.latitude && f.route?.origin.longitude) {
      return { ...f, current_lat: f.route.origin.latitude, current_lon: f.route.origin.longitude, _no_telemetry: true };
    }
    return null;
  }).filter(Boolean) as (LiveFlight & { _no_telemetry?: boolean })[];

  function handleSelect(f: LiveFlight) {
    setSelected((prev) => prev?.id === f.id ? null : f);
  }

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      {/* Map — explicit pixel height so MapLibre can measure it */}
      <div style={{ height: 'calc(100vh - 220px)', position: 'relative', overflow: 'hidden' }}>
        <LiveMapInner
          flights={positioned}
          selected={selected}
          onSelect={(f) => f ? handleSelect(f) : setSelected(null)}
        />
      </div>

      {/* Solari flip board — fixed 220px */}
      <div style={{ height: '220px', flexShrink: 0, background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Board header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 16px',
          background: '#050505',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {COLS.map((col) => (
            <div key={col.key} style={{ flexShrink: 0, width: col.width * 24 }}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: 9,
                color: '#444',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}>{col.label}</span>
            </div>
          ))}
          {/* Live indicator */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#333', letterSpacing: 2 }}>LIVE</span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aero opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-aero" />
            </span>
          </div>
        </div>

        {/* Rows */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {flights.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 8 }}>
                {'NO ACTIVE FLIGHTS'.split('').map((c, i) => <FlipTile key={i} char={c === ' ' ? ' ' : c} dim={c === ' '} />)}
              </div>
              {lastUpdate && (
                <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#333', letterSpacing: 2, marginTop: 8 }}>
                  UPDATED {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
          ) : (
            flights.map((f) => (
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
