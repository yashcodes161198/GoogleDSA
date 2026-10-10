import Link from "next/link";
import { compareQuestionDifficulty } from "@/components/question-order";
import { ArrowUpRight, Check, Timer } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
import { NextProblemsWidget } from "@/components/NextProblemsWidget";
import { TopicCoverage } from "@/components/TopicCoverage";
import { DifficultyBadge } from "@/components/ui/badge";
import {
  getActiveInterviewSession,
  getDailyRevisions,
  getDashboardStats,
  getProblemsWithProgress,
} from "@/lib/data";
import { DAILY_REVISION_LIMIT } from "@/lib/config";
import {
  DEFAULT_INTERVIEW_CONFIG,
  getInterviewProblemCount,
} from "@/lib/interview/config";
import {
  estimateDaysToFinish,
  getNextProblems,
} from "@/lib/recommendations/nextProblems";

export default async function DashboardPage() {
  const [problems, queue, active] = await Promise.all([
    getProblemsWithProgress(),
    getDailyRevisions(DAILY_REVISION_LIMIT),
    getActiveInterviewSession(),
  ]);
  const stats = await getDashboardStats(problems);
  const recommendations = getNextProblems(problems, 5);
  const progressPct = stats.total
    ? Math.round((stats.solved / stats.total) * 100)
    : 0;
  const config = DEFAULT_INTERVIEW_CONFIG;
  return (
    <div>
      <PageHeading
        title="Daily practice"
        description="Keep learning new problems. Make time to revisit the ones you know."
      >
        <Link href="/problems" className="button-link secondary">
          Browse problems <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </PageHeading>
      <dl className="study-summary">
        <div>
          <dt>Problems solved</dt>
          <dd>
            {stats.solved} <small>/ {stats.total}</small>
          </dd>
        </div>
        <div>
          <dt>Still to solve</dt>
          <dd>{stats.unsolved}</dd>
        </div>
        <div>
          <dt>Revised today</dt>
          <dd>{stats.revisionsDoneToday}</dd>
        </div>
        <div>
          <dt>Catalog coverage</dt>
          <dd>
            {progressPct}
            <small>%</small>
          </dd>
        </div>
      </dl>
      <div className="daily-grid mb-8">
        <section
          className="surface daily-revision"
          aria-labelledby="daily-revision-title"
        >
          <div className="section-heading">
            <h2 id="daily-revision-title">Today’s revision</h2>
            <span className="text-xs text-muted">
              {queue.length} in your queue
            </span>
          </div>
          {queue.length ? (
            <ol className="queue-preview">
              {queue.slice(0, 3).sort(compareQuestionDifficulty).map((problem, index) => (
                <li key={problem.id}>
                  <span className="queue-marker">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{problem.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {problem.user_problem?.revision_count ?? 0} revisions
                    </p>
                  </div>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </li>
              ))}
            </ol>
          ) : (
            <div className="py-6">
              <Check size={24} className="mb-3 text-muted" aria-hidden="true" />
              <p className="font-medium">No questions queued right now</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Solved questions become eligible after 48 hours. Keep
                practicing, then return for your next revision.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/revise" className="button-link">
              Open revision queue
            </Link>
            <span className="text-xs text-muted">
              Up to {DAILY_REVISION_LIMIT} questions a day
            </span>
          </div>
        </section>
        <section
          className="daily-interview"
          aria-labelledby="daily-interview-title"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 id="daily-interview-title">Daily interview practice</h2>
            <Timer
              size={20}
              className="text-[var(--accent-text)]"
              aria-hidden="true"
            />
          </div>
          <p>
            {active
              ? "Your interview is in progress. Pick up where you left off."
              : "Set aside a focused session to solve under interview conditions."}
          </p>
          {!active && (
            <div className="interview-facts">
              <div>
                <strong>{getInterviewProblemCount(config)}</strong>
                <span>questions</span>
              </div>
              <div>
                <strong>{config.durationMinutes}</strong>
                <span>minutes</span>
              </div>
            </div>
          )}
          {active && (
            <p className="my-6 font-medium">Active session ready to resume</p>
          )}
          <Link
            href={active ? `/interview/${active.id}` : "/interview"}
            className="button-link"
          >
            {active ? "Resume interview" : "Set up an interview"}
          </Link>
          <p className="mt-4 text-xs">
            {active
              ? "Your completed questions are saved."
              : "Use the default session or customize your mix."}
          </p>
        </section>
      </div>
      <div className="coverage-grid">
        <NextProblemsWidget
          recommendations={recommendations}
          daysToFinish={estimateDaysToFinish(problems, 3)}
        />
        <div className="space-y-6">
          <TopicCoverage topics={stats.topicCoverage} />
          <section className="surface p-6" aria-labelledby="difficulty-heading">
            <div className="section-heading">
              <h2 id="difficulty-heading">Difficulty breakdown</h2>
            </div>
            <div className="space-y-4">
              {(["EASY", "MEDIUM", "HARD"] as const).map((difficulty) => {
                const { solved, total } = stats.byDifficulty[difficulty];
                return (
                  <div
                    key={difficulty}
                    className="flex items-center justify-between gap-4"
                  >
                    <DifficultyBadge difficulty={difficulty} />
                    <span className="text-sm tabular-nums text-muted">
                      {solved} / {total} solved
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
