import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugFromLeetCodeUrl(link: string): string {
  const match = link.match(/\/problems\/([^/]+)/);
  return match?.[1] ?? link;
}
