import Link from "next/link";
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

  const pastSessions = summaries.filter(
    ({ session }) => !active || session.id !== active.id
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Mock interview</h1>
        <p className="mt-1 text-zinc-500">
          Simulate a 2-hour Google-style coding interview with 5 problems
        </p>
      </div>

      {active && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle>Active interview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              <p>
                Started {new Date(active.started_at).toLocaleString()}
              </p>
              <p className="mt-1 text-zinc-500">
                Ends {new Date(active.ends_at).toLocaleString()}
              </p>
            </div>
            <Link
              href={`/interview/${active.id}`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700"
            >
              Resume interview
            </Link>
          </CardContent>
        </Card>
      )}

      <StartInterviewButton hasActiveSession={!!active} />

      <Card>
        <CardHeader>
          <CardTitle>Previous interviews</CardTitle>
        </CardHeader>
        <CardContent>
          {pastSessions.length === 0 ? (
            <p className="text-sm text-zinc-500">No previous interviews yet.</p>
          ) : (
            <ul className="space-y-3">
              {pastSessions.map(({ session: s, byDifficulty, problemTitles }) => (
                <li key={s.id}>
                  <Link
                    href={`/interview/${s.id}`}
                    className="block rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {new Date(s.started_at).toLocaleString()}
                        </span>
                        <DifficultyBreakdown byDifficulty={byDifficulty} />
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-sm capitalize text-zinc-500">
                        {s.status}
                      </span>
                    </div>
                    {problemTitles.length > 0 && (
                      <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-zinc-500">
                        {problemTitles.map((title) => (
                          <li key={title}>{title}</li>
                        ))}
                      </ol>
                    )}
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
