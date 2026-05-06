'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const PILOT_NAV_BASE = [
  { href: '/dashboard', label: 'Overview', icon: '🏠' },
  { href: '/dashboard/profile', label: 'My Profile', icon: '👤' },
  { href: '/dashboard/logbook', label: 'Logbook', icon: '📋' },
  { href: '/dashboard/flights', label: 'Book Flight', icon: '✈️' },
  { href: '/dashboard/map', label: 'Live Map', icon: '🗺️' },
  { href: '/dashboard/airports', label: 'Airports', icon: '🏢' },
  { href: '/dashboard/stats', label: 'Stats', icon: '📈' },
  { href: '/dashboard/contracts', label: 'Contract Board', icon: '📄' },
];

const MANAGER_NAV = [
  { href: '/dashboard/airline', label: 'My Airline', icon: '🏢' },
  { href: '/dashboard/airline/settings', label: 'Airline Settings', icon: '⚙️' },
  { href: '/dashboard/fleet', label: 'Fleet', icon: '🛩️' },
  { href: '/dashboard/market', label: 'Aircraft Market', icon: '🏪' },
  { href: '/dashboard/insurance', label: 'Insurance', icon: '🛡️' },
  { href: '/dashboard/network', label: 'Routes & Hubs', icon: '🌐' },
  { href: '/dashboard/crew', label: 'Crew Center', icon: '👥' },
  { href: '/dashboard/finances', label: 'Finances', icon: '💰' },
  { href: '/dashboard/promotions', label: 'Promotions', icon: '📢' },
];

const ADMIN_NAV = [
  { href: '/dashboard/admin', label: 'Admin Panel', icon: '🛡️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    router.push('/');
  }

  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';
  const isAdmin = user?.role === 'PLATFORM_ADMIN';

  const pilotNav = user?.is_founder
    ? PILOT_NAV_BASE
    : [...PILOT_NAV_BASE, { href: '/dashboard/founders', label: "Founder's Pass", icon: '🎖️' }];

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-black/20 backdrop-blur-sm">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <Link href="/" className="text-xl font-bold tracking-tighter italic">
          AERO<span className="text-aero">NEXUS</span>
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        <NavSection items={pilotNav} pathname={pathname} />

        {isManager && (
          <>
            <div className="h-px bg-white/5 mx-3" />
            <div>
              <p className="px-3 mb-2 text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                Airline Management
              </p>
              <NavSection items={MANAGER_NAV} pathname={pathname} />
            </div>
          </>
        )}

        {isAdmin && (
          <>
            <div className="h-px bg-white/5 mx-3" />
            <NavSection items={ADMIN_NAV} pathname={pathname} />
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-aero/20 flex items-center justify-center text-aero text-sm font-bold flex-shrink-0">
            {user?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate flex items-center gap-1">
              {user?.display_name}
              {user?.is_founder && <Image src="/badges/founders-badge.png" alt="Founder" width={20} height={20} className="inline align-middle" />}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-500 hover:text-white transition px-1 py-1"
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}

function NavSection({ items, pathname }: { items: { href: string; label: string; icon: string }[]; pathname: string }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition',
                active
                  ? 'bg-aero/10 text-aero font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5',
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
