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
    <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SECTIONS.map((section) => {
        const selected = section.id === active;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[0.72rem] font-semibold ${
              selected
                ? "border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-100"
                : "border-white/10 bg-white/[0.04] text-white/60"
            }`}
          >
            {section.label}
          </button>
        );
      })}
    </div>
  );
}

export const MARKETPLACE_SECTION_LABELS: Record<MarketplaceSection, string> = {
  popular: "Popular",
  new: "New",
  ending: "Ending Soon",
  rewards: "Highest Rewards",
};
