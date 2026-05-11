'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Airline {
  id: string;
  name: string;
  icao_code: string;
  iata_code: string | null;
  hub_country: string | null;
  balance: number;
  currency_code: string;
  currency_symbol: string;
  subscription_tier: string;
  subscription_status: string;
  branding: Record<string, string> | null;
  trial_days_left: number | null;
  trial_expired: boolean;
  trial_expires_at: string | null;
}

export default function AirlinePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [airline, setAirline] = useState<Airline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.airline_id) {
      router.replace('/dashboard/airline/create');
      return;
    }
    api.get('/airline')
      .then((r) => setAirline(r.data))
      .catch(() => router.replace('/dashboard/airline/create'))
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="glass-card rounded-2xl h-48 animate-pulse" />
    </div>
  );

  if (!airline) return null;

  const tierColor = {
    FOUNDERS: 'text-purple-400',
    ENTERPRISE: 'text-aero',
    STARTUP: 'text-gray-400',
  }[airline.subscription_tier] ?? 'text-gray-400';

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">{airline.name}</h1>
          <p className="text-gray-400 text-sm flex items-center gap-3">
            <span className="font-mono">{airline.icao_code}</span>
            {airline.iata_code && <span className="font-mono">{airline.iata_code}</span>}
            {airline.hub_country && <span>{airline.hub_country}</span>}
            <span className={`font-bold ${tierColor}`}>{airline.subscription_tier}</span>
          </p>
        </div>
        <Link
          href="/dashboard/airline/settings"
          className="glass-card px-4 py-2 rounded-xl text-sm hover:bg-white/5 transition"
        >
          Settings
        </Link>
      </div>

      {/* Trial banner */}
      {airline.trial_days_left !== null && (
        <div className={`mb-6 rounded-2xl p-4 flex items-center justify-between gap-4 border ${
          airline.trial_expired
            ? 'bg-red-500/10 border-red-500/30'
            : airline.trial_days_left <= 2
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-aero/5 border-aero/20'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{airline.trial_expired ? '🔒' : '⏳'}</span>
            <div>
              <p className={`text-sm font-bold ${airline.trial_expired ? 'text-red-400' : airline.trial_days_left <= 2 ? 'text-amber-400' : 'text-aero'}`}>
                {airline.trial_expired
                  ? 'Your free trial has expired'
                  : `Free trial — ${airline.trial_days_left} day${airline.trial_days_left !== 1 ? 's' : ''} remaining`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {airline.trial_expired
                  ? 'Subscribe to restore access to airline management features.'
                  : 'Subscribe before your trial ends to keep access to all features.'}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/founders"
            className={`flex-shrink-0 font-bold text-sm px-4 py-2 rounded-xl transition ${
              airline.trial_expired
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-aero text-black hover:brightness-110'
            }`}
          >
            Subscribe →
          </Link>
        </div>
      )}

      {/* Balance card */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Airline Balance</p>
        <p className="text-4xl font-bold text-aero">
          {airline.currency_symbol}{Number(airline.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          <span className="text-sm text-gray-500 ml-2">{airline.currency_code}</span>
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { href: '/dashboard/fleet', label: 'Fleet', icon: '🛩️', desc: 'Manage aircraft' },
          { href: '/dashboard/network', label: 'Routes & Hubs', icon: '🌐', desc: 'Build your network' },
          { href: '/dashboard/crew', label: 'Crew Center', icon: '👥', desc: 'Pilots & pay' },
          { href: '/dashboard/finances', label: 'Finances', icon: '💰', desc: 'P&L dashboard' },
          { href: '/dashboard/promotions', label: 'Promotions', icon: '📢', desc: 'Promote your VA' },
          { href: '/dashboard/airline/settings', label: 'Branding', icon: '🎨', desc: 'Colors & logo' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="glass-card rounded-2xl p-5 hover:bg-white/5 transition group"
          >
            <div className="text-2xl mb-3">{item.icon}</div>
            <p className="font-semibold text-sm group-hover:text-aero transition">{item.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
