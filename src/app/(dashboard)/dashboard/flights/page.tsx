'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AdSenseUnit } from '@/components/shared/AdSenseUnit';
import { cn } from '@/lib/utils';

interface Route {
  id: string;
  distance_nm: number;
  aircraft_type: string;
  flight_number: string | null;
  route_type: string;
  status: string;
  base_ticket_price: number;
  effective_ticket_price: number;
  business_price: number | null;
  first_price: number | null;
  cabin_split: { economy: number; business: number; first: number } | null;
  demand_score: number | null;
  origin: { icao: string; name: string; city: string | null; facility_type: string };
  destination: { icao: string; name: string; city: string | null; facility_type: string };
}

interface Hull {
  id: string;
  registration: string;
  aircraft_type: string;
  aircraft_category: string;
  status: string;
  engine_wear_percent: number;
  wear_score: number;
  maintenance_grade: string;
  aircraft_type_rel: { pax_capacity: number | null; cargo_capacity_kg: number } | null;
}

interface CargoShipment {
  id: string;
  origin_icao: string;
  destination_icao: string;
  cargo_type: string;
  weight_kg: number;
  total_value: number;
}

interface PaxPreview {
  estimated_pax: number;
  pax_economy: number;
  pax_business: number;
  pax_first: number;
  load_factor: number;
  estimated_revenue: number;
  capacity: number;
  abuse_cap_active: boolean;
  hull_override: boolean;
  cabin_split_used: { economy: number; business: number; first: number };
  prices: { economy: number; business: number; first: number };
  factors: {
    demand: number;
    price: number;
    concurrent: number;
    reputation: number;
    frequency: number;
    competitors: number;
    concurrent_flights: number;
  };
}

interface BookingInfo {
  flight: { id: string };
  route_info: {
    origin: { icao: string; name: string };
    destination: { icao: string; name: string };
    distance_nm: number;
    estimated_duration_min: number;
  };
  aircraft_info: {
    registration: string;
    aircraft_type: string;
    pax_capacity: number | null;
  };
  fuel_price_per_unit: number | null;
  weight_info: {
    payload_kg: number;
    gross_weight_kg: number;
    fuel_weight_kg: number;
    est_fuel_burn_kg: number;
    mtow_kg: number | null;
    fuel_capacity_exceeded: boolean;
    est_fuel_cost: number | null;
  } | null;
  pax_count: number;
}

const ROUTE_TYPE_ICONS: Record<string, string> = {
  SCHEDULED: '🗓️', CARGO: '📦', CHARTER: '🎯', MEDEVAC: '🏥',
  BUSH: '🌲', OFFSHORE: '🛢️', VIP: '⭐', MILITARY: '🎖️', HUMANITARIAN: '❤️',
};

function FactorBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className={color}>{value}%</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color.replace('text-', 'bg-'))}
          style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

const TYPE_RATING_CATEGORIES = ['COMMERCIAL', 'CARGO'];
const TYPE_RATING_REQUIRED = 3;

