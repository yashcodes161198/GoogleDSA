import { Skeleton } from "@/components/ui/skeleton";

// Matches InterviewSessionView's actual shape (timer, action row, N problem
// cards with a checkbox/title/difficulty header, a link line, and a notes
// textarea) rather than falling back to the parent /interview list skeleton.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="rounded-xl border border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <Skeleton className="mx-auto h-4 w-24" />
        <Skeleton className="mx-auto mt-2 h-9 w-40" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-md" />
                <Skeleton className="h-5 w-48" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
