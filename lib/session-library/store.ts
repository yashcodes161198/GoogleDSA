import { withProblemFavorite } from "@/lib/problems/favorite";
import { applyOptimisticRevision, reconcileRevisionCount } from "@/lib/revision/optimisticRevision";
import type { ProblemStatus, ProblemWithProgress } from "@/lib/types";

type SaveResult = { ok: true; bestSeconds: number } | { ok: false; error: string };
export type LibraryTransport = {
  load: () => Promise<{ userId: string; problems: ProblemWithProgress[] }>;
  status: (id: string, status: ProblemStatus) => Promise<{ solvedAt: string }>;
  favorite: (id: string, favorite: boolean) => Promise<void>;
  revise: (id: string) => Promise<{ ok: true; revisionCount: number } | { ok: false; error: string }>;
  time: (id: string, seconds: number) => Promise<SaveResult>;
};
type Change = { id: string; apply: (problem: ProblemWithProgress) => ProblemWithProgress };
export type LibrarySnapshot = {
  problems: ProblemWithProgress[];
  pendingIds: ReadonlySet<string>;
  refreshing: boolean;
  refreshVersion: number;
  error: string | null;
};

function withProgress(problem: ProblemWithProgress, userId: string) {
  const initialized = withProblemFavorite(problem, problem.user_problem?.is_favorite ?? false);
  return { ...initialized, user_problem: { ...initialized.user_problem!, user_id: userId } };
}

export class SessionLibrary {
  private confirmed: ProblemWithProgress[];
  private pending: Change[] = [];
  private listeners = new Set<() => void>();
  private tails = new Map<string, Promise<unknown>>();
  private writes = new Map<string, number>();
  private epoch = 0;
  private active = true;
  private inFlight: Promise<void> | null = null;
  private snapshot: LibrarySnapshot;

  constructor(private userId: string, problems: ProblemWithProgress[], private transport: LibraryTransport) {
    this.confirmed = problems;
    this.snapshot = { problems, pendingIds: new Set(), refreshing: false, refreshVersion: 0, error: null };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(update: Partial<LibrarySnapshot> = {}) {
    // Replaying field changes makes rollback independent of other pending saves.
    this.snapshot = { ...this.snapshot, ...update,
      problems: this.pending.reduce((list, change) => list.map(p => p.id === change.id ? change.apply(p) : p), this.confirmed),
      pendingIds: new Set(this.pending.map(change => change.id)),
    };
    this.listeners.forEach(listener => listener());
  }

  clear = () => {
    this.active = false;
    this.confirmed = [];
    this.pending = [];
    this.publish({ error: null, refreshing: false });
  };

  clearError = () => this.publish({ error: null });

  refresh = (): Promise<void> => {
    if (!this.active) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    const startedAt = this.epoch;
    this.publish({ refreshing: true });
    this.inFlight = (async () => {
      try {
        const result = await this.transport.load();
        if (!this.active) return;
        if (result.userId !== this.userId) { this.clear(); return; }
        const current = new Map(this.confirmed.map(problem => [problem.id, problem]));
        // The response may predate a write that has already finished successfully.
        this.confirmed = result.problems.map(problem =>
          (this.writes.get(problem.id) ?? 0) > startedAt ? current.get(problem.id) ?? problem : problem);
        this.publish({ refreshVersion: this.snapshot.refreshVersion + 1, error: null });
      } catch (error) {
        if (this.active) this.publish({ error: error instanceof Error ? error.message : "Could not refresh your library. Try again." });
      } finally {
        this.inFlight = null;
        if (this.active) this.publish({ refreshing: false });
      }
    })();
    return this.inFlight;
  };

  private async change<T>(id: string, apply: Change["apply"], save: () => Promise<T>, commit: (p: ProblemWithProgress, result: T) => ProblemWithProgress): Promise<T> {
    if (!this.active) throw new Error("Your session has changed. Sign in again.");
    const operation = { id, apply };
    this.writes.set(id, ++this.epoch);
    this.pending.push(operation);
    this.publish({ error: null });
    const previous = this.tails.get(id) ?? Promise.resolve();
    // Serialize one question's writes so rapid toggles cannot finish out of order.
    const work = previous.catch(() => {}).then(async () => {
      if (!this.active) throw new Error("Your session has changed. Sign in again.");
      const result = await save();
      if (this.active) {
        this.writes.set(id, ++this.epoch);
        this.confirmed = this.confirmed.map(p => p.id === id ? commit(p, result) : p);
      }
      return result;
    });
    this.tails.set(id, work);
    try { return await work; }
    catch (error) {
      if (this.active) this.publish({ error: error instanceof Error ? error.message : "Could not save this change. Try again." });
      throw error;
    } finally {
      this.pending = this.pending.filter(change => change !== operation);
      if (this.tails.get(id) === work) this.tails.delete(id);
      if (this.active) this.publish();
    }
  }

  setStatus = (id: string, status: ProblemStatus) => {
    const apply = (p: ProblemWithProgress, solvedAt: string): ProblemWithProgress => {
      const problem = withProgress(p, this.userId);
      return { ...problem, status, user_problem: { ...problem.user_problem, status,
        ...(status === "solved" ? { solved_at: solvedAt } : {}),
      } };
    };
    const now = new Date().toISOString();
    return this.change(id, p => apply(p, now), () => this.transport.status(id, status), (p, result) => apply(p, result.solvedAt));
  };

  setFavorite = (id: string, favorite: boolean) => this.change(id,
    p => withProblemFavorite(withProgress(p, this.userId), favorite),
    () => this.transport.favorite(id, favorite),
    p => withProblemFavorite(withProgress(p, this.userId), favorite));

  revise = (id: string) => {
    const revisedAt = new Date().toISOString();
    return this.change(id, p => applyOptimisticRevision(withProgress(p, this.userId), revisedAt), async () => {
      const result = await this.transport.revise(id);
      if (!result.ok) throw new Error(result.error);
      return result;
    }, (p, result) => reconcileRevisionCount({ ...p, user_problem: { ...withProgress(p, this.userId).user_problem, last_revised_at: revisedAt } }, result.revisionCount));
  };

  saveTime = async (id: string, seconds: number): Promise<SaveResult> => {
    try {
      const result = await this.change(id, p => p, async () => {
        const result = await this.transport.time(id, seconds);
        if (!result.ok) throw new Error(result.error);
        return result;
      }, (p, result) => ({ ...p, user_problem: { ...withProgress(p, this.userId).user_problem,
        last_solve_seconds: Math.max(1, Math.round(seconds)), best_solve_seconds: result.bestSeconds,
      } }));
      return result;
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save solve time." }; }
  };
}
