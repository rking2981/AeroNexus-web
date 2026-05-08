'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MissionBuilderProps {
  onClose: () => void;
  onCreated: (mission: CreatedMission) => void;
}

interface CreatedMission {
  id: string;
  origin_icao: string;
  destination_icao: string;
  distance_nm: number;
  mission_type: string;
  skyops_brief: string | null;
  notes: string | null;
  cargo_kg: number | null;
  pilot_pay: number;
  xp_bonus: number;
  min_block_time_min: number | null;
  training_min_happiness: number | null;
  training_max_vs_fpm: number | null;
  airline: { name: string; icao_code: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MISSION_TYPES = [
  { value: 'CARGO',     label: '📦 Cargo Mission',      desc: 'Transport goods, supplies, or freight' },
  { value: 'PASSENGER', label: '✈️ Passenger Charter',  desc: 'VIP, charter, or special group transport' },
  { value: 'TRAINING',  label: '🎓 Training Flight',    desc: 'Pilot evaluation with pass/fail criteria' },
  { value: 'CUSTOM',    label: '⭐ Custom Mission',      desc: 'Fully custom scenario of your design' },
];

const MISSION_STYLES = [
  { value: '',            label: 'Let AeroNexus decide' },
  { value: 'ROUTINE',     label: 'Routine — standard ops' },
  { value: 'URGENT',      label: 'Urgent — time-sensitive' },
  { value: 'VIP',         label: 'VIP — high-profile passenger or cargo' },
  { value: 'HUMANITARIAN',label: 'Humanitarian — aid or relief' },
  { value: 'COMMERCIAL',  label: 'Commercial — revenue-focused' },
];

const STEPS = [
  { num: 1, title: 'Mission Type & Route',  subtitle: 'Choose your mission type and airports',                    icon: '✈️' },
  { num: 2, title: 'Mission Details',       subtitle: 'Answer these questions to customize your mission',         icon: '❓' },
  { num: 3, title: 'Review & Create',       subtitle: 'Review your mission details',                              icon: '✓' },
];

const ACCENT = '#3b82f6'; // blue — neutral across all mission types, matches reference UI

function composeBrief(form: Step1Form & Step2Form): string {
  const lines: string[] = [];
  const type = MISSION_TYPES.find(t => t.value === form.mission_type)?.label ?? form.mission_type;
  const style = form.mission_style ? `Style: ${form.mission_style}.` : '';

  lines.push(`Mission Type: ${type}. ${style}`.trim());
  if (form.callsign) lines.push(`Callsign: ${form.callsign}.`);
  if (form.what_transporting) lines.push(`Cargo/Payload: ${form.what_transporting}.`);
  if (form.why_urgent) lines.push(`Urgency: ${form.why_urgent}.`);
  if (form.special_cargo) lines.push(`Special handling: ${form.special_cargo}.`);
  if (form.who_needs) lines.push(`Recipient: ${form.who_needs}.`);
  if (form.pax_count && Number(form.pax_count) > 0) lines.push(`Passengers/Personnel: ${form.pax_count}.`);
  if (form.backstory) lines.push(`Background: ${form.backstory}`);
  if (form.special_requirements) lines.push(`Special requirements: ${form.special_requirements}.`);
  return lines.join('\n');
}

// ─── Form state types ─────────────────────────────────────────────────────────

interface Step1Form {
  mission_type: string;
  mission_style: string;
  origin_icao: string;
  destination_icao: string;
  range_min: string;
  range_max: string;
  callsign: string;
  aircraft_category: string;
  required_aircraft_icao: string;
  pilot_pay: string;
  xp_bonus: string;
  cargo_kg: string;
  min_block_time_min: string;
  training_min_happiness: string;
  training_max_vs_fpm: string;
}

interface Step2Form {
  what_transporting: string;
  why_urgent: string;
  special_cargo: string;
  who_needs: string;
  pax_count: string;
  backstory: string;
  special_requirements: string;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / (total + 1)) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>Step {step} of {total}</span>
        <span>{pct}% Complete</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: ACCENT }} />
      </div>
    </div>
  );
}

// ─── Step header ──────────────────────────────────────────────────────────────

