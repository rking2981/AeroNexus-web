'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { AirlineLink } from '@/components/AirlineLink';

interface Partner {
  id: string;
  name: string;
  icao_code: string;
  logo_url: string | null;
  subscription_tier: string;
  website_slug?: string | null;
}

interface AllianceItem {
  id: string;
  codeshare: boolean;
  lounge_bonus: boolean;
  created_at: string;
  partner: Partner;
}

interface RequestItem {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  from_airline?: Partner;
  to_airline?: Partner;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'text-amber-400 border-amber-500/20 bg-amber-500/10',
  ACCEPTED:  'text-green-400 border-green-500/20 bg-green-500/10',
  DECLINED:  'text-red-400 border-red-500/20 bg-red-500/10',
  CANCELLED: 'text-gray-500 border-white/10 bg-white/5',
};

export default function AlliancesPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-5xl mx-auto animate-pulse h-96" />}>
      <AlliancesContent />
    </Suspense>
  );
}

function AirlineLogo({ airline }: { airline: Partner }) {
  if (airline.logo_url) {
    return <Image src={airline.logo_url} alt={airline.name} width={36} height={36} className="rounded-lg object-contain bg-white/5" />;
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-aero/10 border border-aero/20 flex items-center justify-center text-xs font-bold text-aero">
      {airline.icao_code.slice(0, 2)}
    </div>
  );
}

