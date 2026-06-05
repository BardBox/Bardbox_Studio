'use client';

import type { ThroughputRow } from '@/lib/types';
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
      <div className="glass-panel rounded-xl p-5 space-y-2">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Weekly Throughput</p>
        <div className="h-48 flex items-center justify-center text-xs text-slate-400">
          No throughput data yet — complete tasks to see progress here
        </div>
      </div>
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
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Weekly Throughput</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Tasks completed per week by role</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barGap={4} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.3)',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(12px)',
            }}
            cursor={{ fill: 'rgba(148,163,184,0.1)' }}
          />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Designer" fill="#60a5fa" radius={[4, 4, 0, 0]} />
          <Bar dataKey="SMO" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
