import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while any protected page's server component loads — the
// AppShell/nav stays in place, only this content area swaps to the skeleton.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-48 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
