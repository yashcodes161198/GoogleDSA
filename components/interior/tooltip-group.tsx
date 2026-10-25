"use client";

// Adapted from Interior Tooltip Group: delayed pointer, immediate focus, Escape dismissal.
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function Tooltip({ label, children, className = "" }: {
  label: string; children: ReactElement<HTMLAttributes<HTMLElement>>; className?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const place = useCallback((node: HTMLSpanElement | null) => {
    if (!node || !trigger.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const above = anchor.top - height - 7;
    node.style.left = `${Math.max(8, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(above >= 8 ? above : anchor.bottom + 7, window.innerHeight - height - 8))}px`;
  }, []);
  const clear = () => { if (timer.current) clearTimeout(timer.current); };
  const close = () => { clear(); setOpen(false); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = () => { if (timer.current) clearTimeout(timer.current); setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("blur", dismiss);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <span ref={trigger} className={`relative inline-flex ${className}`}
    onPointerEnter={event => {
      if (event.pointerType === "touch") return;
      clear(); timer.current = setTimeout(() => setOpen(true), 200);
    }}
    onPointerLeave={close} onPointerDown={close} onPointerCancel={close}
    onFocus={() => { clear(); setOpen(true); }} onBlur={close}>
    {cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], open ? id : ""].filter(Boolean).join(" ") || undefined })}
    {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {open && <span ref={place} className="pointer-events-none fixed z-[100] w-max">
          <motion.span id={id} role="tooltip" className="interior-tooltip block"
          style={{ maxWidth: "min(240px, calc(100vw - 16px))" }}
          initial={reduced ? false : { opacity: 0, scale: .9, y: 7 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : .12 } }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 560, damping: 34, mass: .6 }}>{label}</motion.span>
        </span>}
      </AnimatePresence>, document.body)}
  </span>;
}
