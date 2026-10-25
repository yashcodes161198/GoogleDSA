"use client";

// Interior Sortable Table's spring arrow; retain the app's three-state sort and native table.
import { motion, useReducedMotion } from "motion/react";
import { ArrowUp, ArrowUpDown } from "lucide-react";

export function SortIndicator({ direction }: { direction: "ascending" | "descending" | "none" }) {
  const reduced = useReducedMotion();
  return <motion.span aria-hidden="true" className="inline-flex shrink-0" initial={false}
    animate={{ rotate: direction === "descending" ? 180 : 0 }}
    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 46, mass: .5 }}>
    {direction === "none" ? <ArrowUpDown size={12} /> : <ArrowUp size={12} />}
  </motion.span>;
}
