'use client';

import { useEffect, useState, useCallback } from 'react';
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
  is_open: boolean;
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

interface AirlineProfile {
  id: string;
  name: string;
  icao_code: string;
  iata_code: string | null;
  hub_country: string | null;
  subscription_tier: string;
  branding: { logo_url?: string; primary_color?: string } | null;
  created_at: string;
  _count: { users: number; hulls: number; routes: number };
  application_form: {
    id: string;
    title: string;
    is_open: boolean;
    questions: Question[];
  } | null;
  stats: {
    total_flights: number;
    total_hours: number;
    avg_happiness: number | null;
  };
  recent_flights: {
    arrived_at: string | null;
    block_time_min: number | null;
    route: {
      origin: { icao: string; name: string };
      destination: { icao: string; name: string };
    };
    hull: { aircraft_type: string };
    pilot: { display_name: string };
  }[];
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

function ApplyModal({
  profile,
  onClose,
  onSuccess,
  hasAirline,
  alreadyApplied,
}: {
  profile: AirlineProfile;
  onClose: () => void;
  onSuccess: () => void;
  hasAirline: boolean;
  alreadyApplied: boolean;
}) {
  const form = profile.application_form;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true); setError('');
    const answersArray = form.questions.map(q => ({ question_id: q.id, answer: answers[q.id] ?? '' }));
    try {
      await api.post(`/applications/${form.id}/submit`, { answers: answersArray });
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to submit application.');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-card rounded-2xl border border-aero/20 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-lg">{form?.title ?? 'Apply'}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition">✕</button>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            Applying to <span className="text-white font-medium">{profile.name}</span>
          </p>

          {hasAirline && (
            <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
              You must leave your current airline before applying to another.
            </div>
          )}
          {alreadyApplied && (
            <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
              You have already applied to this airline.
            </div>
          )}

          {!hasAirline && !alreadyApplied && form && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {form.questions.length === 0 && (
                <p className="text-sm text-gray-400">No questions — just submit to express your interest.</p>
              )}
              {form.questions.map((q, i) => (
                <div key={q.id}>
                  <label className="text-sm text-gray-300 block mb-1.5">
                    {i + 1}. {q.question}
                    {q.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <textarea
                    value={answers[q.id] ?? ''}
                    onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    required={q.required} rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aero focus:outline-none transition resize-none"
                  />
                </div>
              ))}
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
              )}
              <button type="submit" disabled={submitting}
                className="bg-aero text-black font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          )}

          {!form && (
            <p className="text-sm text-gray-500 text-center py-4">This airline is not currently accepting applications.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AirlineProfileView({
  profile,
  onBack,
  onApply,
  hasAirline,
  alreadyApplied,
}: {
  profile: AirlineProfile;
  onBack: () => void;
  onApply: () => void;
  hasAirline: boolean;
  alreadyApplied: boolean;
}) {
  const isAccepting = profile.application_form?.is_open ?? false;
  const memberSince = new Date(profile.created_at).getFullYear();

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-6">
        <span>←</span> Back to Airlines
      </button>

      {/* Header */}
      <div className="glass-card rounded-2xl p-6 mb-5">
        <div className="flex items-start gap-5">
          {profile.branding?.logo_url ? (
            <img src={profile.branding.logo_url} alt="Logo"
              className="w-16 h-16 rounded-2xl object-contain bg-white/5 p-1 flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-aero/15 flex items-center justify-center text-aero font-bold text-2xl flex-shrink-0">
              {profile.icao_code[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono font-bold text-aero text-lg">{profile.icao_code}</span>
              {profile.iata_code && <span className="text-sm text-gray-500 font-mono">/{profile.iata_code}</span>}
              <h1 className="text-xl font-bold">{profile.name}</h1>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', TIER_COLORS[profile.subscription_tier])}>
                {profile.subscription_tier}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              {profile.hub_country && <span>📍 {profile.hub_country}</span>}
              <span>Founded {memberSince}</span>
              <span className={cn('font-medium', isAccepting ? 'text-green-400' : 'text-gray-500')}>
                {isAccepting ? '● Accepting Applications' : '○ Not Accepting Applications'}
              </span>
            </div>
          </div>

          {isAccepting && !alreadyApplied && (
            <button
              onClick={onApply}
              disabled={hasAirline}
              className="flex-shrink-0 bg-aero text-black font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply Now
            </button>
          )}
          {alreadyApplied && (
            <span className="flex-shrink-0 text-xs text-amber-400 border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 rounded-full font-medium">
              Applied
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Pilots', value: profile._count.users, icon: '👥' },
          { label: 'Fleet', value: profile._count.hulls, icon: '✈️' },
          { label: 'Routes', value: profile._count.routes, icon: '🌐' },
          { label: 'Total Flights', value: profile.stats.total_flights.toLocaleString(), icon: '🛫' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-xl font-bold text-aero">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Performance */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-bold mb-4">Airline Performance</h2>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Total Flight Hours', value: `${profile.stats.total_hours.toLocaleString()} hrs` },
              {
                label: 'Avg PAX Happiness',
                value: profile.stats.avg_happiness
                  ? `${Number(profile.stats.avg_happiness).toFixed(0)}%`
                  : '—',
              },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-gray-400">{row.label}</span>
                <span className="text-sm font-medium text-aero">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-bold mb-4">Recent Activity</h2>
          {profile.recent_flights.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No flights yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {profile.recent_flights.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <span className="font-mono text-xs text-aero">{f.route.origin.icao}</span>
                    <span className="text-gray-600 mx-1 text-xs">→</span>
                    <span className="font-mono text-xs text-aero">{f.route.destination.icao}</span>
                    <span className="text-gray-600 text-xs ml-2">· {f.hull.aircraft_type}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {f.arrived_at ? new Date(f.arrived_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  const { user } = useAuthStore();
  const [forms, setForms] = useState<AirlineForm[]>([]);
  const [myApps, setMyApps] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'browse' | 'my'>('browse');

  // Airline profile view
  const [selectedAirlineId, setSelectedAirlineId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AirlineProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Apply modal
  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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

  const loadProfile = useCallback(async (airlineId: string) => {
    setProfileLoading(true);
    setProfile(null);
    setSelectedAirlineId(airlineId);
    try {
      const { data } = await api.get(`/applications/airlines/${airlineId}/profile`);
      setProfile(data);
    } finally { setProfileLoading(false); }
  }, []);

  function handleBack() {
    setSelectedAirlineId(null);
    setProfile(null);
  }

  async function handleSuccess() {
    setShowModal(false);
    const airline = profile?.name ?? '';
    setSuccessMsg(`Your application to ${airline} has been submitted!`);
    const a = await api.get('/applications/my');
    setMyApps(a.data);
  }

  if (loading) return <div className="p-8"><div className="glass-card rounded-2xl h-64 animate-pulse" /></div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Join an Airline</h1>
        <p className="text-gray-400 text-sm">Browse virtual airlines and submit your application.</p>
      </div>

      {successMsg && (
        <div className="glass-card rounded-2xl p-4 mb-6 border border-green-500/20 bg-green-500/5 text-sm text-green-300">
          {successMsg}
        </div>
      )}

      {/* Profile drill-down */}
      {selectedAirlineId && (
        profileLoading ? (
          <div className="glass-card rounded-2xl h-64 animate-pulse" />
        ) : profile ? (
          <>
            <AirlineProfileView
              profile={profile}
              onBack={handleBack}
              onApply={() => setShowModal(true)}
              hasAirline={hasAirline}
              alreadyApplied={myApps.some(a => a.airline.icao_code === profile.icao_code)}
            />
            {showModal && (
              <ApplyModal
                profile={profile}
                onClose={() => setShowModal(false)}
                onSuccess={handleSuccess}
                hasAirline={hasAirline}
                alreadyApplied={myApps.some(a => a.airline.icao_code === profile.icao_code)}
              />
            )}
          </>
        ) : null
      )}

      {/* List view */}
      {!selectedAirlineId && (
        <>
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
            forms.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <p className="text-4xl mb-3">🏢</p>
                <p className="text-gray-400 text-sm">No airlines are currently accepting applications.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {forms.map(form => {
                  const hasApplied = myApps.some(a => a.airline.icao_code === form.airline.icao_code);
                  return (
                    <button key={form.id}
                      onClick={() => loadProfile(form.airline.id)}
                      className="glass-card rounded-2xl p-5 text-left transition border border-transparent hover:border-aero/30 hover:bg-aero/5 w-full">
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
                        <span className="text-xs text-gray-500 flex-shrink-0">View →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
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
                      {app.note && <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{app.note}&rdquo;</p>}
                    </div>
                    <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0', STATUS_COLORS[app.status] ?? STATUS_COLORS.PENDING)}>
                      {app.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
