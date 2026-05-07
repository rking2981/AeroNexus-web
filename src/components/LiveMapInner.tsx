'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { LiveFlight } from '@/app/(dashboard)/dashboard/map/page';

interface Props {
  flights: LiveFlight[];
  selected: LiveFlight | null;
  onSelect: (f: LiveFlight | null) => void;
}

function createAircraftEl(hdg: number, category: string, selected: boolean): HTMLElement {
  const isHeli = category === 'HELICOPTER';
  const color = selected ? '#ffffff' : '#00D1FF';
  const size = selected ? 28 : 22;
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;
  el.innerHTML = isHeli
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="transform:rotate(${hdg}deg);filter:drop-shadow(0 0 4px ${color}88)">
        <circle cx="12" cy="12" r="3" fill="${color}"/>
        <line x1="2" y1="12" x2="22" y2="12" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="2" x2="12" y2="8" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      </svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="transform:rotate(${hdg}deg);filter:drop-shadow(0 0 4px ${color}88)">
        <path d="M12 2L8 10H4L6 12H8L7 17L5 18V20L12 18L19 20V18L17 17L16 12H18L20 10H16L12 2Z" fill="${color}" opacity="${selected ? 1 : 0.9}"/>
      </svg>`;
  return el;
}

// Generate a great-circle arc between two lon/lat points
function greatCircleArc(
  from: [number, number],
  to: [number, number],
  steps = 64,
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const [lon1, lat1] = from.map(toRad);
  const [lon2, lat2] = to.map(toRad);

  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ));

  if (d === 0) return [from, to];

  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const A = Math.sin((1 - t) * d) / Math.sin(d);
    const B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    return [toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))] as [number, number];
  });
}

export default function LiveMapInner({ flights, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());
  const mapReadyRef = useRef(false);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [0, 20],
      zoom: 2,
      interactive: true,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      // Route arc source + layers (empty initially)
      map.addSource('route-arc', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: 'route-arc-glow',
        type: 'line',
        source: 'route-arc',
        paint: { 'line-color': '#00D1FF', 'line-width': 8, 'line-opacity': 0.1, 'line-blur': 6 },
      });
      map.addLayer({
        id: 'route-arc-line',
        type: 'line',
        source: 'route-arc',
        paint: { 'line-color': '#00D1FF', 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [4, 4] },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      mapReadyRef.current = true;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      mapReadyRef.current = false;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(flights.map((f) => f.id));

    markersRef.current.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    });

    flights.forEach((flight) => {
      if (!flight.current_lat || !flight.current_lon) return;
      const lng = Number(flight.current_lon);
      const lat = Number(flight.current_lat);
      const hdg = flight.current_hdg ?? 0;
      const isSelected = selected?.id === flight.id;
      const existing = markersRef.current.get(flight.id);

      if (existing) {
        existing.marker.setLngLat([lng, lat]);
        const newEl = createAircraftEl(hdg, flight.hull.aircraft_category, isSelected);
        newEl.addEventListener('click', (e) => { e.stopPropagation(); onSelect(isSelected ? null : flight); });
        existing.marker.getElement().replaceWith(newEl);
        markersRef.current.set(flight.id, { marker: existing.marker, el: newEl });
      } else {
        const el = createAircraftEl(hdg, flight.hull.aircraft_category, isSelected);
        el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(isSelected ? null : flight); });
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.set(flight.id, { marker, el });
      }
    });
  }, [flights, selected, onSelect]);

  // Update arc + fly to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const src = map.getSource('route-arc') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    if (selected?.route) {
      const from: [number, number] = [
        Number(selected.route.origin.longitude),
        Number(selected.route.origin.latitude),
      ];
      const to: [number, number] = [
        Number(selected.route.destination.longitude),
        Number(selected.route.destination.latitude),
      ];
      const arc = greatCircleArc(from, to);
      src.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: arc },
        properties: {},
      });

      // Fly to aircraft
      if (selected.current_lat && selected.current_lon) {
        map.flyTo({
          center: [Number(selected.current_lon), Number(selected.current_lat)],
          zoom: Math.max(map.getZoom(), 5),
          duration: 900,
        });
      }
    } else {
      // Clear arc
      src.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] },
        properties: {},
      });
    }
  }, [selected]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Detail card — top left when flight selected */}
      {selected && (
        <div className="absolute top-4 left-4 z-10 glass-card rounded-2xl p-4 min-w-[260px] border border-aero/20 shadow-xl">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-mono font-bold text-aero text-lg leading-tight">
                {selected.route?.origin.icao ?? '?'} → {selected.route?.destination.icao ?? '?'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selected.route?.origin.name} → {selected.route?.destination.name}
              </p>
            </div>
            <button onClick={() => onSelect(null)} className="text-gray-500 hover:text-white text-lg leading-none ml-3 mt-0.5">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-white/5 pt-3">
            <div>
              <p className="text-gray-500 mb-0.5">Aircraft</p>
              <p className="font-mono text-white">{selected.hull.registration}</p>
              <p className="text-gray-400">{selected.hull.aircraft_type}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">Pilot</p>
              <p className="text-white">{selected.pilot.display_name}</p>
              {selected.airline && <p className="text-gray-400">{selected.airline.name}</p>}
            </div>
            {selected.current_alt_ft != null && (
              <div>
                <p className="text-gray-500 mb-0.5">Altitude</p>
                <p className="font-mono text-white">FL{Math.round(selected.current_alt_ft / 100).toString().padStart(3, '0')}</p>
                <p className="text-gray-400">{selected.current_alt_ft.toLocaleString()} ft</p>
              </div>
            )}
            {selected.current_spd_kts != null && (
              <div>
                <p className="text-gray-500 mb-0.5">Speed</p>
                <p className="font-mono text-white">{selected.current_spd_kts} kts</p>
              </div>
            )}
            {selected.current_hdg != null && (
              <div>
                <p className="text-gray-500 mb-0.5">Heading</p>
                <p className="font-mono text-white">{selected.current_hdg.toString().padStart(3, '0')}°</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 mb-0.5">Status</p>
              <p className="text-aero font-bold uppercase text-[10px] tracking-widest">{selected.status}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {flights.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="glass-card rounded-2xl p-8 text-center max-w-xs">
            <p className="text-4xl mb-3">🌍</p>
            <p className="font-bold mb-1">No Active Flights</p>
            <p className="text-gray-500 text-sm">The skies are quiet. Start a flight to appear on the map.</p>
          </div>
        </div>
      )}
    </div>
  );
}
