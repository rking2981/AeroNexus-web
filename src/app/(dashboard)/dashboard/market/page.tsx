'use client';

import { useEffect, useState } from 'react';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface AircraftType {
  id: string;
  icao_code: string;
  manufacturer: string;
  name: string;
  aircraft_category: string;
  pax_capacity: number;
  cruise_speed_kts: number | null;
  max_range_nm: number | null;
  base_price: number | null;
  engine_type: string;
  engine_count: number;
  manufacturer_icao: string | null;
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

const CATEGORY_ICON: Record<string, string> = {
  FIXED_WING: '✈️', HELICOPTER: '🚁', SEAPLANE: '🛥️', BALLOON: '🎈',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-400', B: 'text-green-300', C: 'text-amber-400',
  D: 'text-orange-400', E: 'text-red-400', F: 'text-red-600',
};

function formatPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function MarketPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [tab, setTab] = useState<'new' | 'used'>('new');
  const [newAircraft, setNewAircraft] = useState<AircraftType[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Buy new state
  const [buying, setBuying] = useState<AircraftType | null>(null);
  const [buyReg, setBuyReg] = useState('');
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyResult, setBuyResult] = useState<{ message: string; factory_airport: string | null; delivery_fee?: number; delivery_distance_nm?: number; delivery_from?: string | null; delivery_to?: string | null } | null>(null);
  const [deliveryEstimate, setDeliveryEstimate] = useState<{ fee: number; distance_nm: number; from: string | null; to: string | null } | null>(null);

  useEffect(() => {
    Promise.all([
      publicApi.get('/aircraft-types'),
      publicApi.get('/market/listings'),
    ]).then(([a, l]) => {
      setNewAircraft(a.data);
      setListings(l.data);
    }).finally(() => setLoading(false));
  }, []);

  const filteredNew = newAircraft.filter((a) =>
    (!categoryFilter || a.aircraft_category === categoryFilter) &&
    `${a.manufacturer} ${a.name} ${a.icao_code}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsed = listings.filter((l) =>
    (!categoryFilter || l.hull.aircraft_category === categoryFilter) &&
    `${l.hull.aircraft_type} ${l.hull.registration}`.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSelectBuying(type: AircraftType) {
    setBuying(type);
    setBuyReg('');
    setDeliveryEstimate(null);
    if (type.manufacturer_icao) {
      try {
        const { data } = await api.get(`/market/delivery-estimate?aircraft_type_id=${type.id}`);
        setDeliveryEstimate({ fee: data.fee, distance_nm: data.distance_nm, from: data.from, to: data.to });
      } catch { /* ignore */ }
    }
  }

  async function handleBuyNew() {
    if (!buying || !buyReg.trim()) return;
    setBuyLoading(true);
    try {
      const { data } = await api.post('/market/buy/new', {
        aircraft_type_id: buying.id,
        registration: buyReg.toUpperCase(),
        payment_type: 'BUY',
      });
      setBuyResult({
        message: data.message,
        factory_airport: data.factory_airport,
        delivery_fee: data.delivery_fee,
        delivery_distance_nm: data.delivery_distance_nm,
        delivery_from: data.delivery_from,
        delivery_to: data.delivery_to,
      });
      setBuying(null);
      setBuyReg('');
      setDeliveryEstimate(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Purchase failed');
    } finally {
      setBuyLoading(false);
    }
  }

  async function handleBuyUsed(listingId: string) {
    const reg = prompt('Enter a registration number for this aircraft (or leave blank to keep existing):');
    try {
      await api.post(`/market/buy/used/${listingId}`, { registration: reg || undefined });
      setListings(listings.filter((l) => l.id !== listingId));
      alert('Purchase successful! Check your fleet.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Purchase failed');
    }
  }

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Aircraft Market</h1>
        <p className="text-gray-400 text-sm">
          {newAircraft.length} aircraft types from manufacturer · {listings.length} used listings
        </p>
      </div>

      {/* Purchase success */}
      {buyResult && (
        <div className="glass-card rounded-2xl p-5 mb-6 border border-green-500/30 bg-green-500/5">
          <p className="text-green-400 font-bold mb-1">✅ Purchase Successful!</p>
          <p className="text-sm text-gray-300">{buyResult.message}</p>
          {buyResult.delivery_fee && buyResult.delivery_fee > 0 && (
            <p className="text-xs text-amber-400 mt-2">
              🚚 Delivery fee charged: <span className="font-bold">{formatPrice(buyResult.delivery_fee)}</span>
              {buyResult.delivery_distance_nm ? ` (${buyResult.delivery_distance_nm.toLocaleString()} nm from ${buyResult.delivery_from} → ${buyResult.delivery_to})` : ''}
            </p>
          )}
          <button onClick={() => setBuyResult(null)} className="text-xs text-gray-500 mt-3 hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
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
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition flex-1 min-w-48"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition"
        >
          <option value="">All Types</option>
          <option value="FIXED_WING">✈️ Fixed Wing</option>
          <option value="HELICOPTER">🚁 Helicopter</option>
          <option value="SEAPLANE">🛥️ Seaplane</option>
          <option value="BALLOON">🎈 Balloon</option>
        </select>
      </div>

      {/* Buy dialog */}
      {buying && (
        <div className="glass-card rounded-2xl p-6 mb-6 border border-aero/30">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold mb-0.5">Purchasing {buying.manufacturer} {buying.name}</h3>
              <p className="text-xs text-gray-400">
                {buying.manufacturer_icao ? `Factory: ${buying.manufacturer_icao}` : 'No factory location'}
              </p>
            </div>
            <button onClick={() => { setBuying(null); setDeliveryEstimate(null); }} className="text-gray-500 hover:text-white transition text-lg leading-none">✕</button>
          </div>

          {/* Cost breakdown */}
          <div className="glass-card rounded-xl p-4 mb-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Aircraft price</span>
              <span className="font-mono">{formatPrice(buying.base_price ?? 0)}</span>
            </div>
            {deliveryEstimate ? (
              <div className="flex justify-between">
                <span className="text-gray-400">
                  Delivery fee
                  <span className="text-gray-600 text-xs ml-1">
                    ({deliveryEstimate.from} → {deliveryEstimate.to ?? 'hub'}, {deliveryEstimate.distance_nm.toLocaleString()} nm)
                  </span>
                </span>
                <span className="font-mono text-amber-400">{formatPrice(deliveryEstimate.fee)}</span>
              </div>
            ) : buying.manufacturer_icao ? (
              <div className="flex justify-between">
                <span className="text-gray-400">Delivery fee</span>
                <span className="text-gray-500 text-xs">Calculating…</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
              <span>Total</span>
              <span className="text-aero">{formatPrice((buying.base_price ?? 0) + (deliveryEstimate?.fee ?? 0))}</span>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Registration (e.g. N-TVAR1)"
              value={buyReg}
              onChange={(e) => setBuyReg(e.target.value.toUpperCase())}
              maxLength={12}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition"
            />
            <button
              onClick={handleBuyNew}
              disabled={buyLoading || !buyReg.trim()}
              className="bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50"
            >
              {buyLoading ? 'Purchasing...' : `Confirm Purchase`}
            </button>
          </div>
        </div>
      )}

      {/* New aircraft grid */}
      {tab === 'new' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNew.length === 0 ? (
            <div className="col-span-3 text-center text-gray-500 py-12">No aircraft found</div>
          ) : filteredNew.map((type) => (
            <div key={type.id} className="glass-card rounded-2xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-lg mr-2">{CATEGORY_ICON[type.aircraft_category] ?? '✈️'}</span>
                  <span className="font-bold text-sm">{type.manufacturer}</span>
                  <p className="font-bold text-base mt-0.5">{type.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{type.icao_code}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-aero text-lg">{formatPrice(type.base_price ?? 0)}</p>
                  {type.manufacturer_icao && (
                    <p className="text-xs text-gray-500 mt-0.5">Factory: {type.manufacturer_icao}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 text-xs text-gray-400 mb-4 flex-wrap">
                {type.pax_capacity > 0 && <span>👥 {type.pax_capacity} pax</span>}
                {type.max_range_nm && <span>🗺️ {type.max_range_nm.toLocaleString()} nm</span>}
                {type.cruise_speed_kts && <span>💨 {type.cruise_speed_kts} kts</span>}
                <span>🔧 {type.engine_count}× {type.engine_type}</span>
              </div>
              {isManager && (
                <button
                  onClick={() => handleSelectBuying(type)}
                  disabled={!type.base_price}
                  className="mt-auto w-full bg-aero text-black font-bold py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-30"
                >
                  {type.base_price ? `Purchase ${formatPrice(type.base_price)}` : 'Price on request'}
                </button>
              )}
            </div>
          ))}
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
              ? Math.round((1 - listing.asking_price / listing.fair_value) * 100)
              : 0;

            return (
              <div key={listing.id} className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{CATEGORY_ICON[listing.hull.aircraft_category] ?? '✈️'}</span>
                      <span className="font-mono font-bold">{listing.hull.registration}</span>
                      <span className="text-gray-400 text-sm">—</span>
                      <span className="font-bold text-sm">{listing.hull.aircraft_type}</span>
                      {listing.hull.maintenance_grade && (
                        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-lg border border-white/10',
                          GRADE_COLORS[listing.hull.maintenance_grade])}>
                          Grade {listing.hull.maintenance_grade}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Seller: {listing.seller.name} ({listing.seller.icao_code}) ·
                      {Number(listing.hull.airframe_hours).toFixed(0)} hrs ·
                      Engine wear: {Number(listing.hull.engine_wear_percent).toFixed(0)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">{formatPrice(listing.asking_price)}</p>
                    <p className="text-xs text-gray-500">
                      Fair value: {formatPrice(listing.fair_value)}
                      {discount > 0 && <span className="text-green-400 ml-1">({discount}% below)</span>}
                      {discount < 0 && <span className="text-red-400 ml-1">({Math.abs(discount)}% above)</span>}
                    </p>
                  </div>
                </div>

                {/* Maintenance warnings */}
                {listing.maintenance_warnings.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {listing.maintenance_warnings.map((w) => (
                      <span key={w} className="text-xs px-2 py-1 rounded-lg border border-amber-500/20 text-amber-400 bg-amber-500/5">
                        ⚠️ {w}
                      </span>
                    ))}
                  </div>
                )}

                {/* Cabin config */}
                {listing.hull.cabin_configs.length > 0 && (
                  <div className="flex gap-2 mb-4">
                    {listing.hull.cabin_configs.map((c) => (
                      <span key={c.cabin_class} className="text-xs text-gray-400 glass-card px-2 py-1 rounded-lg">
                        {c.cabin_class.replace('_', ' ')}: {c.seat_count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {listing.notes && (
                  <p className="text-xs text-gray-400 italic mb-4">"{listing.notes}"</p>
                )}

                {isManager && (
                  <button
                    onClick={() => handleBuyUsed(listing.id)}
                    className="w-full bg-aero text-black font-bold py-2.5 rounded-xl hover:brightness-110 transition text-sm"
                  >
                    Buy for {formatPrice(listing.asking_price)}
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
