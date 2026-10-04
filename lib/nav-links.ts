import {
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: ListChecks },
  { href: "/revise", label: "Revise", icon: RefreshCw },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/interview", label: "Interview", icon: Timer },
];
