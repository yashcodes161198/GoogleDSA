import {
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  Timer,
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
  { href: "/interview", label: "Interview", icon: Timer },
];
