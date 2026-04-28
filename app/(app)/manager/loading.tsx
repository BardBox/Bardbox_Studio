import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function ManagerLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team load + overdue */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 flex flex-col gap-3">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-3 flex flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Throughput chart */}
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="flex items-end gap-3 h-32">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[48px]">
                <div className="flex items-end gap-0.5 h-24">
                  <Skeleton className="w-5 rounded-t" style={{ height: `${30 + Math.random() * 60}%` }} />
                  <Skeleton className="w-5 rounded-t" style={{ height: `${20 + Math.random() * 50}%` }} />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