function AlliancesContent() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [tab, setTab] = useState<'alliances' | 'requests' | 'find'>('alliances');
  const [alliances, setAlliances] = useState<AllianceItem[]>([]);
  const [requests, setRequests] = useState<{ sent: RequestItem[]; received: RequestItem[] }>({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);

  // Find tab
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Partner[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sendMessage, setSendMessage] = useState<Record<string, string>>({});
  const [sendLoading, setSendLoading] = useState<Record<string, boolean>>({});
  const [sendResult, setSendResult] = useState<Record<string, string>>({});

  const pendingReceived = requests.received.filter((r) => r.status === 'PENDING');

  const reload = useCallback(async () => {
    const [a, r] = await Promise.all([
      api.get('/alliances'),
      api.get('/alliances/requests'),
    ]);
    setAlliances(a.data);
    setRequests(r.data);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data } = await api.get(`/alliances/search?q=${encodeURIComponent(q)}`);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      console.error('[Alliance search error]', msg ?? err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSendRequest(toId: string) {
    setSendLoading((p) => ({ ...p, [toId]: true }));
    setSendResult((p) => ({ ...p, [toId]: '' }));
    try {
      await api.post('/alliances/requests', { to_airline_id: toId, message: sendMessage[toId] || undefined });
      setSendResult((p) => ({ ...p, [toId]: 'Request sent!' }));
      await reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSendResult((p) => ({ ...p, [toId]: msg ?? 'Failed to send request' }));
    } finally {
      setSendLoading((p) => ({ ...p, [toId]: false }));
    }
  }

  async function handleAccept(id: string) {
    await api.patch(`/alliances/requests/${id}/accept`);
    await reload();
  }

  async function handleDecline(id: string) {
    await api.patch(`/alliances/requests/${id}/decline`);
    await reload();
  }

  async function handleCancel(id: string) {
    await api.delete(`/alliances/requests/${id}`);
    await reload();
  }

  async function handleLeave(id: string) {
    if (!confirm('Are you sure you want to leave this alliance?')) return;
    await api.delete(`/alliances/${id}`);
    await reload();
  }

  async function handleToggle(id: string, field: 'codeshare' | 'lounge_bonus', current: boolean) {
    await api.patch(`/alliances/${id}`, { [field]: !current });
    await reload();
  }

  if (!isManager) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="glass-card rounded-2xl p-8 text-center text-gray-500">
          Alliance management is available to VA Managers only.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Alliances</h1>
        <p className="text-gray-400 text-sm">Form alliances with other airlines to unlock codeshare agreements and lounge benefits.</p>
      </div>

      {/* Pending received requests banner */}
      {pendingReceived.length > 0 && (
        <div className="glass-card rounded-2xl p-6 mb-6 border border-amber-500/30 bg-amber-500/5">
          <h2 className="font-bold text-amber-400 mb-4">🤝 Pending Alliance Requests</h2>
          {pendingReceived.map((req) => (
            <div key={req.id} className="flex items-start justify-between gap-4 mb-4 last:mb-0">
              <div className="flex items-center gap-3">
                {req.from_airline && <AirlineLogo airline={req.from_airline} />}
                <div>
                  <p className="font-medium text-sm">
                    {req.from_airline && <AirlineLink airline={req.from_airline} className="text-white font-medium" showIcao />}
                    <span className="text-gray-400"> wants to ally with your airline</span>
                  </p>
                  {req.message && <p className="text-xs text-gray-400 mt-0.5 italic">"{req.message}"</p>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => handleAccept(req.id)}
                  className="text-xs bg-green-500 text-black font-bold px-3 py-1.5 rounded-lg hover:brightness-110 transition">
                  Accept
                </button>
                <button onClick={() => handleDecline(req.id)}
                  className="text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition">
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {[
          { key: 'alliances', label: `Active (${alliances.length})` },
          { key: 'requests',  label: `Requests (${pendingReceived.length + requests.sent.filter(r => r.status === 'PENDING').length})` },
          { key: 'find',      label: 'Find Airlines' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active alliances */}
      {tab === 'alliances' && (
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="glass-card rounded-2xl p-8 text-center text-gray-500 animate-pulse">Loading...</div>
          ) : alliances.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-gray-500 mb-3">No active alliances yet.</p>
              <button onClick={() => setTab('find')}
                className="text-sm text-aero hover:underline">Find airlines to ally with →</button>
            </div>
          ) : alliances.map((a) => (
            <div key={a.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AirlineLogo airline={a.partner} />
                  <div>
                    <AirlineLink airline={a.partner} className="font-bold" />
                    <p className="text-xs text-gray-500">{a.partner.icao_code} · Allied since {new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button onClick={() => handleLeave(a.id)}
                  className="text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition flex-shrink-0">
                  Leave
                </button>
              </div>
              <div className="flex gap-3 mt-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => handleToggle(a.id, 'codeshare', a.codeshare)}
                  className={cn('text-xs font-medium px-3 py-1.5 rounded-lg border transition',
                    a.codeshare
                      ? 'text-aero border-aero/30 bg-aero/10'
                      : 'text-gray-500 border-white/10 hover:border-white/20')}>
                  ✈️ Codeshare {a.codeshare ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => handleToggle(a.id, 'lounge_bonus', a.lounge_bonus)}
                  className={cn('text-xs font-medium px-3 py-1.5 rounded-lg border transition',
                    a.lounge_bonus
                      ? 'text-aero border-aero/30 bg-aero/10'
                      : 'text-gray-500 border-white/10 hover:border-white/20')}>
                  🛋️ Lounge Bonus {a.lounge_bonus ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requests */}
      {tab === 'requests' && (
        <div className="flex flex-col gap-6">
          {/* Received */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-bold mb-4">Received</h2>
            {requests.received.length === 0 ? (
              <p className="text-gray-500 text-sm">No incoming requests.</p>
            ) : requests.received.map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  {req.from_airline && <AirlineLogo airline={req.from_airline} />}
                  <div>
                    {req.from_airline && <AirlineLink airline={req.from_airline} className="text-sm font-medium" showIcao />}
                    {req.message && <p className="text-xs text-gray-400 italic">"{req.message}"</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[req.status])}>{req.status}</span>
                  {req.status === 'PENDING' && (
                    <>
                      <button onClick={() => handleAccept(req.id)}
                        className="text-xs bg-green-500 text-black font-bold px-3 py-1 rounded-lg hover:brightness-110 transition">Accept</button>
                      <button onClick={() => handleDecline(req.id)}
                        className="text-xs text-red-400 border border-red-500/20 px-3 py-1 rounded-lg hover:bg-red-500/10 transition">Decline</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sent */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-bold mb-4">Sent</h2>
            {requests.sent.length === 0 ? (
              <p className="text-gray-500 text-sm">No outgoing requests.</p>
            ) : requests.sent.map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  {req.to_airline && <AirlineLogo airline={req.to_airline} />}
                  <div>
                    {req.to_airline && <AirlineLink airline={req.to_airline} className="text-sm font-medium" showIcao />}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[req.status])}>{req.status}</span>
                  {req.status === 'PENDING' && (
                    <button onClick={() => handleCancel(req.id)}
                      className="text-xs text-red-400 border border-red-500/20 px-3 py-1 rounded-lg hover:bg-red-500/10 transition">Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Find airlines */}
      {tab === 'find' && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-bold mb-1">Find Airlines</h2>
          <p className="text-gray-400 text-sm mb-5">Search by airline name or ICAO code.</p>
          <input
            type="text"
            placeholder="e.g. Skyline Air or SKYL"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none focus:ring-1 focus:ring-aero transition mb-4"
          />
          {searchLoading && <p className="text-gray-500 text-sm">Searching...</p>}
          {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-gray-500 text-sm">No airlines found.</p>
          )}
          <div className="flex flex-col gap-3">
            {searchResults.map((airline) => {
              const alreadyAllied = alliances.some((a) => a.partner.id === airline.id);
              const alreadySent = requests.sent.some((r) => r.to_airline?.id === airline.id && r.status === 'PENDING');
              const result = sendResult[airline.id];
              return (
                <div key={airline.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/3 border border-white/5">
                  <div className="flex items-center gap-3">
                    <AirlineLogo airline={airline} />
                    <div>
                      <AirlineLink airline={airline} className="font-medium text-sm" />
                      <p className="text-xs text-gray-500">{airline.icao_code} · {airline.subscription_tier}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {alreadyAllied ? (
                      <span className="text-xs text-green-400 font-medium">Already allied</span>
                    ) : alreadySent ? (
                      <span className="text-xs text-amber-400 font-medium">Request pending</span>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Message (optional)"
                          value={sendMessage[airline.id] ?? ''}
                          onChange={(e) => setSendMessage((p) => ({ ...p, [airline.id]: e.target.value }))}
                          className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-aero focus:outline-none transition"
                        />
                        <button
                          onClick={() => handleSendRequest(airline.id)}
                          disabled={sendLoading[airline.id]}
                          className="text-xs bg-aero text-black font-bold px-4 py-1.5 rounded-lg hover:brightness-110 transition disabled:opacity-50">
                          {sendLoading[airline.id] ? '...' : 'Send Request'}
                        </button>
                      </>
                    )}
                    {result && (
                      <p className={cn('text-xs', result.includes('sent') ? 'text-green-400' : 'text-red-400')}>{result}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
