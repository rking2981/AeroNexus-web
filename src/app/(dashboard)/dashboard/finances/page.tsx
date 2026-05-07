'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FinanceSummary {
  balance: number;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  capital_expenditure: number;
  capital_proceeds: number;
  filtered: boolean;
  currency: { code: string; symbol: string };
}

interface Transaction {
  id: string;
  amount: number;
  expense_type: string | null;
  description: string | null;
  created_at: string;
  flight?: { route?: { origin: { icao: string }; destination: { icao: string } } | null } | null;
}

type FilterMode = 'all' | 'ytd' | 'weekly' | 'daily' | 'month' | 'year' | 'custom';

const EXPENSE_ICONS: Record<string, string> = {
  FUEL: '⛽', LANDING_FEE: '🛬', PILOT_PAY: '👨‍✈️', CATERING: '🍽️',
  PASSENGER_SERVICES: '🎫', COMPENSATION: '💸', MAINTENANCE: '🔧',
  GATE_SLOT: '🚪', INSURANCE: '🛡️', STAFF_OVERHEAD: '👥',
  AIRCRAFT_LEASE: '🛩️', ESCROW_FREEZE: '🔒', ESCROW_RELEASE: '🔓',
  TAX: '🏛️', STORAGE_FEE: '🏭', ENTERPRISE_CREDIT: '⭐',
  LOAN_DISBURSEMENT: '🏦', LOAN_REPAYMENT: '💳', OTHER: '📋',
};

// Capital / balance-sheet types shown with amber colour instead of red
const CAPITAL_TYPES = new Set(['AIRCRAFT_LEASE', 'ESCROW_FREEZE', 'ESCROW_RELEASE', 'ENTERPRISE_CREDIT']);

