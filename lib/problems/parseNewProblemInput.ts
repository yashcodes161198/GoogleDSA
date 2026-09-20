import {
  buildProblemLinks,
  deriveProblemSlug,
  preferredProblemLink,
} from "@/lib/problem-links";
import type { Difficulty, Problem, ProblemLink } from "@/lib/types";

export type NewProblemFormValues = {
  title: string;
  difficulty: Difficulty;
  leetcodeUrl: string;
  gfgUrl: string;
  tufUrl: string;
  topics: string;
  frequency: string;
  acceptanceRate: string;
};

export type ParsedNewProblem = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  frequency: number;
  acceptance_rate: number;
  link: string;
  links: ProblemLink[];
  topics: string[];
};

export type ParseNewProblemResult =
  | { ok: true; data: ParsedNewProblem }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<keyof NewProblemFormValues, string>>;
      values: NewProblemFormValues;
    };

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

function trimUrl(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePercent(value: string): number | null {
  if (value === "") return 0;
  const n = Number.parseFloat(value);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return n;
}

function isValidProviderUrl(
  provider: "leetcode" | "gfg" | "tuf",
  url: string
): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  } catch {
    return false;
  }
  if (provider === "leetcode") {
    return /leetcode\.com\/problems\//i.test(url);
  }
  if (provider === "gfg") {
    return /geeksforgeeks\.org\//i.test(url);
  }
  return /takeuforward\.org\//i.test(url);
}

export function formValuesFromFormData(formData: FormData): NewProblemFormValues {
  const difficultyRaw = trimUrl(formData.get("difficulty")).toUpperCase();
  const difficulty = DIFFICULTIES.includes(difficultyRaw as Difficulty)
    ? (difficultyRaw as Difficulty)
    : "MEDIUM";

  return {
    title: trimUrl(formData.get("title")),
    difficulty,
    leetcodeUrl: trimUrl(formData.get("leetcodeUrl")),
    gfgUrl: trimUrl(formData.get("gfgUrl")),
    tufUrl: trimUrl(formData.get("tufUrl")),
    topics: trimUrl(formData.get("topics")),
    frequency: trimUrl(formData.get("frequency")),
    acceptanceRate: trimUrl(formData.get("acceptanceRate")),
  };
}

export function parseTopics(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const topic = part.trim();
    if (!topic) continue;
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
  }
  return out;
}

export function parseNewProblemForm(formData: FormData): ParseNewProblemResult {
  const values = formValuesFromFormData(formData);
  const fieldErrors: Partial<Record<keyof NewProblemFormValues, string>> = {};

  if (!values.title) {
    fieldErrors.title = "Title is required.";
  }

  if (!DIFFICULTIES.includes(values.difficulty)) {
    fieldErrors.difficulty = "Choose a valid difficulty.";
  }

  const links = buildProblemLinks({
    leetcode: values.leetcodeUrl || null,
    gfg: values.gfgUrl || null,
    tuf: values.tufUrl || null,
  });

  if (links.length === 0) {
    fieldErrors.leetcodeUrl =
      "Add at least one link (LeetCode, GFG, or TakeUForward).";
  }

  if (values.leetcodeUrl && !isValidProviderUrl("leetcode", values.leetcodeUrl)) {
    fieldErrors.leetcodeUrl = "Use a LeetCode problem URL.";
  }
  if (values.gfgUrl && !isValidProviderUrl("gfg", values.gfgUrl)) {
    fieldErrors.gfgUrl = "Use a GeeksforGeeks problem URL.";
  }
  if (values.tufUrl && !isValidProviderUrl("tuf", values.tufUrl)) {
    fieldErrors.tufUrl = "Use a TakeUForward problem URL.";
  }

  const frequency = parsePercent(values.frequency);
  if (frequency === null) {
    fieldErrors.frequency = "Frequency must be between 0 and 100.";
  }

  const acceptance_rate = parsePercent(values.acceptanceRate);
  if (acceptance_rate === null) {
    fieldErrors.acceptanceRate = "Acceptance rate must be between 0 and 100.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Fix the highlighted fields and try again.",
      fieldErrors,
      values,
    };
  }

  const primaryLink = preferredProblemLink(links);
  const slug = deriveProblemSlug(links, values.title);

  return {
    ok: true,
    data: {
      slug,
      title: values.title,
      difficulty: values.difficulty,
      frequency: frequency ?? 0,
      acceptance_rate: acceptance_rate ?? 0,
      link: primaryLink,
      links,
      topics: parseTopics(values.topics),
    },
  };
}

export function problemInsertRow(
  data: ParsedNewProblem,
  id: string
): Problem {
  return {
    id,
    slug: data.slug,
    title: data.title,
    difficulty: data.difficulty,
    frequency: data.frequency,
    acceptance_rate: data.acceptance_rate,
    link: data.link,
    links: data.links,
    topics: data.topics,
  };
}
