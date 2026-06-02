import type { TaskStatus } from './types';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:             'To Do',
  assigned:         'Assigned',
  working_on_it:    'Working On It',
  on_hold:          'On Hold',
  submitted:        'Submitted',
  approved:         'Approved',
  done:             'Done',
  blocked:          'Blocked',
  adjusted_before:  'Adjusted — Before Leave',
  adjusted_after:   'Adjusted — After Leave',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo:             'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  assigned:         'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  working_on_it:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  on_hold:          'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  submitted:        'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  approved:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  done:             'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  blocked:          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  adjusted_before:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  adjusted_after:   'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as TaskStatus] ?? status;
}

export function statusColor(status: string): string {
  return STATUS_COLORS[status as TaskStatus] ?? 'bg-muted text-muted-foreground';
}
