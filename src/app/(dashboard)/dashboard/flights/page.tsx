'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Route {
  id: string;
  distance_nm: number;
  aircraft_type: string;
  status: string;
  base_ticket_price: number;
  effective_ticket_price: number;
  origin: { icao: string; name: string; city: string | null };
  destination: { icao: string; name: string; city: string | null };
}

interface Hull {
  id: string;
  registration: string;
  aircraft_type: string;
  aircraft_category: string;
  status: string;
  engine_wear_percent: number;
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

export default function BookFlightPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [hulls, setHulls] = useState<Hull[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedHull, setSelectedHull] = useState<Hull | null>(null);
  const [paxCount, setPaxCount] = useState(100);
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

  async function handleBook() {
    if (!selectedRoute || !selectedHull) return;
    setBooking(true);
    try {
      const { data } = await api.post('/flights/book', {
        route_id: selectedRoute.id,
        hull_id: selectedHull.id,
        pax_count: paxCount,
      });
      setBooked(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Booking failed');
    } finally {
      setBooking(false);
    }
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
    } finally {
      setDispatching(false);
    }
  }

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
              { label: 'Passengers', value: paxCount.toLocaleString() },
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
        <p className="text-gray-400 text-sm">Select a route, aircraft, and passenger count.</p>
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
                  <span className="font-mono font-bold text-sm">
                    {route.origin.icao} → {route.destination.icao}
                  </span>
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
                  <span className={cn('text-xs',
                    Number(hull.engine_wear_percent) >= 90 ? 'text-red-400'
                    : Number(hull.engine_wear_percent) >= 75 ? 'text-amber-400' : 'text-green-400')}>
                    {Number(hull.engine_wear_percent).toFixed(0)}% wear
                  </span>
                </div>
                <p className="text-xs text-gray-500">{hull.aircraft_type}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PAX count & book */}
      {selectedRoute && selectedHull && (
        <div className="glass-card rounded-2xl p-6 mt-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Passengers</h2>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={1}
              max={600}
              value={paxCount}
              onChange={(e) => setPaxCount(parseInt(e.target.value) || 1)}
              className="w-32 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition"
            />
            <p className="text-sm text-gray-400">passengers on</p>
            <p className="font-mono font-bold text-sm">
              {selectedRoute.origin.icao} → {selectedRoute.destination.icao}
            </p>
            <p className="text-gray-500 text-sm">aboard</p>
            <p className="font-mono font-bold text-sm">{selectedHull.registration}</p>
          </div>
          <button
            onClick={handleBook}
            disabled={booking}
            className="mt-5 bg-aero text-black font-bold px-8 py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50"
          >
            {booking ? 'Booking...' : 'Book Flight'}
          </button>
        </div>
      )}
    </div>
  );
}
