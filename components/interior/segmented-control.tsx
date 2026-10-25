"use client";

// Interior Segmented Control's moving thumb with native form radios retained.
import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({ name, label, value, options, onChange, disabled, className }: {
  name: string; label: string; value: T; options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void; disabled?: boolean; className?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return <fieldset disabled={disabled} className={cn("interior-segments", className)}>
    <legend className="sr-only">{label}</legend>
    {options.map(option => <label key={option.value} className="interior-segment">
      <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
      {value === option.value && <motion.span aria-hidden="true" layoutId={reduced ? undefined : id} initial={false}
        className="interior-selection" transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34, mass: 0.45 }} />}
      <span className="relative inline-flex items-center justify-center gap-2">{option.icon}{option.label}</span>
    </label>)}
  </fieldset>;
}
