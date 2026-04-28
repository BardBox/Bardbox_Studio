import type { TeamMember } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function UtilBar({ active, max }: { active: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((active / max) * 100)) : 0;
  const color = pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

export function TeamLoadTable({ members }: { members: TeamMember[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Team Load</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Todo</TableHead>
              <TableHead className="text-right">In Progress</TableHead>
              <TableHead className="text-right">Submitted</TableHead>
              <TableHead className="text-right">Overdue</TableHead>
              <TableHead className="text-right">Done/wk</TableHead>
              <TableHead className="min-w-[120px]">Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.full_name}</TableCell>
                <TableCell className="capitalize text-muted-foreground text-xs">{m.role}</TableCell>
                <TableCell className="text-right">{m.todo_count}</TableCell>
                <TableCell className="text-right">{m.in_progress_count}</TableCell>
                <TableCell className="text-right">{m.submitted_count}</TableCell>
                <TableCell className={`text-right font-medium ${m.overdue_count > 0 ? 'text-destructive' : ''}`}>
                  {m.overdue_count}
                </TableCell>
                <TableCell className="text-right text-green-600">{m.completed_this_week}</TableCell>
                <TableCell>
                  <UtilBar active={m.active_total} max={m.max_concurrent_tasks} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
