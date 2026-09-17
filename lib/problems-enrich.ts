import { loadProblemsFromCsv } from "@/lib/problems-csv";
import { preferredProblemLink } from "@/lib/problem-links";
import type { Problem, ProblemLink } from "@/lib/types";

let linksBySlug: Map<string, ProblemLink[]> | null = null;

export function getProblemLinksBySlug(): Map<string, ProblemLink[]> {
  if (!linksBySlug) {
    linksBySlug = new Map(
      loadProblemsFromCsv().map((p) => [p.slug, p.links] as const)
    );
  }
  return linksBySlug;
}

export function enrichProblemFromCsv(problem: Problem): Problem {
  const fromCsv = getProblemLinksBySlug().get(problem.slug);
  if (!fromCsv?.length) return problem;
  if (problem.links?.length) return problem;
  return {
    ...problem,
    links: fromCsv,
    link: preferredProblemLink(fromCsv) || problem.link,
  };
}

export function enrichProblemsFromCsv(problems: Problem[]): Problem[] {
  return problems.map(enrichProblemFromCsv);
}
