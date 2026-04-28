import type { ClientHealth } from '@/lib/types';

interface Props {
  clients: ClientHealth[];
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
            <th className="text-right px-4 py-2.5 font-medium">Done</th>
            <th className="text-right px-4 py-2.5 font-medium">In Flight</th>
            <th className="text-right px-4 py-2.5 font-medium">Pending Review</th>
            <th className="text-right px-4 py-2.5 font-medium">Overdue</th>
            <th className="text-left px-4 py-2.5 font-medium">Completion</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clients.map((c) => {
            const pct = c.completion_pct ?? 0;
            const barColor =
              pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
            return (
              <tr key={c.client_name ?? 'unassigned'} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{c.client_name ?? '(unassigned)'}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{c.total_tasks}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{c.done}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{c.in_flight}</td>
                <td className="px-4 py-3 text-right text-orange-600">{c.pending_review}</td>
                <td className="px-4 py-3 text-right">
                  {c.overdue > 0 ? (
                    <span className="text-red-600 font-semibold">{c.overdue}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
