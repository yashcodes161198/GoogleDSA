"use client";

// Adapted from Interior Tooltip Group: delayed pointer, immediate focus, Escape dismissal.
import { cloneElement, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactElement } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function Tooltip({ label, children, className = "" }: {
  label: string; children: ReactElement<HTMLAttributes<HTMLElement>>; className?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); };
  const close = () => { clear(); setOpen(false); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = () => { if (timer.current) clearTimeout(timer.current); setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("blur", dismiss);
    window.addEventListener("scroll", dismiss, true);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <span className={`relative inline-flex ${className}`}
    onPointerEnter={event => {
      if (event.pointerType === "touch") return;
      clear(); timer.current = setTimeout(() => setOpen(true), 200);
    }}
    onPointerLeave={close} onPointerDown={close} onPointerCancel={close}
    onFocus={() => { clear(); setOpen(true); }} onBlur={close}>
    {cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], open ? id : ""].filter(Boolean).join(" ") || undefined })}
    <span className="pointer-events-none absolute bottom-[calc(100%+7px)] left-1/2 z-50 flex w-0 justify-center">
      <AnimatePresence>
        {open && <motion.span id={id} role="tooltip" className="interior-tooltip"
          initial={reduced ? false : { opacity: 0, scale: .9, y: 7 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : .12 } }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 560, damping: 34, mass: .6 }}>{label}</motion.span>}
      </AnimatePresence>
    </span>
  </span>;
}
