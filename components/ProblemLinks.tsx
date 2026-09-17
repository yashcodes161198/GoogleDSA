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
}: {
  links: ProblemLink[];
  className?: string;
  linkClassName?: string;
  onLinkClick?: (provider: ProblemLink["provider"]) => void;
}) {
  if (!links.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {links.map((link) => (
        <ExternalLink
          key={`${link.provider}-${link.url}`}
          href={link.url}
          className={cn(
            "inline-flex min-h-10 items-center rounded-md text-sm font-medium text-blue-600 hover:underline",
            linkClassName
          )}
          onClick={() => onLinkClick?.(link.provider)}
        >
          {PROVIDER_LABELS[link.provider]}
        </ExternalLink>
      ))}
    </div>
  );
}
