'use client';

import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import Image from 'next/image';
import { AdSenseUnit } from '@/components/shared/AdSenseUnit';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface PendingTransfer {
  id: string;
  from_user: { display_name: string };
  airline: { name: string; icao_code: string };
  expires_at: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [acarsVersion, setAcarsVersion] = useState<string | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [transferAction, setTransferAction] = useState<string | null>(null);
  const [showPayBanner, setShowPayBanner] = useState(false);

  useEffect(() => {
    fetch('https://aeronexus-api-production.up.railway.app/acars/version')
      .then(r => r.json())
      .then(d => setAcarsVersion(d.version))
      .catch(() => null);

    // Show rank pay banner once to managers who haven't dismissed it
    if (typeof window !== 'undefined' && !localStorage.getItem('aeronexus_rank_pay_banner_dismissed')) {
      setShowPayBanner(true);
    }

    api.get('/founders/transfers')
      .then(({ data }) => setPendingTransfers(data.received ?? []))
      .catch(() => {});
  }, []);

  async function handleTransfer(id: string, action: 'accept' | 'decline') {
    setTransferAction(id);
    try {
      await api.patch(`/founders/transfers/${id}/${action}`);
      setPendingTransfers(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
    finally { setTransferAction(null); }
  }

  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Rank-based pilot pay announcement banner — shown once to managers */}
      {isManager && showPayBanner && (
        <div className="mb-6 rounded-2xl border border-aero/40 bg-aero/8 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">💰</span>
              <div>
                <p className="text-sm font-bold text-aero mb-1">Rank-Based Pilot Pay is now live</p>
                <p className="text-sm text-gray-300 mb-2">
                  Pilots are now paid per block hour based on their rank. <strong className="text-white">Pilot pay is currently set to $0/hr for all ranks</strong> — visit your Rank Structure in Crew Center to set hourly rates for each rank tier.
                </p>
                <Link
                  href="/dashboard/crew?tab=ranks"
                  className="inline-block text-xs font-bold bg-aero text-black px-4 py-1.5 rounded-lg hover:brightness-110 transition"
                >
                  Go to Rank Structure →
                </Link>
              </div>
            </div>
            <button
              onClick={() => {
                setShowPayBanner(false);
                localStorage.setItem('aeronexus_rank_pay_banner_dismissed', '1');
              }}
              className="flex-shrink-0 text-gray-500 hover:text-white transition text-sm border border-white/10 px-3 py-1 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">
          Welcome back, <span className="text-aero">{user?.display_name}</span>
          {user?.is_founder && (
            <Image src="/badges/founders-badge.png" alt="Founder's Pass" width={48} height={48} className="inline ml-2 align-middle" />
          )}
        </h1>
        <p className="text-gray-400 text-sm">
          {isManager ? 'Airline Manager Dashboard' : 'Pilot Dashboard'} ·{' '}
          <span className="text-aero">Rep {Number(user?.reputation ?? 5).toFixed(1)}</span>
        </p>
      </div>

      {/* Pending Transfer Requests */}
      {pendingTransfers.map(t => (
        <div key={t.id} className="glass-card rounded-2xl p-5 mb-6 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-amber-400 mb-1">✈️ Airline Ownership Transfer</p>
              <p className="text-sm text-gray-300">
                <span className="text-white font-medium">{t.from_user.display_name}</span> wants to transfer{' '}
                <span className="text-aero font-medium">{t.airline.name} ({t.airline.icao_code})</span> to you.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Accepting will make you the VA Manager. If you currently manage another airline, it will be dissolved.
              </p>
              <p className="text-xs text-amber-500/80 mt-1 font-medium">
                Only accept this transfer if you no longer wish to keep your current airline.
              </p>
              {t.expires_at && (
                <p className="text-xs text-gray-600 mt-1">Expires: {new Date(t.expires_at).toLocaleString()}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleTransfer(t.id, 'accept')}
                disabled={transferAction === t.id}
                className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition disabled:opacity-50"
              >
                {transferAction === t.id ? '…' : 'Accept'}
              </button>
              <button
                onClick={() => handleTransfer(t.id, 'decline')}
                disabled={transferAction === t.id}
                className="border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30 font-medium px-4 py-2 rounded-xl text-sm transition disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { href: '/dashboard/flights', label: 'Book Flight', icon: '✈️', desc: 'Start a new flight' },
          { href: '/dashboard/logbook', label: 'Logbook', icon: '📋', desc: 'View flight history' },
          { href: '/dashboard/map', label: 'Live Map', icon: '🗺️', desc: 'Active flights' },
          { href: '/dashboard/stats', label: 'My Stats', icon: '📈', desc: 'Performance overview' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="glass-card rounded-2xl p-5 hover:bg-white/5 transition group"
          >
            <div className="text-2xl mb-3">{action.icon}</div>
            <p className="font-semibold text-sm group-hover:text-aero transition">{action.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
          </Link>
        ))}
      </div>

      {/* ACARS Download */}
      <div className="glass-card rounded-2xl p-5 mb-10 flex items-center justify-between gap-4 border border-aero/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-aero/10 flex items-center justify-center text-xl flex-shrink-0">🖥️</div>
          <div>
            <p className="font-semibold text-sm">AeroNexus ACARS <span className="text-aero">{acarsVersion ? `v${acarsVersion}` : '...'}</span></p>
            <p className="text-xs text-gray-500 mt-0.5">Desktop client for MSFS 2024 &amp; X-Plane — automatic flight tracking, scoring &amp; telemetry</p>
          </div>
        </div>
        <a
          href="https://aeronexus.app/acars/download"
          target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 bg-aero text-black font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110 transition"
        >
          ⬇ Download
        </a>
      </div>

      {/* Manager section */}
      {isManager && (
        <>
          <h2 className="text-lg font-bold mb-4 text-gray-300">Airline Management</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { href: '/dashboard/airline', label: 'My Airline', icon: '🏢', desc: 'Branding & settings' },
              { href: '/dashboard/fleet', label: 'Fleet', icon: '🛩️', desc: 'Manage aircraft' },
              { href: '/dashboard/network', label: 'Routes & Hubs', icon: '🌐', desc: 'Network map' },
              { href: '/dashboard/crew', label: 'Crew Center', icon: '👥', desc: 'Pilots & pay' },
              { href: '/dashboard/finances', label: 'Finances', icon: '💰', desc: 'P&L dashboard' },
              { href: '/dashboard/promotions', label: 'Promotions', icon: '📢', desc: 'Promote your VA' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="glass-card rounded-2xl p-5 hover:bg-white/5 transition group"
              >
                <div className="text-2xl mb-3">{action.icon}</div>
                <p className="font-semibold text-sm group-hover:text-aero transition">{action.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* No airline CTA */}
      {!user?.airline_id && (
        <div className="glass-card rounded-2xl p-8 text-center border-aero/30">
          <div className="text-4xl mb-4">✈️</div>
          <h3 className="text-xl font-bold mb-2">Create Your Virtual Airline</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            You&apos;re currently flying as an independent pilot. Create your own VA to unlock fleet management, routes, and crew tools.
          </p>
          <Link
            href="/dashboard/airline/create"
            className="inline-block bg-aero text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition text-sm"
          >
            Create My Airline
          </Link>
        </div>
      )}

      {/* AdSense — FREE_ADS pilots only */}
      <AdSenseUnit slot="1234567890" format="horizontal" className="mt-6" />
    </div>
  );
}
