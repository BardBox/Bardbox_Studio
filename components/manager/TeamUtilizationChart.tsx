'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeamMember } from '@/lib/types';

export function TeamUtilizationChart({ members }: { members: TeamMember[] }) {
  const data = members.map(m => ({
    name: m.full_name.split(' ')[0],
    Todo: m.todo_count,
    'In Progress': m.in_progress_count,
    Submitted: m.submitted_count,
    Overdue: m.overdue_count,
  }));

  if (data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Team Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
          No team data
        </CardContent>
      </Card>
    );
  }

  const chartHeight = Math.max(160, data.length * 38 + 48);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Team Task Breakdown</CardTitle>
        <p className="text-xs text-muted-foreground">Current tasks per person by status</p>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart layout="vertical" data={data} barCategoryGap="30%" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={68}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
              }}
              cursor={{ fill: 'hsl(var(--muted))' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'hsl(var(--foreground))' }} />
            <Bar dataKey="Todo"         stackId="a" fill="#94a3b8" />
            <Bar dataKey="In Progress"  stackId="a" fill="#60a5fa" />
            <Bar dataKey="Submitted"    stackId="a" fill="#fbbf24" />
            <Bar dataKey="Overdue"      stackId="a" fill="#f87171" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
