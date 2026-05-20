'use client';

import type { PipelineSummary } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
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
      alert: summary.posts_due_today > 0,
      alertClass: 'text-orange-600',
      borderClass: 'border-orange-200',
    },
    {
      key: 'next_7',
      label: 'Next 7 Days',
      value: summary.posts_next_7_days,
      alert: false,
      alertClass: '',
      borderClass: '',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: summary.overdue,
      alert: summary.overdue > 0,
      alertClass: 'text-destructive',
      borderClass: 'border-destructive/30',
    },
    {
      key: 'critical',
      label: 'Critical (<48h)',
      value: summary.critical,
      alert: summary.critical > 0,
      alertClass: 'text-orange-500',
      borderClass: 'border-orange-200',
    },
    {
      key: 'approaching',
      label: 'Approaching',
      value: summary.approaching,
      alert: false,
      alertClass: '',
      borderClass: '',
    },
    {
      key: 'done',
      label: 'Done This Week',
      value: summary.completed_this_week,
      alert: false,
      alertClass: 'text-emerald-600',
      borderClass: 'border-emerald-100',
      positive: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map(({ key, label, value, alert, alertClass, borderClass, positive }) => (
        <Card
          key={key}
          onClick={() => onCardClick?.(key)}
          className={cn(
            'transition-all duration-200 select-none',
            onCardClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]',
            alert && borderClass,
            positive && 'border-emerald-100',
          )}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            <p className={cn('text-3xl font-bold mt-1 tabular-nums', alertClass, positive && !alertClass && 'text-emerald-600')}>
              {value ?? 0}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
