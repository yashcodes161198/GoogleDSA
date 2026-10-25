"use client";

// Interior Loading Button's overlapping faces, controlled by the existing action.
import { motion, useReducedMotion } from "motion/react";

export function LoadingLabel({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  const reduced = useReducedMotion();
  return <span className="inline-grid items-center" aria-live="polite">
    {[idle, busy].map((label, index) => <motion.span key={index}
      aria-hidden={pending !== (index === 1)}
      className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
      initial={false}
      animate={{ opacity: pending === (index === 1) ? 1 : 0, y: reduced ? 0 : pending === (index === 1) ? 0 : 3 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 34, mass: 0.8 }}>
      {index === 1 && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" className={pending ? "motion-safe:animate-spin" : ""}>
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity=".22" />
        <path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>}{label}
    </motion.span>)}
  </span>;
}
