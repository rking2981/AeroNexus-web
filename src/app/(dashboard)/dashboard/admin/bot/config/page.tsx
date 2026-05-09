'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';

interface GuildConfig {
  log_channel_id: string | null;
  welcome_channel_id: string | null;
  welcome_message: string | null;
  leave_channel_id: string | null;
  leave_message: string | null;
  auto_role_id: string | null;
  mute_role_id: string | null;
  mod_channel_id: string | null;
  starboard_channel_id: string | null;
  starboard_threshold: number;
  starboard_emoji: string;
  suggestions_channel_id: string | null;
  an_flights_channel_id: string | null;
  an_events_channel_id: string | null;
  an_pilots_channel_id: string | null;
}

interface Channel { id: string; name: string; }
interface Role { id: string; name: string; color: string; }

export default function BotConfigPage() {
  const [cfg, setCfg] = useState<GuildConfig | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([botApi.get('/config'), botApi.get('/channels'), botApi.get('/roles')])
      .then(([c, ch, r]) => { setCfg(c.data); setChannels(ch.data); setRoles(r.data); });
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    await botApi.patch('/config', cfg);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!cfg) return <div className="text-gray-500 animate-pulse">Loading...</div>;

  const ChannelSelect = ({ label, field }: { label: string; field: keyof GuildConfig }) => (
    <div>
      <label className="text-xs text-gray-400 block mb-1.5">{label}</label>
      <select value={cfg[field] as string ?? ''}
        onChange={e => setCfg({ ...cfg, [field]: e.target.value || null })}
        className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white focus:border-aero focus:outline-none">
        <option value="">— Not set —</option>
        {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
      </select>
    </div>
  );

  const RoleSelect = ({ label, field }: { label: string; field: keyof GuildConfig }) => (
    <div>
      <label className="text-xs text-gray-400 block mb-1.5">{label}</label>
      <select value={cfg[field] as string ?? ''}
        onChange={e => setCfg({ ...cfg, [field]: e.target.value || null })}
        className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white focus:border-aero focus:outline-none">
        <option value="">— Not set —</option>
        {roles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bot Configuration</h1>
        <button onClick={save} disabled={saving}
          className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Logging & Moderation</h2>
          <ChannelSelect label="Log Channel" field="log_channel_id" />
          <ChannelSelect label="Mod Log Channel" field="mod_channel_id" />
          <RoleSelect label="Mute Role" field="mute_role_id" />
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Welcome & Leave</h2>
          <ChannelSelect label="Welcome Channel" field="welcome_channel_id" />
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Welcome Message</label>
            <input value={cfg.welcome_message ?? ''}
              onChange={e => setCfg({ ...cfg, welcome_message: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-aero focus:outline-none"
              placeholder="Use {user}, {server}, {count}" />
          </div>
          <ChannelSelect label="Leave Channel" field="leave_channel_id" />
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Leave Message</label>
            <input value={cfg.leave_message ?? ''}
              onChange={e => setCfg({ ...cfg, leave_message: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-aero focus:outline-none"
              placeholder="Use {user}, {username}, {server}" />
          </div>
          <RoleSelect label="Auto Role (on join)" field="auto_role_id" />
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Starboard</h2>
          <ChannelSelect label="Starboard Channel" field="starboard_channel_id" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Emoji</label>
              <input value={cfg.starboard_emoji}
                onChange={e => setCfg({ ...cfg, starboard_emoji: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-aero focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Threshold</label>
              <input type="number" min={1} value={cfg.starboard_threshold}
                onChange={e => setCfg({ ...cfg, starboard_threshold: parseInt(e.target.value) })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-aero focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Suggestions</h2>
          <ChannelSelect label="Suggestions Channel" field="suggestions_channel_id" />
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4 md:col-span-2">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">AeroNexus Notifications</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChannelSelect label="Live Flights Channel" field="an_flights_channel_id" />
            <ChannelSelect label="Events Channel" field="an_events_channel_id" />
            <ChannelSelect label="Pilot Updates Channel" field="an_pilots_channel_id" />
          </div>
        </div>
      </div>
    </div>
  );
}
