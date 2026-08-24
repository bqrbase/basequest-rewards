"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/tasks", label: "Task2Earn", icon: "🎯" },
  { href: "/tasks/create", label: "Create", icon: "✨" },
  { href: "/tasks/me", label: "My Stats", icon: "👤" },
  { href: "/tasks/leaders", label: "Leaders", icon: "🏆" },
] as const;

export default function TaskNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Task2Earn"
      className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {NAV.map((item) => {
        const active =
          item.href === "/tasks"
            ? pathname === "/tasks"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
              active
                ? "border-cyan-300/40 bg-gradient-to-r from-violet-600/80 to-cyan-600/70 text-white shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
