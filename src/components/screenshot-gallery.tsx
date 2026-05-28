'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';

interface Screenshot {
  src: string;
  alt: string;
  label: string;
  width: number;
  height: number;
}

function BrowserChrome({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' }) {
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <div className="bg-white/5 px-5 py-2.5 flex items-center gap-2 border-b border-white/10">
      <span className={`${dot} rounded-full bg-red-500/60`} />
      <span className={`${dot} rounded-full bg-yellow-500/60`} />
      <span className={`${dot} rounded-full bg-green-500/60`} />
      <span className="text-xs text-gray-500 ml-2 font-mono">{label}</span>
    </div>
  );
}

function ScreenshotCard({ shot, onOpen }: { shot: Screenshot; onOpen: (s: Screenshot) => void }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/10 shadow-xl cursor-zoom-in group"
      onClick={() => onOpen(shot)}
    >
      <BrowserChrome label={shot.label} size="sm" />
      <div className="relative overflow-hidden">
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white bg-black/60 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-sm">
            Click to expand
          </span>
        </div>
      </div>
    </div>
  );
}

function Lightbox({ shot, onClose }: { shot: Screenshot; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="relative max-w-[95vw] max-h-[90vh] rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1a1a1a] px-5 py-2.5 flex items-center gap-2 border-b border-white/10">
          <button
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer"
            aria-label="Close"
          />
          <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <span className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="text-xs text-gray-400 ml-3 font-mono flex-1">{shot.label}</span>
          <span className="text-xs text-gray-600">ESC to close</span>
        </div>
        <div className="overflow-auto max-h-[calc(90vh-44px)]">
          <Image
            src={shot.src}
            alt={shot.alt}
            width={shot.width}
            height={shot.height}
            className="block"
            style={{ width: shot.width, height: 'auto', maxWidth: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}

const SCREENSHOTS: Screenshot[] = [
  { src: '/screenshots/routes-hubs.png', alt: 'Routes & Hubs — route planning with live demand scores', label: 'Routes & Hubs', width: 1366, height: 768 },
  { src: '/screenshots/fleet.png', alt: 'Fleet management — aircraft status, wear tracking', label: 'Fleet Management', width: 1366, height: 624 },
  { src: '/screenshots/crew-center.png', alt: 'Crew Center — pilot roster, rank structure, applications', label: 'Crew Center', width: 1366, height: 624 },
  { src: '/screenshots/finances.png', alt: 'Finances — P&L dashboard, transactions, operating summary', label: 'Finances', width: 1280, height: 960 },
  { src: '/screenshots/insurance.png', alt: 'Insurance marketplace — policy comparison and management', label: 'Insurance', width: 1280, height: 720 },
];

const DASHBOARD: Screenshot = {
  src: '/screenshots/dashboard.png',
  alt: 'AeroNexus dashboard — airline management home',
  label: 'aeronexus.app/dashboard',
  width: 1366,
  height: 768,
};

const AIRPORT: Screenshot = {
  src: '/screenshots/airport-directory.png',
  alt: 'Airport directory — search 85,289 airports, heliports and seaplane bases',
  label: 'Airport Directory — 85,289 facilities',
  width: 1280,
  height: 720,
};

export function ScreenshotGallery() {
  const [active, setActive] = useState<Screenshot | null>(null);
  const open = useCallback((s: Screenshot) => setActive(s), []);
  const close = useCallback(() => setActive(null), []);

  return (
    <>
      {/* Featured — Dashboard */}
      <div
        className="mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl cursor-zoom-in group"
        onClick={() => open(DASHBOARD)}
      >
        <BrowserChrome label={DASHBOARD.label} />
        <div className="relative overflow-hidden">
          <Image
            src={DASHBOARD.src}
            alt={DASHBOARD.alt}
            width={DASHBOARD.width}
            height={DASHBOARD.height}
            className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.01]"
            priority
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white bg-black/60 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-sm">
              Click to expand
            </span>
          </div>
        </div>
      </div>

      {/* 2-col row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {SCREENSHOTS.slice(0, 2).map((s) => (
          <ScreenshotCard key={s.src} shot={s} onOpen={open} />
        ))}
      </div>

      {/* 3-col row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SCREENSHOTS.slice(2).map((s) => (
          <ScreenshotCard key={s.src} shot={s} onOpen={open} />
        ))}
      </div>

      {/* Airport directory — full width accent */}
      <div
        className="mt-6 rounded-2xl overflow-hidden border border-aero/20 shadow-xl shadow-aero/5 cursor-zoom-in group"
        onClick={() => open(AIRPORT)}
      >
        <BrowserChrome label={AIRPORT.label} />
        <div className="relative overflow-hidden">
          <Image
            src={AIRPORT.src}
            alt={AIRPORT.alt}
            width={AIRPORT.width}
            height={AIRPORT.height}
            className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white bg-black/60 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-sm">
              Click to expand
            </span>
          </div>
        </div>
      </div>

      {active && <Lightbox shot={active} onClose={close} />}
    </>
  );
}
