"use client";

import { useMemo, useState } from "react";
import styles from "./ProblemTable.module.css";
import { nextProblemSort, sortProblems, type ProblemSort, type ProblemSortColumn } from "@/lib/problems/sorting";
import { useProblemFilters } from "@/components/useProblemFilters";
import { useSessionLibrary } from "@/components/SessionLibraryProvider";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DifficultyBadge, StatusBadge } from "@/components/ui/badge";
import { ProblemLinks } from "@/components/ProblemLinks";
import { ProblemConcepts } from "@/components/ProblemConcepts";
import { formatDurationSeconds } from "@/lib/format-duration";
import { resolveProblemLinks } from "@/lib/problem-links";
import {
  getProblemProgressStatus,
  PROBLEM_PROGRESS_FILTERS,
} from "@/lib/revision/problemProgressStatus";
import { DEFAULT_PROBLEM_FILTERS, matchesLastActionRange, type ProblemFilters } from "@/lib/problems/filters";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from "lucide-react";
import type {
  Difficulty,
  ProblemStatus,
  ProblemWithProgress,
} from "@/lib/types";

function SortableHeader({ column, label, sort, onSort }: {
  column: ProblemSortColumn;
  label: string;
  sort: ProblemSort;
  onSort: (column: ProblemSortColumn) => void;
}) {
  const direction = sort?.column === column ? sort.direction : "none";
  const nextDirection = direction === "none" ? "ascending" : direction === "ascending" ? "descending" : "original";
  const Icon = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowUpDown;
  return (
    <th scope="col" aria-sort={direction}>
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-inherit hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        onClick={() => onSort(column)}
        aria-label={`${label}: ${nextDirection === "original" ? "restore original order" : `sort ${nextDirection}`}`}
        title={nextDirection === "original" ? "Restore original order" : `Sort ${nextDirection}`}
      >
        {label}
        <Icon size={12} className="shrink-0" aria-hidden="true" />
      </button>
    </th>
  );
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
    <div className="problem-actions">
      <Button
        size="sm"
        variant="outline"
        disabled={canRevise}
        title={canRevise ? "Reset this question before marking it solved again" : "Mark this question as solved"}
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

export function ProblemTable() {
  const { problems, pendingIds, store } = useSessionLibrary();
  const pending = pendingIds.size > 0;
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<ProblemSort>(null);
  const topics = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => p.topics.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [problems]);
  const { filters, updateFilters } = useProblemFilters(topics);
  const { search, difficulty, status, topic, frequencyInput, favoriteFilter, actionFrom, actionTo, page, pageSize } = filters;
  const invalidDateRange = Boolean(actionFrom && actionTo && actionFrom > actionTo);

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
      if (!matchesLastActionRange(p.user_problem, actionFrom, actionTo)) return false;
      const enteredFrequency = Number(frequencyInput);
      if (
        frequencyInput.trim() !== "" &&
        Number.isFinite(enteredFrequency) &&
        Math.round(p.frequency * 10) !== Math.round(enteredFrequency * 10)
      ) {
        return false;
      }
      return true;
    });
  }, [
    problems,
    search,
    difficulty,
    status,
    topic,
    frequencyInput,
    favoriteFilter,
    actionFrom,
    actionTo,
  ]);

  const sorted = useMemo(() => sortProblems(filtered, sort), [filtered, sort]);
  const changeSort = (column: ProblemSortColumn) => {
    setSort((current) => nextProblemSort(current, column));
    updateFilters({ page: 0 });
  };

  const pageCount =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows =
    pageSize === "all"
      ? sorted
      : sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleFavorite = (id: string) => {
    const problem = problems.find(p => p.id === id);
    if (problem) void store.setFavorite(id, !problem.user_problem?.is_favorite).catch(() => {});
  };
  const setStatusFor = (id: string, status: ProblemStatus) => {
    const problem = store.getSnapshot().problems.find(p => p.id === id);
    if (!problem || problem.status === status) return;
    void store.setStatus(id, status).catch(() => {});
  };
  const incrementRevision = (id: string) => {
    if (problems.find(p => p.id === id)?.status === "solved") {
      void store.revise(id).catch(() => {});
    }
  };

  const clearFilters = () => {
    updateFilters({ ...DEFAULT_PROBLEM_FILTERS, pageSize });
  };
  const activeSecondaryFilterCount = [
    difficulty !== "ALL",
    status !== "ALL",
    topic !== "ALL",
    favoriteFilter !== "ALL",
    frequencyInput.trim() !== "",
    Boolean(actionFrom || actionTo),
  ].filter(Boolean).length;
  const hasFilters =
    search ||
    difficulty !== "ALL" ||
    status !== "ALL" ||
    topic !== "ALL" ||
    favoriteFilter !== "ALL" ||
    frequencyInput || actionFrom || actionTo;

  return (
    <div className="space-y-4">
      <div className="surface filter-panel">
        <div className="filter-grid">
          <label className="field-label col-span-2 sm:col-span-1">
            Search problems
            <Input
              placeholder="Search by title…"
              value={search}
              onChange={(e) => updateFilters({ search: e.target.value }, true)}
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
                  updateFilters({ difficulty: e.target.value as Difficulty | "ALL" })
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
                  updateFilters({ status: e.target.value as ProblemFilters["status"] })
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
                onChange={(e) => updateFilters({ topic: e.target.value })}
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
                  updateFilters({ favoriteFilter: e.target.value as ProblemFilters["favoriteFilter"] })
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
                onChange={(e) => updateFilters({ frequencyInput: e.target.value }, true)}
              />
            </label>
            <fieldset className="col-span-full min-w-0 border-t border-line pt-3" aria-describedby="problem-action-date-help">
              <legend className="px-1 text-xs font-medium text-muted">Last action (IST)</legend>
              <div className="grid max-w-lg grid-cols-2 gap-3">
                <label className="field-label">
                  From
                  <Input
                    type="date"
                    value={actionFrom}
                    max={actionTo || "9999-12-31"}
                    aria-invalid={invalidDateRange}
                    aria-describedby={invalidDateRange ? "problem-action-date-error" : undefined}
                    onChange={(e) => updateFilters({ actionFrom: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  To
                  <Input
                    type="date"
                    value={actionTo}
                    min={actionFrom || undefined}
                    max="9999-12-31"
                    aria-invalid={invalidDateRange}
                    aria-describedby={invalidDateRange ? "problem-action-date-error" : undefined}
                    onChange={(e) => updateFilters({ actionTo: e.target.value })}
                  />
                </label>
              </div>
              <p id="problem-action-date-help" className="mt-2 text-xs text-muted">
                Latest solve, revision, or review. Both dates are included.
              </p>
              {invalidDateRange && <p id="problem-action-date-error" className="mt-2 text-sm text-destructive" role="alert">
                Choose a To date on or after the From date.
              </p>}
            </fieldset>
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
          <div className="surface overflow-x-auto">
            <table className={`problem-table ${styles.responsive}`} role="table">
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
                progress actions. Sortable headers cycle through ascending,
                descending, and original order. Progress uses the oldest revision
                first within each revision count.
              </caption>
              <thead role="rowgroup">
                <tr role="row">
                  <SortableHeader column="title" label="Problem" sort={sort} onSort={changeSort} />
                  <th scope="col">Open</th>
                  <SortableHeader column="difficulty" label="Difficulty" sort={sort} onSort={changeSort} />
                  <SortableHeader column="frequency" label="Frequency" sort={sort} onSort={changeSort} />
                  <th scope="col">Best time</th>
                  <SortableHeader column="progress" label="Your progress" sort={sort} onSort={changeSort} />
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {pageRows.map((p) => (
                  <tr key={p.id} role="row" data-problem-id={p.id}>
                    <td role="cell" className="problem-cell">
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
                    <td role="cell">
                      <ProblemLinks compact links={resolveProblemLinks(p)} />
                    </td>
                    <td role="cell">
                      <DifficultyBadge difficulty={p.difficulty} />
                    </td>
                    <td role="cell" className="tabular-nums text-muted">
                      {p.frequency.toFixed(1)}%
                    </td>
                    <td role="cell" className="whitespace-nowrap font-mono text-xs text-muted">
                      {p.user_problem?.best_solve_seconds != null
                        ? formatDurationSeconds(
                            p.user_problem.best_solve_seconds,
                          )
                        : "—"}
                    </td>
                    <td role="cell">
                      <StatusBadge status={getProblemProgressStatus(p)} />
                    </td>
                    <td role="cell">
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
              updateFilters({ pageSize: e.target.value === "all" ? "all" : Number(e.target.value) as ProblemFilters["pageSize"] })
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
              onClick={() => updateFilters({ page: Math.max(0, safePage - 1) })}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= pageCount - 1}
              onClick={() => updateFilters({ page: Math.min(pageCount - 1, safePage + 1) })}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
