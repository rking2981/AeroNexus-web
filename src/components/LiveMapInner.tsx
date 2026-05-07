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
  const color = selected ? '#ff6600' : '#0066ff';
  const size = selected ? 32 : 24;
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;
  el.innerHTML = isHeli
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="transform:rotate(${hdg}deg)">
        <circle cx="12" cy="12" r="3" fill="${color}"/>
        <line x1="2" y1="12" x2="22" y2="12" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      </svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="transform:rotate(${hdg}deg)">
        <path d="M12 2L8 10H4L6 12H8L7 17L5 18V20L12 18L19 20V18L17 17L16 12H18L20 10H16L12 2Z" fill="${color}"/>
      </svg>`;
  return el;
}

function greatCircleArc(from: [number, number], to: [number, number], steps = 64): [number, number][] {
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      map.addSource('route-arc', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });
      map.addLayer({ id: 'route-arc-glow', type: 'line', source: 'route-arc', paint: { 'line-color': '#0066ff', 'line-width': 6, 'line-opacity': 0.15 } });
      map.addLayer({ id: 'route-arc-line', type: 'line', source: 'route-arc', paint: { 'line-color': '#0066ff', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [4, 4] }, layout: { 'line-cap': 'round' } });
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(flights.map((f) => f.id));
    markersRef.current.forEach((entry, id) => {
      if (!currentIds.has(id)) { entry.marker.remove(); markersRef.current.delete(id); }
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
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
        markersRef.current.set(flight.id, { marker, el });
      }
    });
  }, [flights, selected, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const src = map.getSource('route-arc') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    if (selected?.route) {
      const from: [number, number] = [Number(selected.route.origin.longitude), Number(selected.route.origin.latitude)];
      const to: [number, number] = [Number(selected.route.destination.longitude), Number(selected.route.destination.latitude)];
      src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: greatCircleArc(from, to) }, properties: {} });
      if (selected.current_lat && selected.current_lon) {
        map.flyTo({ center: [Number(selected.current_lon), Number(selected.current_lat)], zoom: Math.max(map.getZoom(), 5), duration: 900 });
      }
    } else {
      src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} });
    }
  }, [selected]);

  return (
    <>
      {/* Map container — must have explicit width/height for MapLibre */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
      />

      {/* Detail card */}
      {selected && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(0,102,255,0.3)', borderRadius: 16, padding: 16, minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0066ff', fontSize: 18, margin: 0 }}>
                {selected.route?.origin.icao ?? '?'} → {selected.route?.destination.icao ?? '?'}
              </p>
              <p style={{ color: '#6B7280', fontSize: 11, margin: '2px 0 0' }}>
                {selected.route?.origin.name} → {selected.route?.destination.name}
              </p>
            </div>
            <button onClick={() => onSelect(null)} style={{ color: '#6B7280', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', marginLeft: 12 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
            {[
              { label: 'Aircraft', value: `${selected.hull.registration}\n${selected.hull.aircraft_type}` },
              { label: 'Pilot', value: `${selected.pilot.display_name}${selected.airline ? '\n' + selected.airline.name : ''}` },
              selected.current_alt_ft != null ? { label: 'Altitude', value: `FL${Math.round(selected.current_alt_ft / 100).toString().padStart(3, '0')}\n${selected.current_alt_ft.toLocaleString()} ft` } : null,
              selected.current_spd_kts != null ? { label: 'Speed', value: `${selected.current_spd_kts} kts` } : null,
              selected.current_hdg != null ? { label: 'Heading', value: `${selected.current_hdg.toString().padStart(3, '0')}°` } : null,
              { label: 'Status', value: selected.status },
            ].filter(Boolean).map((row) => (
              <div key={row!.label}>
                <p style={{ color: '#6B7280', margin: '0 0 2px', fontSize: 10 }}>{row!.label}</p>
                {row!.value.split('\n').map((line, i) => (
                  <p key={i} style={{ color: i === 0 ? '#fff' : '#9CA3AF', margin: 0, fontFamily: 'monospace', fontSize: 12 }}>{line}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {flights.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(10,10,10,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '32px 40px', textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 12px' }}>🌍</p>
            <p style={{ color: '#fff', fontWeight: 700, margin: '0 0 4px' }}>No Active Flights</p>
            <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>The skies are quiet. Start a flight to appear on the map.</p>
          </div>
        </div>
      )}
    </>
  );
}