function StepHeader({ step }: { step: typeof STEPS[number] }) {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"
        style={{ background: `${ACCENT}22`, border: `2px solid ${ACCENT}60` }}>
        {step.icon}
      </div>
      <h2 className="text-xl font-bold text-white mb-1">{step.title}</h2>
      <p className="text-sm text-gray-400">{step.subtitle}</p>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-gray-200 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none transition';
const selectCls = inputCls + ' bg-[#111]';
const textareaCls = inputCls + ' resize-none';

// ─── Main component ───────────────────────────────────────────────────────────

export default function SkyOpsMissionBuilder({ onClose, onCreated }: MissionBuilderProps) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdMission, setCreatedMission] = useState<CreatedMission | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const [s1, setS1] = useState<Step1Form>({
    mission_type: '', mission_style: '', origin_icao: '',
    destination_icao: '', range_min: '10', range_max: '50',
    callsign: '', aircraft_category: 'FIXED_WING',
    required_aircraft_icao: '', pilot_pay: '', xp_bonus: '500',
    cargo_kg: '', min_block_time_min: '',
    training_min_happiness: '80', training_max_vs_fpm: '-350',
  });

  const [s2, setS2] = useState<Step2Form>({
    what_transporting: '', why_urgent: '', special_cargo: '',
    who_needs: '', pax_count: '0', backstory: '', special_requirements: '',
  });

  function p1(k: keyof Step1Form, v: string) { setS1(prev => ({ ...prev, [k]: v })); }
  function p2(k: keyof Step2Form, v: string) { setS2(prev => ({ ...prev, [k]: v })); }

  // ── Review summary items ────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true); setGenerateError('');
    try {
      const { data } = await api.post('/integrations/mission/generate', {
        mission_type: s1.mission_type,
        mission_style: s1.mission_style || undefined,
        origin_icao: s1.origin_icao,
        destination_icao: s1.destination_icao || undefined,
        range_min: s1.range_min ? Number(s1.range_min) : undefined,
        range_max: s1.range_max ? Number(s1.range_max) : undefined,
        callsign: s1.callsign || undefined,
        aircraft_category: s1.aircraft_category || undefined,
        cargo_kg: s1.cargo_kg ? Number(s1.cargo_kg) : undefined,
        what_transporting: s2.what_transporting || undefined,
        why_urgent: s2.why_urgent || undefined,
        special_cargo: s2.special_cargo || undefined,
        who_needs: s2.who_needs || undefined,
        pax_count: Number(s2.pax_count) || undefined,
        backstory: s2.backstory || undefined,
        special_requirements: s2.special_requirements || undefined,
      });
      // Populate only blank fields — don't overwrite what the user already typed
      if (!s2.backstory && data.brief) p2('backstory', data.brief);
      if (!s1.destination_icao && data.destination_icao) p1('destination_icao', data.destination_icao);
      // Store the AI title as notes so it's visible on the card
      if (data.title && !s1.callsign) p1('callsign', data.title.slice(0, 20));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setGenerateError(msg ?? 'AI generation failed. Check that ANTHROPIC_API_KEY is set.');
    } finally { setGenerating(false); }
  }

  const reviewItems = [
    { label: 'Mission Type', value: MISSION_TYPES.find(t => t.value === s1.mission_type)?.label ?? '—' },
    { label: 'Route', value: s1.origin_icao ? `${s1.origin_icao} → ${s1.destination_icao || 'AI decides'}` : '—' },
    { label: 'Style', value: s1.mission_style || 'AI decides' },
    { label: 'Aircraft', value: s1.aircraft_category || 'Any' },
    ...(s1.pilot_pay ? [{ label: s1.mission_type === 'TRAINING' ? 'XP Bonus' : 'Pilot Pay', value: s1.mission_type === 'TRAINING' ? `${s1.xp_bonus} XP` : `$${Number(s1.pilot_pay).toLocaleString()}` }] : []),
    ...(s2.what_transporting ? [{ label: 'Payload', value: s2.what_transporting }] : []),
    ...(s2.why_urgent ? [{ label: 'Urgency', value: s2.why_urgent }] : []),
    ...(s2.backstory ? [{ label: 'Backstory', value: s2.backstory.slice(0, 80) + (s2.backstory.length > 80 ? '…' : '') }] : []),
  ];

  // ── Create mission ──────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!s1.mission_type || !s1.origin_icao) {
      setCreateError('Mission type and departure airport are required.');
      return;
    }
    setCreating(true); setCreateError('');

    const skyops_brief = composeBrief({ ...s1, ...s2 });
    const notes = [
      s1.mission_style ? `[${s1.mission_style}]` : '',
      s2.what_transporting,
      s2.why_urgent,
    ].filter(Boolean).join(' — ') || null;

    try {
      const { data } = await api.post('/contracts/skyops', {
        origin_icao: s1.origin_icao,
        destination_icao: s1.destination_icao || undefined,
        mission_type: s1.mission_type,
        aircraft_category: s1.aircraft_category,
        required_aircraft_icao: s1.required_aircraft_icao || undefined,
        cargo_kg: s1.cargo_kg ? Number(s1.cargo_kg) : undefined,
        pilot_pay: s1.mission_type === 'TRAINING' ? 0 : Number(s1.pilot_pay || 0),
        xp_bonus: Number(s1.xp_bonus || 500),
        min_block_time_min: s1.min_block_time_min ? Number(s1.min_block_time_min) : undefined,
        skyops_brief,
        notes: notes || undefined,
        training_min_happiness: s1.mission_type === 'TRAINING' ? Number(s1.training_min_happiness) : undefined,
        training_max_vs_fpm: s1.mission_type === 'TRAINING' ? Number(s1.training_max_vs_fpm) : undefined,
      });
      setCreatedMission(data);
      setStep(4); // result step
      onCreated(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create mission');
    } finally { setCreating(false); }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[94vh] overflow-y-auto rounded-2xl"
        style={{ background: '#0d1117', border: `1px solid ${ACCENT}40` }}>

        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span style={{ color: ACCENT }}>✏️</span>
            <span className="font-bold text-white">SkyOps Mission Builder</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition text-xl">✕</button>
        </div>

        <div className="px-6 py-4">

          {/* ── Progress ── */}
          {step <= 3 && <div className="mb-6"><ProgressBar step={step} total={3} /></div>}

          {/* ══════════════════════════════════════════
              STEP 1 — Mission Type & Route
          ══════════════════════════════════════════ */}
          {step === 1 && (
            <>
              <StepHeader step={STEPS[0]} />
              <div className="flex flex-col gap-4">

                <Field label="🏷 Mission Type" required hint="The AI will tailor the mission brief based on this type">
                  <select value={s1.mission_type} onChange={e => p1('mission_type', e.target.value)} className={selectCls}>
                    <option value="">Select mission type...</option>
                    {MISSION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                    ))}
                  </select>
                </Field>

                <Field label="🌐 Mission Style" hint="The overall mood and style of the mission">
                  <select value={s1.mission_style} onChange={e => p1('mission_style', e.target.value)} className={selectCls}>
                    {MISSION_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="📍 Departure Airport (ICAO)" required hint="3-4 letter ICAO code (e.g., KJFK, KORD)">
                    <input value={s1.origin_icao} onChange={e => p1('origin_icao', e.target.value.toUpperCase())}
                      placeholder="KJFK" maxLength={4} className={inputCls} />
                  </Field>
                  <Field label="📍 Destination Airport (ICAO)" hint="Leave blank to set manually or fill later">
                    <input value={s1.destination_icao} onChange={e => p1('destination_icao', e.target.value.toUpperCase())}
                      placeholder="KORD" maxLength={4} className={inputCls} />
                  </Field>
                </div>

                <Field label="↔ Range Preference (nm)">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input type="number" value={s1.range_min} onChange={e => p1('range_min', e.target.value)}
                        placeholder="10" className={inputCls} />
                      <p className="text-xs text-gray-600 mt-1">Minimum</p>
                    </div>
                    <div>
                      <input type="number" value={s1.range_max} onChange={e => p1('range_max', e.target.value)}
                        placeholder="50" className={inputCls} />
                      <p className="text-xs text-gray-600 mt-1">Maximum</p>
                    </div>
                  </div>
                  <p className="text-xs mt-1" style={{ color: ACCENT }}>Only applies if destination is left blank</p>
                </Field>

                <Field label="📻 Callsign" hint="Leave blank to use your airline callsign">
                  <input value={s1.callsign} onChange={e => p1('callsign', e.target.value.toUpperCase())}
                    placeholder="e.g. MLA001 (optional)" className={inputCls} />
                </Field>

                <Field label="✈️ Aircraft Category">
                  <select value={s1.aircraft_category} onChange={e => p1('aircraft_category', e.target.value)} className={selectCls}>
                    <option value="FIXED_WING">Fixed Wing</option>
                    <option value="HELICOPTER">Helicopter</option>
                    <option value="CARGO">Cargo Aircraft</option>
                  </select>
                </Field>

                {/* Type-specific fields */}
                {s1.mission_type === 'CARGO' && (
                  <Field label="⚖️ Cargo Weight (kg)" hint="Leave blank for a free-form mission">
                    <input type="number" value={s1.cargo_kg} onChange={e => p1('cargo_kg', e.target.value)}
                      placeholder="e.g. 5000" className={inputCls} />
                  </Field>
                )}

                {s1.mission_type !== 'TRAINING' && (
                  <Field label="💰 Pilot Pay ($)" hint="Leave as 0 for XP-only">
                    <input type="number" value={s1.pilot_pay} onChange={e => p1('pilot_pay', e.target.value)}
                      placeholder="e.g. 5000" className={inputCls} />
                  </Field>
                )}

                <Field label="⭐ XP Bonus">
                  <input type="number" value={s1.xp_bonus} onChange={e => p1('xp_bonus', e.target.value)}
                    placeholder="500" className={inputCls} />
                </Field>

                {s1.mission_type === 'TRAINING' && (
                  <div className="glass-card rounded-xl p-4 border border-purple-500/20">
                    <p className="text-xs font-bold text-purple-400 mb-3 uppercase tracking-wide">Training Pass Criteria</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Min PAX Happiness %" hint="e.g. 80">
                        <input type="number" value={s1.training_min_happiness} onChange={e => p1('training_min_happiness', e.target.value)}
                          placeholder="80" className={inputCls} />
                      </Field>
                      <Field label="Max Landing VS (fpm)" hint="e.g. -350">
                        <input type="number" value={s1.training_max_vs_fpm} onChange={e => p1('training_max_vs_fpm', e.target.value)}
                          placeholder="-350" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 rounded-xl border border-white/5 p-3" style={{ background: 'rgba(59,130,246,0.06)' }}>
                  ℹ️ <strong className="text-gray-300">Destination Airport:</strong> Optional. Leave blank if you want to specify it manually when a pilot accepts.
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              STEP 2 — Mission Details
          ══════════════════════════════════════════ */}
          {step === 2 && (
            <>
              <StepHeader step={STEPS[1]} />
              <div className="rounded-xl px-4 py-3 mb-4 text-xs border"
                style={{ background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.25)', color: '#fbbf24' }}>
                ⭐ <strong>All fields are optional!</strong> Leave any field blank and AeroNexus will fill in sensible defaults, creating a unique mission each time.
              </div>

              <div className="flex flex-col gap-4">
                <Field label="📦 What are you transporting?">
                  <textarea value={s2.what_transporting} onChange={e => p2('what_transporting', e.target.value)}
                    rows={2} placeholder="e.g., Medical supplies, relief equipment, luxury goods, VIP passengers…"
                    className={textareaCls} />
                </Field>

                <Field label="⚡ Why is this urgent?">
                  <textarea value={s2.why_urgent} onChange={e => p2('why_urgent', e.target.value)}
                    rows={2} placeholder="e.g., Hospital needs supplies, time-sensitive delivery, client meeting…"
                    className={textareaCls} />
                </Field>

                <Field label="ℹ️ What's special about this cargo/mission?">
                  <textarea value={s2.special_cargo} onChange={e => p2('special_cargo', e.target.value)}
                    rows={2} placeholder="e.g., Temperature-sensitive, fragile, requires special handling…"
                    className={textareaCls} />
                </Field>

                <Field label="👤 Who needs this / who's on board?">
                  <textarea value={s2.who_needs} onChange={e => p2('who_needs', e.target.value)}
                    rows={2} placeholder="e.g., Hospital emergency dept, remote community, VIP executive and assistant…"
                    className={textareaCls} />
                </Field>

                <Field label="👥 Number of People / Passengers">
                  <input type="number" value={s2.pax_count} onChange={e => p2('pax_count', e.target.value)}
                    min={0} placeholder="0" className={inputCls} />
                </Field>

                <Field label="📖 Mission Backstory">
                  <textarea value={s2.backstory} onChange={e => p2('backstory', e.target.value)}
                    rows={4} placeholder="Optional: Provide a backstory or context for the mission. The more detail you add, the more immersive the ATC and crew experience will be."
                    className={textareaCls} />
                </Field>

                <Field label="⚠️ Special Requirements">
                  <textarea value={s2.special_requirements} onChange={e => p2('special_requirements', e.target.value)}
                    rows={2} placeholder="e.g., Avoid populated areas, low-altitude flight preferred, night operations…"
                    className={textareaCls} />
                </Field>

                <div className="rounded-xl px-4 py-3 text-xs border"
                  style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                  💡 <strong>Tip:</strong> The more details you provide, the more personalized the mission brief and the more contextually aware the SayIntentions.AI crew will be. But blank fields are fine too.
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              STEP 3 — Review & Create
          ══════════════════════════════════════════ */}
          {step === 3 && (
            <>
              <StepHeader step={STEPS[2]} />

              {/* AI Fill button */}
              <div className="rounded-xl p-4 mb-4 flex items-start justify-between gap-4"
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-300 mb-0.5">🤖 AI Mission Generator</p>
                  <p className="text-xs text-gray-400">
                    Let Claude fill in blank fields — destination airport, mission brief, and context — based on what you've provided.
                  </p>
                  {generateError && <p className="text-xs text-red-400 mt-1">{generateError}</p>}
                </div>
                <button onClick={handleGenerate} disabled={generating}
                  className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-xl transition disabled:opacity-50 text-white"
                  style={{ background: generating ? '#374151' : '#3b82f6' }}>
                  {generating ? 'Generating…' : 'Fill Blanks'}
                </button>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {reviewItems.map(item => (
                  <div key={item.label} className="flex justify-between items-start gap-4 py-2 border-b border-white/5 last:border-0 text-sm">
                    <span className="text-gray-500 flex-shrink-0">{item.label}</span>
                    <span className="text-white text-right">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Composed brief preview */}
              {(s2.what_transporting || s2.backstory || s2.why_urgent) && (
                <div className="rounded-xl p-4 mb-4 border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Mission Brief Preview</p>
                  <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap font-mono">
                    {composeBrief({ ...s1, ...s2 })}
                  </p>
                </div>
              )}

              {createError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                  {createError}
                </p>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════
              STEP 4 — Mission Created
          ══════════════════════════════════════════ */}
          {step === 4 && createdMission && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
                ✓
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Mission Created!</h2>
              <p className="text-sm text-gray-400 mb-6">
                Your SkyOps mission has been posted to the board.
              </p>
              <div className="text-left glass-card rounded-xl p-4 mb-6 text-sm">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-500">Type</span>
                  <span className="text-white">{MISSION_TYPES.find(t => t.value === createdMission.mission_type)?.label}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-500">Route</span>
                  <span className="font-mono text-aero">{createdMission.origin_icao} → {createdMission.destination_icao}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Distance</span>
                  <span className="text-white">{createdMission.distance_nm.toLocaleString()} nm</span>
                </div>
              </div>
              <button onClick={onClose}
                className="w-full font-bold py-3 rounded-xl text-black transition"
                style={{ background: ACCENT }}>
                Done
              </button>
            </div>
          )}

        </div>

        {/* ── Footer navigation (steps 1–3 only) ── */}
        {step <= 3 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/8">
            <button onClick={onClose}
              className="text-sm text-gray-500 hover:text-white border border-white/10 px-4 py-2 rounded-xl transition">
              Cancel
            </button>
            <div className="flex gap-2">
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="text-sm border border-white/20 text-gray-300 hover:text-white px-4 py-2 rounded-xl transition flex items-center gap-1">
                  ← Previous
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => {
                    if (step === 1 && !s1.mission_type) return;
                    if (step === 1 && !s1.origin_icao) return;
                    setStep(s => s + 1);
                  }}
                  disabled={step === 1 && (!s1.mission_type || !s1.origin_icao)}
                  className="text-sm font-bold px-6 py-2 rounded-xl transition disabled:opacity-40 flex items-center gap-1"
                  style={{ background: ACCENT, color: '#fff' }}>
                  Next →
                </button>
              ) : (
                <button onClick={handleCreate} disabled={creating}
                  className="text-sm font-bold px-6 py-2 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                  style={{ background: '#22c55e', color: '#fff' }}>
                  {creating ? 'Creating…' : '✈️ Create Mission'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
