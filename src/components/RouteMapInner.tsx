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

      // Airport markers
      for (const [lon, lat, icao, isOrigin] of [
        [originLon, originLat, originIcao, true],
        [destLon, destLat, destIcao, false],
      ] as [number, number, string, boolean][]) {
        const el = document.createElement('div');
        el.style.cssText = `
          width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          background:${isOrigin ? 'rgba(0,209,255,0.15)' : 'rgba(255,255,255,0.08)'};
          border:2px solid ${isOrigin ? '#00D1FF' : 'rgba(255,255,255,0.4)'};
          font-family:monospace;font-size:7px;font-weight:700;
          color:${isOrigin ? '#00D1FF' : '#fff'};cursor:default;
        `;
        el.textContent = icao;
        new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
      }
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [originLat, originLon, destLat, destLon, originIcao, destIcao]);

  return <div ref={containerRef} style={{ width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden' }} />;
}
