'use client';

import { useState } from 'react';
import Link from 'next/link';

const SUBJECTS = [
  'General Inquiry',
  'Billing & Subscription',
  'Technical Support',
  'Bug Report',
  'Feature Request',
  'Account Issue',
  'Other',
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://aeronexus-api-production.up.railway.app/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setSuccess(true);
    } catch {
      setError('Something went wrong. Please try again or email us directly.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-6 max-w-5xl mx-auto border-b border-white/5">
        <Link href="/" className="text-xl font-bold tracking-tighter italic">
          AERO<span className="text-[#00D1FF]">NEXUS</span>
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
          <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition">Terms</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold mb-3">Contact Us</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Have a question, issue, or feedback? Fill out the form below and we'll get back to you as soon as possible.
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold mb-2">Message Sent</h2>
            <p className="text-gray-400 text-sm mb-6">Thanks for reaching out — we'll get back to you shortly.</p>
            <Link
              href="/"
              className="inline-block bg-[#00D1FF] text-black font-bold px-6 py-3 rounded-xl text-sm hover:brightness-110 transition"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Smith"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D1FF]/50 transition"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D1FF]/50 transition"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Subject</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00D1FF]/50 transition appearance-none"
              >
                <option value="" className="bg-[#0A0A0A]">Select a subject…</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s} className="bg-[#0A0A0A]">{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe your question or issue in detail…"
                rows={6}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D1FF]/50 transition resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-[#00D1FF] text-black font-bold py-3 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send Message'}
            </button>

            <p className="text-xs text-gray-600 text-center">
              We typically respond within 24–48 hours.
            </p>
          </form>
        )}
      </div>

      <footer className="border-t border-white/5 mt-16 py-8 px-8 text-center">
        <p className="text-gray-600 text-xs">
          © {new Date().getFullYear()} AeroNexus ·{' '}
          <Link href="/privacy" className="hover:text-gray-400 transition">Privacy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-gray-400 transition">Terms</Link>
        </p>
        <p className="text-gray-700 text-xs mt-2 font-bold tracking-widest">THE SKY IS NO LONGER A GRID.</p>
      </footer>
    </div>
  );
}
