import { Skeleton } from '@/components/ui/skeleton';

export default function SmoLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="py-2 px-2 border-b border-r">
              <Skeleton className="h-4 w-8 mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[100px] p-1.5 border-b border-r flex flex-col gap-1">
              <Skeleton className="h-5 w-5 rounded-full" />
              {i % 4 === 0 && <Skeleton className="h-8 w-full rounded-md" />}
              {i % 6 === 0 && <Skeleton className="h-8 w-full rounded-md" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
