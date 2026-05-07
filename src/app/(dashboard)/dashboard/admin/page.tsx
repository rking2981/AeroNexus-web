'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalUsers: number;
  totalAirlines: number;
  completedFlights: number;
  totalAirports: number;
}

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  pilot_tier: string;
  is_banned: boolean;
  airline_id: string | null;
  reputation: number;
  created_at: string;
}

interface AdminAirline {
  id: string;
  name: string;
  icao_code: string;
  subscription_tier: string;
  subscription_status: string;
  balance: string;
  created_at: string;
  _count: { users: number; hulls: number; flights: number };
}

interface FuelHub {
  id: string;
  name: string;
  icao: string;
  region: string;
  base_price: string;
}

interface WebsiteOrder {
  id: string;
  name: string;
  icao_code: string;
  website_slug: string | null;
  website_enabled: boolean;
  website_setup_paid: boolean;
  website_hosting_expires: string | null;
  subscription_tier: string;
}

// ─── Shared components ────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray' }) {
  const styles = {
    green:  'text-green-400 border-green-500/20 bg-green-500/10',
    red:    'text-red-400 border-red-500/20 bg-red-500/10',
    amber:  'text-amber-400 border-amber-500/20 bg-amber-500/10',
    blue:   'text-blue-400 border-blue-500/20 bg-blue-500/10',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    gray:   'text-gray-400 border-white/10 bg-white/5',
  };
  return <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', styles[color])}>{label}</span>;
}

function tierColor(tier: string): 'purple' | 'blue' | 'gray' {
  if (tier === 'FOUNDERS') return 'purple';
  if (tier === 'ENTERPRISE') return 'blue';
  return 'gray';
}

function statusColor(status: string): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'ACTIVE') return 'green';
  if (status === 'TRIALING') return 'amber';
  if (status === 'PAST_DUE') return 'amber';
  if (status === 'CANCELED') return 'red';
  return 'gray';
}

// ─── Tab: Platform Stats ──────────────────────────────────────────────────────

