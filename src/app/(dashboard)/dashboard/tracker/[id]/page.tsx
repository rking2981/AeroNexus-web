'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  const [report, setReport]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [comment, setComment]     = useState('');
  const [internal, setInternal]   = useState(false);
  const [posting, setPosting]     = useState(false);

  const isStaff = !!user?.report_role && STAFF_ROLES.includes(user.report_role);

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

      <div className="flex gap-6">
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
            <h1 className="text-xl font-bold text-white mb-4">{report.title}</h1>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{report.description}</p>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5 text-xs text-gray-500">
              <span>Filed by <span className="text-gray-300 font-medium">{report.reporter.display_name}</span></span>
              <span>·</span>
              <span>{new Date(report.created_at).toLocaleString()}</span>
              {report.assignee && <>
                <span>·</span>
                <span>Assigned to <span className="text-gray-300 font-medium">{report.assignee.display_name}</span></span>
              </>}
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
        </div>

        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-4">
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
                      {a.to_value && a.action === 'status_changed' && (
                        <span className={cn('ml-1 font-semibold', STATUS_COLOR[a.to_value])}>
                          → {a.to_value.replace(/_/g, ' ')}
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
