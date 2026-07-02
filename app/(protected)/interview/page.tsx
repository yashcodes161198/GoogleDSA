import Link from "next/link";
import { redirect } from "next/navigation";
import { StartInterviewButton } from "@/components/StartInterviewButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getActiveInterviewSession,
  getInterviewSessionsWithSummary,
} from "@/lib/data";
import type { Difficulty, InterviewSessionSummary } from "@/lib/types";

const difficultyDot: Record<Difficulty, string> = {
  EASY: "bg-green-500",
  MEDIUM: "bg-yellow-500",
  HARD: "bg-red-500",
};

const difficultyLetter: Record<Difficulty, string> = {
  EASY: "E",
  MEDIUM: "M",
  HARD: "H",
};

function DifficultyBreakdown({
  byDifficulty,
}: {
  byDifficulty: InterviewSessionSummary["byDifficulty"];
}) {
  const entries = (Object.keys(byDifficulty) as Difficulty[]).filter(
    (d) => byDifficulty[d].total > 0
  );
  if (entries.length === 0) return null;

  return (
    <span className="flex items-center gap-3">
      {entries.map((d) => (
        <span key={d} className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${difficultyDot[d]}`} />
          <span className="text-zinc-500">
            {difficultyLetter[d]} {byDifficulty[d].solved}/{byDifficulty[d].total}
          </span>
        </span>
      ))}
    </span>
  );
}

export default async function InterviewPage() {
  const [active, summaries] = await Promise.all([
    getActiveInterviewSession(),
    getInterviewSessionsWithSummary(),
  ]);

  if (active) {
    redirect(`/interview/${active.id}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Mock interview</h1>
        <p className="mt-1 text-zinc-500">
          Simulate a 2-hour Google-style coding interview with 5 problems
        </p>
      </div>

      <StartInterviewButton />

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-sm text-zinc-500">No interviews yet.</p>
          ) : (
            <ul className="space-y-2">
              {summaries.map(({ session: s, byDifficulty }) => (
                <li key={s.id}>
                  <Link
                    href={`/interview/${s.id}`}
                    className="flex items-center justify-between gap-4 overflow-x-auto rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <span className="flex items-center gap-3 whitespace-nowrap text-sm">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {new Date(s.started_at).toLocaleString()}
                      </span>
                      <DifficultyBreakdown byDifficulty={byDifficulty} />
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-sm capitalize text-zinc-500">
                      {s.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
