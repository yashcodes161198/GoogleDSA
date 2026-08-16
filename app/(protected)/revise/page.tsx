import { ReviseCard } from "@/components/ReviseCard";
import { DAILY_REVISION_LIMIT } from "@/lib/config";
import { getDailyRevisions } from "@/lib/data";

export default async function RevisePage() {
  const queue = await getDailyRevisions(DAILY_REVISION_LIMIT);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Revise</h1>
        <p className="mt-1 text-zinc-500">
          Round-robin through solved problems · up to {DAILY_REVISION_LIMIT} per day ·{" "}
          {queue.length} queued today
        </p>
      </div>
      <ReviseCard problems={queue} dailyLimit={DAILY_REVISION_LIMIT} />
    </div>
  );
}
