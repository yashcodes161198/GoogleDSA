import { readFileSync } from "node:fs";
import {
  resetRevisionQueue,
  selectRevisionQueue,
} from "../lib/revision/selectRevisionQueue";
import { getProblemProgressStatus } from "../lib/revision/problemProgressStatus";
import {
  applyOptimisticRevision,
  reconcileRevisionCount,
} from "../lib/revision/optimisticRevision";
import type { ProblemWithProgress } from "../lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const now = new Date("2026-09-18T00:00:00.000Z");

function problem(
  id: string,
  options: {
    status?: ProblemWithProgress["status"];
    solvedAt?: string | null;
    revisedAt?: string | null;
    revisionCount?: number;
  } = {}
): ProblemWithProgress {
  const solvedAt = Object.prototype.hasOwnProperty.call(options, "solvedAt")
    ? options.solvedAt ?? null
    : "2026-09-10T00:00:00.000Z";
  return {
    id,
    slug: id,
    title: id,
    difficulty: "MEDIUM",
    frequency: 50,
    acceptance_rate: 0,
    link: `https://example.com/${id}`,
    links: [],
    topics: [],
    status: options.status ?? "solved",
    user_problem: {
      user_id: "user",
      problem_id: id,
      status: options.status ?? "solved",
      notes: null,
      solved_at: solvedAt,
      ease_factor: 2.5,
      interval_days: 1,
      repetitions: 0,
      next_review_at: null,
      last_reviewed_at: null,
      revision_count: options.revisionCount ?? 0,
      last_revised_at: options.revisedAt ?? null,
      last_solve_seconds: null,
      best_solve_seconds: null,
    },
  };
}

const queue = selectRevisionQueue(
  [
    problem("recent", { solvedAt: "2026-09-17T00:00:01.000Z" }),
    problem("boundary", { solvedAt: "2026-09-16T00:00:00.000Z" }),
    problem("unsolved", { status: "unsolved" }),
    problem("twice", { revisionCount: 2 }),
    problem("once-old", {
      revisionCount: 1,
      revisedAt: "2026-09-01T00:00:00.000Z",
    }),
    problem("once-new", {
      revisionCount: 1,
      revisedAt: "2026-09-05T00:00:00.000Z",
    }),
    problem("legacy", { solvedAt: null }),
  ],
  { limit: 10, now }
);

assert(!queue.some((p) => p.id === "recent"), "exclude solves inside 48 hours");
assert(queue.some((p) => p.id === "boundary"), "include the 48-hour boundary");
assert(!queue.some((p) => p.id === "unsolved"), "exclude unsolved problems");
assert(queue.some((p) => p.id === "legacy"), "include legacy rows with no solved_at");
assert(
  queue.findIndex((p) => p.id === "once-old") <
    queue.findIndex((p) => p.id === "once-new"),
  "break equal revision counts by oldest revision"
);
assert(
  queue.findIndex((p) => p.id === "once-new") <
    queue.findIndex((p) => p.id === "twice"),
  "prefer lower revision counts"
);

const revisedToday = problem("today", {
  revisedAt: "2026-09-18T00:00:00.000Z",
});
assert(
  selectRevisionQueue([revisedToday], {
    limit: 10,
    now,
    includeRevisedToday: false,
  }).length === 0,
  "exclude already-revised-today replacements"
);
assert(
  selectRevisionQueue([problem("excluded"), problem("allowed")], {
    limit: 10,
    now,
    excludeIds: ["excluded"],
  }).map((p) => p.id).join() === "allowed",
  "honor excluded IDs"
);

const current = [
  problem("keep-1"),
  problem("replace-1"),
  problem("keep-2"),
  problem("replace-2"),
];
const reset = resetRevisionQueue(
  current,
  new Set(["replace-1", "replace-2"]),
  [
    problem("new-1"),
    problem("new-1"),
    problem("new-2"),
    problem("new-3"),
  ],
  4
);
assert(
  reset.map((p) => p.id).join() === "keep-1,new-1,keep-2,new-2",
  "preserve unchecked slots and replace checked slots"
);
assert(
  new Set(reset.map((p) => p.id)).size === reset.length,
  "never return duplicate cards"
);
assert(
  resetRevisionQueue(current, new Set(current.map((p) => p.id)), [], 10)
    .length === 0,
  "return fewer than ten when no replacements exist"
);

assert(
  getProblemProgressStatus(problem("status-unsolved", {
    status: "unsolved",
    revisionCount: 8,
  })) === "unsolved",
  "unsolved takes precedence over historical revision count"
);
assert(
  getProblemProgressStatus(problem("status-solved")) === "solved",
  "solved with no revisions has the solved status"
);
assert(
  [1, 2, 3, 4, 20]
    .map((revisionCount) =>
      getProblemProgressStatus(
        problem(`status-${revisionCount}`, { revisionCount })
      )
    )
    .join() ===
    "revised-once,revised-twice,revised-three,revised-many,revised-many",
  "map revision counts to exclusive status buckets"
);

const beforeOptimisticRevision = problem("optimistic", { revisionCount: 2 });
const optimisticRevision = applyOptimisticRevision(
  beforeOptimisticRevision,
  now.toISOString()
);
assert(
  optimisticRevision.user_problem?.revision_count === 3 &&
    optimisticRevision.user_problem.last_revised_at === now.toISOString(),
  "apply the revision count and timestamp before the server responds"
);
assert(
  beforeOptimisticRevision.user_problem?.revision_count === 2,
  "keep the original problem available for rollback"
);
assert(
  reconcileRevisionCount(optimisticRevision, 4).user_problem?.revision_count ===
    4,
  "reconcile optimistic state with the atomic server count"
);

const reviseCardSource = readFileSync(
  new URL("../components/ReviseCard.tsx", import.meta.url),
  "utf8"
);
assert(
  reviseCardSource.indexOf("void toggleRevised(problemId)") <
    reviseCardSource.indexOf("void stopAndPersist(problemId)"),
  "mark the UI revised before starting timer persistence"
);
assert(
  !reviseCardSource.includes("router.refresh()"),
  "do not fetch the revise page again after marking a problem"
);

const migrationSource = readFileSync(
  new URL(
    "../supabase/migrations/010_remove_attempted_status.sql",
    import.meta.url
  ),
  "utf8"
);
assert(
  migrationSource.includes("SET status = 'unsolved'") &&
    migrationSource.includes("WHERE status = 'attempted'"),
  "migrate legacy attempted rows to unsolved"
);
assert(
  migrationSource.includes("CHECK (status IN ('unsolved', 'solved'))"),
  "restrict persisted problem status to unsolved and solved"
);

console.log("Revision queue tests passed");
