'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CargoShipment {
  id: string;
  origin_icao: string;
  destination_icao: string;
  distance_nm: number;
  cargo_type: string;
  weight_kg: number;
  volume_m3: number;
  density_class: string;
  rate_per_kg: number;
  total_value: number;
  status: string;
  claimed_at: string | null;
  expires_at: string;
  flight_id: string | null;
}

interface HullCapacity {
  registration: string;
  aircraft_type: string;
  cargo_capacity_kg: number | null;
  cargo_volume_m3: number | null;
  used_weight_kg: number;
  used_volume_m3: number;
  pax_baggage_kg: number;
}

const DENSITY_LABELS: Record<string, string> = {
  low:        '🪶 Low density',
  medium:     '📦 Medium density',
  high:       '⚙️ High density',
  ultra_high: '💎 Ultra-dense',
};

const DENSITY_COLORS: Record<string, string> = {
  low:        'text-blue-400',
  medium:     'text-green-400',
  high:       'text-amber-400',
  ultra_high: 'text-purple-400',
};

const CARGO_ICONS: Record<string, string> = {
  'Electronics':       '💻',
  'Medical Supplies':  '🏥',
  'Automotive Parts':  '🔧',
  'Perishables':       '🥩',
  'Industrial Goods':  '🏗️',
  'Mail & Parcels':    '📮',
  'Pharmaceuticals':   '💊',
  'Textiles':          '🧵',
  'Fresh Produce':     '🥦',
  'Machinery':         '⚙️',
  'Humanitarian Aid':  '❤️',
  'Luxury Goods':      '💎',
};

function formatWeight(kg: number): string {
  const lbs = Math.round(kg * 2.20462).toLocaleString();
  return `${kg.toLocaleString()} kg / ${lbs} lbs`;
}

