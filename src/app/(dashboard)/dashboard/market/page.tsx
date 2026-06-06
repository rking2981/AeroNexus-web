'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface AircraftType {
  id: string;
  icao_code: string;
  manufacturer: string;
  name: string;
  category: string;          // COMMERCIAL | CARGO | PRIVATE | HELICOPTER | SPECIAL_USE
  aircraft_category: string; // FIXED_WING | HELICOPTER | SEAPLANE | BALLOON
  pax_capacity: number;
  cargo_capacity_kg: number;
  cruise_speed_kts: number | null;
  max_range_nm: number | null;
  max_takeoff_weight: number | null;
  max_fuel_weight: number | null;
  engine_type: string;
  engine_count: number;
  base_price: number | null;
  manufacturer_icao: string | null;
  manufacturer_airport_name: string | null;
}

interface MarketListing {
  id: string;
  asking_price: number;
  fair_value: number;
  notes: string | null;
  maintenance_warnings: string[];
  hull: {
    registration: string;
    aircraft_type: string;
    aircraft_category: string;
    airframe_hours: number;
    engine_wear_percent: number;
    maintenance_grade: string;
    a_check_due_hours: number;
    c_check_due_hours: number;
    d_check_due_hours: number;
    cabin_configs: { cabin_class: string; seat_count: number }[];
    aircraft_type_rel: { manufacturer: string; name: string; pax_capacity: number; max_range_nm: number | null } | null;
  };
  seller: { name: string; icao_code: string };
}

interface PurchaseResult {
  hull_id: string;
  registration: string;
  factory_airport: string | null;
  delivery_fee: number;
  delivery_distance_nm: number;
  delivery_from: string | null;
  delivery_to: string | null;
  weekly_fee?: number;
  leased_from?: string;
  first_payment_due?: string;
}

// Icons keyed by operational category (AircraftTypeCategory)
const CATEGORY_ICON: Record<string, string> = {
  COMMERCIAL: '✈️', CARGO: '📦', PRIVATE: '🛩️',
  HELICOPTER: '🚁', SEAPLANE: '🛥️', SPECIAL_USE: '⭐',
};
// Fallback icons by physical category (AircraftCategory)
const PHYS_CATEGORY_ICON: Record<string, string> = {
  FIXED_WING: '✈️', HELICOPTER: '🚁', SEAPLANE: '🛥️', BALLOON: '🎈',
};
function getIcon(category?: string, aircraftCategory?: string): string {
  return CATEGORY_ICON[category ?? ''] ?? PHYS_CATEGORY_ICON[aircraftCategory ?? ''] ?? '✈️';
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-400', B: 'text-green-300', C: 'text-amber-400',
  D: 'text-orange-400', E: 'text-red-400', F: 'text-red-600',
};

