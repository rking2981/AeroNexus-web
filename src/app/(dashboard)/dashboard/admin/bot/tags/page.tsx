'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';

interface Tag { id: string; name: string; response: string; embed: boolean; created_at: string; }

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [editing, setEditing] = useState<Partial<Tag> | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await botApi.get('/tags');
    setTags(data);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editing?.name || !editing?.response) return;
    setSaving(true);
    await botApi.post('/tags', { name: editing.name.toLowerCase(), response: editing.response, embed: editing.embed ?? false });
    setSaving(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this tag?')) return;
    await botApi.delete(`/tags/${id}`);
    setTags(t => t.filter(x => x.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Custom Tags</h1>
        <button onClick={() => setEditing({ embed: false })}
          className="bg-aero text-black font-bold px-4 py-2.5 rounded-xl text-sm hover:brightness-110 transition">
          + New Tag
        </button>
      </div>

      {editing && (
        <div className="glass-card rounded-2xl p-6 mb-6 border border-aero/20">
          <h2 className="font-bold mb-4">{editing.id ? 'Edit Tag' : 'New Tag'}</h2>
          <div className="flex flex-col gap-3">
            <input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="Tag name (e.g. rules, faq)"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none" />
            <textarea value={editing.response ?? ''} onChange={e => setEditing({ ...editing, response: e.target.value })}
              rows={4} placeholder="Response text..."
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none resize-none" />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing.embed ?? false}
                onChange={e => setEditing({ ...editing, embed: e.target.checked })}
                className="rounded" />
              <span className="text-gray-300">Send as embed</span>
            </label>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="bg-aero text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(null)}
                className="border border-white/10 text-gray-400 px-5 py-2.5 rounded-xl text-sm hover:bg-white/5 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {tags.length === 0 && <p className="text-gray-500 text-sm">No tags yet.</p>}
        {tags.map(tag => (
          <div key={tag.id} className="glass-card rounded-xl p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-aero font-bold text-sm">/{tag.name}</span>
                {tag.embed && <span className="text-xs text-purple-400 border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 rounded-full">embed</span>}
              </div>
              <p className="text-sm text-gray-400 truncate">{tag.response}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setEditing(tag)}
                className="text-xs text-aero border border-aero/20 px-3 py-1.5 rounded-lg hover:bg-aero/10 transition">Edit</button>
              <button onClick={() => handleDelete(tag.id)}
                className="text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
