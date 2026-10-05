import { PageHeading } from "@/components/PageHeading";
import Link from "next/link";
import { ProblemTable } from "@/components/ProblemTable";
import { getUser, isAdminUser } from "@/lib/auth";
import { getProblemsWithProgress } from "@/lib/data";

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const params = await searchParams;
  const [problems, user] = await Promise.all([
    getProblemsWithProgress(),
    getUser(),
  ]);
  const showAddedBanner = params.added === "1";
  const canAddQuestion = isAdminUser(user);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Problems"
        description="Your question library. Track what you solve and what you revisit."
      >
        {canAddQuestion && (
          <Link href="/problems/new" className="button-link secondary">
            Add question
          </Link>
        )}
      </PageHeading>
      {showAddedBanner && (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          role="status"
        >
          Question added to the catalog.
        </p>
      )}
      <ProblemTable problems={problems} />
    </div>
  );
}
