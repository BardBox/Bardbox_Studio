'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Brain, CalendarClock, CalendarCheck, UserMinus, AlertTriangle } from 'lucide-react';

interface ConflictRow {
  id: number;
  leave_request_id: number;
  task_id: number;
  ai_suggestion: 'before' | 'after' | 'reassign' | null;
  ai_reasoning: string | null;
  resolution: string;
  leave_requests: {
    start_date: string;
    end_date: string;
    profiles: { full_name: string; role: string };
  };
  tasks: {
    task_type: string;
    internal_deadline: string;
    status: string;
    content_rows: {
      client_name: string | null;
      platform: string;
      content_type: string;
      posting_date: string;
    };
  };
}

const SUGGESTION_ICONS = {
  before:   <CalendarClock className="size-4 text-amber-500" />,
  after:    <CalendarCheck className="size-4 text-blue-500" />,
  reassign: <UserMinus className="size-4 text-purple-500" />,
};

const SUGGESTION_LABELS = {
  before:   'Adjust Before Leave',
  after:    'Adjust After Leave',
  reassign: 'Reassign Task',
};

const SUGGESTION_COLORS = {
  before:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  after:    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  reassign: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function LeaveConflictPanel() {
  const router = useRouter();
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/leave/conflicts')
      .then(r => r.json())
      .then(data => { setConflicts(Array.isArray(data) ? data : []); })
      .finally(() => setLoading(false));
  }, []);

  async function resolve(conflictId: number, resolution: 'before' | 'after' | 'reassign') {
    setResolving(conflictId);
    const res = await fetch('/api/leave/conflicts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conflict_id: conflictId, resolution }),
    });
    const json = await res.json();
    if (res.ok) {
      const labels = { before: 'Moved before leave', after: 'Pushed after leave', reassign: 'Marked for reassignment' };
      toast.success(labels[resolution]);
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
      router.refresh();
    } else {
      toast.error(json.error ?? 'Failed to resolve conflict');
    }
    setResolving(null);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-32 rounded-xl border bg-muted/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <CalendarCheck className="size-8 text-green-500 mx-auto mb-2" />
        <p className="font-medium">No pending conflicts</p>
        <p className="text-sm text-muted-foreground mt-1">All leave-affected tasks have been resolved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conflicts.map((conflict) => {
        const cr = conflict.tasks.content_rows;
        const leave = conflict.leave_requests;
        const aiSugg = conflict.ai_suggestion;
        const isResolving = resolving === conflict.id;

        return (
          <Card key={conflict.id} className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{leave.profiles.full_name}</span>
                  <Badge variant="secondary" className="text-xs capitalize">{leave.profiles.role}</Badge>
                  <span className="text-xs text-muted-foreground">
                    on leave {fmt(leave.start_date)} → {fmt(leave.end_date)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {cr.client_name} · {cr.platform} / {cr.content_type}
                  <span className="mx-1">·</span>
                  <span className="capitalize">{conflict.tasks.task_type}</span> task
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground space-y-0.5">
                <div>Deadline: <span className="font-medium text-foreground">{fmt(conflict.tasks.internal_deadline)}</span></div>
                <div>Posting: <span className="font-medium text-foreground">{fmt(cr.posting_date)}</span></div>
              </div>
            </div>

            {/* AI Suggestion */}
            {aiSugg && (
              <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
                <Brain className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">AI Suggestion:</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SUGGESTION_COLORS[aiSugg]}`}>
                      {SUGGESTION_LABELS[aiSugg]}
                    </span>
                  </div>
                  {conflict.ai_reasoning && (
                    <p className="text-muted-foreground">{conflict.ai_reasoning}</p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <p className="text-xs text-muted-foreground mr-auto flex items-center gap-1">
                <AlertTriangle className="size-3" /> Manager decision required
              </p>
              <Button
                size="sm"
                variant={aiSugg === 'before' ? 'default' : 'outline'}
                className="gap-1.5 h-8 text-xs"
                disabled={isResolving}
                onClick={() => resolve(conflict.id, 'before')}
              >
                {SUGGESTION_ICONS.before} Adjust Before Leave
              </Button>
              <Button
                size="sm"
                variant={aiSugg === 'after' ? 'default' : 'outline'}
                className="gap-1.5 h-8 text-xs"
                disabled={isResolving}
                onClick={() => resolve(conflict.id, 'after')}
              >
                {SUGGESTION_ICONS.after} Adjust After Leave
              </Button>
              <Button
                size="sm"
                variant={aiSugg === 'reassign' ? 'default' : 'outline'}
                className="gap-1.5 h-8 text-xs"
                disabled={isResolving}
                onClick={() => resolve(conflict.id, 'reassign')}
              >
                {SUGGESTION_ICONS.reassign} Reassign
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
