"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitReview } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/ui/badge";
import type { ProblemWithProgress, ReviewRating } from "@/lib/types";

export function ReviewCard({ problems }: { problems: ProblemWithProgress[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(0);

  if (problems.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium">No reviews due right now</p>
          <p className="mt-2 text-sm text-zinc-500">
            Mark problems as solved to start your spaced repetition schedule.
          </p>
        </CardContent>
      </Card>
    );
  }

  const current = problems[index];

  const rate = (rating: ReviewRating) => {
    startTransition(async () => {
      await submitReview(current.id, rating);
      setDone((d) => d + 1);
      setRevealed(false);
      if (index < problems.length - 1) {
        setIndex((i) => i + 1);
      }
    });
  };

  const finished = index >= problems.length - 1 && done >= problems.length;

  if (finished && !pending) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium">Session complete!</p>
          <p className="mt-2 text-sm text-zinc-500">
            You reviewed {done} problem{done === 1 ? "" : "s"}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Card {Math.min(index + 1, problems.length)} of {problems.length}
          </CardTitle>
          <DifficultyBadge difficulty={current.difficulty} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="min-h-[120px] rounded-xl border border-dashed border-zinc-300 p-6 dark:border-zinc-700">
          <h2 className="text-2xl font-semibold">{current.title}</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {current.topics.join(", ") || "General"}
          </p>
          {revealed ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Recall your approach, time/space complexity, and edge cases.
              </p>
              <Link
                href={current.link}
                target="_blank"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Open on LeetCode
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">
              Try to recall the solution before revealing.
            </p>
          )}
        </div>

        {!revealed ? (
          <Button className="w-full" onClick={() => setRevealed(true)}>
            Reveal answer
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="destructive" disabled={pending} onClick={() => rate("again")}>
              Again
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => rate("hard")}>
              Hard
            </Button>
            <Button disabled={pending} onClick={() => rate("good")}>
              Good
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => rate("easy")}>
              Easy
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
