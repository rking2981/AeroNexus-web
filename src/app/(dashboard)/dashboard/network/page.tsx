'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const RouteMapInner = dynamic(() => import('@/components/RouteMapInner'), { ssr: false, loading: () => <div style={{ height: 280, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} /> });

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
  flight_number: string | null; departure_gate: string | null; arrival_gate: string | null;
  status: string; is_saturated: boolean; base_ticket_price: number;
  business_price: number | null; first_price: number | null;
  cabin_split: { economy: number; business: number; first: number } | null;
  demand_score: number | null; weekly_flights: number | null;
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

function formatBlockTime(min: number | null | undefined) {
  if (!min || isNaN(min)) return '—';
  const h = Math.floor(min / 60); const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

// ─── METAR types ──────────────────────────────────────────────────────────────

interface Metar {
  icao: string;
  raw: string;
  obs_time: string | null;
  wind_dir: number | null;
  wind_speed: number | null;
  wind_gust: number | null;
  visibility_sm: number | null;
  sky_conditions: { coverage: string; base_ft: number | null }[];
  temp_c: number | null;
  dewpoint_c: number | null;
  altimeter_hg: number | null;
  wx_string: string | null;
  flight_category: string | null;
  icing_risk: boolean;
  fetched_at: string;
}

const FC_COLORS: Record<string, string> = {
  VFR:  'text-green-400 border-green-500/20 bg-green-500/5',
  MVFR: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
  IFR:  'text-red-400 border-red-500/20 bg-red-500/5',
  LIFR: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
};

const SKY_LABELS: Record<string, string> = {
  CLR: 'Clear', SKC: 'Clear', FEW: 'Few', SCT: 'Scattered',
  BKN: 'Broken', OVC: 'Overcast', OVX: 'Obscured',
};

const WX_ICONS: Record<string, string> = {
  TS: '⛈️', RA: '🌧️', SN: '❄️', FG: '🌫️', BR: '🌫️',
  DZ: '🌦️', GR: '🌨️', HZ: '😶‍🌫️', SQ: '💨', FZ: '🧊',
};

function wxIcon(wxString: string | null): string {
  if (!wxString) return '☀️';
  for (const [code, icon] of Object.entries(WX_ICONS)) {
    if (wxString.includes(code)) return icon;
  }
  return '🌤️';
}

function windDescription(dir: number | null, spd: number | null, gust: number | null): string {
  if (spd === null) return 'Wind unknown';
  if (spd === 0) return 'Calm';
  const dirStr = dir !== null ? `${dir.toString().padStart(3, '0')}°` : 'VRB';
  const gustStr = gust ? ` G${gust}` : '';
  return `${dirStr} @ ${spd}${gustStr} kt`;
}


// ─── Demand Bar ───────────────────────────────────────────────────────────────

function DemandBar({ label, value }: { label: string; value: number }) {
  const safe = isFinite(value) ? value : 0.5; // default to 50% if null/undefined/NaN
  const pct = Math.round(safe * 100);
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

function MetarPanel({ icao }: { icao: string }) {
  const [metar, setMetar] = useState<Metar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi.get(`/weather/${icao}`)
      .then(r => setMetar(r.data))
      .catch(() => setMetar(null))
      .finally(() => setLoading(false));
  }, [icao]);

  if (loading) return <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />;
  if (!metar) return <span className="text-[10px] text-gray-600">No METAR available</span>;

  const fc = metar.flight_category;
  const icon = wxIcon(metar.wx_string);
  const ceiling = metar.sky_conditions.find(s => s.coverage === 'BKN' || s.coverage === 'OVC');

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">{icon}</span>
        {fc && (
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', FC_COLORS[fc] ?? 'text-gray-400 border-white/10')}>
            {fc}
          </span>
        )}
        <span className="text-[10px] text-gray-400">{windDescription(metar.wind_dir, metar.wind_speed, metar.wind_gust)}</span>
        {metar.visibility_sm !== null && metar.visibility_sm < 3 && (
          <span className="text-[10px] text-amber-400">🌫️ Vis {metar.visibility_sm}SM</span>
        )}
        {ceiling && ceiling.base_ft !== null && ceiling.base_ft < 1000 && (
          <span className="text-[10px] text-red-400">Ceiling {ceiling.base_ft.toLocaleString()}ft</span>
        )}
        {metar.icing_risk && <span className="text-[10px] text-blue-400">🧊 Icing</span>}
        {metar.wx_string && <span className="text-[10px] text-gray-400">{metar.wx_string}</span>}
      </div>
      {metar.temp_c !== null && (
        <span className="text-[10px] text-gray-600 font-mono">
          {metar.temp_c}°C / {metar.dewpoint_c}°C · {metar.altimeter_hg?.toFixed(2)}&quot;Hg
        </span>
      )}
    </div>
  );
}

