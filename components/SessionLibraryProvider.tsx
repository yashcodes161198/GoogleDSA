"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { markProblemRevised, saveProblemSolveTime, setProblemFavorite, updateProblemStatus } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { SessionLibrary } from "@/lib/session-library/store";
import type { ProblemWithProgress } from "@/lib/types";

const LibraryContext = createContext<{ store: SessionLibrary; canAddQuestion: boolean } | null>(null);

export function SessionLibraryProvider({ userId, initialProblems, canAddQuestion, localMode, children }: {
  userId: string; initialProblems: ProblemWithProgress[]; canAddQuestion: boolean; localMode: boolean; children: React.ReactNode;
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
    status: (id, status) => updateProblemStatus(id, status, false),
    favorite: (id, favorite) => setProblemFavorite(id, favorite, false),
    revise: id => markProblemRevised(id, false),
    time: (id, seconds) => saveProblemSolveTime(id, seconds, false),
  }));

  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") void store.refresh(); };
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

  return <LibraryContext.Provider value={{ store, canAddQuestion }}>{children}</LibraryContext.Provider>;
}

export function useSessionLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("Session library provider is missing");
  const snapshot = useSyncExternalStore(context.store.subscribe, context.store.getSnapshot, context.store.getSnapshot);
  return { ...snapshot, store: context.store, canAddQuestion: context.canAddQuestion };
}

export function LibraryRefreshStatus() {
  const { refreshing, error, store } = useSessionLibrary();
  return <>
    {refreshing && <p className="text-sm text-muted" role="status">Refreshing progress…</p>}
    {error && <p className="text-sm text-destructive" role="alert">{error}{" "}<button type="button" className="underline" onClick={() => void store.refresh()}>Refresh progress</button></p>}
  </>;
}
