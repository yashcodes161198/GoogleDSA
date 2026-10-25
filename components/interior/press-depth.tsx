"use client";

// Adapted from interior.dev/press-depth (MIT); see LICENSE and README.md.
import { forwardRef, useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const PressButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, disabled, onPointerDown, onKeyDown, onKeyUp, onBlur, ...props }, forwardedRef) => {
    const node = useRef<HTMLButtonElement | null>(null);
    const pointer = useRef<number | null>(null);
    const [pressed, setPressed] = useState(false);
    const [tracking, setTracking] = useState(false);
    const stop = useCallback(() => {
      pointer.current = null;
      setTracking(false);
      setPressed(false);
    }, []);

    useEffect(() => {
      if (!tracking) return;
      const move = (event: PointerEvent) => {
        if (event.pointerId !== pointer.current || !node.current) return;
        const r = node.current.getBoundingClientRect();
        setPressed(event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom);
      };
      const lift = (event: PointerEvent) => { if (event.pointerId === pointer.current) stop(); };
      const hidden = () => { if (document.hidden) stop(); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", lift);
      window.addEventListener("pointercancel", lift);
      window.addEventListener("blur", stop);
      document.addEventListener("visibilitychange", hidden);
      return () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", lift);
        window.removeEventListener("pointercancel", lift);
        window.removeEventListener("blur", stop);
        document.removeEventListener("visibilitychange", hidden);
      };
    }, [tracking, stop]);

    return <button {...props} disabled={disabled}
      ref={useCallback((element: HTMLButtonElement | null) => {
        node.current = element;
        if (typeof forwardedRef === "function") return forwardedRef(element);
        if (forwardedRef) forwardedRef.current = element;
      }, [forwardedRef])}
      className={cn("interior-press", className)} data-pressed={pressed && !disabled ? "" : undefined}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || event.currentTarget.matches(":disabled") || (event.pointerType === "mouse" && event.button !== 0)) return;
        pointer.current = event.pointerId;
        setTracking(true);
        setPressed(true);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && !event.repeat && !event.currentTarget.matches(":disabled") && (event.key === " " || event.key === "Enter")) setPressed(true);
      }}
      onKeyUp={(event) => {
        onKeyUp?.(event);
        if ([" ", "Enter", "Escape"].includes(event.key)) stop();
      }}
      onBlur={(event) => { onBlur?.(event); stop(); }} />;
  },
);
PressButton.displayName = "PressButton";
