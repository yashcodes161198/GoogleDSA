import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return <div aria-label="Loading settings and score history" role="status" className="space-y-6">
    <span className="sr-only">Loading settings and score history…</span>
    <Skeleton className="h-9 w-64" />
    <Skeleton className="h-5 w-80" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-80 w-full" />
  </div>;
}
