'use client';

import { useEffect, useState } from 'react';
import { api, publicApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Mission {
  id: string;
  origin_icao: string;
  destination_icao: string;
  distance_nm: number;
  mission_type: string;
  skyops_brief: string | null;
  notes: string | null;
  cargo_kg: number | null;
  pilot_pay: string | number;
  xp_bonus: number;
  min_block_time_min: number | null;
  training_min_happiness: number | null;
  training_max_vs_fpm: number | null;
  airline: { name: string; icao_code: string };
}

interface AirportInfo {
  icao: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
}

interface Metar {
  icao: string;
  raw: string;
  wind_dir: number | null;
  wind_speed: number | null;
  wind_gust: number | null;
  visibility_sm: number | null;
  sky_conditions: { coverage: string; base_ft: number | null }[];
  temp_c: number | null;
  dewpoint_c: number | null;
  altimeter_hg: number | null;
  wx_string: string | null;
  flight_category: string | null;
  icing_risk: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MISSION_LABELS: Record<string, string> = {
  CARGO: 'Cargo Mission', PASSENGER: 'Passenger Charter',
  TRAINING: 'Training Flight', CUSTOM: 'Custom Mission',
};

const MISSION_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  CARGO:     { border: '#d97706', text: '#fbbf24', bg: 'rgba(217,119,6,0.12)' },
  PASSENGER: { border: '#3b82f6', text: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  TRAINING:  { border: '#8b5cf6', text: '#c084fc', bg: 'rgba(139,92,246,0.12)' },
  CUSTOM:    { border: '#00D1FF', text: '#00D1FF', bg: 'rgba(0,209,255,0.12)' },
};

const FC_COLORS: Record<string, string> = {
  VFR: 'text-green-400', MVFR: 'text-blue-400', IFR: 'text-red-400', LIFR: 'text-purple-400',
};

// ─── Arc SVG ──────────────────────────────────────────────────────────────────

function RouteArcSVG({ origin, dest }: { origin: AirportInfo; dest: AirportInfo }) {
  const w = 400; const h = 120; const pad = 40;

  // Project lat/lon to SVG coords (simple equirectangular)
  const lats = [origin.latitude, dest.latitude];
  const lons = [origin.longitude, dest.longitude];
  const minLat = Math.min(...lats) - 5; const maxLat = Math.max(...lats) + 5;
  const minLon = Math.min(...lons) - 5; const maxLon = Math.max(...lons) + 5;
  const latRange = maxLat - minLat || 1; const lonRange = maxLon - minLon || 1;

  const project = (lat: number, lon: number) => ({
    x: pad + ((lon - minLon) / lonRange) * (w - pad * 2),
    y: pad + ((maxLat - lat) / latRange) * (h - pad * 2),
  });

  const o = project(origin.latitude, origin.longitude);
  const d = project(dest.latitude, dest.longitude);
  const mx = (o.x + d.x) / 2;
  const my = Math.min(o.y, d.y) - 30;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 120 }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#00D1FF" opacity="0.8" />
        </marker>
      </defs>
      {/* Glow arc */}
      <path d={`M${o.x},${o.y} Q${mx},${my} ${d.x},${d.y}`}
        fill="none" stroke="#00D1FF" strokeWidth="6" strokeOpacity="0.15" />
      {/* Main arc */}
      <path d={`M${o.x},${o.y} Q${mx},${my} ${d.x},${d.y}`}
        fill="none" stroke="#00D1FF" strokeWidth="1.5" strokeOpacity="0.8"
        strokeDasharray="6 4" markerEnd="url(#arrow)" filter="url(#glow)" />
      {/* Origin dot */}
      <circle cx={o.x} cy={o.y} r="5" fill="#00D1FF" opacity="0.9" filter="url(#glow)" />
      <circle cx={o.x} cy={o.y} r="9" fill="none" stroke="#00D1FF" strokeWidth="1" opacity="0.3" />
      {/* Dest dot */}
      <circle cx={d.x} cy={d.y} r="5" fill="#ffffff" opacity="0.9" filter="url(#glow)" />
      <circle cx={d.x} cy={d.y} r="9" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.3" />
      {/* Labels */}
      <text x={o.x} y={o.y + 20} textAnchor="middle" fill="#00D1FF" fontSize="11" fontFamily="monospace" fontWeight="bold">{origin.icao}</text>
      <text x={d.x} y={d.y + 20} textAnchor="middle" fill="#ffffff" fontSize="11" fontFamily="monospace" fontWeight="bold">{dest.icao}</text>
    </svg>
  );
}

