'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { publicApi } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'code' | 'password'>('code');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleCodeInput(index: number, value: string) {
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

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Please enter your email'); return; }
    if (code.join('').length < 6) { setError('Please enter the full 6-digit code'); return; }
    setStep('password');
    setError('');
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);

    try {
      await publicApi.post('/auth/reset-password', {
        email,
        code: code.join(''),
        new_password: password,
      });
      router.push('/login?reset=success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid or expired code. Please request a new one.');
      setStep('code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Reset your password</h1>
        <p className="text-gray-400 text-sm">
          {step === 'code' ? 'Enter your email and the code we sent you.' : 'Choose a new password.'}
        </p>
      </div>

      {step === 'code' ? (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-5">
          <Input
            label="Email"
            type="email"
            placeholder="pilot@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">6-Digit Code</label>
            <div className="flex gap-2 justify-between" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeInput(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-11 h-13 text-center text-xl font-bold rounded-xl border border-white/10 bg-white/5 text-white focus:border-[#00D1FF] focus:outline-none focus:ring-1 focus:ring-[#00D1FF] transition py-3"
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button type="submit">Continue</Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col gap-5">
          <Input
            label="New Password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="Confirm New Password"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading}>Reset Password</Button>
          <button type="button" onClick={() => { setStep('code'); setError(''); }}
            className="text-sm text-gray-400 hover:text-white transition">
            ← Back
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-400">
        <Link href="/forgot-password" className="text-aero hover:underline">
          Request a new code
        </Link>
      </p>
    </div>
  );
}
