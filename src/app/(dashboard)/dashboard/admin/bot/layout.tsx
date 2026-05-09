'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useBotAdmin } from '@/hooks/useBotAdmin';

const NAV = [
  { href: '/dashboard/admin/bot',                label: '📊 Overview' },
  { href: '/dashboard/admin/bot/mod-logs',        label: '🔨 Mod Logs' },
  { href: '/dashboard/admin/bot/warnings',        label: '⚠️ Warnings' },
  { href: '/dashboard/admin/bot/automod',         label: '🤖 Auto-Mod' },
  { href: '/dashboard/admin/bot/reaction-roles',  label: '🎭 Reaction Roles' },
  { href: '/dashboard/admin/bot/tags',            label: '🏷️ Tags' },
  { href: '/dashboard/admin/bot/suggestions',     label: '💡 Suggestions' },
  { href: '/dashboard/admin/bot/linked-accounts', label: '🔗 Linked Accounts' },
  { href: '/dashboard/admin/bot/embed-builder',   label: '📝 Embed Builder' },
  { href: '/dashboard/admin/bot/config',          label: '⚙️ Config' },
];

export default function BotDashboardLayout({ children }: { children: React.ReactNode }) {
  const status = useBotAdmin();
  const pathname = usePathname();

  if (status === 'loading') {
    return <div className="p-8 text-gray-500 animate-pulse">Verifying access...</div>;
  }

  if (status === 'not_admin') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="glass-card rounded-2xl p-8">
          <p className="text-2xl mb-2">🚫</p>
          <h1 className="font-bold text-lg mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm">This area requires Platform Admin access.</p>
        </div>
      </div>
    );
  }

  if (status === 'not_linked') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="glass-card rounded-2xl p-8">
          <p className="text-2xl mb-2">🔗</p>
          <h1 className="font-bold text-lg mb-2">Discord Not Linked</h1>
          <p className="text-gray-400 text-sm mb-4">You must link your Discord account to access the bot dashboard.</p>
          <Link href="/dashboard/profile" className="text-aero text-sm hover:underline">Link Discord on your profile →</Link>
        </div>
      </div>
    );
  }

  if (status === 'no_discord_role') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="glass-card rounded-2xl p-8">
          <p className="text-2xl mb-2">🛡️</p>
          <h1 className="font-bold text-lg mb-2">Missing Discord Role</h1>
          <p className="text-gray-400 text-sm">You need the <strong className="text-white">Admin</strong> role in the AeroNexus Discord server to access this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 p-6 min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0">
        <div className="glass-card rounded-2xl p-3 sticky top-6">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider px-3 py-2">Bot Dashboard</p>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm transition',
                  pathname === item.href
                    ? 'bg-aero/10 text-aero font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
