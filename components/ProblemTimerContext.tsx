"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { saveProblemSolveTime } from "@/app/actions";

type TimerEntry = {
  elapsedMs: number;
  running: boolean;
  startedAt: number | null;
};

type ProblemTimerContextValue = {
  getDisplayMs: (problemId: string) => number;
  getLastSavedSeconds: (problemId: string) => number | null;
  isRunning: (problemId: string) => boolean;
  start: (problemId: string) => void;
  stop: (problemId: string) => void;
  reset: (problemId: string) => void;
  onLeetCodeClick: (problemId: string) => void;
};

const ProblemTimerContext = createContext<ProblemTimerContextValue | null>(null);

function buildInitialSaved(
  initial: Record<string, number | null | undefined>
): Record<string, number> {
  const saved: Record<string, number> = {};
  for (const [id, seconds] of Object.entries(initial)) {
    if (seconds != null && seconds > 0) saved[id] = seconds;
  }
  return saved;
}

export function ProblemTimerProvider({
  children,
  initialLastSolve,
}: {
  children: React.ReactNode;
  initialLastSolve: Record<string, number | null | undefined>;
}) {
  const [timers, setTimers] = useState<Record<string, TimerEntry>>({});
  const [savedSeconds, setSavedSeconds] = useState<Record<string, number>>(() =>
    buildInitialSaved(initialLastSolve)
  );
  const [tick, setTick] = useState(0);
  const activeIdRef = useRef<string | null>(null);
  const timersRef = useRef(timers);

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  const anyRunning = useMemo(
    () => Object.values(timers).some((t) => t.running),
    [timers]
  );

  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  const getDisplayMs = useCallback(
    (problemId: string) => {
      void tick;
      const e = timers[problemId] ?? {
        elapsedMs: 0,
        running: false,
        startedAt: null,
      };
      if (!e.running || e.startedAt == null) return e.elapsedMs;
      return e.elapsedMs + (Date.now() - e.startedAt);
    },
    [timers, tick]
  );

  const getElapsedMs = useCallback((problemId: string, entry?: TimerEntry) => {
    const e =
      entry ??
      timersRef.current[problemId] ?? {
        elapsedMs: 0,
        running: false,
        startedAt: null,
      };
    if (!e.running || e.startedAt == null) return e.elapsedMs;
    return e.elapsedMs + (Date.now() - e.startedAt);
  }, []);

  const persist = useCallback(async (problemId: string, seconds: number) => {
    try {
      await saveProblemSolveTime(problemId, seconds);
      setSavedSeconds((prev) => ({ ...prev, [problemId]: seconds }));
    } catch (err) {
      console.error("Failed to save solve time", err);
    }
  }, []);

  const stop = useCallback(
    async (problemId: string, persistTime = true) => {
      const entry = timersRef.current[problemId];
      if (!entry?.running) return;

      const totalMs = getElapsedMs(problemId, entry);
      const seconds = Math.round(totalMs / 1000);

      setTimers((prev) => ({
        ...prev,
        [problemId]: { elapsedMs: totalMs, running: false, startedAt: null },
      }));

      if (activeIdRef.current === problemId) {
        activeIdRef.current = null;
      }

      if (persistTime && seconds > 0) {
        await persist(problemId, seconds);
      }
    },
    [getElapsedMs, persist]
  );

  const start = useCallback(
    async (problemId: string) => {
      const active = activeIdRef.current;
      if (active && active !== problemId) {
        await stop(active, true);
      }

      activeIdRef.current = problemId;
      setTimers((prev) => ({
        ...prev,
        [problemId]: {
          elapsedMs: prev[problemId]?.elapsedMs ?? 0,
          running: true,
          startedAt: Date.now(),
        },
      }));
    },
    [stop]
  );

  const reset = useCallback((problemId: string) => {
    if (activeIdRef.current === problemId) {
      activeIdRef.current = null;
    }
    setTimers((prev) => ({
      ...prev,
      [problemId]: { elapsedMs: 0, running: false, startedAt: null },
    }));
  }, []);

  const onLeetCodeClick = useCallback(
    (problemId: string) => {
      void start(problemId);
    },
    [start]
  );

  const value = useMemo<ProblemTimerContextValue>(
    () => ({
      getDisplayMs,
      getLastSavedSeconds: (problemId) => savedSeconds[problemId] ?? null,
      isRunning: (problemId) => timers[problemId]?.running ?? false,
      start: (problemId) => {
        void start(problemId);
      },
      stop: (problemId) => {
        void stop(problemId, true);
      },
      reset,
      onLeetCodeClick,
    }),
    [getDisplayMs, savedSeconds, timers, start, stop, reset, onLeetCodeClick]
  );

  return (
    <ProblemTimerContext.Provider value={value}>
      {children}
    </ProblemTimerContext.Provider>
  );
}

export function useProblemTimer() {
  const ctx = useContext(ProblemTimerContext);
  if (!ctx) {
    throw new Error("useProblemTimer must be used within ProblemTimerProvider");
  }
  return ctx;
}
