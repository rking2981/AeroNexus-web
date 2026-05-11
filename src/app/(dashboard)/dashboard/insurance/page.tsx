'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  slug: string;
  type: 'HULL' | 'CIVIL';
  description: string;
  tier_gate: string | null;
  base_coverage: number;
  base_deductible: number;
  flat_deductible: number | null;
  base_premium_pct: number;
  eligible: boolean;
  reason: string;
}

interface Policy {
  id: string;
  tier: string;
  coverage_pct: number;
  deductible_pct: number;
  flat_deductible: number | null;
  monthly_premium: number;
  next_payment_at: string;
  is_active: boolean;
  company: { name: string; slug: string; type: string };
  hull: { registration: string; aircraft_type: string } | null;
}

interface Claim {
  id: string;
  claim_type: string;
  reason: string;
  status: string;
  filed_at: string;
  resolved_at: string | null;
  payout: number | null;
  policy: { company: { name: string } };
}

interface Hull {
  id: string;
  registration: string;
  aircraft_type: string;
  aircraft_category: string;
}

const COMPANY_COLORS: Record<string, string> = {
  'vantage-aero': 'border-aero/30 bg-aero/5',
  'rotorguard': 'border-green-500/30 bg-green-500/5',
  'sentinel-civil': 'border-blue-500/30 bg-blue-500/5',
  'civitas-global': 'border-purple-500/30 bg-purple-500/5',
};

const COMPANY_ACCENT: Record<string, string> = {
  'vantage-aero': 'text-aero',
  'rotorguard': 'text-green-400',
  'sentinel-civil': 'text-blue-400',
  'civitas-global': 'text-purple-400',
};

