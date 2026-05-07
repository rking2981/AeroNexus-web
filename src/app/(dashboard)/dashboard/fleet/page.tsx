'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface CabinConfig { cabin_class: string; seat_count: number; price_multiplier: number }

interface Hull {
  id: string;
  registration: string;
  aircraft_type: string;
  aircraft_category: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
  airframe_hours: number;
  engine_wear_percent: number;
  rotor_wear_percent: number;
  is_leased: boolean;
  value: number;
  cabin_configs: CabinConfig[];
}

type CabinClass = 'FIRST' | 'BUSINESS' | 'PREMIUM_ECONOMY' | 'ECONOMY';

// ─── Aircraft cabin layout detection ────────────────────────────────────────

interface CabinLayout {
  cols: number[];      // seat positions left of aisle (0-based) + gap + right
  aisle: number;       // px gap for aisle
  label: string;       // e.g. "3+3", "2+2"
}

function getLayout(aircraftType: string, category: string): CabinLayout {
  const t = aircraftType.toLowerCase();

  // Helicopter — single or double row
  if (category === 'HELICOPTER') return { cols: [0, 2], aisle: 6, label: '1+1' };

  // Seaplane
  if (category === 'SEAPLANE') return { cols: [0, 2], aisle: 6, label: '1+1' };

  // Very large — A380, L-1011, DC-10, B747
  if (t.includes('a380') || t.includes('l-1011') || t.includes('dc-10') || t.includes('747'))
    return { cols: [0, 1, 2, 4, 5, 6, 8, 9, 10], aisle: 8, label: '3+3+3' };

  // Wide-body — B777, B787, A330, A350, B767-400, B757-300
  if (t.includes('777') || t.includes('787') || t.includes('a330') || t.includes('a350') ||
      t.includes('767-4') || t.includes('757-3'))
    return { cols: [0, 1, 2, 4, 5, 6, 7, 9, 10, 11], aisle: 8, label: '3+4+3' };

  // Medium wide — B767, B757
  if (t.includes('767') || t.includes('757'))
    return { cols: [0, 1, 4, 5, 6], aisle: 8, label: '2+3' };

  // Narrow-body — A320 family, B737, A220, MD-80/90, B717, Concorde
  if (t.includes('a320') || t.includes('a321') || t.includes('a319') || t.includes('a318') ||
      t.includes('737') || t.includes('a220') || t.includes('md-8') || t.includes('md-9') ||
      t.includes('b717') || t.includes('concorde') || t.includes('b717'))
    return { cols: [0, 1, 2, 4, 5, 6], aisle: 8, label: '3+3' };

  // Regional jets — CRJ, E-jet, Dash 8 Q400, Saab 2000, BAe 146
  if (t.includes('crj') || t.includes('embraer e1') || t.includes('embraer e2') ||
      t.includes('dash 8') || t.includes('saab 2000') || t.includes('atr'))
    return { cols: [0, 1, 3, 4], aisle: 8, label: '2+2' };

  // Small regional — E170, E175, Saab 340, JS41, DC-3, Dash 8-100/300
  if (t.includes('e170') || t.includes('e175') || t.includes('saab 340') ||
      t.includes('jetstream') || t.includes('dc-3') || t.includes('1900'))
    return { cols: [0, 1, 3, 4], aisle: 8, label: '2+2' };

  // Bizjet / turboprop — everything else over 8 pax
  if (t.includes('global') || t.includes('gulfstream') || t.includes('falcon') ||
      t.includes('challenger') || t.includes('citation sovereign') || t.includes('citation x') ||
      t.includes('citation longitude') || t.includes('phenom 300') || t.includes('pc-24') ||
      t.includes('avanti') || t.includes('king air 200') || t.includes('king air 350'))
    return { cols: [0, 2], aisle: 10, label: '1+1' };

  // Small bizjet / GA
  return { cols: [0, 2], aisle: 10, label: '1+1' };
}

