'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { api, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface ProfileData {
  user: {
    id: string;
    display_name: string;
    first_name: string | null;
    surname: string | null;
    display_preference: string;
    email: string;
    role: string;
    pilot_tier: string;
    is_founder: boolean;
    reputation: number;
    xp_points: number;
    certifications: string[];
    va_rank: string | null;
    auto_rank: string;
    effective_rank: string;
    home_airport_icao: string | null;
    current_airport_icao: string | null;
    personal_balance: number;
    avatar_url: string | null;
    created_at: string;
    airline: {
      name: string;
      icao_code: string;
      currency_code: string;
      currency_symbol: string;
      subscription_tier: string;
    } | null;
  };
  stats: {
    total_flights: number;
    total_hours: number;
    avg_pax_happiness: number | null;
    avg_landing_vs: number | null;
  };
  recent_flights: {
    id: string;
    pax_count: number;
    pax_happiness: number;
    landing_vs_fpm: number | null;
    block_time_min: number | null;
    departed_at: string | null;
    arrived_at: string | null;
    route: {
      distance_nm: number;
      base_ticket_price: number;
      origin: { icao: string; name: string };
      destination: { icao: string; name: string };
    };
    hull: { registration: string; aircraft_type: string; aircraft_category: string };
    transactions: { amount: number }[];
  }[];
  rating_history: {
    arrived_at: string;
    pax_happiness: number;
    landing_vs_fpm: number | null;
  }[];
}

const RANK_COLORS: Record<string, string> = {
  'Student Pilot':    'text-gray-400',
  'Private Pilot':    'text-blue-400',
  'Commercial Pilot': 'text-green-400',
  'First Officer':    'text-cyan-400',
  'Captain':          'text-aero',
  'Senior Captain':   'text-amber-400',
  'Chief Pilot':      'text-purple-400',
};

function RatingColor(value: number, type: 'happiness' | 'vs') {
  if (type === 'happiness') {
    if (value >= 85) return 'text-green-400';
    if (value >= 70) return 'text-amber-400';
    return 'text-red-400';
  }
  const abs = Math.abs(value);
  if (abs <= 200) return 'text-green-400';
  if (abs <= 400) return 'text-amber-400';
  return 'text-red-400';
}

