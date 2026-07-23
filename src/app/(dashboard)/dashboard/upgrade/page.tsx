'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const ENTERPRISE_FEATURES = [
  'Unlimited pilots & aircraft', 'Advanced analytics',
  'Custom branding & colors', 'Public API access',
  'VA Website product', 'Priority support',
];

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpgrade() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/v1/payments/portal', {
        return_url: window.location.href,
      });
      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Could not open billing portal. Please contact support.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="glass-card rounded-2xl p-8 border border-amber-500/20">
        <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-full border text-amber-400 border-amber-500/20 bg-amber-500/10 mb-4">
          TRIAL ENDED
        </span>
        <h1 className="text-2xl font-extrabold mb-3">Your free trial has ended</h1>
        <p className="text-gray-400 text-sm mb-6">
          You&apos;ve been moved to the <strong className="text-white">Free Ad-Supported Pilot</strong> tier so you can
          keep flying without interruption. Your airline — fleet, routes, pilots, and history — is preserved for 30 days.
          Upgrade any time to restore full VA Manager access and keep everything.
        </p>

        <ul className="flex flex-col gap-1.5 mb-6">
          {ENTERPRISE_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
              <span className="text-green-400 text-xs">✓</span> {f}
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50"
        >
          {loading ? 'Opening…' : 'Upgrade Now →'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          Opens Stripe&apos;s secure billing portal to choose a plan.
        </p>
      </div>
    </div>
  );
}