// ─── ATIS/METAR panel ─────────────────────────────────────────────────────────

function AtisPanel({ icao, label }: { icao: string; label: string }) {
  const [metar, setMetar] = useState<Metar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi.get(`/weather/${icao}`)
      .then(r => setMetar(r.data))
      .catch(() => setMetar(null))
      .finally(() => setLoading(false));
  }, [icao]);

  const fcColor = metar?.flight_category ? FC_COLORS[metar.flight_category] ?? 'text-gray-400' : 'text-gray-500';

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-aero text-sm">📡</span>
        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{label} — {icao}</span>
        {metar?.flight_category && (
          <span className={cn('text-xs font-bold ml-auto', fcColor)}>{metar.flight_category}</span>
        )}
      </div>
      {loading ? (
        <div className="h-16 bg-white/5 rounded-lg animate-pulse" />
      ) : metar ? (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3">
            {metar.wind_dir !== null && (
              <span className="text-gray-300">
                💨 {String(metar.wind_dir).padStart(3, '0')}°/{metar.wind_speed}kt
                {metar.wind_gust ? `G${metar.wind_gust}kt` : ''}
              </span>
            )}
            {metar.visibility_sm !== null && (
              <span className={metar.visibility_sm < 3 ? 'text-amber-400' : 'text-gray-300'}>
                👁 {metar.visibility_sm}SM
              </span>
            )}
            {metar.temp_c !== null && (
              <span className="text-gray-300">🌡 {metar.temp_c}°C / {metar.dewpoint_c}°C</span>
            )}
            {metar.altimeter_hg !== null && (
              <span className="text-gray-300">⏱ {metar.altimeter_hg.toFixed(2)}&quot;</span>
            )}
            {metar.icing_risk && <span className="text-blue-400">🧊 Icing</span>}
          </div>
          <div className="text-[10px] font-mono text-gray-500 bg-black/20 rounded-lg px-3 py-2 leading-relaxed break-all">
            {metar.raw}
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-600">No METAR available for {icao}</p>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  mission: Mission;
  onClose: () => void;
  onAccept: (id: string) => void;
  accepting?: boolean;
}

export default function MissionBriefingModal({ mission, onClose, onAccept, accepting }: Props) {
  const [originInfo, setOriginInfo] = useState<AirportInfo | null>(null);
  const [destInfo, setDestInfo] = useState<AirportInfo | null>(null);
  const [simbriefUrl, setSimbriefUrl] = useState<string | null>(null);

  const mc = MISSION_COLORS[mission.mission_type] ?? MISSION_COLORS.CUSTOM;

  useEffect(() => {
    // Fetch airport details for map + names
    Promise.all([
      publicApi.get(`/network/airports/search?q=${mission.origin_icao}`),
      publicApi.get(`/network/airports/search?q=${mission.destination_icao}`),
    ]).then(([o, d]) => {
      const orig = o.data.find((a: AirportInfo) => a.icao === mission.origin_icao) ?? o.data[0];
      const dest = d.data.find((a: AirportInfo) => a.icao === mission.destination_icao) ?? d.data[0];
      setOriginInfo(orig ?? null);
      setDestInfo(dest ?? null);
    }).catch(() => {});

    // Build SimBrief URL
    api.post('/integrations/simbrief/dispatch-url', {
      origin: mission.origin_icao,
      destination: mission.destination_icao,
      airline_icao: mission.airline.icao_code,
      ...(mission.cargo_kg ? { cargo_kg: mission.cargo_kg } : {}),
    }).then(r => setSimbriefUrl(r.data.url)).catch(() => {});
  }, [mission]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl"
        style={{ background: '#0d1117', border: `1px solid ${mc.border}40` }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: `${mc.border}30` }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">
              {mission.mission_type === 'CARGO' ? '📦'
                : mission.mission_type === 'PASSENGER' ? '✈️'
                : mission.mission_type === 'TRAINING' ? '🎓' : '⭐'}
            </span>
            <span className="font-bold text-white tracking-wide">MISSION BRIEFING</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition text-xl leading-none">✕</button>
        </div>

        {/* ── Mission type banner ── */}
        <div className="mx-6 mt-5 rounded-xl flex items-center justify-center gap-3 py-3 font-bold tracking-widest text-sm"
          style={{ background: mc.bg, border: `1px solid ${mc.border}40`, color: mc.text }}>
          <span>✈</span>
          <span>{MISSION_LABELS[mission.mission_type] ?? mission.mission_type} — {mission.airline.name}</span>
          <span>✈</span>
        </div>

        {/* ── Departure / Arrival / Distance ── */}
        <div className="mx-6 mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Departure', value: mission.origin_icao, sub: originInfo?.city ?? originInfo?.name ?? '' },
            { label: 'Arrival', value: mission.destination_icao, sub: destInfo?.city ?? destInfo?.name ?? '' },
            { label: 'Distance', value: `${mission.distance_nm.toLocaleString()} nm`, sub: '' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-4 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="font-mono font-bold text-white text-lg">{item.value}</p>
              {item.sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Mission info + Route ── */}
        <div className="mx-6 mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Mission Information</p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-bold px-2 py-0.5 rounded text-xs" style={{ background: mc.bg, color: mc.text }}>
                  {MISSION_LABELS[mission.mission_type]}
                </span>
              </div>
              {mission.cargo_kg && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Cargo</span>
                  <span className="text-white font-mono">{(mission.cargo_kg / 1000).toFixed(1)}t</span>
                </div>
              )}
              {mission.mission_type !== 'TRAINING' && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Pilot Pay</span>
                  <span className="text-green-400 font-bold">${Number(mission.pilot_pay).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">XP Bonus</span>
                <span className="text-aero font-bold">+{mission.xp_bonus} XP</span>
              </div>
              {mission.min_block_time_min && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Min Time</span>
                  <span className="text-white">{mission.min_block_time_min} min</span>
                </div>
              )}
              {mission.mission_type === 'TRAINING' && (
                <>
                  {mission.training_min_happiness && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pass: Happiness</span>
                      <span className="text-purple-400">≥ {mission.training_min_happiness}%</span>
                    </div>
                  )}
                  {mission.training_max_vs_fpm && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pass: Landing VS</span>
                      <span className="text-purple-400">≥ {mission.training_max_vs_fpm} fpm</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Route</p>
            {originInfo && destInfo ? (
              <RouteArcSVG origin={originInfo} dest={destInfo} />
            ) : (
              <div className="flex items-center justify-center gap-3 py-6">
                <span className="font-mono font-bold text-aero text-lg">{mission.origin_icao}</span>
                <span className="text-gray-500 text-xl">→</span>
                <span className="font-mono font-bold text-white text-lg">{mission.destination_icao}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Mission Details ── */}
        {(mission.skyops_brief || mission.notes) && (
          <div className="mx-6 mt-4 rounded-xl p-5"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${mc.border}30` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: mc.text }}>
              📋 Mission Details
            </p>
            {mission.notes && <p className="text-sm text-gray-200 mb-3 font-medium">{mission.notes}</p>}
            {mission.skyops_brief && (
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{mission.skyops_brief}</p>
            )}
          </div>
        )}

        {/* ── ATIS / METAR ── */}
        <div className="mx-6 mt-4 grid grid-cols-2 gap-3">
          <AtisPanel icao={mission.origin_icao} label="Departure ATIS" />
          <AtisPanel icao={mission.destination_icao} label="Arrival ATIS" />
        </div>

        {/* ── Action buttons ── */}
        <div className="mx-6 my-5 flex items-center justify-between gap-3">
          <button onClick={onClose}
            className="text-xs text-gray-500 hover:text-white border border-white/10 px-4 py-2 rounded-xl transition">
            ✕ Close Briefing
          </button>
          <div className="flex gap-2">
            {simbriefUrl && (
              <a href={simbriefUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-aero/30 text-aero hover:bg-aero/10 transition">
                🗺️ SimBrief
              </a>
            )}
            <button onClick={() => onAccept(mission.id)} disabled={accepting}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl transition disabled:opacity-50"
              style={{ background: mc.text, color: '#000' }}>
              {accepting ? 'Accepting…' : '+ Accept Mission'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
