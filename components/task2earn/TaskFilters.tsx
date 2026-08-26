"use client";

export type MarketplaceStatusFilter = "ongoing" | "completed" | "ended";

const FILTERS: { id: MarketplaceStatusFilter; label: string }[] = [
  { id: "ongoing", label: "Ongoing" },
  { id: "completed", label: "Completed" },
  { id: "ended", label: "Ended" },
];

type TaskFiltersProps = {
  active: MarketplaceStatusFilter;
  onChange: (filter: MarketplaceStatusFilter) => void;
};

export default function TaskFilters({ active, onChange }: TaskFiltersProps) {
  return (
    <div
      role="tablist"
      aria-label="Task status"
      className="flex rounded-full border border-white/10 bg-[#070b16]/80 p-0.5"
    >
      {FILTERS.map((filter) => {
        const selected = filter.id === active;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(filter.id)}
            className={`inline-flex min-h-8 flex-1 items-center justify-center rounded-full px-2 text-[0.68rem] font-semibold tracking-wide transition-colors ${
              selected
                ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]"
                : "text-white/40 hover:text-white/75"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
