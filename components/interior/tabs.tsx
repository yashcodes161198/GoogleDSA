"use client";

// Interior Tabs' shared spring indicator; the host keeps its link/button semantics.
import { motion, useReducedMotion } from "motion/react";

export function SelectionIndicator({ id, active }: { id: string; active: boolean }) {
  const reduced = useReducedMotion();
  if (!active) return null;
  return <motion.span aria-hidden="true" layoutId={reduced ? undefined : id} initial={false}
    className="interior-selection" transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 620, damping: 42, mass: 0.35 }} />;
}
