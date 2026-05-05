'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'ANC', symbol: '✈', label: 'AeroNexus Credits (custom)' },
];

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Airline name is required';
    if (!form.icao_code.trim()) e.icao_code = 'ICAO code is required';
    if (!/^[A-Z]{3,4}$/.test(form.icao_code.toUpperCase())) e.icao_code = 'ICAO must be 3-4 letters';
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

      // Re-fetch user so airline_id and role are updated in store
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

  function handleCurrencyChange(code: string) {
    const currency = CURRENCIES.find((c) => c.code === code);
    setForm({ ...form, currency_code: code, currency_symbol: currency?.symbol ?? '$' });
  }

  if (user?.airline_id) {
    router.replace('/dashboard/airline');
    return null;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Your Virtual Airline</h1>
        <p className="text-gray-400 text-sm">
          Set up your VA identity. You can update branding and settings after creation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 flex flex-col gap-6">

        {/* Airline Identity */}
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
                label="IATA Code (optional, 2 chars)"
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

        {/* Currency */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Currency</h2>
          <div className="grid grid-cols-1 gap-3">
            {CURRENCIES.map((c) => (
              <label
                key={c.code}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition ${
                  form.currency_code === c.code
                    ? 'border-aero bg-aero/5 text-white'
                    : 'border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="currency"
                  value={c.code}
                  checked={form.currency_code === c.code}
                  onChange={() => handleCurrencyChange(c.code)}
                  className="hidden"
                />
                <span className="text-xl w-8 text-center">{c.symbol}</span>
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-gray-500">{c.code}</p>
                </div>
              </label>
            ))}
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
