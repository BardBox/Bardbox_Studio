'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { PipelineTask } from '@/lib/types';
import { PressureBadge } from '@/components/shared/PressureBadge';
import { TaskAiChat } from '@/components/shared/TaskAiChat';

interface PostTaskCardProps {
  task: PipelineTask;
  onDone: (taskId: number) => void;
}

const PLATFORM_ABBR: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  linkedin: 'LI',
  twitter: 'TW',
  youtube: 'YT',
  tiktok: 'TK',
};

export function PostTaskCard({ task, onDone }: PostTaskCardProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const abbr = PLATFORM_ABBR[task.platform.toLowerCase()] ?? task.platform.slice(0, 2).toUpperCase();

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
    <div className="rounded-md border bg-background overflow-hidden">
      {/* Card header — always visible */}
      <div
        className="flex items-start gap-2 p-2 hover:bg-muted/40 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-xs font-bold bg-primary text-primary-foreground rounded px-1.5 py-0.5 shrink-0">
          {abbr}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{task.client_name ?? 'No client'}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <PressureBadge level={task.pressure_level} />
            <span className="text-xs text-muted-foreground">
              {task.posting_time?.slice(0, 5) ?? ''}
            </span>
            <span className="text-xs text-muted-foreground capitalize">· {task.content_type}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.task_status !== 'done' && task.task_status !== 'approved' && (
            <button
              onClick={handleMarkDone}
              disabled={loading}
              className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
              title="Mark done"
            >
              {loading ? '…' : '✓'}
            </button>
          )}
          <span className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t space-y-3">
          {/* Posting info */}
          <div className="text-xs text-muted-foreground">
            {task.posting_date} · {task.posting_time?.slice(0, 5) ?? ''} · {task.platform}
          </div>

          {/* Caption */}
          {task.caption && (
            <div>
              <p className="text-xs font-medium mb-0.5">Caption</p>
              <p className="text-xs bg-muted rounded p-2 leading-relaxed whitespace-pre-wrap">
                {task.caption}
              </p>
            </div>
          )}

          {/* Brief */}
          {task.brief && !task.caption && (
            <div>
              <p className="text-xs font-medium mb-0.5">Brief</p>
              <p className="text-xs text-muted-foreground">{task.brief}</p>
            </div>
          )}

          {/* Design link */}
          {task.design_url && (
            <a
              href={task.design_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
            >
              Open Design ↗
            </a>
          )}

          {/* Mark done button */}
          {task.task_status !== 'done' && (
            <button
              onClick={handleMarkDone}
              disabled={loading}
              className="w-full text-xs py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating…' : '✓ Mark as Posted'}
            </button>
          )}

          {/* AI Chat */}
          <TaskAiChat task_id={task.task_id} task_type={task.task_type} />
        </div>
      )}
    </div>
  );
}
