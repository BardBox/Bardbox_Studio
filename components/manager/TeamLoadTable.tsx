import type { TeamMember } from '@/lib/types';
import { cn } from '@/lib/utils';

function UtilBar({ active, max }: { active: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((active / max) * 100)) : 0;

  const barColor =
    pct > 90 ? 'bg-red-400' :
    pct > 70 ? 'bg-yellow-400' :
    'bg-emerald-400';

  const textColor =
    pct > 90 ? 'text-red-500 font-semibold' :
    pct > 70 ? 'text-yellow-600 font-medium' :
    'text-emerald-600';

  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-2 bg-slate-200/50 dark:bg-white/10 rounded-full overflow-hidden">
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
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/30 dark:border-white/10 bg-white/20 dark:bg-white/5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Team Load</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/10 dark:bg-white/5 border-b border-white/20 dark:border-white/10">
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Role</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Todo</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">In Progress</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Submitted</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-red-500">Overdue</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Done/wk</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 min-w-[140px]">Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/20 dark:divide-white/5">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{m.full_name}</td>
                <td className="px-4 py-3 capitalize text-slate-500 text-xs">{m.role}</td>
                <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{m.todo_count}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 tabular-nums">{m.working_on_it_count}</td>
                <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{m.submitted_count}</td>
                <td className={cn('px-4 py-3 text-right font-medium tabular-nums', m.overdue_count > 0 ? 'text-red-500' : 'text-slate-400')}>
                  {m.overdue_count}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium tabular-nums">{m.completed_this_week}</td>
                <td className="px-4 py-3">
                  <UtilBar active={m.active_total} max={m.max_concurrent_tasks} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
