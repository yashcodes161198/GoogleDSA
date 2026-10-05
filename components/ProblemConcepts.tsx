"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export function ProblemConcepts({
  title,
  topics,
}: {
  title: string;
  topics: string[];
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const [pinned, setPinned] = useState(false);

  const reveal = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(16, Math.min(rect.left, window.innerWidth - 316)),
      top: rect.bottom + 8,
      above: window.innerHeight - rect.bottom < 180,
    });
  };

  const hideAfterPointerLeaves = () => {
    if (pinned || document.activeElement === trigger.current) return;
    hideTimer.current = setTimeout(() => setPosition(null), 150);
  };

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!position) return;
    const dismiss = () => {
      setPosition(null);
      setPinned(false);
    };
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [position]);

  if (!topics.length) return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
        aria-label={`Concepts for ${title}`}
        aria-describedby={position ? id : undefined}
        aria-expanded={Boolean(position)}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") reveal();
        }}
        onPointerLeave={hideAfterPointerLeaves}
        onFocus={reveal}
        onBlur={() => {
          if (!pinned) setPosition(null);
        }}
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setPosition(null);
          } else {
            setPinned(true);
            reveal();
          }
        }}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {position &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="tooltip"
            className="surface fixed z-[100] w-[300px] max-w-[calc(100vw-32px)] p-4 text-sm"
            onPointerEnter={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
            }}
            onPointerLeave={hideAfterPointerLeaves}
            style={{
              left: position.left,
              top: position.above ? position.top - 48 : position.top,
              transform: position.above ? "translateY(-100%)" : undefined,
            }}
          >
            <p className="mb-2 font-semibold">Concepts</p>
            <p className="leading-relaxed text-muted">{topics.join(", ")}</p>
          </div>,
          document.body,
        )}
    </>
  );
}
