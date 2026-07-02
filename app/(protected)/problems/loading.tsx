import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <Skeleton className="h-5 w-56" />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-zinc-200 px-4 py-3 last:border-0 dark:border-zinc-800"
          >
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
