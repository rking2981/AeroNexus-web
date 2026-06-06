'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="glass-card rounded-2xl p-8 h-[540px] animate-pulse" />}>
      <RegisterForm />
    </Suspense>
  );
}

const PLAN_LABELS: Record<string, string> = {
  'startup-monthly':    'VA Startup — $4.99/mo',
  'startup-yearly':     'VA Startup — $39.99/yr',
  'enterprise-monthly': 'Enterprise — $14.99/mo',
  'enterprise-yearly':  'Enterprise — $139.99/yr',
  'founders':           "Founder's Pass — $199 lifetime",
};

const PLAN_PRICE_KEYS: Record<string, string> = {
  'startup-monthly':    'STARTUP_MONTHLY',
  'startup-yearly':     'STARTUP_ANNUAL',
  'enterprise-monthly': 'ENTERPRISE_MONTHLY',
  'enterprise-yearly':  'ENTERPRISE_ANNUAL',
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const isPaidPlan = !!plan && plan !== '';
  const isFounders = plan === 'founders';
  const { setTokens, setUser } = useAuthStore();

  const [form, setForm] = useState({
    display_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [homeSearch, setHomeSearch] = useState('');
  const [homeResults, setHomeResults] = useState<{ id: string; icao: string; name: string; city: string | null }[]>([]);
  const [selectedHome, setSelectedHome] = useState<{ icao: string; name: string } | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [promoInfo, setPromoInfo] = useState<{ granted_tier: string; granted_months: number; description?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const searchAirports = useCallback(async (q: string) => {
    if (q.length < 2) { setHomeResults([]); return; }
    const { data } = await publicApi.get(`/network/airports/search?q=${encodeURIComponent(q)}`);
    setHomeResults(data);
  }, []);

  useEffect(() => {
    if (!promoCode.trim()) { setPromoStatus('idle'); setPromoInfo(null); return; }
    if (promoCode.length < 5) return;
    const t = setTimeout(async () => {
      setPromoStatus('checking');
      try {
        const { data } = await publicApi.get(`/auth/validate-promo-code?code=${encodeURIComponent(promoCode.trim())}`);
        setPromoStatus('valid');
        setPromoInfo(data);
      } catch {
        setPromoStatus('invalid');
        setPromoInfo(null);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [promoCode]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.display_name.trim()) e.display_name = 'Display name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        display_name: form.display_name,
        home_airport_icao: selectedHome?.icao ?? undefined,
        promo_code: promoStatus === 'valid' ? promoCode.trim().toUpperCase() : undefined,
      });
      setTokens(data.access_token, data.refresh_token);

      // Store valid promo code to redeem after airline creation
      if (promoStatus === 'valid' && promoCode.trim()) {
        sessionStorage.setItem('pending_promo_code', promoCode.trim().toUpperCase());
      }

      const { data: me } = await api.post('/auth/me', {}, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setUser(me);

      // For paid plans, send to airline creation first — subscription is attached to the airline
      if (isPaidPlan && !isFounders) {
        router.push(`/dashboard/airline/create?plan=${plan}`);
        return;
      }

      if (isFounders) {
        router.push('/dashboard/founders?checkout=true');
        return;
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ general: msg ?? 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2">
          {isFounders ? (
            <>Join as a <span className="text-purple-400">Founder</span></>
          ) : (
            'Create your account'
          )}
        </h1>
        <p className="text-gray-400 text-sm">
          {isFounders
            ? 'Secure your lifetime Enterprise access'
            : isPaidPlan
            ? 'Create your account, then complete checkout'
            : 'Start your AeroNexus journey'}
        </p>
      </div>

      {isPaidPlan && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm text-center ${
          isFounders
            ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
            : 'border-aero/30 bg-aero/10 text-aero'
        }`}>
          {isFounders ? '🎖️' : '✈️'} Selected plan: <strong>{PLAN_LABELS[plan!]}</strong>
          {!isFounders && <span className="block text-xs text-gray-400 mt-1">You&apos;ll be redirected to Stripe to complete payment after account creation.</span>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Display Name"
          type="text"
          placeholder="Capt. Ryan King"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          error={errors.display_name}
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          placeholder="pilot@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="Min. 8 characters"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          autoComplete="new-password"
        />
        {/* Home Airport */}
        <div className="relative">
          <label className="text-sm font-medium text-gray-300 block mb-1.5">
            Home Airport <span className="text-gray-500 text-xs">(optional — can be set later)</span>
          </label>
          {selectedHome ? (
            <div className="flex items-center justify-between rounded-xl border border-aero/40 bg-aero/5 px-4 py-3">
              <div>
                <span className="font-mono text-aero font-bold">{selectedHome.icao}</span>
                <span className="text-gray-400 text-sm ml-2">— {selectedHome.name}</span>
              </div>
              <button type="button" onClick={() => { setSelectedHome(null); setHomeSearch(''); }}
                className="text-gray-500 hover:text-white text-sm transition">Change</button>
            </div>
          ) : (
            <input
              type="text"
              placeholder="Search by ICAO or airport name..."
              value={homeSearch}
              onChange={(e) => { setHomeSearch(e.target.value); searchAirports(e.target.value); }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none focus:ring-1 focus:ring-[#00D1FF] transition"
            />
          )}
          {homeResults.length > 0 && !selectedHome && (
            <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl">
              {homeResults.map((a) => (
                <button key={a.id} type="button"
                  onClick={() => { setSelectedHome({ icao: a.icao, name: a.name }); setHomeResults([]); setHomeSearch(''); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                  <span className="font-mono text-xs text-aero w-12">{a.icao}</span>
                  <span className="text-sm text-white truncate">{a.name}</span>
                  {a.city && <span className="text-xs text-gray-500 ml-auto">{a.city}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <Input
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          value={form.confirm_password}
          onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
          error={errors.confirm_password}
          autoComplete="new-password"
        />

        {/* Promo Code */}
        <div>
          <label className="text-sm font-medium text-gray-300 block mb-1.5">
            Promo Code <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="ANEX-XXXX-XXXX"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              className={`w-full rounded-xl border px-4 py-3 text-sm text-white placeholder-gray-500 bg-white/5 focus:outline-none focus:ring-1 transition font-mono ${
                promoStatus === 'valid' ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/30' :
                promoStatus === 'invalid' ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30' :
                'border-white/10 focus:border-[#00D1FF] focus:ring-[#00D1FF]'
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
              {promoStatus === 'checking' && <span className="text-gray-500">...</span>}
              {promoStatus === 'valid' && <span className="text-green-400">✓</span>}
              {promoStatus === 'invalid' && <span className="text-red-400">✕</span>}
            </div>
          </div>
          {promoStatus === 'valid' && promoInfo && (
            <p className="text-xs text-green-400 mt-1">
              ✓ {promoInfo.granted_months} months free {promoInfo.granted_tier} applied
              {promoInfo.description ? ` — ${promoInfo.description}` : ''}
            </p>
          )}
          {promoStatus === 'invalid' && (
            <p className="text-xs text-red-400 mt-1">Invalid or already used promo code</p>
          )}
        </div>

        {errors.general && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {errors.general}
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          className={isFounders ? 'bg-purple-600 hover:bg-purple-500 text-white' : ''}
        >
          {isFounders
            ? 'Create Account & Secure My Spot'
            : isPaidPlan
            ? 'Create Account & Go to Checkout →'
            : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="text-aero hover:underline font-medium">
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-gray-600">
        By creating an account you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
