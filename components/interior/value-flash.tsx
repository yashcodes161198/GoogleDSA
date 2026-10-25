"use client";

// Interior Value Flash's keyed number transition, without changing score semantics.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function ValueFlash({ value }: { value: number }) {
  const reduced = useReducedMotion();
  return <span className="relative inline-grid tabular-nums">
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={value} initial={reduced ? false : { opacity: 0, y: "0.45em" }}
        animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0 } }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 32, mass: 0.55 }}>
        {value}
      </motion.span>
    </AnimatePresence>
  </span>;
}
