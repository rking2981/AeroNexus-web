'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  event_type: string;
  check_type: string | null;
  description: string;
  cost: string | null;
  wear_score: string | null;
  created_at: string;
  hull: { registration: string; aircraft_type: string };
}

interface HullOption {
  id: string;
  registration: string;
  aircraft_type: string;
}

const EVENT_STYLES: Record<string, { color: string; icon: string }> = {
  SCHEDULED:       { color: 'text-amber-400',  icon: '🔧' },
  CHECK_PERFORMED: { color: 'text-aero',        icon: '✅' },
  RETURNED:        { color: 'text-green-400',   icon: '✈️' },
  DAMAGE_DETECTED: { color: 'text-red-400',     icon: '⚠️' },
  DAMAGE_REPAIRED: { color: 'text-blue-400',    icon: '🛠️' },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function WearBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-red-400 border-red-500/20 bg-red-500/5'
    : score >= 40 ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
    : 'text-green-400 border-green-500/20 bg-green-500/5';
  return (
    <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border', color)}>
      {score.toFixed(0)}%
    </span>
  );
}

export default function MaintenanceLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hulls, setHulls] = useState<HullOption[]>([]);
  const [selectedHull, setSelectedHull] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = selectedHull ? `?hull_id=${selectedHull}` : '';
    const { data } = await api.get(`/fleet/maintenance/logs${params}`);
    setLogs(data);
    setLoading(false);
  }, [selectedHull]);

  useEffect(() => {
    api.get('/fleet').then(r => setHulls(r.data.map((h: HullOption) => ({ id: h.id, registration: h.registration, aircraft_type: h.aircraft_type }))));
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Maintenance Log</h1>
          <p className="text-gray-400 text-sm">Full history of all maintenance events across your fleet.</p>
        </div>
        {/* Aircraft filter */}
        <select
          value={selectedHull}
          onChange={e => setSelectedHull(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#111] px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition"
        >
          <option value="">All Aircraft</option>
          {hulls.map(h => (
            <option key={h.id} value={h.id}>{h.registration} — {h.aircraft_type}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4,5].map(i => <div key={i} className="glass-card rounded-2xl h-14 animate-pulse" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🔧</p>
          <p className="text-gray-400 text-sm">No maintenance events recorded yet.</p>
          <p className="text-gray-600 text-xs mt-1">Events appear here when aircraft are scheduled, checked, or returned to service.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          {logs.map((log, i) => {
            const style = EVENT_STYLES[log.event_type] ?? { color: 'text-gray-400', icon: '📋' };
            return (
              <div key={log.id}
                className={cn('flex items-start gap-4 px-5 py-4 border-b border-white/5 last:border-0',
                  i === 0 && 'bg-white/2')}>
                {/* Icon */}
                <span className="text-lg flex-shrink-0 mt-0.5">{style.icon}</span>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', style.color)}>
                    {log.description}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">{formatDateTime(log.created_at)}</span>
                    {!selectedHull && (
                      <span className="text-xs font-mono text-gray-600">{log.hull.registration}</span>
                    )}
                    {log.check_type && (
                      <span className="text-[10px] text-gray-600 border border-white/10 px-1.5 py-0.5 rounded">
                        {log.check_type}-Check
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: cost + wear */}
                <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                  {log.cost && Number(log.cost) > 0 && (
                    <span className="text-xs font-mono text-red-400">
                      -${Number(log.cost).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                    </span>
                  )}
                  {log.wear_score !== null && (
                    <WearBadge score={Number(log.wear_score)} />
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
