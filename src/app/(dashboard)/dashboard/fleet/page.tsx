'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

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
  cabin_configs: { cabin_class: string; seat_count: number; price_multiplier: number }[];
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
                  <div className="flex gap-3 flex-wrap">
                    {hull.cabin_configs.length > 0 ? (
                      hull.cabin_configs.map((c) => (
                        <span key={c.cabin_class} className="text-xs text-gray-400 glass-card px-2 py-1 rounded-lg">
                          {c.cabin_class.replace('_', ' ')}: {c.seat_count} seats
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-600">
                        {totalSeats === 0 ? 'No cabin config' : `${totalSeats} seats`}
                      </span>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
