import { PageHeading } from "@/components/PageHeading";
import { ReviseCard } from "@/components/ReviseCard";
import { DAILY_REVISION_LIMIT } from "@/lib/config";
import { PracticeLibrary } from "@/components/SessionLibraryProvider";

export default function RevisePage() {

  return (
    <div className="space-y-8">
      <PageHeading
        title="Daily revision"
        description={`Your list and checkmarks are saved across days and devices until you press Replace revised. Up to ${DAILY_REVISION_LIMIT} questions at a time, prioritizing unrevised solves, after a 48-hour break from solving or revising.`}
      />
      <PracticeLibrary><ReviseCard dailyLimit={DAILY_REVISION_LIMIT} /></PracticeLibrary>
    </div>
  );
}
