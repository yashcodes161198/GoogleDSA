import { PageHeading } from "@/components/PageHeading";
import { ReviseCard } from "@/components/ReviseCard";
import { DAILY_REVISION_LIMIT } from "@/lib/config";

export default function RevisePage() {

  return (
    <div className="space-y-8">
      <PageHeading
        title="Daily revision"
        description={`Revisit solved questions from easy to hard, prioritizing the least revised within each difficulty. Up to ${DAILY_REVISION_LIMIT} per day, eligible 48 hours after solving.`}
      />
      <ReviseCard dailyLimit={DAILY_REVISION_LIMIT} />
    </div>
  );
}
