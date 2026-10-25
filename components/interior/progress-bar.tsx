"use client";

// Adapted from Interior Progress Bar, with the host's label and dimensions.
import { motion, useReducedMotion } from "motion/react";

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const reduced = useReducedMotion();
  const fraction = Math.min(1, Math.max(0, value / 100));
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}
    className="h-1 overflow-hidden rounded-full bg-subtle shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)]">
    <motion.span aria-hidden="true" className="block h-full origin-left rounded-full bg-accent" initial={false}
      animate={{ scaleX: fraction }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 34, mass: 0.9 }} />
  </div>;
}
