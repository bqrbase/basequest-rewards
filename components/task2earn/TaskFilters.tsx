"use client";

export type MarketplaceSection =
  | "popular"
  | "new"
  | "ending"
  | "rewards";

const SECTIONS: { id: MarketplaceSection; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "new", label: "New" },
  { id: "ending", label: "Ending Soon" },
  { id: "rewards", label: "Highest Rewards" },
];

type TaskFiltersProps = {
  active: MarketplaceSection;
  onChange: (section: MarketplaceSection) => void;
};

export default function TaskFilters({ active, onChange }: TaskFiltersProps) {
  return (
    <div
      role="tablist"
      aria-label="Sort tasks"
      className="flex rounded-full border border-white/10 bg-black/25 p-0.5"
    >
      <div className="flex w-full gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((section) => {
          const selected = section.id === active;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(section.id)}
              className={`inline-flex min-h-8 flex-1 shrink-0 items-center justify-center rounded-full px-2.5 text-[0.65rem] font-semibold tracking-wide transition-colors sm:text-[0.7rem] ${
                selected
                  ? "bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                  : "text-white/45 hover:text-white/80"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const MARKETPLACE_SECTION_LABELS: Record<MarketplaceSection, string> = {
  popular: "Popular",
  new: "New",
  ending: "Ending Soon",
  rewards: "Highest Rewards",
};
