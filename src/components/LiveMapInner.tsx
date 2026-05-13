'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { LiveFlight } from '@/app/(dashboard)/dashboard/map/page';

interface Props {
  flights: LiveFlight[];
  selected: LiveFlight | null;
  onSelect: (f: LiveFlight | null) => void;
  pollIntervalMs?: number;
}

// Per-marker interpolation state
interface MarkerState {
  marker: maplibregl.Marker;
  el: HTMLElement;
  fromLng: number;
  fromLat: number;
  fromHdg: number;
  toLng: number;
  toLat: number;
  toHdg: number;
  interpStart: number; // timestamp when this interpolation began
}

function buildSvg(hdg: number, category: string, sel: boolean, noTelemetry = false): string {
  const isHeli = category === 'HELICOPTER';
  const color = sel ? '#ffffff' : noTelemetry ? '#6B7280' : '#00D1FF';
  const opacity = noTelemetry ? 0.5 : sel ? 1 : 0.9;
  const size = sel ? 32 : 24;
  return isHeli
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="transform:rotate(${hdg}deg);filter:drop-shadow(0 0 4px ${color}88)">
        <circle cx="12" cy="12" r="3" fill="${color}" opacity="${opacity}"/>
        <line x1="2" y1="12" x2="22" y2="12" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="${opacity}"/>
        <line x1="12" y1="2" x2="12" y2="8" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="${opacity}"/>
      </svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="transform:rotate(${hdg}deg);filter:drop-shadow(0 0 4px ${color}88)">
        <path d="M12 2L8 10H4L6 12H8L7 17L5 18V20L12 18L19 20V18L17 17L16 12H18L20 10H16L12 2Z" fill="${color}" opacity="${opacity}"/>
      </svg>`;
}

// Shortest-path heading interpolation (handles 359→1 wrap)
function lerpHdg(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

// Smooth ease-in-out
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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

export default function LiveMapInner({ flights, selected, onSelect, pollIntervalMs = 10000 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerState>>(new Map());
  const mapReadyRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const selectedRef = useRef<LiveFlight | null>(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // ─── Map init ───────────────────────────────────────────────────────────────
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
      map.addLayer({ id: 'route-arc-glow', type: 'line', source: 'route-arc', paint: { 'line-color': '#00D1FF', 'line-width': 6, 'line-opacity': 0.15 } });
      map.addLayer({ id: 'route-arc-line', type: 'line', source: 'route-arc', paint: { 'line-color': '#00D1FF', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [4, 4] }, layout: { 'line-cap': 'round' } });
      mapReadyRef.current = true;
    });

    mapRef.current = map;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      mapReadyRef.current = false;
    };
  }, []);

  // ─── RAF interpolation loop ─────────────────────────────────────────────────
  useEffect(() => {
    function tick() {
      const now = performance.now();
      markersRef.current.forEach((state) => {
        const elapsed = now - state.interpStart;
        const t = easeInOut(Math.min(1, elapsed / pollIntervalMs));

        const lng = state.fromLng + (state.toLng - state.fromLng) * t;
        const lat = state.fromLat + (state.toLat - state.fromLat) * t;
        const hdg = lerpHdg(state.fromHdg, state.toHdg, t);

        state.marker.setLngLat([lng, lat]);

        const isSelected = selectedRef.current?.id === state.marker.getElement().dataset.flightId;
        const noTelemetry = state.el.dataset.noTelemetry === '1';
        state.el.innerHTML = buildSvg(hdg, state.el.dataset.category ?? '', isSelected, noTelemetry);
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pollIntervalMs]);

  // ─── Update marker targets when new flight data arrives ────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function applyFlights(m: maplibregl.Map) {
      const now = performance.now();
      const currentIds = new Set(flights.map((f) => f.id));

      // Remove stale markers
      markersRef.current.forEach((state, id) => {
        if (!currentIds.has(id)) { state.marker.remove(); markersRef.current.delete(id); }
      });

      flights.forEach((flight) => {
        if (!flight.current_lat || !flight.current_lon) return;
        const toLng = Number(flight.current_lon);
        const toLat = Number(flight.current_lat);
        const toHdg = flight.current_hdg ?? 0;
        const isSelected = selected?.id === flight.id;
        const existing = markersRef.current.get(flight.id);

        if (existing) {
          // Snapshot current interpolated position as new "from"
          const currentLngLat = existing.marker.getLngLat();
          existing.fromLng = currentLngLat.lng;
          existing.fromLat = currentLngLat.lat;
          existing.fromHdg = lerpHdg(existing.fromHdg, existing.toHdg,
            Math.min(1, (now - existing.interpStart) / pollIntervalMs));
          existing.toLng = toLng;
          existing.toLat = toLat;
          existing.toHdg = toHdg;
          existing.interpStart = now;
          // Update size for selection state
          existing.el.style.width = isSelected ? '32px' : '24px';
          existing.el.style.height = isSelected ? '32px' : '24px';
        } else {
          // New marker — place immediately at target, no interpolation needed
          const el = document.createElement('div');
          el.style.cssText = `width:24px;height:24px;cursor:pointer;`;
          el.dataset.flightId = flight.id;
          el.dataset.category = flight.hull.aircraft_category;
          el.dataset.noTelemetry = flight._no_telemetry ? '1' : '';
          el.innerHTML = buildSvg(toHdg, flight.hull.aircraft_category, false, !!flight._no_telemetry);
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelect(selectedRef.current?.id === flight.id ? null : flight);
          });
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([toLng, toLat])
            .addTo(m);
          markersRef.current.set(flight.id, {
            marker, el,
            fromLng: toLng, fromLat: toLat, fromHdg: toHdg,
            toLng, toLat, toHdg,
            interpStart: now,
          });
        }
      });
    }

    if (!map.isStyleLoaded()) {
      map.once('load', () => applyFlights(map));
    } else {
      applyFlights(map);
    }
  }, [flights, selected, onSelect, pollIntervalMs]);

  // ─── Route arc on selection ─────────────────────────────────────────────────
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
      <div
        ref={containerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
      />

      {selected && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(0,102,255,0.3)', borderRadius: 16, padding: 16, minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: 'monospace', fontWeight: 700, color: '#00D1FF', fontSize: 18, margin: 0 }}>
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
              selected._no_telemetry ? { label: 'Position', value: 'No ACARS signal\n(shown at origin)' } : null,
              !selected._no_telemetry && selected.current_alt_ft != null ? { label: 'Altitude', value: `FL${Math.round(selected.current_alt_ft / 100).toString().padStart(3, '0')}\n${selected.current_alt_ft.toLocaleString()} ft` } : null,
              !selected._no_telemetry && selected.current_spd_kts != null ? { label: 'Speed', value: `${selected.current_spd_kts} kts` } : null,
              !selected._no_telemetry && selected.current_hdg != null ? { label: 'Heading', value: `${selected.current_hdg.toString().padStart(3, '0')}°` } : null,
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
    </>
  );
}
