'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/store/auth';
import { api, publicApi } from '@/lib/api';
import { startAcarsBridge, stopAcarsBridge } from '@/lib/acars-bridge';

const HEALTH_INTERVAL_MS = 8000;   // poll every 8s normally
const RECOVERY_INTERVAL_MS = 3000; // poll every 3s when down (faster recovery detection)
const OUTAGE_THRESHOLD = 2;        // consecutive failures before showing banner

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, setUser, _hasHydrated } = useAuthStore();
  const [isDown, setIsDown] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const failCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Start ACARS bridge when authenticated — silently connects to desktop app
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated() || !user?.airline_id) return;
    const store = useAuthStore.getState();
    const token = store.access_token;
    const refresh_token = store.refresh_token ?? undefined;
    if (!token) return;
    startAcarsBridge({
      token,
      refresh_token,
      airline_id: user.airline_id,
      display_name: user.display_name ?? 'Pilot',
      api_url: process.env.NEXT_PUBLIC_API_URL ?? 'https://aeronexus-api-production.up.railway.app',
    });
    return () => stopAcarsBridge();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, user?.airline_id]);

  // Health poller
  useEffect(() => {
    async function check() {
      // Skip if browser says we're offline — not a server issue
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        await publicApi.get('/health', { timeout: 5000 });
        // Success — clear failure count
        failCount.current = 0;
        if (isDown) {
          setRecovering(true);
          // Brief "back online" flash before hiding banner
          setTimeout(() => { setIsDown(false); setRecovering(false); }, 1500);
        }
      } catch {
        failCount.current += 1;
        if (failCount.current >= OUTAGE_THRESHOLD) {
          setIsDown(true);
          setRecovering(false);
        }
      }
    }

    // Restart interval at different rate depending on state
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(check, isDown ? RECOVERY_INTERVAL_MS : HEALTH_INTERVAL_MS);
    check(); // immediate first check

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isDown]);

  if (!_hasHydrated) return null;
  if (!isAuthenticated()) return null;

  const emailUnverified = user && !(user as { email_verified?: boolean }).email_verified;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Maintenance / deployment banner */}
        {(isDown || recovering) && (
          <div className={`flex-shrink-0 px-6 py-3 flex items-center justify-center gap-3 text-sm font-medium transition-colors ${
            recovering
              ? 'bg-green-500/15 border-b border-green-500/30 text-green-300'
              : 'bg-amber-500/15 border-b border-amber-500/30 text-amber-300'
          }`}>
            {recovering ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                Back online — resuming service.
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                We are momentarily down for maintenance, we&apos;ll be back shortly.
              </>
            )}
          </div>
        )}

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
