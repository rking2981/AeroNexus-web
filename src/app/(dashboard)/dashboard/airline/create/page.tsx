'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { CURRENCIES } from '@/lib/currencies';
import { cn } from '@/lib/utils';

const PLAN_PRICE_KEYS: Record<string, string> = {
  'startup-monthly':    'STARTUP_MONTHLY',
  'startup-yearly':     'STARTUP_ANNUAL',
  'enterprise-monthly': 'ENTERPRISE_MONTHLY',
  'enterprise-yearly':  'ENTERPRISE_ANNUAL',
};

const PLAN_LABELS: Record<string, string> = {
  'startup-monthly':    'VA Startup — $4.99/mo',
  'startup-yearly':     'VA Startup — $39.99/yr',
  'enterprise-monthly': 'Enterprise — $14.99/mo',
  'enterprise-yearly':  'Enterprise — $139.99/yr',
};

interface AirportResult {
  id: string;
  icao: string;
  name: string;
  city: string | null;
  country: string;
  facility_type: string;
}

export default function CreateAirlinePage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="glass-card rounded-2xl h-96 animate-pulse" /></div>}>
      <CreateAirlineForm />
    </Suspense>
  );
}

function CreateAirlineForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const { setUser, setTokens, user } = useAuthStore();

  const [form, setForm] = useState({
    name: '',
    icao_code: '',
    iata_code: '',
    hub_country: '',
    currency_code: 'USD',
    currency_symbol: '$',
  });

  // Hub airport search
  const [hubSearch, setHubSearch] = useState('');
  const [hubResults, setHubResults] = useState<AirportResult[]>([]);
  const [hubSearching, setHubSearching] = useState(false);
  const [selectedHub, setSelectedHub] = useState<AirportResult | null>(null);

  // Currency search
  const [currencySearch, setCurrencySearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const selectedCurrency = CURRENCIES.find((c) => c.code === form.currency_code);
  const filteredCurrencies = CURRENCIES.filter((c) =>
    `${c.code} ${c.label}`.toLowerCase().includes(currencySearch.toLowerCase()),
  );

  const searchAirports = useCallback(async (q: string) => {
    if (q.length < 2) { setHubResults([]); return; }
    setHubSearching(true);
    try {
      const { data } = await publicApi.get(`/network/airports/search?q=${encodeURIComponent(q)}`);
      setHubResults(data);
    } catch {
      setHubResults([]);
    } finally {
      setHubSearching(false);
    }
  }, []);

  function handleHubInput(value: string) {
    setHubSearch(value);
    setSelectedHub(null);
    searchAirports(value);
  }

  function handleHubSelect(airport: AirportResult) {
    setSelectedHub(airport);
    setHubSearch('');
    setHubResults([]);
    setForm({ ...form, hub_country: airport.country });
  }

  function handleCurrencySelect(code: string, symbol: string) {
    setForm({ ...form, currency_code: code, currency_symbol: symbol });
    setCurrencySearch('');
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Airline name is required';
    if (!form.icao_code.trim()) e.icao_code = 'ICAO code is required';
    if (!/^[A-Z]{3,4}$/.test(form.icao_code.toUpperCase())) e.icao_code = 'ICAO must be 3–4 letters';
    if (form.iata_code && !/^[A-Z0-9]{2}$/.test(form.iata_code.toUpperCase())) {
      e.iata_code = 'IATA must be exactly 2 characters';
    }
    if (!selectedHub) e.hub = 'Starting hub airport is required';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      // Create airline — response includes fresh tokens with airline_id + VA_MANAGER role
      const { data } = await api.post('/airline', {
        ...form,
        icao_code: form.icao_code.toUpperCase(),
        iata_code: form.iata_code.toUpperCase() || undefined,
      });

      // Store fresh tokens immediately so subsequent requests use the new airline_id
      if (data.access_token && data.refresh_token) {
        setTokens(data.access_token, data.refresh_token);
      }

      // Fetch updated user profile with new role and airline_id
      const { data: me } = await api.post('/auth/me');
      setUser(me);

      // Add starting hub — now the token has the correct airline_id
      await api.post('/network/hubs', {
        airport_id: selectedHub!.icao,
        type: 'PRIMARY',
      });

      // If a paid plan was selected, redirect to Stripe checkout
      if (plan && PLAN_PRICE_KEYS[plan]) {
        const { data: prices } = await api.post('/v1/payments/prices');
        const priceId = prices[PLAN_PRICE_KEYS[plan]];
        const { data: session } = await api.post('/v1/payments/checkout', {
          price_id: priceId,
          success_url: `${window.location.origin}/dashboard/airline?subscription=success`,
          cancel_url: `${window.location.origin}/dashboard/airline`,
        });
        window.location.href = session.url;
        return;
      }

      router.push('/dashboard/airline');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ general: msg ?? 'Failed to create airline. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  if (user?.airline_id) {
    router.replace('/dashboard/airline');
    return null;
  }

  // No plan selected — show plan picker first
  if (!plan) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Start Your Virtual Airline</h1>
          <p className="text-gray-400 text-sm">Choose a plan to get started. You can upgrade at any time.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              key: 'startup-monthly',
              label: 'VA Startup',
              price: '$4.99/mo',
              alt: 'or $39.99/yr',
              altKey: 'startup-yearly',
              features: ['Up to 5 pilots', '10 aircraft', 'Custom logo', 'Basic fleet management'],
              cta: 'Start Monthly',
              ctaAlt: 'Start Yearly',
              highlight: false,
            },
            {
              key: 'enterprise-monthly',
              label: 'Enterprise',
              price: '$14.99/mo',
              alt: 'or $139.99/yr',
              altKey: 'enterprise-yearly',
              features: ['500 pilots & 200 aircraft', 'Full custom branding', 'Alliance management', 'Public API access'],
              cta: 'Start Monthly',
              ctaAlt: 'Start Yearly',
              highlight: true,
            },
          ].map((p) => (
            <div key={p.key} className={cn(
              'glass-card rounded-2xl p-6 flex flex-col gap-4 border',
              p.highlight ? 'border-aero/30' : 'border-white/10',
            )}>
              {p.highlight && (
                <span className="text-[10px] text-aero font-bold tracking-widest uppercase">Most Popular</span>
              )}
              <div>
                <h3 className={cn('text-lg font-bold', p.highlight && 'text-aero')}>{p.label}</h3>
                <p className="text-2xl font-extrabold mt-1">{p.price}</p>
                <p className="text-xs text-gray-500">{p.alt}</p>
              </div>
              <ul className="text-xs text-gray-400 space-y-1.5 flex-1">
                {p.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <div className="flex flex-col gap-2">
                <Link
                  href={`/dashboard/airline/create?plan=${p.key}`}
                  className={cn(
                    'text-center text-sm font-bold py-2.5 rounded-xl transition',
                    p.highlight
                      ? 'bg-aero text-black hover:brightness-110'
                      : 'border border-white/20 hover:bg-white/5',
                  )}
                >
                  {p.cta}
                </Link>
                <Link
                  href={`/dashboard/airline/create?plan=${p.altKey}`}
                  className="text-center text-xs text-gray-500 hover:text-white transition py-1"
                >
                  {p.ctaAlt} (save ~22%)
                </Link>
              </div>
            </div>
          ))}

          {/* Free / explore */}
          <div className="glass-card rounded-2xl p-6 flex flex-col gap-4 border border-white/10">
            <div>
              <h3 className="text-lg font-bold">Explore Free</h3>
              <p className="text-2xl font-extrabold mt-1">$0</p>
              <p className="text-xs text-gray-500">No credit card needed</p>
            </div>
            <ul className="text-xs text-gray-400 space-y-1.5 flex-1">
              <li>✓ Create airline</li>
              <li>✓ Up to 5 pilots</li>
              <li>✓ 10 aircraft</li>
              <li className="text-gray-600">✗ No branding</li>
            </ul>
            <Link
              href="/dashboard/airline/create?plan=free"
              className="text-center text-sm font-bold py-2.5 rounded-xl border border-white/20 hover:bg-white/5 transition"
            >
              Continue Free
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Your Virtual Airline</h1>
        <p className="text-gray-400 text-sm">Set up your VA identity. You can update branding and settings after creation.</p>
      </div>

      {plan && PLAN_LABELS[plan] && (
        <div className="mb-6 rounded-xl border border-aero/30 bg-aero/10 px-4 py-3 text-sm text-aero">
          ✈️ Selected plan: <strong>{PLAN_LABELS[plan]}</strong>
          <span className="block text-xs text-gray-400 mt-1">After creating your airline you&apos;ll be taken to Stripe to complete your subscription.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 flex flex-col gap-6">

        {/* Identity */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Identity</h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Airline Name"
              placeholder="Pacific Virtual Airlines"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="ICAO Code (3–4 letters)"
                placeholder="PVAO"
                value={form.icao_code}
                onChange={(e) => setForm({ ...form, icao_code: e.target.value.toUpperCase() })}
                error={errors.icao_code}
                maxLength={4}
              />
              <Input
                label="IATA Code (optional)"
                placeholder="PV"
                value={form.iata_code}
                onChange={(e) => setForm({ ...form, iata_code: e.target.value.toUpperCase() })}
                error={errors.iata_code}
                maxLength={2}
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Starting Hub Airport */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Starting Hub Airport</h2>
          <div className="relative">
            <label className="text-sm font-medium text-gray-300 block mb-1.5">
              Primary Hub <span className="text-red-400">*</span>
            </label>

            {selectedHub ? (
              <div className="flex items-center justify-between rounded-xl border border-aero/50 bg-aero/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {selectedHub.icao} — {selectedHub.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedHub.city ? `${selectedHub.city}, ` : ''}{selectedHub.country} · {selectedHub.facility_type.replace('_', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedHub(null); setForm({ ...form, hub_country: '' }); }}
                  className="text-gray-500 hover:text-white text-sm ml-4 transition"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by ICAO, airport name or city..."
                  value={hubSearch}
                  onChange={(e) => handleHubInput(e.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-white placeholder-gray-500 bg-white/5 focus:outline-none focus:ring-1 transition ${
                    errors.hub ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-white/10 focus:border-[#00D1FF] focus:ring-[#00D1FF]'
                  }`}
                />
                {hubSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  </div>
                )}

                {hubResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl">
                    {hubResults.map((airport) => (
                      <button
                        key={airport.id}
                        type="button"
                        onClick={() => handleHubSelect(airport)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition border-b border-white/5 last:border-0"
                      >
                        <span className="font-mono text-aero text-sm w-12 flex-shrink-0">{airport.icao}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{airport.name}</p>
                          <p className="text-xs text-gray-500">
                            {airport.city ? `${airport.city}, ` : ''}{airport.country}
                          </p>
                        </div>
                        <span className="ml-auto text-xs text-gray-600 flex-shrink-0">
                          {airport.facility_type.replace('_', ' ')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {errors.hub && <p className="text-xs text-red-400 mt-1.5">{errors.hub}</p>}
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Currency */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Currency</h2>
          <div className="relative">
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Airline Currency</label>
            <input
              type="text"
              placeholder={`Search — currently: ${selectedCurrency?.symbol} ${selectedCurrency?.label} (${selectedCurrency?.code})`}
              value={currencySearch}
              onChange={(e) => setCurrencySearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none focus:ring-1 focus:ring-[#00D1FF] transition"
            />
            {currencySearch && (
              <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl">
                {filteredCurrencies.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No currencies found</div>
                ) : (
                  filteredCurrencies.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCurrencySelect(c.code, c.symbol)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/5 transition"
                    >
                      <span className="w-8 text-center">{c.symbol}</span>
                      <span className="text-white flex-1">{c.label}</span>
                      <span className="text-gray-500 text-xs font-mono">{c.code}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-600">{CURRENCIES.length} currencies available · Type to search</p>
          </div>
        </div>

        {errors.general && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {errors.general}
          </div>
        )}

        <Button type="submit" loading={loading}>
          {plan && PLAN_PRICE_KEYS[plan] ? 'Create Airline & Go to Checkout →' : 'Create Airline'}
        </Button>
      </form>
    </div>
  );
}
