'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';
import { embed } from '@/lib/utils';

interface Stats {
  bot_tag: string;
  guild_member_count: number;
  total_warnings: number;
  total_mod_actions: number;
  linked_accounts: number;
  active_reminders: number;
  total_suggestions: number;
  total_tags: number;
}

const INVITE_URL = `https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=1502148042248159357`;

export default function BotOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    botApi.get('/stats')
      .then(r => setStats(r.data))
      .catch(() => setError('Could not reach bot API.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Aerobot Dashboard</h1>
          <p className="text-gray-400 text-sm">{stats?.bot_tag ?? 'Loading...'}</p>
        </div>
        <a
          href={INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold px-4 py-2.5 rounded-xl transition text-sm"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.874 19.874 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028 13.99 13.99 0 0 0 1.226-1.994.075.075 0 0 0-.041-.104 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
          Invite Bot to Server
        </a>
      </div>

      {error && <p className="text-red-400 text-sm mb-6">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Server Members', value: stats?.guild_member_count ?? '—' },
          { label: 'Linked Accounts', value: stats?.linked_accounts ?? '—' },
          { label: 'Total Warnings', value: stats?.total_warnings ?? '—' },
          { label: 'Mod Actions', value: stats?.total_mod_actions ?? '—' },
          { label: 'Active Reminders', value: stats?.active_reminders ?? '—' },
          { label: 'Suggestions', value: stats?.total_suggestions ?? '—' },
          { label: 'Custom Tags', value: stats?.total_tags ?? '—' },
          { label: 'Status', value: stats ? '🟢 Online' : loading ? '⏳ Checking' : '🔴 Offline' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