const COMPANY_ICONS: Record<string, string> = {
  'vantage-aero': '🛡️',
  'rotorguard': '🚁',
  'sentinel-civil': '⚖️',
  'civitas-global': '🌐',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  APPROVED: 'text-green-400 bg-green-500/10 border-green-500/20',
  AUTO_APPROVED: 'text-green-400 bg-green-500/10 border-green-500/20',
  DENIED: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const TIER_MULTIPLIERS = {
  BASIC:    { premium: 0.75, label: 'Basic', desc: 'Lower premium, higher deductible' },
  STANDARD: { premium: 1.00, label: 'Standard', desc: 'Balanced coverage' },
  PREMIUM:  { premium: 1.50, label: 'Premium', desc: 'Maximum coverage, lower deductible' },
};

export default function InsurancePage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [tab, setTab] = useState<'browse' | 'policies' | 'claims'>('browse');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [hulls, setHulls] = useState<Hull[]>([]);
  const [loading, setLoading] = useState(true);

  // Purchase modal state
  const [purchasing, setPurchasing] = useState<Company | null>(null);
  const [selectedTier, setSelectedTier] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('STANDARD');
  const [selectedHull, setSelectedHull] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  // Change tier modal state
  const [changingPolicy, setChangingPolicy] = useState<Policy | null>(null);
  const [changeTier, setChangeTier] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('STANDARD');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');

  // Claim modal state
  const [filing, setFiling] = useState(false);
  const [claimType, setClaimType] = useState<'HULL_DAMAGE' | 'FLIGHT_NULLIFICATION' | 'PAX_LIABILITY'>('FLIGHT_NULLIFICATION');
  const [claimReason, setClaimReason] = useState('');
  const [claimFlightId, setClaimFlightId] = useState('');
  const [claimHullId, setClaimHullId] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/insurance/companies/eligible'),
      api.get('/insurance/policies'),
      api.get('/insurance/claims'),
      api.get('/fleet'),
    ]).then(([c, p, cl, f]) => {
      setCompanies(c.data);
      setPolicies(p.data);
      setClaims(cl.data);
      setHulls(f.data.filter((h: Hull & { status: string }) => h.status === 'ACTIVE'));
    }).finally(() => setLoading(false));
  }, []);

  async function handlePurchase() {
    if (!purchasing) return;
    const needsHull = purchasing.type === 'HULL';
    if (needsHull && !selectedHull) { setPurchaseError('Select a hull to insure'); return; }
    setPurchaseError('');
    setPurchaseLoading(true);

    try {
      const { data } = await api.post('/insurance/policies', {
        company_id: purchasing.id,
        tier: selectedTier,
        hull_id: needsHull ? selectedHull : undefined,
      });
      setPolicies([...policies, data]);
      setPurchasing(null);
      setSelectedHull('');
      setSelectedTier('STANDARD');
      setTab('policies');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPurchaseError(msg ?? 'Purchase failed. Check your balance.');
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function handleCancelPolicy(id: string) {
    if (!confirm('Cancel this policy? Coverage ends immediately.')) return;
    await api.delete(`/insurance/policies/${id}`);
    setPolicies(policies.filter((p) => p.id !== id));
  }

  async function handleChangeTier() {
    if (!changingPolicy) return;
    setChangeError(''); setChangeLoading(true);
    try {
      const { data } = await api.patch(`/insurance/policies/${changingPolicy.id}/tier`, { tier: changeTier });
      setPolicies(policies.map(p => p.id === data.id ? data : p));
      setChangingPolicy(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setChangeError(msg ?? 'Failed to change tier.');
    } finally { setChangeLoading(false); }
  }

  // Returns the active policy for a given company slug
  function policyForCompany(slug: string): Policy | undefined {
    return policies.find(p => p.company.slug === slug && p.is_active);
  }

  async function handleFileClaim() {
    setClaimLoading(true);
    try {
      const { data } = await api.post('/insurance/claims', {
        claim_type: claimType,
        reason: claimReason,
        flight_id: claimFlightId || undefined,
        hull_id: claimHullId || undefined,
      });
      setClaims([data.claim, ...claims]);
      setFiling(false);
      setClaimReason('');
      setClaimFlightId('');
      setClaimHullId('');
      setTab('claims');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Failed to file claim');
    } finally {
      setClaimLoading(false);
    }
  }

  function estimatePremium(company: Company, tier: 'BASIC' | 'STANDARD' | 'PREMIUM', hullId?: string): string {
    const hull = hulls.find((h) => h.id === hullId);
    if (company.flat_deductible) {
      return `$${(500 * TIER_MULTIPLIERS[tier].premium).toFixed(2)}/mo`;
    }
    return hull ? 'Varies by hull value' : 'Select hull to see premium';
  }

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Insurance</h1>
          <p className="text-gray-400 text-sm">
            {policies.length} active {policies.length === 1 ? 'policy' : 'policies'} ·
            {claims.filter(c => c.status === 'PENDING').length} pending claims
          </p>
        </div>
        <button
          onClick={() => setFiling(true)}
          className="text-sm border border-white/20 px-4 py-2 rounded-xl hover:bg-white/5 transition"
        >
          File a Claim
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {([
          { key: 'browse', label: `Browse (${companies.length})` },
          { key: 'policies', label: `My Policies (${policies.length})` },
          { key: 'claims', label: `Claims (${claims.length})` },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Browse tab */}
      {tab === 'browse' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {companies.map((company) => (
            <div key={company.id}
              className={cn('glass-card rounded-2xl p-6 border flex flex-col',
                company.eligible ? COMPANY_COLORS[company.slug] : 'border-white/5 opacity-60')}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{COMPANY_ICONS[company.slug]}</span>
                    <h3 className={cn('font-bold text-lg', COMPANY_ACCENT[company.slug])}>
                      {company.name}
                    </h3>
                  </div>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border',
                    company.type === 'HULL'
                      ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                      : 'text-blue-400 border-blue-500/20 bg-blue-500/10')}>
                    {company.type === 'HULL' ? 'Hull Insurance' : 'Civil Insurance'}
                  </span>
                </div>
                <div className="text-right text-sm">
                  {company.flat_deductible
                    ? <p className="font-bold">${company.flat_deductible.toLocaleString()} <span className="text-gray-500 text-xs font-normal">deductible</span></p>
                    : <p className="font-bold">{(Number(company.base_deductible) * 100).toFixed(0)}% <span className="text-gray-500 text-xs font-normal">deductible</span></p>
                  }
                  <p className="text-gray-400">{(Number(company.base_coverage) * 100).toFixed(0)}% coverage</p>
                </div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-4 flex-1">{company.description}</p>

              {company.tier_gate && (
                <p className="text-xs text-gray-500 mb-3">
                  Requires: {company.tier_gate === 'ENTERPRISE' ? 'Enterprise subscription'
                    : company.tier_gate === 'HELICOPTER' ? 'Active helicopter hull'
                    : company.tier_gate === 'ALLIANCE' ? 'Active Alliance membership'
                    : company.tier_gate}
                </p>
              )}

              {company.eligible && isManager ? (
                (() => {
                  const existing = policyForCompany(company.slug);
                  return existing ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Current: <span className="font-bold text-white">{existing.tier}</span>
                      </span>
                      <button
                        onClick={() => { setChangingPolicy(existing); setChangeTier(existing.tier as 'BASIC' | 'STANDARD' | 'PREMIUM'); setChangeError(''); }}
                        className="text-sm font-bold px-4 py-2 rounded-xl border border-white/20 hover:bg-white/5 transition">
                        Change Plan
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setPurchasing(company); setSelectedTier('STANDARD'); setSelectedHull(''); }}
                      className={cn('w-full py-2.5 rounded-xl font-bold text-sm transition',
                        company.slug === 'vantage-aero' ? 'bg-aero text-black hover:brightness-110'
                        : company.slug === 'rotorguard' ? 'bg-green-500 text-black hover:brightness-110'
                        : company.slug === 'sentinel-civil' ? 'bg-blue-500 text-white hover:brightness-110'
                        : 'bg-purple-500 text-white hover:brightness-110')}>
                      Get Policy
                    </button>
                  );
                })()
              ) : !company.eligible ? (
                <p className="text-xs text-red-400 text-center py-2">{company.reason}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Policies tab */}
      {tab === 'policies' && (
        <div className="flex flex-col gap-4">
          {policies.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold mb-2">No active policies</h3>
              <p className="text-gray-400 text-sm mb-6">Protect your fleet and operations with insurance coverage.</p>
              <button onClick={() => setTab('browse')}
                className="inline-block bg-aero text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition text-sm">
                Browse Insurers
              </button>
            </div>
          ) : policies.map((policy) => (
            <div key={policy.id} className={cn('glass-card rounded-2xl p-6 border', COMPANY_COLORS[policy.company.slug])}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{COMPANY_ICONS[policy.company.slug]}</span>
                    <h3 className={cn('font-bold', COMPANY_ACCENT[policy.company.slug])}>
                      {policy.company.name}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-white/20 text-gray-300">
                      {policy.tier}
                    </span>
                  </div>
                  {policy.hull && (
                    <p className="text-sm text-gray-400">
                      Hull: <span className="font-mono text-white">{policy.hull.registration}</span> — {policy.hull.aircraft_type}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold">${Number(policy.monthly_premium).toLocaleString('en-US', { minimumFractionDigits: 2 })}<span className="text-xs text-gray-500">/mo</span></p>
                  <p className="text-xs text-gray-500">Next: {new Date(policy.next_payment_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-400 mb-4">
                <span>Coverage: <strong className="text-white">{(Number(policy.coverage_pct) * 100).toFixed(0)}%</strong></span>
                {policy.flat_deductible
                  ? <span>Deductible: <strong className="text-white">${Number(policy.flat_deductible).toLocaleString()}</strong></span>
                  : <span>Deductible: <strong className="text-white">{(Number(policy.deductible_pct) * 100).toFixed(0)}%</strong></span>
                }
              </div>
              {isManager && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setChangingPolicy(policy); setChangeTier(policy.tier as 'BASIC' | 'STANDARD' | 'PREMIUM'); setChangeError(''); }}
                    className="text-xs border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/5 transition">
                    Change Plan
                  </button>
                  <button onClick={() => handleCancelPolicy(policy.id)}
                    className="text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Claims tab */}
      {tab === 'claims' && (
        <div className="flex flex-col gap-3">
          {claims.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-gray-500">No claims filed yet</div>
          ) : claims.map((claim) => (
            <div key={claim.id} className="glass-card rounded-2xl p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">
                    {claim.claim_type.replace('_', ' ')}
                  </p>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[claim.status] ?? 'text-gray-400 border-white/20')}>
                    {claim.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">{claim.reason}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {claim.policy.company.name} · Filed {new Date(claim.filed_at).toLocaleDateString()}
                  {claim.resolved_at && ` · Resolved ${new Date(claim.resolved_at).toLocaleDateString()}`}
                </p>
              </div>
              {claim.payout && (
                <p className="text-green-400 font-bold text-sm flex-shrink-0">
                  +${Number(claim.payout).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Purchase modal */}
      {purchasing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-8 w-full max-w-lg border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{COMPANY_ICONS[purchasing.slug]}</span>
              <div>
                <h2 className={cn('text-xl font-bold', COMPANY_ACCENT[purchasing.slug])}>
                  {purchasing.name}
                </h2>
                <p className="text-xs text-gray-400">{purchasing.type === 'HULL' ? 'Hull Insurance' : 'Civil Insurance'}</p>
              </div>
            </div>

            {/* Hull selector for hull insurance */}
            {purchasing.type === 'HULL' && (
              <div className="mb-5">
                <label className="text-sm font-medium text-gray-300 block mb-2">Select Hull to Insure</label>
                <select
                  value={selectedHull}
                  onChange={(e) => setSelectedHull(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition"
                >
                  <option value="">Select aircraft...</option>
                  {hulls
                    .filter((h) => purchasing.slug !== 'rotorguard' || h.aircraft_category === 'HELICOPTER')
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.registration} — {h.aircraft_type}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Tier selector */}
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-300 block mb-2">Coverage Tier</label>
              <div className="flex flex-col gap-2">
                {(['BASIC', 'STANDARD', 'PREMIUM'] as const).map((tier) => (
                  <label key={tier}
                    className={cn('flex items-center justify-between p-4 rounded-xl border cursor-pointer transition',
                      selectedTier === tier ? 'border-aero bg-aero/10' : 'border-white/10 hover:border-white/20')}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="tier" value={tier} checked={selectedTier === tier}
                        onChange={() => setSelectedTier(tier)} className="accent-[#00D1FF]" />
                      <div>
                        <p className="text-sm font-medium">{TIER_MULTIPLIERS[tier].label}</p>
                        <p className="text-xs text-gray-500">{TIER_MULTIPLIERS[tier].desc}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">{estimatePremium(purchasing, tier, selectedHull)}</p>
                  </label>
                ))}
              </div>
            </div>

            {purchaseError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-4">
                {purchaseError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handlePurchase} disabled={purchaseLoading}
                className="flex-1 bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                {purchaseLoading ? 'Purchasing...' : 'Purchase Policy'}
              </button>
              <button onClick={() => { setPurchasing(null); setPurchaseError(''); }}
                className="px-5 text-sm text-gray-400 hover:text-white transition border border-white/10 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change tier modal */}
      {changingPolicy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-8 w-full max-w-md border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{COMPANY_ICONS[changingPolicy.company.slug]}</span>
              <h2 className={cn('text-xl font-bold', COMPANY_ACCENT[changingPolicy.company.slug])}>
                {changingPolicy.company.name}
              </h2>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Current plan: <span className="font-bold text-white">{changingPolicy.tier}</span>
              {' · '}${Number(changingPolicy.monthly_premium).toFixed(2)}/mo
            </p>

            <div className="flex flex-col gap-2 mb-5">
              {(['BASIC', 'STANDARD', 'PREMIUM'] as const).map((tier) => (
                <label key={tier}
                  className={cn('flex items-center justify-between p-4 rounded-xl border cursor-pointer transition',
                    changeTier === tier ? 'border-aero bg-aero/10' : 'border-white/10 hover:border-white/20',
                    tier === changingPolicy.tier && 'opacity-50 cursor-not-allowed')}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="change-tier" value={tier}
                      checked={changeTier === tier}
                      disabled={tier === changingPolicy.tier}
                      onChange={() => setChangeTier(tier)}
                      className="accent-[#00C8FF]" />
                    <div>
                      <p className="text-sm font-medium">
                        {TIER_MULTIPLIERS[tier].label}
                        {tier === changingPolicy.tier && <span className="ml-2 text-xs text-gray-500">(current)</span>}
                      </p>
                      <p className="text-xs text-gray-500">{TIER_MULTIPLIERS[tier].desc}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {changeError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-4">
                {changeError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleChangeTier}
                disabled={changeLoading || changeTier === changingPolicy.tier}
                className="flex-1 bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                {changeLoading ? 'Updating…' : changeTier === changingPolicy.tier ? 'Select a different tier' :
                  (changeTier === 'PREMIUM' || (changeTier === 'STANDARD' && changingPolicy.tier === 'BASIC'))
                    ? 'Upgrade' : 'Downgrade'}
              </button>
              <button onClick={() => { setChangingPolicy(null); setChangeError(''); }}
                className="px-5 text-sm text-gray-400 hover:text-white transition border border-white/10 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File claim modal */}
      {filing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-8 w-full max-w-lg border border-white/10">
            <h2 className="text-xl font-bold mb-6">File an Insurance Claim</h2>

            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Claim Type</label>
                <select value={claimType} onChange={(e) => setClaimType(e.target.value as typeof claimType)}
                  className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition">
                  <option value="FLIGHT_NULLIFICATION">Flight Nullification (sim crash/disconnect)</option>
                  <option value="HULL_DAMAGE">Hull Damage (crash/engine failure)</option>
                  <option value="PAX_LIABILITY">Passenger Liability</option>
                </select>
              </div>

              {claimType === 'FLIGHT_NULLIFICATION' && (
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Flight ID <span className="text-gray-500 text-xs">(from your logbook)</span></label>
                  <input type="text" placeholder="Flight ID..." value={claimFlightId}
                    onChange={(e) => setClaimFlightId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition" />
                </div>
              )}

              {claimType === 'HULL_DAMAGE' && (
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Affected Hull</label>
                  <select value={claimHullId} onChange={(e) => setClaimHullId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition">
                    <option value="">Select hull...</option>
                    {hulls.map((h) => (
                      <option key={h.id} value={h.id}>{h.registration} — {h.aircraft_type}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">
                  Description <span className="text-gray-500 text-xs">(be specific — affects approval)</span>
                </label>
                <textarea value={claimReason} onChange={(e) => setClaimReason(e.target.value)}
                  placeholder="Describe what happened..."
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none transition resize-none" />
              </div>

              {claimType === 'FLIGHT_NULLIFICATION' && (
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-300 space-y-1">
                  <p>⏱️ Claims must be filed within 24 hours of the interrupted flight.</p>
                  <p>✅ Pilots with reputation ≥ 4.0 and a Sentinel Civil policy receive automatic approval.</p>
                  <p>📋 Limit: 2 nullification claims per 30 days · 7-day cooldown between claims.</p>
                  <p>⚠️ Disconnects during approach or after landing are flagged for manual admin review.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleFileClaim} disabled={claimLoading || !claimReason.trim()}
                className="flex-1 bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                {claimLoading ? 'Filing...' : 'Submit Claim'}
              </button>
              <button onClick={() => setFiling(false)}
                className="px-5 text-sm text-gray-400 hover:text-white transition border border-white/10 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
