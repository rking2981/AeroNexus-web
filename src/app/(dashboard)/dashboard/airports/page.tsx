'use client';

import { useState, useCallback } from 'react';
import { publicApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Airport {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string;
  facility_type: string;
  has_helipad: boolean;
}

interface Runway {
  id: string;
  le_ident: string | null;
  he_ident: string | null;
  length_ft: number | null;
  width_ft: number | null;
  surface: string | null;
  lighted: boolean;
  closed: boolean;
}

interface AirportDetail {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string;
  latitude: string;
  longitude: string;
  elevation_ft: number | null;
  timezone: string;
  facility_type: string;
  has_helipad: boolean;
  demand_index: string;
  runways: Runway[];
  nearest_hub: { name: string; icao: string; region: string } | null;
}

const FACILITY_LABELS: Record<string, string> = {
  large_airport:   'Large Airport',
  medium_airport:  'Medium Airport',
  small_airport:   'Small Airport',
  heliport:        'Heliport',
  seaplane_base:   'Seaplane Base',
  balloonport:     'Balloonport',
  closed:          'Closed',
};

const FACILITY_COLORS: Record<string, string> = {
  large_airport:  'text-aero border-aero/30 bg-aero/10',
  medium_airport: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  small_airport:  'text-gray-400 border-white/20 bg-white/5',
  heliport:       'text-amber-400 border-amber-500/30 bg-amber-500/10',
  seaplane_base:  'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  balloonport:    'text-purple-400 border-purple-500/30 bg-purple-500/10',
};

const SURFACE_LABELS: Record<string, string> = {
  ASP: 'Asphalt', CON: 'Concrete', GRS: 'Grass', GRV: 'Gravel',
  WAT: 'Water', CLA: 'Clay', SAN: 'Sand', BIT: 'Bitumen',
  COM: 'Composite', TURF: 'Turf',
};

function FacilityBadge({ type }: { type: string }) {
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', FACILITY_COLORS[type] ?? 'text-gray-400 border-white/20 bg-white/5')}>
      {FACILITY_LABELS[type] ?? type.replace(/_/g, ' ')}
    </span>
  );
}

function DemandBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function AirportsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<AirportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const search = useCallback(async (q: string, ft: string) => {
    if (q.length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true); setSearched(true);
    try {
      const params = new URLSearchParams({ q });
      if (ft) params.set('type', ft);
      const { data } = await publicApi.get(`/network/airports/search?${params}`);
      setResults(data);
    } finally { setLoading(false); }
  }, []);

  async function openDetail(icao: string) {
    setDetailLoading(true);
    setSelected(null);
    try {
      const { data } = await publicApi.get(`/network/airports/${icao}`);
      setSelected(data);
    } finally { setDetailLoading(false); }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Airport Directory</h1>
        <p className="text-gray-400 text-sm">Search across 85,289 airports, heliports, seaplane bases and more.</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search by ICAO, name, or city…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value, filter); }}
          className="flex-1 min-w-64 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none transition"
        />
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); search(query, e.target.value); }}
          className="rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white focus:border-aero focus:outline-none transition"
        >
          <option value="">All Types</option>
          <option value="large_airport">Large Airport</option>
          <option value="medium_airport">Medium Airport</option>
          <option value="small_airport">Small Airport</option>
          <option value="heliport">Heliport</option>
          <option value="seaplane_base">Seaplane Base</option>
        </select>
      </div>

      <div className="flex gap-6 items-start">
        {/* Results list */}
        <div className="flex-1 min-w-0">
          {!searched ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-gray-400 text-sm">Start typing to search airports, heliports, and more.</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="glass-card rounded-2xl h-16 animate-pulse" />)}
            </div>
          ) : results.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-4xl mb-4">✈️</p>
              <p className="text-gray-400 text-sm">No airports found for &quot;{query}&quot;.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openDetail(a.icao)}
                  className={cn(
                    'glass-card rounded-2xl p-4 text-left flex items-center gap-4 transition hover:border-aero/20 border border-transparent',
                    selected?.icao === a.icao && 'border-aero/30 bg-aero/5',
                  )}
                >
                  <div className="flex-shrink-0 text-center w-16">
                    <p className="font-mono font-bold text-aero text-lg leading-tight">{a.icao}</p>
                    {a.iata && <p className="font-mono text-xs text-gray-500">{a.iata}</p>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{a.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.city ? `${a.city}, ` : ''}{a.country}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.has_helipad && (
                      <span className="text-[10px] text-amber-400 border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 rounded-full">HELI</span>
                    )}
                    <FacilityBadge type={a.facility_type} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {(detailLoading || selected) && (
          <div className="w-80 flex-shrink-0">
            {detailLoading ? (
              <div className="glass-card rounded-2xl h-96 animate-pulse" />
            ) : selected && (
              <div className="glass-card rounded-2xl overflow-hidden border border-aero/10 sticky top-0">
                {/* Header */}
                <div className="p-5 border-b border-white/5">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-bold text-aero text-2xl">{selected.icao}</span>
                        {selected.iata && <span className="font-mono text-sm text-gray-500">/ {selected.iata}</span>}
                      </div>
                      <p className="text-sm font-medium text-white">{selected.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selected.city ? `${selected.city}, ` : ''}{selected.country}
                      </p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-lg leading-none ml-2">✕</button>
                  </div>
                  <div className="mt-2">
                    <FacilityBadge type={selected.facility_type} />
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 flex flex-col gap-4">
                  {/* Coordinates & elevation */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500 mb-1">Coordinates</p>
                      <p className="font-mono text-gray-300">{Number(selected.latitude).toFixed(4)}°</p>
                      <p className="font-mono text-gray-300">{Number(selected.longitude).toFixed(4)}°</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Elevation</p>
                      <p className="font-mono text-gray-300">
                        {selected.elevation_ft != null ? `${selected.elevation_ft.toLocaleString()} ft` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Timezone</p>
                      <p className="font-mono text-gray-300 text-[11px]">{selected.timezone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Helipad</p>
                      <p className={selected.has_helipad ? 'text-amber-400 text-xs font-bold' : 'text-gray-600 text-xs'}>
                        {selected.has_helipad ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>

                  {/* Demand */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Passenger Demand</p>
                    <DemandBar value={Number(selected.demand_index)} />
                  </div>

                  {/* Nearest fuel hub */}
                  {selected.nearest_hub && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Nearest Fuel Hub</p>
                      <p className="text-xs text-gray-300">
                        <span className="font-mono text-aero">{selected.nearest_hub.icao}</span>
                        {' '}— {selected.nearest_hub.name}
                        <span className="text-gray-600 ml-1">({selected.nearest_hub.region})</span>
                      </p>
                    </div>
                  )}

                  {/* Runways */}
                  {selected.runways.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">
                        Runways ({selected.runways.filter((r) => !r.closed).length} active)
                      </p>
                      <div className="flex flex-col gap-2">
                        {selected.runways.map((rwy) => (
                          <div
                            key={rwy.id}
                            className={cn(
                              'rounded-xl p-3 text-xs',
                              rwy.closed ? 'bg-red-500/5 border border-red-500/10' : 'bg-white/3 border border-white/5',
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-bold text-white">
                                {rwy.le_ident ?? '?'} / {rwy.he_ident ?? '?'}
                              </span>
                              <div className="flex gap-1">
                                {rwy.closed && <span className="text-[10px] text-red-400 border border-red-500/20 px-1.5 rounded-full">CLOSED</span>}
                                {rwy.lighted && <span className="text-[10px] text-amber-400 border border-amber-500/20 px-1.5 rounded-full">LIT</span>}
                              </div>
                            </div>
                            <div className="flex gap-3 text-gray-500">
                              <span>{rwy.length_ft != null ? `${rwy.length_ft.toLocaleString()} ft` : '—'}</span>
                              {rwy.width_ft && <span>× {rwy.width_ft} ft</span>}
                              {rwy.surface && <span>{SURFACE_LABELS[rwy.surface] ?? rwy.surface}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