function formatValue(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function timeLeft(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function timerColor(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return 'text-red-500';
  if (ms < 300_000) return 'text-red-400';
  if (ms < 900_000) return 'text-amber-400';
  return 'text-gray-400';
}

interface ActiveFlight {
  id: string;
  status: string;
  hull: { aircraft_category: string } | null;
  route: {
    origin: { icao: string };
    destination: { icao: string };
  } | null;
}

function CapacityBar({ used, total, label, unit }: { used: number; total: number; label: string; unit: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-aero';
  const textColor = pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-aero';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={textColor}>{used.toLocaleString()} / {total.toLocaleString()} {unit}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CargoPage() {
  const [available, setAvailable] = useState<CargoShipment[]>([]);
  const [claimed, setClaimed] = useState<CargoShipment[]>([]);
  const [hullCapacity, setHullCapacity] = useState<HullCapacity | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [claimedLoading, setClaimedLoading] = useState(true);
  const [tab, setTab] = useState<'available' | 'claimed'>('available');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');
  const [activeOrigin, setActiveOrigin] = useState('');
  const [activeDest, setActiveDest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [activeFlight, setActiveFlight] = useState<ActiveFlight | null>(null);
  const originRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadBoard = useCallback(async (origin: string, dest: string, p: number, fid?: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (origin) params.set('origin', origin);
      if (dest) params.set('dest', dest);
      if (fid) params.set('flight_id', fid);
      const { data } = await api.get(`/cargo/board?${params}`);
      setAvailable(data.available);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
      setClaimed(data.claimed);
      if (data.hull_capacity) setHullCapacity(data.hull_capacity);
    } catch {
      setError('Failed to load cargo');
    } finally { setLoading(false); }
  }, []);

  // Load on mount
  useEffect(() => {
    api.get('/flights/active').then(({ data }) => {
      if (data?.status === 'BOARDING') {
        setActiveFlight(data);
        loadBoard('', '', 1, data.id);
      } else {
        loadBoard('', '', 1);
      }
    }).catch(() => { loadBoard('', '', 1); });
    setClaimedLoading(false);
  }, [loadBoard]);

  async function handleSearch() {
    const o = originInput.trim().toUpperCase();
    const d = destInput.trim().toUpperCase();
    setActiveOrigin(o);
    setActiveDest(d);
    setTab('available');
    const fid = activeFlight?.id;

    // Load first — if origin specified and zero results, auto-generate then reload
    if (o) {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ origin: o, page: '1' });
        if (d) params.set('dest', d);
        // Always trigger generate when filtering by origin — tops up to 20 destinations
        setGenerating(true);
        await api.post(`/cargo/generate?origin=${o}${d ? `&dest=${d}` : ''}`);
        setGenerating(false);
        // Reload after generation
        if (fid) params.set('flight_id', fid);
        const { data: data2 } = await api.get(`/cargo/board?${params}`);
        setClaimed(data2.claimed);
        setAvailable(data2.available);
        setTotal(data2.total);
        setPages(data2.pages);
        if (data2.hull_capacity) setHullCapacity(data2.hull_capacity);
        setPage(1);
      } catch {
        setError('Failed to load cargo');
        setGenerating(false);
      } finally { setLoading(false); }
    } else {
      loadBoard(o, d, 1, fid);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  function handleClear() {
    setOriginInput('');
    setDestInput('');
    setActiveOrigin('');
    setActiveDest('');
    loadBoard('', '', 1);
    originRef.current?.focus();
  }

  async function handleFlightSearch() {
    if (!activeFlight?.route) return;
    const o = activeFlight.route.origin.icao;
    const d = activeFlight.route.destination.icao;
    setOriginInput(o);
    setDestInput('');
    setActiveOrigin(o);
    setActiveDest('');
    setTab('available');

    // Always generate cargo for the specific route + nearby destinations
    setLoading(true);
    setGenerating(true);
    setError('');
    try {
      const category = activeFlight?.hull?.aircraft_category ?? '';
      await api.post(`/cargo/generate?origin=${o}&dest=${d}${category ? `&aircraft_category=${category}` : ''}`);
      setGenerating(false);
      // Load all cargo from this origin (not just the booked route)
      const originParams = new URLSearchParams({ origin: o, page: '1' });
      const { data } = await api.get(`/cargo/board?${originParams}`);
      setClaimed(data.claimed);
      setAvailable(data.available);
      setTotal(data.total);
      setPages(data.pages);
      setPage(1);
    } catch {
      setError('Failed to load cargo');
      setGenerating(false);
    } finally { setLoading(false); }
  }

  async function handleClaim(id: string) {
    setActionLoading(id); setError('');
    try {
      const flightParam = activeFlight?.id ? `?flight_id=${activeFlight.id}` : '';
      await api.post(`/cargo/claim/${id}${flightParam}`);
      const s = available.find(s => s.id === id)!;
      setAvailable(prev => prev.filter(s => s.id !== id));
      setClaimed(prev => [{ ...s, status: 'CLAIMED', claimed_at: new Date().toISOString(), flight_id: activeFlight?.id ?? null }, ...prev]);
      setTotal(prev => prev - 1);
      // Update hull capacity live
      if (hullCapacity && s) {
        setHullCapacity(prev => prev ? {
          ...prev,
          used_weight_kg: prev.used_weight_kg + s.weight_kg,
          used_volume_m3: Math.round((prev.used_volume_m3 + Number(s.volume_m3)) * 100) / 100,
        } : prev);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to claim shipment');
    } finally { setActionLoading(null); }
  }

  async function handleUnclaim(id: string) {
    setActionLoading(id); setError('');
    try {
      await api.delete(`/cargo/claim/${id}`);
      const s = claimed.find(s => s.id === id)!;
      setClaimed(prev => prev.filter(s => s.id !== id));
      setAvailable(prev => [{ ...s, status: 'AVAILABLE', claimed_at: null }, ...prev]);
      // Restore hull capacity
      if (hullCapacity && s) {
        setHullCapacity(prev => prev ? {
          ...prev,
          used_weight_kg: Math.max(0, prev.used_weight_kg - s.weight_kg),
          used_volume_m3: Math.max(0, Math.round((prev.used_volume_m3 - Number(s.volume_m3)) * 100) / 100),
        } : prev);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to return shipment');
    } finally { setActionLoading(null); }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Cargo Board</h1>
        <p className="text-gray-400 text-sm">
          Browse all available cargo. Filter by origin or destination airport.
        </p>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 mb-6 border border-red-500/20 bg-red-500/5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Hull capacity card */}
      {hullCapacity && (
        <div className="glass-card rounded-2xl p-5 mb-6 border border-aero/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-white">{hullCapacity.aircraft_type}</p>
              <p className="text-xs text-gray-500 font-mono">{hullCapacity.registration}</p>
            </div>
            <span className="text-xs text-aero border border-aero/20 bg-aero/5 px-2 py-0.5 rounded-full">Booked Flight</span>
          </div>
          <div className="flex flex-col gap-2">
            {hullCapacity.cargo_capacity_kg ? (
              <CapacityBar
                used={hullCapacity.used_weight_kg}
                total={hullCapacity.cargo_capacity_kg}
                label="Weight capacity"
                unit="kg"
              />
            ) : (
              <p className="text-xs text-gray-500">No cargo capacity data for this aircraft type.</p>
            )}
            {hullCapacity.cargo_volume_m3 && (
              <CapacityBar
                used={hullCapacity.used_volume_m3}
                total={hullCapacity.cargo_volume_m3}
                label="Volume capacity"
                unit="m³"
              />
            )}
          </div>
          {hullCapacity.pax_baggage_kg > 0 && (
            <p className="text-xs text-gray-600 mt-2">
              Hold capacity after pax baggage ({hullCapacity.pax_baggage_kg.toLocaleString()} kg reserved).
            </p>
          )}
          {hullCapacity.used_weight_kg === 0 && hullCapacity.pax_baggage_kg === 0 && (
            <p className="text-xs text-gray-600 mt-2">Claim shipments below to load cargo onto this flight.</p>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <label className="text-xs text-gray-400 block mb-2 font-medium uppercase tracking-wide">Filter Cargo</label>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">FROM</span>
            <input
              ref={originRef}
              type="text"
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="KJFK"
              maxLength={7}
              className="pl-14 pr-4 py-2.5 w-36 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-aero/50 font-mono"
            />
          </div>
          <span className="text-gray-600">→</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">TO</span>
            <input
              type="text"
              value={destInput}
              onChange={(e) => setDestInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="EGLL"
              maxLength={7}
              className="pl-10 pr-4 py-2.5 w-36 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-aero/50 font-mono"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-aero text-black font-bold rounded-xl text-sm hover:brightness-110 transition disabled:opacity-40"
          >
            {loading ? 'Loading…' : 'Filter'}
          </button>
          {(originInput || destInput) && (
            <button onClick={handleClear} className="text-xs text-gray-500 hover:text-white transition">Clear</button>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-2">Both fields optional — leave blank to browse all available cargo</p>
        {activeFlight?.route && (
          <button
            onClick={handleFlightSearch}
            disabled={loading || generating}
            className="mt-3 flex items-center gap-2 text-xs text-aero border border-aero/20 bg-aero/5 hover:bg-aero/10 px-3 py-1.5 rounded-lg transition w-fit disabled:opacity-50"
          >
            {generating ? '⏳ Generating cargo…' : (
              <>✈️ Load cargo from <span className="font-mono text-white">{activeFlight.route.origin.icao}</span> (booked flight to <span className="font-mono text-white">{activeFlight.route.destination.icao}</span>)</>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {([
          { key: 'available', label: `Available (${total.toLocaleString()})` },
          { key: 'claimed',   label: `My Shipments (${claimed.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Available shipments */}
      {tab === 'available' && (
        generating ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3 animate-pulse">📦</p>
            <p className="text-gray-400 text-sm">Generating cargo for <span className="font-mono text-white">{activeOrigin}</span>…</p>
          </div>
        ) : loading ? (
          <div className="glass-card rounded-2xl h-48 animate-pulse" />
        ) : available.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-400 text-sm">
              {activeOrigin || activeDest
                ? <>No cargo found for <span className="font-mono text-white">{activeOrigin || 'any'}</span> → <span className="font-mono text-white">{activeDest || 'any'}</span>. Try clearing the filter.</>
                : 'No cargo available right now. Check back in a few minutes.'}
            </p>
          </div>
        ) : (
          <>
            {(activeOrigin || activeDest) && (
              <p className="text-xs text-gray-500 mb-4">
                Showing {available.length} of {total.toLocaleString()} shipments
                {activeOrigin && <> from <span className="font-mono text-white">{activeOrigin}</span></>}
                {activeDest && <> to <span className="font-mono text-white">{activeDest}</span></>}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {available.map(s => (
                <div key={s.id} className="glass-card rounded-2xl p-5 flex flex-col gap-3 border border-transparent hover:border-white/10 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{CARGO_ICONS[s.cargo_type] ?? '📦'}</span>
                      <div>
                        <p className="font-bold text-sm">{s.cargo_type}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                          <span className="font-mono text-aero">{s.origin_icao}</span>
                          <span>→</span>
                          <span className="font-mono text-white">{s.destination_icao}</span>
                          <span>· {s.distance_nm.toLocaleString()} nm</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-green-400">{formatValue(s.total_value)}</p>
                      <p className="text-xs text-gray-500">${Number(s.rate_per_kg).toFixed(4)}/kg</p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                    <span>⚖️ {formatWeight(s.weight_kg)}</span>
                    <span>📐 {Number(s.volume_m3).toFixed(1)} m³</span>
                    <span className={cn('font-mono text-xs', timerColor(s.expires_at, now))}>⏳ {timeLeft(s.expires_at, now)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-medium', DENSITY_COLORS[s.density_class] ?? 'text-gray-400')}>
                      {DENSITY_LABELS[s.density_class] ?? s.density_class}
                    </span>
                    {hullCapacity?.cargo_capacity_kg && (
                      <span className="text-[10px] text-gray-500">
                        {((s.weight_kg / hullCapacity.cargo_capacity_kg) * 100).toFixed(1)}% of capacity
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleClaim(s.id)}
                    disabled={actionLoading === s.id || (
                      hullCapacity?.cargo_capacity_kg != null &&
                      hullCapacity.used_weight_kg + s.weight_kg > hullCapacity.cargo_capacity_kg
                    )}
                    className="w-full bg-aero text-black font-bold py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50 mt-auto"
                  >
                    {actionLoading === s.id ? 'Claiming…'
                      : hullCapacity?.cargo_capacity_kg != null && hullCapacity.used_weight_kg + s.weight_kg > hullCapacity.cargo_capacity_kg
                        ? '⚠️ Exceeds capacity'
                        : 'Claim Shipment'}
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button onClick={() => loadBoard(activeOrigin, activeDest, page - 1)} disabled={page <= 1}
                  className="px-4 py-2 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition disabled:opacity-30">
                  ← Prev
                </button>
                <span className="text-sm text-gray-400">Page {page} of {pages}</span>
                <button onClick={() => loadBoard(activeOrigin, activeDest, page + 1)} disabled={page >= pages}
                  className="px-4 py-2 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition disabled:opacity-30">
                  Next →
                </button>
              </div>
            )}
          </>
        )
      )}

      {/* Claimed shipments */}
      {tab === 'claimed' && (
        claimedLoading ? (
          <div className="glass-card rounded-2xl h-48 animate-pulse" />
        ) : claimed.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-400 text-sm">No shipments claimed yet. Browse cargo above to pick some up.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {claimed.map(s => (
              <div key={s.id} className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{CARGO_ICONS[s.cargo_type] ?? '📦'}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-sm">{s.cargo_type}</span>
                      <span className="font-mono text-xs text-aero">{s.origin_icao}</span>
                      <span className="text-gray-600 text-xs">→</span>
                      <span className="font-mono text-xs text-white">{s.destination_icao}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>⚖️ {formatWeight(s.weight_kg)}</span>
                      <span>💰 {formatValue(s.total_value)}</span>
                      <span>{s.distance_nm.toLocaleString()} nm</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {s.flight_id ? (
                    <span className="text-xs text-green-400 border border-green-500/20 bg-green-500/10 px-2.5 py-1 rounded-full font-medium">
                      ✓ Loaded
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full font-medium">
                      Awaiting Flight
                    </span>
                  )}
                  <button
                    onClick={() => handleUnclaim(s.id)}
                    disabled={actionLoading === s.id}
                    className="text-xs border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/20 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    {actionLoading === s.id ? '…' : 'Return'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
