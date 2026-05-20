'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PipelineSummary } from '@/lib/types';

const SEGMENTS = [
  { key: 'overdue'     as const, label: 'Overdue',     color: '#f87171' },
  { key: 'critical'    as const, label: 'Critical',    color: '#fb923c' },
  { key: 'approaching' as const, label: 'Approaching', color: '#fbbf24' },
  { key: 'comfortable' as const, label: 'On Track',    color: '#4ade80' },
  { key: 'blocked'     as const, label: 'Blocked',     color: '#f472b6' },
];

export function PipelineDonutChart({ summary }: { summary: PipelineSummary }) {
  const data = SEGMENTS
    .map(s => ({ name: s.label, value: (summary[s.key] as number) ?? 0, color: s.color }))
    .filter(d => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline Health</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
          All clear — no active tasks
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pipeline Health</CardTitle>
        <p className="text-xs text-muted-foreground">{total} tasks in flight</p>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <Label
                content={({ viewBox }) => {
                  const vb = viewBox as { cx?: number; cy?: number };
                  const cx = vb?.cx ?? 0;
                  const cy = vb?.cy ?? 0;
                  return (
                    <text textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x={cx}
                        y={cy - 7}
                        fontSize="22"
                        fontWeight="700"
                        fill="hsl(var(--foreground))"
                      >
                        {total}
                      </tspan>
                      <tspan
                        x={cx}
                        y={cy + 12}
                        fontSize="10"
                        fill="hsl(var(--muted-foreground))"
                      >
                        TASKS
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'hsl(var(--foreground))' }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
