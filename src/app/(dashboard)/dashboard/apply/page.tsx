'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  question: string;
  required: boolean;
  sort_order: number;
}

interface AirlineForm {
  id: string;
  title: string;
  airline: {
    id: string;
    name: string;
    icao_code: string;
    iata_code: string | null;
    hub_country: string | null;
    subscription_tier: string;
    branding: { logo_url?: string; primary_color?: string } | null;
    _count: { users: number; hulls: number };
  };
  questions: Question[];
}

interface MyApplication {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  airline: { name: string; icao_code: string };
}

const TIER_COLORS: Record<string, string> = {
  FOUNDERS:   'text-purple-400 border-purple-500/20 bg-purple-500/10',
  ENTERPRISE: 'text-aero border-aero/20 bg-aero/10',
  STARTUP:    'text-gray-400 border-white/10 bg-white/5',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ACCEPTED: 'text-green-400 bg-green-500/10 border-green-500/20',
  DECLINED: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export default function ApplyPage() {
  const { user } = useAuthStore();
  const [forms, setForms] = useState<AirlineForm[]>([]);
  const [myApps, setMyApps] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AirlineForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [tab, setTab] = useState<'browse' | 'my'>('browse');

  const hasAirline = !!user?.airline_id;

  useEffect(() => {
    Promise.all([
      api.get('/applications/airlines'),
      api.get('/applications/my'),
    ]).then(([f, a]) => {
      setForms(f.data);
      setMyApps(a.data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true); setSubmitError('');

    const answersArray = selected.questions.map(q => ({
      question_id: q.id,
      answer: answers[q.id] ?? '',
    }));

    try {
      await api.post(`/applications/${selected.id}/submit`, { answers: answersArray });
      setSubmitSuccess(`Your application to ${selected.airline.name} has been submitted!`);
      setSelected(null);
      setAnswers({});
      const a = await api.get('/applications/my');
      setMyApps(a.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(msg ?? 'Failed to submit application.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Join an Airline</h1>
        <p className="text-gray-400 text-sm">Browse virtual airlines accepting applications and submit your profile.</p>
      </div>

      {hasAirline && (
        <div className="glass-card rounded-2xl p-4 mb-6 border border-amber-500/20 bg-amber-500/5 text-sm text-amber-300">
          You are currently a member of an airline. Leave your current airline before applying to another.
        </div>
      )}

      {submitSuccess && (
        <div className="glass-card rounded-2xl p-4 mb-6 border border-green-500/20 bg-green-500/5 text-sm text-green-300">
          {submitSuccess}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 w-fit">
        {[
          { key: 'browse', label: `Browse Airlines (${forms.length})` },
          { key: 'my',     label: `My Applications${myApps.length > 0 ? ` (${myApps.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-aero text-black' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Browse tab */}
      {tab === 'browse' && (
        <>
          {forms.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">🏢</p>
              <p className="text-gray-400 text-sm">No airlines are currently accepting applications.</p>
            </div>
          ) : (
            <div className="flex gap-6 items-start">
              {/* Airline list */}
              <div className="flex-1 flex flex-col gap-3">
                {forms.map(form => {
                  const hasApplied = myApps.some(a => a.airline.icao_code === form.airline.icao_code);
                  return (
                    <button key={form.id}
                      onClick={() => { setSelected(form); setAnswers({}); setSubmitError(''); }}
                      className={cn(
                        'glass-card rounded-2xl p-5 text-left transition border',
                        selected?.id === form.id ? 'border-aero/30 bg-aero/5' : 'border-transparent hover:border-white/10',
                      )}>
                      <div className="flex items-center gap-4">
                        {form.airline.branding?.logo_url ? (
                          <img src={form.airline.branding.logo_url} alt="Logo"
                            className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-aero/15 flex items-center justify-center text-aero font-bold text-lg flex-shrink-0">
                            {form.airline.icao_code[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono font-bold text-aero">{form.airline.icao_code}</span>
                            {form.airline.iata_code && <span className="text-xs text-gray-500 font-mono">/{form.airline.iata_code}</span>}
                            <span className="font-medium text-white">{form.airline.name}</span>
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', TIER_COLORS[form.airline.subscription_tier])}>
                              {form.airline.subscription_tier}
                            </span>
                            {hasApplied && <span className="text-[10px] text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Applied</span>}
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500">
                            {form.airline.hub_country && <span>📍 {form.airline.hub_country}</span>}
                            <span>👥 {form.airline._count.users} pilots</span>
                            <span>✈️ {form.airline._count.hulls} aircraft</span>
                            <span>❓ {form.questions.length} question{form.questions.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Application form panel */}
              {selected && (
                <div className="w-96 flex-shrink-0 sticky top-4">
                  <div className="glass-card rounded-2xl p-6 border border-aero/20">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold">{selected.title}</h3>
                      <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
                    </div>
                    <p className="text-xs text-gray-500 mb-5">Applying to <span className="text-white">{selected.airline.name}</span></p>

                    {selected.questions.length === 0 ? (
                      <p className="text-sm text-gray-400 mb-4">No questions — just submit to apply.</p>
                    ) : (
                      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {selected.questions.map((q, i) => (
                          <div key={q.id}>
                            <label className="text-sm text-gray-300 block mb-1.5">
                              {i + 1}. {q.question}
                              {q.required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            <textarea value={answers[q.id] ?? ''}
                              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                              required={q.required} rows={3}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition resize-none" />
                          </div>
                        ))}

                        {submitError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{submitError}</p>}

                        <button type="submit" disabled={submitting || hasAirline}
                          className="bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                          {submitting ? 'Submitting...' : 'Submit Application'}
                        </button>
                      </form>
                    )}

                    {selected.questions.length === 0 && (
                      <button onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                        disabled={submitting || hasAirline}
                        className="w-full bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                        {submitting ? 'Submitting...' : 'Submit Application'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* My Applications tab */}
      {tab === 'my' && (
        <div className="flex flex-col gap-3">
          {myApps.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-400 text-sm">You haven&apos;t applied to any airlines yet.</p>
            </div>
          ) : (
            myApps.map(app => (
              <div key={app.id} className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-aero">{app.airline.icao_code}</span>
                    <span className="font-medium text-white">{app.airline.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Applied {new Date(app.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {app.note && <p className="text-xs text-gray-600 mt-1 italic">"{app.note}"</p>}
                </div>
                <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0', STATUS_COLORS[app.status] ?? STATUS_COLORS.PENDING)}>
                  {app.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
