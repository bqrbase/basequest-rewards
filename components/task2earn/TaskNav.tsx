"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TOP_NAV = [
  { href: "/tasks/me", label: "My Stats", icon: "👤" },
  { href: "/tasks", label: "Task2Earn", icon: "🎯" },
  { href: "/tasks/leaders", label: "Leaders", icon: "🏆" },
] as const;

function isTopItemActive(pathname: string, href: string): boolean {
  if (href === "/tasks/me") {
    return pathname === "/tasks/me" || pathname.startsWith("/tasks/me/");
  }
  if (href === "/tasks/leaders") {
    return pathname === "/tasks/leaders" || pathname.startsWith("/tasks/leaders/");
  }
  if (pathname === "/tasks/me" || pathname.startsWith("/tasks/me/")) {
    return false;
  }
  if (pathname === "/tasks/leaders" || pathname.startsWith("/tasks/leaders/")) {
    return false;
  }
  return pathname === "/tasks" || pathname.startsWith("/tasks/");
}

export default function TaskNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Task2Earn" className="grid grid-cols-3 gap-2">
      {TOP_NAV.map((item) => {
        const active = isTopItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition-all duration-200 ${
              active
                ? "border-violet-300/70 bg-gradient-to-b from-violet-500/35 to-base-blue/25 text-white shadow-[0_0_28px_rgba(139,92,246,0.55),0_0_18px_rgba(0,82,255,0.28)]"
                : "border-white/8 bg-black/35 text-white/40 hover:border-white/14 hover:text-white/70"
            }`}
          >
            <span
              aria-hidden
              className={`text-xl leading-none ${active ? "drop-shadow-[0_0_10px_rgba(196,181,253,0.9)]" : "opacity-70"}`}
            >
              {item.icon}
            </span>
            <span className="text-[0.68rem] font-bold tracking-wide">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

const SUB_NAV = [
  { href: "/tasks", label: "Tasks" },
  { href: "/tasks/leaders", label: "Board" },
  { href: "/tasks/joined", label: "My Tasks" },
] as const;

export function MarketplaceSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Marketplace"
      className="flex rounded-full border border-white/10 bg-black/30 p-0.5"
    >
      {SUB_NAV.map((item) => {
        const active =
          item.href === "/tasks"
            ? pathname === "/tasks"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-8 flex-1 items-center justify-center rounded-full px-2 text-[0.68rem] font-semibold tracking-wide transition-colors ${
              active
                ? "bg-gradient-to-r from-violet-600/90 to-base-blue text-white shadow-[0_0_16px_rgba(124,58,237,0.45)]"
                : "text-white/40 hover:text-white/75"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
