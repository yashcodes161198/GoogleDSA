"use client";

// Interior Pagination's reserved number slot and directional transition.
import { motion, useReducedMotion } from "motion/react";

export function PageNumber({ page, count }: { page: number; count: number }) {
  const reduced = useReducedMotion();
  return <span className="inline-flex items-center gap-[.4ch] text-sm text-muted" aria-live="polite">
    Page <span className="inline-grid justify-items-center tabular-nums" style={{ minWidth: `${String(count).length}ch` }}>
      <motion.span key={page} initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 32, mass: .55 }}>{page}</motion.span>
    </span> of {count}
  </span>;
}
