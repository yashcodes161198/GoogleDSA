"use client";

import { useMemo, useState } from "react";
import { compareQuestionDifficulty } from "@/components/question-order";
import { useSessionLibrary, LibraryRefreshStatus } from "@/components/SessionLibraryProvider";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DifficultyBadge, StatusBadge } from "@/components/ui/badge";
import { BestSolveTimeLabel } from "@/components/BestSolveTimeLabel";
import { ProblemLinks } from "@/components/ProblemLinks";
import { ProblemConcepts } from "@/components/ProblemConcepts";
import { formatDurationSeconds } from "@/lib/format-duration";
import { resolveProblemLinks } from "@/lib/problem-links";
import {
  getProblemProgressStatus,
  PROBLEM_PROGRESS_FILTERS,
  type ProblemProgressStatus,
} from "@/lib/revision/problemProgressStatus";
import { ChevronDown } from "lucide-react";
import type {
  Difficulty,
  ProblemStatus,
  ProblemWithProgress,
} from "@/lib/types";

type FavoriteFilter = "ALL" | "FAVORITES";

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
    <div className="problem-actions">
      <Button
        size="sm"
        variant="outline"
        aria-pressed={problem.status === "solved"}
        onClick={() => onStatusChange(problem.id, "solved")}
      >
        Solved
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!canRevise}
        title={
          canRevise
            ? "Increase revision count by 1"
            : "Solve this question before revising"
        }
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

