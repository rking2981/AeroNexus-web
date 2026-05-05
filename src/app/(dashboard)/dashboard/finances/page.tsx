'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FinanceSummary {
  balance: number;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  currency: { code: string; symbol: string };
}

interface Transaction {
  id: string;
  amount: number;
  expense_type: string | null;
  description: string | null;
  created_at: string;
  flight?: {
    route?: {
      origin: { icao: string };
      destination: { icao: string };
    };
  } | null;
}

function StatCard({ label, value, symbol, positive }: {
  label: string; value: number; symbol: string; positive?: boolean;
}) {
  const isPositive = positive !== undefined ? positive : value >= 0;
  return (
    <div className="glass-card rounded-2xl p-6">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={cn('text-2xl font-bold', isPositive ? 'text-green-400' : 'text-red-400')}>
        {symbol}{Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

const EXPENSE_ICONS: Record<string, string> = {
  FUEL: '⛽', LANDING_FEE: '🛬', PILOT_PAY: '👨‍✈️', CATERING: '🍽️',
  PASSENGER_SERVICES: '🎫', COMPENSATION: '💸', MAINTENANCE: '🔧',
  GATE_SLOT: '🚪', INSURANCE: '🛡️', STAFF_OVERHEAD: '👥',
  AIRCRAFT_LEASE: '✈️',
};

export default function FinancesPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    Promise.all([
      api.get('/airline/finances'),
      api.get(`/airline/finances/transactions?limit=${limit}`),
    ]).then(([s, t]) => {
      setSummary(s.data);
      setTransactions(t.data.transactions);
    }).finally(() => setLoading(false));
  }, [limit]);

  if (loading) return (
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Finances</h1>
        <p className="text-gray-400 text-sm">P&L dashboard · {code}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass-card rounded-2xl p-6 md:col-span-1">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Balance</p>
          <p className="text-2xl font-bold text-aero">
            {symbol}{summary.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <StatCard label="Total Revenue" value={summary.total_revenue} symbol={symbol} positive={true} />
        <StatCard label="Total Expenses" value={summary.total_expenses} symbol={symbol} positive={false} />
        <StatCard label="Net Profit" value={summary.net_profit} symbol={symbol} />
      </div>

      {/* Transactions */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold">Recent Transactions</h2>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition"
          >
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>Last {n}</option>)}
          </select>
        </div>

        {transactions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No transactions yet</p>
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
                      {tx.description ?? tx.expense_type?.replace('_', ' ') ?? 'Transaction'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {route ? `${route.origin.icao} → ${route.destination.icao} · ` : ''}
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className={cn('font-mono font-bold text-sm flex-shrink-0',
                    isCredit ? 'text-green-400' : 'text-red-400')}>
                    {isCredit ? '+' : '-'}{symbol}{Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
