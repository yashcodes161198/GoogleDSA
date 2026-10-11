"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { readProblemFilters, writeProblemFilters, type ProblemFilters } from "@/lib/problems/filters";

const FILTER_CHANGE = "problems-filters-change";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(FILTER_CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(FILTER_CHANGE, onChange);
  };
}

function getQuery() {
  return new URLSearchParams(window.location.search).toString();
}

export function useProblemFilters(topics: readonly string[]) {
  const searchParams = useSearchParams();
  // Synchronous URL subscriptions keep controlled text inputs responsive while
  // Next.js updates its router state. The server snapshot preserves SSR filters.
  const query = useSyncExternalStore(subscribe, getQuery, () => searchParams.toString());
  const filters = readProblemFilters(new URLSearchParams(query), topics);

  function updateFilters(patch: Partial<ProblemFilters>, replace = false) {
    const params = new URLSearchParams(window.location.search);
    const next = { ...readProblemFilters(params, topics), ...patch, page: patch.page ?? 0 };
    const query = writeProblemFilters(params, next).toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    window.dispatchEvent(new Event(FILTER_CHANGE));
  }

  return { filters, updateFilters };
}
