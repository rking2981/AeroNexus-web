'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface Report {
  id: string; public_id: string; title: string;
  category: string; severity: string; status: string;
  created_at: string; last_activity_at: string;
  reporter: { display_name: string };
  assignee: { display_name: string } | null;
  _count: { comments: number };
}

interface ActivityItem {
  id: string; action: string; from_value: string | null; to_value: string | null;
  note: string | null; created_at: string;
  actor: { display_name: string; avatar_url: string | null };
  report: { id: string; public_id: string; title: string; status: string; severity: string };
}

const SEV_COLOR: Record<string, string> = {
  INFORMATIONAL: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  LOW:           'text-blue-400 bg-blue-500/10 border-blue-500/20',
  MODERATE:      'text-amber-400 bg-amber-500/10 border-amber-500/20',
  HIGH:          'text-orange-400 bg-orange-500/10 border-orange-500/20',
  CRITICAL:      'text-red-400 bg-red-500/10 border-red-500/20',
  EMERGENCY:     'text-red-300 bg-red-500/20 border-red-400/40',
};

const STATUS_COLOR: Record<string, string> = {
  OPEN:              'text-blue-400',
  ACKNOWLEDGED:      'text-cyan-400',
  INVESTIGATING:     'text-yellow-400',
  AWAITING_REPORTER: 'text-amber-400',
  IN_PROGRESS:       'text-orange-400',
  TESTING:           'text-purple-400',
  RESOLVED:          'text-green-400',
  CLOSED:            'text-gray-500',
  REJECTED:          'text-red-400',
};

const CAT_ICON: Record<string, string> = {
  TECHNICAL:       '🔧',
  FLIGHT_INCIDENT: '✈️',
  OPERATIONAL:     '📋',
  COMMUNITY:       '👥',
};

const ACTION_LABEL: Record<string, string> = {
  created:          'filed a report',
  commented:        'commented on',
  internal_note:    'added an internal note on',
  status_changed:   'changed status on',
  severity_changed: 'changed severity on',
  assigned:         'assigned',
  auto_escalated:   'was auto-escalated',
};

export default function TrackerPage() {
  const { user } = useAuthStore();
  const [reports, setReports]   = useState<Report[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter]     = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter)   params.set('status',   statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);

    const [rRes, aRes] = await Promise.all([
      api.get(`/reports?${params}`),
      api.get('/reports/activity?limit=15'),
    ]);
    setReports(rRes.data.reports);
    setTotal(rRes.data.total);
    setActivity(aRes.data);
    setLoading(false);
  }, [statusFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Issue Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} report{total !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/tracker/new"
          className="bg-aero text-black font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110 transition">
          + File Report
        </Link>
      </div>

      <div className="flex gap-6">
        {/* Main list */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {['', 'OPEN', 'INVESTIGATING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition',
                  statusFilter === s ? 'bg-aero/20 border-aero/40 text-aero' : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5')}>
                {s || 'All'}
              </button>
            ))}
            <div className="w-px h-5 bg-white/10 self-center mx-1" />
            {['', 'TECHNICAL', 'FLIGHT_INCIDENT', 'OPERATIONAL', 'COMMUNITY'].map(c => (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition',
                  categoryFilter === c ? 'bg-aero/20 border-aero/40 text-aero' : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5')}>
                {c ? `${CAT_ICON[c]} ${c.replace('_', ' ')}` : 'All Categories'}
              </button>
            ))}
          </div>

          {/* Report list */}
          {loading ? (
            <div className="glass-card rounded-2xl h-40 animate-pulse" />
          ) : reports.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-gray-500">No reports found.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {reports.map(r => (
                <Link key={r.id} href={`/dashboard/tracker/${r.public_id}`}
                  className="glass-card rounded-xl p-4 hover:bg-white/5 transition flex items-start gap-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">{CAT_ICON[r.category] ?? '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-gray-500">{r.public_id}</span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', SEV_COLOR[r.severity])}>
                        {r.severity}
                      </span>
                      <span className={cn('text-xs font-semibold', STATUS_COLOR[r.status])}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-white truncate">{r.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{r.reporter.display_name}</span>
                      {r.assignee && <span>→ {r.assignee.display_name}</span>}
                      <span>💬 {r._count.comments}</span>
                      <span>{new Date(r.last_activity_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="w-72 flex-shrink-0">
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-3 text-gray-300">Latest Activity</h3>
            {activity.length === 0 ? (
              <p className="text-xs text-gray-500">No activity yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {activity.map(a => (
                  <div key={a.id} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-aero/20 flex items-center justify-center text-aero text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {a.actor.display_name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-300 leading-snug">
                        <span className="font-medium text-white">{a.actor.display_name}</span>
                        {' '}{ACTION_LABEL[a.action] ?? a.action}{' '}
                        <Link href={`/dashboard/tracker/${a.report.public_id}`}
                          className="text-aero hover:underline font-mono">
                          {a.report.public_id}
                        </Link>
                        {a.action === 'status_changed' && a.to_value && (
                          <span className={cn('ml-1 font-semibold', STATUS_COLOR[a.to_value])}>
                            → {a.to_value.replace('_', ' ')}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {new Date(a.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
