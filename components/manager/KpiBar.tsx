'use client';

import type { PipelineSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

interface KpiBarProps {
  summary: PipelineSummary;
  onCardClick?: (key: string) => void;
}

export function KpiBar({ summary, onCardClick }: KpiBarProps) {
  const stats = [
    {
      key: 'due_today',
      label: 'Due Today',
      value: summary.posts_due_today,
      valueClass: summary.posts_due_today > 0 ? 'text-orange-500' : 'text-slate-700 dark:text-slate-200',
      accent: summary.posts_due_today > 0 ? 'border-orange-300/40' : '',
    },
    {
      key: 'next_7',
      label: 'Next 7 Days',
      value: summary.posts_next_7_days,
      valueClass: 'text-slate-700 dark:text-slate-200',
      accent: '',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: summary.overdue,
      valueClass: summary.overdue > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200',
      accent: summary.overdue > 0 ? 'border-red-300/40' : '',
    },
    {
      key: 'critical',
      label: 'Critical (<48h)',
      value: summary.critical,
      valueClass: summary.critical > 0 ? 'text-orange-500' : 'text-slate-700 dark:text-slate-200',
      accent: summary.critical > 0 ? 'border-orange-300/40' : '',
    },
    {
      key: 'approaching',
      label: 'Approaching',
      value: summary.approaching,
      valueClass: 'text-slate-700 dark:text-slate-200',
      accent: '',
    },
    {
      key: 'done',
      label: 'Done This Week',
      value: summary.completed_this_week,
      valueClass: 'text-emerald-500',
      accent: 'border-emerald-300/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map(({ key, label, value, valueClass, accent }) => (
        <div
          key={key}
          onClick={() => onCardClick?.(key)}
          className={cn(
            'glass-panel rounded-xl p-4 transition-all duration-200 border',
            accent || 'border-white/50 dark:border-white/10',
            onCardClick && 'cursor-pointer hover:brightness-105 active:scale-[0.97]',
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{label}</p>
          <p className={cn('text-3xl font-bold mt-1.5 tabular-nums', valueClass)}>
            {value ?? 0}
          </p>
        </div>
      ))}
    </div>
  );
}
