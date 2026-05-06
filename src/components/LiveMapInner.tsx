'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface LiveFlight {
  id: string;
  status: string;
  current_lat: string | null;
  current_lon: string | null;
  current_alt_ft: number | null;
  current_hdg: number | null;
  current_spd_kts: number | null;
  hull: { registration: string; aircraft_type: string; aircraft_category: string };
  pilot: { display_name: string };
  airline: { name: string; icao_code: string } | null;
  route: {
    origin: { icao: string; name: string };
    destination: { icao: string; name: string };
  } | null;
}

interface Props {
  flights: LiveFlight[];
  selected: LiveFlight | null;
  onSelect: (f: LiveFlight | null) => void;
}

// SVG aircraft icon — rotatable
function createAircraftEl(hdg: number, category: string, selected: boolean): HTMLElement {
  const isHeli = category === 'HELICOPTER';
  const color = selected ? '#ffffff' : '#00D1FF';
  const size = selected ? 28 : 22;

  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;

  // Rotate to heading (SVG is pointing up = north = 0°)
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

export default function LiveMapInner({ flights, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());

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
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Update markers when flights or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(flights.map((f) => f.id));

    // Remove stale markers
    markersRef.current.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    flights.forEach((flight) => {
      if (!flight.current_lat || !flight.current_lon) return;

      const lng = Number(flight.current_lon);
      const lat = Number(flight.current_lat);
      const hdg = flight.current_hdg ?? 0;
      const isSelected = selected?.id === flight.id;

      const existing = markersRef.current.get(flight.id);

      if (existing) {
        // Update position and re-render icon
        existing.marker.setLngLat([lng, lat]);
        const newEl = createAircraftEl(hdg, flight.hull.aircraft_category, isSelected);
        newEl.addEventListener('click', () => onSelect(isSelected ? null : flight));
        existing.marker.getElement().replaceWith(newEl);
        // Update stored el reference
        markersRef.current.set(flight.id, { marker: existing.marker, el: newEl });
      } else {
        // Create new marker
        const el = createAircraftEl(hdg, flight.hull.aircraft_category, isSelected);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect(isSelected ? null : flight);
        });

        const popup = new maplibregl.Popup({
          closeButton: false,
          offset: 16,
          className: 'aero-popup',
        }).setHTML(`
          <div style="font-family:monospace;background:#0A0A0A;border:1px solid rgba(0,209,255,0.2);border-radius:8px;padding:8px 12px;min-width:160px;">
            <p style="color:#00D1FF;font-weight:700;font-size:13px;margin:0 0 4px;">
              ${flight.route?.origin.icao ?? '?'} → ${flight.route?.destination.icao ?? '?'}
            </p>
            <p style="color:#9CA3AF;font-size:11px;margin:0 0 2px;">${flight.hull.registration} · ${flight.hull.aircraft_type}</p>
            <p style="color:#6B7280;font-size:10px;margin:0;">${flight.pilot.display_name}</p>
            ${flight.current_alt_ft != null ? `<p style="color:#4B5563;font-size:10px;margin:4px 0 0;">FL${Math.round(flight.current_alt_ft / 100).toString().padStart(3,'0')} · ${flight.current_spd_kts ?? 0}kts</p>` : ''}
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.set(flight.id, { marker, el });
      }
    });

    // Fly to selected flight
    if (selected?.current_lat && selected?.current_lon) {
      map.flyTo({
        center: [Number(selected.current_lon), Number(selected.current_lat)],
        zoom: Math.max(map.getZoom(), 5),
        duration: 800,
      });
    }
  }, [flights, selected, onSelect]);

  return (
    <div className="flex-1 relative">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Selected flight detail overlay */}
      {selected && (
        <div className="absolute top-4 left-4 z-10 glass-card rounded-2xl p-4 min-w-64 border border-aero/20">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-mono font-bold text-aero text-lg">
                {selected.route?.origin.icao ?? '?'} → {selected.route?.destination.icao ?? '?'}
              </p>
              <p className="text-xs text-gray-400">
                {selected.route?.origin.name} → {selected.route?.destination.name}
              </p>
            </div>
            <button
              onClick={() => onSelect(null)}
              className="text-gray-500 hover:text-white text-lg leading-none ml-3"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Aircraft</p>
              <p className="font-mono text-white">{selected.hull.registration}</p>
              <p className="text-gray-400">{selected.hull.aircraft_type}</p>
            </div>
            <div>
              <p className="text-gray-500">Pilot</p>
              <p className="text-white">{selected.pilot.display_name}</p>
              {selected.airline && <p className="text-gray-400">{selected.airline.name}</p>}
            </div>
            {selected.current_alt_ft != null && (
              <div>
                <p className="text-gray-500">Altitude</p>
                <p className="font-mono text-white">FL{Math.round(selected.current_alt_ft / 100).toString().padStart(3, '0')}</p>
                <p className="text-gray-400">{selected.current_alt_ft.toLocaleString()} ft</p>
              </div>
            )}
            {selected.current_spd_kts != null && (
              <div>
                <p className="text-gray-500">Speed</p>
                <p className="font-mono text-white">{selected.current_spd_kts} kts</p>
              </div>
            )}
            {selected.current_hdg != null && (
              <div>
                <p className="text-gray-500">Heading</p>
                <p className="font-mono text-white">{selected.current_hdg.toString().padStart(3, '0')}°</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Status</p>
              <p className="text-aero font-bold uppercase text-[10px]">{selected.status}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state overlay */}
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
