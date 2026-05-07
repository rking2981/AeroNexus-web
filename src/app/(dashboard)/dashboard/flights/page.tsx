'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
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
}

interface PaxPreview {
  estimated_pax: number;
  capacity: number;
  factors: {
    demand: number;
    price: number;
    concurrent: number;
    reputation: number;
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

export default function BookFlightPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [hulls, setHulls] = useState<Hull[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedHull, setSelectedHull] = useState<Hull | null>(null);
  const [preview, setPreview] = useState<PaxPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<BookingInfo | null>(null);
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/network/routes'),
      api.get('/fleet'),
    ]).then(([r, f]) => {
      setRoutes(r.data.filter((r: Route) => r.status === 'ACTIVE'));
      setHulls(f.data.filter((h: Hull) => h.status === 'ACTIVE'));
    }).finally(() => setLoading(false));
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
  }, [selectedRoute, selectedHull, fetchPreview]);

  async function handleBook() {
    if (!selectedRoute || !selectedHull) return;
    setBooking(true);
    try {
      const { data } = await api.post('/flights/book', {
        route_id: selectedRoute.id,
        hull_id: selectedHull.id,
        // No pax_count — server calculates automatically
      });
      setBooked(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Booking failed');
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
                  <span className="text-xs text-aero font-bold">${route.effective_ticket_price}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {route.distance_nm.toLocaleString()} nm · {route.aircraft_type}
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
            <div className="flex-shrink-0 min-w-48">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Estimated PAX</h3>
              {previewLoading ? (
                <div className="flex flex-col gap-2">
                  <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
                </div>
              ) : preview ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-bold text-aero">{preview.estimated_pax}</span>
                    <span className="text-sm text-gray-500">/ {preview.capacity} seats</span>
                    <span className={cn('text-xs font-bold',
                      preview.estimated_pax / preview.capacity >= 0.7 ? 'text-green-400'
                      : preview.estimated_pax / preview.capacity >= 0.4 ? 'text-amber-400' : 'text-red-400')}>
                      ({Math.round(preview.estimated_pax / preview.capacity * 100)}% load)
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FactorBar label={`Demand${preview.factors.competitors > 0 ? ` (${preview.factors.competitors} competitors)` : ''}`} value={preview.factors.demand} color="text-blue-400" />
                    <FactorBar label={`Price${preview.factors.competitors > 0 ? ' vs market' : ' (no competition)'}`} value={preview.factors.price} color="text-green-400" />
                    <FactorBar label={`Market share${preview.factors.concurrent_flights > 0 ? ` (${preview.factors.concurrent_flights} concurrent)` : ''}`} value={preview.factors.concurrent} color="text-amber-400" />
                    <FactorBar label="Pilot reputation" value={Math.min(100, preview.factors.reputation)} color="text-purple-400" />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2">
                    Actual count may vary slightly — final PAX set at booking.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-600">Unable to estimate</p>
              )}
            </div>
          </div>

          {incompatibleMsg && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              ⚠️ {incompatibleMsg}
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
