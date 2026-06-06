'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface Props {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  originIcao: string;
  destIcao: string;
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

export default function RouteMapInner({ originLat, originLon, destLat, destLon, originIcao, destIcao }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const midLon = (originLon + destLon) / 2;
    const midLat = (originLat + destLat) / 2;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [midLon, midLat],
      zoom: 3,
      interactive: true,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      // Fit bounds to show both airports with padding
      map.fitBounds(
        [[Math.min(originLon, destLon), Math.min(originLat, destLat)],
         [Math.max(originLon, destLon), Math.max(originLat, destLat)]],
        { padding: 60, animate: false },
      );

      // Great-circle route line
      const arc = greatCircleArc([originLon, originLat], [destLon, destLat]);
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arc } },
      });
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#00D1FF', 'line-width': 6, 'line-opacity': 0.15 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#00D1FF', 'line-width': 2, 'line-opacity': 0.9, 'line-dasharray': [4, 3] },
      });

      // Departure icon (origin) — plane climbing right
      const departureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36">
        <filter id="gd"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#00D1FF" flood-opacity="0.8"/></filter>
        <g filter="url(#gd)" fill="#00D1FF">
          <path d="M4 44h56v4H4z"/>
          <path d="M8 36 L28 20 L36 24 L22 34 L32 34 L52 22 L58 26 L32 42 L8 42 Z"/>
        </g>
      </svg>`;

      // Arrival icon (destination) — plane descending left
      const arrivalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36">
        <filter id="ga"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#fff" flood-opacity="0.6"/></filter>
        <g filter="url(#ga)" fill="#ffffff">
          <path d="M4 44h56v4H4z"/>
          <path d="M56 36 L36 20 L28 24 L42 34 L32 34 L12 22 L6 26 L32 42 L56 42 Z"/>
        </g>
      </svg>`;

      for (const [lon, lat, icao, isOrigin] of [
        [originLon, originLat, originIcao, true],
        [destLon, destLat, destIcao, false],
      ] as [number, number, string, boolean][]) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;cursor:default;';

        const icon = document.createElement('div');
        icon.innerHTML = isOrigin ? departureSvg : arrivalSvg;

        const label = document.createElement('div');
        label.style.cssText = `font-family:monospace;font-size:9px;font-weight:700;color:${isOrigin ? '#00D1FF' : '#fff'};text-shadow:0 0 4px #000;background:rgba(0,0,0,0.6);padding:1px 4px;border-radius:3px;`;
        label.textContent = icao;

        wrapper.appendChild(icon);
        wrapper.appendChild(label);
        new maplibregl.Marker({ element: wrapper, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(map);
      }
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [originLat, originLon, destLat, destLon, originIcao, destIcao]);

  return <div ref={containerRef} style={{ width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden' }} />;
}
