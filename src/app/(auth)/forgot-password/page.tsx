'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { publicApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await publicApi.post('/auth/forgot-password', { email });
    } catch { /* ignore — always show success */ }
    setSent(true);
    setLoading(false);
  }

  if (sent) return (
    <div className="glass-card rounded-2xl p-8 text-center">
      <div className="text-4xl mb-4">📬</div>
      <h1 className="text-2xl font-bold mb-2">Check your email</h1>
      <p className="text-gray-400 text-sm mb-6">
        If an account exists for <span className="text-white">{email}</span>, we&apos;ve sent a 6-digit reset code.
      </p>
      <Link
        href="/reset-password"
        className="block w-full bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm text-center"
      >
        Enter Reset Code
      </Link>
      <Link href="/login" className="block mt-4 text-sm text-gray-400 hover:text-white transition">
        Back to login
      </Link>
    </div>
  );

  return (
    <div className="glass-card rounded-2xl p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Forgot your password?</h1>
        <p className="text-gray-400 text-sm">Enter your email and we&apos;ll send you a reset code.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Email"
          type="email"
          placeholder="pilot@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" loading={loading}>Send Reset Code</Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Remember it?{' '}
        <Link href="/login" className="text-aero hover:underline font-medium">Sign in</Link>
      </p>
    </div>
  );
}
