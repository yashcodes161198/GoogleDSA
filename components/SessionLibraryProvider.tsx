"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { markProblemRevised, saveProblemSolveTime, setProblemFavorite, updateProblemStatus } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { SessionLibrary } from "@/lib/session-library/store";
import type { ProblemWithProgress } from "@/lib/types";

const LibraryContext = createContext<{ store: SessionLibrary; canAddQuestion: boolean } | null>(null);

export function SessionLibraryProvider({ userId, initialProblems = null, canAddQuestion, localMode, children }: {
  userId: string; initialProblems?: ProblemWithProgress[] | null; canAddQuestion: boolean; localMode: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [store] = useState(() => new SessionLibrary(userId, initialProblems, {
    load: async () => {
      const response = await fetch("/api/library", { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return { userId: "", problems: [] }; }
      if (!response.ok) throw new Error("Could not refresh your library. Try again.");
      const result = await response.json();
      if (result.userId !== userId) router.refresh();
      return result;
    },
    status: (id, status) => updateProblemStatus(id, status, false, crypto.randomUUID()),
    favorite: (id, favorite) => setProblemFavorite(id, favorite, false),
    revise: id => markProblemRevised(id, false, crypto.randomUUID()),
    time: (id, seconds) => saveProblemSolveTime(id, seconds, false),
  }));

  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible" && store.getSnapshot().loaded) void store.refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const subscription = localMode ? null : createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) {
        store.clear();
        router.refresh();
      }
    }).data.subscription;
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      subscription?.unsubscribe();
    };
  }, [store, userId, localMode, router]);

  return <LibraryContext.Provider value={{ store, canAddQuestion }}>
    {children}
    <LibraryRefreshStatus />
  </LibraryContext.Provider>;
}

export function useSessionLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("Session library provider is missing");
  const snapshot = useSyncExternalStore(context.store.subscribe, context.store.getSnapshot, context.store.getSnapshot);
  return { ...snapshot, store: context.store, canAddQuestion: context.canAddQuestion };
}

export function LibraryRefreshStatus() {
  const { refreshing, error, store } = useSessionLibrary();
  if (!refreshing && !error) return null;

  return <div className="surface fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 max-w-[calc(100vw-2rem)] px-4 py-3 shadow-lg md:right-6 md:bottom-6">
    {error
      ? <p className="text-sm text-destructive" role="alert">{error}{" "}<button type="button" className="underline" onClick={() => void store.refresh()}>Refresh progress</button></p>
      : <p className="text-sm text-muted" role="status">Refreshing progress…</p>}
  </div>;
}

export function PracticeLibrary({ children }: { children: React.ReactNode }) {
  const { loaded, error, store } = useSessionLibrary();
  useEffect(() => { void store.ensureLoaded(); }, [store]);
  if (!loaded) return <div className="surface p-6" role={error ? "alert" : "status"}>
    {error ? <>{error} <button type="button" className="underline" onClick={() => void store.ensureLoaded()}>Try again</button></> : "Loading your practice library…"}
  </div>;
  return children;
}
