'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      inputs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length < 6) { setError('Please enter the full 6-digit code'); return; }
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/verify-email', { code: fullCode });
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid or expired code. Please try again.');
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await api.post('/auth/resend-verification');
      setResent(true);
      setTimeout(() => setResent(false), 30000);
    } catch { /* ignore */ }
  }

  return (
    <div className="glass-card rounded-2xl p-8 text-center">
      <div className="text-4xl mb-4">✉️</div>
      <h1 className="text-2xl font-bold mb-2">Check your email</h1>
      <p className="text-gray-400 text-sm mb-2">
        We sent a 6-digit code to
      </p>
      <p className="text-aero font-medium text-sm mb-8">{user?.email}</p>

      <form onSubmit={handleSubmit}>
        {/* 6-digit code inputs */}
        <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-2xl font-bold rounded-xl border border-white/10 bg-white/5 text-white focus:border-[#00D1FF] focus:outline-none focus:ring-1 focus:ring-[#00D1FF] transition"
            />
          ))}
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading}>
          Verify Email
        </Button>
      </form>

      <div className="mt-6">
        {resent ? (
          <p className="text-sm text-green-400">Code resent! Check your inbox.</p>
        ) : (
          <button
            onClick={handleResend}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Didn&apos;t receive it? <span className="text-aero">Resend code</span>
          </button>
        )}
      </div>
    </div>
  );
}
