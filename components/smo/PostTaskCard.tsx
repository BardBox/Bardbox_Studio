'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { PipelineTask } from '@/lib/types';
import { PressureBadge } from '@/components/shared/PressureBadge';
import { TaskAiChat } from '@/components/shared/TaskAiChat';
import { ExternalLink, Check } from 'lucide-react';

interface PostTaskCardProps {
  task: PipelineTask;
  onDone: (taskId: number) => void;
}

const PLATFORM_CARD: Record<string, string> = {
  instagram: 'bg-pink-500/15 border-pink-400/30',
  facebook:  'bg-blue-500/15 border-blue-400/30',
  linkedin:  'bg-sky-500/15 border-sky-400/30',
  twitter:   'bg-slate-500/15 border-slate-400/30',
  youtube:   'bg-red-500/15 border-red-400/30',
  tiktok:    'bg-violet-500/15 border-violet-400/30',
};

const PLATFORM_TEXT: Record<string, string> = {
  instagram: 'text-pink-700',
  facebook:  'text-blue-700',
  linkedin:  'text-sky-700',
  twitter:   'text-slate-600',
  youtube:   'text-red-700',
  tiktok:    'text-violet-700',
};

const PLATFORM_PILL: Record<string, string> = {
  instagram: 'bg-pink-500/20 border-pink-400/40 text-pink-700',
  facebook:  'bg-blue-500/20 border-blue-400/40 text-blue-700',
  linkedin:  'bg-sky-500/20 border-sky-400/40 text-sky-700',
  twitter:   'bg-slate-500/20 border-slate-400/40 text-slate-600',
  youtube:   'bg-red-500/20 border-red-400/40 text-red-700',
  tiktok:    'bg-violet-500/20 border-violet-400/40 text-violet-700',
};

// Deterministic avatar colour based on first char of name
const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-orange-500',
];
function avatarBg(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'size-4 text-[7px]' : 'size-5 text-[8px]';
  return (
    <div className={`${sz} ${avatarBg(name)} rounded-full flex items-center justify-center shrink-0`}>
      <span className="font-black text-white">{initials(name)}</span>
    </div>
  );
}

export function PostTaskCard({ task, onDone }: PostTaskCardProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const platform = (task.platform ?? '').toLowerCase();
  const cardBg  = PLATFORM_CARD[platform]  ?? 'bg-slate-500/10 border-slate-400/20';
  const textCls = PLATFORM_TEXT[platform]  ?? 'text-slate-600';
  const pillCls = PLATFORM_PILL[platform]  ?? 'bg-slate-500/15 border-slate-400/40 text-slate-600';

  async function handleMarkDone(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    const res = await fetch('/api/tasks/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: task.task_id, status: 'done' }),
    });
    if (res.ok) {
      onDone(task.task_id);
      toast.success('Post marked as done');
    } else {
      toast.error('Failed to update. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="relative">
      {/* Collapsed row */}
      <div
        onClick={() => setExpanded(e => !e)}
        className={`rounded-lg p-1.5 border cursor-pointer transition-all hover:brightness-95 ${cardBg}`}
      >
        {/* Client + done button */}
        <div className="flex items-center justify-between gap-1">
          <p className={`text-[11px] font-bold truncate leading-tight ${textCls}`}>
            {task.client_name ?? 'No client'}
          </p>
          {task.task_status !== 'done' && (
            <button
              onClick={handleMarkDone}
              disabled={loading}
              title="Mark done"
              className="size-4 shrink-0 rounded bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center hover:bg-emerald-500/40 transition-all disabled:opacity-40"
            >
              <Check className="size-2.5 text-emerald-600" />
            </button>
          )}
        </div>

        {/* Pressure + time */}
        <div className="flex items-center gap-1 mt-0.5">
          <PressureBadge level={task.pressure_level} />
          {task.posting_time && (
            <span className={`text-[8px] font-semibold ${textCls} opacity-70`}>
              {task.posting_time.slice(0, 5)}
            </span>
          )}
        </div>

        {/* Designer + SMO avatars row */}
        {(task.designer_name || task.assignee_name) && (
          <div className="flex items-center gap-1 mt-1 pt-1 border-t border-black/5">
            {task.designer_name && (
              <div className="flex items-center gap-0.5" title={`Designer/Editor: ${task.designer_name}`}>
                <Avatar name={task.designer_name} size="sm" />
                <span className="text-[8px] text-slate-500 font-medium truncate max-w-[40px]">
                  {task.designer_name.split(' ')[0]}
                </span>
              </div>
            )}
            {task.designer_name && task.assignee_name && (
              <span className="text-[8px] text-slate-300">·</span>
            )}
            {task.assignee_name && (
              <div className="flex items-center gap-0.5" title={`SMO: ${task.assignee_name}`}>
                <Avatar name={task.assignee_name} size="sm" />
                <span className="text-[8px] text-slate-500 font-medium truncate max-w-[40px]">
                  {task.assignee_name.split(' ')[0]}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="relative z-20 mt-1 -mx-0.5">
          <div
            className="rounded-xl p-3 shadow-lg border-2 border-blue-300/30"
            style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)' }}
          >
            {/* Platform + time */}
            <div className="flex items-center justify-between mb-2">
              {platform ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${pillCls}`}>
                  {task.platform}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100/60 border-slate-300/40 text-slate-400">
                  No platform
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {task.posting_time && (
                  <span className="text-[9px] font-semibold text-slate-500">{task.posting_time.slice(0, 5)}</span>
                )}
                <PressureBadge level={task.pressure_level} />
              </div>
            </div>

            {/* Client name */}
            <p className="text-[12px] font-bold text-slate-800 mb-2">{task.client_name ?? 'No client'}</p>

            {/* People row */}
            <div className="flex items-center gap-3 mb-2.5 p-2 rounded-lg bg-slate-50/60 border border-slate-100">
              {task.designer_name && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar name={task.designer_name} size="md" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">
                      {task.designer_specialty === 'graphic_designer' ? 'Designer' : task.designer_specialty === 'video_editor' ? 'Editor' : 'Employee'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-700 truncate">{task.designer_name}</p>
                  </div>
                </div>
              )}
              {task.designer_name && task.assignee_name && (
                <div className="w-px h-6 bg-slate-200 shrink-0" />
              )}
              {task.assignee_name && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar name={task.assignee_name} size="md" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">SMO</p>
                    <p className="text-[10px] font-semibold text-slate-700 truncate">{task.assignee_name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Caption or brief */}
            {(task.caption || task.brief) && (
              <div className="bg-blue-500/5 rounded-lg px-2 py-1.5 mb-2.5 text-[10px] text-slate-600 leading-relaxed border border-blue-400/10 whitespace-pre-wrap">
                {task.caption || task.brief}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mb-2.5">
              {task.task_status !== 'done' ? (
                <button
                  onClick={handleMarkDone}
                  disabled={loading}
                  className="flex-1 text-[11px] py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'Updating…' : 'Mark as Posted'}
                </button>
              ) : (
                <span className="flex-1 text-center text-[11px] py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-700 font-bold">
                  Posted
                </span>
              )}
              {task.design_url && (
                <a
                  href={task.design_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="size-8 shrink-0 flex items-center justify-center rounded-lg border border-white/60 bg-white/60 hover:bg-white transition-colors"
                >
                  <ExternalLink className="size-3 text-blue-600" />
                </a>
              )}
            </div>

            {/* AI chat */}
            <div className="pt-2 border-t border-slate-100">
              <TaskAiChat task_id={task.task_id} task_type={task.task_type} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
