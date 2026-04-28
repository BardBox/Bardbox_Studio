import type { PipelineSummary } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';

interface KpiBarProps {
  summary: PipelineSummary;
}

export function KpiBar({ summary }: KpiBarProps) {
  const stats = [
    { label: 'Due Today',       value: summary.posts_due_today,    alert: summary.posts_due_today > 0 },
    { label: 'Next 7 Days',     value: summary.posts_next_7_days,  alert: false },
    { label: 'Overdue',         value: summary.overdue,            alert: summary.overdue > 0 },
    { label: 'Critical (<48h)', value: summary.critical,           alert: summary.critical > 0 },
    { label: 'Approaching',     value: summary.approaching,        alert: false },
    { label: 'Done This Week',  value: summary.completed_this_week, alert: false, positive: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map(({ label, value, alert, positive }) => (
        <Card key={label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${
              alert ? 'text-destructive' : positive ? 'text-green-600' : ''
            }`}>
              {value ?? 0}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
