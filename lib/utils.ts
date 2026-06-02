import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<string, string> = {
  todo:              'To Do',
  assigned:          'Assigned',
  working_on_it:     'In Progress',
  on_hold:           'On Hold',
  submitted:         'Submitted',
  approved:          'Approved',
  done:              'Done',
  blocked:           'Blocked',
  adjusted_before:   'Adjusted (Before)',
  adjusted_after:    'Adjusted (After)',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}
