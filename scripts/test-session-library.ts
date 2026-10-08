import assert from "node:assert/strict";
import { SessionLibrary, type LibraryTransport } from "../lib/session-library/store";
import { selectRevisionQueue } from "../lib/revision/selectRevisionQueue";
import type { ProblemWithProgress } from "../lib/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const initial: ProblemWithProgress = {
  id: "one", slug: "one", title: "One", difficulty: "EASY", frequency: 1,
  acceptance_rate: 50, link: "", links: [], topics: [], status: "unsolved",
};
const transport = (patch: Partial<LibraryTransport> = {}): LibraryTransport => ({
  load: async () => ({ userId: "user", problems: [initial] }),
  status: async () => ({ solvedAt: new Date().toISOString() }),
  favorite: async () => {}, revise: async () => ({ ok: true, revisionCount: 7 }),
  time: async () => ({ ok: true, bestSeconds: 12 }), ...patch,
});
const problem = (store: SessionLibrary) => store.getSnapshot().problems[0];

async function main() {
  // A fresh solve must not become immediately eligible for revision, even without a prior row.
  const status = deferred<{ solvedAt: string }>();
  const store = new SessionLibrary("user", [initial], transport({ status: () => status.promise }));
  const save = store.setStatus("one", "solved");
  assert.equal(problem(store).user_problem?.user_id, "user");
  assert.equal(selectRevisionQueue(store.getSnapshot().problems, { limit: 15 }).length, 0);
  const canonicalDate = new Date(Date.now() - 1000).toISOString();
  status.resolve({ solvedAt: canonicalDate });
  await save;
  assert.equal(problem(store).user_problem?.solved_at, canonicalDate);
  assert.equal(store.getSnapshot().pendingIds.size, 0);

  // A refresh that began before a write cannot undo it after that write completes.
  const stale = deferred<{ userId: string; problems: ProblemWithProgress[] }>();
  let loads = 0;
  const raced = new SessionLibrary("user", [initial], transport({ load: () => { loads++; return stale.promise; } }));
  const refresh = raced.refresh();
  assert.equal(raced.refresh(), refresh, "focus/visibility refreshes coalesce");
  await raced.setFavorite("one", true);
  stale.resolve({ userId: "user", problems: [initial] });
  await refresh;
  assert.equal(problem(raced).user_problem?.is_favorite, true);
  assert.equal(loads, 1, "saves do not refetch the library");

  // Pending optimistic fields survive a refresh; rolling one back preserves later queued work.
  const failed = deferred<void>();
  const revised = deferred<{ ok: true; revisionCount: number }>();
  const pending = new SessionLibrary("user", [initial], transport({
    favorite: () => failed.promise, revise: () => revised.promise,
  }));
  const favoriteSave = pending.setFavorite("one", true).catch(error => error);
  const revisionSave = pending.revise("one");
  await pending.refresh();
  assert.equal(problem(pending).user_problem?.is_favorite, true);
  assert.equal(problem(pending).user_problem?.revision_count, 1);
  failed.reject(new Error("offline"));
  await favoriteSave;
  assert.equal(problem(pending).user_problem?.is_favorite ?? false, false);
  assert.equal(problem(pending).user_problem?.revision_count, 1);
  revised.resolve({ ok: true, revisionCount: 7 });
  await revisionSave;
  await pending.saveTime("one", 18);
  assert.equal(problem(pending).user_problem?.revision_count, 7);
  assert.equal(problem(pending).user_problem?.last_solve_seconds, 18);
  assert.equal(problem(pending).user_problem?.best_solve_seconds, 12);

  const firstToggle = deferred<void>();
  const sent: boolean[] = [];
  const toggles = new SessionLibrary("user", [initial], transport({ favorite: async (_, value) => {
    sent.push(value);
    if (sent.length === 1) await firstToggle.promise;
  } }));
  const yes = toggles.setFavorite("one", true);
  const no = toggles.setFavorite("one", false);
  assert.equal(problem(toggles).user_problem?.is_favorite, false);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(sent, [true], "second toggle waits for the first write");
  firstToggle.resolve();
  await Promise.all([yes, no]);
  assert.deepEqual(sent, [true, false]);
  assert.equal(problem(toggles).user_problem?.is_favorite, false);

  const badTime = new SessionLibrary("user", [initial], transport({ time: async () => ({ ok: false, error: "offline" }) }));
  assert.deepEqual(await badTime.saveTime("one", 10), { ok: false, error: "offline" });
  assert.equal(problem(badTime).user_problem, undefined);
  assert.equal(badTime.getSnapshot().pendingIds.size, 0);

  const unavailable = new SessionLibrary("user", [initial], transport({ load: async () => { throw new Error("offline"); } }));
  await unavailable.refresh();
  assert.equal(unavailable.getSnapshot().problems.length, 1);
  assert.equal(unavailable.getSnapshot().error, "offline");
  assert.equal(unavailable.getSnapshot().refreshing, false);

  // Sign-out discards both stale reads and in-flight writes, including their optimistic data.
  const late = deferred<{ userId: string; problems: ProblemWithProgress[] }>();
  const lateSave = deferred<void>();
  const signedOut = new SessionLibrary("user", [initial], transport({ load: () => late.promise, favorite: () => lateSave.promise }));
  const oldRefresh = signedOut.refresh();
  const oldSave = signedOut.setFavorite("one", true);
  await Promise.resolve();
  await Promise.resolve();
  signedOut.clear();
  late.resolve({ userId: "user", problems: [initial] });
  lateSave.resolve();
  await Promise.all([oldRefresh, oldSave]);
  assert.equal(signedOut.getSnapshot().problems.length, 0);
  await assert.rejects(signedOut.setFavorite("one", true), /session has changed/);
  const otherUser = new SessionLibrary("user", [initial], transport({ load: async () => ({ userId: "other", problems: [initial] }) }));
  await otherUser.refresh();
  assert.equal(otherUser.getSnapshot().problems.length, 0);
  console.log("Session library race, rollback, cooldown, timing and isolation tests passed");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
