'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string; public_id: string; title: string;
  status: string; severity: string; category: string;
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-blue-400', INVESTIGATING: 'text-yellow-400',
  IN_PROGRESS: 'text-orange-400', RESOLVED: 'text-green-400',
  CLOSED: 'text-gray-500', REJECTED: 'text-red-400',
};

export default function NewReportPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    category: '', severity: 'MODERATE', title: '', description: '', visibility: 'PUBLIC',
  });
  const [suggestions, setSuggestions]     = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Live title suggestions — debounced 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (form.title.length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/reports/suggest?q=${encodeURIComponent(form.title)}`);
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch { setSuggestions([]); }
    }, 300);
  }, [form.title]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) { setError('Please select a category.'); return; }
    setSubmitting(true); setError('');
    try {
      const { data } = await api.post('/reports', form);
      router.push(`/dashboard/tracker/${data.public_id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to submit report.');
    } finally { setSubmitting(false); }
  }

  const field = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/tracker" className="text-gray-500 hover:text-white text-sm transition">← Tracker</Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-bold">File a Report</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Category */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Category *</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'TECHNICAL',       label: 'Technical',        icon: '🔧', desc: 'Bugs, crashes, API issues' },
              { value: 'FLIGHT_INCIDENT', label: 'Flight Incident',  icon: '✈️', desc: 'Hard landings, disconnects, anomalies' },
              { value: 'OPERATIONAL',     label: 'Operational',      icon: '📋', desc: 'Dispatch, routes, maintenance' },
              { value: 'COMMUNITY',       label: 'Community',        icon: '👥', desc: 'Abuse, cheating, harassment' },
            ].map(c => (
              <button key={c.value} type="button" onClick={() => field('category', c.value)}
                className={cn('flex items-start gap-3 p-3 rounded-xl border text-left transition',
                  form.category === c.value
                    ? 'border-aero/50 bg-aero/10 text-white'
                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white')}>
                <span className="text-xl flex-shrink-0">{c.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Severity</label>
          <div className="flex flex-wrap gap-2">
            {['INFORMATIONAL', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'EMERGENCY'].map(s => (
              <button key={s} type="button" onClick={() => field('severity', s)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition',
                  form.severity === s ? 'bg-aero/20 border-aero/40 text-aero' : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5')}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Title with suggestions */}
        <div className="relative">
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Title *</label>
          <input
            value={form.title}
            onChange={e => { field('title', e.target.value); setShowSuggestions(false); }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Brief description of the issue…"
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition"
          />
          {/* Similar reports dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 glass-card rounded-xl border border-aero/20 overflow-hidden shadow-xl">
              <p className="px-3 py-2 text-[10px] text-amber-400 font-bold uppercase tracking-widest border-b border-white/5">
                ⚠ Similar reports already exist — is yours already filed?
              </p>
              {suggestions.map(s => (
                <Link key={s.id} href={`/dashboard/tracker/${s.public_id}`}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition border-b border-white/5 last:border-0">
                  <span className="font-mono text-xs text-gray-500 flex-shrink-0">{s.public_id}</span>
                  <span className="text-sm text-white flex-1 truncate">{s.title}</span>
                  <span className={cn('text-xs font-semibold flex-shrink-0', STATUS_COLOR[s.status] ?? 'text-gray-400')}>
                    {s.status.replace('_', ' ')}
                  </span>
                </Link>
              ))}
              <button type="button" onClick={() => setShowSuggestions(false)}
                className="w-full text-center text-xs text-gray-500 hover:text-white py-2 transition">
                None of these — continue filing
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Description *</label>
          <textarea
            value={form.description}
            onChange={e => field('description', e.target.value)}
            placeholder="Describe the issue in detail. Include steps to reproduce if applicable."
            rows={6} required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition resize-none"
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Visibility</label>
          <div className="flex gap-3">
            {[
              { value: 'PUBLIC',  label: 'Public',  desc: 'Visible to all pilots' },
              { value: 'PRIVATE', label: 'Private', desc: 'Staff only (e.g. moderation, anti-cheat)' },
            ].map(v => (
              <button key={v.value} type="button" onClick={() => field('visibility', v.value)}
                className={cn('flex-1 p-3 rounded-xl border text-left text-sm transition',
                  form.visibility === v.value
                    ? 'border-aero/50 bg-aero/10 text-white'
                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white')}>
                <p className="font-semibold">{v.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting || !form.category || !form.title || !form.description}
          className="bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition disabled:opacity-40">
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
