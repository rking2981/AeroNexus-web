'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';
import { cn } from '@/lib/utils';

interface ModLog {
  id: string;
  action: string;
  user_id: string;
  moderator_id: string;
  reason: string | null;
  duration: number | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  WARN:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  MUTE:    'text-orange-400 bg-orange-500/10 border-orange-500/20',
  KICK:    'text-red-400 bg-red-500/10 border-red-500/20',
  BAN:     'text-red-500 bg-red-500/15 border-red-500/30',
  SOFTBAN: 'text-red-400 bg-red-500/10 border-red-500/20',
  TEMPBAN: 'text-red-400 bg-red-500/10 border-red-500/20',
  UNMUTE:  'text-green-400 bg-green-500/10 border-green-500/20',
  UNBAN:   'text-green-400 bg-green-500/10 border-green-500/20',
};

const ACTIONS = ['WARN', 'MUTE', 'KICK', 'BAN', 'SOFTBAN', 'TEMPBAN', 'UNMUTE', 'UNBAN'];

export default function ModLogsPage() {
  const [logs, setLogs] = useState<ModLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (action) params.set('action', action);
      if (userId) params.set('user_id', userId);
      const { data } = await botApi.get(`/mod-logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
      setPages(data.pages);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page, action]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mod Logs <span className="text-gray-500 text-base font-normal">({total})</span></h1>

      <div className="flex gap-3 mb-6">
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none">
          <option value="">All Actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={userId} onChange={e => setUserId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Filter by User ID..."
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none flex-1" />
        <button onClick={load} className="bg-aero text-black font-bold px-4 py-2.5 rounded-xl text-sm hover:brightness-110 transition">Search</button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5">
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">User ID</th>
              <th className="text-left px-4 py-3">Moderator</th>
              <th className="text-left px-4 py-3">Reason</th>
              <th className="text-left px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">No logs found.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                <td className="px-4 py-3">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', ACTION_COLORS[log.action] ?? 'text-gray-400 border-white/10')}>{log.action}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.user_id}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.moderator_id}</td>
                <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{log.reason ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 disabled:opacity-40">← Prev</button>
          <span className="px-4 py-2 text-sm text-gray-500">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
