'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  statusCounts: Record<string, number>;
}

const STATUS_META: { key: string; label: string; color: string }[] = [
  { key: 'todo',        label: 'To Do',       color: '#94a3b8' },
  { key: 'in_progress', label: 'In Progress', color: '#60a5fa' },
  { key: 'submitted',   label: 'Submitted',   color: '#fbbf24' },
  { key: 'approved',    label: 'Approved',    color: '#34d399' },
  { key: 'done',        label: 'Done',        color: '#10b981' },
  { key: 'blocked',     label: 'Blocked',     color: '#f87171' },
];

export function TaskStatusChart({ statusCounts }: Props) {
  const data = STATUS_META
    .map(s => ({ name: s.label, value: statusCounts[s.key] ?? 0, color: s.color }))
    .filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Task Status Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No active tasks yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Task Status Breakdown</CardTitle>
        <p className="text-xs text-muted-foreground">{total} total active tasks</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} tasks`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
