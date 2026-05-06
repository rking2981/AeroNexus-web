'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CURRENCIES } from '@/lib/currencies';
import { cn } from '@/lib/utils';

interface Airline {
  id: string;
  name: string;
  icao_code: string;
  iata_code: string | null;
  hub_country: string | null;
  balance: number;
  currency_code: string;
  currency_symbol: string;
  subscription_tier: string;
  subscription_status: string;
  branding: {
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
    banner_url?: string;
    font?: string;
  } | null;
  expense_configs: ExpenseConfig[];
}

interface ExpenseConfig {
  id: string;
  expense_type: string;
  billing_mode: string;
  rate: number;
  enabled: boolean;
  threshold: number | null;
}

const EXPENSE_LABELS: Record<string, string> = {
  FUEL: 'Fuel Cost',
  LANDING_FEE: 'Landing Fees',
  PILOT_PAY: 'Pilot Pay',
  CATERING: 'Catering',
  PASSENGER_SERVICES: 'Passenger Services',
  COMPENSATION: 'PAX Compensation',
  MAINTENANCE: 'Maintenance',
  GATE_SLOT: 'Gate / Slot Fees',
  INSURANCE: 'Insurance Premium',
  STAFF_OVERHEAD: 'Staff Overhead',
  AIRCRAFT_LEASE: 'Aircraft Lease',
};