function fmt(value: number, symbol: string) {
  return `${symbol}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDateRange(mode: FilterMode, month: number, year: number): { since?: string; until?: string } {
  const now = new Date();
  switch (mode) {
    case 'all': return {};
    case 'ytd': return { since: new Date(now.getFullYear(), 0, 1).toISOString() };
    case 'weekly': {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { since: d.toISOString() };
    }
    case 'daily': {
      const d = new Date(now); d.setHours(0, 0, 0, 0);
      return { since: d.toISOString() };
    }
    case 'month': {
      const since = new Date(year, month, 1);
      const until = new Date(year, month + 1, 0, 23, 59, 59);
      return { since: since.toISOString(), until: until.toISOString() };
    }
    case 'year': {
      return {
        since: new Date(year, 0, 1).toISOString(),
        until: new Date(year, 11, 31, 23, 59, 59).toISOString(),
      };
    }
    default: return {};
  }
}

function StatCard({ label, value, symbol, color }: { label: string; value: number; symbol: string; color: 'green' | 'red' | 'aero' | 'auto' }) {
  const c = color === 'auto' ? (value >= 0 ? 'text-green-400' : 'text-red-400')
    : color === 'green' ? 'text-green-400'
    : color === 'red' ? 'text-red-400'
    : 'text-aero';
  return (
    <div className="glass-card rounded-2xl p-6">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={cn('text-2xl font-bold', c)}>{fmt(value, symbol)}</p>
    </div>
  );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Loan types ───────────────────────────────────────────────────────────────

const LOAN_TIERS = {
  STARTER:    { label: 'Starter Loan',    maxAmount: 500_000,    annualRate: 0.08,  termMonths: 3,  minFlights: 25,  minHours: 50,   minReputation: 2.5 },
  GROWTH:     { label: 'Growth Loan',     maxAmount: 2_000_000,  annualRate: 0.06,  termMonths: 6,  minFlights: 100, minHours: 200,  minReputation: 3.0 },
  ENTERPRISE: { label: 'Enterprise Loan', maxAmount: 10_000_000, annualRate: 0.045, termMonths: 12, minFlights: 500, minHours: 1000, minReputation: 3.5 },
} as const;

type LoanTierKey = keyof typeof LOAN_TIERS;

interface LoanEligibility {
  tiers: {
    tier: LoanTierKey; label: string; maxAmount: number; annualRate: number; termMonths: number; eligible: boolean;
    requirements: {
      flights: { required: number; current: number; met: boolean };
      hours: { required: number; current: number; met: boolean };
      reputation: { required: number; current: number; met: boolean };
    };
  }[];
  active_loans: number;
  can_apply: boolean;
  total_flights: number;
  total_hours: number;
  avg_reputation: number;
}

interface ActiveLoan {
  id: string; tier: string; principal: number; interest_rate: number;
  term_months: number; monthly_payment: number; remaining_balance: number;
  payments_made: number; missed_payments: number; status: string;
  next_payment_at: string; created_at: string;
}

function calcMonthlyPayment(principal: number, rate: number, months: number): number {
  if (rate === 0) return principal / months;
  const r = rate / 12;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function BankingPanel() {
  const [eligibility, setEligibility] = useState<LoanEligibility | null>(null);
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<LoanTierKey | null>(null);
  const [amount, setAmount] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [repaying, setRepaying] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/loans/eligibility'),
      api.get('/loans'),
    ]).then(([e, l]) => {
      setEligibility(e.data);
      setLoans(l.data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTier) return;
    setApplying(true); setApplyError('');
    try {
      const { data } = await api.post('/loans/apply', { tier: selectedTier, amount: parseFloat(amount) });
      setLoans(prev => [data, ...prev]);
      setSelectedTier(null); setAmount('');
      const { data: elig } = await api.get('/loans/eligibility');
      setEligibility(elig);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setApplyError(msg ?? 'Application failed');
    } finally { setApplying(false); }
  }

  async function handleRepay(loanId: string) {
    if (!confirm('Pay off this loan in full now?')) return;
    setRepaying(loanId);
    try {
      await api.post(`/loans/${loanId}/repay`);
      setLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: 'PAID_OFF', remaining_balance: 0 } : l));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Repayment failed');
    } finally { setRepaying(null); }
  }

  if (loading) return <div className="glass-card rounded-2xl h-40 animate-pulse" />;

  const activeLoans = loans.filter(l => l.status === 'ACTIVE');
  const pastLoans = loans.filter(l => l.status !== 'ACTIVE');
  const tierConfig = selectedTier ? LOAN_TIERS[selectedTier] : null;
  const parsedAmount = parseFloat(amount) || 0;
  const monthlyPayment = tierConfig && parsedAmount > 0
    ? calcMonthlyPayment(parsedAmount, tierConfig.annualRate, tierConfig.termMonths)
    : 0;

  return (
    <div className="flex flex-col gap-6">

      {/* Active loans */}
      {activeLoans.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-bold text-lg">Active Loans</h2>
          {activeLoans.map(loan => {
            const progress = loan.payments_made / loan.term_months;
            const tierLabel = LOAN_TIERS[loan.tier as LoanTierKey]?.label ?? loan.tier;
            return (
              <div key={loan.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold">🏦 {tierLabel}</span>
                      {loan.missed_payments > 0 && (
                        <span className="text-xs text-red-400 border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded-full">
                          {loan.missed_payments} missed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {(Number(loan.interest_rate) * 100).toFixed(1)}% APR · {loan.term_months} months ·
                      Payment {loan.payments_made}/{loan.term_months}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-red-400">{fmtMoney(loan.remaining_balance)} remaining</p>
                    <p className="text-xs text-gray-500">{fmtMoney(loan.monthly_payment)}/mo · due {new Date(loan.next_payment_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-aero rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {fmtMoney(Number(loan.principal) - loan.remaining_balance)} paid of {fmtMoney(loan.principal)}
                  </p>
                  <button onClick={() => handleRepay(loan.id)} disabled={repaying === loan.id}
                    className="text-xs border border-green-500/20 text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                    {repaying === loan.id ? 'Processing…' : 'Pay Off Early'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loan application */}
      {eligibility && eligibility.can_apply && (
        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-lg">Apply for a Loan</h2>

          {/* Tier cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {eligibility.tiers.map(t => (
              <button key={t.tier} onClick={() => { if (t.eligible) { setSelectedTier(t.tier); setAmount(''); setApplyError(''); } }}
                disabled={!t.eligible}
                className={cn('glass-card rounded-2xl p-5 text-left border transition',
                  selectedTier === t.tier ? 'border-aero/50 bg-aero/5'
                  : t.eligible ? 'border-transparent hover:border-white/20 cursor-pointer'
                  : 'border-transparent opacity-50 cursor-not-allowed')}>
                <p className="font-bold mb-0.5">{t.label}</p>
                <p className="text-aero font-bold text-lg mb-2">{fmtMoney(t.maxAmount)} max</p>
                <p className="text-xs text-gray-400 mb-3">{(t.annualRate * 100).toFixed(1)}% APR · {t.termMonths} months</p>
                <div className="flex flex-col gap-1">
                  {[
                    { label: `${t.requirements.flights.current}/${t.requirements.flights.required} flights`, met: t.requirements.flights.met },
                    { label: `${t.requirements.hours.current}/${t.requirements.hours.required} hrs`, met: t.requirements.hours.met },
                    { label: `${t.requirements.reputation.current.toFixed(1)}/${t.requirements.reputation.required} rep`, met: t.requirements.reputation.met },
                  ].map(r => (
                    <p key={r.label} className={cn('text-xs', r.met ? 'text-green-400' : 'text-gray-600')}>
                      {r.met ? '✓' : '✗'} {r.label}
                    </p>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Application form */}
          {selectedTier && tierConfig && (
            <form onSubmit={handleApply} className="glass-card rounded-2xl p-5 border border-aero/20">
              <h3 className="font-bold mb-4">{tierConfig.label} Application</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Loan Amount</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    min={1} max={tierConfig.maxAmount} step={10000}
                    placeholder={`Up to ${fmtMoney(tierConfig.maxAmount)}`}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="glass-card rounded-xl p-3 flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Monthly payment</span>
                      <span className="font-bold text-aero">{fmtMoney(monthlyPayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total repayment</span>
                      <span className="font-mono text-xs text-gray-300">{fmtMoney(monthlyPayment * tierConfig.termMonths)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total interest</span>
                      <span className="font-mono text-xs text-red-400">{fmtMoney(monthlyPayment * tierConfig.termMonths - parsedAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
              {applyError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-3">{applyError}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={applying || !amount || parsedAmount <= 0 || parsedAmount > tierConfig.maxAmount}
                  className="bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                  {applying ? 'Applying…' : `Apply for ${parsedAmount > 0 ? fmtMoney(parsedAmount) : '...'}`}
                </button>
                <button type="button" onClick={() => setSelectedTier(null)}
                  className="text-gray-400 hover:text-white text-sm transition">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {!eligibility?.can_apply && eligibility && (
        <div className="glass-card rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5">
          <p className="text-amber-300 text-sm font-medium">Maximum active loans reached ({eligibility.active_loans}/2). Pay off an existing loan before applying for another.</p>
        </div>
      )}

      {/* Past loans */}
      {pastLoans.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-gray-400 mb-3">Loan History</h3>
          <div className="flex flex-col gap-2">
            {pastLoans.map(loan => (
              <div key={loan.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{LOAN_TIERS[loan.tier as LoanTierKey]?.label ?? loan.tier}</p>
                  <p className="text-xs text-gray-500">{fmtMoney(loan.principal)} · {new Date(loan.created_at).toLocaleDateString()}</p>
                </div>
                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border',
                  loan.status === 'PAID_OFF' ? 'text-green-400 border-green-500/20 bg-green-500/10'
                  : 'text-red-400 border-red-500/20 bg-red-500/10')}>
                  {loan.status === 'PAID_OFF' ? '✓ Paid Off' : '⚠ Defaulted'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loans.length === 0 && eligibility && !eligibility.tiers.some(t => t.eligible) && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">🏦</p>
          <p className="font-bold mb-1">Not Yet Eligible</p>
          <p className="text-sm text-gray-400 mb-4">Build your airline&apos;s track record to unlock loans.</p>
          <div className="flex flex-col gap-2 text-sm text-gray-500 max-w-xs mx-auto">
            <p>✈️ Complete {LOAN_TIERS.STARTER.minFlights} flights ({eligibility.total_flights} done)</p>
            <p>⏱️ Log {LOAN_TIERS.STARTER.minHours} flight hours ({eligibility.total_hours} done)</p>
            <p>⭐ Maintain {LOAN_TIERS.STARTER.minReputation} reputation ({eligibility.avg_reputation.toFixed(1)} current)</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FinancesPage() {
  const now = new Date();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'overview' | 'banking'>('overview');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { since, until } = getDateRange(filterMode, selectedMonth, selectedYear);
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (until) params.set('until', until);
    params.set('limit', '500');

    try {
      const [s, t] = await Promise.all([
        api.get(`/airline/finances?${params}`),
        api.get(`/airline/finances/transactions?${params}`),
      ]);
      setSummary(s.data);
      setTransactions(t.data.transactions);
    } finally { setLoading(false); }
  }, [filterMode, selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filterLabel = () => {
    switch (filterMode) {
      case 'all': return 'All Time';
      case 'ytd': return `YTD ${currentYear}`;
      case 'weekly': return 'Last 7 Days';
      case 'daily': return 'Today';
      case 'month': return `${MONTHS[selectedMonth]} ${selectedYear}`;
      case 'year': return `Year ${selectedYear}`;
      default: return '';
    }
  };

  if (loading && !summary) return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map(i => <div key={i} className="glass-card rounded-2xl h-24 animate-pulse" />)}
      </div>
    </div>
  );

  if (!summary) return null;
  const { symbol, code } = summary.currency;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Finances</h1>
        <p className="text-gray-400 text-sm">P&L dashboard · {code}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {([{ key: 'overview', label: '📊 Overview' }, { key: 'banking', label: '🏦 Banking' }] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              activeTab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'banking' && <BankingPanel />}

      {activeTab === 'overview' && <>

      {/* Filter bar */}
      <div className="glass-card rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
        {/* Quick filters */}
        <div className="flex gap-1">
          {([
            { key: 'all',    label: 'All Time' },
            { key: 'ytd',    label: 'YTD' },
            { key: 'weekly', label: 'Weekly' },
            { key: 'daily',  label: 'Daily' },
          ] as { key: FilterMode; label: string }[]).map((f) => (
            <button key={f.key} onClick={() => setFilterMode(f.key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition',
                filterMode === f.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Month filter */}
        <div className="flex items-center gap-2">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white focus:border-aero focus:outline-none">
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white focus:border-aero focus:outline-none">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setFilterMode('month')}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition',
              filterMode === 'month' ? 'bg-aero text-black' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
            This Month
          </button>
        </div>

        {/* Year filter */}
        <button onClick={() => setFilterMode('year')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition',
            filterMode === 'year' ? 'bg-aero text-black' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
          Full Year
        </button>

        {/* Active filter label */}
        <div className="ml-auto flex items-center gap-2">
          {loading && <div className="w-3 h-3 border border-aero border-t-transparent rounded-full animate-spin" />}
          <span className="text-xs text-gray-500">
            Showing: <span className="text-white font-medium">{filterLabel()}</span>
          </span>
          {filterMode !== 'all' && (
            <button onClick={() => setFilterMode('all')} className="text-xs text-gray-600 hover:text-white transition">✕ Clear</button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div className="glass-card rounded-2xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
            {filterMode === 'all' ? 'Current Balance' : 'Balance'}
          </p>
          <p className="text-2xl font-bold text-aero">
            {filterMode === 'all' ? fmt(summary.balance, symbol) : '—'}
          </p>
          {filterMode !== 'all' && (
            <p className="text-xs text-gray-600 mt-1">Balance is always current</p>
          )}
        </div>
        <StatCard label={`Operating Revenue${filterMode !== 'all' ? ` (${filterLabel()})` : ''}`} value={summary.total_revenue} symbol={symbol} color="green" />
        <div className="glass-card rounded-2xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Net Profit</p>
          <p className={cn('text-2xl font-bold', summary.net_profit >= 0 ? 'text-green-400' : 'text-red-400')}>
            {fmt(summary.net_profit, symbol)}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">Operating revenue minus operating expenses</p>
        </div>
      </div>

      {/* Operating expenses + CapEx row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label={`Operating Expenses${filterMode !== 'all' ? ` (${filterLabel()})` : ''}`} value={summary.total_expenses} symbol={symbol} color="red" />
        {summary.capital_expenditure > 0 && (
          <div className="glass-card rounded-2xl p-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Capital Expenditure</p>
            <p className="text-2xl font-bold text-amber-400">{fmt(summary.capital_expenditure, symbol)}</p>
            <p className="text-[10px] text-gray-600 mt-1">Aircraft purchases — not in Net Profit</p>
          </div>
        )}
        {summary.capital_proceeds > 0 && (
          <div className="glass-card rounded-2xl p-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Asset Sales</p>
            <p className="text-2xl font-bold text-blue-400">{fmt(summary.capital_proceeds, symbol)}</p>
            <p className="text-[10px] text-gray-600 mt-1">Aircraft sold — not in Net Profit</p>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold">Transactions</h2>
            <p className="text-xs text-gray-500 mt-0.5">{transactions.length} records · {filterLabel()}</p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No transactions in this period</p>
        ) : (
          <div className="flex flex-col gap-0">
            {transactions.map((tx, i) => {
              const isCredit = tx.amount > 0;
              const route = tx.flight?.route;
              return (
                <div key={tx.id}
                  className={cn('flex items-center gap-4 py-3', i !== 0 && 'border-t border-white/5')}>
                  <span className="text-xl w-8 text-center flex-shrink-0">
                    {tx.expense_type ? (EXPENSE_ICONS[tx.expense_type] ?? '💳') : '💳'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description ?? tx.expense_type?.replace(/_/g, ' ') ?? 'Transaction'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {route ? `${route.origin.icao} → ${route.destination.icao} · ` : ''}
                      {new Date(tx.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' '}
                      {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={cn('font-mono font-bold text-sm',
                      isCredit ? 'text-green-400'
                      : tx.expense_type && CAPITAL_TYPES.has(tx.expense_type) ? 'text-amber-400'
                      : 'text-red-400')}>
                      {isCredit ? '+' : '-'}{fmt(tx.amount, symbol)}
                    </p>
                    {tx.expense_type && CAPITAL_TYPES.has(tx.expense_type) && (
                      <p className="text-[10px] text-gray-600">CapEx</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </> }
    </div>
  );
}
