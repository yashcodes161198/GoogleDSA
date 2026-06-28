"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updateProblemNotes, updateProblemStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DifficultyBadge, StatusBadge } from "@/components/ui/badge";
import type { Difficulty, ProblemStatus, ProblemWithProgress } from "@/lib/types";

export function ProblemTable({ problems }: { problems: ProblemWithProgress[] }) {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "ALL">("ALL");
  const [status, setStatus] = useState<ProblemStatus | "ALL">("ALL");
  const [topic, setTopic] = useState("ALL");
  const [pending, startTransition] = useTransition();

  const topics = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => p.topics.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [problems]);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (difficulty !== "ALL" && p.difficulty !== difficulty) return false;
      if (status !== "ALL" && p.status !== status) return false;
      if (topic !== "ALL" && !p.topics.includes(topic)) return false;
      return true;
    });
  }, [problems, search, difficulty, status, topic]);

  const setStatusFor = (problemId: string, next: ProblemStatus) => {
    startTransition(async () => {
      await updateProblemStatus(problemId, next);
    });
  };

  const saveNotes = (problemId: string, notes: string) => {
    startTransition(async () => {
      await updateProblemNotes(problemId, notes);
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
        Showing {filtered.length} of {problems.length} problems
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
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
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
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
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
                  <input
                    className="mt-2 w-full max-w-xs rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Notes..."
                    defaultValue={p.user_problem?.notes ?? ""}
                    onBlur={(e) => saveNotes(p.id, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
