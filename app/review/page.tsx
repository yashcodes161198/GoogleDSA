import { AppShell } from "@/components/AppShell";
import { ReviewCard } from "@/components/ReviewCard";
import { getDueReviews } from "@/lib/data";

export default async function ReviewPage() {
  const due = await getDueReviews(20);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Spaced repetition</h1>
          <p className="mt-1 text-zinc-500">
            Anki-style review for problems you&apos;ve solved · {due.length} due now
          </p>
        </div>
        <ReviewCard problems={due} />
      </div>
    </AppShell>
  );
}
