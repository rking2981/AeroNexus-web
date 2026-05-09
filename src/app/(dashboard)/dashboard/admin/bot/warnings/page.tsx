'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';

interface Warning {
  id: string;
  user_id: string;
  moderator_id: string;
  reason: string;
  created_at: string;
}

export default function WarningsPage() {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (userId) params.set('user_id', userId);
      const { data } = await botApi.get(`/warnings?${params}`);
      setWarnings(data.warnings);
      setTotal(data.total);
      setPages(data.pages);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this warning?')) return;
    await botApi.delete(`/warnings/${id}`);
    setWarnings(w => w.filter(x => x.id !== id));
    setTotal(t => t - 1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Warnings <span className="text-gray-500 text-base font-normal">({total})</span></h1>

      <div className="flex gap-3 mb-6">
        <input value={userId} onChange={e => setUserId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Filter by User ID..."
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none flex-1" />
        <button onClick={() => { setPage(1); load(); }} className="bg-aero text-black font-bold px-4 py-2.5 rounded-xl text-sm hover:brightness-110 transition">Search</button>
      </div>

      <div className="flex flex-col gap-2">
        {loading ? <p className="text-gray-500 text-sm">Loading...</p>
          : warnings.length === 0 ? <p className="text-gray-500 text-sm">No warnings found.</p>
          : warnings.map(w => (
            <div key={w.id} className="glass-card rounded-xl p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">{w.reason}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  User: <span className="font-mono text-gray-400">{w.user_id}</span>
                  {' · '}Mod: <span className="font-mono text-gray-400">{w.moderator_id}</span>
                  {' · '}{new Date(w.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => handleDelete(w.id)}
                className="text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition flex-shrink-0">
                Delete
              </button>
            </div>
          ))}
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
