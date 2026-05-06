'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface FounderCode {
  id: string;
  code: string;
  expires_at: string;
  used_at: string | null;
  used_by: { display_name: string } | null;
}

interface TransferRequest {
  id: string;
  status: string;
  expires_at: string;
  message: string | null;
  from_user?: { display_name: string };
  to_user?: { display_name: string; email: string };
  airline: { name: string; icao_code: string; subscription_tier?: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
  ACCEPTED: 'text-green-400 border-green-500/20 bg-green-500/10',
  DECLINED: 'text-red-400 border-red-500/20 bg-red-500/10',
  EXPIRED: 'text-gray-500 border-white/10 bg-white/5',
  CANCELLED: 'text-gray-500 border-white/10 bg-white/5',
};

export default function FoundersPage() {
  const { user, setUser } = useAuthStore();
  const isFounder = (user as { is_founder?: boolean })?.is_founder;

  const [tab, setTab] = useState<'redeem' | 'codes' | 'transfer'>('redeem');
  const [codes, setCodes] = useState<FounderCode[]>([]);
  const [transfers, setTransfers] = useState<{ initiated: TransferRequest[]; received: TransferRequest[] }>({ initiated: [], received: [] });
  const [loading, setLoading] = useState(true);

  // Redeem state
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState('');
  const [redeemError, setRedeemError] = useState('');

  // Transfer initiate state
  const [toEmail, setToEmail] = useState('');
  const [transferMsg, setTransferMsg] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');

  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  useEffect(() => {
    Promise.all([
      api.get('/founders/codes'),
      api.get('/founders/transfers'),
    ]).then(([c, t]) => {
      setCodes(c.data);
      setTransfers(t.data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleRedeem() {
    if (!redeemCode.trim()) return;
    setRedeemLoading(true); setRedeemError(''); setRedeemResult('');
    try {
      const { data } = await api.post('/founders/codes/redeem', { code: redeemCode.trim().toUpperCase() });
      setRedeemResult(data.message);
      // Refresh user so is_founder badge appears
      const { data: me } = await api.post('/auth/me');
      setUser(me);
      setRedeemCode('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setRedeemError(msg ?? 'Failed to redeem code');
    } finally { setRedeemLoading(false); }
  }

  async function handleInitiateTransfer() {
    if (!toEmail.trim()) return;
    setTransferLoading(true); setTransferError(''); setTransferSuccess('');
    try {
      const { data } = await api.post('/founders/transfers', {
        to_email: toEmail.trim(),
        message: transferMsg || undefined,
      });
      setTransferSuccess(`Transfer request sent! Expires ${new Date(data.expires_at).toLocaleString()}`);
      setToEmail(''); setTransferMsg('');
      const { data: t } = await api.get('/founders/transfers');
      setTransfers(t);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setTransferError(msg ?? 'Transfer failed');
    } finally { setTransferLoading(false); }
  }

  async function handleAccept(id: string) {
    await api.patch(`/founders/transfers/${id}/accept`);
    const { data: me } = await api.post('/auth/me');
    setUser(me);
    const { data: t } = await api.get('/founders/transfers');
    setTransfers(t);
  }

  async function handleDecline(id: string) {
    await api.patch(`/founders/transfers/${id}/decline`);
    const { data: t } = await api.get('/founders/transfers');
    setTransfers(t);
  }

  async function handleCancel(id: string) {
    await api.delete(`/founders/transfers/${id}`);
    const { data: t } = await api.get('/founders/transfers');
    setTransfers(t);
  }

  const pendingReceived = transfers.received.filter((t) => t.status === 'PENDING');

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">Founder's Pass</h1>
          {isFounder && (
            <span className="text-xs font-bold text-purple-400 border border-purple-500/30 bg-purple-500/10 px-3 py-1 rounded-full">
              🎖️ Active Founder
            </span>
          )}
        </div>
        <p className="text-gray-400 text-sm">Redeem a gift code, manage your codes, or transfer VA ownership.</p>
      </div>

      {/* Pending received transfers — always show at top if any */}
      {pendingReceived.length > 0 && (
        <div className="glass-card rounded-2xl p-6 mb-6 border border-amber-500/30 bg-amber-500/5">
          <h2 className="font-bold text-amber-400 mb-4">⏳ Pending Transfer Requests</h2>
          {pendingReceived.map((req) => (
            <div key={req.id} className="flex items-start justify-between gap-4 mb-4 last:mb-0">
              <div>
                <p className="font-medium text-sm">
                  <span className="text-white">{req.from_user?.display_name}</span> wants to transfer{' '}
                  <span className="text-aero">{req.airline.name} ({req.airline.icao_code})</span> to you
                </p>
                {req.airline.subscription_tier === 'FOUNDERS' && (
                  <p className="text-xs text-purple-400 mt-0.5">🎖️ Includes Founder's tier + badge</p>
                )}
                {req.message && <p className="text-xs text-gray-400 mt-1 italic">"{req.message}"</p>}
                <p className="text-xs text-gray-500 mt-1">
                  Expires {new Date(req.expires_at).toLocaleString()}
                </p>
                {user?.airline_id && (
                  <p className="text-xs text-red-400 mt-1">
                    ⚠️ Accepting will dissolve your current airline
                  </p>
                )}
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
          { key: 'redeem', label: 'Redeem Code' },
          { key: 'codes', label: `My Codes (${codes.length})` },
          { key: 'transfer', label: 'Transfer VA' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Redeem tab */}
      {tab === 'redeem' && (
        <div className="glass-card rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎖️</div>
            <h2 className="text-xl font-bold mb-2">Redeem a Founder's Pass Code</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Enter your Founder's Pass code to unlock lifetime Enterprise access and your exclusive Founder badge.
            </p>
          </div>

          {redeemResult ? (
            <div className="text-center">
              <div className="rounded-2xl bg-purple-500/10 border border-purple-500/30 px-6 py-8 mb-6">
                <p className="text-purple-300 text-lg font-medium">{redeemResult}</p>
              </div>
              <button onClick={() => setRedeemResult('')}
                className="text-sm text-gray-400 hover:text-white transition">
                Redeem another code
              </button>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  placeholder="FOUNDER-XXXX-XXXX-XXXX"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 font-mono focus:border-[#00D1FF] focus:outline-none focus:ring-1 focus:ring-[#00D1FF] transition"
                />
                <button
                  onClick={handleRedeem}
                  disabled={redeemLoading || !redeemCode.trim()}
                  className="bg-purple-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-500 transition text-sm disabled:opacity-50"
                >
                  {redeemLoading ? '...' : 'Redeem'}
                </button>
              </div>
              {redeemError && (
                <p className="text-red-400 text-sm text-center">{redeemError}</p>
              )}
              <p className="text-xs text-gray-600 text-center mt-3">
                Codes are one-time use and expire 30 days after purchase
              </p>
            </div>
          )}
        </div>
      )}

      {/* My codes tab */}
      {tab === 'codes' && (
        <div className="flex flex-col gap-3">
          {codes.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-gray-500">
              You haven't purchased any Founder's Pass codes yet.
            </div>
          ) : codes.map((code) => (
            <div key={code.id} className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-purple-300 text-lg tracking-wider">{code.code}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {code.used_at
                    ? `Used by ${code.used_by?.display_name ?? 'someone'} on ${new Date(code.used_at).toLocaleDateString()}`
                    : `Expires ${new Date(code.expires_at).toLocaleDateString()}`
                  }
                </p>
              </div>
              <span className={cn('text-xs font-bold px-3 py-1 rounded-full border',
                code.used_at
                  ? 'text-green-400 border-green-500/20 bg-green-500/10'
                  : new Date() > new Date(code.expires_at)
                  ? 'text-gray-500 border-white/10 bg-white/5'
                  : 'text-purple-400 border-purple-500/20 bg-purple-500/10')}>
                {code.used_at ? 'Used' : new Date() > new Date(code.expires_at) ? 'Expired' : 'Available'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Transfer tab */}
      {tab === 'transfer' && (
        <div className="flex flex-col gap-6">
          {/* Initiate transfer */}
          {isManager && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-bold mb-1">Transfer VA Ownership</h2>
              <p className="text-gray-400 text-sm mb-5">
                Transfer your airline to another pilot. Requires 30 days of ownership.
                The Founder's tier and badge transfer with the airline.
              </p>

              {transferSuccess ? (
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 mb-3">
                  {transferSuccess}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-1.5">Recipient Email</label>
                    <input
                      type="email"
                      placeholder="pilot@example.com"
                      value={toEmail}
                      onChange={(e) => setToEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-1.5">Message (optional)</label>
                    <textarea
                      placeholder="Add a personal message..."
                      value={transferMsg}
                      onChange={(e) => setTransferMsg(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition resize-none"
                    />
                  </div>
                  {transferError && (
                    <p className="text-red-400 text-sm">{transferError}</p>
                  )}
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-300">
                    ⚠️ The recipient has 48 hours to accept. If they manage another airline, it will be dissolved upon acceptance.
                  </div>
                  <button
                    onClick={handleInitiateTransfer}
                    disabled={transferLoading || !toEmail.trim()}
                    className="bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50"
                  >
                    {transferLoading ? 'Sending...' : 'Send Transfer Request'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Transfer history */}
          {transfers.initiated.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-bold mb-4">Transfers Sent</h2>
              <div className="flex flex-col gap-3">
                {transfers.initiated.map((req) => (
                  <div key={req.id} className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium">
                        To: <span className="text-white">{req.to_user?.display_name}</span> — {req.airline.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {req.status === 'PENDING'
                          ? `Expires ${new Date(req.expires_at).toLocaleString()}`
                          : `Resolved`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[req.status])}>
                        {req.status}
                      </span>
                      {req.status === 'PENDING' && (
                        <button onClick={() => handleCancel(req.id)}
                          className="text-xs text-red-400 border border-red-500/20 px-3 py-1 rounded-lg hover:bg-red-500/10 transition">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
