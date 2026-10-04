"use client";

import { useMemo, useState, useTransition, useOptimistic } from "react";
import { markProblemRevised, updateProblemStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DifficultyBadge, StatusBadge } from "@/components/ui/badge";
import { BestSolveTimeLabel } from "@/components/BestSolveTimeLabel";
import { ProblemLinks } from "@/components/ProblemLinks";
import { formatDurationSeconds } from "@/lib/format-duration";
import { resolveProblemLinks } from "@/lib/problem-links";
import {
  getProblemProgressStatus,
  PROBLEM_PROGRESS_FILTERS,
  type ProblemProgressStatus,
} from "@/lib/revision/problemProgressStatus";
import {
  applyOptimisticRevision,
  reconcileRevisionCount,
} from "@/lib/revision/optimisticRevision";
import type { Difficulty, ProblemStatus, ProblemWithProgress } from "@/lib/types";

const FREQUENCY_FILTERS = [
  { value: "ALL", label: "All frequencies" },
  { value: "50", label: "50% and above" },
  { value: "40", label: "40% and above" },
  { value: "30", label: "30% and above" },
  { value: "20", label: "20% and above" },
  { value: "10", label: "10% and above" },
] as const;

type FrequencyFilter = (typeof FREQUENCY_FILTERS)[number]["value"];

type ProblemTableUpdate =
  | { kind: "status"; id: string; status: ProblemStatus }
  | { kind: "revise"; id: string; revisedAt: string }
  | { kind: "reconcile"; id: string; revisionCount: number };

function applyProblemTableUpdate(
  state: ProblemWithProgress[],
  update: ProblemTableUpdate
): ProblemWithProgress[] {
  return state.map((problem) => {
    if (problem.id !== update.id) return problem;
    if (update.kind === "status") {
      return { ...problem, status: update.status };
    }
    if (update.kind === "revise") {
      return applyOptimisticRevision(problem, update.revisedAt);
    }
    return reconcileRevisionCount(problem, update.revisionCount);
  });
}

function ProblemActions({
  problem,
  onStatusChange,
  onRevise,
}: {
  problem: ProblemWithProgress;
  onStatusChange: (id: string, status: ProblemStatus) => void;
  onRevise: (id: string) => void;
}) {
  const canRevise = problem.status === "solved";

  return (
    <div className="flex flex-nowrap items-center gap-2">
      <Button
        size="sm"
        variant={problem.status === "solved" ? "default" : "outline"}
        onClick={() => onStatusChange(problem.id, "solved")}
      >
        Solved
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!canRevise}
        title={canRevise ? "Increase revision count by 1" : "Solve this question before revising"}
        onClick={() => onRevise(problem.id)}
      >
        +1 revision
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onStatusChange(problem.id, "unsolved")}
      >
        Reset
      </Button>
    </div>
  );
}

export function ProblemTable({ problems }: { problems: ProblemWithProgress[] }) {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "ALL">("ALL");
  const [status, setStatus] = useState<ProblemProgressStatus | "ALL">("ALL");
  const [topic, setTopic] = useState("ALL");
  const [frequency, setFrequency] = useState<FrequencyFilter>("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [savedRevisions, setSavedRevisions] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  const problemsWithSaved = useMemo(() => {
    const savedIds = Object.keys(savedRevisions);
    if (savedIds.length === 0) return problems;
    return problems.map((problem) => {
      const saved = savedRevisions[problem.id];
      if (saved == null || !problem.user_problem) return problem;
      if (problem.user_problem.revision_count >= saved) return problem;
      return reconcileRevisionCount(problem, saved);
    });
  }, [problems, savedRevisions]);

  const [optimisticProblems, updateOptimistic] = useOptimistic(
    problemsWithSaved,
    applyProblemTableUpdate
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
      if (status !== "ALL" && getProblemProgressStatus(p) !== status) return false;
      if (topic !== "ALL" && !p.topics.includes(topic)) return false;
      if (frequency !== "ALL" && p.frequency < Number(frequency)) return false;
      return true;
    });
  }, [optimisticProblems, search, difficulty, status, topic, frequency]);

  const filterKey = `${search}|${difficulty}|${status}|${topic}|${frequency}|${pageSize}`;
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
      updateOptimistic({ kind: "status", id: problemId, status: next });
      await updateProblemStatus(problemId, next);
    });
  };

  const incrementRevision = (problemId: string) => {
    const current = optimisticProblems.find((problem) => problem.id === problemId);
    if (!current || current.status !== "solved") return;

    const previousCount = current.user_problem?.revision_count ?? 0;

    startTransition(async () => {
      setRevisionError(null);
      updateOptimistic({
        kind: "revise",
        id: problemId,
        revisedAt: new Date().toISOString(),
      });

      const result = await markProblemRevised(problemId);
      if (!result.ok) {
        updateOptimistic({
          kind: "reconcile",
          id: problemId,
          revisionCount: previousCount,
        });
        setRevisionError(result.error);
        return;
      }

      setSavedRevisions((current) => ({
        ...current,
        [problemId]: result.revisionCount,
      }));
      updateOptimistic({
        kind: "reconcile",
        id: problemId,
        revisionCount: result.revisionCount,
      });
    });
  };

  const selectClassName =
    "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Input
          className="col-span-2 md:col-span-1"
          placeholder="Search problems..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={selectClassName}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | "ALL")}
        >
          <option value="ALL">All difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <select
          className={selectClassName}
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as ProblemProgressStatus | "ALL")
          }
        >
          <option value="ALL">All statuses</option>
          {PROBLEM_PROGRESS_FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={selectClassName}
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
        <select
          aria-label="Frequency"
          className={selectClassName}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as FrequencyFilter)}
        >
          {FREQUENCY_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-zinc-500">
        Showing {pageRows.length} of {filtered.length} problems
        {pending && " · Saving..."}
      </p>
      {revisionError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {revisionError}
        </p>
      )}

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {pageRows.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium leading-snug">{p.title}</span>
                <DifficultyBadge difficulty={p.difficulty} />
              </div>
              <ProblemLinks links={resolveProblemLinks(p)} />
              <p className="text-sm text-zinc-500">
                {p.frequency.toFixed(1)}% · {p.topics.slice(0, 3).join(", ")}
                {p.topics.length > 3 ? "..." : ""}
              </p>
              <BestSolveTimeLabel
                seconds={p.user_problem?.best_solve_seconds}
                className="text-sm text-zinc-500"
              />
              <StatusBadge status={getProblemProgressStatus(p)} />
              <ProblemActions
                problem={p}
                onStatusChange={setStatusFor}
                onRevise={incrementRevision}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 md:block dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Difficulty</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium">Topics</th>
              <th className="px-4 py-3 font-medium">Best time</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p) => (
              <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <span className="font-medium">{p.title}</span>
                    <ProblemLinks links={resolveProblemLinks(p)} linkClassName="text-xs" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <DifficultyBadge difficulty={p.difficulty} />
                </td>
                <td className="px-4 py-3">{p.frequency.toFixed(1)}%</td>
                <td className="px-4 py-3 text-zinc-500">
                  {p.topics.slice(0, 3).join(", ")}
                  {p.topics.length > 3 ? "..." : ""}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-500">
                  {p.user_problem?.best_solve_seconds != null
                    ? formatDurationSeconds(p.user_problem.best_solve_seconds)
                    : "—"}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge
                    status={getProblemProgressStatus(p)}
                    className="w-32 justify-center"
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <ProblemActions
                    problem={p}
                    onStatusChange={setStatusFor}
                    onRevise={incrementRevision}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-wrap items-center gap-2">
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
