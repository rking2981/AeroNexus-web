'use client';
import { useEffect, useState } from 'react';
import botApi from '@/lib/bot-api';

interface Field { name: string; value: string; inline: boolean; }

interface EmbedData {
  channel_id: string;
  title: string;
  description: string;
  color: string;
  footer: string;
  image_url: string;
  fields: Field[];
}

const PRESET_COLORS = ['#00D1FF', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444', '#ffffff', '#1e293b'];

export default function EmbedBuilderPage() {
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [embed, setEmbed] = useState<EmbedData>({
    channel_id: '', title: '', description: '', color: '#00D1FF',
    footer: '', image_url: '', fields: [],
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    botApi.get('/channels').then(r => setChannels(r.data));
  }, []);

  function addField() {
    setEmbed(e => ({ ...e, fields: [...e.fields, { name: '', value: '', inline: false }] }));
  }

  function updateField(i: number, key: keyof Field, val: string | boolean) {
    const fields = [...embed.fields];
    fields[i] = { ...fields[i], [key]: val };
    setEmbed(e => ({ ...e, fields }));
  }

  function removeField(i: number) {
    setEmbed(e => ({ ...e, fields: e.fields.filter((_, idx) => idx !== i) }));
  }

  async function handleSend() {
    if (!embed.channel_id) { setResult({ ok: false, message: 'Select a channel.' }); return; }
    setSending(true); setResult(null);
    try {
      await botApi.post('/send-embed', embed);
      setResult({ ok: true, message: 'Embed sent successfully!' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setResult({ ok: false, message: msg ?? 'Failed to send.' });
    } finally { setSending(false); }
  }

  const previewColor = embed.color || '#00D1FF';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Embed Builder</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Builder */}
        <div className="flex flex-col gap-4">
          {/* Channel */}
          <div className="glass-card rounded-2xl p-5">
            <label className="text-xs text-gray-400 block mb-1.5">Send to Channel</label>
            <select value={embed.channel_id} onChange={e => setEmbed(x => ({ ...x, channel_id: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white focus:border-aero focus:outline-none">
              <option value="">— Select channel —</option>
              {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>

          {/* Content */}
          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Title</label>
              <input value={embed.title} onChange={e => setEmbed(x => ({ ...x, title: e.target.value }))}
                placeholder="Embed title..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Description</label>
              <textarea value={embed.description} onChange={e => setEmbed(x => ({ ...x, description: e.target.value }))}
                rows={5} placeholder="Embed description... Supports **bold**, *italic*, and [links](url)"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Footer</label>
              <input value={embed.footer} onChange={e => setEmbed(x => ({ ...x, footer: e.target.value }))}
                placeholder="Footer text..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Image URL (optional)</label>
              <input value={embed.image_url} onChange={e => setEmbed(x => ({ ...x, image_url: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none" />
            </div>
          </div>

          {/* Color */}
          <div className="glass-card rounded-2xl p-5">
            <label className="text-xs text-gray-400 block mb-3">Accent Color</label>
            <div className="flex items-center gap-3 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setEmbed(x => ({ ...x, color: c }))}
                  style={{ background: c }}
                  className={`w-8 h-8 rounded-full border-2 transition ${embed.color === c ? 'border-white scale-110' : 'border-transparent'}`} />
              ))}
              <input type="color" value={embed.color}
                onChange={e => setEmbed(x => ({ ...x, color: e.target.value }))}
                className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent" />
              <span className="text-xs text-gray-500 font-mono">{embed.color}</span>
            </div>
          </div>

          {/* Fields */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-gray-400">Fields ({embed.fields.length}/25)</label>
              <button onClick={addField} disabled={embed.fields.length >= 25}
                className="text-xs text-aero border border-aero/20 px-3 py-1 rounded-lg hover:bg-aero/10 transition disabled:opacity-40">
                + Add Field
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {embed.fields.map((f, i) => (
                <div key={i} className="border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                  <input value={f.name} onChange={e => updateField(i, 'name', e.target.value)}
                    placeholder="Field name..."
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none" />
                  <textarea value={f.value} onChange={e => updateField(i, 'value', e.target.value)}
                    rows={2} placeholder="Field value..."
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none resize-none" />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={f.inline} onChange={e => updateField(i, 'inline', e.target.checked)} />
                      Inline
                    </label>
                    <button onClick={() => removeField(i)}
                      className="text-xs text-red-400 hover:text-red-300 transition">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Send */}
          <button onClick={handleSend} disabled={sending}
            className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3 rounded-xl transition text-sm disabled:opacity-50">
            {sending ? 'Sending...' : '📤 Send to Discord'}
          </button>
          {result && (
            <p className={`text-sm text-center ${result.ok ? 'text-green-400' : 'text-red-400'}`}>{result.message}</p>
          )}
        </div>

        {/* Preview */}
        <div className="sticky top-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Preview</p>
          <div className="bg-[#36393f] rounded-xl p-4 font-sans">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-[#5865F2] flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">A</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm mb-1">Aerobot <span className="text-xs text-[#5865F2] font-bold bg-[#5865F2]/20 px-1 rounded">BOT</span></p>
                <div className="rounded-md overflow-hidden" style={{ borderLeft: `4px solid ${previewColor}`, background: '#2f3136', padding: '12px' }}>
                  {embed.title && <p className="text-white font-bold text-sm mb-2">{embed.title}</p>}
                  {embed.description && (
                    <p className="text-[#dcddde] text-sm leading-relaxed whitespace-pre-wrap">{embed.description}</p>
                  )}
                  {embed.fields.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {embed.fields.map((f, i) => (
                        <div key={i} className={f.inline ? '' : 'col-span-2'}>
                          <p className="text-white text-xs font-bold mb-0.5">{f.name || 'Field Name'}</p>
                          <p className="text-[#dcddde] text-xs">{f.value || 'Field value'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {embed.image_url && (
                    <img src={embed.image_url} alt="" className="mt-3 rounded-md max-w-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  {embed.footer && <p className="text-[#72767d] text-xs mt-3">{embed.footer}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
