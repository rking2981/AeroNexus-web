'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string; author_id: string; content: string;
  status: string; staff_note: string | null;
  upvotes: number; downvotes: number; created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:  'text-amber-400 border-amber-500/20 bg-amber-500/10',
  APPROVED: 'text-green-400 border-green-500/20 bg-green-500/10',
  DENIED:   'text-red-400 border-red-500/20 bg-red-500/10',
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const [reviewing, setReviewing] = useState<Suggestion | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await botApi.get(`/suggestions?status=${filter}`);
    setSuggestions(data);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleReview(status: 'APPROVED' | 'DENIED') {
    if (!reviewing) return;
    setSaving(true);
    await botApi.patch(`/suggestions/${reviewing.id}`, { status, staff_note: note || null });
    setSaving(false);
    setReviewing(null);
    setNote('');
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Suggestions</h1>

      <div className="flex gap-2 mb-6">
        {['PENDING', 'APPROVED', 'DENIED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition',
              filter === s ? 'bg-aero text-black' : 'text-gray-400 border border-white/10 hover:bg-white/5')}>
            {s}
          </button>
        ))}
      </div>

      {reviewing && (
        <div className="glass-card rounded-2xl p-6 mb-6 border border-aero/20">
          <h2 className="font-bold mb-3">Review Suggestion</h2>
          <p className="text-sm text-gray-300 mb-4 bg-white/5 rounded-xl p-4">{reviewing.content}</p>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={2} placeholder="Staff note (optional)..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none resize-none mb-3" />
          <div className="flex gap-2">
            <button onClick={() => handleReview('APPROVED')} disabled={saving}
              className="bg-green-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 disabled:opacity-50">Approve</button>
            <button onClick={() => handleReview('DENIED')} disabled={saving}
              className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 disabled:opacity-50">Deny</button>
            <button onClick={() => { setReviewing(null); setNote(''); }}
              className="border border-white/10 text-gray-400 px-5 py-2.5 rounded-xl text-sm hover:bg-white/5">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {suggestions.length === 0 && <p className="text-gray-500 text-sm">No {filter.toLowerCase()} suggestions.</p>}
        {suggestions.map(s => (
          <div key={s.id} className="glass-card rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="text-sm text-gray-200 flex-1">{s.content}</p>
              <span className={cn('text-xs px-2 py-0.5 rounded-full border flex-shrink-0', STATUS_COLORS[s.status])}>{s.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>👍 {s.upvotes} · 👎 {s.downvotes}</span>
                <span>By <span className="font-mono text-gray-400">{s.author_id}</span></span>
                <span>{new Date(s.created_at).toLocaleDateString()}</span>
                {s.staff_note && <span className="text-gray-400 italic">"{s.staff_note}"</span>}
              </div>
              {s.status === 'PENDING' && (
                <button onClick={() => { setReviewing(s); setNote(''); }}
                  className="text-xs text-aero border border-aero/20 px-3 py-1.5 rounded-lg hover:bg-aero/10 transition">
                  Review
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
