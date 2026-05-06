'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface Contract {
  id: string;
  origin_icao: string;
  destination_icao: string;
  distance_nm: number;
  required_aircraft_icao: string | null;
  aircraft_category: string;
  cargo_kg: number | null;
  notes: string | null;
  pilot_pay: string;
  airline_revenue: string;
  xp_bonus: number;
  status: string;
  accepted_by_id: string | null;
  accepted_at: string | null;
  acceptance_expires_at: string | null;
  contract_expires_at: string;
  created_at: string;
  airline: {
    name: string;
    icao_code: string;
    branding?: { primary_color?: string } | null;
  };
  accepted_by?: { display_name: string; auto_rank: string } | null;
  flight?: { status: string; departed_at: string | null; arrived_at: string | null } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  FIXED_WING: 'Fixed Wing',
  HELICOPTER: 'Helicopter',
  CARGO: 'Cargo',
};

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: 'bg-green-500/10 text-green-400 border-green-500/20',
    ACCEPTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    COMPLETED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    EXPIRED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', styles[status] ?? styles.EXPIRED)}>
      {status}
    </span>
  );
}

export default function ContractsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [activeTab, setActiveTab] = useState<'board' | 'mine' | 'posted'>('board');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [myAccepted, setMyAccepted] = useState<Contract[]>([]);
  const [myPosted, setMyPosted] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for board
  const [filterCategory, setFilterCategory] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterDest, setFilterDest] = useState('');

  // Post contract form
  const [showPost, setShowPost] = useState(false);
  const [postForm, setPostForm] = useState({
    origin_icao: '',
    destination_icao: '',
    required_aircraft_icao: '',
    aircraft_category: 'FIXED_WING',
    cargo_kg: '',
    notes: '',
    pilot_pay: '',
    airline_revenue: '',
    xp_bonus: '250',
    board_expires_hours: '72',
  });
  const [postError, setPostError] = useState('');
  const [posting, setPosting] = useState(false);

  // Airport search for post form
  const [originResults, setOriginResults] = useState<{ id: string; icao: string; name: string }[]>([]);
  const [destResults, setDestResults] = useState<{ id: string; icao: string; name: string }[]>([]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set('category', filterCategory);
      if (filterOrigin) params.set('origin', filterOrigin);
      if (filterDest) params.set('destination', filterDest);
      const { data } = await publicApi.get(`/contracts?${params}`);
      setContracts(data);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterOrigin, filterDest]);

  const fetchMyContracts = useCallback(async () => {
    const [acc, posted] = await Promise.all([
      api.get('/contracts/my/accepted').then((r) => r.data),
      isManager ? api.get('/contracts/my/posted').then((r) => r.data) : Promise.resolve([]),
    ]);
    setMyAccepted(acc);
    setMyPosted(posted);
  }, [isManager]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);
  useEffect(() => { fetchMyContracts(); }, [fetchMyContracts]);

  const searchAirports = useCallback(async (q: string, which: 'origin' | 'dest') => {
    if (q.length < 2) { which === 'origin' ? setOriginResults([]) : setDestResults([]); return; }
    const { data } = await publicApi.get(`/network/airports/search?q=${encodeURIComponent(q)}`);
    which === 'origin' ? setOriginResults(data) : setDestResults(data);
  }, []);

  async function handleAccept(id: string) {
    setActionLoading(id); setActionError('');
    try {
      await api.post(`/contracts/${id}/accept`);
      await Promise.all([fetchBoard(), fetchMyContracts()]);
      setActiveTab('mine');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Failed to accept contract.');
    } finally { setActionLoading(null); }
  }

  async function handleCancelAccepted(id: string) {
    setActionLoading(id); setActionError('');
    try {
      await api.delete(`/contracts/${id}/accept`);
      await fetchMyContracts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Failed to cancel contract.');
    } finally { setActionLoading(null); }
  }

  async function handleCancelPosted(id: string) {
    setActionLoading(id); setActionError('');
    try {
      await api.delete(`/contracts/${id}`);
      await fetchMyContracts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Failed to cancel contract.');
    } finally { setActionLoading(null); }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setPostError(''); setPosting(true);
    try {
      await api.post('/contracts', {
        origin_icao: postForm.origin_icao.toUpperCase(),
        destination_icao: postForm.destination_icao.toUpperCase(),
        required_aircraft_icao: postForm.required_aircraft_icao || undefined,
        aircraft_category: postForm.aircraft_category,
        cargo_kg: postForm.cargo_kg ? Number(postForm.cargo_kg) : undefined,
        notes: postForm.notes || undefined,
        pilot_pay: Number(postForm.pilot_pay),
        airline_revenue: Number(postForm.airline_revenue),
        xp_bonus: Number(postForm.xp_bonus),
        board_expires_hours: Number(postForm.board_expires_hours),
      });
      setShowPost(false);
      setPostForm({
        origin_icao: '', destination_icao: '', required_aircraft_icao: '', aircraft_category: 'FIXED_WING',
        cargo_kg: '', notes: '', pilot_pay: '', airline_revenue: '', xp_bonus: '250', board_expires_hours: '72',
      });
      await Promise.all([fetchBoard(), fetchMyContracts()]);
      setActiveTab('posted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPostError(msg ?? 'Failed to post contract.');
    } finally { setPosting(false); }
  }

  const inputCls = 'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contract Board</h1>
          <p className="text-gray-400 text-sm mt-1">
            Browse available contract flights posted by virtual airlines.
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowPost(!showPost)}
            className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm"
          >
            {showPost ? 'Cancel' : '+ Post Contract'}
          </button>
        )}
      </div>

      {/* Post Contract Form */}
      {showPost && (
        <div className="glass-card rounded-2xl p-6 mb-6 border border-aero/20">
          <h3 className="font-bold mb-4 text-aero">Post a Contract Flight</h3>
          <form onSubmit={handlePost} className="grid grid-cols-2 gap-4">
            {/* Origin */}
            <div className="relative">
              <label className="text-xs text-gray-400 block mb-1.5">Origin ICAO *</label>
              <input
                value={postForm.origin_icao}
                onChange={(e) => { setPostForm({ ...postForm, origin_icao: e.target.value }); searchAirports(e.target.value, 'origin'); }}
                placeholder="KSEA" required className={inputCls}
              />
              {originResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-xl">
                  {originResults.map((a) => (
                    <button key={a.id} type="button"
                      onClick={() => { setPostForm({ ...postForm, origin_icao: a.icao }); setOriginResults([]); }}
                      className="w-full flex gap-3 px-4 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                      <span className="font-mono text-xs text-aero w-12">{a.icao}</span>
                      <span className="text-xs text-white truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Destination */}
            <div className="relative">
              <label className="text-xs text-gray-400 block mb-1.5">Destination ICAO *</label>
              <input
                value={postForm.destination_icao}
                onChange={(e) => { setPostForm({ ...postForm, destination_icao: e.target.value }); searchAirports(e.target.value, 'dest'); }}
                placeholder="KLAX" required className={inputCls}
              />
              {destResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-xl">
                  {destResults.map((a) => (
                    <button key={a.id} type="button"
                      onClick={() => { setPostForm({ ...postForm, destination_icao: a.icao }); setDestResults([]); }}
                      className="w-full flex gap-3 px-4 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                      <span className="font-mono text-xs text-aero w-12">{a.icao}</span>
                      <span className="text-xs text-white truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Pilot Pay */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Pilot Pay ($) *</label>
              <input type="number" min="0" step="0.01" value={postForm.pilot_pay}
                onChange={(e) => setPostForm({ ...postForm, pilot_pay: e.target.value })}
                placeholder="1500.00" required className={inputCls} />
            </div>
            {/* Airline Revenue */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Airline Revenue ($) *</label>
              <input type="number" min="0" step="0.01" value={postForm.airline_revenue}
                onChange={(e) => setPostForm({ ...postForm, airline_revenue: e.target.value })}
                placeholder="5000.00" required className={inputCls} />
            </div>
            {/* Aircraft Category */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Aircraft Category</label>
              <select value={postForm.aircraft_category}
                onChange={(e) => setPostForm({ ...postForm, aircraft_category: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition">
                <option value="FIXED_WING">Fixed Wing</option>
                <option value="HELICOPTER">Helicopter</option>
                <option value="CARGO">Cargo</option>
              </select>
            </div>
            {/* Required Aircraft Type */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Required Aircraft Type (optional)</label>
              <input value={postForm.required_aircraft_icao}
                onChange={(e) => setPostForm({ ...postForm, required_aircraft_icao: e.target.value })}
                placeholder="B738, A320..." className={inputCls} />
            </div>
            {/* XP Bonus */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">XP Bonus</label>
              <input type="number" min="0" value={postForm.xp_bonus}
                onChange={(e) => setPostForm({ ...postForm, xp_bonus: e.target.value })}
                className={inputCls} />
            </div>
            {/* Board Expiry */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Board Listing Duration (hours)</label>
              <input type="number" min="1" max="168" value={postForm.board_expires_hours}
                onChange={(e) => setPostForm({ ...postForm, board_expires_hours: e.target.value })}
                className={inputCls} />
            </div>
            {/* Cargo */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Cargo (kg, optional)</label>
              <input type="number" min="0" value={postForm.cargo_kg}
                onChange={(e) => setPostForm({ ...postForm, cargo_kg: e.target.value })}
                placeholder="0" className={inputCls} />
            </div>
            {/* Notes */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Notes (optional)</label>
              <input value={postForm.notes}
                onChange={(e) => setPostForm({ ...postForm, notes: e.target.value })}
                placeholder="Special instructions..." className={inputCls} />
            </div>

            {postError && (
              <div className="col-span-2">
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{postError}</p>
              </div>
            )}
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={posting}
                className="bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                {posting ? 'Posting...' : 'Post Contract'}
              </button>
              <button type="button" onClick={() => setShowPost(false)}
                className="border border-white/20 text-sm px-6 py-2.5 rounded-xl hover:bg-white/5 transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global action error */}
      {actionError && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {actionError}
          <button onClick={() => setActionError('')} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {[
          { key: 'board', label: 'Open Board' },
          { key: 'mine', label: `My Contracts${myAccepted.filter((c) => c.status === 'ACCEPTED').length > 0 ? ` (${myAccepted.filter((c) => c.status === 'ACCEPTED').length})` : ''}` },
          ...(isManager ? [{ key: 'posted', label: 'Posted by My VA' }] : []),
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              activeTab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Board tab */}
      {activeTab === 'board' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 mb-5 flex-wrap">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-[#00D1FF] focus:outline-none">
              <option value="">All Categories</option>
              <option value="FIXED_WING">Fixed Wing</option>
              <option value="HELICOPTER">Helicopter</option>
              <option value="CARGO">Cargo</option>
            </select>
            <input value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value.toUpperCase())}
              placeholder="Origin ICAO"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#00D1FF] focus:outline-none w-36" />
            <input value={filterDest} onChange={(e) => setFilterDest(e.target.value.toUpperCase())}
              placeholder="Dest ICAO"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#00D1FF] focus:outline-none w-36" />
            <button onClick={fetchBoard}
              className="border border-white/20 text-sm px-4 py-2 rounded-xl hover:bg-white/5 transition">
              Search
            </button>
            {(filterCategory || filterOrigin || filterDest) && (
              <button onClick={() => { setFilterCategory(''); setFilterOrigin(''); setFilterDest(''); }}
                className="text-xs text-gray-500 hover:text-white transition px-2">
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-2xl h-28 animate-pulse" />
              ))}
            </div>
          ) : contracts.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-400">No open contracts at the moment.</p>
              {isManager && (
                <button onClick={() => setShowPost(true)}
                  className="mt-4 text-aero text-sm hover:underline">
                  Post the first contract →
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {contracts.map((c) => (
                <ContractCard
                  key={c.id}
                  contract={c}
                  actionLabel="Accept Contract"
                  actionLoading={actionLoading === c.id}
                  onAction={() => handleAccept(c.id)}
                  showExpiry
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* My accepted contracts */}
      {activeTab === 'mine' && (
        <div className="flex flex-col gap-3">
          {myAccepted.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">✈️</p>
              <p className="text-gray-400">You haven&apos;t accepted any contracts yet.</p>
              <button onClick={() => setActiveTab('board')}
                className="mt-4 text-aero text-sm hover:underline">
                Browse the board →
              </button>
            </div>
          ) : (
            myAccepted.map((c) => (
              <ContractCard
                key={c.id}
                contract={c}
                actionLabel={c.status === 'ACCEPTED' ? 'Cancel Contract' : undefined}
                actionLoading={actionLoading === c.id}
                onAction={c.status === 'ACCEPTED' ? () => handleCancelAccepted(c.id) : undefined}
                actionDanger={c.status === 'ACCEPTED'}
                showAcceptanceExpiry={c.status === 'ACCEPTED'}
              />
            ))
          )}
        </div>
      )}

      {/* Posted by my VA */}
      {activeTab === 'posted' && (
        <div className="flex flex-col gap-3">
          {myPosted.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">📢</p>
              <p className="text-gray-400">Your VA hasn&apos;t posted any contracts yet.</p>
              <button onClick={() => setShowPost(true)}
                className="mt-4 text-aero text-sm hover:underline">
                Post a contract →
              </button>
            </div>
          ) : (
            myPosted.map((c) => (
              <ContractCard
                key={c.id}
                contract={c}
                actionLabel={c.status === 'OPEN' ? 'Cancel Listing' : undefined}
                actionLoading={actionLoading === c.id}
                onAction={c.status === 'OPEN' ? () => handleCancelPosted(c.id) : undefined}
                actionDanger
                showPilot={!!c.accepted_by}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ContractCard({
  contract: c,
  actionLabel,
  actionLoading,
  onAction,
  actionDanger = false,
  showExpiry = false,
  showAcceptanceExpiry = false,
  showPilot = false,
}: {
  contract: Contract;
  actionLabel?: string;
  actionLoading?: boolean;
  onAction?: () => void;
  actionDanger?: boolean;
  showExpiry?: boolean;
  showAcceptanceExpiry?: boolean;
  showPilot?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 md:flex-row md:items-center">
      {/* Route info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <span className="font-mono font-bold text-aero text-lg tracking-wide">
            {c.origin_icao} → {c.destination_icao}
          </span>
          <StatusBadge status={c.status} />
          <span className="text-xs text-gray-500">{CATEGORY_LABELS[c.aircraft_category] ?? c.aircraft_category}</span>
          {c.required_aircraft_icao && (
            <span className="text-xs font-mono text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded-full">
              {c.required_aircraft_icao} required
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 mb-2">
          <span>{c.distance_nm.toLocaleString()} nm</span>
          <span>Posted by <span className="text-white">{c.airline.icao_code}</span></span>
          {c.cargo_kg && <span>Cargo: {c.cargo_kg.toLocaleString()} kg</span>}
          {c.notes && <span className="italic text-gray-500 text-xs">"{c.notes}"</span>}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-green-400 font-bold">${Number(c.pilot_pay).toLocaleString('en-US', { minimumFractionDigits: 2 })} pilot pay</span>
          <span className="text-gray-400">${Number(c.airline_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })} revenue</span>
          <span className="text-purple-400">+{c.xp_bonus} XP</span>
        </div>
        {showExpiry && (
          <p className="text-xs text-gray-600 mt-1">Expires in {timeUntil(c.contract_expires_at)}</p>
        )}
        {showAcceptanceExpiry && c.acceptance_expires_at && (
          <p className="text-xs text-amber-400 mt-1">
            Must complete within {timeUntil(c.acceptance_expires_at)}
          </p>
        )}
        {showPilot && c.accepted_by && (
          <p className="text-xs text-gray-400 mt-1">
            Accepted by <span className="text-white">{c.accepted_by.display_name}</span>{' '}
            ({c.accepted_by.auto_rank})
          </p>
        )}
      </div>

      {/* Action */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          disabled={actionLoading}
          className={cn(
            'flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50',
            actionDanger
              ? 'border border-red-500/30 text-red-400 hover:bg-red-500/10'
              : 'bg-aero text-black hover:brightness-110',
          )}
        >
          {actionLoading ? '...' : actionLabel}
        </button>
      )}
    </div>
  );
}
