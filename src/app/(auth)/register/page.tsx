'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="glass-card rounded-2xl p-8 h-[540px] animate-pulse" />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan'); // 'founders' if coming from landing page
  const { setTokens, setUser } = useAuthStore();

  const [form, setForm] = useState({
    display_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.display_name.trim()) e.display_name = 'Display name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        display_name: form.display_name,
      });
      setTokens(data.access_token, data.refresh_token);

      const { data: me } = await api.post('/auth/me', {}, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setUser(me);

      // If they came from Founder's Pass, redirect to billing
      if (plan === 'founders') {
        router.push('/dashboard/billing?plan=founders');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ general: msg ?? 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2">
          {plan === 'founders' ? (
            <>Join as a <span className="text-purple-400">Founder</span></>
          ) : (
            'Create your account'
          )}
        </h1>
        <p className="text-gray-400 text-sm">
          {plan === 'founders'
            ? 'Secure your lifetime Enterprise access'
            : 'Start your AeroNexus journey'}
        </p>
      </div>

      {plan === 'founders' && (
        <div className="mb-6 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-300 text-center">
          🎖️ You&apos;re claiming a Founder&apos;s Pass — Lifetime Enterprise access for $199
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Display Name"
          type="text"
          placeholder="Capt. Ryan King"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          error={errors.display_name}
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          placeholder="pilot@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="Min. 8 characters"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          autoComplete="new-password"
        />
        <Input
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          value={form.confirm_password}
          onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
          error={errors.confirm_password}
          autoComplete="new-password"
        />

        {errors.general && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {errors.general}
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          className={plan === 'founders' ? 'bg-purple-600 hover:bg-purple-500 text-white' : ''}
        >
          {plan === 'founders' ? 'Create Account & Secure My Spot' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="text-aero hover:underline font-medium">
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-gray-600">
        By creating an account you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
