"use client";

// Interior Popover's crossfade; positioning, dismissal and focus stay with the host.
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import type { Ref } from "react";

export function PopoverSurface({ ref, ...props }: HTMLMotionProps<"div"> & { ref?: Ref<HTMLDivElement> }) {
  const reduced = useReducedMotion();
  return <motion.div {...props} ref={ref} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 34, mass: .8 }} />;
}
