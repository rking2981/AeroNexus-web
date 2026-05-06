'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface TrackPoint {
  lat: string | number;
  lon: string | number;
  alt_ft?: number | null;
}

interface Props {
  origin: { icao: string; latitude: string | number; longitude: string | number };
  destination: { icao: string; latitude: string | number; longitude: string | number };
  trackPoints?: TrackPoint[];
  height?: string;
  interactive?: boolean;
}

export function FlightTrackMap({ origin, destination, trackPoints = [], height = '280px', interactive = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const originCoords: [number, number] = [Number(origin.longitude), Number(origin.latitude)];
    const destCoords: [number, number] = [Number(destination.longitude), Number(destination.latitude)];

    // Build coordinate list for the track
    const coords: [number, number][] = trackPoints.length >= 2
      ? trackPoints.map((p) => [Number(p.lon), Number(p.lat)])
      : [originCoords, destCoords];

    // Compute bounding box
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const bounds: maplibregl.LngLatBoundsLike = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      interactive,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Fit to track bounds with padding
      map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 0 });

      // Track line
      map.addSource('track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        },
      });

      // Glow layer
      map.addLayer({
        id: 'track-glow',
        type: 'line',
        source: 'track',
        paint: {
          'line-color': '#00D1FF',
          'line-width': 8,
          'line-opacity': 0.15,
          'line-blur': 4,
        },
      });

      // Main track line
      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        paint: {
          'line-color': '#00D1FF',
          'line-width': 2.5,
          'line-opacity': 0.9,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      // Origin marker
      new maplibregl.Marker({ color: '#00D1FF', scale: 0.8 })
        .setLngLat(originCoords)
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setHTML(`<div style="font-family:monospace;font-size:12px;font-weight:700;color:#00D1FF;background:#0A0A0A;padding:4px 8px;border-radius:6px;">${origin.icao}</div>`))
        .addTo(map);

      // Destination marker
      new maplibregl.Marker({ color: '#ffffff', scale: 0.8 })
        .setLngLat(destCoords)
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setHTML(`<div style="font-family:monospace;font-size:12px;font-weight:700;color:#fff;background:#0A0A0A;padding:4px 8px;border-radius:6px;">${destination.icao}</div>`))
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl overflow-hidden border border-white/10"
    />
  );
}
