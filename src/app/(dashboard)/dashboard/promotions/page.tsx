'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface Ad {
  id: string;
  type: 'LOGIN' | 'SIDEBAR';
  image_url: string | null;
  logo_url: string | null;
  text: string | null;
  width_px: number | null;
  cost_paid: number;
  starts_at: string;
  expires_at: string;
  impressions: number;
  is_active: boolean;
}

const LOGIN_RATE   = 500;
const SIDEBAR_RATE = 1200;

function formatCurrency(n: number, symbol = '$') {
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeLeft(expires: string): string {
  const ms = new Date(expires).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h remaining`;
  return `${h}h remaining`;
}

function AdCard({ ad, symbol, onCancel, isManager }: {
  ad: Ad; symbol: string; onCancel: (id: string) => void; isManager: boolean;
}) {
  const isLogin = ad.type === 'LOGIN';
  return (
    <div className={cn('glass-card rounded-xl p-5 border',
      ad.is_active ? isLogin ? 'border-aero/20' : 'border-purple-500/20' : 'border-white/5')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{isLogin ? '📸' : '📢'}</span>
            <span className="font-semibold text-sm">{isLogin ? 'Login Page Ad' : 'Sidebar Ad'}</span>
            {ad.width_px && <span className="text-xs text-gray-500">{ad.width_px}px</span>}
            <span className={cn('text-xs px-2 py-0.5 rounded-full border font-bold',
              ad.is_active ? 'text-green-400 border-green-500/20 bg-green-500/10' : 'text-gray-500 border-white/10 bg-white/5')}>
              {ad.is_active ? 'Active' : 'Expired'}
            </span>
          </div>
          {isLogin && ad.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.image_url} alt="Ad" className="max-h-16 rounded-lg mb-2 object-contain bg-black/20" />
          )}
          {!isLogin && ad.text && <p className="text-sm text-gray-300 leading-snug mb-2">{ad.text}</p>}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Cost: <span className="text-gray-300">{symbol}{Number(ad.cost_paid).toLocaleString()}</span></span>
            <span>👁 {ad.impressions.toLocaleString()} impressions</span>
            {ad.is_active
              ? <span className="text-aero">{timeLeft(ad.expires_at)}</span>
              : <span>Expired {new Date(ad.expires_at).toLocaleDateString()}</span>}
          </div>
        </div>
        {isManager && ad.is_active && (
          <button onClick={() => onCancel(ad.id)}
            className="flex-shrink-0 text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';

  const [ads, setAds]         = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [symbol, setSymbol]   = useState('$');
  const [tab, setTab]         = useState<'active' | 'login' | 'sidebar'>('active');

  const [loginImg, setLoginImg]       = useState('');
  const [loginWidth, setLoginWidth]   = useState(350);
  const [loginDays, setLoginDays]     = useState(1);
  const [loginBuying, setLoginBuying] = useState(false);
  const [loginError, setLoginError]   = useState('');

  const [sidebarLogo, setSidebarLogo]     = useState('');
  const [sidebarText, setSidebarText]     = useState('');
  const [sidebarHours, setSidebarHours]   = useState(24);
  const [sidebarBuying, setSidebarBuying] = useState(false);
  const [sidebarError, setSidebarError]   = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/promotions'),
      api.get('/airline/finances'),
    ]).then(([a, f]) => {
      setAds(a.data);
      setBalance(f.data.balance);
      setSymbol(f.data.currency?.symbol ?? '$');
    }).finally(() => setLoading(false));
  }, []);

  const loginCost        = Math.ceil(loginWidth / 350) * loginDays * LOGIN_RATE;
  const sidebarCost      = sidebarHours * SIDEBAR_RATE;
  const canAffordLogin   = balance === null || balance >= loginCost;
  const canAffordSidebar = balance === null || balance >= sidebarCost;

  async function buyLoginAd(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(''); setLoginBuying(true);
    try {
      const { data } = await api.post('/promotions/login', {
        image_url: loginImg, width_px: loginWidth, duration_days: loginDays,
      });
      setAds(prev => [{ ...data, is_active: true }, ...prev]);
      setBalance(b => b !== null ? b - loginCost : b);
      setLoginImg(''); setLoginWidth(350); setLoginDays(1);
      setTab('active');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLoginError(msg ?? 'Purchase failed');
    } finally { setLoginBuying(false); }
  }

  async function buySidebarAd(e: React.FormEvent) {
    e.preventDefault();
    setSidebarError(''); setSidebarBuying(true);
    try {
      const { data } = await api.post('/promotions/sidebar', {
        logo_url: sidebarLogo || undefined, text: sidebarText, duration_hours: sidebarHours,
      });
      setAds(prev => [{ ...data, is_active: true }, ...prev]);
      setBalance(b => b !== null ? b - sidebarCost : b);
      setSidebarLogo(''); setSidebarText(''); setSidebarHours(24);
      setTab('active');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSidebarError(msg ?? 'Purchase failed');
    } finally { setSidebarBuying(false); }
  }

  async function cancelAd(id: string) {
    if (!confirm('Cancel this ad? It will expire immediately with no refund.')) return;
    await api.delete(`/promotions/${id}`);
    setAds(prev => prev.map(a => a.id === id ? { ...a, is_active: false, expires_at: new Date().toISOString() } : a));
  }

  const activeAds  = ads.filter(a => a.is_active);
  const expiredAds = ads.filter(a => !a.is_active);

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Promotions</h1>
          <p className="text-gray-400 text-sm">
            Advertise your VA on the login page and sidebar · Paid with airline virtual funds
            {balance !== null && <span className="ml-2 text-aero font-medium">· Balance: {formatCurrency(balance, symbol)}</span>}
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {[
          { key: 'active',  label: `My Ads (${activeAds.length})` },
          { key: 'login',   label: '📸 Login Page Ad' },
          { key: 'sidebar', label: '📢 Sidebar Ad' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* My Ads */}
      {tab === 'active' && (
        <div className="flex flex-col gap-4">
          {ads.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-4xl mb-4">📢</p>
              <h3 className="text-xl font-bold mb-2">No ads yet</h3>
              <p className="text-gray-400 text-sm mb-6">Purchase a login page or sidebar ad to promote your VA to other pilots.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setTab('login')} className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 transition">Login Page Ad</button>
                <button onClick={() => setTab('sidebar')} className="border border-white/20 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-white/5 transition">Sidebar Ad</button>
              </div>
            </div>
          ) : (
            <>
              {activeAds.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Active</p>
                  <div className="flex flex-col gap-3">{activeAds.map(a => <AdCard key={a.id} ad={a} symbol={symbol} onCancel={cancelAd} isManager={isManager} />)}</div>
                </div>
              )}
              {expiredAds.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Expired</p>
                  <div className="flex flex-col gap-3 opacity-50">{expiredAds.map(a => <AdCard key={a.id} ad={a} symbol={symbol} onCancel={cancelAd} isManager={false} />)}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Login Page Ad */}
      {tab === 'login' && (
        <div className="glass-card rounded-2xl p-6 border border-aero/20">
          <h3 className="font-bold mb-1">Login Page Ad</h3>
          <p className="text-sm text-gray-400 mb-5">
            Your banner is shown on the AeroNexus login page and rotates with other active ads.
            Pricing: <span className="text-white">{formatCurrency(LOGIN_RATE)}/350px/day</span> · Max width 700px.
          </p>
          <form onSubmit={buyLoginAd} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Banner Image URL *</label>
              <input value={loginImg} onChange={e => setLoginImg(e.target.value)} required
                placeholder="https://example.com/your-banner.png"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
            </div>
            {loginImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={loginImg} alt="Preview" className="max-h-24 rounded-xl object-contain bg-black/30 w-full" />
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Width</label>
                <select value={loginWidth} onChange={e => setLoginWidth(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white focus:border-aero focus:outline-none">
                  <option value={350}>350px — standard</option>
                  <option value={700}>700px — double-wide</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Duration (days)</label>
                <input type="number" min={1} max={90} value={loginDays}
                  onChange={e => setLoginDays(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
              </div>
            </div>
            <div className={cn('rounded-xl p-4 flex items-center justify-between border',
              canAffordLogin ? 'border-aero/20 bg-aero/5' : 'border-red-500/20 bg-red-500/5')}>
              <div>
                <p className="text-sm font-bold">{formatCurrency(loginCost, symbol)}</p>
                <p className="text-xs text-gray-500">{Math.ceil(loginWidth / 350)} slot × {loginDays}d × {formatCurrency(LOGIN_RATE)}</p>
              </div>
              {!canAffordLogin && <p className="text-xs text-red-400 font-bold">Insufficient funds</p>}
            </div>
            {loginError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{loginError}</p>}
            <button type="submit" disabled={loginBuying || !loginImg || !canAffordLogin}
              className="bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-40">
              {loginBuying ? 'Purchasing…' : `Purchase — ${formatCurrency(loginCost, symbol)}`}
            </button>
          </form>
        </div>
      )}

      {/* Sidebar Ad */}
      {tab === 'sidebar' && (
        <div className="glass-card rounded-2xl p-6 border border-purple-500/20">
          <h3 className="font-bold mb-1">Sidebar Ad</h3>
          <p className="text-sm text-gray-400 mb-5">
            Your logo and text appear in the sidebar on the main dashboard, rotating every hour.
            Pricing: <span className="text-white">{formatCurrency(SIDEBAR_RATE)}/hour</span> · Text limit: 255 characters.
          </p>
          <form onSubmit={buySidebarAd} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Logo URL (optional)</label>
              <input value={sidebarLogo} onChange={e => setSidebarLogo(e.target.value)}
                placeholder="https://example.com/your-logo.png"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">
                Ad Text * <span className="text-gray-600 normal-case">({sidebarText.length}/255)</span>
              </label>
              <textarea value={sidebarText} onChange={e => setSidebarText(e.target.value.slice(0, 255))}
                required rows={3} placeholder="Join SkyWest Virtual — fastest growing VA on AeroNexus!"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition resize-none" />
            </div>
            {(sidebarLogo || sidebarText) && (
              <div className="rounded-xl border border-white/10 bg-[#0a0a0f] p-4">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Preview</p>
                <div className="flex gap-3 items-start">
                  {sidebarLogo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sidebarLogo} alt="Logo" className="w-10 h-10 rounded-lg object-contain flex-shrink-0 bg-black/20" />
                  )}
                  <p className="text-sm text-gray-300 leading-snug">{sidebarText}</p>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Duration</label>
              <div className="flex gap-2 flex-wrap mb-3">
                {[1, 6, 12, 24, 48, 72, 168].map(h => (
                  <button key={h} type="button" onClick={() => setSidebarHours(h)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition',
                      sidebarHours === h ? 'bg-aero/20 border-aero/40 text-aero' : 'border-white/10 text-gray-400 hover:text-white')}>
                    {h < 24 ? `${h}h` : `${h / 24}d`}
                  </button>
                ))}
              </div>
              <input type="number" min={1} max={720} value={sidebarHours}
                onChange={e => setSidebarHours(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition" />
            </div>
            <div className={cn('rounded-xl p-4 flex items-center justify-between border',
              canAffordSidebar ? 'border-purple-500/20 bg-purple-500/5' : 'border-red-500/20 bg-red-500/5')}>
              <div>
                <p className="text-sm font-bold">{formatCurrency(sidebarCost, symbol)}</p>
                <p className="text-xs text-gray-500">{sidebarHours}h × {formatCurrency(SIDEBAR_RATE)}/hr</p>
              </div>
              {!canAffordSidebar && <p className="text-xs text-red-400 font-bold">Insufficient funds</p>}
            </div>
            {sidebarError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{sidebarError}</p>}
            <button type="submit" disabled={sidebarBuying || !sidebarText || !canAffordSidebar}
              className="bg-purple-500 text-white font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-40">
              {sidebarBuying ? 'Purchasing…' : `Purchase — ${formatCurrency(sidebarCost, symbol)}`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