function RouteCard({ route, isManager, onUpdate, onDelete, onReverse }: {
  route: Route; isManager: boolean;
  onUpdate: (updated: Partial<Route> & { id: string }) => void;
  onDelete: (id: string) => void;
  onReverse: (newRoute: Route) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingRoute, setEditingRoute] = useState(false);
  const [editingWaypoints, setEditingWaypoints] = useState(false);
  const [wpInput, setWpInput] = useState(route.waypoints.map(w => w.icao).join(', '));
  const [savingWp, setSavingWp] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [editingFn, setEditingFn] = useState(false);
  const [fnInput, setFnInput] = useState(route.flight_number ?? '');
  const [savingFn, setSavingFn] = useState(false);
  const [creatingReverse, setCreatingReverse] = useState(false);
  const [reverseError, setReverseError] = useState('');

  const rtInfo = ROUTE_TYPES.find(r => r.key === route.route_type) ?? ROUTE_TYPES[0];
  const originDemand = isFinite(Number(route.origin.demand_index)) ? Number(route.origin.demand_index) : 0.5;
  const destDemand   = isFinite(Number(route.destination.demand_index)) ? Number(route.destination.demand_index) : 0.5;
  const demandAvg    = (originDemand + destDemand) / 2;

  async function handleTypeChange(newType: string) {
    setSavingType(true);
    await api.patch(`/network/routes/${route.id}/type`, { route_type: newType });
    onUpdate({ id: route.id, route_type: newType });
    setSavingType(false);
  }

  async function saveFlightNumber() {
    setSavingFn(true);
    await api.patch(`/network/routes/${route.id}/flight-number`, { flight_number: fnInput || null });
    onUpdate({ id: route.id, flight_number: fnInput || null });
    setEditingFn(false);
    setSavingFn(false);
  }

  async function createReverse() {
    setCreatingReverse(true); setReverseError('');
    try {
      const { data } = await api.post(`/network/routes/${route.id}/reverse`);
      onReverse(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setReverseError(msg ?? 'Failed to create reverse route.');
    } finally { setCreatingReverse(false); }
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
        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Top row: route + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Flight number */}
            {editingFn ? (
              <div className="flex items-center gap-1">
                <input value={fnInput} onChange={e => setFnInput(e.target.value.toUpperCase())}
                  placeholder="AN100" maxLength={8}
                  className="w-20 rounded-lg border border-aero/40 bg-black/40 px-2 py-0.5 text-sm font-mono text-aero font-bold focus:outline-none" />
                <button onClick={saveFlightNumber} disabled={savingFn}
                  className="text-[10px] bg-aero text-black font-bold px-2 py-0.5 rounded disabled:opacity-50">
                  {savingFn ? '…' : '✓'}
                </button>
                <button onClick={() => { setEditingFn(false); setFnInput(route.flight_number ?? ''); }}
                  className="text-[10px] text-gray-500 hover:text-white px-1">✕</button>
              </div>
            ) : (
              <button
                onClick={() => isManager && setEditingFn(true)}
                className={cn('font-mono font-bold text-sm px-2 py-0.5 rounded border transition',
                  route.flight_number
                    ? 'text-aero border-aero/30 bg-aero/10 hover:bg-aero/20'
                    : isManager ? 'text-gray-600 border-white/10 bg-white/3 hover:border-aero/20 hover:text-gray-400' : 'hidden')}
                title={isManager ? 'Click to set flight number' : undefined}
              >
                {route.flight_number ?? '+ Flight #'}
              </button>
            )}
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

          {/* Weather — real METAR from aviationweather.gov */}
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-gray-600 text-[10px] w-10 flex-shrink-0 pt-0.5">{route.origin.icao}</span>
              <MetarPanel icao={route.origin.icao} />
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-600 text-[10px] w-10 flex-shrink-0 pt-0.5">{route.destination.icao}</span>
              <MetarPanel icao={route.destination.icao} />
            </div>
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
              <button onClick={() => setEditingRoute(true)}
                className="text-[10px] text-aero border border-aero/20 px-2 py-1 rounded-lg hover:bg-aero/10 transition">
                Edit
              </button>
              <button onClick={() => setEditingWaypoints(!editingWaypoints)}
                className="text-[10px] text-aero border border-aero/20 px-2 py-1 rounded-lg hover:bg-aero/10 transition">
                Waypoints
              </button>
              <button onClick={createReverse} disabled={creatingReverse}
                className="text-[10px] text-gray-400 border border-white/10 px-2 py-1 rounded-lg hover:bg-white/5 transition disabled:opacity-40"
                title="Create reverse route (swap origin/destination)">
                {creatingReverse ? '…' : '⇄ Reverse'}
              </button>
              <button onClick={() => onDelete(route.id)}
                className="text-[10px] text-red-400 border border-red-500/20 px-2 py-1 rounded-lg hover:bg-red-500/10 transition">
                Delete
              </button>
            </>
          )}
          {editingRoute && (
            <EditRouteModal route={route} onClose={() => setEditingRoute(false)} onSave={(updated) => { onUpdate(updated); setEditingRoute(false); }} />
          )}
          {reverseError && (
            <p className="text-[10px] text-red-400 max-w-24 text-right">{reverseError}</p>
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
        <div className="px-4 pb-4 border-t border-white/5 pt-3 text-xs">
          <div className="mb-4">
            <RouteMapInner
              originLat={Number(route.origin.latitude)}
              originLon={Number(route.origin.longitude)}
              destLat={Number(route.destination.latitude)}
              destLon={Number(route.destination.longitude)}
              originIcao={route.origin.icao}
              destIcao={route.destination.icao}
            />
          </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Demand Score', value: route.demand_score ? `${Math.round(Number(route.demand_score) * 100)}%` : `${Math.round(demandAvg * 100)}%` },
            { label: 'Block Time', value: formatBlockTime(route.estimated_block_min) },
            { label: 'Aircraft', value: route.aircraft_type },
            { label: 'Weekly Flights', value: route.weekly_flights?.toString() ?? '0' },
            { label: '💺 Economy', value: `$${Number(route.effective_ticket_price).toLocaleString()}` },
            { label: '🪑 Business', value: `$${Math.round(route.business_price != null ? Number(route.business_price) : Number(route.base_ticket_price) * 2.5).toLocaleString()}` },
            { label: '👑 First', value: `$${Math.round(route.first_price != null ? Number(route.first_price) : Number(route.base_ticket_price) * 4).toLocaleString()}` },
            { label: 'Cabin Split', value: route.cabin_split ? `${Math.round(route.cabin_split.economy * 100)}% eco / ${Math.round(route.cabin_split.business * 100)}% biz / ${Math.round(route.cabin_split.first * 100)}% first` : '100% economy' },
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
        </div>
      )}
    </div>
  );
}

