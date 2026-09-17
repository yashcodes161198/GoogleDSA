import { slugFromLeetCodeUrl } from "@/lib/utils";
import type { ProblemLink, ProblemLinkProvider } from "@/lib/types";

export function slugFromGfgUrl(url: string): string | null {
  const match = url.match(/geeksforgeeks\.org\/problems\/([^/]+)/i);
  return match?.[1] ?? null;
}

export function slugFromTufUrl(url: string): string | null {
  const match = url.match(/takeuforward\.org\/plus\/dsa\/problems\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function preferredProblemLink(links: ProblemLink[]): string {
  const order: ProblemLinkProvider[] = ["leetcode", "gfg", "tuf"];
  for (const provider of order) {
    const found = links.find((l) => l.provider === provider);
    if (found?.url) return found.url;
  }
  return links[0]?.url ?? "";
}

export function deriveProblemSlug(links: ProblemLink[], fallbackTitle: string): string {
  const leetcode = links.find((l) => l.provider === "leetcode")?.url;
  if (leetcode) return slugFromLeetCodeUrl(leetcode);

  const gfg = links.find((l) => l.provider === "gfg")?.url;
  if (gfg) {
    const slug = slugFromGfgUrl(gfg);
    if (slug) return `gfg-${slug}`;
  }

  const tuf = links.find((l) => l.provider === "tuf")?.url;
  if (tuf) {
    const slug = slugFromTufUrl(tuf);
    if (slug) return `tuf-${slug}`;
  }

  return normalizeTitle(fallbackTitle).replace(/\s+/g, "-").slice(0, 80) || "problem";
}

export function parseProblemLinksJson(raw: string | undefined, primaryLink: string): ProblemLink[] {
  if (raw?.trim()) {
    try {
      const parsed = JSON.parse(raw) as ProblemLink[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return dedupeLinks(parsed);
      }
    } catch {
      // fall through
    }
  }

  if (primaryLink.includes("leetcode.com/problems/")) {
    return [{ provider: "leetcode", url: primaryLink }];
  }
  if (primaryLink.includes("geeksforgeeks.org/")) {
    return [{ provider: "gfg", url: primaryLink }];
  }
  if (primaryLink.includes("takeuforward.org/")) {
    return [{ provider: "tuf", url: primaryLink }];
  }

  return primaryLink ? [{ provider: "leetcode", url: primaryLink }] : [];
}

export function dedupeLinks(links: ProblemLink[]): ProblemLink[] {
  const seen = new Set<string>();
  const out: ProblemLink[] = [];
  for (const link of links) {
    if (!link.url || seen.has(link.url)) continue;
    seen.add(link.url);
    out.push(link);
  }
  return out;
}

export function buildProblemLinks(input: {
  leetcode?: string | null;
  gfg?: string | null;
  tuf?: string | null;
}): ProblemLink[] {
  const links: ProblemLink[] = [];
  if (input.leetcode) links.push({ provider: "leetcode", url: input.leetcode });
  if (input.gfg) links.push({ provider: "gfg", url: input.gfg });
  if (input.tuf) links.push({ provider: "tuf", url: input.tuf });
  return dedupeLinks(links);
}

export function resolveProblemLinks(problem: {
  link: string;
  links?: ProblemLink[] | null;
}): ProblemLink[] {
  if (problem.links && problem.links.length > 0) return problem.links;
  return parseProblemLinksJson(undefined, problem.link);
}

export const PROVIDER_LABELS: Record<ProblemLinkProvider, string> = {
  leetcode: "Open on LeetCode",
  gfg: "Open on GFG",
  tuf: "Open on TakeUForward",
};