function formatPrice(n: number, symbol = '$', fxRate = 1) {
  const v = n * fxRate;
  if (v >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${symbol}${(v / 1_000).toFixed(0)}K`;
  return `${symbol}${v.toLocaleString()}`;
}

function formatWeight(kg: number | null) {
  if (!kg) return '—';
  return `${kg.toLocaleString()} kg / ${Math.round(kg * 2.20462).toLocaleString()} lbs`;
}

// ─── Aircraft detail + purchase modal ──────────────────────────────────────

type ModalState = 'detail' | 'purchasing' | 'post_purchase' | 'delivery' | 'jumpseat' | 'lease_done';

function AircraftDetailModal({
  type,
  onClose,
  isManager,
  spendable,
  currency,
}: {
  type: AircraftType;
  onClose: () => void;
  isManager: boolean;
  spendable: number | null;
  currency: { symbol: string; code: string; fx_rate: number };
}) {
  const fp = (n: number) => formatPrice(n, currency.symbol, currency.fx_rate);

  const [mode, setMode] = useState<ModalState>('detail');
  const [paymentMode, setPaymentMode] = useState<'BUY' | 'LEASE'>('BUY');
  const [reg, setReg] = useState('');
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const [deliveryEstimate, setDeliveryEstimate] = useState<{ fee: number; distance_nm: number; from: string | null; to: string | null } | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryDone, setDeliveryDone] = useState<{ delivered_to: string; delivery_fee: number } | null>(null);
  const [jumpLoading, setJumpLoading] = useState(false);
  const [jumpDone, setJumpDone] = useState(false);
  const [toast, setToast] = useState('');

  // Fetch delivery estimate on open
  useEffect(() => {
    if (type.manufacturer_icao) {
      api.get(`/market/delivery-estimate?aircraft_type_id=${type.id}`)
        .then(({ data }) => setDeliveryEstimate(data))
        .catch(() => {});
    }
  }, [type]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handlePurchase() {
    if (!reg.trim()) return;
    setBuyLoading(true); setBuyError('');
    try {
      const { data } = await api.post('/market/buy/new', {
        aircraft_type_id: type.id,
        registration: reg.toUpperCase(),
        payment_type: paymentMode,
      });
      setPurchaseResult(data);
      setMode('post_purchase');
      showToast(paymentMode === 'LEASE'
        ? `${type.manufacturer} ${type.name} leased from AeroNexus!`
        : `${type.manufacturer} ${type.name} purchased!`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setBuyError(msg ?? (paymentMode === 'LEASE' ? 'Lease failed' : 'Purchase failed'));
    } finally { setBuyLoading(false); }
  }

  async function handleAcceptDelivery() {
    if (!purchaseResult) return;
    setDeliveryLoading(true);
    try {
      const { data } = await api.post(`/market/delivery/${purchaseResult.hull_id}/accept`);
      setDeliveryDone(data);
      setMode('delivery');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setBuyError(msg ?? 'Delivery failed');
    } finally { setDeliveryLoading(false); }
  }

  async function handleFlyItMyself() {
    if (!purchaseResult?.factory_airport) return;
    setJumpLoading(true);
    try {
      if (paymentMode === 'LEASE') {
        await api.post('/pilots/ferry', { destination_icao: purchaseResult.factory_airport });
        setJumpDone(true);
        showToast(`You're now at ${purchaseResult.factory_airport} — ready to ferry!`);
      } else {
        await api.post('/pilots/jumpseat', { destination_icao: purchaseResult.factory_airport });
        setJumpDone(true);
        showToast(`Jumpseat booked — you're now at ${purchaseResult.factory_airport}`);
      }
      setMode('post_purchase');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setBuyError(msg ?? (paymentMode === 'LEASE' ? 'Ferry failed' : 'Jumpseat failed'));
    } finally { setJumpLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-green-500 text-black font-bold px-6 py-3 rounded-2xl shadow-xl text-sm">
          ✅ {toast}
        </div>
      )}

      <div className="glass-card rounded-2xl border border-white/10 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-2xl">{CATEGORY_ICON[type.aircraft_category] ?? '✈️'}</span>
                <span className="text-gray-400 text-sm">{type.manufacturer}</span>
              </div>
              <h2 className="text-2xl font-bold">{type.name}</h2>
              <p className="text-xs font-mono text-gray-500 mt-0.5">{type.icao_code}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-aero">{fp(type.base_price ?? 0)}</p>
              {type.manufacturer_icao && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Factory: <span className="font-mono text-aero">{type.manufacturer_icao}</span>
                  {type.manufacturer_airport_name && <span className="block text-gray-600">{type.manufacturer_airport_name}</span>}
                </p>
              )}
            </div>
          </div>

          {/* ── Detail view ── */}
          {mode === 'detail' && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Category', value: type.aircraft_category },
                  { label: 'ICAO Code', value: type.icao_code, mono: true },
                  { label: 'PAX Capacity', value: type.pax_capacity > 0 ? `${type.pax_capacity} seats` : '—' },
                  { label: 'Cargo Capacity', value: type.cargo_capacity_kg > 0 ? formatWeight(type.cargo_capacity_kg) : '—' },
                  { label: 'Cruise Speed', value: type.cruise_speed_kts ? `${type.cruise_speed_kts} kts` : '—' },
                  { label: 'Max Range', value: type.max_range_nm ? `${type.max_range_nm.toLocaleString()} nm` : '—' },
                  { label: 'MTOW', value: formatWeight(type.max_takeoff_weight) },
                  { label: 'Max Fuel', value: formatWeight(type.max_fuel_weight) },
                  { label: 'Engines', value: `${type.engine_count}× ${type.engine_type}` },
                  { label: 'Factory', value: type.manufacturer_icao ? `${type.manufacturer_icao}${type.manufacturer_airport_name ? ` — ${type.manufacturer_airport_name}` : ''}` : 'Unknown', mono: false },
                ].map(row => (
                  <div key={row.label} className="glass-card rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{row.label}</p>
                    <p className={cn('text-sm font-medium', row.mono && 'font-mono text-aero')}>{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Delivery estimate preview */}
              {deliveryEstimate && deliveryEstimate.distance_nm > 0 && (
                <div className="glass-card rounded-xl p-3 mb-5 border border-amber-500/20 bg-amber-500/5">
                  <p className="text-xs text-amber-300 font-medium mb-1">🚚 Estimated Delivery Fee</p>
                  <p className="text-sm text-amber-200">
                    {fp(deliveryEstimate.fee)}
                    <span className="text-gray-500 text-xs ml-2">
                      ({deliveryEstimate.from} → {deliveryEstimate.to ?? 'your hub'}, {deliveryEstimate.distance_nm.toLocaleString()} nm)
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Charged separately after purchase if you choose delivery.</p>
                </div>
              )}

              {isManager && type.base_price && (() => {
                const priceConverted = type.base_price! * currency.fx_rate;
                const weeklyFee = Math.round(priceConverted * 0.001);
                const canAffordBuy = spendable === null || spendable >= priceConverted;
                const canAffordLease = true; // no upfront cost
                const canAfford = paymentMode === 'BUY' ? canAffordBuy : canAffordLease;
                return (
                <div className="flex flex-col gap-3">
                  {/* Buy / Lease toggle */}
                  <div className="flex gap-1 glass-card rounded-xl p-1">
                    {(['BUY', 'LEASE'] as const).map(m => (
                      <button key={m} onClick={() => setPaymentMode(m)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${paymentMode === m ? 'bg-aero text-black' : 'text-gray-400 hover:text-white'}`}>
                        {m === 'BUY' ? `Buy ${fp(type.base_price!)}` : `Lease ${fp(weeklyFee)}/wk`}
                      </button>
                    ))}
                  </div>
                  {paymentMode === 'LEASE' && (
                    <div className="rounded-xl border border-aero/20 bg-aero/5 px-4 py-3 text-xs text-gray-300">
                      <p className="font-bold text-aero mb-1">Platform Lease — AeroNexus</p>
                      <p>No upfront cost. Weekly fee of <span className="text-white font-mono">{fp(weeklyFee)}</span> charged automatically.</p>
                      <p className="text-gray-500 mt-1">Return the aircraft at any time to end the lease.</p>
                    </div>
                  )}
                  {paymentMode === 'BUY' && !canAffordBuy && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 flex items-center justify-between text-sm">
                      <span className="text-red-400">Insufficient funds</span>
                      <span className="text-gray-500 text-xs font-mono">
                        Balance: {fp(spendable ?? 0)} · Need: {fp(type.base_price!)}
                      </span>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Registration (e.g. N-TVAR1)"
                    value={reg}
                    onChange={e => setReg(e.target.value.toUpperCase())}
                    maxLength={12}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none transition"
                  />
                  {buyError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{buyError}</p>}
                  <button
                    onClick={() => setMode('purchasing')}
                    disabled={!reg.trim() || !canAfford}
                    className="w-full bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {paymentMode === 'BUY' ? `Purchase ${fp(type.base_price!)}` : `Lease — ${fp(weeklyFee)}/week`}
                  </button>
                </div>
                );
              })()}
            </>
          )}

          {/* ── Confirm purchase / lease ── */}
          {mode === 'purchasing' && (
            <div className="flex flex-col gap-4">
              <div className="glass-card rounded-xl p-4 flex flex-col gap-2 text-sm">
                {paymentMode === 'BUY' ? <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Aircraft price</span>
                    <span className="font-mono font-bold">{fp(type.base_price ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Registration</span>
                    <span className="font-mono text-aero">{reg.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Delivery</span>
                    <span className="text-gray-500 text-xs">Chosen after purchase</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                    <span>Charged now</span>
                    <span className="text-aero">{fp(type.base_price ?? 0)}</span>
                  </div>
                </> : <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Leased from</span>
                    <span className="font-bold text-aero">AeroNexus</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Registration</span>
                    <span className="font-mono text-aero">{reg.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Weekly fee</span>
                    <span className="font-mono font-bold">{fp(Math.round((type.base_price ?? 0) * 0.001))}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                    <span>Charged now</span>
                    <span className="text-green-400">$0 upfront</span>
                  </div>
                </>}
              </div>
              {buyError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{buyError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setMode('detail')} className="flex-1 border border-white/10 text-gray-400 hover:text-white py-2.5 rounded-xl text-sm transition">Back</button>
                <button onClick={handlePurchase} disabled={buyLoading}
                  className="flex-1 bg-aero text-black font-bold py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                  {buyLoading ? (paymentMode === 'LEASE' ? 'Leasing…' : 'Purchasing…') : (paymentMode === 'LEASE' ? 'Confirm Lease' : 'Confirm Purchase')}
                </button>
              </div>
            </div>
          )}

          {/* ── Post-purchase: choose delivery method ── */}
          {mode === 'post_purchase' && purchaseResult && (
            <div className="flex flex-col gap-4">
              <div className="text-center py-2">
                <p className="text-sm text-gray-300 mb-1">
                  <span className="font-mono font-bold text-aero">{purchaseResult.registration}</span> is waiting at <span className="font-mono font-bold text-aero">{purchaseResult.factory_airport ?? 'factory'}</span>.
                </p>
                <p className="text-xs text-gray-500">Choose how to bring it to your airline.</p>
              </div>

              {buyError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{buyError}</p>}

              {/* Delivery option */}
              <button
                onClick={handleAcceptDelivery}
                disabled={deliveryLoading || !!deliveryDone}
                className="glass-card rounded-xl p-5 text-left border border-aero/20 hover:border-aero/50 hover:bg-aero/5 transition disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">🚚 Delivery</span>
                  {purchaseResult.delivery_fee > 0 && (
                    <span className="text-aero font-bold">{fp(purchaseResult.delivery_fee)}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  We fly the aircraft to your hub ({purchaseResult.delivery_distance_nm.toLocaleString()} nm).
                  Aircraft available at <span className="font-mono">{purchaseResult.delivery_to ?? 'your hub'}</span>.
                </p>
                {deliveryLoading && <p className="text-xs text-aero mt-2">Processing…</p>}
              </button>

              {/* Fly/Ferry it myself option */}
              <button
                onClick={jumpDone ? undefined : paymentMode === 'LEASE' ? handleFlyItMyself : () => setMode('jumpseat')}
                disabled={jumpDone}
                className="glass-card rounded-xl p-5 text-left border border-white/10 hover:border-white/25 hover:bg-white/5 transition disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{paymentMode === 'LEASE' ? '✈️ Ferry It Myself' : '✈️ Fly It Myself'}</span>
                  <span className={`font-bold text-sm ${paymentMode === 'LEASE' ? 'text-green-400' : 'text-amber-400'}`}>
                    {paymentMode === 'LEASE' ? 'Free' : '$150 jumpseat'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {paymentMode === 'LEASE'
                    ? <>Ferry the aircraft from <span className="font-mono">{purchaseResult.factory_airport}</span> to your hub yourself — no fee.</>
                    : <>Buy a $150 jumpseat to <span className="font-mono">{purchaseResult.factory_airport}</span> and fly the aircraft back yourself.</>
                  }
                </p>
                {jumpDone && <p className="text-xs text-green-400 mt-2">✓ You're now at {purchaseResult.factory_airport}</p>}
              </button>
            </div>
          )}

          {/* ── Jumpseat confirm ── */}
          {mode === 'jumpseat' && purchaseResult && (
            <div className="flex flex-col gap-4">
              <div className="glass-card rounded-xl p-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Jumpseat to</span>
                  <span className="font-mono text-aero">{purchaseResult.factory_airport}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                  <span>Cost</span>
                  <span className="text-amber-400">$150.00</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Your current location will be updated to <span className="font-mono">{purchaseResult.factory_airport}</span>. You can then book a flight departing from there.
              </p>
              {buyError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{buyError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setMode('post_purchase')} className="flex-1 border border-white/10 text-gray-400 hover:text-white py-2.5 rounded-xl text-sm transition">Back</button>
                <button onClick={handleFlyItMyself} disabled={jumpLoading}
                  className="flex-1 bg-amber-500 text-black font-bold py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                  {jumpLoading ? 'Booking…' : 'Book Jumpseat $150'}
                </button>
              </div>
            </div>
          )}

          {/* ── Lease confirmed ── */}
          {mode === 'lease_done' && purchaseResult && (
            <div className="text-center py-4">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-bold text-green-400 mb-1">Lease Confirmed!</p>
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-mono font-bold text-aero">{purchaseResult.registration}</span> is ready at your hub.
              </p>
              <p className="text-xs text-gray-500">Weekly fee: {fp(purchaseResult.weekly_fee)} — first payment due in 7 days.</p>
            </div>
          )}

          {/* ── Delivery confirmed ── */}
          {mode === 'delivery' && deliveryDone && (
            <div className="text-center py-4">
              <p className="text-4xl mb-3">🚚</p>
              <p className="font-bold text-green-400 mb-1">Delivery Confirmed!</p>
              <p className="text-sm text-gray-300">
                Your aircraft is now at <span className="font-mono font-bold text-aero">{deliveryDone.delivered_to}</span>.
              </p>
              <p className="text-xs text-gray-500 mt-1">Delivery fee: {fp(deliveryDone.delivery_fee)} charged.</p>
            </div>
          )}

          <button onClick={onClose} className="mt-5 w-full text-xs text-gray-600 hover:text-gray-400 transition">
            {mode === 'post_purchase' || mode === 'delivery' || mode === 'lease_done' ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main market page ───────────────────────────────────────────────────────

export default function MarketPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [tab, setTab] = useState<'new' | 'used'>('new');
  const [newAircraft, setNewAircraft] = useState<AircraftType[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [selected, setSelected] = useState<AircraftType | null>(null);
  const [spendable, setSpendable] = useState<number | null>(null);
  const [currency, setCurrency] = useState<{ symbol: string; code: string; fx_rate: number }>({ symbol: '$', code: 'USD', fx_rate: 1 });

  useEffect(() => {
    Promise.all([
      publicApi.get('/aircraft-types'),
      publicApi.get('/market/listings'),
    ]).then(([a, l]) => {
      setNewAircraft(a.data);
      setListings(l.data);
    }).finally(() => setLoading(false));

    // Fetch airline balance + currency for affordability check and price display
    if (isManager) {
      api.get('/airline/finances').then(({ data }) => {
        setSpendable(data.balance ?? null);
        if (data.currency) {
          setCurrency({
            symbol: data.currency.symbol ?? '$',
            code:   data.currency.code   ?? 'USD',
            fx_rate: data.fx_rate ?? 1,
          });
        }
      }).catch(() => {});
    }
  }, [isManager]);

  // Granular filter matcher
  // `category` = operational type (COMMERCIAL, CARGO, PRIVATE, HELICOPTER, SPECIAL_USE)
  // `aircraft_category` = physical type (FIXED_WING, HELICOPTER, SEAPLANE, BALLOON)
  function matchesFilter(filter: string, a: {
    category?: string;
    aircraft_category: string;
    engine_type?: string | null;
    engine_count?: number | null;
  }): boolean {
    if (!filter) return true;
    const opCat  = a.category ?? '';          // operational category
    const physCat = a.aircraft_category ?? ''; // physical category
    const eng = a.engine_type ?? '';
    const cnt = a.engine_count ?? 0;
    switch (filter) {
      case 'JETLINER':    return opCat === 'COMMERCIAL' && eng === 'JET' && cnt >= 2;
      case 'REGIONAL':    return opCat === 'COMMERCIAL' && (eng === 'TURBOPROP' || (eng === 'JET' && cnt <= 2));
      case 'TURBOPROP':   return eng === 'TURBOPROP';
      case 'SINGLE_PROP': return eng === 'PISTON' && cnt === 1;
      case 'MULTI_PROP':  return eng === 'PISTON' && cnt > 1;
      case 'HELICOPTER':  return opCat === 'HELICOPTER' || physCat === 'HELICOPTER';
      case 'CARGO':       return opCat === 'CARGO';
      case 'PRIVATE':     return opCat === 'PRIVATE';
      case 'SEAPLANE':    return physCat === 'SEAPLANE';
      case 'SPECIAL':     return opCat === 'SPECIAL_USE';
      default:            return true;
    }
  }

  const q = search.toLowerCase();
  const filteredNew = newAircraft.filter((a) =>
    matchesFilter(activeFilter, a) &&
    `${a.manufacturer} ${a.name} ${a.icao_code}`.toLowerCase().includes(q)
  );

  const filteredUsed = listings.filter((l) => {
    // Used listings don't carry engine_type/count directly — approximate by category
    const physCat = l.hull.aircraft_category;
    const catMatch = !activeFilter || (() => {
      switch (activeFilter) {
        case 'JETLINER': case 'REGIONAL': case 'CARGO': case 'PRIVATE':
          // These require operational category — not available on listing hull, show all FIXED_WING
          return physCat === 'FIXED_WING';
        case 'HELICOPTER': return physCat === 'HELICOPTER';
        case 'SEAPLANE':   return physCat === 'SEAPLANE';
        default:           return true;
      }
    })();
    return catMatch && `${l.hull.aircraft_type} ${l.hull.registration}`.toLowerCase().includes(q);
  });

  const handleBuyUsed = useCallback(async (listingId: string) => {
    const reg = prompt('Enter a registration number for this aircraft (or leave blank to keep existing):');
    try {
      await api.post(`/market/buy/used/${listingId}`, { registration: reg || undefined });
      setListings(prev => prev.filter((l) => l.id !== listingId));
      alert('Purchase successful! Check your fleet.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Purchase failed');
    }
  }, []);

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Aircraft Market</h1>
        <p className="text-gray-400 text-sm">
          {newAircraft.length} aircraft types from manufacturer · {listings.length} used listings
        </p>
      </div>

      {/* Aircraft detail modal */}
      {selected && (
        <AircraftDetailModal
          type={selected}
          onClose={() => setSelected(null)}
          isManager={isManager}
          spendable={spendable}
          currency={currency}
        />
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3">
        {/* Tab + Search row */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex gap-1 glass-card rounded-xl p-1">
            {(['new', 'used'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-5 py-2 rounded-lg text-sm font-medium transition capitalize',
                  tab === t ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
                {t === 'new' ? '🏭 New from Manufacturer' : '🔄 Used Market'}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search aircraft..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition flex-1 min-w-48"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: '',            label: 'All',          icon: '🌐' },
            { key: 'JETLINER',    label: 'Jetliners',    icon: '✈️' },
            { key: 'REGIONAL',    label: 'Regional Jets / Turboprops', icon: '🛫' },
            { key: 'TURBOPROP',   label: 'Turboprops',   icon: '🌀' },
            { key: 'SINGLE_PROP', label: 'Single-Prop',  icon: '🛩️' },
            { key: 'MULTI_PROP',  label: 'Multi-Prop',   icon: '🛩️' },
            { key: 'HELICOPTER',  label: 'Helicopters',  icon: '🚁' },
            { key: 'CARGO',       label: 'Cargo',        icon: '📦' },
            { key: 'PRIVATE',     label: 'Private',      icon: '🎩' },
            { key: 'SEAPLANE',    label: 'Seaplanes',    icon: '🛥️' },
            { key: 'SPECIAL',     label: 'Special Use',  icon: '⭐' },
          ].map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition',
                activeFilter === f.key
                  ? 'bg-aero/20 border-aero/50 text-aero'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/25',
              )}>
              <span>{f.icon}</span>{f.label}
            </button>
          ))}
        </div>
      </div>

      {/* New aircraft grid */}
      {tab === 'new' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNew.length === 0 ? (
            <div className="col-span-3 text-center text-gray-500 py-12">No aircraft found</div>
          ) : filteredNew.map((type) => {
            const canAfford = !isManager || spendable === null || (type.base_price !== null && spendable >= type.base_price * currency.fx_rate);
            return (
              <button key={type.id} onClick={() => setSelected(type)}
                className={cn(
                  'glass-card rounded-2xl p-5 flex flex-col text-left border transition',
                  canAfford
                    ? 'border-transparent hover:border-aero/30 hover:bg-aero/5'
                    : 'border-red-500/10 opacity-60 hover:opacity-80',
                )}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-lg mr-2">{getIcon(type.category, type.aircraft_category)}</span>
                    <span className="font-bold text-sm text-gray-300">{type.manufacturer}</span>
                    <p className="font-bold text-base mt-0.5">{type.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{type.icao_code}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn('font-bold text-lg', canAfford ? 'text-aero' : 'text-red-400')}>
                      {formatPrice(type.base_price ?? 0, currency.symbol, currency.fx_rate)}
                    </p>
                    {type.manufacturer_icao && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-mono">{type.manufacturer_icao}</span>
                        {type.manufacturer_airport_name && <span className="block text-gray-600 text-[10px]">{type.manufacturer_airport_name}</span>}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                  {type.pax_capacity > 0 && <span>👥 {type.pax_capacity} pax</span>}
                  {type.max_range_nm && <span>🗺️ {type.max_range_nm.toLocaleString()} nm</span>}
                  {type.cruise_speed_kts && <span>💨 {type.cruise_speed_kts} kts</span>}
                  <span>🔧 {type.engine_count}× {type.engine_type}</span>
                </div>
                <p className={cn('text-xs mt-3', canAfford ? 'text-gray-600' : 'text-red-500')}>
                  {canAfford ? 'Click to view details →' : '⚠️ Insufficient funds'}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Used market listings */}
      {tab === 'used' && (
        <div className="flex flex-col gap-4">
          {filteredUsed.length === 0 ? (
            <div className="text-center text-gray-500 py-12 glass-card rounded-2xl">
              No used aircraft listed. Be the first to sell!
            </div>
          ) : filteredUsed.map((listing) => {
            const discount = listing.fair_value > 0
              ? Math.round((1 - listing.asking_price / listing.fair_value) * 100) : 0;
            return (
              <div key={listing.id} className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{CATEGORY_ICON[listing.hull.aircraft_category] ?? '✈️'}</span>
                      <span className="font-mono font-bold">{listing.hull.registration}</span>
                      <span className="text-gray-400 text-sm">—</span>
                      <span className="font-bold text-sm">{listing.hull.aircraft_type}</span>
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-lg border border-white/10', GRADE_COLORS[listing.hull.maintenance_grade])}>
                        Grade {listing.hull.maintenance_grade}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Seller: {listing.seller.name} ({listing.seller.icao_code}) ·
                      {Number(listing.hull.airframe_hours).toFixed(0)} hrs ·
                      Engine wear: {Number(listing.hull.engine_wear_percent).toFixed(0)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">{formatPrice(listing.asking_price, currency.symbol, currency.fx_rate)}</p>
                    <p className="text-xs text-gray-500">
                      Fair value: {formatPrice(listing.fair_value, currency.symbol, currency.fx_rate)}
                      {discount > 0 && <span className="text-green-400 ml-1">({discount}% below)</span>}
                      {discount < 0 && <span className="text-red-400 ml-1">({Math.abs(discount)}% above)</span>}
                    </p>
                  </div>
                </div>
                {listing.maintenance_warnings.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {listing.maintenance_warnings.map((w) => (
                      <span key={w} className="text-xs px-2 py-1 rounded-lg border border-amber-500/20 text-amber-400 bg-amber-500/5">⚠️ {w}</span>
                    ))}
                  </div>
                )}
                {listing.hull.cabin_configs.length > 0 && (
                  <div className="flex gap-2 mb-4">
                    {listing.hull.cabin_configs.map((c) => (
                      <span key={c.cabin_class} className="text-xs text-gray-400 glass-card px-2 py-1 rounded-lg">
                        {c.cabin_class.replace('_', ' ')}: {c.seat_count}
                      </span>
                    ))}
                  </div>
                )}
                {listing.notes && <p className="text-xs text-gray-400 italic mb-4">"{listing.notes}"</p>}
                {isManager && (
                  <button onClick={() => handleBuyUsed(listing.id)}
                    className="w-full bg-aero text-black font-bold py-2.5 rounded-xl hover:brightness-110 transition text-sm">
                    Buy for {formatPrice(listing.asking_price, currency.symbol, currency.fx_rate)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
