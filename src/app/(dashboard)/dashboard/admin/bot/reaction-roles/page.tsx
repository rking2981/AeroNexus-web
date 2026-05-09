'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';

interface RREntry { id: string; emoji: string; role_id: string; label: string | null; }
interface RRMenu { id: string; channel_id: string; message_id: string; title: string; description: string | null; exclusive: boolean; created_at: string; entries: RREntry[]; }

export default function ReactionRolesPage() {
  const [menus, setMenus] = useState<RRMenu[]>([]);

  async function load() {
    const { data } = await botApi.get('/reaction-roles');
    setMenus(data);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this menu? The Discord message will also be deleted.')) return;
    await botApi.delete(`/reaction-roles/${id}`);
    setMenus(m => m.filter(x => x.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reaction Roles</h1>
        <p className="text-sm text-gray-500">Use <code className="text-aero">/reactionrole create</code> in Discord to add menus</p>
      </div>

      {menus.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-gray-500">
          <p className="mb-2">No reaction role menus yet.</p>
          <p className="text-sm">Use <code className="text-aero">/reactionrole create</code> in Discord to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {menus.map(menu => (
            <div key={menu.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-bold">{menu.title}</h2>
                  {menu.description && <p className="text-sm text-gray-400 mt-0.5">{menu.description}</p>}
                  <div className="flex gap-2 mt-2 text-xs text-gray-500">
                    <span>Channel: <span className="font-mono text-gray-400">{menu.channel_id}</span></span>
                    <span>·</span>
                    <span>Msg: <span className="font-mono text-gray-400">{menu.message_id}</span></span>
                    {menu.exclusive && <span>· <span className="text-amber-400">Exclusive</span></span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(menu.id)}
                  className="text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition flex-shrink-0">
                  Delete
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {menu.entries.map(e => (
                  <div key={e.id} className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                    <span>{e.emoji}</span>
                    <span className="text-gray-300">{e.label ?? `Role ${e.role_id.slice(-4)}`}</span>
                  </div>
                ))}
                {menu.entries.length === 0 && <p className="text-xs text-gray-500">No roles added yet. Use <code className="text-aero">/reactionrole add</code></p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
