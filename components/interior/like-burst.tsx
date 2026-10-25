"use client";

// Interior Like Burst's visual feedback; favorite persistence stays with the caller.
import { useState, type ReactNode, type HTMLAttributes } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PressButton } from "./press-depth";

const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const h = (((i + 1) * 2654435761) % 997) / 997;
  const angle = (i / 8) * Math.PI * 2 - Math.PI / 2 + (h - 0.5) * 0.4;
  const distance = 13 + h * 9;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, size: h > 0.5 ? 4 : 3, delay: h * .05 };
});

export function LikeBurst({ active, onToggle, disabled, label, children, className, ...props }: {
  active: boolean; onToggle: () => void; disabled?: boolean; label: string; children: ReactNode; className?: string;
} & HTMLAttributes<HTMLButtonElement>) {
  const reduced = useReducedMotion();
  const [burst, setBurst] = useState(0);
  return <PressButton {...props} type="button" aria-label={label} aria-pressed={active} disabled={disabled} className={className}
    onClick={() => { if (!active) setBurst(n => n + 1); onToggle(); }}>
    <motion.span className="relative inline-flex" initial={false} animate={{ scale: active ? 1 : .94 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34, mass: .45 }}>
      {children}
      {!reduced && active && burst > 0 && <span key={burst} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-0">
        {SPARKS.map((spark, i) => <motion.span key={i} className="absolute rounded-sm bg-amber-400"
          style={{ width: spark.size, height: spark.size, marginLeft: -spark.size / 2, marginTop: -spark.size / 2 }}
          initial={{ x: 0, y: 0, scale: .6, opacity: .85 }} animate={{ x: spark.x, y: spark.y, scale: 1, opacity: 0 }}
          transition={{ duration: .44, delay: spark.delay, ease: [.23, 1, .32, 1] }} />)}
      </span>}
    </motion.span>
  </PressButton>;
}
