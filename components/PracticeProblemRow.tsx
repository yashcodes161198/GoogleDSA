"use client";

import type { ReactNode } from "react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ProblemConcepts } from "@/components/ProblemConcepts";
import { ProblemLinks } from "@/components/ProblemLinks";
import { ProblemSolveTimer } from "@/components/ProblemSolveTimer";
import { DifficultyBadge } from "@/components/ui/badge";
import { resolveProblemLinks } from "@/lib/problem-links";
import type { Problem } from "@/lib/types";

export function PracticeProblemRow({
  problem,
  favorite,
  onFavoriteToggle,
  onLinkClick,
  complete,
  metadata,
  id,
  children,
}: {
  problem: Problem;
  favorite: boolean;
  onFavoriteToggle: () => void;
  onLinkClick: () => void;
  complete: boolean;
  metadata: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <article id={id} className="practice-row" data-complete={complete}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-1 sm:basis-auto">
          <FavoriteButton favorite={favorite} onToggle={onFavoriteToggle} />
          <h2 className="min-w-0 text-base font-medium leading-snug">
            {problem.title}
          </h2>
          <ProblemConcepts title={problem.title} topics={problem.topics} />
        </div>
        <ProblemLinks
          compact
          links={resolveProblemLinks(problem)}
          onLinkClick={onLinkClick}
        />
        <DifficultyBadge difficulty={problem.difficulty} />
        <span className="text-xs text-muted">{metadata}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <ProblemSolveTimer problemId={problem.id} compact />
        <div className="flex min-h-9 items-center gap-3 text-sm font-medium">
          {children}
        </div>
      </div>
    </article>
  );
}
