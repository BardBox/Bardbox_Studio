import type { TeamMember } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function UtilBar({ active, max }: { active: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((active / max) * 100)) : 0;

  const barColor =
    pct > 90 ? 'bg-destructive' :
    pct > 70 ? 'bg-yellow-400'  :
    'bg-emerald-400';

  const textColor =
    pct > 90 ? 'text-destructive font-semibold' :
    pct > 70 ? 'text-yellow-600 font-medium'   :
    'text-emerald-600';

  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-xs w-8 text-right tabular-nums', textColor)}>{pct}%</span>
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
              <TableHead className="min-w-[140px]">Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-medium">{m.full_name}</TableCell>
                <TableCell className="capitalize text-muted-foreground text-xs">{m.role}</TableCell>
                <TableCell className="text-right text-muted-foreground">{m.todo_count}</TableCell>
                <TableCell className="text-right">{m.in_progress_count}</TableCell>
                <TableCell className="text-right text-muted-foreground">{m.submitted_count}</TableCell>
                <TableCell className={cn('text-right font-medium', m.overdue_count > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {m.overdue_count}
                </TableCell>
                <TableCell className="text-right text-emerald-600 font-medium">{m.completed_this_week}</TableCell>
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
