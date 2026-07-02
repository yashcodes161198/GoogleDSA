"use client";

import { useMemo, useState, useTransition, useOptimistic } from "react";
import Link from "next/link";
import { updateProblemStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DifficultyBadge, StatusBadge } from "@/components/ui/badge";
import type { Difficulty, ProblemStatus, ProblemWithProgress } from "@/lib/types";

type StatusUpdate = { id: string; status: ProblemStatus };

export function ProblemTable({ problems }: { problems: ProblemWithProgress[] }) {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "ALL">("ALL");
  const [status, setStatus] = useState<ProblemStatus | "ALL">("ALL");
  const [topic, setTopic] = useState("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [pending, startTransition] = useTransition();

  // Flip the status badge the instant a button is clicked; the server action
  // confirms (and revalidates) in the background. Optimistic state is cleared
  // once the transition ends and the server-fresh `problems` prop arrives.
  const [optimisticProblems, updateOptimistic] = useOptimistic(
    problems,
    (state, update: StatusUpdate) =>
      state.map((p) => (p.id === update.id ? { ...p, status: update.status } : p))
  );

  const topics = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => p.topics.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [problems]);

  const filtered = useMemo(() => {
    return optimisticProblems.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (difficulty !== "ALL" && p.difficulty !== difficulty) return false;
      if (status !== "ALL" && p.status !== status) return false;
      if (topic !== "ALL" && !p.topics.includes(topic)) return false;
      return true;
    });
  }, [optimisticProblems, search, difficulty, status, topic]);

  // Reset to the first page whenever the filter set or page size changes.
  // Adjusting state during render (rather than in an effect) avoids an extra
  // commit — React docs call this out as the correct pattern for "reset state
  // when a dependency changes" instead of useEffect + setState.
  const filterKey = `${search}|${difficulty}|${status}|${topic}|${pageSize}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(0);
  }

  const pageCount =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows =
    pageSize === "all"
      ? filtered
      : filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const setStatusFor = (problemId: string, next: ProblemStatus) => {
    startTransition(async () => {
      updateOptimistic({ id: problemId, status: next });
      await updateProblemStatus(problemId, next);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Input
          placeholder="Search problems..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | "ALL")}
        >
          <option value="ALL">All difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <select
          className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProblemStatus | "ALL")}
        >
          <option value="ALL">All statuses</option>
          <option value="unsolved">Unsolved</option>
          <option value="attempted">Attempted</option>
          <option value="solved">Solved</option>
        </select>
        <select
          className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="ALL">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-zinc-500">
        Showing {pageRows.length} of {filtered.length} problems
        {pending && " · Saving..."}
      </p>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Difficulty</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium">Topics</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p) => (
              <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3">
                  <Link
                    href={p.link}
                    target="_blank"
                    className="font-medium hover:text-blue-600"
                  >
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <DifficultyBadge difficulty={p.difficulty} />
                </td>
                <td className="px-4 py-3">{p.frequency.toFixed(1)}%</td>
                <td className="px-4 py-3 text-zinc-500">
                  {p.topics.slice(0, 3).join(", ")}
                  {p.topics.length > 3 ? "..." : ""}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={p.status} className="w-24 justify-center" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={p.status === "attempted" ? "default" : "outline"}
                      onClick={() => setStatusFor(p.id, "attempted")}
                    >
                      Attempted
                    </Button>
                    <Button
                      size="sm"
                      variant={p.status === "solved" ? "default" : "outline"}
                      onClick={() => setStatusFor(p.id, "solved")}
                    >
                      Solved
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setStatusFor(p.id, "unsolved")}
                    >
                      Reset
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Rows per page</span>
          <select
            aria-label="Rows per page"
            className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={pageSize === "all" ? "all" : String(pageSize)}
            onChange={(e) =>
              setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))
            }
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">
              Page {safePage + 1} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