const BILLING_MODE_LABELS: Record<string, string> = {
  PER_FLIGHT: 'Per Flight',
  PER_PAX: 'Per PAX',
  PER_LANDING: 'Per Landing',
  PER_DEPARTURE: 'Per Departure',
  PER_HOUR: 'Per Hour',
  PER_EVENT: 'Per Event',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

const TIER_COLORS: Record<string, string> = {
  FOUNDERS: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  ENTERPRISE: 'text-aero border-aero/30 bg-aero/10',
  STARTUP: 'text-gray-400 border-white/20 bg-white/5',
};

export default function AirlineSettingsPage() {
  const { user } = useAuthStore();
  const [airline, setAirline] = useState<Airline | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'general' | 'branding' | 'expenses' | 'transfer'>('general');

  // Transfer ownership state
  const [transferEmail, setTransferEmail] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [transferConfirm, setTransferConfirm] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [myTransfers, setMyTransfers] = useState<{
    initiated: { id: string; status: string; expires_at: string; to_user: { display_name: string; email: string }; airline: { name: string; icao_code: string } }[];
    received: { id: string; status: string; from_user: { display_name: string }; airline: { name: string; icao_code: string; subscription_tier: string } }[];
  } | null>(null);

  async function fetchTransfers() {
    try {
      const { data } = await api.get('/founders/transfers');
      setMyTransfers(data);
    } catch { /* ignore */ }
  }

  async function initiateTransfer() {
    setTransferLoading(true); setTransferError(''); setTransferSuccess('');
    try {
      await api.post('/founders/transfers', { to_email: transferEmail, message: transferMessage || undefined });
      setTransferSuccess(`Transfer request sent to ${transferEmail}. They have 48 hours to accept.`);
      setTransferEmail(''); setTransferMessage(''); setTransferConfirm(false);
      fetchTransfers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setTransferError(msg ?? 'Failed to send transfer request.');
    } finally { setTransferLoading(false); }
  }

  async function cancelTransfer(id: string) {
    try {
      await api.delete(`/founders/transfers/${id}`);
      fetchTransfers();
    } catch { /* ignore */ }
  }

  // General form
  const [general, setGeneral] = useState({ name: '', iata_code: '', hub_country: '', currency_code: '', currency_symbol: '' });
  const [currencySearch, setCurrencySearch] = useState('');
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  // Branding form
  const [branding, setBranding] = useState({ logo_url: '', primary_color: '', secondary_color: '', banner_url: '' });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);

  const isEnterprise = airline?.subscription_tier === 'ENTERPRISE' || airline?.subscription_tier === 'FOUNDERS';

  useEffect(() => {
    fetchTransfers();
    api.get('/airline').then((r) => {
      const a = r.data as Airline;
      setAirline(a);
      setGeneral({
        name: a.name,
        iata_code: a.iata_code ?? '',
        hub_country: a.hub_country ?? '',
        currency_code: a.currency_code,
        currency_symbol: a.currency_symbol,
      });
      setBranding({
        logo_url: a.branding?.logo_url ?? '',
        primary_color: a.branding?.primary_color ?? '',
        secondary_color: a.branding?.secondary_color ?? '',
        banner_url: a.branding?.banner_url ?? '',
      });
    }).finally(() => setLoading(false));
  }, []);

  async function saveGeneral() {
    setGeneralSaving(true);
    try {
      await api.patch('/airline', {
        name: general.name,
        iata_code: general.iata_code || undefined,
        hub_country: general.hub_country || undefined,
        currency_code: general.currency_code,
        currency_symbol: general.currency_symbol,
      });
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 3000);
    } catch { /* ignore */ } finally { setGeneralSaving(false); }
  }

  async function saveBranding() {
    setBrandingSaving(true);
    try {
      await api.patch('/airline/branding', {
        ...(branding.logo_url && { logo_url: branding.logo_url }),
        ...(isEnterprise && branding.primary_color && { primary_color: branding.primary_color }),
        ...(isEnterprise && branding.secondary_color && { secondary_color: branding.secondary_color }),
        ...(isEnterprise && branding.banner_url && { banner_url: branding.banner_url }),
      });
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
    } catch { /* ignore */ } finally { setBrandingSaving(false); }
  }

  async function toggleExpense(config: ExpenseConfig) {
    await api.patch(`/airline/expenses/${config.expense_type}`, {
      billing_mode: config.billing_mode,
      rate: config.rate,
      enabled: !config.enabled,
      threshold: config.threshold,
    });
    setAirline((a) => a ? {
      ...a,
      expense_configs: a.expense_configs.map((e) =>
        e.id === config.id ? { ...e, enabled: !e.enabled } : e
      ),
    } : a);
  }

  async function updateExpenseRate(config: ExpenseConfig, rate: number) {
    await api.patch(`/airline/expenses/${config.expense_type}`, {
      billing_mode: config.billing_mode,
      rate,
      enabled: config.enabled,
      threshold: config.threshold,
    });
    setAirline((a) => a ? {
      ...a,
      expense_configs: a.expense_configs.map((e) =>
        e.id === config.id ? { ...e, rate } : e
      ),
    } : a);
  }

  const filteredCurrencies = CURRENCIES.filter((c) =>
    `${c.code} ${c.label}`.toLowerCase().includes(currencySearch.toLowerCase())
  );

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;
  if (!airline) return null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Airline Settings</h1>
          <p className="text-gray-400 text-sm">{airline.name} · {airline.icao_code}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full border', TIER_COLORS[airline.subscription_tier])}>
            {airline.subscription_tier}
          </span>
          <span className={cn('text-xs px-3 py-1.5 rounded-full border',
            airline.subscription_status === 'ACTIVE' ? 'text-green-400 border-green-500/20 bg-green-500/10'
            : 'text-amber-400 border-amber-500/20 bg-amber-500/10')}>
            {airline.subscription_status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {([
          { key: 'general', label: 'General' },
          { key: 'branding', label: 'Branding' },
          { key: 'expenses', label: 'Expenses' },
          { key: 'transfer', label: 'Transfer Ownership' },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {tab === 'general' && (
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Airline Identity</h2>
          <Input label="Airline Name" value={general.name}
            onChange={(e) => setGeneral({ ...general, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="IATA Code (optional)" placeholder="DL" maxLength={2}
              value={general.iata_code}
              onChange={(e) => setGeneral({ ...general, iata_code: e.target.value.toUpperCase() })} />
            <Input label="Hub Country" placeholder="United States"
              value={general.hub_country}
              onChange={(e) => setGeneral({ ...general, hub_country: e.target.value })} />
          </div>

          <div className="h-px bg-white/5" />
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Currency</h2>

          <div className="relative">
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Airline Currency</label>
            <input type="text"
              placeholder={`Currently: ${general.currency_symbol} ${general.currency_code} — type to change`}
              value={currencySearch}
              onChange={(e) => setCurrencySearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none focus:ring-1 focus:ring-[#00D1FF] transition"
            />
            {currencySearch && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl">
                {filteredCurrencies.length === 0
                  ? <div className="px-4 py-3 text-sm text-gray-500">No currencies found</div>
                  : filteredCurrencies.map((c) => (
                    <button key={c.code} type="button"
                      onClick={() => {
                        setGeneral({ ...general, currency_code: c.code, currency_symbol: c.symbol });
                        setCurrencySearch('');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/5 transition">
                      <span className="w-8 text-center">{c.symbol}</span>
                      <span className="text-white flex-1">{c.label}</span>
                      <span className="text-gray-500 text-xs font-mono">{c.code}</span>
                    </button>
                  ))
                }
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveGeneral} loading={generalSaving} className="w-auto px-8">
              Save Changes
            </Button>
            {generalSaved && <p className="text-green-400 text-sm">✓ Saved</p>}
          </div>
        </div>
      )}

      {/* Branding tab */}
      {tab === 'branding' && (
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Branding</h2>
            {!isEnterprise && (
              <span className="text-xs text-amber-400 border border-amber-500/20 bg-amber-500/5 px-3 py-1 rounded-lg">
                Full branding requires Enterprise
              </span>
            )}
          </div>

          <Input label="Logo URL" placeholder="https://example.com/logo.png"
            value={branding.logo_url}
            onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} />

          {/* Preview */}
          {branding.logo_url && (
            <div className="flex items-center gap-3 glass-card p-3 rounded-xl">
              <img src={branding.logo_url} alt="Logo preview" className="h-10 w-10 object-contain rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <p className="text-xs text-gray-400">Logo preview</p>
            </div>
          )}

          {/* Enterprise-only fields */}
          <div className={cn(!isEnterprise && 'opacity-40 pointer-events-none select-none')}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1.5">
                  Primary Color {!isEnterprise && <span className="text-xs text-amber-400">Enterprise</span>}
                </label>
                <div className="flex items-center gap-3">
                  <input type="color" value={branding.primary_color || '#00D1FF'}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                  <input type="text" placeholder="#00D1FF" value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white font-mono focus:border-[#00D1FF] focus:outline-none transition" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1.5">
                  Secondary Color {!isEnterprise && <span className="text-xs text-amber-400">Enterprise</span>}
                </label>
                <div className="flex items-center gap-3">
                  <input type="color" value={branding.secondary_color || '#0A0A0A'}
                    onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                  <input type="text" placeholder="#0A0A0A" value={branding.secondary_color}
                    onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white font-mono focus:border-[#00D1FF] focus:outline-none transition" />
                </div>
              </div>
            </div>
            <Input label={`Banner URL${!isEnterprise ? ' (Enterprise)' : ''}`}
              placeholder="https://example.com/banner.png"
              value={branding.banner_url}
              onChange={(e) => setBranding({ ...branding, banner_url: e.target.value })} />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveBranding} loading={brandingSaving} className="w-auto px-8">
              Save Branding
            </Button>
            {brandingSaved && <p className="text-green-400 text-sm">✓ Saved</p>}
          </div>
        </div>
      )}

      {/* Expenses tab */}
      {tab === 'expenses' && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Expense Configuration</h2>
          <div className="flex flex-col gap-0">
            {airline.expense_configs.map((config, i) => (
              <div key={config.id}
                className={cn('flex items-center gap-4 py-4', i !== 0 && 'border-t border-white/5')}>
                {/* Toggle */}
                <button
                  onClick={() => toggleExpense(config)}
                  className={cn('w-10 h-6 rounded-full transition flex-shrink-0 relative',
                    config.enabled ? 'bg-aero' : 'bg-white/10')}
                >
                  <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    config.enabled ? 'left-5' : 'left-1')} />
                </button>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', !config.enabled && 'text-gray-500')}>
                    {EXPENSE_LABELS[config.expense_type] ?? config.expense_type}
                  </p>
                  <p className="text-xs text-gray-500">
                    {BILLING_MODE_LABELS[config.billing_mode] ?? config.billing_mode}
                    {config.threshold !== null && ` · Threshold: ${config.threshold}`}
                  </p>
                </div>

                {/* Rate input */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500">{airline.currency_symbol}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={config.rate}
                    disabled={!config.enabled}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) updateExpenseRate(config, val);
                    }}
                    className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white text-right focus:border-[#00D1FF] focus:outline-none transition disabled:opacity-30"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer Ownership tab */}
      {tab === 'transfer' && (
        <div className="flex flex-col gap-6 max-w-lg">
          {/* Founder note */}
          {user?.is_founder && (
            <div className="glass-card rounded-2xl p-4 border border-purple-500/20 bg-purple-500/5">
              <p className="text-sm text-purple-300 font-medium mb-1">Founder Transfer</p>
              <p className="text-xs text-gray-400">
                As a Founder, transferring this airline will also transfer your Founder status and the FOUNDERS subscription tier to the new owner. Your account will revert to a standard pilot.
              </p>
            </div>
          )}

          <div className="glass-card rounded-2xl p-6 border border-red-500/10">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Transfer Airline Ownership</h2>
            <p className="text-xs text-gray-500 mb-5">
              Transfer <span className="text-white font-medium">{airline.name}</span> to another AeroNexus user. They will receive a transfer request by email and have 48 hours to accept. This action requires 30 days of ownership and cannot be undone.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm text-gray-300 block mb-1.5">Recipient Email</label>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  placeholder="pilot@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-1.5">Message (optional)</label>
                <textarea
                  value={transferMessage}
                  onChange={(e) => setTransferMessage(e.target.value)}
                  placeholder="Add a personal message to the recipient..."
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition resize-none"
                />
              </div>

              {transferError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{transferError}</p>
              )}
              {transferSuccess && (
                <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">{transferSuccess}</p>
              )}

              <button
                onClick={() => { setTransferConfirm(true); setTransferError(''); }}
                disabled={!transferEmail || transferLoading}
                className="border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold px-6 py-2.5 rounded-xl transition text-sm disabled:opacity-40"
              >
                Send Transfer Request
              </button>
            </div>
          </div>

          {/* Pending outgoing transfers */}
          {myTransfers && myTransfers.initiated.filter((t) => t.status === 'PENDING').length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Pending Outgoing Requests</h3>
              {myTransfers.initiated.filter((t) => t.status === 'PENDING').map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{t.to_user.display_name} <span className="text-gray-500 text-xs">({t.to_user.email})</span></p>
                    <p className="text-xs text-gray-500">Expires {new Date(t.expires_at).toLocaleString()}</p>
                  </div>
                  <button onClick={() => cancelTransfer(t.id)}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-3 py-1 rounded-lg hover:bg-red-500/5 transition">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transfer confirm modal */}
      {transferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10">
            <h3 className="text-lg font-bold mb-2">Confirm Transfer</h3>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to transfer <span className="text-white font-medium">{airline.name}</span> to{' '}
              <span className="text-aero font-medium">{transferEmail}</span>?
              {user?.is_founder && (
                <span className="block mt-2 text-purple-300 text-xs">
                  Your Founder status and FOUNDERS subscription will transfer with the airline.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={initiateTransfer}
                disabled={transferLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition text-sm disabled:opacity-50"
              >
                {transferLoading ? 'Sending...' : 'Send Transfer'}
              </button>
              <button
                onClick={() => setTransferConfirm(false)}
                className="flex-1 border border-white/20 text-sm py-2.5 rounded-xl hover:bg-white/5 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
