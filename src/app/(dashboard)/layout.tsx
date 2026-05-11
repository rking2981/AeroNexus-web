'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/store/auth';
import axios from 'axios';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated()) {
      router.replace('/login');
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // Refresh user profile once after hydration to pick up server-side changes.
  // We proactively attempt a token refresh first using the refresh_token so
  // the subsequent /auth/me call has a fresh access token and never 401s.
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated()) return;

    async function refreshAndFetch() {
      try {
        // Attempt proactive token refresh to avoid 401 on /auth/me
        const raw = localStorage.getItem('aeronexus-auth');
        const parsed = raw ? JSON.parse(raw) : null;
        const refreshToken = parsed?.state?.refresh_token;

        if (refreshToken) {
          const { data: tokens } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${refreshToken}` } },
          );
          // Write new tokens into localStorage so api interceptor picks them up
          parsed.state.access_token  = tokens.access_token;
          parsed.state.refresh_token = tokens.refresh_token;
          localStorage.setItem('aeronexus-auth', JSON.stringify(parsed));
        }
      } catch { /* refresh token also expired — let /auth/me 401 redirect to login */ }

      try {
        const { data } = await api.post('/auth/me');
        setUser(data);
      } catch { /* handled by interceptor */ }
    }

    refreshAndFetch();
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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <div className={`
        fixed inset-y-0 left-0 z-30 lg:static lg:z-auto
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition"
            aria-label="Open menu"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="17" y2="6" /><line x1="3" y1="12" x2="17" y2="12" /><line x1="3" y1="18" x2="17" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-bold tracking-tighter italic">AERO<span className="text-aero">NEXUS</span></span>
          <div className="w-8" /> {/* balance */}
        </div>

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
