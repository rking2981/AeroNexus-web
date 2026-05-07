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
  status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED' | 'FOR_SALE';
  airframe_hours: number;
  engine_wear_percent: number;
  rotor_wear_percent: number;
  aircraft_type_rel: { pax_capacity: number | null } | null;
  wear_score: number;
  maintenance_grade: string;
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
  const maxCapacity = hull.aircraft_type_rel?.pax_capacity ?? null;
  const overCapacity = maxCapacity !== null && totalSeats > maxCapacity;

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">Cabin Configuration</h4>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-mono', overCapacity ? 'text-red-400 font-bold' : 'text-gray-500')}>
            {totalSeats}{maxCapacity ? ` / ${maxCapacity}` : ''} seats
          </span>
          {overCapacity && <span className="text-[10px] text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">Over max</span>}
        </div>
      </div>

      {/* Live diagram */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-500">Cabin layout</p>
          <p className="text-xs text-gray-600 font-mono">
            {getLayout(hull.aircraft_type, hull.aircraft_category).label} · {hull.aircraft_type}
            {maxCapacity ? ` · max ${maxCapacity} pax` : ''}
          </p>
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
                type="number" min={0} max={maxCapacity ?? 999}
                value={row.seats}
                disabled={!row.enabled}
                onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, seats: parseInt(e.target.value) || 0 } : r))}
                className={cn('w-full rounded-lg border bg-white/5 px-2 py-1 text-sm text-white text-center focus:outline-none disabled:opacity-30 transition',
                  overCapacity ? 'border-red-500/40 focus:border-red-400' : 'border-white/10 focus:border-aero')}
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
          onClick={save} disabled={saving || overCapacity}
          className="bg-aero text-black font-bold px-4 py-2 rounded-xl text-xs hover:brightness-110 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Cabin Config'}
        </button>
        {overCapacity
          ? <p className="text-xs text-red-400">Total seats ({totalSeats}) exceeds aircraft max ({maxCapacity}).</p>
          : <p className="text-xs text-gray-600">Price multiplier applies to base ticket price per class.</p>
        }
      </div>
    </div>
  );
}

// ─── Maintenance Panel ────────────────────────────────────────────────────────

interface CheckStatus {
  type: string;
  label: string;
  due_hours: number;
  due_cycles?: number;
  cost: number;
  overdue: boolean;
}

interface ComponentDamage {
  component: string;
  severity: string;
  note: string;
}

interface MaintenanceStatus {
  hull: { registration: string; aircraft_type: string; maintenance_grade: string };
  checks: CheckStatus[];
  maintenance_ends_at: string | null;
  last_check_performed: string | null;
  downtime_remaining_hours: number;
  component_damage: ComponentDamage[];
}

