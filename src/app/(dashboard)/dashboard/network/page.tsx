'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Runway { le_ident: string | null; he_ident: string | null; length_ft: number | null; width_ft: number | null; surface: string | null; lighted: boolean }
interface AirportInfo {
  icao: string; iata: string | null; name: string; city: string | null; country: string;
  latitude: string; longitude: string; facility_type: string; has_helipad: boolean;
  elevation_ft: number | null; timezone: string; demand_index: string;
  runways: Runway[];
}
interface Hub { id: string; type: 'PRIMARY' | 'SECONDARY'; airport: AirportInfo }
interface Waypoint { id?: string; icao: string; name?: string; sort_order: number }
interface Route {
  id: string; distance_nm: number; aircraft_type: string; route_type: string;
  status: string; is_saturated: boolean; base_ticket_price: number;
  effective_ticket_price: number; estimated_block_min: number;
  origin: { icao: string; name: string; city: string | null; latitude: string; longitude: string; demand_index: string; timezone: string };
  destination: { icao: string; name: string; city: string | null; latitude: string; longitude: string; demand_index: string; timezone: string };
  waypoints: Waypoint[];
}
interface Airport { id: string; icao: string; name: string; city: string | null; country: string; facility_type: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE_TYPES = [
  { key: 'SCHEDULED',    label: 'Scheduled',    icon: '🗓️' },
  { key: 'CARGO',        label: 'Cargo',        icon: '📦' },
  { key: 'CHARTER',      label: 'Charter',      icon: '🎯' },
  { key: 'MEDEVAC',      label: 'Medevac',      icon: '🏥' },
  { key: 'BUSH',         label: 'Bush',         icon: '🌲' },
  { key: 'OFFSHORE',     label: 'Offshore',     icon: '🛢️' },
  { key: 'VIP',          label: 'VIP',          icon: '⭐' },
  { key: 'MILITARY',     label: 'Military',     icon: '🎖️' },
  { key: 'HUMANITARIAN', label: 'Humanitarian', icon: '❤️' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'text-green-400 bg-green-500/10 border-green-500/20',
  SEASONAL:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  SUSPENDED: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBlockTime(min: number) {
  const h = Math.floor(min / 60); const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

// Deterministic "weather" from airport demand + timezone local hour
function getWeatherSnapshot(airport: { demand_index: string; timezone: string; icao: string }): {
  summary: string; icon: string; icing: boolean; turbulence: 'NIL' | 'LIGHT' | 'MOD' | 'SEV';
} {
  const demand = Number(airport.demand_index);
  const hash = airport.icao.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  let localHour = 12;
  try { localHour = new Date().toLocaleTimeString('en-US', { timeZone: airport.timezone, hour: 'numeric', hour12: false }) as unknown as number; } catch { /* */ }
  const h = Number(localHour);

  // Night = calmer; morning/evening = more activity
  const isNight = h < 6 || h > 22;
  const isPeak = (h >= 7 && h <= 9) || (h >= 16 && h <= 19);

  // Deterministic turbulence from hash
  const turbIdx = hash % 4;
  const turbulence: ('NIL' | 'LIGHT' | 'MOD' | 'SEV')[] = ['NIL', 'LIGHT', 'MOD', 'SEV'];
  const turb = isNight ? 'NIL' : turbulence[turbIdx % (isPeak ? 3 : 2)];
  const icing = (hash % 7 === 0) && demand < 0.4;

  const conditions = [
    { cond: demand > 0.9 && isPeak, summary: 'Heavy Traffic', icon: '🟡' },
    { cond: icing, summary: 'Icing Risk', icon: '🧊' },
    { cond: turb === 'MOD' || turb === 'SEV', summary: `${turb === 'SEV' ? 'Severe' : 'Moderate'} Turbulence`, icon: '⚡' },
    { cond: isNight, summary: 'Night Ops', icon: '🌙' },
    { cond: hash % 5 === 0 && demand < 0.6, summary: 'Crosswind Advisory', icon: '💨' },
    { cond: hash % 11 === 0, summary: 'Low Visibility', icon: '🌫️' },
    { cond: true, summary: 'Clear', icon: '☀️' },
  ];
  const wx = conditions.find(c => c.cond)!;
  return { summary: wx.summary, icon: wx.icon, icing, turbulence: turb };
}

// ─── Route Arc SVG ────────────────────────────────────────────────────────────

function RouteArcMap({ route }: { route: Route }) {
  const W = 280; const H = 80; const PAD = 12;

  const oLat = Number(route.origin.latitude); const oLon = Number(route.origin.longitude);
  const dLat = Number(route.destination.latitude); const dLon = Number(route.destination.longitude);

  // Bounding box
  const wps = route.waypoints.map(w => ({ lat: oLat, lon: oLon })); // placeholders, ICAOs only for now
  const allLons = [oLon, dLon]; const allLats = [oLat, dLat];
  const lonPad = (Math.max(...allLons) - Math.min(...allLons)) * 0.2 || 5;
  const latPad = (Math.max(...allLats) - Math.min(...allLats)) * 0.2 || 5;
  const minLon = Math.min(...allLons) - lonPad; const maxLon = Math.max(...allLons) + lonPad;
  const minLat = Math.min(...allLats) - latPad; const maxLat = Math.max(...allLats) + latPad;

  function proj(lat: number, lon: number): [number, number] {
    const x = PAD + ((lon - minLon) / (maxLon - minLon)) * (W - PAD * 2);
    const y = PAD + ((maxLat - lat) / (maxLat - minLat)) * (H - PAD * 2);
    return [x, y];
  }

  const [ox, oy] = proj(oLat, oLon);
  const [dx, dy] = proj(dLat, dLon);
  const mx = (ox + dx) / 2;
  const my = Math.min(oy, dy) - 18;

  return (
    <div className="rounded-lg overflow-hidden bg-black/30 border border-white/5 flex-shrink-0" style={{ width: W, height: H }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        {/* Arc glow */}
        <path d={`M${ox},${oy} Q${mx},${my} ${dx},${dy}`} fill="none" stroke="#00D1FF" strokeWidth="5" strokeOpacity="0.08" />
        {/* Arc */}
        <path d={`M${ox},${oy} Q${mx},${my} ${dx},${dy}`} fill="none" stroke="#00D1FF" strokeWidth="1.5"
          strokeLinecap="round" strokeDasharray="4,3" />
        {/* Origin */}
        <circle cx={ox} cy={oy} r="4" fill="#0A0A0A" stroke="#00D1FF" strokeWidth="1.5" />
        <circle cx={ox} cy={oy} r="1.5" fill="#00D1FF" />
        <text x={ox} y={oy - 6} textAnchor="middle" fontSize="7" fill="#00D1FF" fontFamily="monospace" fontWeight="700">{route.origin.icao}</text>
        {/* Destination */}
        <circle cx={dx} cy={dy} r="4" fill="#0A0A0A" stroke="#fff" strokeWidth="1.5" />
        <circle cx={dx} cy={dy} r="1.5" fill="#fff" />
        <text x={dx} y={dy - 6} textAnchor="middle" fontSize="7" fill="#fff" fontFamily="monospace" fontWeight="700">{route.destination.icao}</text>
      </svg>
    </div>
  );
}

// ─── Demand Bar ───────────────────────────────────────────────────────────────

function DemandBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className={pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'}>{pct}%</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({ route, isManager, onUpdate, onDelete }: {
  route: Route; isManager: boolean;
  onUpdate: (updated: Partial<Route> & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingWaypoints, setEditingWaypoints] = useState(false);
  const [wpInput, setWpInput] = useState(route.waypoints.map(w => w.icao).join(', '));
  const [savingWp, setSavingWp] = useState(false);
  const [savingType, setSavingType] = useState(false);

  const rtInfo = ROUTE_TYPES.find(r => r.key === route.route_type) ?? ROUTE_TYPES[0];
  const demandAvg = (Number(route.origin.demand_index) + Number(route.destination.demand_index)) / 2;
  const wxOrigin = getWeatherSnapshot(route.origin);
  const wxDest = getWeatherSnapshot(route.destination);

  async function handleTypeChange(newType: string) {
    setSavingType(true);
    await api.patch(`/network/routes/${route.id}/type`, { route_type: newType });
    onUpdate({ id: route.id, route_type: newType });
    setSavingType(false);
  }

  async function saveWaypoints() {
    setSavingWp(true);
    const icaos = wpInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const waypoints = icaos.map((icao, i) => ({ icao, sort_order: i }));
    const { data } = await api.post(`/network/routes/${route.id}/waypoints`, { waypoints });
    onUpdate({ id: route.id, waypoints: data });
    setEditingWaypoints(false);
    setSavingWp(false);
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-transparent hover:border-white/5 transition">
      {/* Main row */}
      <div className="p-4 flex gap-4 items-start">
        {/* Mini arc map */}
        <RouteArcMap route={route} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Top row: route + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-bold text-aero">{route.origin.icao}</span>
            <span className="text-gray-500 text-sm">→</span>
            <span className="font-mono font-bold text-white">{route.destination.icao}</span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', STATUS_COLORS[route.status])}>
              {route.status}
            </span>
            {/* Route type badge */}
            {isManager ? (
              <select value={route.route_type} disabled={savingType}
                onChange={e => handleTypeChange(e.target.value)}
                className="text-[10px] font-bold rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-gray-300 focus:border-aero focus:outline-none cursor-pointer">
                {ROUTE_TYPES.map(rt => (
                  <option key={rt.key} value={rt.key}>{rt.icon} {rt.label}</option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-300">
                {rtInfo.icon} {rtInfo.label}
              </span>
            )}
            {route.is_saturated && (
              <span className="text-[10px] text-orange-400 border border-orange-500/20 bg-orange-500/5 px-2 py-0.5 rounded-full font-bold">SATURATED −15%</span>
            )}
          </div>

          {/* Airport names */}
          <p className="text-xs text-gray-500 mb-2 truncate">
            {route.origin.name}{route.origin.city ? ` (${route.origin.city})` : ''} → {route.destination.name}{route.destination.city ? ` (${route.destination.city})` : ''}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
            <span className="font-mono font-bold text-white">{route.distance_nm.toLocaleString()} nm</span>
            <span>⏱ {formatBlockTime(route.estimated_block_min)}</span>
            <span>💰 ${Number(route.effective_ticket_price).toLocaleString()}{route.is_saturated ? ` (base $${Number(route.base_ticket_price).toLocaleString()})` : ''}</span>
            <span className="text-gray-500">{route.aircraft_type}</span>
          </div>

          {/* Demand */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2 max-w-xs">
            <DemandBar label={`${route.origin.icao} demand`} value={Number(route.origin.demand_index)} />
            <DemandBar label={`${route.destination.icao} demand`} value={Number(route.destination.demand_index)} />
          </div>

          {/* Weather */}
          <div className="flex gap-3 text-[10px] text-gray-500 flex-wrap">
            <span>{wxOrigin.icon} {route.origin.icao}: {wxOrigin.summary}</span>
            <span className="text-gray-700">·</span>
            <span>{wxDest.icon} {route.destination.icao}: {wxDest.summary}</span>
            {(wxDest.icing || wxOrigin.icing) && <span className="text-blue-400">🧊 Icing Risk</span>}
            {(wxDest.turbulence !== 'NIL' || wxOrigin.turbulence !== 'NIL') && (
              <span className={wxDest.turbulence === 'SEV' || wxOrigin.turbulence === 'SEV' ? 'text-red-400' : 'text-amber-400'}>
                ⚡ TURB: {[wxOrigin.turbulence, wxDest.turbulence].filter(t => t !== 'NIL').join('/')}
              </span>
            )}
          </div>

          {/* Waypoints */}
          {route.waypoints.length > 0 && !editingWaypoints && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-gray-600">Via:</span>
              {route.waypoints.map(w => (
                <span key={w.icao} className="text-[10px] font-mono text-gray-400 border border-white/10 px-1.5 py-0.5 rounded">{w.icao}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-white border border-white/10 px-2 py-1 rounded-lg transition">
            {expanded ? 'Less' : 'More'}
          </button>
          {isManager && (
            <>
              <button onClick={() => setEditingWaypoints(!editingWaypoints)}
                className="text-[10px] text-aero border border-aero/20 px-2 py-1 rounded-lg hover:bg-aero/10 transition">
                Waypoints
              </button>
              <button onClick={() => onDelete(route.id)}
                className="text-[10px] text-red-400 border border-red-500/20 px-2 py-1 rounded-lg hover:bg-red-500/10 transition">
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Waypoints editor */}
      {editingWaypoints && isManager && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <label className="text-xs text-gray-400 block mb-1.5">Waypoints (comma-separated ICAOs)</label>
          <div className="flex gap-2">
            <input value={wpInput} onChange={e => setWpInput(e.target.value)}
              placeholder="KBFI, KSEA, KPDX..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white font-mono focus:border-aero focus:outline-none transition" />
            <button onClick={saveWaypoints} disabled={savingWp}
              className="text-xs bg-aero text-black font-bold px-3 py-2 rounded-xl disabled:opacity-50 hover:brightness-110 transition">
              {savingWp ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditingWaypoints(false)}
              className="text-xs text-gray-500 hover:text-white px-2 transition">✕</button>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">Waypoints will appear on the route arc and in the flight dispatcher.</p>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 grid grid-cols-2 gap-4 text-xs">
          {[
            { label: 'Avg Demand', value: `${Math.round(demandAvg * 100)}%` },
            { label: 'Block Time', value: formatBlockTime(route.estimated_block_min) },
            { label: 'Origin WX', value: `${wxOrigin.icon} ${wxOrigin.summary}` },
            { label: 'Dest WX', value: `${wxDest.icon} ${wxDest.summary}` },
            { label: 'Icing', value: wxOrigin.icing || wxDest.icing ? '⚠️ Risk' : 'Clear' },
            { label: 'Turbulence', value: [wxOrigin.turbulence, wxDest.turbulence].filter(t => t !== 'NIL').join('/') || 'NIL' },
          ].map(r => (
            <div key={r.label}>
              <p className="text-gray-500 mb-0.5">{r.label}</p>
              <p className="text-white">{r.value}</p>
            </div>
          ))}
          {isManager && (
            <div className="col-span-2 flex gap-2 pt-1">
              <button onClick={async () => {
                const next = route.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                await api.patch(`/network/routes/${route.id}/status`, { status: next });
                onUpdate({ id: route.id, status: next });
              }} className={cn('text-xs px-3 py-1.5 rounded-lg border transition',
                route.status === 'ACTIVE' ? 'text-amber-400 border-amber-500/20 hover:bg-amber-500/10' : 'text-green-400 border-green-500/20 hover:bg-green-500/10')}>
                {route.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Route Form ───────────────────────────────────────────────────────────

function AddRouteForm({ onAdd, onCancel }: { onAdd: (r: Route) => void; onCancel: () => void }) {
  const [originSearch, setOriginSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [originResults, setOriginResults] = useState<Airport[]>([]);
  const [destResults, setDestResults] = useState<Airport[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Airport | null>(null);
  const [selectedDest, setSelectedDest] = useState<Airport | null>(null);
  const [form, setForm] = useState({ aircraft_type: '', base_ticket_price: '', route_type: 'SCHEDULED' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback(async (q: string, setter: (r: Airport[]) => void) => {
    if (q.length < 2) { setter([]); return; }
    const { data } = await publicApi.get(`/network/airports/search?q=${encodeURIComponent(q)}`);
    setter(data);
  }, []);

  async function submit() {
    if (!selectedOrigin || !selectedDest || !form.aircraft_type || !form.base_ticket_price) return;
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/network/routes', {
        origin_id: selectedOrigin.icao,
        destination_id: selectedDest.icao,
        distance_nm: 0,
        aircraft_type: form.aircraft_type,
        base_ticket_price: parseFloat(form.base_ticket_price),
        route_type: form.route_type,
      });
      onAdd(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to create route.');
    } finally { setLoading(false); }
  }

  const inputCls = 'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none transition';

  return (
    <div className="glass-card rounded-2xl p-6 border border-aero/20 mb-4">
      <h3 className="font-bold mb-4">New Route</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Origin */}
        <div className="relative">
          <label className="text-xs text-gray-400 block mb-1">Origin *</label>
          {selectedOrigin ? (
            <div className="flex items-center justify-between rounded-xl border border-aero/30 bg-aero/5 px-3 py-2 text-sm">
              <span className="font-mono text-aero">{selectedOrigin.icao} — {selectedOrigin.name}</span>
              <button onClick={() => setSelectedOrigin(null)} className="text-gray-500 hover:text-white ml-2">✕</button>
            </div>
          ) : (
            <input placeholder="Search origin..." value={originSearch} className={inputCls}
              onChange={e => { setOriginSearch(e.target.value); search(e.target.value, setOriginResults); }} />
          )}
          {originResults.length > 0 && !selectedOrigin && (
            <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-xl">
              {originResults.map(a => (
                <button key={a.id} type="button" onClick={() => { setSelectedOrigin(a); setOriginResults([]); setOriginSearch(''); }}
                  className="w-full flex gap-2 px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                  <span className="font-mono text-xs text-aero w-12">{a.icao}</span>
                  <span className="text-xs text-white truncate">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Destination */}
        <div className="relative">
          <label className="text-xs text-gray-400 block mb-1">Destination *</label>
          {selectedDest ? (
            <div className="flex items-center justify-between rounded-xl border border-aero/30 bg-aero/5 px-3 py-2 text-sm">
              <span className="font-mono text-aero">{selectedDest.icao} — {selectedDest.name}</span>
              <button onClick={() => setSelectedDest(null)} className="text-gray-500 hover:text-white ml-2">✕</button>
            </div>
          ) : (
            <input placeholder="Search destination..." value={destSearch} className={inputCls}
              onChange={e => { setDestSearch(e.target.value); search(e.target.value, setDestResults); }} />
          )}
          {destResults.length > 0 && !selectedDest && (
            <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-xl">
              {destResults.map(a => (
                <button key={a.id} type="button" onClick={() => { setSelectedDest(a); setDestResults([]); setDestSearch(''); }}
                  className="w-full flex gap-2 px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                  <span className="font-mono text-xs text-aero w-12">{a.icao}</span>
                  <span className="text-xs text-white truncate">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Aircraft Type *</label>
          <input placeholder="Boeing 737-800" value={form.aircraft_type} className={inputCls}
            onChange={e => setForm({ ...form, aircraft_type: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Base Ticket Price *</label>
          <input type="number" placeholder="299" value={form.base_ticket_price} className={inputCls}
            onChange={e => setForm({ ...form, base_ticket_price: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 block mb-1">Route Type</label>
          <select value={form.route_type} onChange={e => setForm({ ...form, route_type: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-aero focus:outline-none transition">
            {ROUTE_TYPES.map(rt => <option key={rt.key} value={rt.key}>{rt.icon} {rt.label}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={loading || !selectedOrigin || !selectedDest || !form.aircraft_type || !form.base_ticket_price}
          className="bg-aero text-black font-bold px-5 py-2 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
          {loading ? 'Adding…' : 'Add Route'}
        </button>
        <button onClick={onCancel} className="text-gray-400 hover:text-white text-sm transition">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [tab, setTab] = useState<'routes' | 'hubs'>('routes');
  const [loading, setLoading] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);

  // Hub state
  const [hubSearch, setHubSearch] = useState('');
  const [hubResults, setHubResults] = useState<Airport[]>([]);
  const [addingHub, setAddingHub] = useState(false);
  const [hubError, setHubError] = useState('');

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
        {(['routes', 'hubs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition capitalize',
              tab === t ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t} ({t === 'routes' ? routes.length : hubs.length})
          </button>
        ))}
      </div>

      {/* ── Routes tab ── */}
      {tab === 'routes' && (
        <div className="flex flex-col gap-3">
          {showAddRoute && (
            <AddRouteForm
              onAdd={r => { setRoutes([r, ...routes]); setShowAddRoute(false); }}
              onCancel={() => setShowAddRoute(false)}
            />
          )}
          {routes.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
              <p className="text-4xl mb-3">🌐</p>
              <p>No routes yet. Add your first route above.</p>
            </div>
          ) : (
            routes.map(route => (
              <RouteCard key={route.id} route={route} isManager={isManager}
                onUpdate={upd => setRoutes(routes.map(r => r.id === upd.id ? { ...r, ...upd } : r))}
                onDelete={id => { api.delete(`/network/routes/${id}`); setRoutes(routes.filter(r => r.id !== id)); }}
              />
            ))
          )}
        </div>
      )}

      {/* ── Hubs tab ── */}
      {tab === 'hubs' && (
        <div className="flex flex-col gap-4">
          {isManager && (
            <div className="relative">
              <input type="text" placeholder="Search airport to add as hub..."
                value={hubSearch}
                onChange={e => { setHubSearch(e.target.value); searchAirports(e.target.value, setHubResults); }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none transition"
              />
              {hubResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl">
                  {hubResults.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-aero">{a.icao}</p>
                        <p className="text-xs text-gray-400 truncate">{a.name}</p>
                      </div>
                      <button onClick={() => addHub(a, 'PRIMARY')} disabled={addingHub}
                        className="text-xs text-aero border border-aero/30 px-2 py-1 rounded-lg hover:bg-aero/10 transition">Primary</button>
                      <button onClick={() => addHub(a, 'SECONDARY')} disabled={addingHub}
                        className="text-xs text-gray-400 border border-white/20 px-2 py-1 rounded-lg hover:bg-white/5 transition">Secondary</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {hubError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{hubError}</p>}
          {hubs.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
              <p className="text-4xl mb-3">🏢</p><p>No hubs added yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {hubs.map(hub => {
                const a = hub.airport;
                return (
                  <div key={hub.id} className={cn('glass-card rounded-2xl p-5 flex flex-col gap-4 border', hub.type === 'PRIMARY' ? 'border-aero/25' : 'border-white/10')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-2xl font-extrabold text-white">{a.icao}</span>
                          {a.iata && <span className="font-mono text-sm text-gray-500">/ {a.iata}</span>}
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg border', hub.type === 'PRIMARY' ? 'text-aero border-aero/30 bg-aero/10' : 'text-gray-400 border-white/20 bg-white/5')}>{hub.type}</span>
                        </div>
                        <p className="text-sm font-medium text-white mt-0.5">{a.name}</p>
                        <p className="text-xs text-gray-500">{a.city ? `${a.city}, ` : ''}{a.country}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-white/5 pt-3">
                      <div><p className="text-gray-500 mb-0.5">Coordinates</p><p className="font-mono text-gray-300">{Number(a.latitude).toFixed(4)}° {Number(a.longitude).toFixed(4)}°</p></div>
                      <div><p className="text-gray-500 mb-0.5">Elevation</p><p className="font-mono text-gray-300">{a.elevation_ft != null ? `${a.elevation_ft.toLocaleString()} ft` : '—'}</p></div>
                      <div><p className="text-gray-500 mb-0.5">Timezone</p><p className="font-mono text-gray-300 text-[11px]">{a.timezone}</p></div>
                      <div><p className="text-gray-500 mb-0.5">Demand</p><DemandBar label="" value={Number(a.demand_index)} /></div>
                    </div>
                    {a.runways.length > 0 && (
                      <div className="border-t border-white/5 pt-3">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Runways ({a.runways.length})</p>
                        {a.runways.map((rwy, i) => (
                          <div key={i} className="flex items-center justify-between text-xs mb-1">
                            <span className="font-mono text-gray-300">{rwy.le_ident ?? '?'}/{rwy.he_ident ?? '?'}</span>
                            <span className="text-gray-500">{rwy.length_ft != null ? `${rwy.length_ft.toLocaleString()} ft` : '—'}</span>
                            <span className="text-gray-600">{rwy.surface ?? '—'}{rwy.lighted ? ' · lit' : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isManager && (
                      <button onClick={() => { api.delete(`/network/hubs/${hub.id}`); setHubs(hubs.filter(h => h.id !== hub.id)); }}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:bg-red-500/5 px-3 py-1.5 rounded-lg w-full text-center transition">
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
    </div>
  );
}
