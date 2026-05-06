'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, setUser, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated()) {
      router.replace('/login');
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // Refresh user once after hydration to pick up latest server state
  useEffect(() => {
    if (_hasHydrated && isAuthenticated()) {
      api.post('/auth/me').then(({ data }) => setUser(data)).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated]);

  if (!_hasHydrated) return null;
  if (!isAuthenticated()) return null;

  const emailUnverified = user && !(user as { email_verified?: boolean }).email_verified;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {emailUnverified && (
          <div className="flex-shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between">
            <p className="text-sm text-amber-300">
              ✉️ Please verify your email address to unlock all features.
            </p>
            <Link
              href="/verify-email"
              className="text-xs font-bold text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition"
            >
              Verify Now →
            </Link>
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-[#0A0A0A]">
          {children}
        </main>
      </div>
    </div>
  );
}