// ─── Edit Route Modal ─────────────────────────────────────────────────────────

function EditRouteModal({ route, onSave, onClose }: { route: Route; onSave: (updated: Partial<Route> & { id: string }) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    aircraft_type: route.aircraft_type,
    base_ticket_price: String(route.base_ticket_price),
    business_price: route.business_price != null ? String(Math.round(Number(route.business_price))) : '',
    first_price: route.first_price != null ? String(Math.round(Number(route.first_price))) : '',
    flight_number: route.flight_number ?? '',
    departure_gate: route.departure_gate ?? '',
    arrival_gate: route.arrival_gate ?? '',
    route_type: route.route_type,
    status: route.status,
    cabin_economy: String(Math.round((route.cabin_split?.economy ?? 1) * 100)),
    cabin_business: String(Math.round((route.cabin_split?.business ?? 0) * 100)),
    cabin_first: String(Math.round((route.cabin_split?.first ?? 0) * 100)),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls = 'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none transition';

  const cabinTotal = (parseFloat(form.cabin_economy) || 0) + (parseFloat(form.cabin_business) || 0) + (parseFloat(form.cabin_first) || 0);

  async function save() {
    setSaving(true); setError('');
    try {
      const eco = parseFloat(form.cabin_economy) / 100;
      const biz = parseFloat(form.cabin_business) / 100;
      const fst = parseFloat(form.cabin_first) / 100;
      const payload = {
        aircraft_type: form.aircraft_type,
        base_ticket_price: parseFloat(form.base_ticket_price),
        business_price: form.business_price ? parseFloat(form.business_price) : null,
        first_price: form.first_price ? parseFloat(form.first_price) : null,
        flight_number: form.flight_number || null,
        departure_gate: form.departure_gate || null,
        arrival_gate: form.arrival_gate || null,
        route_type: form.route_type,
        status: form.status,
        cabin_split: Math.abs(eco + biz + fst - 1.0) < 0.01
          ? { economy: eco, business: biz, first: fst }
          : { economy: 1.0, business: 0, first: 0 },
      };
      await api.patch(`/network/routes/${route.id}`, payload);
      onSave({
        id: route.id,
        ...payload,
        effective_ticket_price: payload.base_ticket_price,
      });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to save changes.');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card rounded-2xl p-6 w-full max-w-lg border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Edit Route — {route.origin.icao} → {route.destination.icao}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Aircraft Type</label>
            <input value={form.aircraft_type} onChange={e => setForm({ ...form, aircraft_type: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Flight Number</label>
            <input value={form.flight_number} onChange={e => setForm({ ...form, flight_number: e.target.value.toUpperCase() })} maxLength={8} placeholder="AN100" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Departure Gate <span className="text-gray-600">(optional)</span></label>
            <input value={form.departure_gate} onChange={e => setForm({ ...form, departure_gate: e.target.value.toUpperCase() })} maxLength={10} placeholder="A21" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Arrival Gate <span className="text-gray-600">(optional)</span></label>
            <input value={form.arrival_gate} onChange={e => setForm({ ...form, arrival_gate: e.target.value.toUpperCase() })} maxLength={10} placeholder="B38" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Economy Price ($)</label>
            <input type="number" min="1" max="5000" value={form.base_ticket_price}
              onChange={e => setForm({ ...form, base_ticket_price: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Business Price <span className="text-gray-600">(blank = auto 2.5×)</span></label>
            <input type="number" min="1" value={form.business_price} placeholder={form.base_ticket_price ? String(Math.round(Number(form.base_ticket_price) * 2.5)) : ''}
              onChange={e => setForm({ ...form, business_price: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">First Price <span className="text-gray-600">(blank = auto 4×)</span></label>
            <input type="number" min="1" value={form.first_price} placeholder={form.base_ticket_price ? String(Math.round(Number(form.base_ticket_price) * 4)) : ''}
              onChange={e => setForm({ ...form, first_price: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Route Type</label>
            <select value={form.route_type} onChange={e => setForm({ ...form, route_type: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-aero focus:outline-none transition">
              {ROUTE_TYPES.map(rt => <option key={rt.key} value={rt.key}>{rt.icon} {rt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-aero focus:outline-none transition">
              {['ACTIVE', 'SUSPENDED', 'SEASONAL'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs text-gray-400 block mb-1">Cabin Split <span className="text-gray-600">(% · must total 100%)</span></label>
          <div className="grid grid-cols-3 gap-2">
            {([['cabin_economy', '💺 Economy'], ['cabin_business', '🪑 Business'], ['cabin_first', '👑 First']] as const).map(([field, label]) => (
              <div key={field}>
                <label className="text-[10px] text-gray-500 block mb-1">{label}</label>
                <div className="relative">
                  <input type="number" min="0" max="100" value={form[field]}
                    onChange={e => setForm({ ...form, [field]: e.target.value })} className={inputCls} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                </div>
              </div>
            ))}
          </div>
          {cabinTotal !== 100
            ? <p className="text-xs text-red-400 mt-1">Total: {cabinTotal}% — must equal 100%</p>
            : <p className="text-xs text-green-400 mt-1">✓ {cabinTotal}%</p>}
        </div>

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={save} disabled={saving || cabinTotal !== 100}
            className="bg-aero text-black font-bold px-5 py-2 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm transition">Cancel</button>
        </div>
      </div>
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
  const [fleet, setFleet] = useState<{ id: string; registration: string; aircraft_type: string }[]>([]);
  const [form, setForm] = useState({
    aircraft_type: '', base_ticket_price: '', route_type: 'SCHEDULED', flight_number: '',
    cabin_economy: '100', cabin_business: '0', cabin_first: '0',
    departure_gate: '', arrival_gate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/fleet').then(r => {
      const active = (r.data as { id: string; registration: string; aircraft_type: string; status: string }[])
        .filter(h => h.status === 'ACTIVE');
      setFleet(active);
      if (active.length > 0) setForm(f => ({ ...f, aircraft_type: active[0].aircraft_type }));
    }).catch(() => {});
  }, []);

  const search = useCallback(async (q: string, setter: (r: Airport[]) => void) => {
    if (q.length < 2) { setter([]); return; }
    const { data } = await publicApi.get(`/network/airports/search?q=${encodeURIComponent(q)}`);
    setter(data);
  }, []);

  async function submit() {
    if (!selectedOrigin || !selectedDest || !form.aircraft_type.trim() || Number(form.base_ticket_price) < 1) return;
    setLoading(true); setError('');
    try {
      const eco = parseFloat(form.cabin_economy) / 100;
      const biz = parseFloat(form.cabin_business) / 100;
      const fst = parseFloat(form.cabin_first) / 100;
      const total = eco + biz + fst;
      const { data } = await api.post('/network/routes', {
        origin_id: selectedOrigin.icao,
        destination_id: selectedDest.icao,
        distance_nm: 0,
        aircraft_type: form.aircraft_type,
        base_ticket_price: parseFloat(form.base_ticket_price),
        route_type: form.route_type,
        flight_number: form.flight_number || undefined,
        departure_gate: form.departure_gate || undefined,
        arrival_gate: form.arrival_gate || undefined,
        cabin_split: Math.abs(total - 1.0) < 0.01
          ? { economy: eco, business: biz, first: fst }
          : { economy: 1.0, business: 0, first: 0 },
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
          <label className="text-xs text-gray-400 block mb-1">Aircraft *</label>
          {fleet.length > 0 ? (
            <select value={form.aircraft_type} onChange={e => setForm({ ...form, aircraft_type: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-aero focus:outline-none transition">
              {fleet.map(h => (
                <option key={h.id} value={h.aircraft_type}>
                  {h.registration} — {h.aircraft_type}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-500">
              No active aircraft in fleet
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Economy Price * <span className="text-gray-600">(max $2,500/pax · Business auto 2.5× · First auto 4×)</span></label>
          <input type="number" placeholder="299" min="1" max="2500" value={form.base_ticket_price} className={inputCls}
            onChange={e => setForm({ ...form, base_ticket_price: e.target.value })} />
          {form.base_ticket_price && Number(form.base_ticket_price) > 5000 && (
            <p className="text-xs text-amber-400 mt-1">⚠️ Prices above $5,000 result in 0 passengers — market won't support it.</p>
          )}
          {form.base_ticket_price && Number(form.base_ticket_price) > 0 && Number(form.base_ticket_price) <= 2500 && (
            <p className="text-xs text-gray-600 mt-1">
              Business: ${Math.round(Number(form.base_ticket_price) * 2.5).toLocaleString()} · First: ${Math.round(Number(form.base_ticket_price) * 4).toLocaleString()}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Cabin Split <span className="text-gray-600">(% of seats · must total 100%)</span></label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'cabin_economy', label: '💺 Economy', field: 'cabin_economy' as const },
              { key: 'cabin_business', label: '🪑 Business', field: 'cabin_business' as const },
              { key: 'cabin_first', label: '👑 First', field: 'cabin_first' as const },
            ].map(c => (
              <div key={c.key}>
                <label className="text-[10px] text-gray-500 block mb-1">{c.label}</label>
                <div className="relative">
                  <input type="number" min="0" max="100" value={form[c.field]} className={inputCls}
                    onChange={e => setForm({ ...form, [c.field]: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                </div>
              </div>
            ))}
          </div>
          {(() => {
            const total = (parseFloat(form.cabin_economy) || 0) + (parseFloat(form.cabin_business) || 0) + (parseFloat(form.cabin_first) || 0);
            return total !== 100 ? <p className="text-xs text-red-400 mt-1">Total: {total}% — must equal 100%</p>
              : <p className="text-xs text-green-400 mt-1">✓ {total}%</p>;
          })()}
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Route Type</label>
          <select value={form.route_type} onChange={e => setForm({ ...form, route_type: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-aero focus:outline-none transition">
            {ROUTE_TYPES.map(rt => <option key={rt.key} value={rt.key}>{rt.icon} {rt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Flight Number <span className="text-gray-600">(optional)</span></label>
          <input value={form.flight_number} onChange={e => setForm({ ...form, flight_number: e.target.value.toUpperCase() })}
            placeholder="AN100" maxLength={8} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Departure Gate <span className="text-gray-600">(optional · used by SayIntentions)</span></label>
          <input value={form.departure_gate} onChange={e => setForm({ ...form, departure_gate: e.target.value.toUpperCase() })}
            placeholder="A21" maxLength={10} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Arrival Gate <span className="text-gray-600">(optional · used by SayIntentions)</span></label>
          <input value={form.arrival_gate} onChange={e => setForm({ ...form, arrival_gate: e.target.value.toUpperCase() })}
            placeholder="B38" maxLength={10} className={inputCls} />
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={loading || !selectedOrigin || !selectedDest || !form.aircraft_type.trim() || Number(form.base_ticket_price) < 1}
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
  const isSuperUser = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';
  const perms = (user as { permissions?: Record<string, boolean> } | null)?.permissions;
  const isManager = isSuperUser || !!perms?.can_manage_routes;
  const canManageHubs = isSuperUser || !!perms?.can_manage_hubs;

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [tab, setTab] = useState<'routes' | 'hubs'>('routes');
  const [loading, setLoading] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);

  // Hub state
  const hubSearchRef = useRef<HTMLInputElement>(null);
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
        {((tab === 'routes' && isManager) || (tab === 'hubs' && canManageHubs)) && (
          <button onClick={() => tab === 'routes' ? setShowAddRoute(true) : hubSearchRef.current?.focus()}
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
                onReverse={newRoute => setRoutes(prev => [newRoute, ...prev])}
              />
            ))
          )}
        </div>
      )}

      {/* ── Hubs tab ── */}
      {tab === 'hubs' && (
        <div className="flex flex-col gap-4">
          {canManageHubs && (
            <div className="relative">
              <label className="block text-xs text-gray-400 mb-1.5">Search Airport by ICAO or Name</label>
              <input ref={hubSearchRef} type="text" placeholder="Search airport to add as hub..."
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
                    {canManageHubs && (
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
