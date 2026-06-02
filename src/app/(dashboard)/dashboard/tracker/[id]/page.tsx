'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const SEV_COLOR: Record<string, string> = {
  INFORMATIONAL: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  LOW:           'text-blue-400 bg-blue-500/10 border-blue-500/20',
  MODERATE:      'text-amber-400 bg-amber-500/10 border-amber-500/20',
  HIGH:          'text-orange-400 bg-orange-500/10 border-orange-500/20',
  CRITICAL:      'text-red-400 bg-red-500/10 border-red-500/20',
  EMERGENCY:     'text-red-300 bg-red-500/20 border-red-400/40',
};
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-blue-400', ACKNOWLEDGED: 'text-cyan-400', INVESTIGATING: 'text-yellow-400',
  AWAITING_REPORTER: 'text-amber-400', IN_PROGRESS: 'text-orange-400', TESTING: 'text-purple-400',
  RESOLVED: 'text-green-400', CLOSED: 'text-gray-500', REJECTED: 'text-red-400',
};
const ACTION_LABEL: Record<string, string> = {
  created: 'filed this report', commented: 'commented', internal_note: 'added a staff note',
  status_changed: 'changed status', severity_changed: 'changed severity',
  assigned: 'updated assignment', auto_escalated: 'was auto-escalated (48h)',
};
const STAFF_ROLES = ['MODERATOR', 'DISPATCHER', 'DEVELOPER', 'ADMIN'];

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const router = useRouter();
  const [report, setReport]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [comment, setComment]     = useState('');
  const [internal, setInternal]   = useState(false);
  const [posting, setPosting]     = useState(false);
  const [editing, setEditing]     = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PLATFORM_ADMIN always has full staff access regardless of report_role
  const isStaff = user?.role === 'PLATFORM_ADMIN' ||
    (!!user?.report_role && STAFF_ROLES.includes(user.report_role));

  useEffect(() => {
    api.get(`/reports/${id}`).then(r => setReport(r.data)).finally(() => setLoading(false));
  }, [id]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    const { data } = await api.post(`/reports/${report.id}/comments`, { message: comment, internal });
    setReport((r: any) => ({ ...r, comments: [...r.comments, data] }));
    setComment(''); setPosting(false);
  }

  async function changeStatus(status: string) {
    const { data } = await api.patch(`/reports/${report.id}/status`, { status });
    setReport((r: any) => ({ ...r, status: data.status }));
  }

  async function changeSeverity(severity: string) {
    const { data } = await api.patch(`/reports/${report.id}/severity`, { severity });
    setReport((r: any) => ({ ...r, severity: data.severity }));
  }

  function startEdit() {
    setEditTitle(report.title);
    setEditDesc(report.description);
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    const { data } = await api.patch(`/reports/${report.id}/edit`, { title: editTitle, description: editDesc });
    setReport((r: any) => ({ ...r, title: data.title, description: data.description }));
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete report ${report.public_id}? This cannot be undone.`)) return;
    setDeleting(true);
    await api.delete(`/reports/${report.id}`);
    router.push('/dashboard/tracker');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','text/plain'];
    const allowedExts = ['jpg','jpeg','png','gif','webp','txt','log'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowedExts.includes(ext)) {
      setUploadError('Only images (.jpg .png .gif .webp) and text files (.txt .log) are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large — maximum 10 MB');
      return;
    }
    setUploadError(''); setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/reports/${report.id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReport((r: any) => ({ ...r, attachments: [...(r.attachments ?? []), data] }));
    } catch (err: any) {
      setUploadError(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteAttachment(attachmentId: string, fileName: string) {
    if (!confirm(`Remove attachment "${fileName}"?`)) return;
    await api.delete(`/reports/attachments/${attachmentId}`);
    setReport((r: any) => ({ ...r, attachments: r.attachments.filter((a: any) => a.id !== attachmentId) }));
  }

  if (loading) return <div className="glass-card rounded-2xl h-64 animate-pulse max-w-4xl mx-auto" />;
  if (!report) return <div className="text-center text-gray-500 py-20">Report not found.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard/tracker" className="hover:text-white transition">Issue Tracker</Link>
          <span>/</span>
          <span className="font-mono text-gray-300">{report.public_id}</span>
        </div>
        <h1 className="text-3xl font-bold mb-1">{report.public_id}</h1>
        <p className="text-gray-400 text-sm">{report.category.replace('_', ' ')} · Filed by {report.reporter.display_name}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {/* Header */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', SEV_COLOR[report.severity])}>
                {report.severity}
              </span>
              <span className={cn('text-sm font-bold', STATUS_COLOR[report.status])}>
                {report.status.replace(/_/g, ' ')}
              </span>
              {report.escalated && (
                <span className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full font-bold">
                  ⚡ Escalated
                </span>
              )}
              <span className="text-xs text-gray-600 ml-auto">{report.category.replace('_', ' ')}</span>
            </div>
            {editing ? (
              <div className="flex flex-col gap-3 mb-4">
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-aero/40 bg-white/5 px-3 py-2 text-base font-bold text-white focus:outline-none" />
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={6}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-aero focus:outline-none resize-none" />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="bg-aero text-black font-bold px-4 py-1.5 rounded-lg text-xs hover:brightness-110 transition disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="border border-white/10 text-gray-400 px-4 py-1.5 rounded-lg text-xs hover:text-white transition">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-white mb-4">{report.title}</h1>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{report.description}</p>
              </>
            )}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5 text-xs text-gray-500">
              <span>Filed by <span className="text-gray-300 font-medium">{report.reporter.display_name}</span></span>
              <span>·</span>
              <span>{new Date(report.created_at).toLocaleString()}</span>
              {report.assignee && <>
                <span>·</span>
                <span>Assigned to <span className="text-gray-300 font-medium">{report.assignee.display_name}</span></span>
              </>}
              {isStaff && !editing && (
                <div className="ml-auto flex gap-2">
                  <button onClick={startEdit}
                    className="border border-white/10 text-gray-400 hover:text-white px-2.5 py-1 rounded-lg transition">
                    ✏ Edit
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="border border-red-500/30 text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded-lg transition disabled:opacity-40">
                    {deleting ? '…' : '🗑 Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-gray-300">Comments ({report.comments.length})</h3>
            {report.comments.map((c: any) => (
              <div key={c.id} className={cn('glass-card rounded-xl p-4', c.is_internal && 'border border-amber-500/20 bg-amber-500/5')}>
                {c.is_internal && (
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-2">🔒 Staff Note</p>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-aero/20 flex items-center justify-center text-aero text-[10px] font-bold flex-shrink-0">
                    {c.author.display_name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white">{c.author.display_name}</span>
                  {c.author.report_role && (
                    <span className="text-[10px] bg-aero/10 text-aero px-1.5 py-0.5 rounded font-bold">{c.author.report_role}</span>
                  )}
                  <span className="text-xs text-gray-500 ml-auto">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{c.message}</p>
              </div>
            ))}

            {/* Comment form */}
            {report.status !== 'CLOSED' && report.status !== 'REJECTED' && (
              <form onSubmit={postComment} className="glass-card rounded-xl p-4 flex flex-col gap-3">
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment…" rows={3} required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-aero focus:outline-none transition resize-none" />
                <div className="flex items-center justify-between">
                  {isStaff && (
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)}
                        className="accent-amber-400" />
                      Internal note (staff only)
                    </label>
                  )}
                  <button type="submit" disabled={posting || !comment.trim()}
                    className="ml-auto bg-aero text-black font-bold px-4 py-1.5 rounded-lg text-xs hover:brightness-110 transition disabled:opacity-40">
                    {posting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </form>
            )}
          </div>
          {/* Attachments — inside main column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-300">
                Attachments ({report.attachments?.length ?? 0})
              </h3>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.txt,.log"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/5 transition disabled:opacity-40"
                >
                  {uploading ? 'Uploading…' : '📎 Attach File'}
                </button>
              </div>
            </div>

            {uploadError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {uploadError}
              </p>
            )}

            <p className="text-[10px] text-gray-600">
              Allowed: images (.jpg .png .gif .webp) · text files (.txt .log) · max 10 MB
            </p>

            {report.attachments?.length > 0 && (
              <div className="flex flex-col gap-2">
                {report.attachments.map((a: any) => {
                  const isImage = a.file_type?.startsWith('image/');
                  const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL}/reports/attachments/${a.id}`;
                  return (
                    <div key={a.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                      <span className="text-lg flex-shrink-0">{isImage ? '🖼️' : '📄'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{a.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {(a.file_size / 1024).toFixed(1)} KB · {a.uploader?.display_name}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-aero border border-aero/20 px-2 py-1 rounded-lg hover:bg-aero/10 transition"
                        >
                          {isImage ? 'View' : 'Download'}
                        </a>
                        {isStaff && (
                          <button
                            onClick={() => handleDeleteAttachment(a.id, a.file_name)}
                            className="text-xs text-red-400 border border-red-500/20 px-2 py-1 rounded-lg hover:bg-red-500/10 transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-56 lg:flex-shrink-0 flex flex-col gap-4">
          {/* Staff controls */}
          {isStaff && (
            <>
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Status</p>
                <select value={report.status} onChange={e => changeStatus(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#111] text-sm text-white px-2 py-1.5 focus:border-aero focus:outline-none">
                  {['OPEN','ACKNOWLEDGED','INVESTIGATING','AWAITING_REPORTER','IN_PROGRESS','TESTING','RESOLVED','CLOSED','REJECTED'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Severity</p>
                <select value={report.severity} onChange={e => changeSeverity(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#111] text-sm text-white px-2 py-1.5 focus:border-aero focus:outline-none">
                  {['INFORMATIONAL','LOW','MODERATE','HIGH','CRITICAL','EMERGENCY'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Activity timeline */}
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Activity</p>
            <div className="flex flex-col gap-3">
              {report.activity.map((a: any) => (
                <div key={a.id} className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-aero/60 flex-shrink-0 mt-1.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 leading-snug">
                      <span className="text-gray-300 font-medium">{a.actor.display_name}</span>
                      {' '}{ACTION_LABEL[a.action] ?? a.action}
                      {a.from_value && a.to_value && a.action === 'status_changed' && (
                        <span className={cn('ml-1 font-semibold', STATUS_COLOR[a.to_value])}>
                          {a.from_value.replace(/_/g, ' ')} → {a.to_value.replace(/_/g, ' ')}
                        </span>
                      )}
                      {a.from_value && a.to_value && a.action === 'severity_changed' && (
                        <span className="ml-1 text-gray-300">
                          {a.from_value} → {a.to_value}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {new Date(a.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
