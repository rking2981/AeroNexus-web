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
  rate_per_kg: number;
  total_value: number;
  status: string;
  claimed_at: string | null;
  expires_at: string;
}

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

export default function CargoPage() {
  const [available, setAvailable] = useState<CargoShipment[]>([]);
  const [claimed, setClaimed] = useState<CargoShipment[]>([]);
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

  const loadBoard = useCallback(async (origin: string, dest: string, p: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (origin) params.set('origin', origin);
      if (dest) params.set('dest', dest);
      const { data } = await api.get(`/cargo/board?${params}`);
      setAvailable(data.available);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
      setClaimed(data.claimed);
    } catch {
      setError('Failed to load cargo');
    } finally { setLoading(false); }
  }, []);

  // Load on mount
  useEffect(() => {
    loadBoard('', '', 1);
    setClaimedLoading(false);
    api.get('/flights/active').then(({ data }) => {
      if (data?.status === 'BOARDING') setActiveFlight(data);
    }).catch(() => {});
  }, [loadBoard]);

  function handleSearch() {
    const o = originInput.trim().toUpperCase();
    const d = destInput.trim().toUpperCase();
    setActiveOrigin(o);
    setActiveDest(d);
    loadBoard(o, d, 1);
    setTab('available');
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
    setDestInput(d);
    setActiveOrigin(o);
    setActiveDest(d);
    setTab('available');

    // Load first, then generate if empty
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ origin: o, dest: d, page: '1' });
      const { data } = await api.get(`/cargo/board?${params}`);
      setClaimed(data.claimed);
      if (data.available.length === 0) {
        // None found — generate on-demand
        setGenerating(true);
        const category = activeFlight?.hull?.aircraft_category ?? '';
        await api.post(`/cargo/generate?origin=${o}&dest=${d}${category ? `&aircraft_category=${category}` : ''}`);
        setGenerating(false);
        // Reload
        const { data: data2 } = await api.get(`/cargo/board?${params}`);
        setAvailable(data2.available);
        setTotal(data2.total);
        setPages(data2.pages);
        setPage(1);
      } else {
        setAvailable(data.available);
        setTotal(data.total);
        setPages(data.pages);
        setPage(1);
      }
    } catch {
      setError('Failed to load cargo');
      setGenerating(false);
    } finally { setLoading(false); }
  }

  async function handleClaim(id: string) {
    setActionLoading(id); setError('');
    try {
      await api.post(`/cargo/claim/${id}`);
      const s = available.find(s => s.id === id)!;
      setAvailable(prev => prev.filter(s => s.id !== id));
      setClaimed(prev => [{ ...s, status: 'CLAIMED', claimed_at: new Date().toISOString() }, ...prev]);
      setTotal(prev => prev - 1);
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
              <>✈️ Find cargo for my booked flight <span className="font-mono text-white">{activeFlight.route.origin.icao} → {activeFlight.route.destination.icao}</span></>
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
        loading ? (
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
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>⚖️ {formatWeight(s.weight_kg)}</span>
                    <span className={cn('font-mono text-xs', timerColor(s.expires_at, now))}>⏳ {timeLeft(s.expires_at, now)}</span>
                  </div>
                  <button
                    onClick={() => handleClaim(s.id)}
                    disabled={actionLoading === s.id}
                    className="w-full bg-aero text-black font-bold py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50 mt-auto"
                  >
                    {actionLoading === s.id ? 'Claiming…' : 'Claim Shipment'}
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
                  <span className="text-xs text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full font-medium">
                    Awaiting Flight
                  </span>
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
