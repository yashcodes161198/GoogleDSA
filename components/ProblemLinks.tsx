"use client";

import { ExternalLink } from "@/components/ui/external-link";
import { PROVIDER_LABELS } from "@/lib/problem-links";
import type { ProblemLink } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProblemLinks({
  links,
  className,
  linkClassName,
  onLinkClick,
  compact = false,
}: {
  links: ProblemLink[];
  className?: string;
  linkClassName?: string;
  onLinkClick?: (provider: ProblemLink["provider"]) => void;
  compact?: boolean;
}) {
  if (!links.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        compact && "flex-nowrap gap-1",
        className,
      )}
    >
      {links.map((link) => (
        <ExternalLink
          key={`${link.provider}-${link.url}`}
          href={link.url}
          aria-label={PROVIDER_LABELS[link.provider]}
          title={PROVIDER_LABELS[link.provider]}
          className={cn(
            "inline-flex min-h-10 items-center rounded-md text-sm font-medium text-blue-600 hover:underline",
            compact &&
              "min-h-8 whitespace-nowrap border border-line bg-subtle px-2 text-xs",
            linkClassName,
          )}
          onClick={() => onLinkClick?.(link.provider)}
        >
          {compact
            ? { leetcode: "LeetCode", gfg: "GFG", tuf: "TUF" }[link.provider]
            : PROVIDER_LABELS[link.provider]}
        </ExternalLink>
      ))}
    </div>
  );
}