export default function BookFlightPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [hulls, setHulls] = useState<Hull[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedHull, setSelectedHull] = useState<Hull | null>(null);
  const [preview, setPreview] = useState<PaxPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingErrorIsActive, setBookingErrorIsActive] = useState(false);
  const [booked, setBooked] = useState<BookingInfo | null>(null);
  const [dispatching, setDispatching] = useState(false);
  // type rating progress: map of aircraft_type → completed flight count
  const [typeFlightCounts, setTypeFlightCounts] = useState<Record<string, number>>({});
  // cargo
  const [claimedCargo, setClaimedCargo] = useState<CargoShipment[]>([]);
  const [selectedCargo, setSelectedCargo] = useState<CargoShipment | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/network/routes'),
      api.get('/fleet'),
      api.get('/pilots/profile/me'),
    ]).then(([r, f, p]) => {
      setRoutes(r.data.filter((r: Route) => r.status === 'ACTIVE'));
      setHulls(f.data.filter((h: Hull) => h.status === 'ACTIVE'));
      // Build a count map from recent flights — we get full logbook via profile
      // For accuracy we fetch the logbook separately
    }).finally(() => setLoading(false));

    // Fetch claimed cargo shipments
    api.get('/cargo/board').then(({ data }) => setClaimedCargo(data.claimed ?? [])).catch(() => {});

    // Fetch completed flight counts per aircraft type for type rating progress
    api.get('/flights/logbook').then(({ data }) => {
      const counts: Record<string, number> = {};
      const flights = data.flights ?? data;
      for (const f of flights) {
        const t = f.hull?.aircraft_type;
        if (t) counts[t] = (counts[t] ?? 0) + 1;
      }
      setTypeFlightCounts(counts);
    }).catch(() => {});
  }, []);

  // Fetch PAX preview whenever route + hull are both selected
  const fetchPreview = useCallback(async (routeId: string, hullId: string) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const { data } = await api.get(`/flights/preview-pax?route_id=${routeId}&hull_id=${hullId}`);
      setPreview(data);
    } catch { /* ignore */ } finally { setPreviewLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedRoute && selectedHull) {
      fetchPreview(selectedRoute.id, selectedHull.id);
    } else {
      setPreview(null);
    }
    setSelectedCargo(null);
  }, [selectedRoute, selectedHull, fetchPreview]);

  async function handleBook() {
    if (!selectedRoute || !selectedHull) return;
    setBooking(true);
    setBookingError(''); setBookingErrorIsActive(false);
    try {
      const { data } = await api.post('/flights/book', {
        route_id: selectedRoute.id,
        hull_id: selectedHull.id,
      });
      setBooked(data);
      // Attach cargo if selected
      if (selectedCargo && selectedHull) {
        await api.post('/cargo/attach', {
          shipment_id: selectedCargo.id,
          flight_id: data.flight.id,
          hull_category: selectedHull.aircraft_category,
          hull_cargo_capacity_kg: selectedHull.aircraft_type_rel?.cargo_capacity_kg ?? 0,
        }).catch(() => {});
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Booking failed';
      const isActiveErr = msg.toLowerCase().includes('active flight');
      setBookingError(msg);
      setBookingErrorIsActive(isActiveErr);
    } finally { setBooking(false); }
  }

  async function handleDispatch() {
    if (!booked) return;
    setDispatching(true);
    try {
      await api.patch(`/flights/${booked.flight.id}/dispatch`);
      router.push('/dashboard/logbook');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Dispatch failed');
    } finally { setDispatching(false); }
  }

  // Cargo matching — claimed shipments that match the selected route
  const CARGO_CATEGORIES = ['COMMERCIAL', 'CARGO'];
  const matchingCargo = selectedRoute && selectedHull && CARGO_CATEGORIES.includes(selectedHull.aircraft_category)
    ? claimedCargo.filter(c =>
        c.origin_icao === selectedRoute.origin.icao &&
        c.destination_icao === selectedRoute.destination.icao
      )
    : [];

  // Type rating warning
  const certifications: string[] = (user as { certifications?: string[] } | null)?.certifications ?? [];
  const typeRatingWarning = selectedHull && TYPE_RATING_CATEGORIES.includes(selectedHull.aircraft_category)
    ? (() => {
        const certKey = `${selectedHull.aircraft_type} Type Rating`;
        if (certifications.includes(certKey)) return null;
        const flightsDone = typeFlightCounts[selectedHull.aircraft_type] ?? 0;
        const remaining = TYPE_RATING_REQUIRED - flightsDone;
        return remaining > 0
          ? `No ${selectedHull.aircraft_type} type rating yet — ${flightsDone}/${TYPE_RATING_REQUIRED} qualifying flights completed. ${remaining} more flight${remaining !== 1 ? 's' : ''} to earn your rating.`
          : null; // will be awarded on next completion
      })()
    : null;

  // Hull ↔ route compatibility
  const isHeliRoute = selectedRoute?.origin.facility_type === 'heliport' || selectedRoute?.destination.facility_type === 'heliport';
  const isSeaplaneRoute = selectedRoute?.origin.facility_type === 'seaplane_base' || selectedRoute?.destination.facility_type === 'seaplane_base';
  const incompatibleMsg = selectedRoute && selectedHull
    ? isHeliRoute && selectedHull.aircraft_category !== 'HELICOPTER'
      ? `${isHeliRoute ? (selectedRoute.origin.facility_type === 'heliport' ? selectedRoute.origin.icao : selectedRoute.destination.icao) : ''} is a heliport — requires a helicopter hull`
      : isSeaplaneRoute && selectedHull.aircraft_category !== 'SEAPLANE'
      ? `${selectedRoute.origin.facility_type === 'seaplane_base' ? selectedRoute.origin.icao : selectedRoute.destination.icao} is a seaplane base — requires a seaplane hull`
      : selectedHull.aircraft_category === 'SEAPLANE' && !isSeaplaneRoute
      ? `${selectedHull.registration} is a seaplane — origin or destination must be a seaplane base`
      : null
    : null;

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  // Booking confirmation screen
  if (booked) return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">✈️</div>
        <h1 className="text-2xl font-bold mb-2">Flight Booked!</h1>
        <p className="text-gray-400 text-sm mb-8">Review your flight details and dispatch when ready.</p>

        <div className="glass-card rounded-xl p-5 mb-6 text-left">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-aero">{booked.route_info.origin.icao}</p>
              <p className="text-xs text-gray-400">{booked.route_info.origin.name}</p>
            </div>
            <div className="text-gray-500 text-xl">→</div>
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-aero">{booked.route_info.destination.icao}</p>
              <p className="text-xs text-gray-400">{booked.route_info.destination.name}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Aircraft', value: `${booked.aircraft_info.registration} · ${booked.aircraft_info.aircraft_type}` },
              { label: 'Distance', value: `${booked.route_info.distance_nm.toLocaleString()} nm` },
              { label: 'Est. Duration', value: `${Math.floor(booked.route_info.estimated_duration_min / 60)}h ${booked.route_info.estimated_duration_min % 60}m` },
              { label: 'Passengers', value: booked.pax_count.toLocaleString() },
              { label: 'Fuel Price', value: booked.fuel_price_per_unit ? `$${booked.fuel_price_per_unit.toFixed(4)}/unit` : 'N/A' },
              ...(booked.weight_info ? [
                { label: 'Gross Weight', value: `${booked.weight_info.gross_weight_kg.toLocaleString()} kg${booked.weight_info.mtow_kg ? ` / ${booked.weight_info.mtow_kg.toLocaleString()} kg MTOW` : ''}` },
                { label: 'Est. Fuel Burn', value: `${booked.weight_info.est_fuel_burn_kg.toLocaleString()} kg${booked.weight_info.est_fuel_cost ? ` · ~$${booked.weight_info.est_fuel_cost.toLocaleString()}` : ''}` },
              ] : []),
              ...(selectedCargo ? [{ label: 'Cargo', value: `${selectedCargo.cargo_type} · ${selectedCargo.weight_kg.toLocaleString()} kg / ${Math.round(selectedCargo.weight_kg * 2.20462).toLocaleString()} lbs · +$${Number(selectedCargo.total_value).toLocaleString()}` }] : []),
            ].map((item) => (
              <div key={item.label} className="glass-card rounded-lg p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="font-medium text-sm mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleDispatch} disabled={dispatching}
            className="flex-1 bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
            {dispatching ? 'Dispatching...' : 'Dispatch Flight 🛫'}
          </button>
          <button onClick={() => setBooked(null)}
            className="px-5 text-sm text-gray-400 hover:text-white transition border border-white/10 rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Book a Flight</h1>
        <p className="text-gray-400 text-sm">Select a route and aircraft — passengers are calculated automatically.</p>
      </div>

      {/* AdSense — FREE_ADS pilots only */}
      <AdSenseUnit slot="3456789012" format="horizontal" className="mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route selection */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            Select Route ({routes.length} active)
          </h2>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {routes.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No active routes. Add routes in Network.</p>
            ) : routes.map((route) => (
              <button key={route.id} type="button"
                onClick={() => setSelectedRoute(route)}
                className={cn('text-left p-4 rounded-xl border transition',
                  selectedRoute?.id === route.id
                    ? 'border-aero bg-aero/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5')}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {route.flight_number && (
                      <span className="font-mono text-xs font-bold text-aero border border-aero/30 px-1.5 py-0.5 rounded">
                        {route.flight_number}
                      </span>
                    )}
                    <span className="font-mono font-bold text-sm">
                      {route.origin.icao} → {route.destination.icao}
                    </span>
                    <span className="text-sm">{ROUTE_TYPE_ICONS[route.route_type] ?? '🗓️'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-aero font-bold">${route.effective_ticket_price}</span>
                    {route.business_price && Number(route.business_price) > 0 && (
                      <span className="text-xs text-gray-500 ml-1">/ ${Math.round(Number(route.business_price)).toLocaleString()} biz</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {route.distance_nm.toLocaleString()} nm · {route.aircraft_type}
                  {route.demand_score && <span className="ml-2 text-gray-600">· {Math.round(Number(route.demand_score) * 100)}% demand</span>}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Hull selection */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            Select Aircraft ({hulls.length} active)
          </h2>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {hulls.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No active aircraft. Add aircraft in Fleet.</p>
            ) : hulls.map((hull) => (
              <button key={hull.id} type="button"
                onClick={() => setSelectedHull(hull)}
                className={cn('text-left p-4 rounded-xl border transition',
                  selectedHull?.id === hull.id
                    ? 'border-aero bg-aero/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5')}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-sm">{hull.registration}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold',
                      hull.maintenance_grade === 'A' || hull.maintenance_grade === 'B' ? 'text-green-400'
                      : hull.maintenance_grade === 'C' || hull.maintenance_grade === 'D' ? 'text-amber-400'
                      : 'text-red-400')}>
                      Grade {hull.maintenance_grade}
                    </span>
                    <span className={cn('text-xs',
                      Number(hull.engine_wear_percent) >= 90 ? 'text-red-400'
                      : Number(hull.engine_wear_percent) >= 75 ? 'text-amber-400' : 'text-green-400')}>
                      {Number(hull.engine_wear_percent).toFixed(0)}% wear
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{hull.aircraft_type}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PAX preview + book */}
      {selectedRoute && selectedHull && (
        <div className="glass-card rounded-2xl p-6 mt-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Left: route summary */}
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Flight Summary</h2>
              <div className="flex items-center gap-3 mb-2">
                {selectedRoute.flight_number && (
                  <span className="font-mono text-sm font-bold text-aero border border-aero/30 px-2 py-0.5 rounded">
                    {selectedRoute.flight_number}
                  </span>
                )}
                <span className="font-mono font-bold text-aero">{selectedRoute.origin.icao}</span>
                <span className="text-gray-500">→</span>
                <span className="font-mono font-bold text-white">{selectedRoute.destination.icao}</span>
                <span className="text-gray-500 text-sm">aboard</span>
                <span className="font-mono font-bold text-sm">{selectedHull.registration}</span>
              </div>
              <p className="text-xs text-gray-500">
                {selectedRoute.distance_nm.toLocaleString()} nm · ${selectedRoute.effective_ticket_price}/seat · {selectedRoute.aircraft_type}
              </p>
            </div>

            {/* Right: PAX estimate */}
            <div className="flex-shrink-0 min-w-56">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Passenger Forecast</h3>
              {previewLoading ? (
                <div className="flex flex-col gap-2">
                  <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
                </div>
              ) : preview ? (
                <div>
                  {preview.abuse_cap_active ? (
                    <p className="text-xs text-red-400 mb-2">⚠️ Economy price exceeds $5,000 — market won't support this route. 0 passengers.</p>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-3xl font-bold text-aero">{preview.estimated_pax}</span>
                        <span className="text-sm text-gray-500">/ {preview.capacity} seats</span>
                        <span className={cn('text-xs font-bold',
                          preview.load_factor >= 70 ? 'text-green-400'
                          : preview.load_factor >= 40 ? 'text-amber-400' : 'text-red-400')}>
                          ({preview.load_factor}% load)
                        </span>
                      </div>
                      {(preview.pax_business > 0 || preview.pax_first > 0) && (
                        <div className="flex gap-3 text-xs text-gray-500 mb-1">
                          <span>💺 {preview.pax_economy} eco</span>
                          {preview.pax_business > 0 && <span>🪑 {preview.pax_business} biz</span>}
                          {preview.pax_first > 0 && <span>👑 {preview.pax_first} first</span>}
                        </div>
                      )}
                      {preview.hull_override && (
                        <p className="text-[10px] text-aero/60 mb-2">✦ Cabin split from aircraft config</p>
                      )}
                      <p className="text-xs text-green-400 mb-2">~${preview.estimated_revenue.toLocaleString()} est. revenue</p>
                    </>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <FactorBar label={`Demand${preview.factors.competitors > 0 ? ` (${preview.factors.competitors} competitors)` : ''}`} value={preview.factors.demand} color="text-blue-400" />
                    <FactorBar label={`Price${preview.factors.competitors > 0 ? ' vs market' : ' (no competition)'}`} value={preview.factors.price} color="text-green-400" />
                    <FactorBar label={`Market share${preview.factors.concurrent_flights > 0 ? ` (${preview.factors.concurrent_flights} concurrent)` : ''}`} value={preview.factors.concurrent} color="text-amber-400" />
                    <FactorBar label="Reputation" value={Math.min(100, preview.factors.reputation)} color="text-purple-400" />
                    <FactorBar label="Frequency bonus" value={Math.min(100, preview.factors.frequency ?? 100)} color="text-cyan-400" />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-600">Unable to estimate</p>
              )}
            </div>
          </div>

          {/* Cargo selector */}
          {matchingCargo.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">📦 Add Cargo</p>
              <div className="flex flex-col gap-2">
                {matchingCargo.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => setSelectedCargo(selectedCargo?.id === c.id ? null : c)}
                    className={cn('flex items-center justify-between px-4 py-2.5 rounded-xl border text-left text-sm transition',
                      selectedCargo?.id === c.id
                        ? 'border-green-500/40 bg-green-500/10 text-green-300'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5 text-gray-300')}>
                    <span>{c.cargo_type} · {c.weight_kg.toLocaleString()} kg / {Math.round(c.weight_kg * 2.20462).toLocaleString()} lbs</span>
                    <span className={cn('font-bold', selectedCargo?.id === c.id ? 'text-green-400' : 'text-gray-400')}>
                      +${Number(c.total_value).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
              {selectedCargo && (
                <p className="text-xs text-green-400 mt-1.5">
                  ✓ {selectedCargo.cargo_type} will be loaded — revenue credited on landing
                </p>
              )}
            </div>
          )}

          {incompatibleMsg && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              ⚠️ {incompatibleMsg}
            </div>
          )}
          {typeRatingWarning && !incompatibleMsg && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
              <span className="flex-shrink-0">🎓</span>
              <span>{typeRatingWarning}</span>
            </div>
          )}
          {bookingError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center justify-between gap-3">
              <span>⚠️ {bookingError}</span>
              {bookingErrorIsActive && (
                <Link href="/dashboard/flights/active"
                  className="flex-shrink-0 text-aero font-bold hover:underline text-sm">
                  View Active Flight →
                </Link>
              )}
            </div>
          )}
          <button
            onClick={handleBook}
            disabled={booking || previewLoading || !!incompatibleMsg}
            className="mt-4 bg-aero text-black font-bold px-8 py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50"
          >
            {booking ? 'Booking...' : `Book Flight${preview ? ` · ~${preview.estimated_pax} PAX` : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