function MaintenancePanel({ hull, onDone }: { hull: Hull; onDone: () => void }) {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [performing, setPerforming] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/fleet/${hull.id}/maintenance`)
      .then(r => setStatus(r.data))
      .catch(() => setError('Failed to load maintenance status'))
      .finally(() => setLoading(false));
  }, [hull.id]);

  async function performCheck(checkType: string, cost: number) {
    if (!confirm(`Perform ${checkType} on ${hull.registration}?\nCost: $${cost.toLocaleString()}\n\nThis will deduct the cost from your airline balance.`)) return;
    setPerforming(checkType); setError('');
    try {
      await api.post(`/fleet/${hull.id}/maintenance/perform`, { check_type: checkType });
      const r = await api.get(`/fleet/${hull.id}/maintenance`);
      setStatus(r.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to perform check.');
    } finally { setPerforming(null); }
  }

  async function completeAndReturn() {
    setCompleting(true); setError('');
    try {
      await api.patch(`/fleet/${hull.id}/maintenance/complete`);
      onDone();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to complete maintenance.');
    } finally { setCompleting(false); }
  }

  const gradeColor = (g: string) => ({ A: 'text-green-400', B: 'text-green-400', C: 'text-amber-400', D: 'text-amber-400', E: 'text-red-400', F: 'text-red-400' }[g] ?? 'text-gray-400');

  if (loading) return <div className="mt-4 border-t border-white/5 pt-4 h-24 animate-pulse rounded-xl bg-white/5" />;

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">Maintenance Status</h4>
        {status && (
          <span className={cn('text-xs font-bold', gradeColor(status.hull.maintenance_grade))}>
            Grade {status.hull.maintenance_grade}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {/* Downtime countdown */}
      {status?.downtime_remaining_hours && status.downtime_remaining_hours > 0 ? (
        <div className="glass-card rounded-xl p-3 mb-3 border border-amber-500/20 bg-amber-500/5">
          <p className="text-xs text-amber-400 font-bold mb-0.5">Maintenance In Progress</p>
          <p className="text-xs text-gray-400">
            {status.last_check_performed && `${status.last_check_performed}-Check underway · `}
            Returns to service in{' '}
            <span className="text-white font-mono font-bold">
              {status.downtime_remaining_hours >= 24
                ? `${Math.floor(status.downtime_remaining_hours / 24)}d ${status.downtime_remaining_hours % 24}h`
                : `${status.downtime_remaining_hours}h`}
            </span>
          </p>
          {status.maintenance_ends_at && (
            <p className="text-[10px] text-gray-600 mt-0.5">
              Est. completion: {new Date(status.maintenance_ends_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      ) : status?.maintenance_ends_at === null && hull.status === 'MAINTENANCE' ? (
        <div className="glass-card rounded-xl p-3 mb-3 border border-green-500/20 bg-green-500/5">
          <p className="text-xs text-green-400 font-bold">Maintenance complete — ready to return to service</p>
        </div>
      ) : null}

      {/* Component damage */}
      {status?.component_damage && status.component_damage.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Component Damage</p>
          {status.component_damage.map((dmg) => (
            <div key={dmg.component} className={cn('rounded-xl px-3 py-2.5 border text-xs',
              dmg.severity === 'CRITICAL' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/5')}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-white">{dmg.component}</span>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                  dmg.severity === 'CRITICAL' ? 'text-red-400 border-red-500/30' : 'text-amber-400 border-amber-500/30')}>
                  {dmg.severity}
                </span>
              </div>
              <p className="text-gray-400">{dmg.note}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {status?.checks.map(check => (
          <div key={check.type} className={cn(
            'flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs',
            check.overdue ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 bg-white/3',
          )}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('font-medium', check.overdue ? 'text-red-400' : 'text-white')}>{check.label}</span>
                {check.overdue && <span className="text-[10px] font-bold text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">OVERDUE</span>}
              </div>
              {!check.overdue && (
                <p className="text-gray-500 mt-0.5">
                  {check.due_hours.toFixed(0)} hrs remaining
                  {check.due_cycles !== undefined ? ` · ${check.due_cycles.toFixed(0)} cycles` : ''}
                </p>
              )}
            </div>
            {hull.status === 'MAINTENANCE' && (
              <button
                onClick={() => performCheck(check.type, check.cost)}
                disabled={!!performing}
                className={cn(
                  'flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border transition ml-3 disabled:opacity-50',
                  check.overdue
                    ? 'border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20'
                    : 'border-white/15 text-gray-300 hover:bg-white/5',
                )}
              >
                {performing === check.type ? '…' : `Perform · $${(check.cost / 1000).toFixed(0)}k`}
              </button>
            )}
          </div>
        ))}
      </div>

      {hull.status === 'MAINTENANCE' && (
        <button
          onClick={completeAndReturn}
          disabled={completing || (status?.downtime_remaining_hours ?? 0) > 0}
          className={cn(
            'w-full font-bold px-4 py-2.5 rounded-xl text-xs transition disabled:opacity-50',
            (status?.downtime_remaining_hours ?? 0) > 0
              ? 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
              : 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30',
          )}
        >
          {completing ? 'Completing…'
            : (status?.downtime_remaining_hours ?? 0) > 0
            ? `Maintenance in progress — ${status!.downtime_remaining_hours}h remaining`
            : 'Return Aircraft to Service'}
        </button>
      )}

      {hull.status !== 'MAINTENANCE' && (
        <p className="text-xs text-gray-600 text-center">Schedule maintenance to perform checks.</p>
      )}
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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/20',
  MAINTENANCE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  RETIRED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  FOR_SALE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const CATEGORY_ICON: Record<string, string> = {
  FIXED_WING: '✈️', COMMERCIAL: '✈️', CARGO: '📦', PRIVATE: '🛩️',
  HELICOPTER: '🚁', SEAPLANE: '🛥️', BALLOON: '🎈', SPECIAL_USE: '⭐',
};

function formatPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function SellPanel({ hull, onListed, onClose }: {
  hull: Hull;
  onListed: () => void;
  onClose: () => void;
}) {
  const [fairValue, setFairValue] = useState<number | null>(null);
  const [askingPrice, setAskingPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/market/fair-value/${hull.id}`).then(({ data }) => {
      setFairValue(data.fair_value);
      setAskingPrice(String(data.fair_value));
    }).catch(() => setFairValue(null)).finally(() => setLoading(false));
  }, [hull.id]);

  async function handleList() {
    const price = parseFloat(askingPrice);
    if (!price || price <= 0) { setError('Enter a valid asking price'); return; }
    setSubmitting(true); setError('');
    try {
      await api.post(`/market/sell/${hull.id}`, { asking_price: price, notes: notes || undefined });
      onListed();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to list aircraft');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-sm">List for Sale</h4>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm transition">✕</button>
      </div>

      {loading ? (
        <div className="h-8 bg-white/5 rounded-xl animate-pulse" />
      ) : (
        <div className="flex flex-col gap-3">
          {fairValue !== null && (
            <div className="glass-card rounded-xl p-3 flex justify-between text-sm">
              <span className="text-gray-400">Estimated Fair Value</span>
              <span className="font-bold text-aero">{formatPrice(fairValue)}</span>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Asking Price ($)</label>
              <input
                type="number"
                value={askingPrice}
                onChange={e => setAskingPrice(e.target.value)}
                placeholder="e.g. 45000000"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-aero focus:outline-none transition"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Well maintained, low hours"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-aero focus:outline-none transition"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
          <button onClick={handleList} disabled={submitting}
            className="bg-aero text-black font-bold py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
            {submitting ? 'Listing…' : 'List on Used Market'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function FleetPage() {
  const { user } = useAuthStore();
  const [hulls, setHulls] = useState<Hull[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCabin, setExpandedCabin] = useState<string | null>(null);
  const [expandedMaintenance, setExpandedMaintenance] = useState<string | null>(null);
  const [expandedSell, setExpandedSell] = useState<string | null>(null);
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg font-mono">{hull.registration}</h3>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[hull.status])}>
                          {hull.status}
                        </span>
                        {/* Wear score */}
                        {hull.wear_score !== undefined && (
                          <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
                            Number(hull.wear_score) >= 70 ? 'text-red-400 border-red-500/20 bg-red-500/5'
                            : Number(hull.wear_score) >= 40 ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                            : 'text-green-400 border-green-500/20 bg-green-500/5')}>
                            Grade {hull.maintenance_grade} · {Number(hull.wear_score).toFixed(0)}%
                          </span>
                        )}
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
                      <button
                        onClick={() => {
                          setExpandedMaintenance(expandedMaintenance === hull.id ? null : hull.id);
                          setExpandedCabin(null);
                        }}
                        className={cn('text-xs border px-2 py-1 rounded-lg transition',
                          hull.status === 'MAINTENANCE'
                            ? 'text-amber-400 border-amber-500/20 hover:bg-amber-500/10'
                            : 'text-gray-400 border-white/10 hover:bg-white/5')}
                      >
                        {expandedMaintenance === hull.id ? 'Close' : hull.status === 'MAINTENANCE' ? 'Perform Checks' : 'Maintenance'}
                      </button>
                      {hull.status === 'ACTIVE' && isManager && (
                        <button
                          onClick={() => api.patch(`/fleet/${hull.id}/maintenance/schedule`).then(() => {
                            setHulls(hulls.map(h => h.id === hull.id ? { ...h, status: 'MAINTENANCE' } : h));
                            setExpandedMaintenance(hull.id);
                          })}
                          className="text-xs text-amber-400 hover:text-amber-300 transition px-2 py-1 border border-amber-500/20 rounded-lg"
                        >
                          Schedule
                        </button>
                      )}
                      {hull.status === 'ACTIVE' && !hull.is_leased && isManager && (
                        <button
                          onClick={() => {
                            setExpandedSell(expandedSell === hull.id ? null : hull.id);
                            setExpandedCabin(null);
                            setExpandedMaintenance(null);
                          }}
                          className={cn('text-xs border px-2 py-1 rounded-lg transition',
                            expandedSell === hull.id
                              ? 'text-green-400 border-green-500/30 bg-green-500/10'
                              : 'text-gray-400 border-white/10 hover:text-green-400 hover:border-green-500/20')}
                        >
                          {expandedSell === hull.id ? 'Cancel' : 'Sell'}
                        </button>
                      )}
                      {hull.status === 'FOR_SALE' && (
                        <span className="text-xs text-green-400 border border-green-500/20 bg-green-500/5 px-2 py-1 rounded-lg">
                          Listed for Sale
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline maintenance panel */}
                {expandedMaintenance === hull.id && (
                  <MaintenancePanel
                    hull={hull}
                    onDone={() => {
                      setHulls(hulls.map(h => h.id === hull.id ? { ...h, status: 'ACTIVE' } : h));
                      setExpandedMaintenance(null);
                    }}
                  />
                )}

                {/* Inline sell panel */}
                {expandedSell === hull.id && (
                  <SellPanel
                    hull={hull}
                    onListed={() => {
                      setHulls(hulls.map(h => h.id === hull.id ? { ...h, status: 'FOR_SALE' as never } : h));
                      setExpandedSell(null);
                    }}
                    onClose={() => setExpandedSell(null)}
                  />
                )}

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
