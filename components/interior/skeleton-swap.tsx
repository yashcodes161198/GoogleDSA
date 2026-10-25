"use client";

// Interior Skeleton Swap's arrival fade. No minimum delay or extra scroll container.
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export function SkeletonSwap({ ready, fallback, children }: { ready: boolean; fallback: ReactNode; children: ReactNode }) {
  const reduced = useReducedMotion();
  return <motion.div aria-busy={!ready} initial={false} animate={{ opacity: ready ? 1 : .7 }}
    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 34, mass: .8 }}>
    {ready ? children : fallback}
  </motion.div>;
}
