"use client";

// Interior Inline Validation's error transition; validation rules remain at the caller.
import { motion, useReducedMotion } from "motion/react";

export function FieldError({ message }: { message?: string }) {
  const reduced = useReducedMotion();
  if (!message) return null;
  return <motion.p role="alert" className="text-sm text-destructive" initial={reduced ? false : { opacity: 0, y: -2 }}
    animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 34, mass: .8 }}>{message}</motion.p>;
}
