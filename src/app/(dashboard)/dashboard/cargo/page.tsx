'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function CargoPage() {
  const [available, setAvailable] = useState<CargoShipment[]>([]);
  const [claimed, setClaimed] = useState<CargoShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimedLoading, setClaimedLoading] = useState(true);
  const [tab, setTab] = useState<'available' | 'claimed'>('available');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [searchInput, setSearchInput] = useState('');
  const [searchedIcao, setSearchedIcao] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load claimed shipments on mount
  useEffect(() => {
    loadClaimed();
  }, []);

  async function loadClaimed() {
    setClaimedLoading(true);
    try {
      const { data } = await api.get('/cargo/board');
      setClaimed(data.claimed);
    } finally { setClaimedLoading(false); }
  }

  async function search(icao: string) {
    const code = icao.trim().toUpperCase();
    if (code.length < 3) return;
    setLoading(true);
    setError('');
    setSearchedIcao(code);
    try {
      const { data } = await api.get(`/cargo/board?origin=${code}`);
      setAvailable(data.available);
      setClaimed(data.claimed);
      setTab('available');
    } catch {
      setError('Failed to load cargo');
    } finally { setLoading(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') search(searchInput);
  }

  function handleClear() {
    setSearchInput('');
    setSearchedIcao('');
    setAvailable([]);
    inputRef.current?.focus();
  }

  async function handleClaim(id: string) {
    setActionLoading(id); setError('');
    try {
      await api.post(`/cargo/claim/${id}`);
      const s = available.find(s => s.id === id)!;
      setAvailable(prev => prev.filter(s => s.id !== id));
      setClaimed(prev => [{ ...s, status: 'CLAIMED', claimed_at: new Date().toISOString() }, ...prev]);
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
          Search for available cargo shipments by departure airport.
        </p>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 mb-6 border border-red-500/20 bg-red-500/5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Search bar */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <label className="text-xs text-gray-400 block mb-2 font-medium uppercase tracking-wide">Search by Departure Airport</label>
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="ICAO code (e.g. KJFK)"
              maxLength={4}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-aero/50 font-mono uppercase"
            />
            {searchInput && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">✕</button>
            )}
          </div>
          <button
            onClick={() => search(searchInput)}
            disabled={searchInput.trim().length < 3 || loading}
            className="px-5 py-2.5 bg-aero text-black font-bold rounded-xl text-sm hover:brightness-110 transition disabled:opacity-40"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">Enter a 3–4 character ICAO code and press Enter or Search</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {([
          { key: 'available', label: `Available${searchedIcao ? ` at ${searchedIcao} (${available.length})` : ''}` },
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
        !searchedIcao ? (
          <div className="glass-card rounded-2xl p-16 text-center">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-white font-semibold mb-1">Search for cargo</p>
            <p className="text-gray-400 text-sm">Enter a departure airport ICAO code above to see available shipments.</p>
          </div>
        ) : loading ? (
          <div className="glass-card rounded-2xl h-48 animate-pulse" />
        ) : available.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-400 text-sm">No cargo available departing from <span className="font-mono text-white">{searchedIcao}</span>. Try another airport or check back later.</p>
          </div>
        ) : (
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
        )
      )}

      {/* Claimed shipments */}
      {tab === 'claimed' && (
        claimedLoading ? (
          <div className="glass-card rounded-2xl h-48 animate-pulse" />
        ) : claimed.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-400 text-sm">No shipments claimed yet. Search for cargo above to pick some up.</p>
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