const CABIN_CLASSES: { key: CabinClass; label: string; defaultMultiplier: number; color: string }[] = [
  { key: 'FIRST',           label: 'First Class',       defaultMultiplier: 4.0, color: '#a855f7' },
  { key: 'BUSINESS',        label: 'Business',          defaultMultiplier: 2.5, color: '#00D1FF' },
  { key: 'PREMIUM_ECONOMY', label: 'Premium Economy',   defaultMultiplier: 1.5, color: '#3b82f6' },
  { key: 'ECONOMY',         label: 'Economy',           defaultMultiplier: 1.0, color: '#6b7280' },
];

// ─── Cabin diagram ────────────────────────────────────────────────────────────

function CabinDiagram({ rows, aircraftType, category }: {
  rows: { key: CabinClass; enabled: boolean; seats: number }[];
  aircraftType: string;
  category: string;
}) {
  const activeRows = rows.filter((r) => r.enabled && r.seats > 0);
  const totalSeats = activeRows.reduce((s, r) => s + r.seats, 0);
  const layout = getLayout(aircraftType, category);

  if (totalSeats === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-black/30 flex items-center justify-center h-32 text-gray-600 text-xs">
        Configure seats to see diagram
      </div>
    );
  }

  // ── Horizontal layout (nose left → tail right) ──────────────────────────
  // X axis = seat rows (front to back), Y axis = seat positions (cross-section)
  const COL_POSITIONS = layout.cols;
  const SEATS_PER_ROW = COL_POSITIONS.length;
  const numAisles = layout.label.split('+').length - 1;

  // Seat dimensions in horizontal mode:
  // SEAT_W = depth front-to-back, SEAT_H = width left-right
  const SEAT_D = 10;   // depth (x-axis)
  const SEAT_W = 11;   // width (y-axis)
  const SEAT_GAP_X = 2;
  const SEAT_GAP_Y = 2;
  const AISLE_Y = layout.aisle;  // aisle gap in y-axis
  const PAD_X = 40;   // nose room left
  const PAD_Y = 12;   // top/bottom padding

  // Build list of seat rows per section
  const sections: { key: CabinClass; color: string; seatRows: number }[] = activeRows.map((r) => ({
    key: r.key,
    color: CABIN_CLASSES.find((c) => c.key === r.key)?.color ?? '#6b7280',
    seatRows: Math.ceil(r.seats / SEATS_PER_ROW),
  }));

  // Total seat rows = x-axis length
  const totalSeatRows = sections.reduce((s, sec) => s + sec.seatRows, 0);
  const ROW_STEP = SEAT_D + SEAT_GAP_X;

  // Pre-compute Y positions for each cross-section position (COL_POSITIONS)
  // Find aisle gaps
  const sortedCols = [...COL_POSITIONS].sort((a, b) => a - b);
  const gapsArr = sortedCols.slice(1).map((c, i) => ({ gap: c - sortedCols[i], after: sortedCols[i] }));
  gapsArr.sort((a, b) => b.gap - a.gap);
  const aisleAfterSet = new Set(gapsArr.slice(0, numAisles).map(g => g.after));

  function seatY(col: number): number {
    let y = PAD_Y + col * (SEAT_W + SEAT_GAP_Y);
    let aisleCount = 0;
    for (const c of sortedCols) {
      if (c >= col) break;
      if (aisleAfterSet.has(c)) aisleCount++;
    }
    return y + aisleCount * AISLE_Y;
  }

  const maxColPos = Math.max(...COL_POSITIONS);
  const svgH = PAD_Y * 2 + (maxColPos + 1) * (SEAT_W + SEAT_GAP_Y) + numAisles * AISLE_Y;
  const contentW = totalSeatRows * ROW_STEP + (sections.length - 1) * 4;
  const svgW = PAD_X + contentW + 20; // nose pad + content + tail pad

  // Build SVG elements
  const elements: React.ReactNode[] = [];
  let x = PAD_X;

  sections.forEach((sec, si) => {
    // Section colour stripe at top
    elements.push(
      <rect key={`stripe-${si}`} x={x} y={2} width={sec.seatRows * ROW_STEP - SEAT_GAP_X} height={5}
        rx={2} fill={sec.color} opacity={0.6} />
    );

    for (let r = 0; r < sec.seatRows; r++) {
      COL_POSITIONS.forEach((col, ci) => {
        const seatNum = r * SEATS_PER_ROW + ci;
        const seatExists = seatNum < (activeRows.find(a => a.key === sec.key)?.seats ?? 0);
        const sy = seatY(col);
        elements.push(
          <rect key={`seat-${si}-${r}-${ci}`}
            x={x + r * ROW_STEP} y={sy}
            width={SEAT_D} height={SEAT_W}
            rx={2}
            fill={seatExists ? sec.color : 'rgba(255,255,255,0.04)'}
            opacity={seatExists ? 0.85 : 1}
          />
        );
      });
    }

    x += sec.seatRows * ROW_STEP;

    // Section divider (vertical dashed line)
    if (si < sections.length - 1) {
      elements.push(
        <line key={`div-${si}`}
          x1={x + 2} y1={PAD_Y - 2} x2={x + 2} y2={svgH - PAD_Y + 2}
          stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3,2"
        />
      );
      x += 4;
    }
  });

  // Aisle lines (horizontal, running front to back)
  sortedCols.forEach((col) => {
    if (aisleAfterSet.has(col)) {
      const aisleY = seatY(col) + SEAT_W + SEAT_GAP_Y / 2 + AISLE_Y / 2 - 0.5;
      elements.push(
        <line key={`aisle-${col}`}
          x1={PAD_X} y1={aisleY} x2={PAD_X + contentW} y2={aisleY}
          stroke="rgba(255,255,255,0.05)" strokeWidth={AISLE_Y - 2}
        />
      );
    }
  });

  return (
    <div className="rounded-xl border border-white/5 bg-black/40 overflow-hidden">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: 140 }}>
        {/* Fuselage body */}
        <rect x={PAD_X - 4} y={2} width={contentW + 8} height={svgH - 4}
          rx={svgH / 2} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        {/* Nose cone (left) */}
        <ellipse cx={PAD_X - 4} cy={svgH / 2} rx={PAD_X - 6} ry={svgH / 2 - 2}
          fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        {/* Tail (right) */}
        <ellipse cx={PAD_X + contentW + 4} cy={svgH / 2} rx={14} ry={svgH / 2 - 2}
          fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

        {elements}
      </svg>

      {/* Legend */}
      <div className="flex gap-3 px-3 pb-2 pt-1 flex-wrap">
        {activeRows.map((r) => {
          const cls = CABIN_CLASSES.find(c => c.key === r.key)!;
          return (
            <div key={r.key} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cls.color }} />
              <span className="text-[10px] text-gray-400">{cls.label} ({r.seats})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CabinEditor({ hull, onSaved }: { hull: Hull; onSaved: (configs: CabinConfig[]) => void }) {
  const [rows, setRows] = useState<{ key: CabinClass; enabled: boolean; seats: number; multiplier: number }[]>(
    CABIN_CLASSES.map((cls) => {
      const existing = hull.cabin_configs.find((c) => c.cabin_class === cls.key);
      return {
        key: cls.key,
        enabled: !!existing,
        seats: existing ? Number(existing.seat_count) : 0,
        multiplier: existing ? Number(existing.price_multiplier) : cls.defaultMultiplier,
      };
    }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const configs = rows
      .filter((r) => r.enabled && r.seats > 0)
      .map((r) => ({ cabin_class: r.key, seat_count: r.seats, price_multiplier: r.multiplier }));

    setSaving(true); setError('');
    try {
      const { data } = await api.post(`/fleet/${hull.id}/cabin`, { configs });
      onSaved(data.configs ?? configs);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to save cabin config.');
    } finally { setSaving(false); }
  }

  const totalSeats = rows.filter(r => r.enabled).reduce((s, r) => s + (r.seats || 0), 0);

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">Cabin Configuration</h4>
        <span className="text-xs text-gray-500">{totalSeats} total seats</span>
      </div>

      {/* Live diagram */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-500">Cabin layout</p>
          <p className="text-xs text-gray-600 font-mono">{getLayout(hull.aircraft_type, hull.aircraft_category).label} · {hull.aircraft_type}</p>
        </div>
        <CabinDiagram rows={rows} aircraftType={hull.aircraft_type} category={hull.aircraft_category} />
      </div>

      <div className="flex flex-col gap-2 mb-3">
        {rows.map((row, i) => (
          <div key={row.key} className={cn(
            'grid items-center gap-3 px-3 py-2.5 rounded-xl border transition',
            row.enabled ? 'border-aero/20 bg-aero/5' : 'border-white/5 bg-white/2',
          )} style={{ gridTemplateColumns: '20px 140px 80px 1fr 60px' }}>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setRows(rows.map((r, j) => j === i ? { ...r, enabled: !r.enabled } : r))}
              className={cn('w-4 h-4 rounded border transition flex-shrink-0',
                row.enabled ? 'bg-aero border-aero' : 'border-white/20')}
            >
              {row.enabled && <span className="text-black text-[10px] flex items-center justify-center leading-none font-bold">✓</span>}
            </button>

            {/* Class label */}
            <span className={cn('text-sm font-medium', row.enabled ? 'text-white' : 'text-gray-500')}>
              {CABIN_CLASSES[i].label}
            </span>

            {/* Seat count */}
            <div>
              <input
                type="number" min={0} max={999}
                value={row.seats}
                disabled={!row.enabled}
                onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, seats: parseInt(e.target.value) || 0 } : r))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white text-center focus:border-aero focus:outline-none disabled:opacity-30 transition"
                placeholder="Seats"
              />
            </div>

            {/* Price multiplier slider */}
            <div className="flex items-center gap-2">
              <input
                type="range" min={1.0} max={8.0} step={0.1}
                value={row.multiplier}
                disabled={!row.enabled}
                onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, multiplier: parseFloat(e.target.value) } : r))}
                className="flex-1 accent-[#00D1FF] disabled:opacity-30"
              />
            </div>

            {/* Multiplier value */}
            <span className={cn('text-xs font-mono text-right', row.enabled ? 'text-aero' : 'text-gray-600')}>
              {row.multiplier.toFixed(1)}×
            </span>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save} disabled={saving}
          className="bg-aero text-black font-bold px-4 py-2 rounded-xl text-xs hover:brightness-110 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Cabin Config'}
        </button>
        <p className="text-xs text-gray-600">Price multiplier applies to base ticket price per class.</p>
      </div>
    </div>
  );
}

function WearBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Number(value));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-aero';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className={pct >= 90 ? 'text-red-400' : pct >= 75 ? 'text-amber-400' : 'text-gray-300'}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/20',
  MAINTENANCE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  RETIRED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const CATEGORY_ICON: Record<string, string> = {
  FIXED_WING: '✈️',
  HELICOPTER: '🚁',
  SEAPLANE: '🛥️',
  BALLOON: '🎈',
};

export default function FleetPage() {
  const { user } = useAuthStore();
  const [hulls, setHulls] = useState<Hull[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCabin, setExpandedCabin] = useState<string | null>(null);
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  useEffect(() => {
    api.get('/fleet')
      .then((r) => setHulls(r.data))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = hulls.filter((h) => h.status === 'ACTIVE').length;
  const criticalCount = hulls.filter((h) =>
    Number(h.engine_wear_percent) >= 90 || Number(h.rotor_wear_percent) >= 90
  ).length;

  if (loading) return (
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => <div key={i} className="glass-card rounded-2xl h-24 animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Fleet</h1>
          <p className="text-gray-400 text-sm">{hulls.length} aircraft · {activeCount} active</p>
        </div>
        {isManager && (
          <Link href="/dashboard/fleet/add"
            className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm">
            + Add Aircraft
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Aircraft', value: hulls.length, icon: '✈️' },
          { label: 'Active', value: activeCount, icon: '🟢' },
          { label: 'In Maintenance', value: hulls.filter(h => h.status === 'MAINTENANCE').length, icon: '🔧' },
          { label: 'Critical Wear', value: criticalCount, icon: '⚠️', alert: criticalCount > 0 },
        ].map((s) => (
          <div key={s.label} className={cn('glass-card rounded-2xl p-5', s.alert && 'border-red-500/30')}>
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className={cn('text-2xl font-bold', s.alert && 'text-red-400')}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Hull list */}
      {hulls.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">✈️</div>
          <h3 className="text-xl font-bold mb-2">No aircraft yet</h3>
          <p className="text-gray-400 text-sm mb-6">Add your first aircraft to start flying.</p>
          {isManager && (
            <Link href="/dashboard/fleet/add"
              className="inline-block bg-aero text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition text-sm">
              Add First Aircraft
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {hulls.map((hull) => {
            const totalSeats = hull.cabin_configs.reduce((s, c) => s + c.seat_count, 0);
            return (
              <div key={hull.id} className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CATEGORY_ICON[hull.aircraft_category] ?? '✈️'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg font-mono">{hull.registration}</h3>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[hull.status])}>
                          {hull.status}
                        </span>
                        {hull.is_leased && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-purple-500/20 text-purple-400 bg-purple-500/10">
                            LEASED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{hull.aircraft_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Airframe</p>
                    <p className="font-mono text-sm">{Number(hull.airframe_hours).toFixed(1)} hrs</p>
                  </div>
                </div>

                {/* Wear bars */}
                <div className={cn('grid gap-3 mb-4', hull.aircraft_category === 'HELICOPTER' ? 'grid-cols-2' : 'grid-cols-1')}>
                  <WearBar label="Engine Wear" value={Number(hull.engine_wear_percent)} />
                  {hull.aircraft_category === 'HELICOPTER' && (
                    <WearBar label="Rotor Wear" value={Number(hull.rotor_wear_percent)} />
                  )}
                </div>

                {/* Cabin config & actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex gap-2 flex-wrap items-center">
                    {hull.cabin_configs.length > 0 ? (
                      hull.cabin_configs.map((c) => (
                        <span key={c.cabin_class} className="text-xs text-gray-400 glass-card px-2 py-1 rounded-lg">
                          {c.cabin_class.replace('_', ' ')}: {c.seat_count}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-600">No cabin config set</span>
                    )}
                    {isManager && (
                      <button
                        onClick={() => setExpandedCabin(expandedCabin === hull.id ? null : hull.id)}
                        className="text-xs text-aero border border-aero/30 hover:bg-aero/10 px-2 py-1 rounded-lg transition"
                      >
                        {expandedCabin === hull.id ? 'Close' : hull.cabin_configs.length > 0 ? 'Edit Cabin' : 'Set Cabin Config'}
                      </button>
                    )}
                  </div>
                  {isManager && (
                    <div className="flex gap-2">
                      {hull.status === 'ACTIVE' && (
                        <button
                          onClick={() => api.patch(`/fleet/${hull.id}/maintenance/schedule`).then(() =>
                            setHulls(hulls.map(h => h.id === hull.id ? { ...h, status: 'MAINTENANCE' } : h))
                          )}
                          className="text-xs text-amber-400 hover:text-amber-300 transition px-2 py-1 border border-amber-500/20 rounded-lg"
                        >
                          Schedule Maintenance
                        </button>
                      )}
                      {hull.status === 'MAINTENANCE' && (
                        <button
                          onClick={() => api.patch(`/fleet/${hull.id}/maintenance/complete`).then(() =>
                            setHulls(hulls.map(h => h.id === hull.id ? { ...h, status: 'ACTIVE', engine_wear_percent: 0, rotor_wear_percent: 0 } : h))
                          )}
                          className="text-xs text-green-400 hover:text-green-300 transition px-2 py-1 border border-green-500/20 rounded-lg"
                        >
                          Complete Maintenance
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline cabin editor */}
                {expandedCabin === hull.id && (
                  <CabinEditor
                    hull={hull}
                    onSaved={(configs) => {
                      setHulls(hulls.map(h => h.id === hull.id ? { ...h, cabin_configs: configs } : h));
                      setExpandedCabin(null);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
