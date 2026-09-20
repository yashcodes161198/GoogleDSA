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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Problems</h1>
          <p className="mt-1 text-zinc-500">
            Track progress across all Google interview questions
          </p>
        </div>
        {canAddQuestion && (
          <Link
            href="/problems/new"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-transparent px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Add question
          </Link>
        )}
      </div>
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
