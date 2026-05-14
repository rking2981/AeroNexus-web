'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AdminFlight {
  id: string;
  status: string;
  pax_count: number;
  cargo_kg: number;
  block_time_min: number | null;
  landing_vs_fpm: number | null;
  landing_type: string;
  departed_at: string | null;
  arrived_at: string | null;
  takeoff_at: string | null;
  created_at: string;
  airline: { id: string; name: string; icao_code: string };
  pilot:   { id: string; display_name: string; email: string };
  hull:    { registration: string; aircraft_type: string };
  route:   { distance_nm: number; origin: { icao: string; name: string }; destination: { icao: string; name: string } } | null;
}

const STATUS_COLORS: Record<string, string> = {
  BOARDING:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  TAXI:      'text-amber-400 bg-amber-500/10 border-amber-500/20',
  TAKEOFF:   'text-aero bg-aero/10 border-aero/20',
  CLIMB:     'text-aero bg-aero/10 border-aero/20',
  CRUISE:    'text-green-400 bg-green-500/10 border-green-500/20',
  DESCENT:   'text-aero bg-aero/10 border-aero/20',
  LANDED:    'text-gray-400 bg-gray-500/10 border-gray-500/20',
  COMPLETED: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(min: number | null) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminFlightsPage() {
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [active, setActive] = useState<AdminFlight[]>([]);
  const [completed, setCompleted] = useState<AdminFlight[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminFlight | null>(null);
  const [error, setError] = useState('');
  const LIMIT = 50;

  const loadActive = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/flights/active');
      setActive(data);
    } finally { setLoading(false); }
  }, []);

  const loadCompleted = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/flights/completed', { params: { page, limit: LIMIT, search: search || undefined } });
      setCompleted(data.flights);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => {
    if (tab === 'active') loadActive();
    else loadCompleted();
  }, [tab, loadActive, loadCompleted]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this flight and all its data? This cannot be undone.')) return;
    setDeleting(id); setError('');
    try {
      await api.delete(`/admin/flights/${id}`);
      setCompleted(prev => prev.filter(f => f.id !== id));
      setTotal(prev => prev - 1);
      if (selected?.id === id) setSelected(null);
    } catch {
      setError('Failed to delete flight.');
    } finally { setDeleting(null); }
  }

  const flights = tab === 'active' ? active : completed;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Flight Management</h1>
        <p className="text-gray-400 text-sm">Monitor active flights and review or delete completed ones.</p>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 mb-6 border border-red-500/20 bg-red-500/5 text-sm text-red-400">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {([
          { key: 'active',    label: `Active (${active.length})` },
          { key: 'completed', label: `Completed${tab === 'completed' ? ` (${total.toLocaleString()})` : ''}` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); setSearch(''); setSearchInput(''); setSelected(null); }}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Completed search */}
      {tab === 'completed' && (
        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <input
            type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search pilot, airline, registration, airport…"
            className="flex-1 max-w-sm px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-aero/50"
          />
          <button type="submit" className="px-4 py-2 bg-aero text-black font-bold rounded-xl text-sm hover:brightness-110 transition">Search</button>
          {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded-xl text-sm transition">Clear</button>}
        </form>
      )}

      <div className="flex gap-6">
        {/* Flight list */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="glass-card rounded-2xl h-64 animate-pulse" />
          ) : flights.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-gray-400 text-sm">{tab === 'active' ? 'No active flights right now.' : 'No completed flights found.'}</p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left p-3 pl-4">Route</th>
                    <th className="text-left p-3">Pilot</th>
                    <th className="text-left p-3">Aircraft</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">{tab === 'active' ? 'Departed' : 'Arrived'}</th>
                    {tab === 'completed' && <th className="text-left p-3">Duration</th>}
                    {tab === 'completed' && <th className="text-left p-3">V/S</th>}
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {flights.map(f => (
                    <tr key={f.id}
                      onClick={() => setSelected(selected?.id === f.id ? null : f)}
                      className={cn('border-b border-white/5 cursor-pointer transition hover:bg-white/5',
                        selected?.id === f.id ? 'bg-aero/5' : '')}>
                      <td className="p-3 pl-4">
                        <span className="font-mono text-aero font-bold">{f.route?.origin.icao ?? '?'}</span>
                        <span className="text-gray-500 mx-1">→</span>
                        <span className="font-mono font-bold">{f.route?.destination.icao ?? '?'}</span>
                        {f.route && <div className="text-xs text-gray-600">{f.route.distance_nm.toLocaleString()} nm</div>}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{f.pilot.display_name}</div>
                        <div className="text-xs text-gray-500">{f.airline.icao_code}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-xs">{f.hull.registration}</div>
                        <div className="text-xs text-gray-500">{f.hull.aircraft_type}</div>
                      </td>
                      <td className="p-3">
                        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', STATUS_COLORS[f.status] ?? 'text-gray-400 border-white/10')}>
                          {f.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-400">
                        {fmtDate(tab === 'active' ? f.departed_at : f.arrived_at)}
                      </td>
                      {tab === 'completed' && (
                        <td className="p-3 text-xs text-gray-400">{fmtDuration(f.block_time_min)}</td>
                      )}
                      {tab === 'completed' && (
                        <td className="p-3 text-xs font-mono">
                          {f.landing_vs_fpm != null
                            ? <span className={f.landing_vs_fpm < -600 ? 'text-red-400' : f.landing_vs_fpm < -300 ? 'text-amber-400' : 'text-green-400'}>
                                {f.landing_vs_fpm} fpm
                              </span>
                            : <span className="text-gray-600">—</span>}
                        </td>
                      )}
                      <td className="p-3 text-right">
                        {tab === 'completed' && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
                            disabled={deleting === f.id}
                            className="text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded-lg transition disabled:opacity-50">
                            {deleting === f.id ? '…' : 'Delete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {tab === 'completed' && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{total.toLocaleString()} total flights</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 transition">← Prev</button>
                <span className="px-3 py-1.5">Page {page} of {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 transition">Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0">
            <div className="glass-card rounded-2xl p-5 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm">Flight Detail</h3>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                {[
                  { label: 'Flight ID',   value: selected.id.slice(0, 16) + '…', mono: true },
                  { label: 'Route',       value: `${selected.route?.origin.icao ?? '?'} → ${selected.route?.destination.icao ?? '?'}`, mono: true },
                  { label: 'Distance',    value: selected.route ? `${selected.route.distance_nm.toLocaleString()} nm` : '—' },
                  { label: 'Pilot',       value: selected.pilot.display_name },
                  { label: 'Email',       value: selected.pilot.email, mono: true },
                  { label: 'Airline',     value: `${selected.airline.name} (${selected.airline.icao_code})` },
                  { label: 'Aircraft',    value: `${selected.hull.registration} · ${selected.hull.aircraft_type}` },
                  { label: 'Passengers',  value: selected.pax_count.toLocaleString() },
                  { label: 'Cargo',       value: selected.cargo_kg > 0 ? `${selected.cargo_kg.toLocaleString()} kg` : '—' },
                  { label: 'Block Time',  value: fmtDuration(selected.block_time_min) },
                  { label: 'Landing V/S', value: selected.landing_vs_fpm != null ? `${selected.landing_vs_fpm} fpm` : '—' },
                  { label: 'Landing',     value: selected.landing_type.replace('_', ' ') },
                  { label: 'Departed',    value: fmtDate(selected.departed_at) },
                  { label: 'Arrived',     value: fmtDate(selected.arrived_at) },
                  { label: 'Created',     value: fmtDate(selected.created_at) },
                ].map(r => (
                  <div key={r.label} className="flex justify-between gap-2">
                    <span className="text-gray-500 text-xs flex-shrink-0">{r.label}</span>
                    <span className={cn('text-xs text-right break-all', r.mono ? 'font-mono text-aero' : 'text-white')}>{r.value}</span>
                  </div>
                ))}
              </div>
              {tab === 'completed' && (
                <button
                  onClick={() => handleDelete(selected.id)}
                  disabled={deleting === selected.id}
                  className="w-full mt-5 border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold py-2 rounded-xl transition text-sm disabled:opacity-50">
                  {deleting === selected.id ? 'Deleting…' : 'Delete Flight'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
