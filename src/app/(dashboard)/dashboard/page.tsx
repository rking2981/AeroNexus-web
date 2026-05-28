'use client';

import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import Image from 'next/image';
import { AdSenseUnit } from '@/components/shared/AdSenseUnit';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  return (
    <div className="p-8 max-w-6xl mx-auto">
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
            <p className="font-semibold text-sm">AeroNexus ACARS <span className="text-aero">v1.2.0</span></p>
            <p className="text-xs text-gray-500 mt-0.5">Desktop client for MSFS 2024 &amp; X-Plane — automatic flight tracking, scoring &amp; telemetry</p>
          </div>
        </div>
        <a
          href="https://pub-0c30dc19c1234fbc95ad95a8b4d19af7.r2.dev/AeroNexus%20ACARS%20Setup%201.3.8.exe"
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
