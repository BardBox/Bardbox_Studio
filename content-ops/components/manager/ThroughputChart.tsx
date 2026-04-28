'use client';

import type { ThroughputRow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

interface ThroughputChartProps {
  data: ThroughputRow[];
}

export function ThroughputChart({ data }: ThroughputChartProps) {
  const weeks = [...new Set(data.map((r) => r.week_start))].sort();

  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Weekly Throughput</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No throughput data yet — complete tasks to see progress here
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = weeks.map((week) => {
    const d = new Date(week);
    const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
    return {
      week: label,
      Designer: data.find((r) => r.week_start === week && r.role === 'designer')?.completed ?? 0,
      SMO: data.find((r) => r.week_start === week && r.role === 'smo')?.completed ?? 0,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Weekly Throughput</CardTitle>
        <p className="text-xs text-muted-foreground">Tasks completed per week by role</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={4} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              cursor={{ fill: 'hsl(var(--muted))' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Designer" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            <Bar dataKey="SMO" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
