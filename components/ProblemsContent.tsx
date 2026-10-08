"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { ProblemTable } from "@/components/ProblemTable";
import { useSessionLibrary } from "@/components/SessionLibraryProvider";

export function ProblemsContent({ added }: { added: boolean }) {
  const { canAddQuestion, store } = useSessionLibrary();
  useEffect(() => { if (added) void store.refresh(); }, [added, store]);
  return <div className="space-y-6">
    <PageHeading title="Problems" description="Your question library. Track what you solve and what you revisit.">
      {canAddQuestion && <Link href="/problems/new" className="button-link secondary">Add question</Link>}
    </PageHeading>
    {added && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">Question added to the catalog.</p>}
    <ProblemTable />
  </div>;
}
