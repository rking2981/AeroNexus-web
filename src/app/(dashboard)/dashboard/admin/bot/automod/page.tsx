'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';

interface AutomodConfig {
  anti_spam: boolean; spam_threshold: number; spam_window: number;
  anti_caps: boolean; caps_threshold: number;
  anti_links: boolean;
  anti_mentions: boolean; mention_threshold: number;
  anti_flood: boolean; flood_threshold: number; flood_window: number;
  bad_words: string[];
}

export default function AutomodPage() {
  const [cfg, setCfg] = useState<AutomodConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newWord, setNewWord] = useState('');

  useEffect(() => {
    botApi.get('/automod').then(r => setCfg(r.data));
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    await botApi.patch('/automod', cfg);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(key: keyof AutomodConfig) {
    if (!cfg) return;
    setCfg({ ...cfg, [key]: !(cfg[key] as boolean) });
  }

  function setNum(key: keyof AutomodConfig, val: number) {
    if (!cfg) return;
    setCfg({ ...cfg, [key]: val });
  }

  function addWord() {
    if (!cfg || !newWord.trim()) return;
    setCfg({ ...cfg, bad_words: [...cfg.bad_words, newWord.trim().toLowerCase()] });
    setNewWord('');
  }

  function removeWord(w: string) {
    if (!cfg) return;
    setCfg({ ...cfg, bad_words: cfg.bad_words.filter(x => x !== w) });
  }

  if (!cfg) return <div className="text-gray-500 animate-pulse">Loading...</div>;

  const Toggle = ({ k, label }: { k: keyof AutomodConfig; label: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-sm">{label}</span>
      <button onClick={() => toggle(k)}
        className={`relative w-11 h-6 rounded-full transition-colors ${cfg[k] ? 'bg-aero' : 'bg-white/20'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${cfg[k] ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );

  const NumField = ({ k, label, min, max }: { k: keyof AutomodConfig; label: string; min: number; max: number }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <input type="number" value={cfg[k] as number} min={min} max={max}
        onChange={e => setNum(k, parseInt(e.target.value))}
        className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white text-right focus:border-aero focus:outline-none" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Auto-Moderation</h1>
        <button onClick={save} disabled={saving}
          className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-bold mb-4 text-sm text-gray-400 uppercase tracking-wider">Toggles</h2>
          <Toggle k="anti_spam"     label="Anti-Spam" />
          <Toggle k="anti_caps"     label="Anti-Caps" />
          <Toggle k="anti_links"    label="Anti-Links" />
          <Toggle k="anti_mentions" label="Anti-Mention Spam" />
          <Toggle k="anti_flood"    label="Anti-Flood" />
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-bold mb-4 text-sm text-gray-400 uppercase tracking-wider">Thresholds</h2>
          <NumField k="spam_threshold"    label="Spam: messages before action" min={2} max={20} />
          <NumField k="spam_window"       label="Spam: window (seconds)" min={1} max={30} />
          <NumField k="caps_threshold"    label="Caps: minimum percent" min={50} max={100} />
          <NumField k="mention_threshold" label="Mentions: max per message" min={2} max={20} />
          <NumField k="flood_threshold"   label="Flood: messages before action" min={3} max={30} />
          <NumField k="flood_window"      label="Flood: window (seconds)" min={1} max={60} />
        </div>

        <div className="glass-card rounded-2xl p-6 md:col-span-2">
          <h2 className="font-bold mb-4 text-sm text-gray-400 uppercase tracking-wider">Banned Words</h2>
          <div className="flex gap-2 mb-4">
            <input value={newWord} onChange={e => setNewWord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWord()}
              placeholder="Add word or phrase..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none" />
            <button onClick={addWord} className="bg-aero text-black font-bold px-4 py-2.5 rounded-xl text-sm hover:brightness-110 transition">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cfg.bad_words.length === 0 && <p className="text-gray-500 text-sm">No banned words.</p>}
            {cfg.bad_words.map(w => (
              <span key={w} className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-full">
                {w}
                <button onClick={() => removeWord(w)} className="hover:text-red-300 transition">×</button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
