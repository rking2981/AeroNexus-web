'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/store/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();

  // Debug logger — remove once logout issue is resolved
  useEffect(() => {
    console.group('[AeroNexus Auth] Dashboard layout mount');
    console.log('_hasHydrated:', _hasHydrated);
    console.log('isAuthenticated():', isAuthenticated());
    console.log('access_token in localStorage:', typeof window !== 'undefined' ? !!localStorage.getItem('access_token') : 'SSR');
    console.log('refresh_token in localStorage:', typeof window !== 'undefined' ? !!localStorage.getItem('refresh_token') : 'SSR');
    console.log('Zustand store key in localStorage:', typeof window !== 'undefined' ? !!localStorage.getItem('aeronexus-auth') : 'SSR');
    console.groupEnd();
  }, []);

  useEffect(() => {
    console.log(`[AeroNexus Auth] State change — _hasHydrated: ${_hasHydrated}, isAuthenticated: ${isAuthenticated()}`);
    if (_hasHydrated && !isAuthenticated()) {
      console.warn('[AeroNexus Auth] ⚠️ Redirecting to /login — reason: _hasHydrated=true but isAuthenticated()=false');
      console.log('[AeroNexus Auth] localStorage aeronexus-auth:', typeof window !== 'undefined' ? localStorage.getItem('aeronexus-auth') : 'SSR');
      router.replace('/login');
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // Show nothing until Zustand has rehydrated from localStorage
  if (!_hasHydrated) {
    console.log('[AeroNexus Auth] Waiting for hydration...');
    return null;
  }
  if (!isAuthenticated()) {
    console.warn('[AeroNexus Auth] ⚠️ Not authenticated after hydration — rendering null');
    return null;
  }

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
