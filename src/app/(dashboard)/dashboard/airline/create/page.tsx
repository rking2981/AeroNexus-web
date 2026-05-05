'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { CURRENCIES } from '@/lib/currencies';

export default function CreateAirlinePage() {
  const router = useRouter();
  const { setUser, user } = useAuthStore();

  const [form, setForm] = useState({
    name: '',
    icao_code: '',
    iata_code: '',
    hub_country: '',
    currency_code: 'USD',
    currency_symbol: '$',
  });
  const [currencySearch, setCurrencySearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const selectedCurrency = CURRENCIES.find((c) => c.code === form.currency_code);

  const filteredCurrencies = CURRENCIES.filter((c) =>
    `${c.code} ${c.label}`.toLowerCase().includes(currencySearch.toLowerCase()),
  );

  function handleCurrencySelect(code: string, symbol: string) {
    setForm({ ...form, currency_code: code, currency_symbol: symbol });
    setCurrencySearch('');
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Airline name is required';
    if (!form.icao_code.trim()) e.icao_code = 'ICAO code is required';
    if (!/^[A-Z]{3,4}$/.test(form.icao_code.toUpperCase())) e.icao_code = 'ICAO must be 3–4 letters';
    if (form.iata_code && !/^[A-Z0-9]{2}$/.test(form.iata_code.toUpperCase())) {
      e.iata_code = 'IATA must be exactly 2 characters';
    }
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      await api.post('/airline', {
        ...form,
        icao_code: form.icao_code.toUpperCase(),
        iata_code: form.iata_code.toUpperCase() || undefined,
      });
      const { data: me } = await api.post('/auth/me');
      setUser(me);
      router.push('/dashboard/airline');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ general: msg ?? 'Failed to create airline. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  if (user?.airline_id) {
    router.replace('/dashboard/airline');
    return null;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Your Virtual Airline</h1>
        <p className="text-gray-400 text-sm">Set up your VA identity. You can update branding and settings after creation.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 flex flex-col gap-6">

        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Identity</h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Airline Name"
              placeholder="Pacific Virtual Airlines"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="ICAO Code (3–4 letters)"
                placeholder="PVAO"
                value={form.icao_code}
                onChange={(e) => setForm({ ...form, icao_code: e.target.value.toUpperCase() })}
                error={errors.icao_code}
                maxLength={4}
              />
              <Input
                label="IATA Code (optional)"
                placeholder="PV"
                value={form.iata_code}
                onChange={(e) => setForm({ ...form, iata_code: e.target.value.toUpperCase() })}
                error={errors.iata_code}
                maxLength={2}
              />
            </div>
            <Input
              label="Hub Country (optional)"
              placeholder="United States"
              value={form.hub_country}
              onChange={(e) => setForm({ ...form, hub_country: e.target.value })}
            />
          </div>
        </div>

        <div className="h-px bg-white/5" />

        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Currency</h2>
          <div className="relative">
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Airline Currency</label>
            <input
              type="text"
              placeholder={`Search — currently: ${selectedCurrency?.symbol} ${selectedCurrency?.label} (${selectedCurrency?.code})`}
              value={currencySearch}
              onChange={(e) => setCurrencySearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#00D1FF] focus:outline-none focus:ring-1 focus:ring-[#00D1FF] transition"
            />

            {currencySearch && (
              <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl">
                {filteredCurrencies.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No currencies found</div>
                ) : (
                  filteredCurrencies.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCurrencySelect(c.code, c.symbol)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/5 transition"
                    >
                      <span className="w-8 text-center">{c.symbol}</span>
                      <span className="text-white flex-1">{c.label}</span>
                      <span className="text-gray-500 text-xs font-mono">{c.code}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            <p className="mt-2 text-xs text-gray-600">
              {CURRENCIES.length} currencies available · Type to search
            </p>
          </div>
        </div>

        {errors.general && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {errors.general}
          </div>
        )}

        <Button type="submit" loading={loading}>
          Create Airline
        </Button>
      </form>
    </div>
  );
}
