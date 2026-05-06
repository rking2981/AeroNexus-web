'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface Runway {
  le_ident: string | null;
  he_ident: string | null;
  length_ft: number | null;
  width_ft: number | null;
  surface: string | null;
  lighted: boolean;
}

interface Hub {
  id: string;
  type: 'PRIMARY' | 'SECONDARY';
  airport: {
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
    runways: Runway[];
  };
}

interface Route {
  id: string;
  distance_nm: number;
  aircraft_type: string;
  status: string;
  is_saturated: boolean;
  base_ticket_price: number;
  effective_ticket_price: number;
  origin: { icao: string; name: string; city: string | null };
  destination: { icao: string; name: string; city: string | null };
}

interface Airport {
  id: string; icao: string; name: string; city: string | null; country: string; facility_type: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-400 bg-green-500/10 border-green-500/20',
  SEASONAL: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  SUSPENDED: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
};

export default function NetworkPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [tab, setTab] = useState<'routes' | 'hubs'>('routes');
  const [loading, setLoading] = useState(true);

  // Add hub state
  const [hubSearch, setHubSearch] = useState('');
  const [hubResults, setHubResults] = useState<Airport[]>([]);
  const [addingHub, setAddingHub] = useState(false);
  const [hubError, setHubError] = useState('');

  // Add route state
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [originSearch, setOriginSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [originResults, setOriginResults] = useState<Airport[]>([]);
  const [destResults, setDestResults] = useState<Airport[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Airport | null>(null);
  const [selectedDest, setSelectedDest] = useState<Airport | null>(null);
  const [routeForm, setRouteForm] = useState({ aircraft_type: '', base_ticket_price: '' });
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/network/hubs'), api.get('/network/routes')])
      .then(([h, r]) => { setHubs(h.data); setRoutes(r.data); })
      .finally(() => setLoading(false));
  }, []);

  const searchAirports = useCallback(async (q: string, setter: (r: Airport[]) => void) => {
    if (q.length < 2) { setter([]); return; }
    const { data } = await publicApi.get(`/network/airports/search?q=${encodeURIComponent(q)}`);
    setter(data);
  }, []);

  async function addHub(airport: Airport, type: 'PRIMARY' | 'SECONDARY') {
    setAddingHub(true); setHubError('');
    try {
      const { data } = await api.post('/network/hubs', { airport_id: airport.icao, type });
      setHubs([...hubs, data]);
      setHubSearch(''); setHubResults([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setHubError(msg ?? 'Failed to add hub.');
    } finally { setAddingHub(false); }
  }

  async function deleteHub(id: string) {
    await api.delete(`/network/hubs/${id}`);
    setHubs(hubs.filter((h) => h.id !== id));
  }

  async function addRoute() {
    if (!selectedOrigin || !selectedDest || !routeForm.aircraft_type || !routeForm.base_ticket_price) return;
    setRouteLoading(true);
    try {
      const { data } = await api.post('/network/routes', {
        origin_id: selectedOrigin.icao,
        destination_id: selectedDest.icao,
        distance_nm: 0,
        aircraft_type: routeForm.aircraft_type,
        base_ticket_price: parseFloat(routeForm.base_ticket_price),
      });
      setRoutes([data, ...routes]);
      setShowAddRoute(false);
      setSelectedOrigin(null); setSelectedDest(null);
      setRouteForm({ aircraft_type: '', base_ticket_price: '' });
    } catch { /* ignore */ } finally { setRouteLoading(false); }
  }

  async function toggleRouteStatus(route: Route) {
    const next = route.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await api.patch(`/network/routes/${route.id}/status`, { status: next });
    setRoutes(routes.map((r) => r.id === route.id ? { ...r, status: next } : r));
  }

  async function deleteRoute(id: string) {
    await api.delete(`/network/routes/${id}`);
    setRoutes(routes.filter((r) => r.id !== id));
  }

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Routes & Hubs</h1>
          <p className="text-gray-400 text-sm">{hubs.length} hubs · {routes.length} routes</p>
        </div>
        {isManager && (
          <button onClick={() => tab === 'routes' ? setShowAddRoute(true) : setHubSearch(' ')}
            className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm">
            + Add {tab === 'routes' ? 'Route' : 'Hub'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {(['routes', 'hubs'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition capitalize',
              tab === t ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t} ({t === 'routes' ? routes.length : hubs.length})
          </button>
        ))}
      </div>

      {/* Hubs tab */}
      {tab === 'hubs' && (
        <div className="flex flex-col gap-4">
          {/* Add hub search */}
          {isManager && (
            <div className="relative">
              <input type="text" placeholder="Search airport to add as hub..."
                value={hubSearch}
                onChange={(e) => { setHubSearch(e.target.value); searchAirports(e.target.value, setHubResults); }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition"
              />
              {hubResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl">
                  {hubResults.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-aero">{a.icao}</p>
                        <p className="text-xs text-gray-400 truncate">{a.name}</p>
                      </div>
                      <button onClick={() => addHub(a, 'PRIMARY')} disabled={addingHub}
                        className="text-xs text-aero border border-aero/30 px-2 py-1 rounded-lg hover:bg-aero/10 transition">
                        Primary
                      </button>
                      <button onClick={() => addHub(a, 'SECONDARY')} disabled={addingHub}
                        className="text-xs text-gray-400 border border-white/20 px-2 py-1 rounded-lg hover:bg-white/5 transition">
                        Secondary
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hubError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{hubError}</p>
          )}

          {hubs.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
              <p className="text-4xl mb-3">🏢</p>
              <p>No hubs added yet. Search above to add your first hub.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {hubs.map((hub) => {
                const a = hub.airport;
                const lat = Number(a.latitude).toFixed(4);
                const lon = Number(a.longitude).toFixed(4);
                const longestRwy = a.runways[0];
                return (
                  <div key={hub.id} className={cn(
                    'glass-card rounded-2xl p-5 flex flex-col gap-4 border',
                    hub.type === 'PRIMARY' ? 'border-aero/25' : 'border-white/10',
                  )}>
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-2xl font-extrabold text-white">{a.icao}</span>
                          {a.iata && <span className="font-mono text-sm text-gray-500">/ {a.iata}</span>}
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-lg border',
                            hub.type === 'PRIMARY'
                              ? 'text-aero border-aero/30 bg-aero/10'
                              : 'text-gray-400 border-white/20 bg-white/5',
                          )}>
                            {hub.type}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white mt-0.5 leading-snug">{a.name}</p>
                        <p className="text-xs text-gray-500">
                          {a.city ? `${a.city}, ` : ''}{a.country}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600 uppercase tracking-widest flex-shrink-0 text-right">
                        {a.facility_type.replace(/_/g, ' ')}
                      </p>
                    </div>

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-white/5 pt-3">
                      <div>
                        <p className="text-gray-500 mb-0.5">Coordinates</p>
                        <p className="font-mono text-gray-300">{lat}° {lon}°</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Elevation</p>
                        <p className="font-mono text-gray-300">
                          {a.elevation_ft != null ? `${a.elevation_ft.toLocaleString()} ft` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Timezone</p>
                        <p className="font-mono text-gray-300">{a.timezone}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Helipad</p>
                        <p className={a.has_helipad ? 'text-aero' : 'text-gray-600'}>
                          {a.has_helipad ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>

                    {/* Runways */}
                    {a.runways.length > 0 && (
                      <div className="border-t border-white/5 pt-3">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                          Runways ({a.runways.length})
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {a.runways.map((rwy, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="font-mono text-gray-300">
                                {rwy.le_ident ?? '?'}/{rwy.he_ident ?? '?'}
                              </span>
                              <span className="text-gray-500">
                                {rwy.length_ft != null ? `${rwy.length_ft.toLocaleString()} ft` : '—'}
                                {rwy.width_ft != null ? ` × ${rwy.width_ft} ft` : ''}
                              </span>
                              <span className="text-gray-600">
                                {rwy.surface ?? '—'}
                                {rwy.lighted ? ' · lit' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                        {longestRwy?.length_ft && (
                          <p className="text-[10px] text-gray-600 mt-1.5">
                            Longest: {longestRwy.length_ft.toLocaleString()} ft
                          </p>
                        )}
                      </div>
                    )}

                    {/* Remove */}
                    {isManager && (
                      <button
                        onClick={() => deleteHub(hub.id)}
                        className="mt-auto text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:bg-red-500/5 px-3 py-1.5 rounded-lg w-full text-center transition"
                      >
                        Remove Hub
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Routes tab */}
      {tab === 'routes' && (
        <div className="flex flex-col gap-3">
          {/* Add route form */}
          {showAddRoute && (
            <div className="glass-card rounded-2xl p-6 border border-aero/20">
              <h3 className="font-bold mb-4">New Route</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Origin */}
                <div className="relative">
                  <label className="text-xs text-gray-400 block mb-1">Origin</label>
                  {selectedOrigin ? (
                    <div className="flex items-center justify-between rounded-xl border border-aero/30 bg-aero/5 px-3 py-2 text-sm">
                      <span className="font-mono text-aero">{selectedOrigin.icao}</span>
                      <button onClick={() => setSelectedOrigin(null)} className="text-gray-500 hover:text-white">✕</button>
                    </div>
                  ) : (
                    <input placeholder="Search origin..." value={originSearch}
                      onChange={(e) => { setOriginSearch(e.target.value); searchAirports(e.target.value, setOriginResults); }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition"
                    />
                  )}
                  {originResults.length > 0 && !selectedOrigin && (
                    <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-xl">
                      {originResults.map((a) => (
                        <button key={a.id} type="button" onClick={() => { setSelectedOrigin(a); setOriginResults([]); setOriginSearch(''); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                          <span className="font-mono text-xs text-aero w-12">{a.icao}</span>
                          <span className="text-xs text-white truncate">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Destination */}
                <div className="relative">
                  <label className="text-xs text-gray-400 block mb-1">Destination</label>
                  {selectedDest ? (
                    <div className="flex items-center justify-between rounded-xl border border-aero/30 bg-aero/5 px-3 py-2 text-sm">
                      <span className="font-mono text-aero">{selectedDest.icao}</span>
                      <button onClick={() => setSelectedDest(null)} className="text-gray-500 hover:text-white">✕</button>
                    </div>
                  ) : (
                    <input placeholder="Search destination..." value={destSearch}
                      onChange={(e) => { setDestSearch(e.target.value); searchAirports(e.target.value, setDestResults); }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition"
                    />
                  )}
                  {destResults.length > 0 && !selectedDest && (
                    <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-xl">
                      {destResults.map((a) => (
                        <button key={a.id} type="button" onClick={() => { setSelectedDest(a); setDestResults([]); setDestSearch(''); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                          <span className="font-mono text-xs text-aero w-12">{a.icao}</span>
                          <span className="text-xs text-white truncate">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Aircraft Type</label>
                  <input placeholder="Boeing 737-800" value={routeForm.aircraft_type}
                    onChange={(e) => setRouteForm({ ...routeForm, aircraft_type: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Base Ticket Price</label>
                  <input type="number" placeholder="299" value={routeForm.base_ticket_price}
                    onChange={(e) => setRouteForm({ ...routeForm, base_ticket_price: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addRoute} disabled={routeLoading}
                  className="bg-aero text-black font-bold px-5 py-2 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                  {routeLoading ? 'Adding...' : 'Add Route'}
                </button>
                <button onClick={() => setShowAddRoute(false)} className="text-gray-400 hover:text-white text-sm transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {routes.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-gray-500">No routes yet</div>
          ) : (
            routes.map((route) => (
              <div key={route.id} className="glass-card rounded-2xl p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold">{route.origin.icao}</span>
                    <span className="text-gray-500">→</span>
                    <span className="font-mono font-bold">{route.destination.icao}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border ml-1', STATUS_COLORS[route.status])}>
                      {route.status}
                    </span>
                    {route.is_saturated && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-orange-500/20 text-orange-400 bg-orange-500/10">
                        SATURATED −15%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {route.distance_nm.toLocaleString()} nm · {route.aircraft_type} · ${route.effective_ticket_price}
                    {route.is_saturated && <span className="text-orange-400"> (base: ${route.base_ticket_price})</span>}
                  </p>
                </div>
                {isManager && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => toggleRouteStatus(route)}
                      className={cn('text-xs px-3 py-1.5 rounded-lg border transition',
                        route.status === 'ACTIVE'
                          ? 'text-amber-400 border-amber-500/20 hover:bg-amber-500/10'
                          : 'text-green-400 border-green-500/20 hover:bg-green-500/10')}>
                      {route.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                    <button onClick={() => deleteRoute(route.id)}
                      className="text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