function StatsTab() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  useEffect(() => { api.get('/admin/stats').then(r => setStats(r.data)); }, []);

  if (!stats) return <div className="glass-card rounded-2xl h-40 animate-pulse" />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: '👤' },
        { label: 'Total Airlines', value: stats.totalAirlines.toLocaleString(), icon: '🏢' },
        { label: 'Completed Flights', value: stats.completedFlights.toLocaleString(), icon: '✈️' },
        { label: 'Airports Seeded', value: stats.totalAirports.toLocaleString(), icon: '🌍' },
      ].map(s => (
        <div key={s.label} className="glass-card rounded-2xl p-6 text-center">
          <p className="text-3xl mb-2">{s.icon}</p>
          <p className="text-2xl font-bold text-aero">{s.value}</p>
          <p className="text-xs text-gray-500 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [data, setData] = useState<{ users: AdminUser[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 50;

  const fetch = useCallback(async () => {
    const r = await api.get(`/admin/users?page=${page}&limit=${limit}`);
    setData(r.data);
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  async function toggleBan(user: AdminUser) {
    setActionLoading(user.id);
    try {
      await api.patch(`/admin/users/${user.id}/${user.is_banned ? 'unban' : 'ban'}`);
      setData(d => d ? { ...d, users: d.users.map(u => u.id === user.id ? { ...u, is_banned: !u.is_banned } : u) } : d);
    } finally { setActionLoading(null); }
  }

  async function setTier(user: AdminUser, tier: 'FREE_ADS' | 'PRO_SUB') {
    setActionLoading(user.id);
    try {
      await api.patch(`/admin/users/${user.id}/tier`, { tier });
      setData(d => d ? { ...d, users: d.users.map(u => u.id === user.id ? { ...u, pilot_tier: tier } : u) } : d);
    } finally { setActionLoading(null); }
  }

  async function setRole(user: AdminUser, role: 'PILOT' | 'VA_MANAGER' | 'PLATFORM_ADMIN') {
    if (!confirm(`Set ${user.display_name} to ${role}?`)) return;
    setActionLoading(user.id);
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role });
      setData(d => d ? { ...d, users: d.users.map(u => u.id === user.id ? { ...u, role } : u) } : d);
    } finally { setActionLoading(null); }
  }

  const filtered = data?.users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.display_name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
        <span className="text-xs text-gray-500">{data?.total.toLocaleString()} total users</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid px-4 py-2.5 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest"
          style={{ gridTemplateColumns: '1fr 160px 80px 80px 120px 180px' }}>
          <span>User</span><span>Role</span><span>Tier</span><span>Rep</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        {filtered.map(u => (
          <div key={u.id} className="grid px-4 py-3 border-b border-white/5 last:border-0 items-center gap-2"
            style={{ gridTemplateColumns: '1fr 160px 80px 80px 120px 180px' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{u.display_name}</p>
              <p className="text-xs text-gray-500 truncate">{u.email}</p>
            </div>
            {/* Role — dropdown for admins */}
            <select
              value={u.role}
              onChange={e => setRole(u, e.target.value as 'PILOT' | 'VA_MANAGER' | 'PLATFORM_ADMIN')}
              disabled={actionLoading === u.id}
              className={cn(
                'text-xs rounded-lg border px-2 py-1 focus:outline-none transition disabled:opacity-40',
                u.role === 'PLATFORM_ADMIN' ? 'border-purple-500/30 bg-purple-500/10 text-purple-400' :
                u.role === 'VA_MANAGER'     ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' :
                                              'border-white/10 bg-white/5 text-gray-400',
              )}
            >
              <option value="PILOT">Pilot</option>
              <option value="VA_MANAGER">VA Manager</option>
              <option value="PLATFORM_ADMIN">Platform Admin</option>
            </select>
            <Badge label={u.pilot_tier === 'PRO_SUB' ? 'PRO' : 'FREE'} color={u.pilot_tier === 'PRO_SUB' ? 'amber' : 'gray'} />
            <span className="text-sm font-mono text-gray-300">{Number(u.reputation).toFixed(1)}</span>
            <Badge label={u.is_banned ? 'BANNED' : 'ACTIVE'} color={u.is_banned ? 'red' : 'green'} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setTier(u, u.pilot_tier === 'PRO_SUB' ? 'FREE_ADS' : 'PRO_SUB')}
                disabled={actionLoading === u.id}
                className="text-xs border border-white/10 px-2 py-1 rounded-lg hover:bg-white/5 transition disabled:opacity-40">
                {u.pilot_tier === 'PRO_SUB' ? '→ Free' : '→ Pro'}
              </button>
              <button onClick={() => toggleBan(u)} disabled={actionLoading === u.id}
                className={cn('text-xs px-2 py-1 rounded-lg border transition disabled:opacity-40',
                  u.is_banned ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10')}>
                {actionLoading === u.id ? '…' : u.is_banned ? 'Unban' : 'Ban'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {data && data.total > limit && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-xs border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition disabled:opacity-40">← Prev</button>
          <span className="text-xs text-gray-500">Page {page} of {Math.ceil(data.total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / limit)}
            className="text-xs border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Airlines ────────────────────────────────────────────────────────────

function AirlinesTab() {
  const [data, setData] = useState<{ airlines: AdminAirline[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 50;

  const fetch = useCallback(async () => {
    const r = await api.get(`/admin/airlines?page=${page}&limit=${limit}`);
    setData(r.data);
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  async function setTier(airline: AdminAirline, tier: 'STARTUP' | 'ENTERPRISE') {
    setActionLoading(airline.id);
    try {
      await api.patch(`/admin/airlines/${airline.id}/tier`, { tier });
      setData(d => d ? { ...d, airlines: d.airlines.map(a => a.id === airline.id ? { ...a, subscription_tier: tier } : a) } : d);
    } finally { setActionLoading(null); }
  }

  async function setStatus(airline: AdminAirline, status: 'ACTIVE' | 'CANCELED') {
    setActionLoading(airline.id);
    try {
      await api.patch(`/admin/airlines/${airline.id}/status`, { status });
      setData(d => d ? { ...d, airlines: d.airlines.map(a => a.id === airline.id ? { ...a, subscription_status: status } : a) } : d);
    } finally { setActionLoading(null); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{data?.total.toLocaleString()} airlines</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid px-4 py-2.5 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest"
          style={{ gridTemplateColumns: '80px 1fr 100px 120px 80px 80px 80px 160px' }}>
          <span>ICAO</span><span>Name</span><span>Tier</span><span>Status</span>
          <span className="text-right">Pilots</span><span className="text-right">Fleet</span><span className="text-right">Flights</span>
          <span className="text-right">Actions</span>
        </div>
        {(data?.airlines ?? []).map(a => (
          <div key={a.id} className="grid px-4 py-3 border-b border-white/5 last:border-0 items-center gap-2"
            style={{ gridTemplateColumns: '80px 1fr 100px 120px 80px 80px 80px 160px' }}>
            <span className="font-mono font-bold text-aero text-sm">{a.icao_code}</span>
            <span className="text-sm text-white truncate">{a.name}</span>
            <Badge label={a.subscription_tier} color={tierColor(a.subscription_tier)} />
            <Badge label={a.subscription_status} color={statusColor(a.subscription_status)} />
            <span className="text-right text-sm font-mono text-gray-300">{a._count.users}</span>
            <span className="text-right text-sm font-mono text-gray-300">{a._count.hulls}</span>
            <span className="text-right text-sm font-mono text-gray-300">{a._count.flights}</span>
            <div className="flex gap-2 justify-end">
              <select value={a.subscription_tier}
                onChange={e => setTier(a, e.target.value as 'STARTUP' | 'ENTERPRISE')}
                disabled={actionLoading === a.id || a.subscription_tier === 'FOUNDERS'}
                className="text-xs rounded-lg border border-white/10 bg-[#111] px-2 py-1 text-white focus:border-aero focus:outline-none disabled:opacity-40">
                <option value="STARTUP">Startup</option>
                <option value="ENTERPRISE">Enterprise</option>
                {a.subscription_tier === 'FOUNDERS' && <option value="FOUNDERS">Founders</option>}
              </select>
              <button onClick={() => setStatus(a, a.subscription_status === 'ACTIVE' ? 'CANCELED' : 'ACTIVE')}
                disabled={actionLoading === a.id}
                className={cn('text-xs px-2 py-1 rounded-lg border transition disabled:opacity-40',
                  a.subscription_status === 'ACTIVE'
                    ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : 'border-green-500/30 text-green-400 hover:bg-green-500/10')}>
                {a.subscription_status === 'ACTIVE' ? 'Cancel' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {data && data.total > limit && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-xs border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition disabled:opacity-40">← Prev</button>
          <span className="text-xs text-gray-500">Page {page} of {Math.ceil(data.total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / limit)}
            className="text-xs border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Fuel Hubs ───────────────────────────────────────────────────────────

function FuelHubsTab() {
  const [hubs, setHubs] = useState<FuelHub[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/fuel-hubs').then(r => {
      setHubs(r.data);
      const p: Record<string, string> = {};
      r.data.forEach((h: FuelHub) => { p[h.id] = Number(h.base_price).toFixed(4); });
      setPrices(p);
    });
  }, []);

  async function savePrice(hub: FuelHub) {
    setSaving(hub.id);
    try {
      await api.patch(`/admin/fuel-hubs/${hub.id}/price`, { base_price: parseFloat(prices[hub.id]) });
      setSaved(hub.id);
      setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-400">Adjust base fuel prices per global distribution hub. Changes take effect on next hourly fuel price recalculation.</p>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid px-4 py-2.5 border-b border-white/5 text-xs text-gray-500 uppercase tracking-widest"
          style={{ gridTemplateColumns: '80px 1fr 120px 150px 80px' }}>
          <span>ICAO</span><span>Hub</span><span>Region</span><span>Base Price ($/unit)</span><span />
        </div>
        {hubs.map(hub => (
          <div key={hub.id} className="grid px-4 py-3 border-b border-white/5 last:border-0 items-center gap-3"
            style={{ gridTemplateColumns: '80px 1fr 120px 150px 80px' }}>
            <span className="font-mono font-bold text-aero text-sm">{hub.icao}</span>
            <span className="text-sm text-white">{hub.name}</span>
            <span className="text-xs text-gray-400">{hub.region}</span>
            <input type="number" step="0.01" min="0" value={prices[hub.id] ?? ''}
              onChange={e => setPrices({ ...prices, [hub.id]: e.target.value })}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white font-mono focus:border-aero focus:outline-none transition" />
            <button onClick={() => savePrice(hub)} disabled={saving === hub.id}
              className={cn('text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50',
                saved === hub.id ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-aero/20 text-aero border border-aero/30 hover:bg-aero/30')}>
              {saving === hub.id ? '…' : saved === hub.id ? '✓' : 'Save'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Fuel Events ─────────────────────────────────────────────────────────

function FuelEventsTab() {
  const [country, setCountry] = useState('');
  const [multiplier, setMultiplier] = useState('3.0');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');

  async function applyEvent() {
    if (!country) return;
    setSaving(true); setResult('');
    try {
      const { data } = await api.patch(`/admin/regions/${country.toUpperCase()}/event-multiplier`, {
        multiplier: parseFloat(multiplier),
      });
      setResult(`✓ Updated ${data.updated} airports in ${data.country} → ${data.multiplier}×`);
    } catch {
      setResult('Failed to apply event multiplier.');
    } finally { setSaving(false); }
  }

  async function resetCountry() {
    if (!country) return;
    setSaving(true); setResult('');
    try {
      const { data } = await api.patch(`/admin/regions/${country.toUpperCase()}/event-multiplier`, { multiplier: 1.0 });
      setResult(`✓ Reset ${data.updated} airports in ${data.country} to 1.0×`);
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <div>
        <h3 className="font-bold mb-1">Fuel Crisis / Event Multiplier</h3>
        <p className="text-sm text-gray-400">Apply a regional fuel price multiplier — e.g. set 3.0× during a simulated fuel crisis. This scales the event_multiplier on all airports in a country.</p>
      </div>

      <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Country Code (ISO)</label>
            <input value={country} onChange={e => setCountry(e.target.value.toUpperCase())}
              placeholder="US, GB, AU…" maxLength={2}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white font-mono focus:border-aero focus:outline-none transition" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Multiplier</label>
            <input type="number" step="0.1" min="0.1" max="10" value={multiplier}
              onChange={e => setMultiplier(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white font-mono focus:border-aero focus:outline-none transition" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
          {[['Normal', '1.0'], ['Shortage', '1.5'], ['Crisis', '3.0'], ['Severe', '5.0']].map(([label, val]) => (
            <button key={val} onClick={() => setMultiplier(val)}
              className={cn('px-2.5 py-1 rounded-lg border transition',
                multiplier === val ? 'border-aero/40 bg-aero/10 text-aero' : 'border-white/10 hover:bg-white/5')}>
              {label} ({val}×)
            </button>
          ))}
        </div>

        {result && <p className={cn('text-sm', result.startsWith('✓') ? 'text-green-400' : 'text-red-400')}>{result}</p>}

        <div className="flex gap-3">
          <button onClick={applyEvent} disabled={saving || !country}
            className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
            {saving ? 'Applying…' : 'Apply to Region'}
          </button>
          <button onClick={resetCountry} disabled={saving || !country}
            className="border border-white/20 text-sm px-5 py-2.5 rounded-xl hover:bg-white/5 transition disabled:opacity-40">
            Reset to 1.0×
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: VA Websites ─────────────────────────────────────────────────────────

function WebsitesTab() {
  const [orders, setOrders] = useState<WebsiteOrder[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [slugInputs, setSlugInputs] = useState<Record<string, string>>({});

  useEffect(() => { api.get('/admin/websites').then(r => setOrders(r.data)); }, []);

  async function enable(order: WebsiteOrder) {
    setActionLoading(order.id);
    try {
      const { data } = await api.post(`/admin/websites/${order.id}/enable`, { slug: slugInputs[order.id] || undefined });
      setOrders(orders.map(o => o.id === order.id ? { ...o, website_enabled: true, website_slug: data.website_slug, website_hosting_expires: data.website_hosting_expires } : o));
    } finally { setActionLoading(null); }
  }

  async function disable(order: WebsiteOrder) {
    setActionLoading(order.id);
    try {
      await api.post(`/admin/websites/${order.id}/disable`);
      setOrders(orders.map(o => o.id === order.id ? { ...o, website_enabled: false } : o));
    } finally { setActionLoading(null); }
  }

  if (orders.length === 0) return (
    <div className="glass-card rounded-2xl p-12 text-center">
      <p className="text-4xl mb-3">🌐</p>
      <p className="text-gray-400 text-sm">No VA website orders yet.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {orders.map(order => (
        <div key={order.id} className="glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-bold text-aero">{order.icao_code}</span>
              <span className="text-sm text-white">{order.name}</span>
              <Badge label={order.subscription_tier} color={tierColor(order.subscription_tier)} />
              <Badge label={order.website_enabled ? 'LIVE' : 'PENDING'} color={order.website_enabled ? 'green' : 'amber'} />
            </div>
            {order.website_enabled && order.website_slug && (
              <p className="text-xs text-gray-400 font-mono">
                {order.website_slug}.aeronexus.app
                {order.website_hosting_expires && ` · expires ${new Date(order.website_hosting_expires).toLocaleDateString()}`}
              </p>
            )}
          </div>

          {!order.website_enabled && (
            <input value={slugInputs[order.id] ?? ''}
              onChange={e => setSlugInputs({ ...slugInputs, [order.id]: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              placeholder={`${order.icao_code.toLowerCase()} (slug)`}
              className="w-40 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white font-mono focus:border-aero focus:outline-none" />
          )}

          <button
            onClick={() => order.website_enabled ? disable(order) : enable(order)}
            disabled={actionLoading === order.id}
            className={cn('flex-shrink-0 text-xs font-bold px-4 py-2 rounded-xl border transition disabled:opacity-50',
              order.website_enabled
                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                : 'bg-aero text-black border-aero hover:brightness-110')}>
            {actionLoading === order.id ? '…' : order.website_enabled ? 'Disable Site' : 'Enable Site'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

type Tab = 'stats' | 'users' | 'airlines' | 'fuel' | 'events' | 'websites';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'stats',    label: 'Overview',    icon: '📊' },
  { key: 'users',    label: 'Users',       icon: '👤' },
  { key: 'airlines', label: 'Airlines',    icon: '🏢' },
  { key: 'fuel',     label: 'Fuel Hubs',   icon: '⛽' },
  { key: 'events',   label: 'Fuel Events', icon: '⚡' },
  { key: 'websites', label: 'VA Websites', icon: '🌐' },
];

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stats');

  useEffect(() => {
    if (user && user.role !== 'PLATFORM_ADMIN') router.replace('/dashboard');
  }, [user, router]);

  if (!user || user.role !== 'PLATFORM_ADMIN') return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-lg">🛡️</div>
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-gray-400 text-sm">Platform Administration · {user.display_name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 glass-card rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'stats'    && <StatsTab />}
      {tab === 'users'    && <UsersTab />}
      {tab === 'airlines' && <AirlinesTab />}
      {tab === 'fuel'     && <FuelHubsTab />}
      {tab === 'events'   && <FuelEventsTab />}
      {tab === 'websites' && <WebsitesTab />}
    </div>
  );
}
