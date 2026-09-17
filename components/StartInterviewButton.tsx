"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { startNewInterviewAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_INTERVIEW_CONFIG,
  MAX_INTERVIEW_DURATION_MINUTES,
  MAX_INTERVIEW_PROBLEMS,
  MIN_INTERVIEW_DURATION_MINUTES,
} from "@/lib/interview/config";

function StartButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Starting..." : "Start new interview"}
    </Button>
  );
}

export function StartInterviewButton({
  hasActiveSession = false,
}: {
  hasActiveSession?: boolean;
}) {
  const [state, formAction] = useActionState(startNewInterviewAction, null);
  const [customize, setCustomize] = useState(false);
  const [counts, setCounts] = useState({
    medium: 0,
    hard: 0,
  });
  const total = counts.medium + counts.hard;

  const updateCount = (
    difficulty: keyof typeof counts,
    value: string
  ) => {
    const parsed = Number.parseInt(value, 10);
    setCounts((current) => ({
      ...current,
      [difficulty]: Number.isNaN(parsed) ? 0 : parsed,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a new interview</CardTitle>
        <CardDescription>
          Default: 3 medium, 2 hard · 2 hours
          {hasActiveSession && (
            <span className="mt-1 block text-amber-600">
              Starting a new interview will end your current active session.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium">Customize interview</p>
              <p className="mt-1 text-xs text-zinc-500">
                Choose the difficulty mix and duration.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={customize}
              onClick={() => setCustomize((value) => !value)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                customize ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  customize ? "translate-x-5" : "translate-x-0"
                }`}
              />
              <span className="sr-only">Customize interview</span>
            </button>
          </div>

          {customize && (
            <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <input type="hidden" name="customize" value="on" />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium">
                  Medium questions
                  <Input
                    type="number"
                    name="mediumCount"
                    min={0}
                    max={MAX_INTERVIEW_PROBLEMS}
                    value={counts.medium}
                    onChange={(event) =>
                      updateCount("medium", event.target.value)
                    }
                    required
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Hard questions
                  <Input
                    type="number"
                    name="hardCount"
                    min={0}
                    max={MAX_INTERVIEW_PROBLEMS}
                    value={counts.hard}
                    onChange={(event) =>
                      updateCount("hard", event.target.value)
                    }
                    required
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-sm font-medium">
                Duration in minutes
                <Input
                  type="number"
                  name="durationMinutes"
                  min={MIN_INTERVIEW_DURATION_MINUTES}
                  max={MAX_INTERVIEW_DURATION_MINUTES}
                  defaultValue={DEFAULT_INTERVIEW_CONFIG.durationMinutes}
                  required
                />
              </label>

              <p
                className={`text-xs ${
                  total < 1 || total > MAX_INTERVIEW_PROBLEMS
                    ? "text-red-600"
                    : "text-zinc-500"
                }`}
              >
                {total} question{total === 1 ? "" : "s"} total. Maximum{" "}
                {MAX_INTERVIEW_PROBLEMS}.
              </p>
            </div>
          )}

          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <StartButton />
        </form>
      </CardContent>
    </Card>
  );
}
