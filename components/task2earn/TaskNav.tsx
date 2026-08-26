"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/tasks", label: "Tasks", icon: "🎯" },
  { href: "/tasks/create", label: "Create", icon: "✨" },
  { href: "/tasks/me", label: "My Tasks", icon: "👤" },
  { href: "/tasks/leaders", label: "Leaderboard", icon: "🏆" },
] as const;

export default function TaskNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Task2Earn"
      className="flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md"
    >
      <div className="flex w-full gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((item) => {
          const active =
            item.href === "/tasks"
              ? pathname === "/tasks"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex min-h-9 flex-1 shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 text-[0.72rem] font-semibold tracking-wide transition-colors sm:text-sm ${
                active
                  ? "bg-[#0052FF] text-white shadow-[0_6px_16px_rgba(0,82,255,0.35)]"
                  : "text-white/60 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span aria-hidden className="text-[0.85rem]">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
