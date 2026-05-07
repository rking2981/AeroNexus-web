'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api, publicApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AircraftType {
  id: string;
  icao_code: string;
  manufacturer: string;
  name: string;
  aircraft_category: string;
  pax_capacity: number;
  cruise_speed_kts: number | null;
  max_range_nm: number | null;
  base_price: number | null;
  engine_type: string;
  engine_count: number;
}

const CATEGORY_ICON: Record<string, string> = {
  FIXED_WING: '✈️', HELICOPTER: '🚁', SEAPLANE: '🛥️', BALLOON: '🎈',
};

export default function AddHullPage() {
  const router = useRouter();
  const [types, setTypes] = useState<AircraftType[]>([]);
  const [airlineBalance, setAirlineBalance] = useState<{ balance: number; symbol: string } | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AircraftType | null>(null);
  const [form, setForm] = useState({ registration: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    publicApi.get('/aircraft-types').then((r) => setTypes(r.data)).catch(() => {});
    api.get('/airline/finances').then((r) => setAirlineBalance({ balance: r.data.balance, symbol: r.data.currency.symbol })).catch(() => {});
  }, []);

  const filtered = types.filter((t) =>
    `${t.manufacturer} ${t.name} ${t.icao_code}`.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!selected) errs.type = 'Select an aircraft type';
    if (!form.registration.trim()) errs.registration = 'Registration is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      await api.post('/market/buy/new', {
        aircraft_type_id: selected!.id,
        registration: form.registration,
        payment_type: 'BUY',
      });
      router.push('/dashboard/fleet');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ general: msg ?? 'Failed to purchase aircraft.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Add Aircraft</h1>
        <p className="text-gray-400 text-sm">Select an aircraft type and assign a registration number.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Aircraft type selector */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Aircraft Type</h2>

          <input
            type="text"
            placeholder="Search by manufacturer, name or ICAO type code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none focus:ring-1 focus:ring-[#00D1FF] transition mb-4"
          />

          {selected && (
            <div className="rounded-xl border border-aero/30 bg-aero/5 px-4 py-4 mb-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {CATEGORY_ICON[selected.aircraft_category]} {selected.manufacturer} {selected.name}
                    <span className="ml-2 font-mono text-xs text-gray-400">({selected.icao_code})</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selected.pax_capacity} pax · {selected.max_range_nm?.toLocaleString()} nm range ·
                    {selected.engine_count}x {selected.engine_type}
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)}
                  className="text-gray-500 hover:text-white text-sm ml-4 transition flex-shrink-0">
                  Change
                </button>
              </div>
              {selected.base_price && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-sm">
                  <span className="text-gray-400">Purchase Price</span>
                  <span className="font-bold text-white">
                    {airlineBalance?.symbol ?? '$'}{selected.base_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {airlineBalance && selected.base_price && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Airline Balance After</span>
                  <span className={cn('font-bold', airlineBalance.balance - selected.base_price < 0 ? 'text-red-400' : 'text-green-400')}>
                    {airlineBalance.symbol}{(airlineBalance.balance - selected.base_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {airlineBalance && selected.base_price && airlineBalance.balance < selected.base_price && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  Insufficient funds. Current balance: {airlineBalance.symbol}{airlineBalance.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          )}

          {!selected && (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-white/5">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500 text-center">No aircraft found</div>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition border-b border-white/5 last:border-0"
                  >
                    <span className="text-xl w-8 text-center flex-shrink-0">{CATEGORY_ICON[t.aircraft_category] ?? '✈️'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{t.manufacturer} {t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.icao_code} · {t.pax_capacity} pax · {t.max_range_nm?.toLocaleString()} nm
                      </p>
                    </div>
                    {t.base_price && (
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        ${(t.base_price / 1e6).toFixed(1)}M
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
          {errors.type && <p className="text-xs text-red-400 mt-2">{errors.type}</p>}
        </div>

        {/* Registration & lease */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Details</h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Registration Number"
              placeholder="N-TVAR1"
              value={form.registration}
              onChange={(e) => setForm({ ...form, registration: e.target.value.toUpperCase() })}
              error={errors.registration}
              maxLength={12}
            />
          </div>
        </div>

        {errors.general && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {errors.general}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" loading={loading}
            disabled={!!(selected?.base_price && airlineBalance && airlineBalance.balance < selected.base_price)}>
            {selected?.base_price
              ? `Purchase for ${airlineBalance?.symbol ?? '$'}${selected.base_price.toLocaleString()}`
              : 'Add to Fleet'}
          </Button>
          <button type="button" onClick={() => router.back()}
            className="px-5 py-3 text-sm text-gray-400 hover:text-white transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
