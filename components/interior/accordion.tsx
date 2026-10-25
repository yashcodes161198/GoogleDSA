"use client";

// Interior Accordion's panel arrival; retain natural height for live form fields and popovers.
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export function Disclosure({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: -3 }}
    animate={{ opacity: 1, y: 0 }}
    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 40, mass: .6 }}>
    {children}
  </motion.div>;
}
