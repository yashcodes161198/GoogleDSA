import type { ProblemWithProgress } from "@/lib/types";
import { materializeRevisionQueue, resetRevisionQueue, selectRevisionQueue } from "./selectRevisionQueue";

export type RevisionSession = {
  version: number;
  entries: { id: string; revisionCount: number }[];
};

export function revisedSessionIds(session: RevisionSession, library: ProblemWithProgress[]): Set<string> {
  const counts = new Map(library.map(p => [p.id, p.user_problem?.revision_count ?? 0]));
  return new Set(session.entries.filter(entry => (counts.get(entry.id) ?? 0) > entry.revisionCount).map(entry => entry.id));
}

// Local-mode equivalent of the account's get_revision_session transaction.
export function updateRevisionSession(
  current: RevisionSession | null,
  library: ProblemWithProgress[],
  expectedVersion: number | null = null,
  now = new Date(),
): RevisionSession {
  if (current && (expectedVersion === null || expectedVersion !== current.version)) return current;
  const ids = current?.entries.map(entry => entry.id) ?? [];
  const candidates = selectRevisionQueue(library, { limit: 10, excludeIds: ids, now });
  const queue = current
    ? resetRevisionQueue(materializeRevisionQueue(ids, library), revisedSessionIds(current, library), candidates, 10)
    : candidates;
  const baselines = new Map(current?.entries.map(entry => [entry.id, entry.revisionCount]));
  return {
    version: (current?.version ?? 0) + 1,
    entries: queue.map(p => ({ id: p.id, revisionCount: baselines.get(p.id) ?? p.user_problem?.revision_count ?? 0 })),
  };
}
