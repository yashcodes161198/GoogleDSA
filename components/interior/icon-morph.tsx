"use client";

// Interior Icon Morph's controlled SVG path spring, adapted to the existing checkmark.
import { motion, useReducedMotion } from "motion/react";

export function CheckMorph({ checked }: { checked: boolean }) {
  const reduced = useReducedMotion();
  return <svg aria-hidden="true" className="h-4 w-4 text-white" viewBox="0 0 12 12" fill="none">
    <motion.path initial={false}
      animate={{ d: checked ? "M2.6 6.3 L4.9 8.6 L9.4 3.6" : "M6 6 L6 6 L6 6", opacity: checked ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34, mass: .45 }}
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
