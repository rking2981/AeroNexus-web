'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FinanceSummary {
  balance: number;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
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
  AIRCRAFT_LEASE: '✈️', ESCROW_FREEZE: '🔒', ESCROW_RELEASE: '🔓',
};

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

export default function FinancesPage() {
  const now = new Date();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
        <StatCard label={`Revenue${filterMode !== 'all' ? ` (${filterLabel()})` : ''}`} value={summary.total_revenue} symbol={symbol} color="green" />
        <StatCard label={`Expenses${filterMode !== 'all' ? ` (${filterLabel()})` : ''}`} value={summary.total_expenses} symbol={symbol} color="red" />
        <StatCard label="Net Profit" value={summary.net_profit} symbol={symbol} color="auto" />
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
                  <p className={cn('font-mono font-bold text-sm flex-shrink-0',
                    isCredit ? 'text-green-400' : 'text-red-400')}>
                    {isCredit ? '+' : '-'}{fmt(tx.amount, symbol)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
