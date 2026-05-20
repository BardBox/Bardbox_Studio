import type { ClientHealth } from '@/lib/types';

interface Props {
  clients: ClientHealth[];
}

function StackedBar({ done, inFlight, pendingReview, overdue, total }: {
  done: number; inFlight: number; pendingReview: number; overdue: number; total: number;
}) {
  if (total === 0) return <div className="h-2.5 rounded-full bg-muted w-24" />;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden w-28 gap-px">
      {done > 0       && <div className="bg-emerald-400 transition-all" style={{ width: pct(done) }}        title={`Done: ${done}`} />}
      {inFlight > 0   && <div className="bg-blue-400 transition-all"    style={{ width: pct(inFlight) }}    title={`In flight: ${inFlight}`} />}
      {pendingReview > 0 && <div className="bg-yellow-400 transition-all" style={{ width: pct(pendingReview) }} title={`Pending review: ${pendingReview}`} />}
      {overdue > 0    && <div className="bg-red-400 transition-all"     style={{ width: pct(overdue) }}     title={`Overdue: ${overdue}`} />}
    </div>
  );
}

export function ClientHealthTable({ clients }: Props) {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-6 text-center text-muted-foreground text-sm">
        No client data yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Client</th>
            <th className="text-right px-4 py-2.5 font-medium">Total</th>
            <th className="text-right px-4 py-2.5 font-medium text-emerald-700">Done</th>
            <th className="text-right px-4 py-2.5 font-medium text-blue-600">In Flight</th>
            <th className="text-right px-4 py-2.5 font-medium text-yellow-600">Review</th>
            <th className="text-right px-4 py-2.5 font-medium text-red-600">Overdue</th>
            <th className="px-4 py-2.5 font-medium">Breakdown</th>
            <th className="text-right px-4 py-2.5 font-medium">%</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clients.map((c) => {
            const pct = Math.round(c.completion_pct ?? 0);
            const pctColor =
              pct >= 80 ? 'text-emerald-600 font-semibold' :
              pct >= 50 ? 'text-yellow-600 font-medium'   :
              'text-red-600 font-medium';

            return (
              <tr
                key={c.client_name ?? 'unassigned'}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium">{c.client_name ?? '(unassigned)'}</td>
                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{c.total_tasks}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium tabular-nums">{c.done}</td>
                <td className="px-4 py-3 text-right text-blue-600 tabular-nums">{c.in_flight}</td>
                <td className="px-4 py-3 text-right text-yellow-600 tabular-nums">{c.pending_review}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.overdue > 0 ? (
                    <span className="text-red-600 font-semibold">{c.overdue}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StackedBar
                    done={c.done}
                    inFlight={c.in_flight}
                    pendingReview={c.pending_review}
                    overdue={c.overdue}
                    total={c.total_tasks}
                  />
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${pctColor}`}>{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t bg-muted/20 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Done</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-400" /> In Flight</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-400" /> Pending Review</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400" /> Overdue</span>
      </div>
    </div>
  );
}
