'use client';

import { useEffect, useRef } from 'react';

interface FuelCrisisEvent {
  country: string;
  multiplier: number;
  airport_count: number;
}

function severityLabel(multiplier: number): string {
  if (multiplier >= 5) return 'CRITICAL';
  if (multiplier >= 3) return 'SEVERE';
  if (multiplier >= 1.5) return 'HIGH';
  return 'ELEVATED';
}

function severityColor(multiplier: number): string {
  if (multiplier >= 5) return 'text-red-400';
  if (multiplier >= 3) return 'text-orange-400';
  if (multiplier >= 1.5) return 'text-amber-400';
  return 'text-yellow-400';
}

export function FuelCrisisTicker({ events }: { events: FuelCrisisEvent[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let pos = 0;
    let raf: number;

    const step = () => {
      pos -= 0.5;
      if (-pos >= track.scrollWidth / 2) pos = 0;
      track.style.transform = `translateX(${pos}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [events]);

  if (events.length === 0) return null;

  const items = [...events, ...events]; // duplicate for seamless loop

  return (
    <div className="w-full bg-yellow-950/60 border-b border-yellow-700/30 overflow-hidden relative z-20">
      <div className="flex items-center">
        <div className="shrink-0 bg-yellow-500/20 border-r border-yellow-700/30 px-4 py-2 flex items-center gap-2">
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
            ⚡ Fuel Crisis
          </span>
        </div>
        <div className="overflow-hidden flex-1">
          <div ref={trackRef} className="flex gap-0 will-change-transform py-2">
            {items.map((e, i) => (
              <span key={i} className="flex items-center gap-3 px-8 whitespace-nowrap text-xs">
                <span className={`font-bold uppercase tracking-wider ${severityColor(e.multiplier)}`}>
                  [{severityLabel(e.multiplier)}]
                </span>
                <span className="text-white font-semibold">{e.country}</span>
                <span className="text-gray-500">·</span>
                <span className={`font-bold ${severityColor(e.multiplier)}`}>
                  Fuel +{Math.round((e.multiplier - 1) * 100)}%
                </span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-400">Affected Airports: {e.airport_count.toLocaleString()}</span>
                <span className="text-gray-700 ml-4">•</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
