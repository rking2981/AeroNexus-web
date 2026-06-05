'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

interface Charts {
  daily_revenue: Record<string, number>;
  cargo_by_type: { type: string; revenue: number; count: number }[];
  top_routes: { route: string; flights: number }[];
}

const CARGO_COLORS = ['#00D1FF', '#818cf8', '#34d399', '#fbbf24', '#f97316', '#e879f9'];
const ROUTE_COLORS = ['#00D1FF', '#60a5fa', '#34d399', '#fbbf24', '#f97316'];

function formatK(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v}`;
}

export default function RechartsCharts({ charts, currencySymbol }: { charts: Charts; currencySymbol: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1,2,3].map(i => <div key={i} className="glass-card rounded-2xl h-48 animate-pulse" />)}
    </div>
  );
  // Build daily revenue array — last 14 days
  const revenueData = Object.entries(charts.daily_revenue)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([day, revenue]) => ({ day: day.slice(5), revenue }));

  // Cargo pie data
  const cargoPieData = charts.cargo_by_type.map(c => ({
    name: c.type,
    value: Math.round(c.revenue),
  }));

  // Top routes pie data
  const routesPieData = charts.top_routes.map(r => ({
    name: r.route,
    value: r.flights,
  }));

  const hasRevenue = revenueData.some(d => d.revenue > 0);
  const hasCargo = cargoPieData.length > 0;
  const hasRoutes = routesPieData.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Revenue bar chart */}
      <div className="glass-card rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Revenue — Last 14 Days</p>
        {hasRevenue ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
              <YAxis hide tickFormatter={formatK} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatK(Number(v ?? 0)), 'Revenue']}
                labelStyle={{ color: '#9ca3af' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={24}>
                {revenueData.map((_, i) => (
                  <Cell key={i} fill="#00D1FF" fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-600 text-xs">No revenue data yet</div>
        )}
      </div>

      {/* Top routes pie */}
      <div className="glass-card rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Top Routes (30 days)</p>
        {hasRoutes ? (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={routesPieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {routesPieData.map((_, i) => (
                  <Cell key={i} fill={ROUTE_COLORS[i % ROUTE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [Number(v ?? 0), 'Flights']}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 10, color: '#9ca3af' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-600 text-xs">No route data yet</div>
        )}
      </div>

      {/* Cargo revenue pie */}
      <div className="glass-card rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Cargo Revenue (30 days)</p>
        {hasCargo ? (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={cargoPieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {cargoPieData.map((_, i) => (
                  <Cell key={i} fill={CARGO_COLORS[i % CARGO_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatK(Number(v ?? 0)), 'Revenue']}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 10, color: '#9ca3af' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-600 text-xs">No cargo data yet</div>
        )}
      </div>
    </div>
  );
}
