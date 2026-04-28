import { Skeleton } from '@/components/ui/skeleton';

export default function TeamLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-20 mt-2" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="flex gap-4 px-4 py-3 border-b bg-muted/40">
          {[140, 180, 80, 60, 60, 120].map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0 items-center">
            <Skeleton className="h-4 rounded" style={{ width: 140 }} />
            <Skeleton className="h-4 rounded" style={{ width: 180 }} />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-8 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-7 w-12 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
