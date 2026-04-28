'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface Props {
  platformCounts: Record<string, number>;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#e1306c',
  facebook:  '#1877f2',
  linkedin:  '#0a66c2',
  twitter:   '#1da1f2',
  youtube:   '#ff0000',
  tiktok:    '#010101',
  other:     '#6b7280',
};

export function PlatformBreakdown({ platformCounts }: Props) {
  const data = Object.entries(platformCounts)
    .map(([platform, count]) => ({ platform: platform.charAt(0).toUpperCase() + platform.slice(1), raw: platform, count }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Content by Platform</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No content rows yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Content by Platform</CardTitle>
        <p className="text-xs text-muted-foreground">Total content rows per platform</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="platform" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
            <Tooltip
              formatter={(value) => [`${value} rows`, 'Content']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              cursor={{ fill: 'hsl(var(--muted))' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={PLATFORM_COLORS[entry.raw] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
