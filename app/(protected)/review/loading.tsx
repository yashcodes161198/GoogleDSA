import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-6 dark:border-zinc-700">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-6 h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
