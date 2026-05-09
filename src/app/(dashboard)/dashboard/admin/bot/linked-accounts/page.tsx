'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';

interface LinkedAccount { discord_id: string; an_user_id: string; an_email: string; linked_at: string; }

export default function LinkedAccountsPage() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    botApi.get('/linked-accounts').then(r => setAccounts(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = accounts.filter(a =>
    a.an_email.includes(search) || a.discord_id.includes(search) || a.an_user_id.includes(search)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Linked Accounts <span className="text-gray-500 text-base font-normal">({accounts.length})</span></h1>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by email, Discord ID, or user ID..."
        className="w-full mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none" />

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5">
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3">AeroNexus Email</th>
              <th className="text-left px-4 py-3">Discord ID</th>
              <th className="text-left px-4 py-3">AN User ID</th>
              <th className="text-left px-4 py-3">Linked</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">No results.</td></tr>
            ) : filtered.map(a => (
              <tr key={a.discord_id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                <td className="px-4 py-3 text-gray-300">{a.an_email}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{a.discord_id}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{a.an_user_id}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(a.linked_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