// Simple SVG line chart
function RatingGraph({ data }: { data: ProfileData['rating_history'] }) {
  if (data.length < 2) return (
    <div className="h-32 flex items-center justify-center text-gray-500 text-sm">
      Complete more flights to see your rating trend
    </div>
  );

  const values = data.map((d) => Number(d.pax_happiness));
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const range = max - min || 1;
  const w = 600; const h = 120; const pad = 20;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00D1FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00D1FF" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = h - pad - (pct / 100) * (h - pad * 2);
          return (
            <g key={pct}>
              <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={pad - 4} y={y + 4} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">{pct}</text>
            </g>
          );
        })}
        {/* Line */}
        <polyline points={points} fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeLinejoin="round" />
        {/* Dots */}
        {values.map((v, i) => {
          const x = pad + (i / (values.length - 1)) * (w - pad * 2);
          const y = h - pad - ((v - min) / range) * (h - pad * 2);
          const color = v >= 85 ? '#4ade80' : v >= 70 ? '#fbbf24' : '#f87171';
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-gray-600 mt-1 px-5">
        <span>{new Date(data[0].arrived_at).toLocaleDateString()}</span>
        <span>PAX Happiness %</span>
        <span>{new Date(data[data.length - 1].arrived_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user: storeUser, setUser } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'finances'>('overview');

  // Change password state
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('New passwords do not match.'); return;
    }
    if (pwForm.new_password.length < 8) {
      setPwError('New password must be at least 8 characters.'); return;
    }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwSuccess('Password changed successfully.');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? 'Failed to change password. Check your current password.');
    } finally { setPwSaving(false); }
  }

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', surname: '', display_preference: 'DISPLAY_NAME', home_airport_icao: '', avatar_url: '' });
  const [homeSearch, setHomeSearch] = useState('');
  const [homeResults, setHomeResults] = useState<{ id: string; icao: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/pilots/profile/me').then((r) => {
      setProfile(r.data);
      const u = r.data.user;
      setEditForm({
        first_name: u.first_name ?? '',
        surname: u.surname ?? '',
        display_preference: u.display_preference ?? 'DISPLAY_NAME',
        home_airport_icao: u.home_airport_icao ?? '',
        avatar_url: u.avatar_url ?? '',
      });
    }).finally(() => setLoading(false));
  }, []);

  const searchAirports = useCallback(async (q: string) => {
    if (q.length < 2) { setHomeResults([]); return; }
    const { data } = await publicApi.get(`/network/airports/search?q=${encodeURIComponent(q)}`);
    setHomeResults(data);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await api.patch('/pilots/profile/me', {
        first_name: editForm.first_name || undefined,
        surname: editForm.surname || undefined,
        display_preference: editForm.display_preference,
        home_airport_icao: editForm.home_airport_icao || undefined,
        avatar_url: editForm.avatar_url || null,
      });
      setProfile((p) => p ? { ...p, user: { ...p.user, ...data } } : p);
      // Refresh store
      const { data: me } = await api.post('/auth/me');
      setUser(me);
      setEditing(false);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-96 animate-pulse" /></div>;
  if (!profile) return null;

  const { user: u, stats, recent_flights, rating_history } = profile;
  const currency = u.airline?.currency_symbol ?? '$';

  const displayedName = u.display_preference === 'FIRST_LAST' && u.first_name
    ? `${u.first_name} ${u.surname ?? ''}`.trim()
    : u.display_preference === 'FIRST_ONLY' && u.first_name
    ? u.first_name
    : u.display_name;

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header card */}
      <div className="glass-card rounded-2xl p-6 mb-6 relative overflow-hidden">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className={cn(
            'w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl font-bold',
            u.is_founder ? 'bg-purple-500/20 ring-2 ring-purple-500/50' : 'bg-aero/20 ring-2 ring-aero/30'
          )}>
            {u.avatar_url
              ? <Image src={u.avatar_url} alt="Avatar" width={64} height={64} className="w-full h-full object-cover" />
              : <span>{displayedName[0]?.toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold">{displayedName}</h1>
              {u.is_founder && (
                <>
                  <span className="text-xs text-purple-400 border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 rounded-full font-bold">
                    Founder
                  </span>
                  <Image src="/badges/founders-badge.png" alt="Founder's Pass" width={28} height={28} className="opacity-90" />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
              <span className={cn('font-bold', RANK_COLORS[u.effective_rank] ?? 'text-gray-400')}>
                {u.effective_rank}
              </span>
              {u.airline && (
                <span>
                  {u.airline.name} <span className="font-mono text-xs">({u.airline.icao_code})</span>
                </span>
              )}
              <span className="text-aero">Rep {Number(u.reputation).toFixed(1)}</span>
              <span>{u.xp_points.toLocaleString()} XP</span>
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/5 transition flex-shrink-0"
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Home Airport', value: u.home_airport_icao ?? 'Not set', mono: true },
            { label: 'Current Location', value: u.current_airport_icao ?? 'Unknown', mono: true },
            { label: 'Personal Balance', value: `${currency}${Number(u.personal_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            { label: 'Member Since', value: new Date(u.created_at).toLocaleDateString() },
          ].map((item) => (
            <div key={item.label} className="glass-card rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className={cn('text-sm font-medium', item.mono && 'font-mono text-aero')}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="glass-card rounded-2xl p-6 mb-6 border border-aero/20">
          <h3 className="font-bold mb-4">Edit Profile</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-gray-300 block mb-1.5">First Name</label>
              <input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                placeholder="Ryan" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition" />
            </div>
            <div>
              <label className="text-sm text-gray-300 block mb-1.5">Surname</label>
              <input value={editForm.surname} onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })}
                placeholder="King" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition" />
            </div>
          </div>
          {/* Avatar URL */}
          <div className="mb-4">
            <label className="text-sm text-gray-300 block mb-1.5">Profile Picture URL</label>
            <input value={editForm.avatar_url}
              onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
              placeholder="https://example.com/photo.jpg"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition" />
            {editForm.avatar_url && (
              <div className="flex items-center gap-3 mt-2">
                <img src={editForm.avatar_url} alt="Preview"
                  className="w-10 h-10 rounded-xl object-cover border border-white/10"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="text-xs text-gray-500">Preview</span>
                <button type="button" onClick={() => setEditForm({ ...editForm, avatar_url: '' })}
                  className="text-xs text-red-400 hover:text-red-300 transition">Remove</button>
              </div>
            )}
            <div className="mt-2 rounded-xl border border-white/5 bg-white/3 px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] text-gray-500 font-medium mb-0.5">Where to get an image URL:</p>
              <p className="text-[11px] text-gray-600">• <span className="text-gray-400">Gravatar</span> — gravatar.com · links to your email&apos;s avatar automatically</p>
              <p className="text-[11px] text-gray-600">• <span className="text-gray-400">imgur</span> — imgur.com · free image hosting, right-click → copy image address</p>
              <p className="text-[11px] text-gray-600">• <span className="text-gray-400">Discord</span> — right-click your avatar → Copy Image Address</p>
              <p className="text-[11px] text-gray-600">• Any direct public image URL ending in .jpg, .png, or .webp</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm text-gray-300 block mb-1.5">Display Name Preference</label>
            <select value={editForm.display_preference} onChange={(e) => setEditForm({ ...editForm, display_preference: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition">
              <option value="DISPLAY_NAME">Display Name ({u.display_name})</option>
              <option value="FIRST_LAST">First & Last ({editForm.first_name || 'First'} {editForm.surname || 'Last'})</option>
              <option value="FIRST_ONLY">First Only ({editForm.first_name || 'First'})</option>
            </select>
          </div>
          <div className="mb-5 relative">
            <label className="text-sm text-gray-300 block mb-1.5">Home Airport</label>
            <input value={homeSearch || editForm.home_airport_icao}
              onChange={(e) => { setHomeSearch(e.target.value); setEditForm({ ...editForm, home_airport_icao: e.target.value }); searchAirports(e.target.value); }}
              placeholder="KSEA or airport name..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition" />
            {homeResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-xl">
                {homeResults.map((a) => (
                  <button key={a.id} type="button"
                    onClick={() => { setEditForm({ ...editForm, home_airport_icao: a.icao }); setHomeSearch(''); setHomeResults([]); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0">
                    <span className="font-mono text-xs text-aero w-12">{a.icao}</span>
                    <span className="text-xs text-white truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={saving}
            className="bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Change Password — inside Edit Profile */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <h3 className="font-bold mb-1 text-sm">Change Password</h3>
            <p className="text-xs text-gray-500 mb-4">Enter your current password to set a new one.</p>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              <input type="password" value={pwForm.current_password}
                onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                required autoComplete="current-password" placeholder="Current password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition" />
              <input type="password" value={pwForm.new_password}
                onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                required autoComplete="new-password" placeholder="New password (min 8 characters)"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition" />
              <input type="password" value={pwForm.confirm_password}
                onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                required autoComplete="new-password" placeholder="Confirm new password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[#00D1FF] focus:outline-none transition" />
              {pwError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{pwError}</p>}
              {pwSuccess && <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">{pwSuccess}</p>}
              <button type="submit" disabled={pwSaving}
                className="border border-white/20 text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-white/5 transition disabled:opacity-50 w-fit">
                {pwSaving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {[{ key: 'overview', label: 'Overview' }, { key: 'finances', label: 'Pilot Finances' }].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              activeTab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Flights', value: stats.total_flights.toLocaleString(), icon: '✈️' },
              { label: 'Flight Hours', value: `${stats.total_hours.toFixed(1)} hrs`, icon: '⏱️' },
              { label: 'Avg PAX Happiness', value: stats.avg_pax_happiness ? `${Number(stats.avg_pax_happiness).toFixed(0)}%` : '—', icon: '😊' },
              { label: 'Avg Landing VS', value: stats.avg_landing_vs ? `${Math.round(Number(stats.avg_landing_vs))} fpm` : '—', icon: '🛬' },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-2xl p-5">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className="text-xl font-bold text-aero">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Flight Rating Graph */}
          <div className="glass-card rounded-2xl p-6 mb-6">
            <h2 className="font-bold mb-1">Flight Activity</h2>
            <p className="text-xs text-gray-500 mb-4">PAX Happiness % — last {rating_history.length} flights</p>
            <RatingGraph data={rating_history} />
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> ≥85% Excellent</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 70–84% Good</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;70% Needs improvement</span>
            </div>
          </div>

          {/* Last 5 flights */}
          <div className="glass-card rounded-2xl p-6 mb-6">
            <h2 className="font-bold mb-4">Last 5 Flights</h2>
            {recent_flights.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No completed flights yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-white/5">
                      <th className="text-left py-2 pr-4">From → To</th>
                      <th className="text-left py-2 pr-4">Arrival</th>
                      <th className="text-right py-2 pr-4">PAX</th>
                      <th className="text-left py-2 pr-4">Aircraft</th>
                      <th className="text-right py-2 pr-4">Distance</th>
                      <th className="text-right py-2 pr-4">Rating</th>
                      <th className="text-right py-2">Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_flights.map((f) => {
                      const salary = f.transactions[0]?.amount ?? 0;
                      return (
                        <tr key={f.id} className="border-b border-white/5 last:border-0">
                          <td className="py-3 pr-4">
                            <span className="font-mono text-aero">{f.route.origin.icao}</span>
                            <span className="text-gray-500 mx-1">→</span>
                            <span className="font-mono text-aero">{f.route.destination.icao}</span>
                          </td>
                          <td className="py-3 pr-4 text-gray-400 text-xs">
                            {f.arrived_at ? new Date(f.arrived_at).toLocaleString() : '—'}
                          </td>
                          <td className="py-3 pr-4 text-right">{f.pax_count}</td>
                          <td className="py-3 pr-4 text-gray-400 text-xs font-mono">{f.hull.registration}</td>
                          <td className="py-3 pr-4 text-right text-gray-400">{f.route.distance_nm.toLocaleString()} nm</td>
                          <td className={cn('py-3 pr-4 text-right font-bold', RatingColor(Number(f.pax_happiness), 'happiness'))}>
                            {Number(f.pax_happiness).toFixed(0)}%
                          </td>
                          <td className="py-3 text-right text-green-400">
                            {salary > 0 ? `${currency}${Math.abs(salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Type Ratings / Certifications */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-bold mb-4">Type Ratings & Certifications</h2>
            {(!u.certifications || u.certifications.length === 0) ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No certifications yet. Complete flights to earn type ratings.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {u.certifications.map((cert: string) => (
                  <span key={cert} className="text-xs font-bold px-3 py-1.5 rounded-full border border-aero/30 bg-aero/10 text-aero">
                    {cert}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}


      {activeTab === 'finances' && (
        <div className="flex flex-col gap-6">
          {/* Assets */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-bold mb-4">Assets</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', value: displayedName },
                { label: 'Virtual Airline', value: u.airline?.name ?? 'Independent' },
                { label: 'Balance', value: `${currency}${Number(u.personal_balance).toLocaleString('en-US', { minimumFractionDigits: 3 })}` },
                { label: 'Aircraft Value', value: `${currency}0.000` },
                { label: 'Total Assets', value: `${currency}${Number(u.personal_balance).toLocaleString('en-US', { minimumFractionDigits: 3 })}` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5 col-span-2">
                  <span className="text-gray-400 text-sm">{row.label}</span>
                  <span className="font-medium text-sm">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Airline earnings */}
          {u.airline && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-bold mb-4">Airline Earnings</h2>
              {recent_flights.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No flights recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-white/5">
                        <th className="text-left py-2 pr-4">Airline</th>
                        <th className="text-right py-2 pr-4">Flights</th>
                        <th className="text-left py-2 pr-4">First Flight</th>
                        <th className="text-left py-2 pr-4">Last Flight</th>
                        <th className="text-right py-2">Salary Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 pr-4">{u.airline.name}</td>
                        <td className="py-3 pr-4 text-right">{stats.total_flights}</td>
                        <td className="py-3 pr-4 text-gray-400 text-xs">
                          {recent_flights.length > 0
                            ? new Date(recent_flights[recent_flights.length - 1].arrived_at ?? '').toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3 pr-4 text-gray-400 text-xs">
                          {recent_flights.length > 0
                            ? new Date(recent_flights[0].arrived_at ?? '').toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3 text-right text-green-400 font-bold">
                          {currency}{Number(u.personal_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
