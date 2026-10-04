"use client";

import { Star } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  favorite,
  onToggle,
  disabled,
}: {
  favorite: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const label = favorite ? "Remove from favorites" : "Mark as favorite";

  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={favorite}
        disabled={disabled}
        onClick={onToggle}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-amber-500 disabled:opacity-50 dark:hover:bg-zinc-800"
      >
        <Star
          className={cn("h-4 w-4", favorite && "fill-amber-400 text-amber-500")}
          aria-hidden="true"
        />
      </button>
    </Tooltip>
  );
}
