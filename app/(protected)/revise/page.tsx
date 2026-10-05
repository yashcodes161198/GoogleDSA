import { PageHeading } from "@/components/PageHeading";
import { ReviseCard } from "@/components/ReviseCard";
import { DAILY_REVISION_LIMIT } from "@/lib/config";
import { getDailyRevisions } from "@/lib/data";

export default async function RevisePage() {
  const queue = await getDailyRevisions(DAILY_REVISION_LIMIT);

  return (
    <div className="space-y-8">
      <PageHeading
        title="Daily revision"
        description={`Revisit solved questions, starting with the least revised. Up to ${DAILY_REVISION_LIMIT} per day, eligible 48 hours after solving.`}
      />
      <ReviseCard problems={queue} dailyLimit={DAILY_REVISION_LIMIT} />
    </div>
  );
}