export function ProblemTable() {
  const { problems, pendingIds, store } = useSessionLibrary();
  const pending = pendingIds.size > 0;
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "ALL">("ALL");
  const [status, setStatus] = useState<ProblemProgressStatus | "ALL">("ALL");
  const [topic, setTopic] = useState("ALL");
  const [frequencyInput, setFrequencyInput] = useState("");
  const [favoriteFilter, setFavoriteFilter] = useState<FavoriteFilter>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const topics = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => p.topics.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [problems]);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (difficulty !== "ALL" && p.difficulty !== difficulty) return false;
      if (status !== "ALL" && getProblemProgressStatus(p) !== status)
        return false;
      if (topic !== "ALL" && !p.topics.includes(topic)) return false;
      if (favoriteFilter === "FAVORITES" && !p.user_problem?.is_favorite)
        return false;
      const enteredFrequency = Number(frequencyInput);
      if (
        frequencyInput.trim() !== "" &&
        Number.isFinite(enteredFrequency) &&
        Math.round(p.frequency * 10) !== Math.round(enteredFrequency * 10)
      ) {
        return false;
      }
      return true;
    }).sort(compareQuestionDifficulty);
  }, [
    problems,
    search,
    difficulty,
    status,
    topic,
    frequencyInput,
    favoriteFilter,
  ]);

  const filterKey = `${search}|${difficulty}|${status}|${topic}|${frequencyInput}|${favoriteFilter}|${pageSize}`;
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

  const toggleFavorite = (id: string) => {
    const problem = problems.find(p => p.id === id);
    if (problem) void store.setFavorite(id, !problem.user_problem?.is_favorite).catch(() => {});
  };
  const setStatusFor = (id: string, status: ProblemStatus) => {
    void store.setStatus(id, status).catch(() => {});
  };
  const incrementRevision = (id: string) => {
    if (problems.find(p => p.id === id)?.status === "solved") {
      void store.revise(id).catch(() => {});
    }
  };

  const clearFilters = () => {
    setSearch("");
    setDifficulty("ALL");
    setStatus("ALL");
    setTopic("ALL");
    setFavoriteFilter("ALL");
    setFrequencyInput("");
  };
  const activeSecondaryFilterCount = [
    difficulty !== "ALL",
    status !== "ALL",
    topic !== "ALL",
    favoriteFilter !== "ALL",
    frequencyInput.trim() !== "",
  ].filter(Boolean).length;
  const hasFilters =
    search ||
    difficulty !== "ALL" ||
    status !== "ALL" ||
    topic !== "ALL" ||
    favoriteFilter !== "ALL" ||
    frequencyInput;

  return (
    <div className="space-y-4">
      <div className="surface filter-panel">
        <div className="filter-grid">
          <label className="field-label col-span-2 sm:col-span-1">
            Search problems
            <Input
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="col-span-2 flex min-h-11 items-center justify-between border-t border-line text-sm font-medium sm:hidden"
            aria-expanded={showFilters}
            aria-controls="problem-secondary-filters"
            onClick={() => setShowFilters((shown) => !shown)}
          >
            <span>
              Filters
              {activeSecondaryFilterCount > 0
                ? ` (${activeSecondaryFilterCount} active)`
                : ""}
            </span>
            <ChevronDown
              size={16}
              className={showFilters ? "rotate-180" : ""}
              aria-hidden="true"
            />
          </button>
          <div
            id="problem-secondary-filters"
            className={showFilters ? "contents" : "hidden sm:contents"}
          >
            <label className="field-label">
              Difficulty
              <select
                className="field-control"
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as Difficulty | "ALL")
                }
              >
                <option value="ALL">All difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </label>
            <label className="field-label">
              Progress
              <select
                className="field-control"
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
            </label>
            <label className="field-label">
              Topic
              <select
                className="field-control"
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
            </label>
            <label className="field-label">
              Favorites
              <select
                className="field-control"
                value={favoriteFilter}
                onChange={(e) =>
                  setFavoriteFilter(e.target.value as FavoriteFilter)
                }
              >
                <option value="ALL">All problems</option>
                <option value="FAVORITES">Favorites</option>
              </select>
            </label>
            <label className="field-label">
              Frequency (%)
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.1"
                placeholder="Any"
                value={frequencyInput}
                onChange={(e) => setFrequencyInput(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" role="status">
          {filtered.length} problem{filtered.length === 1 ? "" : "s"}
          {pending ? " · Saving…" : ` · Showing ${pageRows.length}`}
        </p>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      <LibraryRefreshStatus />

      {pageRows.length === 0 ? (
        <div className="surface empty-state">
          <h2 className="font-semibold">No matching problems</h2>
          <p>
            Try another title or clear your filters to see the full catalog.
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3 xl:hidden">
            {pageRows.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-1">
                      <FavoriteButton
                        favorite={p.user_problem?.is_favorite === true}
                        onToggle={() => toggleFavorite(p.id)}
                      />
                      <span className="pt-1 text-base font-medium leading-snug">
                        {p.title}
                      </span>
                      <ProblemConcepts title={p.title} topics={p.topics} />
                    </div>
                    <DifficultyBadge difficulty={p.difficulty} />
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    {p.frequency.toFixed(1)}% frequency
                  </p>
                  <ProblemLinks links={resolveProblemLinks(p)} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={getProblemProgressStatus(p)} />
                    <BestSolveTimeLabel
                      seconds={p.user_problem?.best_solve_seconds}
                      className="text-xs text-muted"
                    />
                  </div>
                  <ProblemActions
                    problem={p}
                    onStatusChange={setStatusFor}
                    onRevise={incrementRevision}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="surface hidden overflow-x-auto xl:block">
            <table className="problem-table">
              <colgroup>
                <col />
                <col style={{ width: 180 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 94 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 138 }} />
                <col style={{ width: 264 }} />
              </colgroup>
              <caption className="sr-only">
                Problem catalog with difficulty, frequency, solve time and
                progress actions
              </caption>
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">Open</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col">Frequency</th>
                  <th scope="col">Best time</th>
                  <th scope="col">Your progress</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => (
                  <tr key={p.id}>
                    <td className="problem-cell">
                      <div className="flex min-w-0 items-center gap-1">
                        <FavoriteButton
                          favorite={p.user_problem?.is_favorite === true}
                          onToggle={() => toggleFavorite(p.id)}
                        />
                        <span
                          className="problem-title min-w-0 truncate"
                          title={p.title}
                        >
                          {p.title}
                        </span>
                        <ProblemConcepts title={p.title} topics={p.topics} />
                      </div>
                    </td>
                    <td>
                      <ProblemLinks compact links={resolveProblemLinks(p)} />
                    </td>
                    <td>
                      <DifficultyBadge difficulty={p.difficulty} />
                    </td>
                    <td className="tabular-nums text-muted">
                      {p.frequency.toFixed(1)}%
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">
                      {p.user_problem?.best_solve_seconds != null
                        ? formatDurationSeconds(
                            p.user_problem.best_solve_seconds,
                          )
                        : "—"}
                    </td>
                    <td>
                      <StatusBadge status={getProblemProgressStatus(p)} />
                    </td>
                    <td>
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
        </>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          Rows per page
          <select
            className="field-control w-auto"
            value={pageSize === "all" ? "all" : String(pageSize)}
            onChange={(e) =>
              setPageSize(
                e.target.value === "all" ? "all" : Number(e.target.value),
              )
            }
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </label>
        {pageCount > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">
              Page {safePage + 1} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
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
