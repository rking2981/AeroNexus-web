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

// ─── Banking types ────────────────────────────────────────────────────────────

interface CreditInfo {
  equity: number;
  cash: number;
  fleet_value: number;
  total_debt: number;
  credit_limit: number;
  available_credit: number;
  annual_rate: number;
  is_bankrupt: boolean;
  eligible: boolean;
  requirements: {
    flights:    { required: number; current: number; met: boolean };
    hours:      { required: number; current: number; met: boolean };
    reputation: { required: number; current: number; met: boolean };
  };
}

interface Loan {
  id: string;
  label: string;
  principal: number;
  annual_rate: number;
  remaining_balance: number;
  accrued_interest: number;
  payment_schedule: string;
  scheduled_payment: number;
  days_negative: number;
  status: string;
  next_payment_at: string;
  created_at: string;
}

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const SCHEDULE_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly', BIWEEKLY: 'Bi-Weekly', MONTHLY: 'Monthly',
};

function BankingPanel() {
  const [credit, setCredit] = useState<CreditInfo | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  // Application form state
  const [showApply, setShowApply] = useState(false);
  const [applyAmount, setApplyAmount] = useState('');
  const [applyLabel, setApplyLabel] = useState('Aircraft Purchase Loan');
  const [applySchedule, setApplySchedule] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('MONTHLY');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  // Payment state
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/loans/credit'), api.get('/loans')])
      .then(([c, l]) => { setCredit(c.data); setLoans(l.data); })
      .finally(() => setLoading(false));
  }, []);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setApplying(true); setApplyError('');
    try {
      const { data } = await api.post('/loans/apply', {
        amount: parseFloat(applyAmount),
        label: applyLabel,
        schedule: applySchedule,
      });
      setLoans(prev => [data, ...prev]);
      setShowApply(false); setApplyAmount(''); setApplyLabel('Aircraft Purchase Loan');
      const { data: c } = await api.get('/loans/credit');
      setCredit(c);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setApplyError(msg ?? 'Application failed');
    } finally { setApplying(false); }
  }

  async function handlePay(loanId: string) {
    setPaying(true); setPayError('');
    try {
      const { data } = await api.post(`/loans/${loanId}/pay`, { amount: parseFloat(payAmount) });
      setLoans(prev => prev.map(l => l.id === loanId
        ? { ...l, remaining_balance: data.remaining_balance, status: data.paid_off ? 'PAID_OFF' : l.status }
        : l));
      setPayingId(null); setPayAmount('');
      const { data: c } = await api.get('/loans/credit');
      setCredit(c);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPayError(msg ?? 'Payment failed');
    } finally { setPaying(false); }
  }

  if (loading) return <div className="glass-card rounded-2xl h-40 animate-pulse" />;

  const activeLoans = loans.filter(l => l.status === 'ACTIVE');
  const pastLoans = loans.filter(l => l.status !== 'ACTIVE');
  const parsedAmount = parseFloat(applyAmount) || 0;

  // Estimate daily interest on requested amount
  const dailyInterestPreview = credit && parsedAmount > 0
    ? Math.round(parsedAmount * (credit.annual_rate / 365) * 100) / 100
    : 0;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Bankruptcy warning */}
      {credit?.is_bankrupt && (
        <div className="glass-card rounded-2xl p-5 border border-red-500/30 bg-red-500/5">
          <p className="font-bold text-red-400 mb-1">🚨 Bankruptcy Declared</p>
          <p className="text-sm text-gray-300">
            Your airline&apos;s balance was negative for too long. Flight operations are suspended until all outstanding debt is cleared.
            Make payments on your active loans to resolve bankruptcy.
          </p>
        </div>
      )}

      {/* Credit summary */}
      {credit && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-bold text-lg mb-4">Credit Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Cash Balance', value: fmtMoney(credit.cash), color: credit.cash < 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'Fleet Value', value: fmtMoney(credit.fleet_value), color: 'text-aero' },
              { label: 'Total Debt', value: fmtMoney(credit.total_debt), color: credit.total_debt > 0 ? 'text-red-400' : 'text-gray-400' },
              { label: 'Net Equity', value: fmtMoney(credit.equity), color: credit.equity < 0 ? 'text-red-400' : 'text-white' },
              { label: 'Credit Limit', value: fmtMoney(credit.credit_limit), color: 'text-gray-300' },
              { label: 'Available Credit', value: fmtMoney(credit.available_credit), color: credit.available_credit > 0 ? 'text-green-400' : 'text-gray-500' },
            ].map(row => (
              <div key={row.label} className="glass-card rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{row.label}</p>
                <p className={cn('font-bold text-sm', row.color)}>{row.value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Interest rate: <span className="text-white font-bold">{(credit.annual_rate * 100).toFixed(1)}% APR</span> (fixed at origination · accrues daily)</span>
            <span>Credit limit = 60% of net equity</span>
          </div>
        </div>
      )}

      {/* Active loans */}
      {activeLoans.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-bold">Active Loans</h2>
          {activeLoans.map(loan => {
            const totalOwed = loan.remaining_balance + loan.accrued_interest;
            const paidDown = Number(loan.principal) - loan.remaining_balance;
            const progress = paidDown / Number(loan.principal);
            const isPayingThis = payingId === loan.id;
            return (
              <div key={loan.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold">🏦 {loan.label}</span>
                      {loan.days_negative > 0 && (
                        <span className="text-xs text-red-400 border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded-full">
                          Balance negative {loan.days_negative}d
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {(Number(loan.annual_rate) * 100).toFixed(1)}% APR · {SCHEDULE_LABELS[loan.payment_schedule]} payments
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-red-400">{fmtMoney(totalOwed)} owed</p>
                    <p className="text-xs text-gray-500">
                      {fmtMoney(loan.remaining_balance)} principal + {fmtMoney(loan.accrued_interest)} interest
                    </p>
                  </div>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-aero rounded-full" style={{ width: `${Math.min(100, progress * 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>{fmtMoney(paidDown)} paid of {fmtMoney(loan.principal)}</span>
                  <span>Next {SCHEDULE_LABELS[loan.payment_schedule].toLowerCase()} payment: {fmtMoney(loan.scheduled_payment)} · due {new Date(loan.next_payment_at).toLocaleDateString()}</span>
                </div>

                {/* Payment panel */}
                {isPayingThis ? (
                  <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                        placeholder={`Min ${fmtMoney(loan.scheduled_payment)} · Max ${fmtMoney(totalOwed)}`}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-aero focus:outline-none transition" />
                      <button onClick={() => setPayAmount(String(Math.round(totalOwed)))}
                        className="text-xs border border-white/10 px-3 py-2 rounded-xl hover:bg-white/5 text-gray-400 transition">
                        Pay All
                      </button>
                      <button onClick={() => handlePay(loan.id)} disabled={paying || !payAmount}
                        className="bg-aero text-black font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50">
                        {paying ? '…' : 'Pay'}
                      </button>
                      <button onClick={() => { setPayingId(null); setPayError(''); }}
                        className="text-gray-500 hover:text-white text-sm transition">✕</button>
                    </div>
                    {payError && <p className="text-xs text-red-400">{payError}</p>}
                  </div>
                ) : (
                  <button onClick={() => { setPayingId(loan.id); setPayAmount(''); setPayError(''); }}
                    className="text-xs border border-aero/20 text-aero hover:bg-aero/10 px-3 py-1.5 rounded-lg transition">
                    Make Payment
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Apply for loan */}
      {credit && credit.eligible && !credit.is_bankrupt && credit.available_credit > 0 && (
        <div>
          {!showApply ? (
            <button onClick={() => setShowApply(true)}
              className="bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm">
              + Apply for a Loan
            </button>
          ) : (
            <form onSubmit={handleApply} className="glass-card rounded-2xl p-5 border border-aero/20">
              <h3 className="font-bold mb-4">Loan Application</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Purpose / Label</label>
                  <input value={applyLabel} onChange={e => setApplyLabel(e.target.value)}
                    placeholder="Aircraft Purchase Loan"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Amount <span className="text-gray-600">(max {fmtMoney(credit.available_credit)})</span>
                    </label>
                    <input type="number" value={applyAmount} onChange={e => setApplyAmount(e.target.value)}
                      min={1} max={credit.available_credit} step={1000}
                      placeholder={fmtMoney(credit.available_credit)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Payment Schedule</label>
                    <select value={applySchedule} onChange={e => setApplySchedule(e.target.value as typeof applySchedule)}
                      className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition">
                      <option value="WEEKLY">Weekly</option>
                      <option value="BIWEEKLY">Bi-Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                </div>
                {/* Live preview */}
                {parsedAmount > 0 && (
                  <div className="glass-card rounded-xl p-3 flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Interest rate</span>
                      <span className="font-bold">{(credit.annual_rate * 100).toFixed(1)}% APR (fixed)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Daily interest</span>
                      <span className="text-red-400">{fmtMoney(dailyInterestPreview)}/day</span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-1.5">
                      <span className="text-gray-400">Min scheduled payment</span>
                      <span className="font-bold text-aero">calculated at approval</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Interest accrues daily on the outstanding principal. Make extra payments anytime to reduce the balance faster and stop the interest drain.
                </p>
                {applyError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{applyError}</p>}
                <div className="flex gap-3">
                  <button type="submit" disabled={applying || parsedAmount <= 0 || parsedAmount > credit.available_credit}
                    className="bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                    {applying ? 'Applying…' : `Apply for ${parsedAmount > 0 ? fmtMoney(parsedAmount) : '...'}`}
                  </button>
                  <button type="button" onClick={() => { setShowApply(false); setApplyError(''); }}
                    className="text-gray-400 hover:text-white text-sm transition">Cancel</button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Not eligible */}
      {credit && !credit.eligible && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-3xl mb-3">🏦</p>
          <p className="font-bold mb-1">Not Yet Eligible</p>
          <p className="text-sm text-gray-400 mb-4">Build your airline&apos;s track record to qualify for loans.</p>
          <div className="flex flex-col gap-1.5 text-sm max-w-xs mx-auto text-left">
            <p className={cn(credit.requirements.flights.met ? 'text-green-400' : 'text-gray-500')}>
              {credit.requirements.flights.met ? '✓' : '✗'} {credit.requirements.flights.current}/{credit.requirements.flights.required} flights completed
            </p>
            <p className={cn(credit.requirements.hours.met ? 'text-green-400' : 'text-gray-500')}>
              {credit.requirements.hours.met ? '✓' : '✗'} {credit.requirements.hours.current}/{credit.requirements.hours.required} flight hours
            </p>
            <p className={cn(credit.requirements.reputation.met ? 'text-green-400' : 'text-gray-500')}>
              {credit.requirements.reputation.met ? '✓' : '✗'} {credit.requirements.reputation.current.toFixed(1)}/{credit.requirements.reputation.required} average reputation
            </p>
          </div>
        </div>
      )}

      {/* No credit available */}
      {credit && credit.eligible && credit.available_credit <= 0 && !credit.is_bankrupt && (
        <div className="glass-card rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5">
          <p className="text-amber-300 text-sm font-medium">
            No available credit. Grow your fleet value or pay down existing debt to increase your credit limit.
          </p>
        </div>
      )}

      {/* Loan history */}
      {pastLoans.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-gray-400 mb-3">Loan History</h3>
          <div className="flex flex-col gap-2">
            {pastLoans.map(loan => (
              <div key={loan.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{loan.label}</p>
                  <p className="text-xs text-gray-500">{fmtMoney(loan.principal)} · {new Date(loan.created_at).toLocaleDateString()}</p>
                </div>
                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border',
                  loan.status === 'PAID_OFF'
                    ? 'text-green-400 border-green-500/20 bg-green-500/10'
                    : 'text-red-400 border-red-500/20 bg-red-500/10')}>
                  {loan.status === 'PAID_OFF' ? '✓ Paid Off' : loan.status === 'BANKRUPT' ? '🚨 Bankrupt' : '⚠ Defaulted'}
                </span>
              </div>
            ))}
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
  const fxRate: number = (summary as any).fx_rate ?? 1;
  const isUsd = code === 'USD' || fxRate === 1;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1">Finances</h1>
          <p className="text-gray-400 text-sm">P&L dashboard · {code}</p>
        </div>
        {!isUsd && (
          <div className="glass-card rounded-xl px-4 py-2.5 text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Today&apos;s Rate</p>
            <p className="text-sm font-bold text-white">1 USD = <span className="text-aero">{fxRate.toFixed(4)} {code}</span></p>
            <p className="text-[10px] text-gray-600">Balances stored in USD · display converted live</p>
          </div>
        )}
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
